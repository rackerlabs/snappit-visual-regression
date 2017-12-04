/**
 * ABOUT: This is a couple of browser-based javascript functions that "blackout" dynamic elements. Why do that?
 * Well, when you have, say, a field on your page that correlates with the "age" of something, you'll find that
 * one day the age is "3 days ago", and next week will say "About a week ago". This will trigger a visual change,
 * even though nothing about the visual style changed -- it was just text that did. The solution is to force this
 * dynamic content to be "blacked out", reducing the amount of visual regressions that you see.
 *
 * Here's a breakdown of how this is accomplished.
 * 0. Create a stylesheet in the <head> that
 * 0. Contains some CSS that applys a "blackout backdrop" and a "blackout target", where
 * 0. The blackout "target" is an element that contains dynamic text or other information that
 *    will trigger invalid regressions unless said dynamic content is blacked out. And,
 * 0. The blackout "backdrop" is a wrapper div that is set to `background: black !important`, and
 * 0. Sets the opacity of the target element to 0, thereby revealing the all-black backdrop.
 * Finally, there's a couple more javascript functions that simply clean up the styles/classes/wrapper divs.
 *
 * NOTE: All of this uses strings for javascript functions (as opposed to using functions directly)
 * to avoid the annoying "no such variable 'document'", and so on. Javascript in the browser, in
 * this project, is considered an "external platform" and does not warrant including the "dom" library
 * in the project's tsconfig, as this is not a front-end project.
 *
 * In the future, if it's possible to include the "dom" lib in a single file, that would be acceptable.
 */
import {
    By,
    WebDriver,
    WebElement,
} from "selenium-webdriver";

const BLACKOUT_BACKDROP_CLASS = "blackout-backdrop-added-by-snappit-visual-regression";
const BLACKOUT_TARGET_CLASS = "blackout-target-added-by-snappit-visual-regression";
const BLACKOUT_CSS = `
.${BLACKOUT_BACKDROP_CLASS} {
  background: black !important;
}

.${BLACKOUT_TARGET_CLASS} {
  opacity: 0 !important;
}`;

const SVR_ID = "blackout-styles-added-by-snappit-visual-regression";
const ADD_BLACKOUT_STYLE = `
var head = document.querySelector("head");
var style = document.createElement("style");
style.id = "${SVR_ID}";
style.type = "text/css";
style.innerText = "${BLACKOUT_CSS.replace(/\n+/g, " ")}";

head.appendChild(style);
`;

const REMOVE_BLACKOUT_STYLE = `document.getElementById("${SVR_ID}").remove();`;

/**
 * `arguments[0]` is whatever gets passed to `driver.executeScript`.
 * In this case, it's the target element to be blacked out.
 */
const ADD_BLACKOUT_BACKDROP = `
arguments[0].classList.add("${BLACKOUT_TARGET_CLASS}");

var backdrop = document.createElement("div");
backdrop.classList.add("${BLACKOUT_BACKDROP_CLASS}");
arguments[0].parentElement.appendChild(backdrop);
backdrop.appendChild(arguments[0]);
`;

const REMOVE_BLACKOUT_BACKDROP = `
arguments[0].classList.remove("${BLACKOUT_TARGET_CLASS}");
/* https://stackoverflow.com/a/33401932/881224 */
var docFrag = document.createDocumentFragment();
var wrapper = arguments[0].parentNode;
while (wrapper.firstChild) {
    var child = wrapper.removeChild(wrapper.firstChild);
    docFrag.appendChild(child);
}

wrapper.parentNode.replaceChild(docFrag, wrapper);
`;

export async function hideElements(driver: WebDriver, elements: WebElement[]) {
    await driver.executeScript(ADD_BLACKOUT_STYLE).catch((err: Error) => {
        err.message = "Error adding blackout styles: " + err.message;
        throw err;
    });

    for (const element of elements) {
        await driver.executeScript(ADD_BLACKOUT_BACKDROP, element).catch((err: Error) => {
            err.message = "Error adding blackout backdrop: " + err.message;
            throw err;
        });
    }
}

/**
 * If you leave `elements` empty, it'll remove any and all matching blackout elements it finds.
 */
export async function unhideElements(driver: WebDriver, elements?: WebElement[]) {
    await driver.executeScript(REMOVE_BLACKOUT_STYLE).catch((err: Error) => {
        err.message = "Error removing blackout styles: " + err.message;
        throw err;
    });

    if (elements === undefined) {
        elements = await driver.findElements(By.className(BLACKOUT_TARGET_CLASS));
    }

    for (const element of elements) {
        await driver.executeScript(REMOVE_BLACKOUT_BACKDROP, element).catch((err: Error) => {
            err.message = "Error removing blackout backdrop: " + err.message;
            throw err;
        });
    }
}
