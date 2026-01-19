/**
 * Hard gate evaluator - validates frames against hard failure criteria
 * Per Story 3.3: HF01-HF05 checks with fail-fast behavior
 */

import sharp from 'sharp';
import { promises as fs } from 'fs';
import { Result } from './config-resolver.js';
import { logger } from '../utils/logger.js';
import {
    HF01_DIMENSION_MISMATCH,
    HF02_FULLY_TRANSPARENT,
    HF03_IMAGE_CORRUPTED,
    HF04_WRONG_COLOR_DEPTH,
    HF05_FILE_SIZE_INVALID,
} from '../domain/reason-codes.js';

/**
 * Canvas configuration for validation
 */
export interface CanvasConfig {
    target_size: number;  // 128 or 256
}

/**
 * Status of individual gate check
 */
export interface GateStatus {
    passed: boolean;
    timeMs: number;
    details?: Record<string, unknown>;
}

/**
 * Complete hard gate evaluation result
 */
export interface HardGateResult {
    passed: boolean;
    gates: {
        HF01: GateStatus;
        HF02: GateStatus;
        HF03: GateStatus;
        HF04: GateStatus;
        HF05: GateStatus;
    };
    failedGate?: 'HF01' | 'HF02' | 'HF03' | 'HF04' | 'HF05';
    failureReason?: string;
    evaluationTimeMs: number;
}

/**
 * Error for hard gate failure
 */
export interface HardGateError {
    code: string;
    message: string;
    details?: Record<string, unknown>;
}

// File size bounds
const MIN_FILE_SIZE = 100;            // 100B - valid PNG with content
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Evaluate all hard gates with fail-fast behavior
 */
export async function evaluateHardGates(
    imagePath: string,
    config: CanvasConfig
): Promise<Result<HardGateResult, HardGateError>> {
    const startTime = Date.now();
    const gates: Partial<HardGateResult['gates']> = {};

    // HF01: Dimension Check
    const hf01 = await checkDimensions(imagePath, config.target_size);
    gates.HF01 = hf01;
    if (!hf01.passed) {
        return buildFailureResult('HF01', HF01_DIMENSION_MISMATCH, hf01);
    }

    // HF02: Alpha Integrity
    const hf02 = await checkAlphaIntegrity(imagePath);
    gates.HF02 = hf02;
    if (!hf02.passed) {
        return buildFailureResult('HF02', HF02_FULLY_TRANSPARENT, hf02);
    }

    // HF03: Corruption Check
    const hf03 = await checkCorruption(imagePath);
    gates.HF03 = hf03;
    if (!hf03.passed) {
        return buildFailureResult('HF03', HF03_IMAGE_CORRUPTED, hf03);
    }

    // HF04: Color Depth Check
    const hf04 = await checkColorDepth(imagePath);
    gates.HF04 = hf04;
    if (!hf04.passed) {
        return buildFailureResult('HF04', HF04_WRONG_COLOR_DEPTH, hf04);
    }

    // HF05: File Size Check
    const hf05 = await checkFileSize(imagePath);
    gates.HF05 = hf05;
    if (!hf05.passed) {
        return buildFailureResult('HF05', HF05_FILE_SIZE_INVALID, hf05);
    }

    // All gates passed
    const evaluationTimeMs = Date.now() - startTime;
    logger.debug({
        imagePath,
        evaluationTimeMs,
        gates: Object.entries(gates).map(([name, status]) => ({
            name,
            passed: status?.passed,
            timeMs: status?.timeMs,
        })),
    }, 'All hard gates passed');

    return Result.ok({
        passed: true,
        gates: gates as HardGateResult['gates'],
        evaluationTimeMs,
    });
}

/**
 * Build failure result helper
 */
function buildFailureResult(
    gate: 'HF01' | 'HF02' | 'HF03' | 'HF04' | 'HF05',
    code: string,
    gateStatus: GateStatus
): Result<HardGateResult, HardGateError> {
    const reason = gateStatus.details?.reason as string || code;

    logger.warn({
        gate,
        code,
        reason,
        details: gateStatus.details,
    }, 'Hard gate failure');

    return Result.err({
        code,
        message: reason,
        details: gateStatus.details,
    });
}

/**
 * HF01: Check image dimensions match target size
 */
