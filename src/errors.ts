/*
 * Custom errors related to the Snappit class.
 */
export class ScreenshotException extends Error {
    public id: ScreenshotExceptionName;
}

export class ScreenshotMismatchException extends ScreenshotException {
    public id = ScreenshotExceptionName.MISMATCH;

    constructor(message = "Screenshots do not match within threshold.") {
        super(message);
    }
}

export class ScreenshotNoBaselineException extends ScreenshotException {
    public id = ScreenshotExceptionName.NO_BASELINE;

    constructor(message = "No previous screenshot found.") {
        super(message);
    }
}

export class ScreenshotSizeDifferenceException extends ScreenshotException {
    public id = ScreenshotExceptionName.SIZE_DIFFERENCE;

    constructor(message = "Screenshots differ with respect to dimension.") {
        super(message);
    }
}

export class NoDriverSessionException extends Error {
    constructor(message = "You must call 'new Snappit(config).start();' before invoking this method.") {
        super(message);
    }
}

export enum ScreenshotExceptionName {
    MISMATCH = "MISMATCH",
    NO_BASELINE = "NO_BASELINE",
    SIZE_DIFFERENCE = "SIZE_DIFFERENCE",
}
