/* tslint:disable:no-console */
import * as fs from "fs-extra";
import * as _ from "lodash";
import * as path from "path";
import {PNG} from "pngjs";
import {
    By,
    error as WebDriverError,
    ThenableWebDriver,
    WebDriver,
    WebElement,
    WebElementPromise,
} from "selenium-webdriver";

import {Config, IConfig} from "./config";
import {getDriver} from "./getDriver";

export type IFindByCss = (selector: string) => WebElementPromise;

export let $ = (search: string): WebElementPromise => {
    throw new Error("You must call `new Snappit(config).start();` before invoking this method.");
};

export class ScreenshotMismatchException extends Error {
    constructor(message = "Screenshots do not match within threshold.") {
        super(message);
    }
}
export class ScreenshotNotPresentException extends Error {
    constructor(message = "No previous screenshot found.") {
        super(message);
    }
}
export class ScreenshotSizeException extends Error {
    constructor(message = "Screenshots differ with respect to dimension.") {
        super(message);
    }
}

export class Snappit {
    private config: Config;
    private driver: ThenableWebDriver;

    constructor(
        options: IConfig,
        driver?: ThenableWebDriver,
    ) {
        if (driver instanceof WebDriver) {
            options.useProvidedDriver = true;
        }

        this.config = new Config(options);

        $ = (selector: string): WebElementPromise => {
            return this.driver.findElement(By.css(selector));
        };
    }

    public start(): ThenableWebDriver {
        if (!this.driver) {
            this.driver = getDriver(this.config);
        }

        return this.driver;
    }

    public async stop(): Promise<void> {
        try {
            await this.driver.close();
            await this.driver.quit();
        } catch (e) {
            // Ignore the driver quit error
        }
    }

    public async snap(name: string, element: WebElementPromise): Promise<void> {
        const fileName = name.replace(/.png$/, "").replace(/\W+/gi, "-") + ".png";
        const screenshotPath = path.relative(".", this.config.screenshotsDir);
        const filePath = path.join(screenshotPath, fileName);

        /**
         * Screenshot the entire browser, then crop the image to the element.
         * We use this method because not all drivers implement WebElement.takeScreenshot
         */
        const elemSize = await element.getSize();
        const elemLoc = await element.getLocation();

        const browserShot = new Buffer(await this.driver.takeScreenshot(), "base64");
        const browserPng = PNG.sync.read(browserShot);
        const newPng = new PNG(elemSize);
        PNG.bitblt(browserPng, newPng, elemLoc.x, elemLoc.y, elemSize.width, elemSize.height, 0, 0);

        // Baseline image exists
        if (fs.existsSync(filePath)) {
            const oldPng = PNG.sync.read(fs.readFileSync(filePath));

            const sameWidth = (oldPng.width === newPng.width);
            const sameHeight = (oldPng.height === newPng.height);
            if (!sameWidth || !sameHeight) {
                fs.writeFileSync(filePath, PNG.sync.write(newPng));
                throw new ScreenshotSizeException();
            }

            let pixelDiff = 0;
            const bufferLength = oldPng.data.length;
            for (let x =  0; x < bufferLength; x++) {
                if (newPng.data[x] !== oldPng.data[x]) {
                    pixelDiff++;
                }
            }

            const percentChanged = pixelDiff / (oldPng.width * oldPng.height);
            if (percentChanged > this.config.threshold) {
                fs.writeFileSync(filePath, PNG.sync.write(newPng));
                throw new ScreenshotMismatchException();
            }

        // No baseline image
        } else {
            fs.writeFileSync(filePath, PNG.sync.write(newPng));
            throw new ScreenshotNotPresentException();
        }
    }
}
