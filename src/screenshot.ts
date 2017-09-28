import * as fs from "fs-extra";
import * as path from "path";

import { PNG } from "pngjs";
import {
    By, error as WebDriverError, ILocation, ISize, ThenableWebDriver,
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
     * Screenshot the browser or element.
     */
    public static async take(
        driver: ThenableWebDriver,
        element?: WebElementPromise,
    ): Promise<Screenshot> {
        // This handles chrome because it doesn't impmlement element.takeScreenshot() yet.
        const isChrome = await (await driver.getCapabilities()).get("browserName") == "chrome";
        if (element && isChrome) {
            return this.chromeCanvasScreenshot(driver, element);
        }

        const buffer = new Buffer(await (element ? element : driver).takeScreenshot(), "base64");
        const screenshot = new Screenshot(buffer);
        return screenshot;
    }

    /**
     * Generate a screenshot via chrome canvas.
     * This is a workaround to screenshotting an element in chrome because chromedriver does not
     * implement WebElement.takeScreenshot
     */
    public static async chromeCanvasScreenshot(
        driver: ThenableWebDriver,
        element: WebElementPromise
    ): Promise<Screenshot> {
        const fn = `
            function inlineStyles(elem, origElem) {
                var children = elem.querySelectorAll('*');
                var origChildren = origElem.querySelectorAll('*');
                elem.style.cssText = getComputedStyle(origElem).cssText;

                Array.prototype.forEach.call(children, function (child, i) {
                    child.style.cssText = getComputedStyle(origChildren[i]).cssText;
                });
                elem.style.margin = elem.style.marginLeft = elem.style.marginTop = elem.style.marginBottom = elem.style.marginRight = '';
            }

            let origElem = arguments[0];
			let elem = origElem.cloneNode(true);
            inlineStyles(elem, origElem);
        `;
        const buffer = new Buffer((await driver.executeAsyncScript(fn, element)) as string, "base64");
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