async function checkDimensions(imagePath: string, targetSize: number): Promise<GateStatus> {
    const startTime = Date.now();
    try {
        const metadata = await sharp(imagePath).metadata();
        const width = metadata.width || 0;
        const height = metadata.height || 0;
        const passed = width === targetSize && height === targetSize;

        return {
            passed,
            timeMs: Date.now() - startTime,
            details: {
                expected: { width: targetSize, height: targetSize },
                actual: { width, height },
                reason: passed ? undefined : `Dimensions ${width}x${height} don't match ${targetSize}x${targetSize}`,
            },
        };
    } catch (error) {
        return {
            passed: false,
            timeMs: Date.now() - startTime,
            details: { reason: 'Failed to read image dimensions', error },
        };
    }
}

/**
 * HF02: Check image has visible (non-transparent) content
 */
async function checkAlphaIntegrity(imagePath: string): Promise<GateStatus> {
    const startTime = Date.now();
    try {
        const { data, info } = await sharp(imagePath)
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });

        const { channels } = info;
        let opaquePixels = 0;
        const totalPixels = data.length / channels;

        for (let i = 0; i < data.length; i += channels) {
            if (data[i + 3] > 0) {
                opaquePixels++;
            }
        }

        const opaquePercentage = (opaquePixels / totalPixels) * 100;
        const passed = opaquePixels > 0;

        return {
            passed,
            timeMs: Date.now() - startTime,
            details: {
                opaquePixels,
                totalPixels,
                opaquePercentage: opaquePercentage.toFixed(2) + '%',
                reason: passed ? undefined : 'Image is fully transparent (no opaque pixels)',
            },
        };
    } catch (error) {
        return {
            passed: false,
            timeMs: Date.now() - startTime,
            details: { reason: 'Failed to scan alpha channel', error },
        };
    }
}

/**
 * HF03: Check image is not corrupted (can be parsed)
 */
async function checkCorruption(imagePath: string): Promise<GateStatus> {
    const startTime = Date.now();
    try {
        // Try to load and read metadata
        const metadata = await sharp(imagePath).metadata();

        // Try to read raw buffer to verify complete file
        await sharp(imagePath).raw().toBuffer();

        return {
            passed: true,
            timeMs: Date.now() - startTime,
            details: {
                format: metadata.format,
                width: metadata.width,
                height: metadata.height,
            },
        };
    } catch (error) {
        return {
            passed: false,
            timeMs: Date.now() - startTime,
            details: {
                reason: 'Image file is corrupted or unreadable',
                error: error instanceof Error ? error.message : String(error),
            },
        };
    }
}

/**
 * HF04: Check image is 32-bit RGBA
 */
async function checkColorDepth(imagePath: string): Promise<GateStatus> {
    const startTime = Date.now();
    try {
        const metadata = await sharp(imagePath).metadata();
        const channels = metadata.channels || 0;
        const depth = metadata.depth || '';

        // Should be 4 channels (RGBA)
        // Depth can be 'uchar' (8-bit) or 'ushort' (16-bit)
        const passed = channels === 4;

        return {
            passed,
            timeMs: Date.now() - startTime,
            details: {
                channels,
                depth,
                expected: '4 channels (RGBA)',
                reason: passed ? undefined : `Image has ${channels} channels, expected 4 (RGBA)`,
            },
        };
    } catch (error) {
        return {
            passed: false,
            timeMs: Date.now() - startTime,
            details: { reason: 'Failed to check color depth', error },
        };
    }
}

/**
 * HF05: Check file size is within reasonable bounds
 */
async function checkFileSize(imagePath: string): Promise<GateStatus> {
    const startTime = Date.now();
    try {
        const stats = await fs.stat(imagePath);
        const size = stats.size;
        const passed = size >= MIN_FILE_SIZE && size <= MAX_FILE_SIZE;

        let reason: string | undefined;
        if (size < MIN_FILE_SIZE) {
            reason = `File too small: ${size} bytes (min: ${MIN_FILE_SIZE})`;
        } else if (size > MAX_FILE_SIZE) {
            reason = `File too large: ${size} bytes (max: ${MAX_FILE_SIZE})`;
        }

        return {
            passed,
            timeMs: Date.now() - startTime,
            details: {
                sizeBytes: size,
                minBytes: MIN_FILE_SIZE,
                maxBytes: MAX_FILE_SIZE,
                reason,
            },
        };
    } catch (error) {
        return {
            passed: false,
            timeMs: Date.now() - startTime,
            details: { reason: 'Failed to check file size', error },
        };
    }
}
