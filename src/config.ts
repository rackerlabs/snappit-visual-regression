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

export interface IConfig extends ISnappitConfig {
    browser?: string;
    paths?: IConfigPaths;
    serverUrl?: string;
    useDirect?: boolean;
    useGeckoDriver?: boolean;
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
    logException: [],
    paths: getBinaryPaths(),
    screenshotsDir: "./screenshots",
    threshold: 0.04,
    useDirect: false,
    useGeckoDriver: false,
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
        throw new Error('Configuration error:  Please set a "browser" of either "chrome" or "firefox".');
    }

    // useDirect and !_.isEmpty both return booleans, so we can !== them for an XOR.
    const isValidLocation = config.useDirect !== !_.isEmpty(config.serverUrl);
    if (!config.useProvidedDriver && !isValidLocation) {
        throw new Error("Configuration error:  Please do only one of the following:" +
            'set "useDirect => true" OR provide a "serverUrl" option.');
    }

    const isValidThreshold = config.threshold && config.threshold >= 0 && config.threshold <= 0.99;
    if (!isValidThreshold) {
        throw new Error('Configuration error:  Please set a "threshold" between 0 and 0.99');
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
