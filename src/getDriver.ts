import * as _ from "lodash";
import * as Webdriver from "selenium-webdriver";
import * as Chrome from "selenium-webdriver/chrome";
import * as Firefox from "selenium-webdriver/firefox";
import * as remote from "selenium-webdriver/remote";

import {Config} from "./config";

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

function getDirectDriver(
    browser: IBrowserDriver,
    executor?: string,
    options?: Firefox.Options,
): Webdriver.ThenableWebDriver {

    // We don't want to build the service if executor is falsey.
    const srv = executor ? new browser.ServiceBuilder(executor).build() : undefined;

    // We have to cast here because TypeScript has no way of knowing we've modified the return value of createSession.
    return ThenableWebDriver(browser.Driver).createSession(options, srv) as Webdriver.ThenableWebDriver;
}

function getRemoteDriver(
    browserName: string,
    serverUrl: string,
    options: Firefox.Options,
): Webdriver.ThenableWebDriver {

    return new Webdriver.Builder()
        .usingServer(serverUrl)
        .forBrowser(browserName)
        .setFirefoxOptions(options)
        .build();
}

export function getDriver(
    config: Config,
): Webdriver.ThenableWebDriver {

    let browser: IBrowserDriver;
    let serviceBuilder: typeof remote.DriverService.Builder;
    let executor: string = "";
    let options: Firefox.Options;

    // Since we don't use chrome options we can just always set firefox options here.
    options = new Firefox.Options();
    options.useGeckoDriver(config.useGeckoDriver);

    // Determine the browser and executor path, default to Firefox
    browser = Firefox;
    if (config.useGeckoDriver) {
        executor = config.paths.geckoExe;
    }

    // Change to chrome if necessary
    if (config.browser === Webdriver.Browser.CHROME) {
        browser = Chrome;
        serviceBuilder = Chrome.ServiceBuilder;
        executor = config.paths.chromeExe;
    }

    // The default is to expect the remote case, so check for useDirect here.
    if (config.useDirect) {
        return getDirectDriver(browser, executor, options);
    }
    return getRemoteDriver(config.browser, config.serverUrl, options);
}
