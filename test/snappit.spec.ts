import * as childProcess from "child_process";

import {expect} from "chai";
import * as _ from "lodash";
import {By, ThenableWebDriver, WebDriver} from "selenium-webdriver";

import {Config, IConfig} from "../src/config";
import {$, Snappit} from "../src/snappit";

const WEBDRIVER_PATH = "./node_modules/.bin/webdriver-manager";

function browserTest(
    name: string,
    options: IConfig,
    driver?: ThenableWebDriver,
    skip?: boolean,
): void {
    const suiteFn = skip ? describe.skip : describe;

    suiteFn(name, function() {
        let snappit: Snappit;
        this.timeout(15000);
        this.slow(2500);

        before(() => {
            snappit = new Snappit(options, driver);
        });

        if (!driver) {
            it("should create a driver instance", async () => {
                // Snappit will throw if there is a problem in driver creation.
                driver = snappit.start();
                await driver;
            });
        }

        it("should navigate to the localhost page", async () => {
            // Cast here as TypeScript thinks driver might not be initialized.
            (driver as ThenableWebDriver).get("http://localhost:8080/");

            expect(await $("#color-div").isDisplayed()).to.equal(true);
        });

        it("should terminate the driver instances", async () => {
            await snappit.stop();
        });
    });
}

/* tslint:disable-next-line:no-namespace */ // This namespace is just used for declaration merging convenience for .skip
namespace browserTest {
    export function skip(
        name: string,
        options: IConfig,
        driver?: ThenableWebDriver,
    ): void {
        browserTest(name, options, driver, true);
    }
}

describe("Snappit", () => {

    describe("with useDirect set", () => {

        browserTest("Chrome", {
            browser: "chrome",
            useDirect: true,
        });

        browserTest.skip("Legacy FireFox", {
            browser: "firefox",
            useDirect: true,
            useGeckoDriver: false,
        });

        browserTest("GeckoDriver FireFox", {
            browser: "firefox",
            useDirect: true,
            useGeckoDriver: true,
        });

    });

    // Using the default server URL
    describe("when using a remote server", () => {

        browserTest("Chrome", {
            browser: "chrome",
            serverUrl: "http://localhost:4444/wd/hub",
            useDirect: false,
        });

        browserTest.skip("Legacy FireFox", {
            browser: "firefox",
            serverUrl: "http://localhost:4444/wd/hub",
            useDirect: false,
            useGeckoDriver: false,
        });

        browserTest("GeckoDriver FireFox", {
            browser: "firefox",
            serverUrl: "http://localhost:4444/wd/hub",
            useDirect: false,
            useGeckoDriver: true,
        });

    });

    describe("when using an existing driver", () => {
        return null;
    });
});
