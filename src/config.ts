import * as fs from "fs-extra";
import * as path from "path";

import * as _ from "lodash";
import * as Webdriver from "selenium-webdriver";

import {ScreenshotExceptionName} from "./errors";

export interface IConfigPaths {
    chromeExe: string;
    geckoExe: string;
    seleniumPath: string;
}

export interface ISnappitConfig {
    logException?: string[];
    screenshotsDir?: string;
    threshold?: number;
}

// https://wiki.saucelabs.com/display/DOCS/Test+Configuration+Options
export interface ISauceLabs {
    browserName?: string;
    build?: string; // displayed on both the Dashboard and Archives view
    chromedriverVersion?: string; // "2.35", "latest"
    commandTimeout?: number;
    customData?: any; // any valid JSON object, limited to 64KB in size
    extendedDebugging?: boolean;
    idleTimeout?: number;
    iedriverVersion?: string;
    maxDuration?: number;
    name?: string; // test names for jobs in the Dashboard and Archives view
    platform?: string; // "OS X 10.9", "Windows 10", "Linux", "Windows 7"
    priority?: number; // priority starts at 0 for highest, then 1 for next highest, etc.
    public?: string; // job result visibility: "public", "public restricted", "team", "private"
    recordScreenshots?: boolean;
    recordVideo?: boolean;
    tags?: string; // for grouping and filtering jobs in the Dashboard and Archives view
    timeZone?: string; // "Los Angeles", "New_York"
    tunnelIdentifier?: string; // "tunnel-identifier is the "official" configuration option...
    "tunnel-identifier"?: string; // "tunnelIdentifier" can be used instead to avoid bracket notation, if desired
    version?: string; // browser version
    screenResolution?: string; // "1280x1024"
    seleniumVersion?: string;
}

export interface IConfig extends ISnappitConfig {
    browser: string;
    headless?: boolean;
    initialViewportSize?: [number, number];
    paths?: IConfigPaths;
    serverUrl?: string;
    sauceLabs?: ISauceLabs;
    useProvidedDriver?: boolean;
}

export function prepareConfig(config: IConfig): IConfig {
    /* tslint:disable-next-line:prefer-const */
    let prepared: IConfig = _.cloneDeep(config);
    _.defaults(prepared, defaultConfig); // Mutates prepared
    validateConfig(prepared);
    return prepared;
}

const defaultConfig: IConfig = {
    browser: "chrome",
    headless: false,
    logException: [],
    paths: getBinaryPaths(),
    sauceLabs: {},
    screenshotsDir: "./screenshots",
    serverUrl: "http://localhost:4444/wd/hub",
    threshold: 0.04,
    useProvidedDriver: false,
};

function getBinaryPaths(): IConfigPaths {
    const seleniumPath = "bin/selenium/";
    const geckoExe = path.resolve(seleniumPath, "geckodriver");
    const chromeExe = path.resolve(seleniumPath, "chromedriver");

    return {
        chromeExe,
        geckoExe,
        seleniumPath,
    };
}

function validateConfig(
    config: IConfig,
): void {
    const validBrowsers = [Webdriver.Browser.CHROME, Webdriver.Browser.FIREFOX];

    const isValidBrowser = _.includes(validBrowsers, config.browser);
    if (!config.useProvidedDriver && !isValidBrowser) {
        throw new Error('Configuration error: Please set a "browser" of either "chrome" or "firefox".');
    }

    const isValidThreshold = config.threshold && config.threshold >= 0 && config.threshold <= 0.99;
    if (!isValidThreshold) {
        throw new Error('Configuration error: Please set a "threshold" between 0 and 0.99');
    }

    const exceptions: string[] = [
        ScreenshotExceptionName.MISMATCH,
        ScreenshotExceptionName.NO_BASELINE,
        ScreenshotExceptionName.SIZE_DIFFERENCE,
    ];
    const isValidLogException = config.logException.every((value) => exceptions.indexOf(value) >= 0);
    if (!isValidLogException) {
        throw new Error('Configuration error: "logException" should be an array with zero or more ' +
            `exception names: "${exceptions.join('", "')}".`);
    }
}
