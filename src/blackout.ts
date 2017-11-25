/**
 * NOTE: All of this uses strings for javascript functions (as opposed to using functions directly)
 * to avoid the annoying "no such variable 'document'", and so on. Figure out how to not do this.
 * DO NOT LET THIS PASS REVIEW UNTIL THIS HAS BEEN SORTED OUT.
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
  background-color: black !important;
}

.${BLACKOUT_TARGET_CLASS} {
  opacity: 0 !important;
}
`.split("\n").join(" ");

const SVR_ID = "blackout-styles-added-by-snappit-visual-regression";
const ADD_BLACKOUT_STYLE = `
var head = document.querySelector("head");
var style = document.createElement("style");
style.id = "${SVR_ID}";
style.type = "text/css";
style.innerText = "${BLACKOUT_CSS}";

head.appendChild(style);
`.split("\n").join(" ");

const REMOVE_BLACKOUT_STYLE = `document.querySelector("#${SVR_ID}").remove();`;

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
`.split("\n").join(" ");

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
`.split("\n").join(" ");

export async function hideElements(driver: WebDriver, elements: WebElement[]) {
    await driver.executeScript(ADD_BLACKOUT_STYLE);
    for (const element of elements) {
        // this needs to be handled!
        // DO NOT LET THIS PASS REVIEW UNTIL THIS HAS BEEN SORTED OUT.
        await driver.executeScript(ADD_BLACKOUT_BACKDROP, element);
    }
}

/**
 * If you leave `elements` empty, it'll remove any and all matching blackout elements it finds.
 */
export async function unhideElements(driver: WebDriver, elements?: WebElement[]) {
    await driver.executeScript(REMOVE_BLACKOUT_STYLE);
    if (elements === undefined) {
        elements = await driver.findElements(By.className(BLACKOUT_TARGET_CLASS));
    }

    for (const element of elements) {
        // this needs to be handled!
        // DO NOT LET THIS PASS REVIEW UNTIL THIS HAS BEEN SORTED OUT.
        await driver.executeScript(REMOVE_BLACKOUT_BACKDROP, element);
    }
}
