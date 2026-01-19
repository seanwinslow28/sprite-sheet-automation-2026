/**
 * Frame normalizer - orchestrates post-processing pipeline for generated candidates
 * Per Story 3.1: Contact Patch → Downsample → Transparency → Canvas Sizing
 */

import sharp from 'sharp';
import path from 'path';
import { type AnchorAnalysis } from './anchor-analyzer.js';
import { alignFrame, type AlignmentConfig } from './contact-patch-aligner.js';
import { downsample } from './resolution-manager.js';
import { enforceTransparency, type TransparencyConfig } from './transparency-enforcer.js';
import { analyzeAnchorPalette } from '../utils/palette-analyzer.js';
import { Result } from './config-resolver.js';
import { logger } from '../utils/logger.js';

/**
 * Normalizer configuration from manifest canvas settings
 */
export interface NormalizerConfig {
    targetSize: number;           // 128 or 256
    generationSize: number;       // 512
    alignment: AlignmentConfig;   // Alignment settings
    transparency: {
        strategy: 'true_alpha' | 'chroma_key';
        chroma_color?: string;    // 'auto' or explicit hex
    };
}

/**
 * Individual processing step result
 */
export interface ProcessingStep {
    name: 'contact_patch' | 'downsample' | 'transparency' | 'canvas_sizing';
    durationMs: number;
    success: boolean;
    details?: Record<string, unknown>;
}

/**
 * Complete normalized frame result
 */
export interface NormalizedFrame {
    inputPath: string;
    outputPath: string;
    processingSteps: ProcessingStep[];
    durationMs: number;
    alignmentApplied: {
        shiftX: number;
        shiftY: number;
        clamped: boolean;
    };
    dimensions: {
        original: { width: number; height: number };
        final: { width: number; height: number };
    };
}

/**
 * Error for normalization operations
 */
export interface NormalizerError {
    code: string;
    message: string;
    step?: ProcessingStep['name'];
    cause?: unknown;
}

// Performance warning threshold (2 seconds)
const PERFORMANCE_WARNING_MS = 2000;

/**
 * Normalize a generated frame through the 4-step pipeline
 * Order is critical: alignment at 512px, then downsample, then transparency, then canvas sizing
 */
