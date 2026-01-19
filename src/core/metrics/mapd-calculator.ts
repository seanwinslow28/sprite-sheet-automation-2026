/**
 * MAPD Calculator - Mean Absolute Perceptual Difference for temporal coherence
 * Per Story 3.8: Measure frame-to-frame consistency
 */

import sharp from 'sharp';
import { Result } from '../config-resolver.js';
import { logger } from '../../utils/logger.js';

/**
 * MAPD calculation result
 */
export interface MAPDResult {
    mapd_score: number;             // 0.0 - 1.0
    mapd_percentage: number;        // 0 - 100%
    move_type: string;
    threshold: number;
    bypassed: boolean;              // True if high-motion move
    passed: boolean;
    computation_time_ms: number;
}

/**
 * Error for MAPD calculation
 */
export interface MAPDError {
    code: string;
    message: string;
    cause?: unknown;
}

// Move-type specific thresholds
const MAPD_THRESHOLDS: Record<string, number> = {
    idle: 0.02,     // 2% - very stable
    block: 0.05,    // 5% - moderate stability
    walk: 0.10,     // 10% - more movement allowed
    run: 0.15,      // 15% - even more movement
    attack: Infinity, // Bypass
    jump: Infinity,   // Bypass
    hit: Infinity,    // Bypass
};

// Moves that bypass MAPD check due to inherent high motion
const BYPASS_MOVES = ['attack', 'jump', 'hit', 'death', 'special'];

/**
 * Calculate MAPD between two consecutive frames
 */
export async function calculateMAPD(
    framePath1: string,
    framePath2: string,
    moveType: string
): Promise<Result<MAPDResult, MAPDError>> {
    const startTime = Date.now();
    const normalizedMoveType = moveType.toLowerCase();

    // Check if this move type bypasses MAPD
    const bypassed = BYPASS_MOVES.some(m => normalizedMoveType.includes(m));
    const threshold = MAPD_THRESHOLDS[normalizedMoveType] || MAPD_THRESHOLDS['walk'];

    if (bypassed) {
        return Result.ok({
            mapd_score: 0,
            mapd_percentage: 0,
            move_type: moveType,
            threshold,
            bypassed: true,
            passed: true,
            computation_time_ms: Date.now() - startTime,
        });
    }

    try {
        // Load both frames
        const [frame1Data, frame2Data] = await Promise.all([
            loadImageData(framePath1),
            loadImageData(framePath2),
        ]);

        // Verify dimensions match
        if (frame1Data.width !== frame2Data.width ||
            frame1Data.height !== frame2Data.height) {
            return Result.err({
                code: 'MAPD_DIMENSION_MISMATCH',
                message: 'Frame dimensions do not match',
            });
        }

        // We know dimensions are the same, total pixels determined by data length
        const channels = 4;  // RGBA
        let totalDiff = 0;
        let comparedPixels = 0;

        // Calculate mean absolute difference for each pixel
        for (let i = 0; i < frame1Data.data.length; i += channels) {
            const alpha1 = frame1Data.data[i + 3];
            const alpha2 = frame2Data.data[i + 3];

            // Skip pixels where both are transparent
            if (alpha1 < 128 && alpha2 < 128) continue;

            // Calculate per-channel absolute difference
            for (let c = 0; c < 3; c++) {  // RGB only
                totalDiff += Math.abs(frame1Data.data[i + c] - frame2Data.data[i + c]);
            }
            comparedPixels++;
        }

        // Calculate MAPD as percentage of max possible difference
        const maxDiff = comparedPixels * 3 * 255;  // 3 channels, 255 max diff
        const mapdScore = maxDiff > 0 ? totalDiff / maxDiff : 0;
        const mapdPercentage = mapdScore * 100;
        const passed = mapdScore <= threshold;
        const computationTimeMs = Date.now() - startTime;

        logger.debug({
            framePath1,
            framePath2,
            moveType,
            mapdScore,
            mapdPercentage,
            threshold,
            passed,
            computationTimeMs,
        }, 'MAPD calculation complete');

        return Result.ok({
            mapd_score: mapdScore,
            mapd_percentage: mapdPercentage,
            move_type: moveType,
            threshold,
            bypassed: false,
            passed,
            computation_time_ms: computationTimeMs,
        });
    } catch (error) {
        return Result.err({
            code: 'MAPD_CALCULATION_FAILED',
            message: 'Failed to calculate MAPD',
            cause: error,
        });
    }
}

/**
 * Load image as raw RGBA buffer
 */
async function loadImageData(imagePath: string): Promise<{
    data: Buffer;
    width: number;
    height: number;
}> {
    const { data, info } = await sharp(imagePath)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    return {
        data,
        width: info.width,
        height: info.height,
    };
}
