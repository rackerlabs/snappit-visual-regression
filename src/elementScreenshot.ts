import { PNG } from "pngjs";
import {
    ILocation,
    ISize,
    WebDriver,
    WebElement,
} from "selenium-webdriver";

const SVR_ID = "added-by-snappit-visual-regression";
const DROP_SCROLLBARS = `
var head = document.querySelector("head");
var style = document.createElement("style");
style.id = "${SVR_ID}";
style.type = "text/css";
style.innerText = "::-webkit-scrollbar { display: none; }"
head.appendChild(style);
`;

const REMOVE_DROP_SCROLLBARS = `
document.querySelector('#${SVR_ID}').remove();
`;

class ElementScreenshot {
    private devicePixelRatio: number;
    private driver: WebDriver;
    private element: WebElement;
    private elementLoc: ILocation;
    private elementScreenshot: PNG; // final result
    private elementSize: ISize;
    private screenshotsHeightwise: number;
    private screenshotsLengthwise: number;
    private viewport: ISize;
    private x: number; // browser window's current X position
    private y: number; // browser window's current Y position

    constructor(
        driver: WebDriver,
        element: WebElement,
    ) {
        this.driver = driver;
        this.element = element;
    }
    /**
     * Constructor functions cannot be async. This will bootstrap some shared values used between
     * the logic that takes *all* screenshots and the one that takes *the majority* of the screenshots.
     */
    public async prepare() {
        this.devicePixelRatio = (await this.driver.executeScript("return window.devicePixelRatio")) as number;

        if (process.env.CI) {
            const measurementScreenshot = await this.ss();
            this.viewport = {
                height: measurementScreenshot.height,
                width: measurementScreenshot.width,
            };

        } else {
            this.viewport = {
                height: (await this.driver.executeScript("return window.innerHeight")) as number,
                width: (await this.driver.executeScript("return window.innerWidth")) as number,
            };

            const firefoxHeadless = (await this.driver.getCapabilities()).get("moz:headless");
            if (firefoxHeadless) {
                // I think this is used because FF headless doesn't consider scrollbars as part of the viewport...?
                const OFFSET = 15; // pixels
                this.viewport.height = this.viewport.height -= OFFSET;
                this.viewport.width = this.viewport.width -= OFFSET;
            }
        }

        this.elementSize = await this.element.getSize();
        this.elementLoc = await this.element.getLocation();

        this.screenshotsLengthwise = Math.floor(this.elementSize.width / this.viewport.width);
        this.screenshotsHeightwise = Math.floor(this.elementSize.height / this.viewport.height);

        // these get mutated quite frequently...
        this.x = this.elementLoc.x;
        this.y = this.elementLoc.y;
        this.elementScreenshot = new PNG({
            height: this.elementSize.height * this.devicePixelRatio,
            width: this.elementSize.width * this.devicePixelRatio,
        });

        return this;
    }

    public async take() {
        const singleScreenshotOnly = this.screenshotsLengthwise === 0 && this.screenshotsHeightwise === 0;
        if (singleScreenshotOnly) {
            await this.scroll();
            const scrollPositionX = await this.driver.executeScript("return window.pageXOffset;") as number;
            const scrollPositionY = await this.driver.executeScript("return window.pageYOffset;") as number;
            const rootX = this.elementLoc.x - scrollPositionX;
            const rootY = this.elementLoc.y - scrollPositionY;
            // easy enough
            PNG.bitblt(
                await this.ss(), this.elementScreenshot,
                rootX * this.devicePixelRatio, rootY * this.devicePixelRatio,
                this.elementSize.width * this.devicePixelRatio, this.elementSize.height * this.devicePixelRatio,
                0, 0,
            );
        } else {
            await this.driver.executeScript(DROP_SCROLLBARS);
            const leftoverHeightwise = this.elementSize.height % this.viewport.height;
            const fullScreenshotsHeightwise = [...Array(this.screenshotsHeightwise).keys()].reverse();

            for (const heightShotsRemaining of fullScreenshotsHeightwise) {
                await this.takeAlongTotalWidth();

                if (heightShotsRemaining) {
                    this.y += this.viewport.height;
                }
            }

            if (leftoverHeightwise) {
                if (this.screenshotsHeightwise) {
                    this.y += leftoverHeightwise;
                }

                await this.takeAlongTotalWidth();
            }

            await this.driver.executeScript(REMOVE_DROP_SCROLLBARS);
        }

        return this.elementScreenshot;
    }

    private async ss() { return PNG.sync.read(new Buffer(await this.driver.takeScreenshot(), "base64")); }
    private async scroll() { await this.driver.executeScript(`window.scroll(${this.x}, ${this.y})`); }
    private async takeAlongTotalWidth() {
        const leftoverLengthwise = this.elementSize.width % this.viewport.width;
        const minX = Math.min(this.viewport.width, this.elementSize.width);
        const minY = Math.min(this.viewport.height, this.elementSize.height);
        const fullScreenshotsLengthwise = [...Array(this.screenshotsLengthwise).keys()].reverse();

        for (const widthShotsRemaining of fullScreenshotsLengthwise) {
            await this.scroll();
            const ss = await this.ss();
            PNG.bitblt(
                await this.ss(), this.elementScreenshot,
                0, 0,
                minX * this.devicePixelRatio, minY * this.devicePixelRatio,
                (this.x - this.elementLoc.x) * this.devicePixelRatio,
                (this.y - this.elementLoc.y) * this.devicePixelRatio,
            );

            if (widthShotsRemaining) {
                this.x += this.viewport.width;
            }
        }

        if (leftoverLengthwise) {
            if (this.screenshotsLengthwise) {
                this.x += leftoverLengthwise;
            }

            await this.scroll();
            const ss1 = await this.ss();
            PNG.bitblt(
                await this.ss(), this.elementScreenshot,
                0, 0,
                minX * this.devicePixelRatio, minY * this.devicePixelRatio,
                (this.x - this.elementLoc.x) * this.devicePixelRatio,
                (this.y - this.elementLoc.y) * this.devicePixelRatio,
            );
        }

        // reset back to the left-side of the element
        this.x = this.elementLoc.x;
        await this.scroll();
    }

}

export default async function(driver: WebDriver, element: WebElement) {
    return (await new ElementScreenshot(driver, element).prepare()).take();
}
