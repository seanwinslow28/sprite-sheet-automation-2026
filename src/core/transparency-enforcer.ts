/**
 * Transparency enforcer - ensures consistent transparency strategy per run
 * Per Story 3.2: True alpha validation and chroma key removal
 */

import sharp from 'sharp';
import { Result } from './config-resolver.js';
import { logger } from '../utils/logger.js';
import {
    hexToRgb,
    colorDistance,
    type RGB,
    type PaletteAnalysis,
} from '../utils/palette-analyzer.js';

/**
 * Transparency configuration
 */
export interface TransparencyConfig {
    strategy: 'true_alpha' | 'chroma_key';
    chroma_color?: string;          // 'auto' or explicit hex like '#00FF00'
    paletteAnalysis?: PaletteAnalysis;
}

/**
 * Result of transparency enforcement
 */
export interface TransparencyResult {
    outputPath: string;
    strategy: 'true_alpha' | 'chroma_key';
    chromaColor?: string;           // Only for chroma_key strategy
    hadAlpha: boolean;
    edgePixelsProcessed?: number;
    fringeRisk?: {
        detected: boolean;
        severity: number;           // 0.0 - 1.0
        affectedPixels: number;
    };
}

/**
 * Error for transparency operations
 */
export interface TransparencyError {
    code: string;
    message: string;
    cause?: unknown;
}

// Tolerance for chroma key matching
const CHROMA_TOLERANCE = 30;
// Tolerance for fringe detection
const FRINGE_TOLERANCE = 50;

/**
 * Enforce transparency on an image using the configured strategy
 */
export async function enforceTransparency(
    imagePath: string,
    outputPath: string,
    config: TransparencyConfig
): Promise<Result<TransparencyResult, TransparencyError>> {
    try {
        // Load image metadata
        const metadata = await sharp(imagePath).metadata();
        const hasAlpha = (metadata.channels || 0) === 4;

        if (config.strategy === 'true_alpha') {
            return enforceTrueAlpha(imagePath, outputPath, hasAlpha);
        } else {
            return enforceChromaKey(imagePath, outputPath, config, hasAlpha);
        }
    } catch (error) {
        return Result.err({
            code: 'TRANSPARENCY_LOAD_FAILED',
            message: `Failed to load image for transparency: ${imagePath}`,
            cause: error,
        });
    }
}

/**
 * Validate and enforce true alpha channel
 */
async function enforceTrueAlpha(
    imagePath: string,
    outputPath: string,
    hasAlpha: boolean
): Promise<Result<TransparencyResult, TransparencyError>> {
    if (!hasAlpha) {
        return Result.err({
            code: 'HF_NO_ALPHA',
            message: 'Image does not have an alpha channel (true_alpha mode requires RGBA)',
        });
    }

    try {
        // Verify alpha channel has meaningful data
        const { data, info } = await sharp(imagePath)
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });

        const { channels } = info;
        let hasTransparentPixels = false;
        let hasOpaquePixels = false;

        for (let i = 0; i < data.length; i += channels) {
            const alpha = data[i + 3];
            if (alpha === 0) hasTransparentPixels = true;
            if (alpha === 255) hasOpaquePixels = true;
            if (hasTransparentPixels && hasOpaquePixels) break;
        }

        // Copy to output (no modification needed for true_alpha)
        await sharp(imagePath).toFile(outputPath);

        logger.debug({
            imagePath,
            hasTransparentPixels,
            hasOpaquePixels,
        }, 'True alpha validation complete');

        return Result.ok({
            outputPath,
            strategy: 'true_alpha',
            hadAlpha: true,
        });
    } catch (error) {
        return Result.err({
            code: 'TRANSPARENCY_VALIDATION_FAILED',
            message: 'Failed to validate true alpha',
            cause: error,
        });
    }
}

/**
 * Apply chroma key removal
 */
async function enforceChromaKey(
    imagePath: string,
    outputPath: string,
    config: TransparencyConfig,
    hasAlpha: boolean
): Promise<Result<TransparencyResult, TransparencyError>> {
    // Determine chroma color
    let chromaColor: string;

    if (config.chroma_color && config.chroma_color !== 'auto') {
        // Explicit color specified
        chromaColor = config.chroma_color;
        logger.info({ chromaColor }, 'Using explicit chroma color');
    } else if (config.paletteAnalysis) {
        // Use auto-detected color from palette analysis
        chromaColor = config.paletteAnalysis.selected_chroma;
        logger.info({
            chromaColor,
            reason: config.paletteAnalysis.selection_reason,
        }, 'Using auto-detected chroma color');
    } else {
        // Default to green
        chromaColor = '#00FF00';
        logger.warn('No palette analysis available, defaulting to green chroma');
    }

    try {
        const chromaRgb = hexToRgb(chromaColor);

        // Load raw pixel data
        const { data, info } = await sharp(imagePath)
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });

        const { width, height, channels } = info;
        const outputData = Buffer.from(data);

        let removedPixels = 0;
        let fringePixels = 0;

        // Process each pixel
        for (let i = 0; i < data.length; i += channels) {
            const pixel: RGB = {
                r: data[i],
                g: data[i + 1],
                b: data[i + 2],
            };

            const distance = colorDistance(pixel, chromaRgb);

            if (distance < CHROMA_TOLERANCE) {
                // Set to fully transparent
                outputData[i + 3] = 0;
                removedPixels++;
            } else if (distance < FRINGE_TOLERANCE) {
                // Potential fringe - track for warning
                fringePixels++;
            }
        }

        // Write result
        await sharp(outputData, {
            raw: { width, height, channels: 4 },
        })
            .png()
            .toFile(outputPath);

        // Calculate fringe severity
        const totalOpaquePixels = Math.floor(data.length / channels) - removedPixels;
        const fringeSeverity = totalOpaquePixels > 0
            ? fringePixels / totalOpaquePixels
            : 0;

        const fringeDetected = fringeSeverity > 0.05; // 5% threshold

        if (fringeDetected) {
            logger.warn({
                imagePath,
                chromaColor,
                fringePixels,
                fringeSeverity,
            }, 'Potential fringe artifacts detected');
        }

        logger.debug({
            imagePath,
            chromaColor,
            removedPixels,
            fringePixels,
        }, 'Chroma key removal complete');

        return Result.ok({
            outputPath,
            strategy: 'chroma_key',
            chromaColor,
            hadAlpha: hasAlpha,
            edgePixelsProcessed: removedPixels,
            fringeRisk: {
                detected: fringeDetected,
                severity: fringeSeverity,
                affectedPixels: fringePixels,
            },
        });
    } catch (error) {
        return Result.err({
            code: 'TRANSPARENCY_CHROMA_FAILED',
            message: 'Failed to apply chroma key removal',
            cause: error,
        });
    }
}

/**
 * Validate hex color format
 */
export function isValidHexColor(color: string): boolean {
    return /^#[0-9A-Fa-f]{6}$/.test(color);
}
