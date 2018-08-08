
import { WebElement } from "selenium-webdriver";

// Provides an array whose member types are deterministic at compile time.
class StringArray<T extends string> extends Array<T> {}

const RECT_KEYS = new StringArray("bottom", "height", "left", "right", "top", "width");

export class Rect {
    public bottom = 0;
    public height = 0;
    public left = 0;
    public right = 0;
    public top = 0;
    public width = 0;

    /**
     * Duplicate the Rect to a new object.
     */
    public duplicate() {
        const newRect = new Rect();

        // Copy the previous rect.
        for (const key of RECT_KEYS) {
            newRect[key] = this[key];
        }
        return newRect;
    }

    /**
     * Retrieve the Rect corresponding to the element's bounding box accounting for pixelRatio.
     * This method uses `getBoundingClientRect` but will round away subpixel values to the nearest pixel.
     * @param element The `WebElement` to fetch the Rect for.
     */
    public async forElement(element: WebElement) {
        const newRect = new Rect();

        const clientRect = await element.getDriver().executeScript(
            () => (arguments[0] as Element).getBoundingClientRect(),
            element,
        ) as ClientRect;

        // Copy relevent fields and transform to whole pixels.
        for (const key of RECT_KEYS) {
            newRect[key] = Math.round(clientRect[key]);
        }

        // Set the pixelRatio.
        const pixelRatio = await element.getDriver().executeScript(
            () => window.devicePixelRatio,
        ) as number;

        return newRect.withPixelRatio(pixelRatio);
    }

    /**
     * Retrieve the Rect corresponding to the viewport element's content. This is obtained by looking at the scroll
     * width and height of the viewport element and its scroll offsets, then mapping to the rect obtained via the
     * `forViewportElement` call.
     * @param element The `WebElement` to fetch the content Rect for.
     */
    public async forElementContent(element: WebElement) {
        const newRect = await this.forViewportElement(element);

        const scrollRect = await element.getDriver().executeScript(
            () => {
                const parent = arguments[0] as Element;
                return {
                    height: Math.round(parent.scrollHeight),
                    width: Math.round(parent.scrollWidth),
                };
            },
            element,
        ) as ClientRect;

        newRect.height = scrollRect.height;
        newRect.width = scrollRect.width;
        newRect.bottom = newRect.top + scrollRect.height;
        newRect.right = newRect.left + scrollRect.width;

        // Set the pixelRatio.
        const pixelRatio = await element.getDriver().executeScript(
            () => window.devicePixelRatio,
        ) as number;

        return newRect.withPixelRatio(pixelRatio);
    }

    /**
     * Retrieve the Rect corresponding to the viewport element's bounding box accounting for pixelRatio.
     * The viewport bounding box is defined as the bounding box of the area through which the element's content is
     * visible. This is found calculating the .
     * This method uses * `getBoundingClientRect` but will round away subpixel values to the nearest pixel.
     * @param element The `WebElement` to fetch the viewport Rect for.
     */
    public async forViewportElement(element: WebElement) {
        const newRect = new Rect();

        const clientRect = await element.getDriver().executeScript(
            () => {
                const docElement = document.documentElement || document.getElementsByTagName("html")[0];
                const parent = arguments[0] as Element;
                const rect = parent.getBoundingClientRect();

                // Create fake rect.  If we're the docElement we don't want to use the bounding box offsets.
                if (parent === docElement) {
                    return {
                        bottom: parent.clientHeight,
                        height: parent.clientHeight,
                        left: 0,
                        right: parent.clientWidth,
                        top: 0,
                        width: parent.clientWidth,
                    };
                } else {
                    return {
                        bottom: rect.top + parent.clientTop + parent.clientHeight,
                        height: parent.clientHeight,
                        left: rect.left + parent.clientLeft,
                        right: rect.left + parent.clientLeft + parent.clientWidth,
                        top: rect.top + parent.clientTop,
                        width: parent.clientWidth,
                    };
                }
                return rect;
            },
            element,
        ) as ClientRect;

        // Copy relevent fields and transform to whole pixels.
        for (const key of RECT_KEYS) {
            newRect[key] = Math.round(clientRect[key]);
        }

        // Set the pixelRatio.
        const pixelRatio = await element.getDriver().executeScript(
            () => window.devicePixelRatio,
        ) as number;

        return newRect.withPixelRatio(pixelRatio);
    }

    /**
     * Set the device pixel ratio for multiplying pixel values.
     * @param pixelRatio The device's pixel ratio
     */
    public relativeTo({left, top}: Rect) {
        const newRect = new Rect();

        // Copy the previous rect.
        for (const key of RECT_KEYS) {
            newRect[key] = this[key];
        }

        // Transform position to relative pixels by the reference point (left, top).
        newRect.left -= left;
        newRect.right = newRect.left + newRect.width;
        newRect.top -= top;
        newRect.bottom = newRect.top + newRect.height;

        return newRect;
    }

    /**
     * Set the device pixel ratio for multiplying pixel values.
     * @param pixelRatio The device's pixel ratio
     */
    public withPixelRatio(pixelRatio: number) {
        const newRect = new Rect();

        // Transform to whole pixels.
        for (const key of RECT_KEYS) {
            newRect[key] = Math.round(this[key]) * pixelRatio;
        }

        return newRect;
    }
}
