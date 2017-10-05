import * as fs from "fs-extra";
import * as _ from "lodash";
import * as path from "path";
import {PNG} from "pngjs";
import {
    By, error as WebDriverError, ThenableWebDriver,
    WebDriver, WebElement, WebElementPromise,
} from "selenium-webdriver";

import {
    IBrowserConfig,
    ISnappitConfig,
    prepareBrowserConfig,
    prepareSnappitConfig,
    validateSnappitConfig,
} from "./config";

import {
    NoDriverSessionException,
    ScreenshotMismatchException,
    ScreenshotNotPresentException,
    ScreenshotSizeException,
} from "./errors";

import {getDriver} from "./getDriver";
import {Screenshot} from "./screenshot";

/**
 * Snappit exposes shorthand to its public `$` and `snap` methods.  These methods
 * are only valid with a current Snappit session.  We declare their initial state to return
 * a `NoDriverSessionException` and modify them in the `start()` and `stop()` routines.
 */
let shorthandInstance: Snappit;

export async function snap(
    name: string,
    element?: WebElementPromise,
): Promise<void> {
    if (shorthandInstance) {
        return shorthandInstance.snap(name, element);
    }

    throw new NoDriverSessionException();
}

/* tslint:disable-next-line:no-namespace */
export namespace snap {
    export function configure(
        config: ISnappitConfig,
    ): void {
        if (shorthandInstance) {
            return shorthandInstance.configureSnap(config);
        }

        throw new NoDriverSessionException();
    }
}

export function $(
    selector: string,
): WebElementPromise {
    if (shorthandInstance) {
        return shorthandInstance.$(selector);
    }

    throw new NoDriverSessionException();
}

export class Snappit {
    private browserConfig: IBrowserConfig;
    private snappitConfig: ISnappitConfig;
    private driver: ThenableWebDriver;

    constructor(
        config: IBrowserConfig,
        driver?: ThenableWebDriver,
    ) {
        if (driver instanceof WebDriver) {
            config.useProvidedDriver = true;
        }

        this.browserConfig = prepareBrowserConfig(config);
        this.snappitConfig = prepareSnappitConfig({});
        // Update the global selector function
    }

    public start(): ThenableWebDriver {
        if (!this.driver) {
            this.driver = getDriver(this.browserConfig);
        }

        // Update the exported shorthand methods
        shorthandInstance = this;

        return this.driver;
    }

    public async stop(): Promise<void> {
        // Update the exported shorthand methods
        shorthandInstance = undefined;

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
        const filePath = await Screenshot.buildPath(name, this.driver, this.snappitConfig.screenshotsDir);
        const newShot = await Screenshot.take(this.driver, element);

        // Baseline image exists
        if (fs.existsSync(filePath)) {
            const oldShot = Screenshot.fromPath(filePath);

            if (!newShot.isSameSize(oldShot)) {
                newShot.saveToPath(filePath);
                throw new ScreenshotSizeException();
            }

            const diff = newShot.percentDiff(oldShot);
            if (diff > this.snappitConfig.threshold) {
                const prettyDiff = (diff * 100).toFixed(2) + "%";
                const message = `Screenshots do not match within threshold. ${prettyDiff} difference.`;
                newShot.saveToPath(filePath);
                throw new ScreenshotMismatchException(message);
            }

        // No baseline image
        } else {
            newShot.saveToPath(filePath);

            if (this.snappitConfig.throwNoBaseline) {
                throw new ScreenshotNotPresentException();
            }
        }
    }

    public configureSnap(
        config: ISnappitConfig,
    ): void {
        this.snappitConfig = _.merge(this.snappitConfig, _.cloneDeep(config));
        validateSnappitConfig(this.snappitConfig);
    }
}
