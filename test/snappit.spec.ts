import {expect} from "chai";
import * as fs from "fs-extra";
import { PNG } from "pngjs";
import {By, WebDriver} from "selenium-webdriver";
import {IConfig} from "../src/config";

import {
    NoDriverSessionException,
    ScreenshotExceptionName,
    ScreenshotMismatchException,
    ScreenshotNoBaselineException,
    ScreenshotSizeDifferenceException,
} from "../src/errors";
import {$, snap, Snappit} from "../src/snappit";

type ISuiteFn = typeof describe | typeof describe.only | typeof describe.skip;

function browserTest(
    suiteName: string,
    config: IConfig,
    suiteFn: ISuiteFn = describe,
): void {

    suiteFn(suiteName, function() {
        let driver: WebDriver;
        let snappit: Snappit;

        async function compareImageDimensions(baseline: string, current: string) {
            const ratio = (await driver.executeScript(() => window.devicePixelRatio)) as number;

            const originalPng = PNG.sync.read(fs.readFileSync(baseline));
            const savedPng = PNG.sync.read(fs.readFileSync(current));

            expect(originalPng.width * ratio).to.eql(savedPng.width);
            expect(originalPng.height * ratio).to.eql(savedPng.height);
        }

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
                driver = await snappit.start();
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

        describe("when setting initial viewport size", async () => {
            const width = 1200;
            const height = 900;

            before(async () => {
                config.initialViewportSize = [width, height];
                snappit = new Snappit(config);
                driver = await snappit.start();
                await driver.get("http://localhost:8080/");
            });

            after(async () => {
                await snappit.stop();
            });

            it("should set the viewport size to the desired width", async () => {
                expect((await driver.manage().window().getSize()).width).to.equal(width);
            });

            it("should set the viewport size to the desired height", async () => {
                expect((await driver.manage().window().getSize()).height).to.equal(height);
            });
        });

        describe("screenshots", () => {
            const suitePath = `./test/screenshots/${suiteName.split(" ").join("-")}`;

            before(async () => {
                config.logException = [ScreenshotExceptionName.NO_BASELINE];
                snappit = new Snappit(config);
                driver = await snappit.start();
                await driver.get("http://localhost:8080/");
            });

            after(async () => {
                await snappit.stop();
            });

            it("should throw an error if the screenshot does not exist", async () => {
                snap.configure({ logException: [] });
                const error = await snap("does-not-exist.png", $("#color-div")).catch((err) => err);
                snap.configure({ logException: [ScreenshotExceptionName.NO_BASELINE] });
                expect(error).to.be.an.instanceof(ScreenshotNoBaselineException);
            });

            it("should throw an error if the screenshot is a different size", async () => {
                await snap("different-size.png", $("body"));
                const error = await snap("different-size.png", $("#color-div")).catch((err) => err);
                expect(error).to.be.an.instanceof(ScreenshotSizeDifferenceException);
            });

            it("should throw an error if the screenshot is different above threshold", async () => {
                await snap("different-above-threshold.png", $("#color-div"));
                $("#toggle-button").click();
                const error = await snap("different-above-threshold.png", $("#color-div")).catch((err) => err);
                expect(error).to.be.an.instanceof(ScreenshotMismatchException);
            });

            it("should not throw an error if the screenshot is different below threshold", async () => {
                await snap("different-below-threshold.png", $("#color-div"));
                $("#border-button").click();
                await snap("different-below-threshold.png", $("#color-div"));
            });

            it("should not throw an error if the screenshot shows no difference", async () => {
                await snap("no-difference.png", $("#color-div"));
                await snap("no-difference.png", $("#color-div"));
            });
        });

        describe("scrolling elements", () => {
            const suitePath = `./test/screenshots/${suiteName.split(" ").join("-")}`;

            before(async () => {
                config.logException = [ScreenshotExceptionName.NO_BASELINE];
                snappit = new Snappit(config);
                driver = await snappit.start();
            });

            after(async () => {
                await snappit.stop();
            });

            it("should take a snapshot of an element that is too wide", async () => {
                await driver.get("http://localhost:8080/too-wide");
                const imageName = "too-wide.png";
                const baseline = `./test/public/img/${imageName}`;
                const current = `${suitePath}/${imageName}`;

                await snap(imageName, $("#too-wide"));
                await compareImageDimensions(baseline, current);
            });

            it("should take a snapshot of an element that is too tall", async () => {
                await driver.get("http://localhost:8080/too-tall");
                const imageName = "too-tall.png";
                const baseline = `./test/public/img/${imageName}`;
                const current = `${suitePath}/${imageName}`;

                await snap(imageName, $("#too-tall"));
                await compareImageDimensions(baseline, current);
            });

            it("should take a snapshot of an element that is too wide and too tall", async () => {
                await driver.get("http://localhost:8080/too-wide-too-tall");
                const imageName = "too-wide-too-tall.png";
                const baseline = `./test/public/img/${imageName}`;
                const current = `${suitePath}/${imageName}`;

                await snap(imageName, $("#too-wide-too-tall"));
                await compareImageDimensions(baseline, current);
            });

        });

        describe("internal scrolling elements", () => {
            const suitePath = `./test/screenshots/${suiteName.split(" ").join("-")}`;

            before(async () => {
                config.logException = [ScreenshotExceptionName.NO_BASELINE];
                snappit = new Snappit(config);
                driver = await snappit.start();
                await driver.get("http://localhost:8080/internal-scroll.html");
            });

            after(async () => {
                await snappit.stop();
            });

            it("should take a screenshot of an element inside a scrolling div", async () => {
                const imageName = "internal-scroll.png";
                const baseline = `./test/public/img/test.png`;
                const current = `${suitePath}/${imageName}`;

                await snap(imageName, $("#scroll"));
                await compareImageDimensions(baseline, current);
            });

            it("should take a screenshot of an element inside a scrolling div with padding", async () => {
                const imageName = "internal-scroll-padding.png";
                const baseline = `./test/public/img/test.png`;
                const current = `${suitePath}/${imageName}`;

                await snap(imageName, $("#scroll-padding"));
                await compareImageDimensions(baseline, current);
            });

            it("should take a screenshot of the content inside a scrolling div", async () => {
                const imageName = "internal-scroll-content.png";
                const baseline = `./test/public/img/test.png`;
                const current = `${suitePath}/${imageName}`;

                await snap(imageName, $("#scroll-content"), {elementContent: true});
                await compareImageDimensions(baseline, current);
            });
        });

        describe("blacking out elements", () => {
            let previousHtml: string;
            let previousHead: string;
            const getOuterHtml = "return arguments[0].outerHTML";

            before(async () => {
                config.logException = [ScreenshotExceptionName.NO_BASELINE];
                snappit = new Snappit(config);
                driver = await snappit.start();
                await driver.get("http://localhost:8080/blackout-elements");
                previousHtml = await driver.executeScript(getOuterHtml, $("#blackout")) as string;
                previousHead = await driver.executeScript(getOuterHtml, $("head")) as string;
            });

            after(async () => {
                await snappit.stop();
            });

            it("should black out one element", async () => {
                await snap("blackout-one", $("#blackout"), { hide: [ $("#hide0") ] });
            });

            it("should reset the styles and the html when removing blackout styles", async () => {
                const currentHtml = await driver.executeScript(getOuterHtml, $("#blackout")) as string;
                const currentHead = await driver.executeScript(getOuterHtml, $("head")) as string;
                expect(currentHtml).to.eql(previousHtml);
                expect(currentHead).to.eql(previousHead);
            });

            it("should black out multiple elements", async () => {
                await snap("blackout-many", $("#blackout"), {
                    hide: await driver.findElements(By.css("img[id^='hide']")),
                });
            });

            it("should reset the styles and the html when removing blackout styles on multiple elements", async () => {
                const currentHtml = await driver.executeScript(getOuterHtml, $("#blackout")) as string;
                const currentHead = await driver.executeScript(getOuterHtml, $("head")) as string;
                expect(currentHtml).to.eql(previousHtml);
                expect(currentHead).to.eql(previousHead);
            });

        });

        describe("re-configuration", () => {
            before(async () => {
                driver = await snappit.start();
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
