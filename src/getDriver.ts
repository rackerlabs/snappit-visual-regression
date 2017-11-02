import * as _ from "lodash";
import * as Webdriver from "selenium-webdriver";
import * as Chrome from "selenium-webdriver/chrome";
import * as Firefox from "selenium-webdriver/firefox";
import * as remote from "selenium-webdriver/remote";

import {IConfig} from "./config";

// Type aliaases for convenience
type Promise<T> = Webdriver.promise.Promise<T>;

// Utility type for abstracting across Chrome/Firefox.
interface IBrowserDriver {
    Driver: typeof Webdriver.WebDriver;
    ServiceBuilder: typeof remote.DriverService.Builder;
}

// Webdriver defines a proxy ThenableWebDriver type, but does not provide a mixin class or factory.
type Constructor<T> = new(...args: any[]) => T;

function ThenableWebDriver<T extends Constructor<Webdriver.WebDriver>>(
    Base: T,
): T {
    return class extends Base implements Webdriver.ThenableWebDriver {
        private pd: Promise<Webdriver.WebDriver>;

        constructor(
            ...args: any[],
        ) {

            super(...args);
            this.pd = super.getSession().then((session) => {
                return new Base(session, ...args.slice(1));
            });
        }

        public then<R>(
            optCallback?: (value: Webdriver.WebDriver) => Promise<R> | R,
            optErrback?: (error: any) => any,
        ): Promise<R> {

            return this.pd.then(optCallback, optErrback);
        }

        public catch<R>(
            errback: (err: any) => R | Promise<R>,
        ): Promise<R> {

            return this.pd.then(errback);
        }
    };
}

export function getDriver(
    config: IConfig,
): Webdriver.ThenableWebDriver {
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

    return builder.build();
}
