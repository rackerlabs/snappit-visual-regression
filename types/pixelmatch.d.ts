// Type definitions for pixelmatch

interface pmOptions {
    threshold?: number,
    includeAA?: boolean
}

type pixelImageData = Buffer | Uint8Array;

export function pixelmatch(
    img1: pixelImageData,
    img2: pixelImageData,
    output: pixelImageData | null,
    width: number,
    height: number,
    options?: pmOptions): number;
