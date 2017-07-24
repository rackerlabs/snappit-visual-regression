import * as _ from "lodash";
import pixelmatch = require("pixelmatch");
import {PNG} from "pngjs";
import {By, ThenableWebDriver, WebDriver, error as WebDriverError, WebElement, WebElementPromise} from "selenium-webdriver";

import {Config, IConfig} from "./config";
import {getDriver} from "./getDriver";

export type IFindByCss = (selector:string) => WebElementPromise;

export let $ = function(search: string): WebElementPromise {
    throw new Error('You must call "new Snappit(config).start();" before invoking this method.');
};

export class Snappit {
    private config: Config;
    private driver: ThenableWebDriver;

    constructor(options: IConfig, driver?: ThenableWebDriver) {
        if (driver instanceof WebDriver) {
            options.useProvidedDriver = true;
        }

        this.config = new Config(options);
        $ = (selector:string): WebElementPromise => {
            return this.driver.findElement(By.css(selector));
        };
    }

    start(): ThenableWebDriver {
        if (!this.driver) {
            this.driver = getDriver(this.config);
        }

        return this.driver;
    }

    async stop(): Promise<void> {
        await this.driver.close();
    }
}
