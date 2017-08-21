import * as fs from "fs-extra";
import * as path from "path";
import {PNG} from "pngjs";
import {
    By, error as WebDriverError, ThenableWebDriver,
    WebDriver, WebElement, WebElementPromise,
} from "selenium-webdriver";

import {IConfig, prepareConfig} from "./config";
import {getDriver} from "./getDriver";
import {
    Screenshot,
    ScreenshotMismatchException,
    ScreenshotNotPresentException,
    ScreenshotSizeException,
} from "./screenshot";

/**
 * Snappit exposes shortcuts to its public `$` and `snap` methods.  These methods
 * are only valid with a current Snappit session.  We declare their initial state to return
 * a `NoDriverSessionException` and modify them in the `start()` and `stop()` routines.
 */
export type ISnap = (name: string, element?: WebElementPromise) => Promise<void>;
const snapPreInit: ISnap = async () => {
    throw new NoDriverSessionException();
};
export let snap: ISnap = snapPreInit;

export type IFindByCss = (selector: string) => WebElementPromise;
const $PreInit: IFindByCss = () => {
    throw new NoDriverSessionException();
};
export let $: IFindByCss = $PreInit;

/**
 * Custom errors related to the Snappit class.
 */
export class NoDriverSessionException extends Error {
    constructor(message = "You must call 'new Snappit(config).start();' before invoking this method.") {
        super(message);
    }
}

export class Snappit {
    private config: IConfig;
    private driver: ThenableWebDriver;

    constructor(
        config: IConfig,
        driver?: ThenableWebDriver,
    ) {
        if (driver instanceof WebDriver) {
            config.useProvidedDriver = true;
        }

        this.config = prepareConfig(config);

        // Update the global selector function
    }

    public start(): ThenableWebDriver {
        if (!this.driver) {
            this.driver = getDriver(this.config);
        }

        // Update the exported shorthand methods
        $ = this.$.bind(this);
        snap = this.snap.bind(this);

        return this.driver;
    }

    public async stop(): Promise<void> {
        // Update the exported shorthand methods
        $ = $PreInit;
        snap = snapPreInit;

        try {
            await this.driver.close();
            await this.driver.quit();
        } catch (e) {
            // Ignore the driver quit error
        }
    }

    public $(
        selector: string,
    ): WebElementPromise {
        return this.driver.findElement(By.css(selector));
    }

    public async snap(
        name: string,
        element?: WebElementPromise,
    ): Promise<void> {
        const filePath = await Screenshot.buildPath(name, this.driver, this.config.screenshotsDir);
        const newShot = await Screenshot.take(this.driver, element);

        // Baseline image exists
        if (fs.existsSync(filePath)) {
            const oldShot = Screenshot.fromPath(filePath);

            if (!newShot.isSameSize(oldShot)) {
                newShot.saveToPath(filePath);
                /* tslint:disable-next-line:no-console */
                console.log(oldShot.png.height, oldShot.png.width);
                /* tslint:disable-next-line:no-console */
                console.log(newShot.png.height, newShot.png.width);
                throw new ScreenshotSizeException();
            }

            if (newShot.percentDiff(oldShot) > this.config.threshold) {
                newShot.saveToPath(filePath);
                throw new ScreenshotMismatchException();
            }

        // No baseline image
        } else {
            newShot.saveToPath(filePath);
            throw new ScreenshotNotPresentException();
        }
    }
}
