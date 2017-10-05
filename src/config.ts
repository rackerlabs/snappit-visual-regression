import * as fs from "fs-extra";
import * as path from "path";

import * as _ from "lodash";
import * as Webdriver from "selenium-webdriver";

export interface IBrowserConfigPaths {
    chromeExe: string;
    geckoExe: string;
    seleniumPath: string;
}

export interface IBrowserConfig {
    browser?: string;
    paths?: IBrowserConfigPaths;
    serverUrl?: string;
    useDirect?: boolean;
    useGeckoDriver?: boolean;
    useProvidedDriver?: boolean;
}

export interface ISnappitConfig {
    screenshotsDir?: string;
    threshold?: number;
    throwNoBaseline?: boolean;
}

export function prepareBrowserConfig(config: IBrowserConfig): IBrowserConfig {
    /* tslint:disable-next-line:prefer-const */
    let prepared: IBrowserConfig = _.cloneDeep(config);
    _.defaults(prepared, defaultBrowserConfig); // Mutates prepared
    validateBrowserConfig(prepared);
    return prepared;
}

export function prepareSnappitConfig(config: ISnappitConfig): ISnappitConfig {
    /* tslint:disable-next-line:prefer-const */
    let prepared: ISnappitConfig = _.cloneDeep(config);
    _.defaults(prepared, defaultSnappitConfig); // Mutates prepared
    validateSnappitConfig(prepared);
    return prepared;
}

const defaultBrowserConfig: IBrowserConfig = {
    browser: "chrome",
    paths: getBinaryPaths(),
    useDirect: false,
    useGeckoDriver: false,
    useProvidedDriver: false,
};

const defaultSnappitConfig: ISnappitConfig = {
    screenshotsDir: "./screenshots",
    threshold: 0.04,
    throwNoBaseline: true,
};

function getBinaryPaths(): IBrowserConfigPaths {
    const seleniumPath = "bin/selenium/";
    const geckoExe = path.resolve(seleniumPath, "geckodriver");
    const chromeExe = path.resolve(seleniumPath, "chromedriver");

    return {
        chromeExe,
        geckoExe,
        seleniumPath,
    };
}

export function validateBrowserConfig(
    config: IBrowserConfig,
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
}

export function validateSnappitConfig(
    config: ISnappitConfig,
): void {
    const isValidThreshold = config.threshold && config.threshold >= 0 && config.threshold <= 0.99;
    if (!isValidThreshold) {
        throw new Error('Configuration error:  Please set a "threshold" between 0 and 0.99');
    }

}
