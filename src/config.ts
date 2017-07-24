import * as path from 'path';
import * as fs from 'fs';

import * as _ from 'lodash';
import * as Webdriver from 'selenium-webdriver';
import {Config as WDMConfig} from 'webdriver-manager/built/lib/config';

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
    public threshold: number = 4;
    public resolutions: string = '1366x768';
    public screenshotsDir: string = './screenshots';
    public serverUrl: string;
    public useDirect: boolean = false;
    public paths: IConfigPaths;
    public useGeckoDriver: boolean = false;
    public useProvidedDriver: boolean = false;
    public sizes: Webdriver.ISize[];

    constructor(
        options?: IConfig
    ) {
        this.paths = this.getBinaryPaths();
        _.merge(this, options);
        this.sizes = this.parseResolutions();
        this.validate();
    }

    getBinaryPaths(): IConfigPaths {
        let seleniumPath = WDMConfig.getSeleniumDir();
        let updateJson = path.resolve(seleniumPath, 'update-config.json');
        let updateConfig = JSON.parse(fs.readFileSync(updateJson).toString());

        return {
            seleniumPath: seleniumPath,
            chromeExe: <string> updateConfig.chrome.last,
            geckoExe: <string> updateConfig.gecko.last
        };
    };

    parseResolutions(): Webdriver.ISize[] {
        return this.resolutions.split(',').map((sizeStr: string) => {
            let [width, height] = sizeStr.split('x').map((dim: string) => parseInt(dim.trim(), 10));
            return {
                width: width,
                height: height
            };
        });
    }

    validate (): void {
        let validBrowsers = [Webdriver.Browser.CHROME, Webdriver.Browser.FIREFOX];

        let isValidBrowser = _.includes(validBrowsers, this.browser);
        if (!this.useProvidedDriver && !isValidBrowser) {
            throw new Error('Configuration error:  Please set a "browser" of either "chrome" or "firefox".');
        }

        // useDirect and !_.isEmpty both return booleans, so we can !== them for an XOR.
        let isValidLocation = this.useDirect !== !_.isEmpty(this.serverUrl);
        if (!this.useProvidedDriver && !isValidLocation) {
            throw new Error('Configuration error:  Please do only one of the following:' +
                'set "useDirect => true" OR provide a "serverUrl" option.');
        }

        let isValidThreshold = this.threshold && this.threshold >= 1 && this.threshold <= 100;
        if (!isValidThreshold) {
            throw new Error('Configuration error:  Please set a "threshold" between 0 and 99%');
        }

        _.each(this.sizes, (size: Webdriver.ISize) => {
            let {width, height} = size;
            let isValidWidth = width >= 1 && width <= 9999;
            let isValidHeight = height >= 1 && height <= 9999;

            if (!isValidWidth || !isValidHeight) {
                throw new Error('Configuration error:  Please set "resolutions" as a comma separated' +
                    'list in "WIDTHxHEIGHT" format.  Resolutions must be between "1x1" and "9999x9999"');
            }
        });
    }
}
