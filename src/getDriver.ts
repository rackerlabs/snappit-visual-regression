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
    // The default is to expect the remote case, so check for useDirect here.
    if (config.useDirect) {
        const isChrome = (config.browser === Webdriver.Browser.CHROME);
        const browser: IBrowserDriver = isChrome ? Chrome : Firefox;
        const executor = isChrome ? config.paths.chromeExe : config.paths.geckoExe;
        const srv = new browser.ServiceBuilder(executor).build();

        // Must cast here because TypeScript has no way of knowing we've modified the return value of createSession.
        return ThenableWebDriver(browser.Driver).createSession(null, srv) as Webdriver.ThenableWebDriver;
    }

    const builder = new Webdriver.Builder()
        .usingServer(config.serverUrl)
        .forBrowser(config.browser);

    let options: Firefox.Options | Chrome.Options;
    if (config.browser === Webdriver.Browser.FIREFOX) {
        options = new Firefox.Options();
        if (config.headless) {
            const binary = new Firefox.Binary();
            binary.addArguments("--headless");
            options.setBinary(binary);
        }

        builder.setFirefoxOptions(options as Firefox.Options);
    } else if (config.browser === Webdriver.Browser.CHROME && config.headless) {
        const capabilities = Webdriver.Capabilities.chrome();
        capabilities.set("chromeOptions", { args: ["--headless"] });
        builder.withCapabilities(capabilities);
    }

    return builder.build();
}
