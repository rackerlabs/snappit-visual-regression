import * as fs from "fs-extra";
import * as _ from "lodash";
import * as path from "path";
import {PNG} from "pngjs";
import {
    By, error as WebDriverError,
    WebDriver, WebElement,
} from "selenium-webdriver";

import {
    IConfig,
    ISnappitConfig,
    prepareConfig,
} from "./config";

import {
    NoDriverSessionException,
    ScreenshotException,
    ScreenshotExceptionName,
    ScreenshotMismatchException,
    ScreenshotNoBaselineException,
    ScreenshotSizeDifferenceException,
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
    element?: WebElement,
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
): WebElement {
    if (shorthandInstance) {
        return shorthandInstance.$(selector);
    }

    throw new NoDriverSessionException();
}

export class Snappit {
    private config: IConfig;
    private driver: WebDriver;

    constructor(
        config: IConfig,
        driver?: WebDriver,
    ) {
        if (driver instanceof WebDriver) {
            config.useProvidedDriver = true;
        }

        this.config = prepareConfig(config);
    }

    public start(): WebDriver {
        if (!this.driver) {
            this.driver = getDriver(this.config);
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

        this.driver = undefined;
    }

    public $(
        selector: string,
    ): WebElement {
        return this.driver.findElement(By.css(selector));
    }

    public handleException(
        error: ScreenshotException,
    ): void {
        if (this.config.logException.indexOf(error.id) >= 0) {
            /* tslint:disable-next-line:no-console */
            console.log(error.message);
        } else {
            throw error;
        }
    }

    public async snap(
        name: string,
        element?: WebElement,
    ): Promise<void> {
        const filePath = await Screenshot.buildPath(name, this.driver, this.config.screenshotsDir);
        const shortPath = path.relative(process.cwd(), filePath);
        const newShot = await Screenshot.take(this.driver, element);

        // Baseline image exists
        if (fs.existsSync(filePath)) {
            const oldShot = Screenshot.fromPath(filePath);
            const diff = newShot.percentDiff(oldShot);

            if (!newShot.isSameSize(oldShot)) {
                newShot.saveToPath(filePath);
                this.handleException(new ScreenshotSizeDifferenceException(shortPath));
            } else if (diff > this.config.threshold) {
                const prettyDiff = `${(diff * 100).toFixed(2)}% / ${(this.config.threshold * 100).toFixed(2)}%`;
                const message = `${shortPath} (${prettyDiff})`;
                newShot.saveToPath(filePath);
                this.handleException(new ScreenshotMismatchException(message));
            }

        // No baseline image
        } else {
            newShot.saveToPath(filePath);
            this.handleException(new ScreenshotNoBaselineException(shortPath));
        }
    }

    public configureSnap(
        config: ISnappitConfig,
    ): void {
        this.config = prepareConfig(_.defaults(_.cloneDeep(config), this.config));
    }
}
