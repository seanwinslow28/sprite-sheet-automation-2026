/**
 * Resolution manager - handles 4x resolution strategy
 * Per Story 2.8: Generate at 512px, downsample to 128px with nearest-neighbor
 */

import sharp from 'sharp';
import { Result } from './config-resolver.js';

/**
 * Resolution configuration
 */
export interface ResolutionConfig {
    generationSize: number;
    targetSize: number;
    ratio: number;
}

/**
 * Error for resolution operations
 */
export interface ResolutionError {
    code: string;
    message: string;
    cause?: unknown;
}

/**
 * Get generation size from canvas config
 */
export function getGenerationSize(config: { generation_size: number }): number {
    return config.generation_size; // Always 512 for MVP
}

/**
 * Get target size from canvas config
 */
export function getTargetSize(config: { target_size: number }): number {
    return config.target_size; // 128 or 256
}

/**
 * Validate resolution ratio is 4:1
 */
export function validateResolutionRatio(
    generationSize: number,
    targetSize: number
): Result<ResolutionConfig, ResolutionError> {
    const ratio = generationSize / targetSize;

    if (ratio !== 4) {
        return Result.err({
            code: 'RESOLUTION_INVALID_RATIO',
            message: `Invalid resolution ratio: ${ratio}:1, expected 4:1 (${generationSize}:${targetSize})`,
        });
    }

    return Result.ok({
        generationSize,
        targetSize,
        ratio,
    });
}

/**
 * Downsample image using nearest-neighbor (no interpolation)
 * Critical for pixel art - preserves crisp edges
 */
export async function downsample(
    inputPath: string,
    outputPath: string,
    targetSize: number
): Promise<Result<void, ResolutionError>> {
    try {
        await sharp(inputPath)
            .resize(targetSize, targetSize, {
                kernel: 'nearest', // CRITICAL: No interpolation
                fit: 'fill',       // Exact dimensions
            })
            .toFile(outputPath);

        // Verify output dimensions
        const metadata = await sharp(outputPath).metadata();
        if (metadata.width !== targetSize || metadata.height !== targetSize) {
            return Result.err({
                code: 'RESOLUTION_DIMENSION_MISMATCH',
                message: `Output dimensions ${metadata.width}x${metadata.height} don't match target ${targetSize}x${targetSize}`,
            });
        }

        return Result.ok(undefined);
    } catch (error) {
        return Result.err({
            code: 'RESOLUTION_DOWNSAMPLE_FAILED',
            message: `Failed to downsample: ${inputPath}`,
            cause: error,
        });
    }
}

/**
 * Process a candidate through the resolution pipeline
 * Saves both 512px and 128px versions
 */
export async function processCandidate(
    inputPath512: string,
    output128Path: string,
    targetSize: number = 128
): Promise<Result<{ hiResPath: string; loResPath: string }, ResolutionError>> {
    const downsampleResult = await downsample(inputPath512, output128Path, targetSize);

    if (!downsampleResult.ok) {
        return Result.err(downsampleResult.error);
    }

    return Result.ok({
        hiResPath: inputPath512,
        loResPath: output128Path,
    });
}
