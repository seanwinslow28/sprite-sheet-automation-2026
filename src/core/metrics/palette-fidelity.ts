/**
 * Palette Fidelity Calculator - measures color consistency with defined palette
 * Per Story 3.5: Detect off-palette colors and calculate fidelity percentage
 */

import sharp from 'sharp';
import { Result } from '../config-resolver.js';
import { logger } from '../../utils/logger.js';
import { colorDistance, hexToRgb, rgbToHex, type RGB } from '../../utils/palette-analyzer.js';

/**
 * Palette fidelity result
 */
export interface PaletteFidelityResult {
    fidelity_percentage: number;    // 0-100
    fidelity_score: number;         // 0.0-1.0
    matched_pixels: number;
    unmatched_pixels: number;
    off_palette_colors: Array<{
        hex: string;
        count: number;
        percentage: number;
    }>;
    palette_coverage: Array<{
        hex: string;
        count: number;
        percentage: number;
    }>;
    tolerance_used: number;
    passed: boolean;
    threshold: number;
    computation_time_ms: number;
}

/**
 * Error for palette fidelity calculation
 */
export interface PaletteFidelityError {
    code: string;
    message: string;
    cause?: unknown;
}

// Default color tolerance (Euclidean distance)
const DEFAULT_TOLERANCE = 30;
// Default palette fidelity threshold
const DEFAULT_PALETTE_THRESHOLD = 0.90;
// Max off-palette colors to report
const MAX_OFF_PALETTE_COLORS = 10;

/**
 * Calculate palette fidelity for a candidate image
 */
export async function calculatePaletteFidelity(
    candidatePath: string,
    palette: string[],  // Array of hex colors
    threshold: number = DEFAULT_PALETTE_THRESHOLD,
    tolerance: number = DEFAULT_TOLERANCE
): Promise<Result<PaletteFidelityResult, PaletteFidelityError>> {
    const startTime = Date.now();

    if (palette.length === 0) {
        return Result.err({
            code: 'PALETTE_EMPTY',
            message: 'Cannot calculate fidelity against empty palette',
        });
    }

    try {
        // Load candidate image
        const { data, info } = await sharp(candidatePath)
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });

        const { channels } = info;
        const paletteRgb = palette.map(hexToRgb);

        // Initialize counters
        let matchedPixels = 0;
        let unmatchedPixels = 0;
        const colorCounts = new Map<string, number>();
        const paletteUsage = new Map<string, number>();

        // Initialize palette usage map
        for (const hex of palette) {
            paletteUsage.set(hex, 0);
        }

        // Analyze each pixel
        for (let i = 0; i < data.length; i += channels) {
            const alpha = data[i + 3];

            // Skip transparent pixels
            if (alpha < 128) continue;

            const pixelRgb: RGB = {
                r: data[i],
                g: data[i + 1],
                b: data[i + 2],
            };

            // Find closest palette color
            let minDistance = Infinity;
            let closestColor = palette[0];

            for (let j = 0; j < paletteRgb.length; j++) {
                const distance = colorDistance(pixelRgb, paletteRgb[j]);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestColor = palette[j];
                }
            }

            if (minDistance <= tolerance) {
                // Within tolerance - counts as palette match
                matchedPixels++;
                paletteUsage.set(closestColor, (paletteUsage.get(closestColor) || 0) + 1);
            } else {
                // Off-palette color
                unmatchedPixels++;
                const hex = rgbToHex(pixelRgb);
                colorCounts.set(hex, (colorCounts.get(hex) || 0) + 1);
            }
        }

        const totalOpaquePixels = matchedPixels + unmatchedPixels;
        const fidelityScore = totalOpaquePixels > 0
            ? matchedPixels / totalOpaquePixels
            : 1.0;
        const fidelityPercentage = fidelityScore * 100;

        // Build off-palette color list (sorted by count)
        const offPaletteColors = Array.from(colorCounts.entries())
            .map(([hex, count]) => ({
                hex,
                count,
                percentage: (count / totalOpaquePixels) * 100,
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, MAX_OFF_PALETTE_COLORS);

        // Build palette coverage list
        const paletteCoverage = Array.from(paletteUsage.entries())
            .filter(([_, count]) => count > 0)
            .map(([hex, count]) => ({
                hex,
                count,
                percentage: (count / totalOpaquePixels) * 100,
            }))
            .sort((a, b) => b.count - a.count);

        const passed = fidelityScore >= threshold;
        const computationTimeMs = Date.now() - startTime;

        logger.debug({
            candidatePath,
            fidelityScore,
            matchedPixels,
            unmatchedPixels,
            offPaletteCount: offPaletteColors.length,
            passed,
            computationTimeMs,
        }, 'Palette fidelity calculation complete');

        return Result.ok({
            fidelity_percentage: fidelityPercentage,
            fidelity_score: fidelityScore,
            matched_pixels: matchedPixels,
            unmatched_pixels: unmatchedPixels,
            off_palette_colors: offPaletteColors,
            palette_coverage: paletteCoverage,
            tolerance_used: tolerance,
            passed,
            threshold,
            computation_time_ms: computationTimeMs,
        });
    } catch (error) {
        return Result.err({
            code: 'PALETTE_FIDELITY_FAILED',
            message: 'Failed to calculate palette fidelity',
            cause: error,
        });
    }
}

/**
 * Extract dominant colors from an image (for palette building)
 */
export async function extractDominantColors(
    imagePath: string,
    maxColors: number = 32
): Promise<Result<string[], PaletteFidelityError>> {
    try {
        const { data, info } = await sharp(imagePath)
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });

        const { channels } = info;
        const colorCounts = new Map<string, number>();

        // Count all opaque colors
        for (let i = 0; i < data.length; i += channels) {
            const alpha = data[i + 3];
            if (alpha < 128) continue;

            const hex = rgbToHex({
                r: data[i],
                g: data[i + 1],
                b: data[i + 2],
            });
            colorCounts.set(hex, (colorCounts.get(hex) || 0) + 1);
        }

        // Sort by frequency and return top colors
        const sortedColors = Array.from(colorCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, maxColors)
            .map(([hex]) => hex);

        return Result.ok(sortedColors);
    } catch (error) {
        return Result.err({
            code: 'COLOR_EXTRACTION_FAILED',
            message: 'Failed to extract dominant colors',
            cause: error,
        });
    }
}
