/**
 * Orphan Pixel Detector - identifies isolated noise pixels
 * Per Story 3.10: Detect single pixels with no matching neighbors
 */

import sharp from 'sharp';
import { Result } from '../config-resolver.js';
import { logger } from '../../utils/logger.js';

/**
 * Orphan pixel detection result
 */
export interface OrphanPixelResult {
    orphan_count: number;
    classification: 'pass' | 'warning' | 'soft_fail';
    orphan_locations: Array<{
        x: number;
        y: number;
        color: string;  // Hex color
    }>;
    total_opaque_pixels: number;
    passed: boolean;
    computation_time_ms: number;
}

/**
 * Error for orphan pixel detection
 */
export interface OrphanPixelError {
    code: string;
    message: string;
    cause?: unknown;
}

// Classification thresholds
const PASS_THRESHOLD = 5;
const WARNING_THRESHOLD = 15;

/**
 * Detect orphan (isolated) pixels in an image
 */
export async function detectOrphanPixels(
    imagePath: string
): Promise<Result<OrphanPixelResult, OrphanPixelError>> {
    const startTime = Date.now();

    try {
        const { data, info } = await sharp(imagePath)
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });

        const { width, height, channels } = info;

        let orphanCount = 0;
        let totalOpaquePixels = 0;
        const orphanLocations: OrphanPixelResult['orphan_locations'] = [];

        // Scan internal pixels (skip 1px border)
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = (y * width + x) * channels;
                const alpha = data[idx + 3];

                // Skip transparent pixels
                if (alpha < 128) continue;

                totalOpaquePixels++;

                // Check if this pixel has any identical RGBA neighbors
                const hasMatchingNeighbor = checkNeighbors(data, x, y, width, height, channels);

                if (!hasMatchingNeighbor) {
                    orphanCount++;
                    if (orphanLocations.length < 50) {
                        orphanLocations.push({
                            x,
                            y,
                            color: rgbToHex(data[idx], data[idx + 1], data[idx + 2]),
                        });
                    }
                }
            }
        }

        // Classify result
        let classification: 'pass' | 'warning' | 'soft_fail';
        if (orphanCount <= PASS_THRESHOLD) {
            classification = 'pass';
        } else if (orphanCount <= WARNING_THRESHOLD) {
            classification = 'warning';
        } else {
            classification = 'soft_fail';
        }

        const passed = classification !== 'soft_fail';
        const computationTimeMs = Date.now() - startTime;

        logger.debug({
            imagePath,
            orphanCount,
            classification,
            totalOpaquePixels,
            passed,
            computationTimeMs,
        }, 'Orphan pixel detection complete');

        return Result.ok({
            orphan_count: orphanCount,
            classification,
            orphan_locations: orphanLocations,
            total_opaque_pixels: totalOpaquePixels,
            passed,
            computation_time_ms: computationTimeMs,
        });
    } catch (error) {
        return Result.err({
            code: 'ORPHAN_DETECTION_FAILED',
            message: 'Failed to detect orphan pixels',
            cause: error,
        });
    }
}

/**
 * Check if pixel has any identical RGBA neighbors (4-connected)
 */
function checkNeighbors(
    data: Buffer,
    x: number,
    y: number,
    width: number,
    height: number,
    channels: number
): boolean {
    const idx = (y * width + x) * channels;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const a = data[idx + 3];

    const neighbors = [
        [-1, 0], [1, 0], [0, -1], [0, 1], // 4-connected
    ];

    for (const [dx, dy] of neighbors) {
        const nx = x + dx;
        const ny = y + dy;

        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

        const nidx = (ny * width + nx) * channels;
        if (data[nidx] === r &&
            data[nidx + 1] === g &&
            data[nidx + 2] === b &&
            data[nidx + 3] === a) {
            return true;
        }
    }

    return false;
}

/**
 * Convert RGB to hex string
 */
function rgbToHex(r: number, g: number, b: number): string {
    return '#' +
        r.toString(16).padStart(2, '0').toUpperCase() +
        g.toString(16).padStart(2, '0').toUpperCase() +
        b.toString(16).padStart(2, '0').toUpperCase();
}
