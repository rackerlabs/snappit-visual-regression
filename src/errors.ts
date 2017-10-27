/*
 * Custom errors related to the Snappit class.
 */
export class ScreenshotException extends Error {
    public id: ScreenshotExceptionName;
}

export class ScreenshotMismatchException extends ScreenshotException {
    public id = ScreenshotExceptionName.MISMATCH;

    constructor(screenshotName: string) {
        super(`Screenshots do not match within threshold: ${screenshotName}`);
    }
}

export class ScreenshotNoBaselineException extends ScreenshotException {
    public id = ScreenshotExceptionName.NO_BASELINE;

    constructor(screenshotName: string) {
        super(`No previous screenshot found: ${screenshotName}`);
    }
}

export class ScreenshotSizeDifferenceException extends ScreenshotException {
    public id = ScreenshotExceptionName.SIZE_DIFFERENCE;

    constructor(screenshotName: string) {
        super(`Screenshots differ with respect to dimension: ${screenshotName}`);
    }
}

export class NoDriverSessionException extends Error {
    constructor() {
        super("You must call 'new Snappit(config).start();' before invoking this method.");
    }
}

export enum ScreenshotExceptionName {
    MISMATCH = "MISMATCH",
    NO_BASELINE = "NO_BASELINE",
    SIZE_DIFFERENCE = "SIZE_DIFFERENCE",
}
