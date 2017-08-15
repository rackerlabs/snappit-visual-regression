import * as fs from "fs-extra";
import * as path from "path";

import * as _ from "lodash";
import * as Webdriver from "selenium-webdriver";
import {Config as WDMConfig} from "webdriver-manager/built/lib/config";

export interface IConfigPaths {
    chromeExe: string;
    geckoExe: string;
    seleniumPath: string;
}

export interface IConfig {
    browser?: string;
    paths?: IConfigPaths;
    resolutions?: string | Webdriver.ISize[];
    screenshotsDir?: string;
    serverUrl?: string;
    threshold?: number;
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
    paths: getBinaryPaths(),
    resolutions: [{width: 1366, height: 768}],
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
        chromeExe: chromeExe,
        geckoExe: geckoExe,
        seleniumPath,
    };
}

function parseResolutions(
    resolutions: string | Webdriver.ISize[],
): Webdriver.ISize[] {
    if (Array.isArray(resolutions)) {
        return resolutions;
    }

    return resolutions.split(",").map((sizeStr: string) => {
        const [width, height] = sizeStr.split("x").map((dim: string) => parseInt(dim.trim(), 10));
        return {
            height,
            width,
        };
    });
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

    _.each(config.resolutions, (size: Webdriver.ISize) => {
        const {width, height} = size;
        const isValidWidth = width >= 1 && width <= 9999;
        const isValidHeight = height >= 1 && height <= 9999;

        if (!isValidWidth || !isValidHeight) {
            throw new Error('Configuration error:  Please set "resolutions" as a comma separated' +
                'list in "WIDTHxHEIGHT" format.  Resolutions must be between "1x1" and "9999x9999"');
        }
    });
}
