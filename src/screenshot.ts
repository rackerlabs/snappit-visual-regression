import * as fs from "fs-extra";
import * as path from "path";
import {PNG} from "pngjs";
import {
    By, error as WebDriverError, ISize, ThenableWebDriver,
    WebDriver, WebElement, WebElementPromise,
} from "selenium-webdriver";

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
        const screenshotPath = path.resolve(screenshotsDir);
        return path.join(screenshotPath, name)
            .replace("{browserName}", capabilities.get("browserName"))
            .replace("{browserVersion}", capabilities.get("version"))
            .replace("{browserSize}", `${size.width}x${size.height}`)
            .replace(/.png$/, "")
            .split(path.sep)
            .map((value) => value.replace(/\W+/gi, "-"))
            .join(path.sep) + ".png";
    }

    /**
     * Screenshot the entire browser, then crop the image to the element.
     * We use this method because not all drivers implement WebElement.takeScreenshot
     */
    public static async take(
        driver: ThenableWebDriver,
        element?: WebElementPromise,
    ): Promise<Screenshot> {
        const buffer = new Buffer(await driver.takeScreenshot(), "base64");
        const screenshot = new Screenshot(buffer);
        return element ? screenshot.cropToElement(element) : screenshot;
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
     * Crop the screenshot to the size of a webdriver element.
     */
    public async cropToElement(
        element: WebElementPromise,
    ): Promise<Screenshot> {
        const elemSize = await element.getSize();
        const elemLoc = await element.getLocation();

        const newPng = new PNG(elemSize);
        PNG.bitblt(this.png, newPng, elemLoc.x, elemLoc.y, elemSize.width, elemSize.height, 0, 0);
        return new Screenshot(newPng);
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

        for (let x =  0; x < bufferLength; x++) {
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

/**
 * Custom errors related to the Snappit class.
 */
export class ScreenshotException extends Error {
}

export class ScreenshotMismatchException extends ScreenshotException {
    constructor(message = "Screenshots do not match within threshold.") {
        super(message);
    }
}

export class ScreenshotNotPresentException extends ScreenshotException {
    constructor(message = "No previous screenshot found.") {
        super(message);
    }
}

export class ScreenshotSizeException extends ScreenshotException {
    constructor(message = "Screenshots differ with respect to dimension.") {
        super(message);
    }
}
