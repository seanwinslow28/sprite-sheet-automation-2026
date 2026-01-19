/**
 * Contact patch aligner - aligns frames to anchor's root position
 * Per Story 2.9: Feet-based alignment with safety valve clamping
 */

import sharp from 'sharp';
import { analyzeFrame, type AnchorAnalysis } from './anchor-analyzer.js';
import { Result } from './config-resolver.js';
import { logger } from '../utils/logger.js';

/**
 * Alignment configuration (from canvas.alignment)
 */
export interface AlignmentConfig {
    method: 'contact_patch' | 'center' | 'none';
    vertical_lock: boolean;
    root_zone_ratio: number;
    max_shift_x: number;
}

/**
 * Result of alignment operation
 */
export interface AlignmentResult {
    inputPath: string;
    outputPath: string;
    shiftX: number;
    shiftY: number;
    clamped: boolean;
    method: 'contact_patch' | 'center' | 'none';
    frameAnalysis: {
        bottomY: number;
        rootX: number;
        visibleHeight: number;
    };
}

/**
 * Error for alignment operations
 */
export interface AlignmentError {
    code: string;
    message: string;
    cause?: unknown;
}

/**
 * Align a frame to the anchor's root position
 */
export async function alignFrame(
    framePath: string,
    anchorAnalysis: AnchorAnalysis,
    config: AlignmentConfig,
    outputPath: string
): Promise<Result<AlignmentResult, AlignmentError>> {
    // Skip alignment if method is 'none'
    if (config.method === 'none') {
        // Just copy the file
        try {
            await sharp(framePath).toFile(outputPath);
            return Result.ok({
                inputPath: framePath,
                outputPath,
                shiftX: 0,
                shiftY: 0,
                clamped: false,
                method: 'none',
                frameAnalysis: {
                    bottomY: 0,
                    rootX: 0,
                    visibleHeight: 0,
                },
            });
        } catch (error) {
            return Result.err({
                code: 'ALIGNMENT_COPY_FAILED',
                message: `Failed to copy frame: ${framePath}`,
                cause: error,
            });
        }
    }

    // Analyze the frame
    const frameResult = await analyzeFrame(framePath, config.root_zone_ratio);
    if (!frameResult.ok) {
        return Result.err({
            code: 'ALIGNMENT_ANALYSIS_FAILED',
            message: `Failed to analyze frame: ${framePath}`,
            cause: frameResult.error,
        });
    }

    const frameAnalysis = frameResult.value;
    const targetRootX = anchorAnalysis.results.rootX;
    const targetBaselineY = anchorAnalysis.results.baselineY;

    // Calculate shift values
    let shiftX: number;
    let shiftY: number;

    if (config.method === 'contact_patch') {
        // Contact patch: align feet centroids
        shiftX = targetRootX - frameAnalysis.results.rootX;
        shiftY = config.vertical_lock
            ? targetBaselineY - frameAnalysis.results.baselineY
            : 0;
    } else {
        // Center: align geometric centers (legacy)
        const anchorCenterX = (anchorAnalysis.results.visible_bounds.leftX + anchorAnalysis.results.visible_bounds.rightX) / 2;
        const frameCenterX = (frameAnalysis.results.visible_bounds.leftX + frameAnalysis.results.visible_bounds.rightX) / 2;
        shiftX = Math.round(anchorCenterX - frameCenterX);
        shiftY = 0;
    }

    // Apply safety valve clamping
    let clamped = false;
    if (Math.abs(shiftX) > config.max_shift_x) {
        clamped = true;
        const originalShiftX = shiftX;
        shiftX = Math.sign(shiftX) * config.max_shift_x;
        // Log warning per project-context.md - indicates potentially corrupted frame
        logger.warn({
            framePath,
            originalShiftX,
            clampedShiftX: shiftX,
            maxShiftX: config.max_shift_x,
        }, 'Safety valve triggered - shiftX clamped to max_shift_x');
    }

    // Apply shift using Sharp
    try {
        const image = sharp(framePath);
        const metadata = await image.metadata();
        const width = metadata.width!;
        const height = metadata.height!;

        // Calculate extend values based on shift direction
        const extend = {
            top: shiftY > 0 ? shiftY : 0,
            bottom: shiftY < 0 ? -shiftY : 0,
            left: shiftX > 0 ? shiftX : 0,
            right: shiftX < 0 ? -shiftX : 0,
            background: { r: 0, g: 0, b: 0, alpha: 0 },
        };

        // Extend then extract to maintain dimensions
        await sharp(framePath)
            .extend(extend)
            .extract({
                left: extend.right,
                top: extend.bottom,
                width,
                height,
            })
            .toFile(outputPath);

        return Result.ok({
            inputPath: framePath,
            outputPath,
            shiftX,
            shiftY,
            clamped,
            method: config.method,
            frameAnalysis: {
                bottomY: frameAnalysis.results.baselineY,
                rootX: frameAnalysis.results.rootX,
                visibleHeight: frameAnalysis.results.visible_height,
            },
        });
    } catch (error) {
        return Result.err({
            code: 'ALIGNMENT_SHIFT_FAILED',
            message: `Failed to apply shift: ${framePath}`,
            cause: error,
        });
    }
}

/**
 * Get alignment config from canvas config
 */
export function getAlignmentConfig(canvas: {
    alignment: {
        method: 'contact_patch' | 'center' | 'none';
        vertical_lock: boolean;
        root_zone_ratio: number;
        max_shift_x: number;
    };
}): AlignmentConfig {
    return canvas.alignment;
}
