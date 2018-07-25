import * as _ from "lodash";
import { PNG } from "pngjs";
import {
    ILocation,
    ISize,
    WebDriver,
    WebElement,
} from "selenium-webdriver";

const SVR_ID = "added-by-snappit-visual-regression";

interface IScrollbarOffsets {
    horizontal: number;
    vertical: number;
}

// TSLint doesn't understand the new 2.8 mapped type modifiers
/* tslint:disable */
type MutableClientRect = {
    -readonly [P in keyof ClientRect]: ClientRect[P];
}
/* tslint:enable */

class ElementScreenshot {
    private driver: WebDriver;
    private element: WebElement;
    private devicePixelRatio: number;

    constructor(
        element: WebElement,
    ) {
        this.driver = element.getDriver();
        this.element = element;
    }

    public async prepare() {
        this.devicePixelRatio = await this.getDevicePixelRatio();
        return this;
    }

    public async take() {
        // Drop scrollbars
        await this.dropScrollbars();

        // Position the element on screen, this is guaranteed to get the top-left corner of the element on screen.
        await this.scrollToLocation(0, 0);
        const initialRect = await this.getBoundingClientRect();
        await this.scrollToLocation(initialRect.left, initialRect.top);

        // Create base screenshot.
        const elementScreenshot = new PNG(initialRect);

        const cursor: ILocation = {
            x: 0,
            y: 0,
        };

        // Find out which sides we have scrollbars on and get offsets for those bars.
        const scrollbarOffsets = await this.getScrollbarOffsets();

        // Until we've filled up the entire elementScreenshot
        while (cursor.y < initialRect.height) {
            while (cursor.x < initialRect.width) {

                // Take a new screenshot at the current location
                const screenshot = await this.screenshot();
                const rect = await this.getBoundingClientRect();

                /**
                 *  Given the offset information in rect, determine the intersection with the current screenshot.
                 *    rect.left/.top represent the left and top coordinates relative to the viewport.  If they are
                 *    negative then the element's origin is above or to the left of the current screenshot, so we need
                 *    to start from zero.
                 *
                 *    width/height are either going to be the total width of the screenshot, adjusting for scrollbars
                 *    or the difference between the offset above and the rect.right/.bottom coordinate of the element.
                 */
                const sourceX = rect.left > 0 ? rect.left : 0;
                const sourceY = rect.top > 0 ? rect.top : 0;
                const width = Math.min(rect.right - sourceX, screenshot.width - scrollbarOffsets.horizontal);
                const height = Math.min(rect.bottom - sourceY, screenshot.height - scrollbarOffsets.vertical);

                // If we would overwrite width/height by too much, adjust the cursor.
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
                this.scrollToLocation(initialRect.left + cursor.x, initialRect.top + cursor.y);
            }
            this.scrollToLocation(initialRect.left + cursor.x, initialRect.top + cursor.y);
        }

        // Restore scrollbars
        await this.removeDropScrollbars();

        return elementScreenshot;
    }

    private getDevicePixelRatio = () =>
        this.driver.executeScript(() => window.devicePixelRatio) as Promise<number>

    private dropScrollbars = () =>
        this.driver.executeScript(
            () => {
                const head = document.querySelector("head");
                const style = document.createElement("style");
                style.id = arguments[0];
                style.type = "text/css";
                style.innerText = "::-webkit-scrollbar { display: none; }";
                head.appendChild(style);
            },
            SVR_ID,
        ).catch((err: Error): void => {
            err.message = "Error attempting to drop scrollbars before screenshot: " + err.message;
            throw err;
        }) as Promise<void>

    /**
     * Retrieve the element's bounding box accounting for devicePixelRatio.  Note that this may result
     * in partial pixels.  After inspecting the screenshots, using the floor should most closely replicate
     * previous behavior, resulting in less breaking changes.
     */
    private getBoundingClientRect = async () => {
        const rect = await this.driver.executeScript(
            () => (arguments[0] as Element).getBoundingClientRect(),
            this.element,
        ) as ClientRect;

        // Transform to integers.
        const floor: MutableClientRect = rect;
        for (const key of Object.keys(rect) as Array<keyof ClientRect>) {
            floor[key] = Math.floor(rect[key]) * this.devicePixelRatio;
        }
        return floor;
    }

    private getScrollbarOffsets = () =>
        this.driver.executeScript(
            () => {
                const docElement = document.documentElement || document.getElementsByTagName("html")[0];
                return {
                    horizontal: docElement.scrollWidth > docElement.scrollHeight ? 15 * arguments[0] : 0,
                    vertical: docElement.scrollHeight > docElement.clientHeight ? 15 * arguments[0] : 0,
                };
            },
            this.devicePixelRatio,
        ) as Promise<IScrollbarOffsets>

    private removeDropScrollbars = () =>
        this.driver.executeScript(
            () => document.getElementById(arguments[0]).remove(),
            SVR_ID,
        ).catch((err: Error): void => {
            err.message = "Error replacing scrollbars after screenshot: " + err.message;
            throw err;
        }) as Promise<void>

    /**
     * Scroll to the specified location on screen accounting for devicePixelRatio.
     */
    private scrollToLocation = (left: number, top: number) =>
        this.driver.executeScript(
            () => window.scrollTo(arguments[0], arguments[1]),
            left / this.devicePixelRatio,
            top / this.devicePixelRatio,
        ) as Promise<void>

    private async screenshot() {
        return PNG.sync.read(new Buffer(await this.driver.takeScreenshot(), "base64"));
    }
}

export default async function(element: WebElement) {
    return (await new ElementScreenshot(element).prepare()).take();
}
