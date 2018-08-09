import { WebElement } from "selenium-webdriver";

// Provides an array whose member types are deterministic at compile time.
class StringArray<T extends string> extends Array<T> {}

// Types
interface IScrollRect {
    height: number;
    width: number;
}
interface IClientRect extends IScrollRect {
    left: number;
    top: number;
}
interface IRect extends IClientRect {
    bottom: number;
    right: number;
}

const RECT_KEYS = new StringArray("bottom", "height", "left", "right", "top", "width");

export class Rect implements IRect {
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
        const clientRect = await this.getBoundingRect(element);

        return (this.duplicate.apply(clientRect) as Rect).round();
    }

    /**
     * Retrieve the Rect corresponding to the viewport element's content. This is obtained by looking at the scroll
     * width and height of the viewport element and its scroll offsets, then mapping to the rect obtained via the
     * `forViewportElement` call.
     * @param element The `WebElement` to fetch the content Rect for.
     */
    public async forElementContent(element: WebElement) {
        const newRect = await this.forViewportElement(element);
        const scrollRect = await this.getScrollRect(element);

        newRect.bottom = newRect.top  + scrollRect.height;
        newRect.right  = newRect.left + scrollRect.width;
        newRect.height = scrollRect.height;
        newRect.width  = scrollRect.width;

        return newRect.round();
    }

    /**
     * Retrieve the Rect corresponding to the viewport element's bounding box accounting for pixelRatio.
     * The viewport bounding box is defined as the bounding box of the area through which the element's content is
     * visible. This is found calculating the .
     * @param element The `WebElement` to fetch the viewport Rect for.
     */
    public async forViewportElement(element: WebElement) {
        const newRect = new Rect();

        const {left, top, height, width} = await this.getClientRect(element);
        if (await this.isDocElement(element)) {
            newRect.left    = 0;
            newRect.top     = 0;
            newRect.right   = newRect.width = width;
            newRect.bottom  = newRect.height = height;
        } else {
            const rect = await this.getBoundingRect(element);
            newRect.height  = height;
            newRect.width   = width;
            newRect.top     = rect.top + top;
            newRect.bottom  = rect.top + top + height;
            newRect.left    = rect.left + left;
            newRect.right   = rect.left + left + width;
        }

        return newRect.round();
    }

    /**
     * Transform position to relative pixels by the reference point (left, top).
     * @param rect `Rect` object containing the top, left coordinates.
     */
    public relativeTo({left, top}: Rect) {
        const newRect = this.duplicate();

        newRect.top     -= top;
        newRect.bottom  -= top;
        newRect.left    -= left;
        newRect.right   -= left;

        return newRect;
    }

    /**
     * Wraps getBoundingClientRect.
     * @param element `WebElement` to retrieve the rect for.
     */
    private getBoundingRect = async (element: WebElement) =>
        element.getDriver().executeScript(
            () => {
                const rect = (arguments[0] as Element).getBoundingClientRect();
                const ratio = window.devicePixelRatio;
                return {
                    bottom: ratio * rect.bottom,
                    height: ratio * rect.height,
                    left:   ratio * rect.left,
                    right:  ratio * rect.right,
                    top:    ratio * rect.top,
                    width:  ratio * rect.width,
                };
            },
            element,
        ) as Promise<IRect>

    /**
     * Returns the client dimensions and offsets.
     * @param element `WebElement` to retrieve the rect for.
     */
    private getClientRect = async (element: WebElement) =>
        element.getDriver().executeScript(
            () => {
                const elem = arguments[0] as Element;
                const ratio = window.devicePixelRatio;
                return {
                    height: ratio * elem.clientHeight,
                    left:   ratio * elem.clientLeft,
                    top:    ratio * elem.clientTop,
                    width:  ratio * elem.clientWidth,
                };
            },
            element,
        ) as Promise<IClientRect>

    /**
     * Returns the scroll offsets.
     * @param element `WebElement` to retrieve the rect for.
     */
    private getScrollRect = async (element: WebElement) =>
        element.getDriver().executeScript(
            () => {
                const elem = arguments[0] as Element;
                const ratio = window.devicePixelRatio;
                return {
                    height: ratio * elem.scrollHeight,
                    width:  ratio * elem.scrollWidth,
                };
            },
            element,
        ) as Promise<IScrollRect>

    /**
     * Determines if an element is the document element.
     * @param element `WebElement` to test.
     */
    private isDocElement = async (element: WebElement) =>
        element.getDriver().executeScript(
            () => {
                const docElement = document.documentElement || document.getElementsByTagName("html")[0];
                return arguments[0] === docElement;
            },
            element,
        ) as Promise<boolean>

    /**
     * Round all of the Rect keys.
     */
    private round() {
        const newRect = new Rect();

        for (const key of RECT_KEYS) {
            newRect[key] = Math.round(this[key]);
        }

        return newRect;
    }
}
