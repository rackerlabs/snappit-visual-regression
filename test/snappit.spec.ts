import * as childProcess from "child_process";

import {expect} from "chai";
import * as fs from "fs-extra";
import * as _ from "lodash";
import {By, ThenableWebDriver, WebDriver} from "selenium-webdriver";

import {Config, IConfig} from "../src/config";
import {
    $, ScreenshotMismatchException, ScreenshotNotPresentException,
    ScreenshotSizeException, Snappit,
} from "../src/snappit";

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
        } else {
            driver = driver as ThenableWebDriver;
        }

        it("should navigate to the localhost page", async () => {
            // Cast here as TypeScript thinks driver might not be initialized.
            driver.get("http://localhost:8080/");

            expect(await $("#color-div").isDisplayed()).to.eql(true);
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

    describe("when taking a screenshot", function() {
        let snappit: Snappit;
        let driver: ThenableWebDriver;
        this.timeout(15000);
        this.slow(2500);

        before(async () => {
            // Reset reference images

            // Initialize Snappit
            const options: IConfig = {
                browser: "chrome",
                screenshotsDir: "test/screenshots",
                threshold: 0.1,
                useDirect: true,
            };

            snappit = new Snappit(options);
            driver = snappit.start();
            await driver.get("http://localhost:8080/");
        });

        after(async () => {
            await snappit.stop();
        });

        /**
         * For the tests below, we use the size of the existing reference PNG to determine if a new PNG has been
         * saved.  If this proves unreliable, we could also take the screenshot a second time and assume that
         * it will not error.
         */
        it("should throw an error and save if the screenshot does not exist", async () => {
            const error = await snappit.snap("does-not-exist.png", $("#color-div")).catch((err) => err);
            expect(error).to.be.instanceof(ScreenshotNotPresentException);
            expect(fs.existsSync("./test/screenshots/does-not-exist.png")).to.eql(true);
        });

        it("should throw an error and save if the screenshot is a different size", async () => {
            const error = await snappit.snap("different-size.png", $("#color-div")).catch((err) => err);
            expect(error).to.instanceof(ScreenshotSizeException);
            expect(fs.statSync("./test/screenshots/different-size.png").size).to.not.eql(1164);
        });

        it("should throw an error and save if the screenshot is different above threshold", async () => {
            const error = await snappit.snap("different-above-threshold.png", $("#color-div")).catch((err) => err);
            expect(error).to.instanceof(ScreenshotMismatchException);
            expect(fs.statSync("./test/screenshots/different-above-threshold.png").size).to.not.eql(1102);
        });

        it("should not throw an error or save if the screenshot is different below threshold", async () => {
            await snappit.snap("different-below-threshold.png", $("#color-div"));
            expect(fs.statSync("./test/screenshots/different-below-threshold.png").size).to.eql(1157);
        });

        it("should not throw an error or save if the screenshot shows no difference", async () => {
            await snappit.snap("no-difference.png", $("#color-div"));
            expect(fs.statSync("./test/screenshots/no-difference.png").size).to.eql(370);
        });
    });
});
