import * as fs from "fs-extra"

import {
    By, error as WebDriverError, ILocation, ISize, ThenableWebDriver,
    WebDriver, WebElement, WebElementPromise,
} from "selenium-webdriver";

const fnDomToImage = `
    var callback = arguments[arguments.length - 1];
    var element = arguments[0];

    // Flatten Shadow Dom if present
    if (element.shadowRoot) {
        var slots = element.shadowRoot.querySelectorAll('slot');

        // Replace each slot with its assigned nodes
        // NOTE: We might need to do this recursively
        for (var slot of slots) {
            var parent = slot.parentElement;

            for (var node of slot.assignedNodes()) {
                parent.appendChild(node);
            };

            parent.removeChild(slot);
        }

        // Add an invisible parent node with no styling
        var randomId = Math.random().toString(16).slice(2);
        var unstyled = document.createElement('unstyled-' + randomId);
        for (var node of element.shadowRoot.childNodes()) {
            unstyled.appendChild(node);
        }
        element.shadowRoot.appendChild(unstyled);

        element = unstyled;
    }

    domtoimage.toPng(element).then(callback);
`;

/**
 * Generate a screenshot via chrome canvas.
 * This is a workaround to screenshotting an element in chrome because chromedriver does not
 * implement WebElement.takeScreenshot
 */
export async function chromeCanvasScreenshot(
    driver: ThenableWebDriver,
    element: WebElementPromise,
): Promise<Buffer> {
    await driver.manage().timeouts().setScriptTimeout(5000);
    await driver.executeScript(fs.readFileSync(require.resolve("dom-to-image")).toString());
    const pngString = await driver.executeAsyncScript(fnDomToImage, element) as string;
    return new Buffer(pngString.slice("data:image/png;base64,".length), "base64");
}