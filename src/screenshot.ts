import * as fs from "fs-extra";
import * as path from "path";

import { PNG } from "pngjs";
import {
    By,
    error as WebDriverError,
    ILocation,
    ISize,
    ThenableWebDriver,
    WebDriver,
    WebElement,
    WebElementPromise,
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

class ElementScreenshotter {
    private driver: WebDriver;
    private element: WebElementPromise;

    constructor(
        driver: WebDriver,
        element: WebElementPromise,
    ) {
        this.driver = driver;
        this.element = element;
    }

    public async take() {
        const firefoxHeadless = (await this.driver.getCapabilities()).get("moz:headless");
        const devicePixelRatio = (await this.driver.executeScript("return window.devicePixelRatio") as number);
        const viewport: ISize = {
            height: (await this.driver.executeScript("return window.innerHeight")) as number,
            width: (await this.driver.executeScript("return window.innerWidth")) as number,
        };

        if (firefoxHeadless) {
            const OFFSET = 15; // pixels
            viewport.height = viewport.height -= OFFSET;
            viewport.width = viewport.width -= OFFSET;
        }

        const size = await this.element.getSize();
        const loc = await this.element.getLocation();

        const screenshotsLengthwise = Math.floor(size.width / viewport.width);
        const screenshotsHeightwise = Math.floor(size.height / viewport.height);
        const leftoverLengthwise = size.width % viewport.width;
        const leftoverHeightwise = size.height % viewport.height;

        let x = loc.x;
        let y = loc.y;
        const elementScreenshot = new PNG({
            height: size.height * devicePixelRatio,
            width: size.width * devicePixelRatio,
        });

        const ss = async () => PNG.sync.read(new Buffer(await this.driver.takeScreenshot(), "base64"));
        const takeAlongTotalWidth = async () => {
            const minX = Math.min(viewport.width, size.width - x);
            const minY = Math.min(viewport.height, size.height - y);
            const fullScreenshotsLengthwise = [...Array(screenshotsLengthwise).keys()].reverse();
            for (const widthShotsRemaining of fullScreenshotsLengthwise) {
                await this.driver.executeScript(`window.scroll(${x}, ${y})`);
                PNG.bitblt(
                    await ss(), elementScreenshot,
                    0, 0,
                    minX * devicePixelRatio, minY * devicePixelRatio,
                    (x - loc.x) * devicePixelRatio, (y - loc.y) * devicePixelRatio,
                );

                if (widthShotsRemaining) {
                    x += viewport.width;
                }
            }

            if (leftoverLengthwise) {
                if (screenshotsLengthwise) {
                    x += leftoverLengthwise;
                }

                await this.driver.executeScript(`window.scroll(${x}, ${y})`);
                PNG.bitblt(
                    await ss(), elementScreenshot,
                    0, 0,
                    minX * devicePixelRatio, minY * devicePixelRatio,
                    (x - loc.x) * devicePixelRatio, (y - loc.y) * devicePixelRatio,
                );
            }

            // reset back to the left-side of the element
            x = loc.x;
            await this.driver.executeScript(`window.scroll(${x}, ${y})`);
        };

        if (screenshotsLengthwise === 0 && screenshotsHeightwise === 0) {
            PNG.bitblt(
                await ss(), elementScreenshot,
                loc.x * devicePixelRatio, loc.y * devicePixelRatio,
                size.width * devicePixelRatio, size.height * devicePixelRatio,
                0, 0,
            );
        } else {
            await this.driver.executeScript(DROP_SCROLLBARS);
            const fullScreenshotsHeightwise = [...Array(screenshotsHeightwise).keys()].reverse();
            for (const heightShotsRemaining of fullScreenshotsHeightwise) {
                await takeAlongTotalWidth();

                if (heightShotsRemaining) {
                    y += viewport.height;
                }
            }

            if (leftoverHeightwise) {
                if (screenshotsHeightwise) {
                    y += leftoverHeightwise;
                }

                await takeAlongTotalWidth();
            }

            await this.driver.executeScript(REMOVE_DROP_SCROLLBARS);
        }

        return elementScreenshot;
    }
}

export class Screenshot {
    /**
     * Convert the name and directory of the screenshot into a path.
     */
    public static async buildPath(
        name: string,
        driver: ThenableWebDriver,
        screenshotsDir: string,
    ): Promise<string> {
        const capabilities = await driver.getCapabilities();
        const size = await driver.manage().window().getSize();
        const version = (capabilities.get("version") || capabilities.get("browserVersion"));
        const screenshotPath = path.resolve(screenshotsDir);
        return path.join(screenshotPath, name)
            .replace("{browserName}", capabilities.get("browserName"))
            .replace("{browserVersion}", version)
            .replace("{browserSize}", `${size.width}x${size.height}`)
            .replace(/.png$/, "")
            .split(path.sep)
            .map((value) => value.replace(/\W+/gi, "-"))
            .join(path.sep) + ".png";
    }

    /**
     * Screenshot the browser or element.
     */
    public static async take(
        driver: ThenableWebDriver,
        element?: WebElementPromise,
    ): Promise<Screenshot> {
        let buffer: Buffer | PNG;
        if (element) {
            const elementSnap = new ElementScreenshotter(driver, element);
            buffer = await elementSnap.take();
        } else {
            buffer = new Buffer(await driver.takeScreenshot(), "base64");
        }

        const screenshot = new Screenshot(buffer);
        return screenshot;
    }

    /*
     * Load a screenshot from a path.
     */
    public static fromPath(
        filePath: string,
    ): Screenshot {
        return new Screenshot(fs.readFileSync(filePath));
    }

    public png: PNG;

    constructor(
        source: Buffer | PNG,
    ) {
        this.png = source instanceof Buffer ? PNG.sync.read(source) : source;
    }

    /**
     * Determine if the current screenshot is the same size as another screenshot.
     */
    public isSameSize(
        compareShot: Screenshot,
    ): boolean {
        const sameWidth = (compareShot.png.width === this.png.width);
        const sameHeight = (compareShot.png.height === this.png.height);
        return (sameWidth && sameHeight);
    }

    /**
     * Compute the difference of the current screenshot with another screenshot by percentage of pixels.
     */
    public percentDiff(
        diffShot: Screenshot,
    ): number {
        let pixelDiff = 0;
        const bufferLength = this.png.data.length;

        // Default to 100% diff if images are not the same size.
        if (!this.isSameSize(diffShot)) {
            return 1;
        }

        for (let x = 0; x < bufferLength; x++) {
            if (this.png.data[x] !== diffShot.png.data[x]) {
                pixelDiff++;
            }
        }

        return pixelDiff / (this.png.width * this.png.height);
    }

    /**
     * Save a screenshot to a path.
     */
    public saveToPath(
        filePath: string,
    ): void {
        const basePath = filePath.slice(0, filePath.lastIndexOf(path.basename(filePath)));
        fs.mkdirpSync(basePath);
        fs.writeFileSync(filePath, PNG.sync.write(this.png));
    }
}
