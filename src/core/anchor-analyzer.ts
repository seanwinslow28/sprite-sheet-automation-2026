/**
 * Anchor analyzer - extracts alignment targets from anchor image
 * Per Story 2.7: baselineY and rootX extraction for contact patch alignment
 */

import sharp from 'sharp';
import { writeJsonAtomic } from '../utils/fs-helpers.js';
import { Result } from './config-resolver.js';

/**
 * Visible bounds of the sprite
 */
export interface VisibleBounds {
    topY: number;
    bottomY: number;
    leftX: number;
    rightX: number;
}

/**
 * Root zone bounds
 */
export interface RootZoneBounds {
    startY: number;
    endY: number;
    height: number;
    pixelCount: number;
}

/**
 * Complete anchor analysis result
 */
export interface AnchorAnalysis {
    analyzed_at: string;
    image_path: string;
    image_dimensions: { width: number; height: number };
    alpha_threshold: number;
    root_zone_ratio: number;
    results: {
        baselineY: number;
        rootX: number;
        visible_bounds: VisibleBounds;
        visible_height: number;
        root_zone: RootZoneBounds;
    };
}

/**
 * Error for anchor analysis
 */
export interface AnchorError {
    code: string;
    message: string;
    cause?: unknown;
}

// Default alpha threshold (50% opacity)
const DEFAULT_ALPHA_THRESHOLD = 128;

/**
 * Analyze anchor image to extract alignment targets
 */
export async function analyzeAnchor(
    imagePath: string,
    rootZoneRatio: number = 0.15,
    alphaThreshold: number = DEFAULT_ALPHA_THRESHOLD
): Promise<Result<AnchorAnalysis, AnchorError>> {
    try {
        // Load image
        const image = sharp(imagePath);
        const metadata = await image.metadata();

        if (!metadata.width || !metadata.height) {
            return Result.err({
                code: 'ANCHOR_INVALID_FORMAT',
                message: 'Could not read image dimensions',
            });
        }

        const width = metadata.width;
        const height = metadata.height;

        // Get raw pixel data (RGBA)
        const { data } = await image.raw().ensureAlpha().toBuffer({ resolveWithObject: true });

        // Build opacity mask and find bounds
        const opaqueMask: boolean[][] = [];
        let topY = height;
        let bottomY = -1;
        let leftX = width;
        let rightX = -1;

        for (let y = 0; y < height; y++) {
            opaqueMask[y] = [];
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const alpha = data[idx + 3];
                const isOpaque = alpha >= alphaThreshold;
                opaqueMask[y][x] = isOpaque;

                if (isOpaque) {
                    if (y < topY) topY = y;
                    if (y > bottomY) bottomY = y;
                    if (x < leftX) leftX = x;
                    if (x > rightX) rightX = x;
                }
            }
        }

        // Check for fully transparent image
        if (bottomY < 0) {
            return Result.err({
                code: 'ANCHOR_FULLY_TRANSPARENT',
                message: 'Anchor image has no opaque pixels',
            });
        }

        // Calculate visible height
        const visibleHeight = bottomY - topY;

        // Calculate root zone
        const rootZoneHeight = Math.ceil(visibleHeight * rootZoneRatio);
        const rootZoneStartY = bottomY - rootZoneHeight;

        // Find X-centroid of pixels in root zone
        let xSum = 0;
        let rootPixelCount = 0;

        for (let y = rootZoneStartY; y <= bottomY; y++) {
            if (y >= 0 && y < height) {
                for (let x = 0; x < width; x++) {
                    if (opaqueMask[y][x]) {
                        xSum += x;
                        rootPixelCount++;
                    }
                }
            }
        }

        // Calculate rootX (X-centroid)
        const rootX = rootPixelCount > 0 ? Math.round(xSum / rootPixelCount) : Math.round(width / 2);

        // Build analysis result
        const analysis: AnchorAnalysis = {
            analyzed_at: new Date().toISOString(),
            image_path: imagePath,
            image_dimensions: { width, height },
            alpha_threshold: alphaThreshold,
            root_zone_ratio: rootZoneRatio,
            results: {
                baselineY: bottomY,
                rootX,
                visible_bounds: { topY, bottomY, leftX, rightX },
                visible_height: visibleHeight,
                root_zone: {
                    startY: rootZoneStartY,
                    endY: bottomY,
                    height: rootZoneHeight,
                    pixelCount: rootPixelCount,
                },
            },
        };

        return Result.ok(analysis);
    } catch (error) {
        return Result.err({
            code: 'ANCHOR_LOAD_FAILED',
            message: `Failed to analyze anchor: ${imagePath}`,
            cause: error,
        });
    }
}

/**
 * Save anchor analysis to file
 */
export async function saveAnchorAnalysis(
    analysis: AnchorAnalysis,
    outputPath: string
): Promise<Result<void, AnchorError>> {
    try {
        await writeJsonAtomic(outputPath, analysis);
        return Result.ok(undefined);
    } catch (error) {
        return Result.err({
            code: 'ANCHOR_SAVE_FAILED',
            message: `Failed to save anchor analysis: ${outputPath}`,
            cause: error,
        });
    }
}

/**
 * Analyze a generated frame using the same algorithm
 * Used for contact patch alignment
 */
export async function analyzeFrame(
    imagePath: string,
    rootZoneRatio: number = 0.15,
    alphaThreshold: number = DEFAULT_ALPHA_THRESHOLD
): Promise<Result<AnchorAnalysis, AnchorError>> {
    return analyzeAnchor(imagePath, rootZoneRatio, alphaThreshold);
}