export async function normalizeFrame(
    inputPath: string,
    config: NormalizerConfig,
    anchorAnalysis: AnchorAnalysis,
    outputDir: string
): Promise<Result<NormalizedFrame, NormalizerError>> {
    const startTime = Date.now();
    const steps: ProcessingStep[] = [];

    // Parse input filename for output naming
    const inputBasename = path.basename(inputPath, path.extname(inputPath));
    const alignedPath = path.join(outputDir, `${inputBasename}_aligned.png`);
    const downsampledPath = path.join(outputDir, `${inputBasename}_128.png`);
    const outputPath = path.join(outputDir, `${inputBasename}_norm.png`);

    // Get original dimensions
    let originalDimensions: { width: number; height: number };
    try {
        const metadata = await sharp(inputPath).metadata();
        originalDimensions = {
            width: metadata.width || 0,
            height: metadata.height || 0,
        };
    } catch (error) {
        return Result.err({
            code: 'NORMALIZER_INPUT_FAILED',
            message: `Failed to read input image: ${inputPath}`,
            cause: error,
        });
    }

    // ========================================
    // STEP 1: Contact Patch Alignment (at 512px)
    // ========================================
    const step1Start = Date.now();
    const alignResult = await alignFrame(
        inputPath,
        anchorAnalysis,
        config.alignment,
        alignedPath
    );
    const step1Duration = Date.now() - step1Start;

    if (!alignResult.ok) {
        steps.push({
            name: 'contact_patch',
            durationMs: step1Duration,
            success: false,
            details: { error: alignResult.error },
        });
        return Result.err({
            code: 'NORMALIZER_ALIGNMENT_FAILED',
            message: `Contact patch alignment failed: ${alignResult.error.message}`,
            step: 'contact_patch',
            cause: alignResult.error,
        });
    }

    steps.push({
        name: 'contact_patch',
        durationMs: step1Duration,
        success: true,
        details: {
            shiftX: alignResult.value.shiftX,
            shiftY: alignResult.value.shiftY,
            clamped: alignResult.value.clamped,
        },
    });

    logger.debug({
        step: 'contact_patch',
        durationMs: step1Duration,
        shiftX: alignResult.value.shiftX,
        shiftY: alignResult.value.shiftY,
    }, 'Contact patch alignment complete');

    // ========================================
    // STEP 2: Downsample (512px → 128px/256px)
    // ========================================
    const step2Start = Date.now();
    const downsampleResult = await downsample(
        alignedPath,
        downsampledPath,
        config.targetSize
    );
    const step2Duration = Date.now() - step2Start;

    if (!downsampleResult.ok) {
        steps.push({
            name: 'downsample',
            durationMs: step2Duration,
            success: false,
            details: { error: downsampleResult.error },
        });
        return Result.err({
            code: 'NORMALIZER_DOWNSAMPLE_FAILED',
            message: `Downsampling failed: ${downsampleResult.error.message}`,
            step: 'downsample',
            cause: downsampleResult.error,
        });
    }

    steps.push({
        name: 'downsample',
        durationMs: step2Duration,
        success: true,
        details: {
            from: config.generationSize,
            to: config.targetSize,
        },
    });

    logger.debug({
        step: 'downsample',
        durationMs: step2Duration,
        targetSize: config.targetSize,
    }, 'Downsampling complete');

    // ========================================
    // STEP 3: Transparency Enforcement
    // ========================================
    const step3Start = Date.now();
    const transparencyOutputPath = path.join(outputDir, `${inputBasename}_trans.png`);

    // Build transparency config from normalizer config
    const transparencyConfig: TransparencyConfig = {
        strategy: config.transparency.strategy,
        chroma_color: config.transparency.chroma_color,
    };

    // If using chroma_key with auto, perform palette analysis
    if (config.transparency.strategy === 'chroma_key' &&
        (!config.transparency.chroma_color || config.transparency.chroma_color === 'auto')) {
        try {
            const paletteAnalysis = await analyzeAnchorPalette(anchorAnalysis.image_path);
            transparencyConfig.paletteAnalysis = paletteAnalysis;
            logger.debug({
                selectedChroma: paletteAnalysis.selected_chroma,
                reason: paletteAnalysis.selection_reason,
            }, 'Palette analysis complete for chroma selection');
        } catch (error) {
            logger.warn({ error }, 'Palette analysis failed, using default green chroma');
        }
    }

    const transparencyResult = await enforceTransparency(
        downsampledPath,
        transparencyOutputPath,
        transparencyConfig
    );

    const step3Duration = Date.now() - step3Start;

    if (!transparencyResult.ok) {
        steps.push({
            name: 'transparency',
            durationMs: step3Duration,
            success: false,
            details: { error: transparencyResult.error },
        });
        return Result.err({
            code: 'NORMALIZER_TRANSPARENCY_FAILED',
            message: `Transparency enforcement failed: ${transparencyResult.error.message}`,
            step: 'transparency',
            cause: transparencyResult.error,
        });
    }

    steps.push({
        name: 'transparency',
        durationMs: step3Duration,
        success: true,
        details: {
            strategy: config.transparency.strategy,
            chromaColor: transparencyResult.value.chromaColor,
            fringeRisk: transparencyResult.value.fringeRisk,
        },
    });

    logger.debug({
        step: 'transparency',
        durationMs: step3Duration,
        strategy: config.transparency.strategy,
    }, 'Transparency enforcement complete');

    // ========================================
    // STEP 4: Final Canvas Sizing
    // ========================================
    const step4Start = Date.now();
    try {
        const sourceForSizing = transparencyOutputPath;

        const img = sharp(sourceForSizing);
        const metadata = await img.metadata();
        const width = metadata.width || config.targetSize;
        const height = metadata.height || config.targetSize;

        // Calculate crop/pad values
        const targetW = config.targetSize;
        const targetH = config.targetSize;

        if (width === targetW && height === targetH) {
            // Already correct size - just copy if needed
            if (sourceForSizing !== outputPath) {
                await sharp(sourceForSizing).toFile(outputPath);
            }
        } else if (width > targetW || height > targetH) {
            // Crop to target (centered)
            const left = Math.floor((width - targetW) / 2);
            const top = Math.floor((height - targetH) / 2);
            await sharp(sourceForSizing)
                .extract({
                    left: Math.max(0, left),
                    top: Math.max(0, top),
                    width: Math.min(width, targetW),
                    height: Math.min(height, targetH),
                })
                .toFile(outputPath);
        } else {
            // Pad to target (centered with transparent background)
            const padX = Math.floor((targetW - width) / 2);
            const padY = Math.floor((targetH - height) / 2);
            await sharp(sourceForSizing)
                .extend({
                    top: padY,
                    bottom: targetH - height - padY,
                    left: padX,
                    right: targetW - width - padX,
                    background: { r: 0, g: 0, b: 0, alpha: 0 },
                })
                .toFile(outputPath);
        }
    } catch (error) {
        steps.push({
            name: 'canvas_sizing',
            durationMs: Date.now() - step4Start,
            success: false,
            details: { error },
        });
        return Result.err({
            code: 'NORMALIZER_SIZING_FAILED',
            message: 'Canvas sizing failed',
            step: 'canvas_sizing',
            cause: error,
        });
    }

    const step4Duration = Date.now() - step4Start;
    steps.push({
        name: 'canvas_sizing',
        durationMs: step4Duration,
        success: true,
        details: {
            targetSize: config.targetSize,
        },
    });

    logger.debug({
        step: 'canvas_sizing',
        durationMs: step4Duration,
        targetSize: config.targetSize,
    }, 'Canvas sizing complete');

    // ========================================
    // Finalize and log performance
    // ========================================
    const totalDuration = Date.now() - startTime;

    if (totalDuration > PERFORMANCE_WARNING_MS) {
        logger.warn({
            inputPath,
            totalDurationMs: totalDuration,
            threshold: PERFORMANCE_WARNING_MS,
            steps: steps.map(s => ({ name: s.name, durationMs: s.durationMs })),
        }, 'Frame normalization exceeded performance threshold');
    }

    logger.info({
        inputPath,
        outputPath,
        totalDurationMs: totalDuration,
    }, 'Frame normalization complete');

    return Result.ok({
        inputPath,
        outputPath,
        processingSteps: steps,
        durationMs: totalDuration,
        alignmentApplied: {
            shiftX: alignResult.value.shiftX,
            shiftY: alignResult.value.shiftY,
            clamped: alignResult.value.clamped,
        },
        dimensions: {
            original: originalDimensions,
            final: { width: config.targetSize, height: config.targetSize },
        },
    });
}

/**
 * Create normalizer config from manifest canvas settings
 */
export function getNormalizerConfig(canvas: {
    target_size: number;
    generation_size: number;
    alignment: AlignmentConfig;
    transparency?: {
        strategy?: 'true_alpha' | 'chroma_key';
        chroma_color?: string;
    };
}): NormalizerConfig {
    return {
        targetSize: canvas.target_size,
        generationSize: canvas.generation_size,
        alignment: canvas.alignment,
        transparency: {
            strategy: canvas.transparency?.strategy || 'true_alpha',
            chroma_color: canvas.transparency?.chroma_color,
        },
    };
}
