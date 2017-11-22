import * as _ from "lodash";
import * as Webdriver from "selenium-webdriver";
import * as Chrome from "selenium-webdriver/chrome";
import * as Firefox from "selenium-webdriver/firefox";
import * as remote from "selenium-webdriver/remote";

import {IConfig} from "./config";

// Utility type for abstracting across Chrome/Firefox.
interface IBrowserDriver {
    Driver: typeof Webdriver.WebDriver;
    ServiceBuilder: typeof remote.DriverService.Builder;
}

export function getDriver(
    config: IConfig,
): Webdriver.WebDriver {
    const builder = new Webdriver.Builder()
        .usingServer(config.serverUrl)
        .forBrowser(config.browser);

    if (config.headless) {
        if (config.browser === Webdriver.Browser.FIREFOX) {
            const options = new Firefox.Options();
            const binary = new Firefox.Binary();

            binary.addArguments("-headless");
            options.setBinary(binary);
            builder.setFirefoxOptions(options);

        } else if (config.browser === Webdriver.Browser.CHROME) {
            const capabilities = Webdriver.Capabilities.chrome();

            capabilities.set("chromeOptions", { args: ["--headless"] });
            builder.withCapabilities(capabilities);
        }
    }

    return builder.build() as Webdriver.WebDriver;
}
