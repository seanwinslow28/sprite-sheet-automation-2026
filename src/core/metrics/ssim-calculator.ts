/**
 * SSIM Calculator - Structural Similarity Index for identity drift detection
 * Per Story 3.4: Compare candidate frames against anchor using SSIM
 */

import sharp from 'sharp';
import { Result } from '../config-resolver.js';
import { logger } from '../../utils/logger.js';

/**
 * SSIM calculation result
 */
export interface SSIMResult {
    score: number;                // 0.0 - 1.0 composite
    channel_scores: {
        r: number;
        g: number;
        b: number;
        a: number;
    };
    comparison_area: {
        total_pixels: number;
        compared_pixels: number;  // Non-transparent pixels
        percentage: number;
    };
    computation_time_ms: number;
    passed: boolean;
    threshold: number;
}

/**
 * Error for SSIM calculation
 */
export interface SSIMError {
    code: string;
    message: string;
    cause?: unknown;
}

// SSIM constants (per original SSIM paper)
const K1 = 0.01;
const K2 = 0.03;
const L = 255; // Dynamic range
const C1 = (K1 * L) ** 2;
const C2 = (K2 * L) ** 2;

// Default window size
const WINDOW_SIZE = 11;

// Default identity threshold
const DEFAULT_IDENTITY_THRESHOLD = 0.85;

/**
 * Calculate SSIM between candidate and anchor images
 */
export async function calculateSSIM(
    candidatePath: string,
    anchorPath: string,
    threshold: number = DEFAULT_IDENTITY_THRESHOLD
): Promise<Result<SSIMResult, SSIMError>> {
    const startTime = Date.now();

    try {
        // Load both images
        const [candidateData, anchorData] = await Promise.all([
            loadImageData(candidatePath),
            loadImageData(anchorPath),
        ]);

        // Verify dimensions match
        if (candidateData.width !== anchorData.width ||
            candidateData.height !== anchorData.height) {
            return Result.err({
                code: 'SSIM_DIMENSION_MISMATCH',
                message: `Dimensions don't match: ${candidateData.width}x${candidateData.height} vs ${anchorData.width}x${anchorData.height}`,
            });
        }

        const { width, height } = candidateData;
        const totalPixels = width * height;

        // Calculate per-channel SSIM with mask-aware comparison
        const channelScores = {
            r: calculateChannelSSIM(candidateData.data, anchorData.data, width, height, 0),
            g: calculateChannelSSIM(candidateData.data, anchorData.data, width, height, 1),
            b: calculateChannelSSIM(candidateData.data, anchorData.data, width, height, 2),
            a: calculateChannelSSIM(candidateData.data, anchorData.data, width, height, 3),
        };

        // Composite score (weighted average, emphasizing luminance/color over alpha)
        const score = (
            channelScores.r * 0.3 +
            channelScores.g * 0.4 +  // Green carries more visual weight
            channelScores.b * 0.2 +
            channelScores.a * 0.1
        );

        // Count compared pixels (where both have alpha > 0)
        let comparedPixels = 0;
        for (let i = 0; i < totalPixels; i++) {
            const cidx = i * 4 + 3;
            const aidx = i * 4 + 3;
            if (candidateData.data[cidx] > 0 && anchorData.data[aidx] > 0) {
                comparedPixels++;
            }
        }

        const computationTimeMs = Date.now() - startTime;
        const passed = score >= threshold;

        logger.debug({
            candidatePath,
            anchorPath,
            score,
            channelScores,
            passed,
            threshold,
            computationTimeMs,
        }, 'SSIM calculation complete');

        return Result.ok({
            score,
            channel_scores: channelScores,
            comparison_area: {
                total_pixels: totalPixels,
                compared_pixels: comparedPixels,
                percentage: (comparedPixels / totalPixels) * 100,
            },
            computation_time_ms: computationTimeMs,
            passed,
            threshold,
        });
    } catch (error) {
        return Result.err({
            code: 'SSIM_CALCULATION_FAILED',
            message: 'Failed to calculate SSIM',
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

/**
 * Calculate SSIM for a single channel using simplified block-based approach
 * More efficient than sliding window for pixel art
 */
function calculateChannelSSIM(
    candidateData: Buffer,
    anchorData: Buffer,
    width: number,
    height: number,
    channelOffset: number
): number {
    // Use non-overlapping blocks for efficiency
    const blockSize = Math.min(WINDOW_SIZE, Math.min(width, height));
    const blocksX = Math.max(1, Math.floor(width / blockSize));
    const blocksY = Math.max(1, Math.floor(height / blockSize));

    let totalSSIM = 0;
    let validBlocks = 0;

    for (let by = 0; by < blocksY; by++) {
        for (let bx = 0; bx < blocksX; bx++) {
            const startX = bx * blockSize;
            const startY = by * blockSize;

            // Calculate block statistics
            let sumX = 0, sumY = 0;
            let sumX2 = 0, sumY2 = 0, sumXY = 0;
            let count = 0;

            for (let y = startY; y < startY + blockSize && y < height; y++) {
                for (let x = startX; x < startX + blockSize && x < width; x++) {
                    const idx = (y * width + x) * 4;
                    const alphaC = candidateData[idx + 3];
                    const alphaA = anchorData[idx + 3];

                    // Skip transparent pixels in mask-aware comparison
                    if (alphaC < 128 && alphaA < 128) continue;

                    const valX = candidateData[idx + channelOffset];
                    const valY = anchorData[idx + channelOffset];

                    sumX += valX;
                    sumY += valY;
                    sumX2 += valX * valX;
                    sumY2 += valY * valY;
                    sumXY += valX * valY;
                    count++;
                }
            }

            if (count < 4) continue; // Skip mostly transparent blocks

            const meanX = sumX / count;
            const meanY = sumY / count;
            const varX = (sumX2 / count) - (meanX * meanX);
            const varY = (sumY2 / count) - (meanY * meanY);
            const covXY = (sumXY / count) - (meanX * meanY);

            // SSIM formula
            const numerator = (2 * meanX * meanY + C1) * (2 * covXY + C2);
            const denominator = (meanX * meanX + meanY * meanY + C1) * (varX + varY + C2);

            const blockSSIM = denominator > 0 ? numerator / denominator : 1;
            totalSSIM += blockSSIM;
            validBlocks++;
        }
    }

    return validBlocks > 0 ? totalSSIM / validBlocks : 1.0;
}
