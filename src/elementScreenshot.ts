import { PNG } from "pngjs";
import {
    ILocation,
    WebDriver,
    WebElement,
} from "selenium-webdriver";
import { Rect } from "./rect";
import { $ } from "./snappit";

const SVR_ID = "added-by-snappit-visual-regression";

/**
 * Class for an Element Screenshot.
 */
class ElementScreenshot {
    private driver: WebDriver;

    /**
     * Creates a new `ElementScreenshot` object.
     * @param element `WebElement` to screenshot, or whose contents to screenshot (see below).
     * @param elementContent `boolean` indicating whether or not screenshot the element's contents instead,
     *   only valid for scrolling elements.
     */
    constructor(
        private element: WebElement,
        private elementContent: boolean = false,
    ) {
        this.driver = element.getDriver();
    }
    /**
     * Takes the element screenshot.
     *
     * If `this.elementContent` is set to true, the element will be used as a viewport and the elements contents
     * will be screenshotted instead.
     */
    public async take() {
        // Drop scrollbars
        await this.dropScrollbars();

        // Get viewport
        const viewport = this.elementContent
            ? this.element
            : await this.getViewportElement();

        const viewportRect = await new Rect().forViewportElement(viewport);

        /* Position the element in the viewport by scrolling to the top left of the viewport, then attempting to
         * scroll the viewport to the relative top left of the element.  Since scrolling is based on the viewport
         * element, we'll adjust the initial position to be relative to the viewport.
         */
        await this.scrollToLocation(viewport, 0, 0);
        const initialRect = this.elementContent
            ? (await new Rect().forElementContent(this.element)).relativeTo(viewportRect)
            : (await new Rect().forElement(this.element)).relativeTo(viewportRect);

        await this.scrollToLocation(
            viewport,
            initialRect.left,
            initialRect.top,
        );

        // Create base screenshot.
        const elementScreenshot = new PNG(initialRect.duplicate());

        const cursor: ILocation = {
            x: 0,
            y: 0,
        };

        // Until we've filled up the entire elementScreenshot
        while (cursor.y < initialRect.height) {
            while (cursor.x < initialRect.width) {

                // Take a new screenshot at the current location
                const screenshot = await this.screenshot();
                const rect = this.elementContent
                    ? (await new Rect().forElementContent(this.element))
                    : await new Rect().forElement(this.element);

                /**
                 * Given the offset information in rect, determine the intersection with the current viewport's
                 * position on the screen.
                 *
                 * The formula for the intersection of two rectangles is the max of the left and top offsets,
                 * and the min of the right and bottom offsets.
                 *
                 * To find the width and the height, we have to subtract top from bottom, left from right.
                 */
                const sourceX = Math.max(rect.left, viewportRect.left);
                const sourceY = Math.max(rect.top, viewportRect.top);
                const width = Math.min(rect.right, viewportRect.right) - sourceX;
                const height = Math.min(rect.bottom, viewportRect.bottom) - sourceY;

                /**
                 * If we would overwrite width/height by too much, adjust the cursor.  This is slightly less
                 * efficient but conceptually simpler than adjusting the source and width.
                 */
                if (width + cursor.x > initialRect.width) {
                    cursor.x = initialRect.width - width;
                }

                if (height + cursor.y > initialRect.height) {
                    cursor.y = initialRect.height - height;
                }

                PNG.bitblt(
                    screenshot,
                    elementScreenshot,
                    sourceX,
                    sourceY,
                    width,
                    height,
                    cursor.x,
                    cursor.y,
                );

                cursor.x += width;

                if (cursor.x >= initialRect.width) {
                    cursor.x = 0;
                    cursor.y += height;
                    break;
                }

                this.scrollToLocation(viewport, initialRect.left + cursor.x, initialRect.top + cursor.y);
            }
            this.scrollToLocation(viewport, initialRect.left + cursor.x, initialRect.top + cursor.y);
        }

        // Restore scrollbars
        await this.removeDropScrollbars();

        return elementScreenshot;
    }

    /**
     * Drops scrollbars in all modern browsers.
     */
    private dropScrollbars = () =>
        this.driver.executeScript(
            () => {
                const head = document.querySelector("head");
                const style = document.createElement("style");
                style.id = arguments[0];
                style.type = "text/css";
                style.innerText = `
                    *::-webkit-scrollbar { display: none !important; }
                    :not(body){overflow: -moz-scrollbars-none !important;}
                `;
                head.appendChild(style);
            },
            SVR_ID,
        ).catch((err: Error): void => {
            err.message = "Error attempting to drop scrollbars before screenshot: " + err.message;
            throw err;
        }) as Promise<void>

    /**
     * Retrieve the element's viewport element.  If there is no parent return the doc element.
     * This attempts to handle fixed or absolute positioned elements by falling back to the
     * doc element as parent.
     */
    private getViewportElement = async () =>
        this.driver.executeScript(
        () => {
            const isScrollable = (elem: HTMLElement) =>
                elem.scrollHeight !== elem.clientHeight ||
                elem.scrollWidth !== elem.clientWidth;

            const isAbsolute = (elem: HTMLElement) =>
                ["absolute", "fixed"].indexOf(window.getComputedStyle(elem).position) !== -1;

            const docElement = document.documentElement || document.getElementsByTagName("html")[0];
            const element = arguments[0] as HTMLElement;
            let parent = element.parentElement;

            if (!parent || isAbsolute(element)) {
                return docElement;
            }

            while (parent !== docElement && !isScrollable(parent)) {
                if (isAbsolute(parent)) {
                    return docElement;
                }
                parent = parent.parentElement;
            }

            /**
             * If the parent is the body element, we need to dodge it.
             */
            const bodyElement = document.getElementsByTagName("body")[0];
            return parent === bodyElement ? docElement : parent;
        },
        this.element,
    ) as Promise<WebElement>

    /**
     * Undo the drop scrollbars style.
     */
    private removeDropScrollbars = () =>
        this.driver.executeScript(
            () => document.getElementById(arguments[0]).remove(),
            SVR_ID,
        ).catch((err: Error): void => {
            err.message = "Error replacing scrollbars after screenshot: " + err.message;
            throw err;
        }) as Promise<void>

    /**
     * Scroll to the specified location on screen accounting for devicePixelRatio.  This method assumes viewport
     * coordinates, so you will need to adjust your inputs appropriately.
     */
    private scrollToLocation = (viewport: WebElement, left: number, top: number) =>
        this.driver.executeScript(
            () => {
                const pixelRatio = window.devicePixelRatio;
                const x = arguments[1] / pixelRatio;
                const y = arguments[2] / pixelRatio;
                const element = (arguments[0] as Element);

                element.scrollTo(x, y);
            },
            viewport,
            left,
            top,
        ) as Promise<void>

    private async screenshot() {
        return PNG.sync.read(new Buffer(await this.driver.takeScreenshot(), "base64"));
    }
}

export default async function(element: WebElement, elementContent: boolean) {
    /**
     * We want to use the documentElement, a.k.a. html tag, instead of the body tag if that is passed.  The
     * body tag does not properly handle scrolling, and is essentially the same for the purposes of computing
     * the area to screenshot.
     */
    if ((await element.getTagName()).toLowerCase() === "body") {
        element = $("html");
    }
    return new ElementScreenshot(element, elementContent).take();
}
