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

class ElementScreenshotter {
    private driver: WebDriver;
    private element: WebElementPromise;
    private firefoxHeadless: boolean;

    constructor(
        driver: WebDriver,
        element: WebElementPromise,
    ) {
        this.driver = driver;
        this.element = element;
    }

    /**
     * Don't forget to crop from the right/bottom if there is a partial element left over!
     * This function takes pictures of (for example) screenshots 0, 1, and 2.
     * It crops image 2 if needed -- when a leftover portion of the element still visible.
     *
     *  +============+
     *  | Oversized  |
     *  |  Element   |
     *  +============+
     *  |----|----|__|
     *    ^0   ^1  ^X
     *
     *  |_______|----|
     *    ^X      ^2
     *
     *  |_______..|--|
     *             ^2
     *
     *  +============+
     *  | Oversized  |
     *  |  Element   |
     *  +============+
     *  |----|----|--|
     *    ^0   ^1  ^2
     */
    public async take() {
        const devicePixelRatio = (await this.driver.executeScript("return window.devicePixelRatio") as number);
        console.log("ratio", devicePixelRatio);
        const viewport: ISize = {
            height: (await this.driver.executeScript("return window.innerHeight")) as number,
            width: (await this.driver.executeScript("return window.innerWidth")) as number,
        };

        if ((await this.driver.getCapabilities()).get("moz:headless")) {
            viewport.height = viewport.height -= 15;
            viewport.width = viewport.width -= 15;
        }

        const size = await this.element.getSize();
        const loc = await this.element.getLocation();

        const screenshotsLengthwise = Math.floor(size.width / viewport.width);
        const leftoverLengthwise = size.width % viewport.width;
        const screenshotsHeightwise = Math.floor(size.height / viewport.height);
        const leftoverHeightwise = size.height % viewport.height;

        let x = loc.x;
        let y = loc.y;
        const elementScreenshot = new PNG({
            height: size.height * devicePixelRatio,
            width: size.width * devicePixelRatio,
        });

        console.log("viewport", viewport.width, "x", viewport.height);
        console.log("elementScreenshot", elementScreenshot.width, "x", elementScreenshot.height);
        console.log("size", size.width, "x", size.height);
        console.log("loc", loc.x, loc.y);

        console.log("screenshotsLengthwise", Math.floor(size.width / viewport.width));
        console.log("leftoverLengthwise", size.width % viewport.width);
        console.log("screenshotsHeightwise", Math.floor(size.height / viewport.height));
        console.log("leftoverHeightwise", size.height % viewport.height);

        const takeAlongTotalWidth = async () => {
            const ss = async () => PNG.sync.read(new Buffer(await this.driver.takeScreenshot(), "base64"));
            const minX = Math.min(viewport.width, size.width - x);
            const minY = Math.min(viewport.height, size.height - y);
            const fullScreenshotsLengthwise = [...Array(screenshotsLengthwise).keys()].reverse();
            for (const widthShotsRemaining of fullScreenshotsLengthwise) {
                console.log(`0: window.scroll(${x}, ${y})`);
                await this.driver.executeScript(`window.scroll(${x}, ${y})`);
                console.log(`png0: (0, 0)-(${minX}, ${minY}) -> (${x - loc.x}, ${y - loc.y})`);
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
                let rightHandTrimPoint = 0;
                if (screenshotsLengthwise) {
                    x += leftoverLengthwise;
                    rightHandTrimPoint = (viewport.width - leftoverLengthwise) * devicePixelRatio;
                }

                console.log(`1: window.scroll(${x}, ${y})`);
                await this.driver.executeScript(`window.scroll(${x}, ${y})`);
                console.log(`png1: (${rightHandTrimPoint}, 0)-(${leftoverLengthwise}, ${minY}) -> (${size.width - leftoverLengthwise}, ${y - loc.y})`);
                PNG.bitblt(
                    await ss(), elementScreenshot,
                    rightHandTrimPoint, 0,
                    leftoverLengthwise * devicePixelRatio, minY * devicePixelRatio,
                    (size.width - leftoverLengthwise) * devicePixelRatio, (y - loc.y) * devicePixelRatio,
                );
            }

            // reset back to the left-side of the element
            x = loc.x;
            console.log(`2: window.scroll(${x}, ${y})`);
            await this.driver.executeScript(`window.scroll(${x}, ${y})`);
        };

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
