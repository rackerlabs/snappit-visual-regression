import * as _ from "lodash";
import * as Webdriver from "selenium-webdriver";
import * as Chrome from "selenium-webdriver/chrome";
import * as Firefox from "selenium-webdriver/firefox";
import * as remote from "selenium-webdriver/remote";

import {IConfig} from "./config";

export async function getDriver(
    config: IConfig,
): Promise<Webdriver.WebDriver> {
    const builder = new Webdriver.Builder()
        .usingServer(config.serverUrl)
        .forBrowser(config.browser);

    if (config.browser === Webdriver.Browser.CHROME) {
        const capabilities = Webdriver.Capabilities.chrome();
        const args = ["--no-sandbox"];
        if (config.headless) {
            args.push("--headless");
            if (config.initialViewportSize) {
                args.push(`--window-size=${config.initialViewportSize.slice(0, 2).join(",")}`);
            }
        }

        capabilities.set("chromeOptions", {
            args,
        });
        builder.withCapabilities(capabilities);
    }

    if (config.browser === Webdriver.Browser.FIREFOX && config.headless) {
        const options = new Firefox.Options();
        const binary = new Firefox.Binary();
        binary.addArguments("-headless");
        options.setBinary(binary);
        builder.setFirefoxOptions(options);
    }

    const driver = builder.build() as Webdriver.WebDriver;

    if (config.initialViewportSize) {
        await driver.manage().window().setSize(
            config.initialViewportSize[0],
            config.initialViewportSize[1],
        );
    }

    return driver;
}
