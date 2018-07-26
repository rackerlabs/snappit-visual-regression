import * as _ from "lodash";
import { PNG } from "pngjs";
import {
    ILocation,
    WebDriver,
    WebElement,
} from "selenium-webdriver";

const SVR_ID = "added-by-snappit-visual-regression";

/** Provides a consistent Rect object to wrap other rects */
class Rect {
    public bottom: number = 0;
    public height: number = 0;
    public left: number = 0;
    public right: number = 0;
    public top: number = 0;
    public width: number = 0;

    constructor(rect: Rect, devicePixelRatio: number = 0, relativeTo?: Rect) {
        for (const key of Object.keys(this) as Array<keyof ClientRect>) {
            this[key] = Math.round(rect[key]) * devicePixelRatio;
        }

        if (relativeTo) {
            this.bottom -= relativeTo.bottom;
            this.left -= relativeTo.left;
            this.right -= relativeTo.right;
            this.top -= relativeTo.top;
        }
    }
}

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
        this.devicePixelRatio = await this.prepareDevicePixelRatio();
        return this;
    }

    public async take() {
        // Drop scrollbars
        await this.dropScrollbars();

        // Get viewport
        const {viewport, viewportRect} = await this.prepareViewport();

        /* Position the element in the viewport by scrolling to the top left of the viewport, then attempting to
         * scroll the viewport to the relative top left of the element.  Since scrolling is based on the viewport
         * element, we'll adjust the initial position to be relative to the viewport.
         */
        await this.scrollToLocation(viewport, 0, 0);
        const initialRect = await this.getBoundingClientRect(viewportRect);
        await this.scrollToLocation(
            viewport,
            initialRect.left,
            initialRect.top,
        );

        // Create base screenshot.
        const elementScreenshot = new PNG(new Rect(initialRect, this.devicePixelRatio));

        const cursor: ILocation = {
            x: 0,
            y: 0,
        };

        /* tslint:disable */
        console.log({
            initialRect,
            viewportRect: viewportRect,
        });
        /* tslint:enable */

        // Until we've filled up the entire elementScreenshot
        while (cursor.y < initialRect.height) {
            while (cursor.x < initialRect.width) {

                // Take a new screenshot at the current location
                const screenshot = await this.screenshot();
                const rect = await this.getBoundingClientRect();

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
                /* tslint:disable */
                console.log({
                    rect,
                    bitblt: {
                        sourceX,
                        sourceY,
                        width,
                        height,
                        x: cursor.x,
                        y: cursor.y,
                    },
                });
                /* tslint:enable */

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
     * Drops scrollbars in webkit browsers
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
                    *{overflow: -moz-scrollbars-none !important;}
                `;
                head.appendChild(style);
            },
            SVR_ID,
        ).catch((err: Error): void => {
            err.message = "Error attempting to drop scrollbars before screenshot: " + err.message;
            throw err;
        }) as Promise<void>

    /**
     * Retrieve the element's bounding box accounting for devicePixelRatio.
     * Note that `Element.getBoundingClientRect` can return subpixels, so we need to round here.
     * If you pass a `Rect` in as `relativeTo`, the element's position will be adjusted to be relative.
     */
    private getBoundingClientRect = async (relativeTo?: Rect) => {
        const rect = await this.driver.executeScript(
            () => (arguments[0] as Element).getBoundingClientRect(),
            this.element,
        ) as ClientRect;

        // Transform to integers.
        return new Rect(rect, this.devicePixelRatio, relativeTo);
    }

    private prepareDevicePixelRatio = () =>
        this.driver.executeScript(() => window.devicePixelRatio) as Promise<number>

    /**
     * Retrieve the element's viewport and viewport bounding box accounting for devicePixelRatio.
     * Note that `Element.getBoundingClientRect` can return subpixels, so we need to round here.
     */
    private prepareViewport = async () => {
        const viewport = await (this.driver.executeScript(
            () => {
                const docElement = document.documentElement || document.getElementsByTagName("html")[0];

                let parent = (arguments[0] as Element).parentElement;
                while (
                    (window.getComputedStyle(parent).overflowX !== "scroll" &&
                    window.getComputedStyle(parent).overflowY !== "scroll") ||
                    parent.scrollHeight === parent.clientHeight &&
                    parent.scrollWidth === parent.clientWidth
                ) {
                    parent = parent.parentElement;
                    if (parent === docElement) {
                        break;
                    }
                }
                return parent;
            },
            this.element,
        ) as Promise<WebElement>);

        const rect = await this.driver.executeScript(
            () => {
                const docElement = document.documentElement || document.getElementsByTagName("html")[0];
                const element = arguments[0] as Element;

                // Compute the bounding box using a fake element;
                if (element !== docElement) {
                    const child = document.createElement("div");
                    child.style.setProperty("margin", "0px", "important");
                    child.style.setProperty("border", "0px", "important");
                    child.style.setProperty("position", "absolute", "important");
                    child.style.setProperty("width", `${element.clientWidth}px`, "important");
                    child.style.setProperty("height", `${element.clientHeight}px`, "important");
                    element.insertBefore(child, element.firstChild);
                    const childRect = (child as Element).getBoundingClientRect();
                    child.remove();
                    return childRect;
                }
                return (element as Element).getBoundingClientRect();
            },
            viewport,
        ) as ClientRect;

        // Transform to integers.
        const adjustedRect = new Rect(rect, this.devicePixelRatio);

        return {viewport, viewportRect: adjustedRect};
    }

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
                (arguments[0] as Element).scrollTo(arguments[1], arguments[2]);
            },
            viewport,
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
