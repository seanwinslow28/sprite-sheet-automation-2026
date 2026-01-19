/**
 * Baseline Drift Detector - measures vertical position consistency
 * Per Story 3.7: Compare candidate baseline to anchor baseline
 */

import sharp from 'sharp';
import { Result } from '../config-resolver.js';
import { logger } from '../../utils/logger.js';
import { type AnchorAnalysis } from '../anchor-analyzer.js';

/**
 * Baseline drift result
 */
export interface BaselineDriftResult {
    anchor_baseline_y: number;
    candidate_baseline_y: number;
    drift_pixels: number;           // Signed: positive = sinking, negative = floating
    drift_absolute: number;         // Absolute value
    drift_direction: 'none' | 'floating' | 'sinking';
    passed: boolean;
    threshold: number;
    computation_time_ms: number;
}

/**
 * Error for baseline drift detection
 */
export interface BaselineDriftError {
    code: string;
    message: string;
    cause?: unknown;
}

// Default baseline drift threshold (pixels)
const DEFAULT_DRIFT_THRESHOLD = 4;
// Alpha threshold for baseline detection
const ALPHA_THRESHOLD = 128;

/**
 * Measure baseline drift between candidate and anchor
 */
export async function measureBaselineDrift(
    candidatePath: string,
    anchorAnalysis: AnchorAnalysis,
    threshold: number = DEFAULT_DRIFT_THRESHOLD
): Promise<Result<BaselineDriftResult, BaselineDriftError>> {
    const startTime = Date.now();

    try {
        // Get anchor baseline from analysis
        const anchorBaselineY = anchorAnalysis.results.baselineY;

        // Detect candidate baseline
        const candidateBaseline = await detectBaseline(candidatePath);
        if (!candidateBaseline.ok) {
            return Result.err(candidateBaseline.error);
        }

        const candidateBaselineY = candidateBaseline.value;
        const driftPixels = candidateBaselineY - anchorBaselineY;
        const driftAbsolute = Math.abs(driftPixels);

        let driftDirection: 'none' | 'floating' | 'sinking';
        if (driftPixels === 0) {
            driftDirection = 'none';
        } else if (driftPixels > 0) {
            driftDirection = 'sinking';
        } else {
            driftDirection = 'floating';
        }

        const passed = driftAbsolute <= threshold;
        const computationTimeMs = Date.now() - startTime;

        logger.debug({
            candidatePath,
            anchorBaselineY,
            candidateBaselineY,
            driftPixels,
            driftDirection,
            passed,
            computationTimeMs,
        }, 'Baseline drift measurement complete');

        return Result.ok({
            anchor_baseline_y: anchorBaselineY,
            candidate_baseline_y: candidateBaselineY,
            drift_pixels: driftPixels,
            drift_absolute: driftAbsolute,
            drift_direction: driftDirection,
            passed,
            threshold,
            computation_time_ms: computationTimeMs,
        });
    } catch (error) {
        return Result.err({
            code: 'BASELINE_DRIFT_FAILED',
            message: 'Failed to measure baseline drift',
            cause: error,
        });
    }
}

/**
 * Detect baseline (bottom-most opaque row) in an image
 */
async function detectBaseline(
    imagePath: string
): Promise<Result<number, BaselineDriftError>> {
    try {
        const { data, info } = await sharp(imagePath)
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });

        const { width, height, channels } = info;

        // Scan from bottom to find first row with opaque pixels
        for (let y = height - 1; y >= 0; y--) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * channels;
                if (data[idx + 3] >= ALPHA_THRESHOLD) {
                    return Result.ok(y);
                }
            }
        }

        // No opaque pixels found
        return Result.err({
            code: 'BASELINE_NO_CONTENT',
            message: 'No opaque pixels found to determine baseline',
        });
    } catch (error) {
        return Result.err({
            code: 'BASELINE_DETECTION_FAILED',
            message: 'Failed to detect baseline',
            cause: error,
        });
    }
}

/**
 * Export baseline detector for reuse
 */
export { detectBaseline };
