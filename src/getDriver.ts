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

    // saucelabs makes typescript ugly
    if (config.sauceLabs.tunnelIdentifier !== undefined) {
        config.sauceLabs["tunnel-identifier"] = config.sauceLabs.tunnelIdentifier;
    }

    if (config.browser === Webdriver.Browser.CHROME) {
        const capabilitiesChrome = Webdriver.Capabilities.chrome();
        const args = ["--no-sandbox"];
        if (config.headless) {
            args.push("--headless");
            if (config.initialViewportSize) {
                args.push(`--window-size=${config.initialViewportSize.slice(0, 2).join(",")}`);
            }
        }

        capabilitiesChrome.merge(config.sauceLabs);
        capabilitiesChrome.set("chromeOptions", {
            args,
        });

        builder.withCapabilities(capabilitiesChrome);
    }

    if (config.browser === Webdriver.Browser.FIREFOX) {
        const capabilitiesFirefox = Webdriver.Capabilities.firefox();
        capabilitiesFirefox.merge(config.sauceLabs);

        if (config.headless) {
            const options = new Firefox.Options();
            const binary = new Firefox.Binary();
            binary.addArguments("-headless");
            options.setBinary(binary);
            builder.setFirefoxOptions(options);
        }

        builder.withCapabilities(capabilitiesFirefox);
    }

    if (config.browser === Webdriver.Browser.SAFARI) {
        const capabilitiesSafari = Webdriver.Capabilities.safari();
        capabilitiesSafari.merge(config.sauceLabs);

        builder.withCapabilities(capabilitiesSafari);
    }

    if (config.browser === Webdriver.Browser.EDGE) {
        const capabilitiesEdge = Webdriver.Capabilities.edge();
        capabilitiesEdge.merge(config.sauceLabs);

        builder.withCapabilities(capabilitiesEdge);
    }

    if (config.browser === Webdriver.Browser.INTERNET_EXPLORER) {
        const capabilitiesIe = Webdriver.Capabilities.ie();
        capabilitiesIe.merge(config.sauceLabs);

        builder.withCapabilities(capabilitiesIe);
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
