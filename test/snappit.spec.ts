import * as childProcess from 'child_process';

import * as _ from 'lodash';
import {By, WebDriver, ThenableWebDriver} from 'selenium-webdriver';

import {Config, IConfig} from '../src/config';
import {$, Snappit} from '../src/snappit';
const expect = require('chai').expect;

const WEBDRIVER_PATH = './node_modules/.bin/webdriver-manager';

interface ISkippable {
    (name:string, options: IConfig, driver?: ThenableWebDriver, skip?: boolean): void;
    skip(name:string, options: IConfig, driver?: ThenableWebDriver, skip?: boolean): void;
}

let browserTest = <ISkippable> function (name:string, options: IConfig, driver?: ThenableWebDriver, skip?: boolean): void {
    let suiteFn = skip ? describe.skip: describe;

    suiteFn(name, function () {
        let snappit: Snappit;
        this.timeout(5000);
        this.slow(2500);

        before(() => {
            snappit = new Snappit(options, driver);
        });

        if(!driver) {
            it('should create a driver instance', async () => {
                // Snappit will throw if there is a problem in driver creation.
                driver = snappit.start();
                await driver;
            });
        }

        it('should navigate to the localhost page', async () => {
            // Cast here as TypeScript thinks driver might not be initialized.
            (<ThenableWebDriver> driver).get('http://localhost:8080/');

            expect(await $('#color-div').isDisplayed()).to.equal(true);
        });

        it('should terminate the driver instances', async () => {
            await snappit.stop();
        });
    });
};

browserTest.skip = function (name:string, options: IConfig, driver?: ThenableWebDriver): void {
    browserTest(name, options, driver, true);
}

describe('Snappit', () => {

    describe('with useDirect set', () => {

        browserTest('Chrome', {
            browser: 'chrome',
            useDirect: true
        });

        browserTest.skip('Legacy FireFox', {
            browser: 'firefox',
            useGeckoDriver: false,
            useDirect: true
        });

        browserTest('GeckoDriver FireFox', {
            browser: 'firefox',
            useGeckoDriver: true,
            useDirect: true
        });

    });

    // Using the default server URL
    describe('when using a remote server', () => {

        browserTest('Chrome', {
            browser: 'chrome',
            useDirect: false,
            serverUrl: 'http://localhost:4444/wd/hub'
        });

        browserTest.skip('Legacy FireFox', {
            browser: 'firefox',
            useGeckoDriver: false,
            useDirect: false,
            serverUrl: 'http://localhost:4444/wd/hub'
        });

        browserTest('GeckoDriver FireFox', {
            browser: 'firefox',
            useGeckoDriver: true,
            useDirect: false,
            serverUrl: 'http://localhost:4444/wd/hub'
        });

    });

    describe('when using an existing driver', () => {

    });
})