import * as fs from "fs-extra";
import * as path from "path";

import * as _ from "lodash";
import * as Webdriver from "selenium-webdriver";

export interface IConfigPaths {
    chromeExe: string;
    geckoExe: string;
    seleniumPath: string;
}

export interface IConfig {
    browser?: string;
    includeDevicePixelRatio?: boolean;
    paths?: IConfigPaths;
    screenshotsDir?: string;
    serverUrl?: string;
    threshold?: number;
    throwNoBaseline?: boolean;
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
    includeDevicePixelRatio: false,
    paths: getBinaryPaths(),
    screenshotsDir: "./screenshots",
    threshold: 0.04,
    throwNoBaseline: true,
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
}
