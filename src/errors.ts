/*
 * Custom errors related to the Snappit class.
 */
export class ScreenshotException extends Error {
}

export class ScreenshotMismatchException extends ScreenshotException {
    constructor(message = "Screenshots do not match within threshold.") {
        super(message);
    }
}

export class ScreenshotNotPresentException extends ScreenshotException {
    constructor(message = "No previous screenshot found.") {
        super(message);
    }
}

export class ScreenshotSizeException extends ScreenshotException {
    constructor(message = "Screenshots differ with respect to dimension.") {
        super(message);
    }
}

export class NoDriverSessionException extends Error {
    constructor(message = "You must call 'new Snappit(config).start();' before invoking this method.") {
        super(message);
    }
}
