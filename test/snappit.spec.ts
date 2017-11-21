import * as childProcess from "child_process";

import {expect} from "chai";
import * as fs from "fs-extra";
import * as _ from "lodash";
import * as path from "path";
import {By, ISize, ThenableWebDriver, WebDriver, WebElementPromise} from "selenium-webdriver";

import {IConfig, ISnappitConfig} from "../src/config";

import {
    NoDriverSessionException,
    ScreenshotException,
    ScreenshotExceptionName,
    ScreenshotMismatchException,
    ScreenshotNoBaselineException,
    ScreenshotSizeDifferenceException,
} from "../src/errors";
import {$, snap, Snappit} from "../src/snappit";

async function resizeViewport(
    driver: ThenableWebDriver,
    width: number = 1366,
    height: number = 768,
): Promise<void> {
    await driver.manage().window().setSize(width, height);
}

type ISuiteFn = typeof describe | typeof describe.only | typeof describe.skip;

function browserTest(
    suiteName: string,
    config: IConfig,
    suiteFn: ISuiteFn = describe,
): void {

    suiteFn(suiteName, function() {
        let driver: ThenableWebDriver;
        let snappit: Snappit;
        this.timeout(15000);
        this.slow(2500);

        before(() => {
            config.screenshotsDir = `./test/screenshots/${suiteName}`;
            config.threshold = 0.1;

            snappit = new Snappit(config);
        });

        describe("before 'snappit.start()'", () => {
            it("should throw an error on invoking '$'", () => {
                const fn = $ as () => any;
                expect(fn).to.throw(NoDriverSessionException);
            });

            it("should throw an error on invoking 'snap'", async () => {
                const error = await snap("foo").catch((err: NoDriverSessionException) => err);
                expect(error).to.be.an.instanceOf(NoDriverSessionException);
            });
        });

        describe("driver initialization", () => {
            it("should create a driver instance", async () => {
                // Snappit will throw if there is a problem in driver creation.
                driver = snappit.start();
                await driver;
            });

            it("should navigate to the localhost page", async () => {
                driver.get("http://localhost:8080/");

                expect(await $("#color-div").isDisplayed()).to.eql(true);
            });

            it("should terminate the driver instance", async () => {
                await snappit.stop();
            });
        });

        describe("after 'snappit.stop()'", () => {
            before(async () => {
                await snappit.start();
                await snappit.stop();
            });

            it("should throw an error on invoking '$'", () => {
                const fn = $ as () => any;
                expect(fn).to.throw(NoDriverSessionException);
            });

            it("should throw an error on invoking 'snap'", async () => {
                const error = await snap("foo").catch((err: NoDriverSessionException) => err);
                expect(error).to.be.an.instanceOf(NoDriverSessionException);
            });
        });

        describe("screenshots", () => {
            before(async () => {
                driver = snappit.start();
                await driver.get("http://localhost:8080/");
            });

            after(async () => {
                await snappit.stop();
            });

            it("should throw an error if the screenshot does not exist", async () => {
                const error = await snap("does-not-exist.png", $("#color-div")).catch((err) => err);
                expect(error).to.be.an.instanceof(ScreenshotNoBaselineException);
            });

            it("should throw an error if the screenshot is a different size", async () => {
                await snap("different-size.png", $("body")).catch((err) => err);
                const error = await snap("different-size.png", $("#color-div")).catch((err) => err);
                expect(error).to.be.an.instanceof(ScreenshotSizeDifferenceException);
            });

            it("should throw an error if the screenshot is different above threshold", async () => {
                await snap("different-above-threshold.png", $("#color-div")).catch((err) => err);
                $("#toggle-button").click();
                const error = await snap("different-above-threshold.png", $("#color-div")).catch((err) => err);
                expect(error).to.be.an.instanceof(ScreenshotMismatchException);
            });

            it("should not throw an error if the screenshot is different below threshold", async () => {
                await snap("different-below-threshold.png", $("#color-div")).catch((err) => err);
                $("#border-button").click();
                await snap("different-below-threshold.png", $("#color-div"));
            });

            it("should not throw an error if the screenshot shows no difference", async () => {
                await snap("no-difference.png", $("#color-div")).catch((err) => err);
                await snap("no-difference.png", $("#color-div"));
            });

            it("should take a snapshot of an element that is too wide", async () => {
                await driver.get("http://localhost:8080/too-wide");
                await snap("too-wide.png", $("#too-wide")).catch((err) => err);
            });

            it("should take a snapshot of an element that is too tall", async () => {
                await driver.get("http://localhost:8080/too-tall");
                await snap("too-tall.png", $("#too-tall")).catch((err) => err);
            });

            it("should take a snapshot of an element that is too wide and too tall", async () => {
                await driver.get("http://localhost:8080/too-wide-too-tall");
                await snap("too-wide-too-tall.png", $("#too-wide-too-tall")).catch((err) => err);
            });

        });

        describe("re-configuration", () => {
            before(async () => {
                driver = snappit.start();
                await driver.get("http://localhost:8080/");
            });

            after(async () => {
                await snappit.stop();
            });

            it("should reject invalid thresholds", () => {
                const fn = () => {
                    snap.configure({ threshold: 1.01 });
                };
                expect(fn).to.throw('Configuration error: Please set a "threshold" between 0 and 0.99');
            });

            it("should not trigger a baseline threshold error when setting the threshold very high", async () => {
                snap.configure({ threshold: 0.99 });
                $("#toggle-button").click();
                const error = await snap("different-below-threshold.png", $("#color-div")).catch((err) => err);
                expect(error).to.equal(undefined);
            });

            it("should trigger a baseline threshold error when setting the threshold very low", async () => {
                snap.configure({ threshold: 0.001 });
                $("#border-button").click();
                const error = await snap("different-below-threshold.png", $("#color-div")).catch((err) => err);
                expect(error).to.be.instanceOf(ScreenshotMismatchException);
            });

            it("should not throw an error but still save if the screenshot does not exist", async () => {
                snap.configure({ logException: [ScreenshotExceptionName.NO_BASELINE] });
                await snap("throw-no-baseline-false.png", $("#color-div"));
            });

            it("should not throw an error but still save if the screenshot is a different size", async () => {
                snap.configure({ logException: [ScreenshotExceptionName.SIZE_DIFFERENCE] });
                await snap("throw-size-difference-false.png").catch((err) => err);
                await snap("throw-size-difference-false.png", $("#color-div"));
            });

            it("should not throw an error but still save if the screenshot does not match", async () => {
                snap.configure({ logException: [ScreenshotExceptionName.MISMATCH] });
                await snap("throw-no-mismatch-false.png", $("#color-div")).catch((err) => err);
                $("#border-button").click();
                await snap("throw-no-mismatch-false.png", $("#color-div"));
            });

            it("should take a screenshot with directory and path tokens", async () => {
                // tslint:disable-next-line:no-console
                const size = await driver.manage().window().getSize();
                const capabilities = await driver.getCapabilities();
                const version = (capabilities.get("version") || capabilities.get("browserVersion"))
                    .replace(/\W+/gi, "-");
                const tokenPath = `${config.browser}/${version}/${size.width}x${size.height}/test.png`;

                // This will error because the screenshot does not already exist, but we only care if it's created.
                await snap("{browserName}/{browserVersion}/{browserSize}/test.png").catch((err) => err);
                await snap(tokenPath);
            });
        });
    });
}

// tslint:disable-next-line:no-namespace
namespace browserTest {
    export function only(
        suiteName: string,
        config: IConfig,
    ) {
        return browserTest(suiteName, config, describe.only);
    }

    export function skip(
        suiteName: string,
        config: IConfig,
    ) {
        return browserTest(suiteName, config, describe.skip);
    }
}

describe("Snappit", () => {
    browserTest("Chrome", {
        browser: "chrome",
    });

    browserTest("GeckoDriver FireFox", {
        browser: "firefox",
    });

    browserTest("Chrome Headless", {
        browser: "chrome",
        headless: true,
    });

    browserTest("GeckoDriver FireFox Headless", {
        browser: "firefox",
        headless: true,
    });
});
