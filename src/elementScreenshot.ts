import * as _ from "lodash";
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
document.getElementById('${SVR_ID}').remove();
`;

class ElementScreenshot {
    private driver: WebDriver;
    private element: WebElement;
    private elementLoc: ILocation;
    private elementSize: ISize;
    private viewport: ISize;

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
        if (process.env.CI) {
            /*
             * You can't trust the viewport size via javascript (at least in travis-ci, anyway). Last I checked, the
             * reported size of the viewport was one pixel smaller than the one reported by the width and height
             * of the screenshot taken of the full window. Since the screenshot reports the correct "viewport"
             * size for our use case, it is used as the "official" measurement.
             */
            const measurementScreenshot = await this.screenshot();
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
        return this;
    }

    public async take() {
        const coordinatesToScreenshotAt = await this.populateScreenshotCoordinates();
        const devicePixelRatio = (await this.driver.executeScript("return window.devicePixelRatio")) as number;
        const elementScreenshot = new PNG({
            height: this.elementSize.height * devicePixelRatio,
            width: this.elementSize.width * devicePixelRatio,
        });

        await this.driver.executeScript(DROP_SCROLLBARS);
        for (const screenshotCoordinate of coordinatesToScreenshotAt) {
            await this.driver.executeScript(`window.scroll(${screenshotCoordinate.x}, ${screenshotCoordinate.y})`);

            const root = await this.findElementCoordinatesInViewport(screenshotCoordinate);
            const min: ISize = {
                height: Math.min(this.viewport.height, this.elementSize.height),
                width: Math.min(this.viewport.width, this.elementSize.width),
            };

            PNG.bitblt(
                await this.screenshot(), elementScreenshot,
                root.x * devicePixelRatio, root.y * devicePixelRatio,
                min.width * devicePixelRatio, min.height * devicePixelRatio,
                (screenshotCoordinate.x - this.elementLoc.x) * devicePixelRatio,
                (screenshotCoordinate.y - this.elementLoc.y) * devicePixelRatio,
            );
        }

        await this.driver.executeScript(REMOVE_DROP_SCROLLBARS);
        return elementScreenshot;
    }

    private async screenshot() {
        return PNG.sync.read(new Buffer(await this.driver.takeScreenshot(), "base64"));
    }

    private async findElementCoordinatesInViewport(
        screenshotCoordinate: ILocation,
    ): Promise<ILocation> {
        const scrollPositionX = await this.driver.executeScript("return window.pageXOffset;") as number;
        const scrollPositionY = await this.driver.executeScript("return window.pageYOffset;") as number;
        const rootX = screenshotCoordinate.x - scrollPositionX;
        const rootY = screenshotCoordinate.y - scrollPositionY;
        return { x: rootX, y: rootY };
    }

    private async populateScreenshotCoordinates() {
        const coordinatesToScreenshotAt: ILocation[] = [];
        const numberOfHorizontalScreenshots = Math.floor(this.elementSize.width / this.viewport.width);
        const numberOfVerticalScreenshots = Math.floor(this.elementSize.height / this.viewport.height);
        const extraHorizontalScreenshot = this.elementSize.width % this.viewport.width;
        const extraVerticalScreenshot = this.elementSize.height % this.viewport.height;

        let x = this.elementLoc.x;
        let y = this.elementLoc.y;
        for (const iY of _.range(numberOfVerticalScreenshots).reverse() && [0]) {
            for (const iX of _.range(numberOfHorizontalScreenshots).reverse() && [0]) {
                coordinatesToScreenshotAt.push({ x, y });
                x += iX ? this.viewport.width : 0;
            }

            if (numberOfHorizontalScreenshots && extraHorizontalScreenshot) {
                x += extraHorizontalScreenshot;
                coordinatesToScreenshotAt.push({ x, y });
            }

            y += iY ? this.viewport.height : 0;
            x = this.elementLoc.x;
        }

        if (numberOfVerticalScreenshots && extraVerticalScreenshot) {
            y += extraVerticalScreenshot;
            for (const iX of _.range(numberOfHorizontalScreenshots).reverse() && [0]) {
                coordinatesToScreenshotAt.push({ x, y });
                x += iX ? this.viewport.width : 0;
            }

            if (numberOfHorizontalScreenshots && extraHorizontalScreenshot) {
                x += extraHorizontalScreenshot;
                coordinatesToScreenshotAt.push({ x, y });
            }
        }

        return coordinatesToScreenshotAt;
    }
}

export default async function(driver: WebDriver, element: WebElement) {
    return (await new ElementScreenshot(driver, element).prepare()).take();
}
