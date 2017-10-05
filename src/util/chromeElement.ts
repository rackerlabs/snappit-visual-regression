import * as fs from "fs-extra"

import {
    By, error as WebDriverError, ILocation, ISize, ThenableWebDriver,
    WebDriver, WebElement, WebElementPromise,
} from "selenium-webdriver";

const fnDomToImage = `
    var callback = arguments[arguments.length - 1];
    var element = arguments[0];

    function walkNodeTree(node, target) {
        if (node.nodeName === 'STYLE') {
            return;
        }

        if (node.nodeName === 'SLOT') {
            for (var slotted of node.assignedNodes()) {
                target.appendChild(slotted);
            };
            return;
        }

        var clone = node.cloneNode();
        // Inline CSS
        // clone.style.cssText = window.getComputedStyle(node).cssText;
        for (var child of node.children) {
            walkNodeTree(child, clone);
        }
        target.appendChild(clone);
    }

    // Walk the Shadow Dom, copying it into the light dom, recursively.
    if (element.shadowRoot) {

        for (var child of element.shadowRoot.children) {
            walkNodeTree(child, element);
        }
        while (element.shadowRoot.hasChildNodes()) {
            element.shadowRoot.firstChild.remove();
        }
        var slot = document.createElement('slot');
        element.shadowRoot.
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