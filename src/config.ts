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
    browser: string;
    threshold?: number;
    resolutions?: string;
    screenshotsDir?: string;
    paths?: IConfigPaths;
    serverUrl?: string;
    useDirect: boolean;
    useGeckoDriver?: boolean;
    useProvidedDriver?: boolean;
}

export class Config implements IConfig {
    public browser: string;
    public threshold: number = 0.04;
    public resolutions: string = "1366x768";
    public screenshotsDir: string = "./screenshots";
    public serverUrl: string;
    public useDirect: boolean = false;
    public paths: IConfigPaths;
    public useGeckoDriver: boolean = false;
    public useProvidedDriver: boolean = false;
    public sizes: Webdriver.ISize[];

    constructor(
        options?: IConfig,
    ) {
        this.paths = this.getBinaryPaths();
        _.merge(this, options);
        this.sizes = this.parseResolutions();
        this.validate();
    }

    private getBinaryPaths(): IConfigPaths {
        const seleniumPath = "bin/selenium/";
        const geckoExe = path.resolve(seleniumPath, "geckodriver-v0.18.0");
        const chromeExe = path.resolve(seleniumPath, "chromedriver_2.31");

        return {
            chromeExe,
            geckoExe,
            seleniumPath,
        };
    }

    private parseResolutions(): Webdriver.ISize[] {
        return this.resolutions.split(",").map((sizeStr: string) => {
            const [width, height] = sizeStr.split("x").map((dim: string) => parseInt(dim.trim(), 10));
            return {
                height,
                width,
            };
        });
    }

    private validate(): void {
        const validBrowsers = [Webdriver.Browser.CHROME, Webdriver.Browser.FIREFOX];

        const isValidBrowser = _.includes(validBrowsers, this.browser);
        if (!this.useProvidedDriver && !isValidBrowser) {
            throw new Error('Configuration error:  Please set a "browser" of either "chrome" or "firefox".');
        }

        // useDirect and !_.isEmpty both return booleans, so we can !== them for an XOR.
        const isValidLocation = this.useDirect !== !_.isEmpty(this.serverUrl);
        if (!this.useProvidedDriver && !isValidLocation) {
            throw new Error("Configuration error:  Please do only one of the following:" +
                'set "useDirect => true" OR provide a "serverUrl" option.');
        }

        const isValidThreshold = this.threshold && this.threshold >= 0 && this.threshold <= 0.99;
        if (!isValidThreshold) {
            throw new Error('Configuration error:  Please set a "threshold" between 0 and 0.99');
        }

        _.each(this.sizes, (size: Webdriver.ISize) => {
            const {width, height} = size;
            const isValidWidth = width >= 1 && width <= 9999;
            const isValidHeight = height >= 1 && height <= 9999;

            if (!isValidWidth || !isValidHeight) {
                throw new Error('Configuration error:  Please set "resolutions" as a comma separated' +
                    'list in "WIDTHxHEIGHT" format.  Resolutions must be between "1x1" and "9999x9999"');
            }
        });
    }
}
