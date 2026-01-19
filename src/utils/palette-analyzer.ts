/**
 * Palette analyzer - analyzes anchor images to determine optimal chroma key color
 * Per Story 3.2: Auto-detection with color distance tolerance
 */

import sharp from 'sharp';
import { writeJsonAtomic } from './fs-helpers.js';
import { logger } from './logger.js';

/**
 * RGB color representation
 */
export interface RGB {
    r: number;
    g: number;
    b: number;
}

/**
 * Palette analysis result
 */
export interface PaletteAnalysis {
    analyzed_at: string;
    anchor_path: string;
    unique_colors: number;
    palette: string[];           // Hex colors found in anchor
    contains_green: boolean;     // Has color within tolerance of #00FF00
    contains_magenta: boolean;   // Has color within tolerance of #FF00FF
    contains_cyan: boolean;      // Has color within tolerance of #00FFFF
    selected_chroma: string;     // Selected chroma key color
    selection_reason: string;    // Explanation for selection
}

// Chroma candidates in priority order
export const CHROMA_CANDIDATES = [
    '#00FF00',  // Green (classic chroma key)
    '#FF00FF',  // Magenta (if green in palette)
    '#00FFFF',  // Cyan (if magenta also in palette)
    '#0000FF',  // Blue (last resort)
];

// Tolerance for "color exists in palette" check
const PALETTE_TOLERANCE = 30;

/**
 * Calculate Euclidean distance between two RGB colors
 */
export function colorDistance(c1: RGB, c2: RGB): number {
    return Math.sqrt(
        Math.pow(c1.r - c2.r, 2) +
        Math.pow(c1.g - c2.g, 2) +
        Math.pow(c1.b - c2.b, 2)
    );
}

/**
 * Parse hex color string to RGB
 */
export function hexToRgb(hex: string): RGB {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) {
        return { r: 0, g: 0, b: 0 };
    }
    return {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
    };
}

/**
 * Convert RGB to hex string
 */
export function rgbToHex(rgb: RGB): string {
    return '#' +
        rgb.r.toString(16).padStart(2, '0').toUpperCase() +
        rgb.g.toString(16).padStart(2, '0').toUpperCase() +
        rgb.b.toString(16).padStart(2, '0').toUpperCase();
}

/**
 * Check if a palette contains a color within tolerance
 */
export function paletteContainsColor(
    palette: RGB[],
    target: RGB,
    tolerance: number = PALETTE_TOLERANCE
): boolean {
    for (const color of palette) {
        if (colorDistance(color, target) < tolerance) {
            return true;
        }
    }
    return false;
}

/**
 * Analyze anchor image to extract palette and select optimal chroma color
 */
export async function analyzeAnchorPalette(
    anchorPath: string,
    tolerance: number = PALETTE_TOLERANCE
): Promise<PaletteAnalysis> {
    const startTime = Date.now();

    // Load image and get raw pixels
    const { data, info } = await sharp(anchorPath)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    const { channels } = info;
    const paletteSet = new Set<string>();
    const paletteRgb: RGB[] = [];

    // Extract all unique colors from opaque pixels
    for (let i = 0; i < data.length; i += channels) {
        const alpha = data[i + 3];

        // Skip transparent pixels
        if (alpha < 128) continue;

        const rgb: RGB = {
            r: data[i],
            g: data[i + 1],
            b: data[i + 2],
        };

        const hex = rgbToHex(rgb);
        if (!paletteSet.has(hex)) {
            paletteSet.add(hex);
            paletteRgb.push(rgb);
        }
    }

    // Check for chroma candidates in palette
    const green = hexToRgb('#00FF00');
    const magenta = hexToRgb('#FF00FF');
    const cyan = hexToRgb('#00FFFF');

    const containsGreen = paletteContainsColor(paletteRgb, green, tolerance);
    const containsMagenta = paletteContainsColor(paletteRgb, magenta, tolerance);
    const containsCyan = paletteContainsColor(paletteRgb, cyan, tolerance);

    // Select chroma color (first candidate NOT in palette)
    let selectedChroma = '#0000FF'; // Default fallback
    let selectionReason = 'All standard chroma colors present, using blue as fallback';

    for (const candidate of CHROMA_CANDIDATES) {
        const candidateRgb = hexToRgb(candidate);
        if (!paletteContainsColor(paletteRgb, candidateRgb, tolerance)) {
            selectedChroma = candidate;
            selectionReason = `${candidate} not found in anchor palette`;
            break;
        }
    }

    // Build specific selection reason
    if (containsGreen && selectedChroma === '#FF00FF') {
        selectionReason = 'Green (#00FF00) found in palette, using magenta';
    } else if (containsGreen && containsMagenta && selectedChroma === '#00FFFF') {
        selectionReason = 'Green and magenta found in palette, using cyan';
    }

    const durationMs = Date.now() - startTime;
    logger.debug({
        anchorPath,
        uniqueColors: paletteSet.size,
        selectedChroma,
        durationMs,
    }, 'Anchor palette analysis complete');

    return {
        analyzed_at: new Date().toISOString(),
        anchor_path: anchorPath,
        unique_colors: paletteSet.size,
        palette: Array.from(paletteSet).slice(0, 100), // Limit stored colors
        contains_green: containsGreen,
        contains_magenta: containsMagenta,
        contains_cyan: containsCyan,
        selected_chroma: selectedChroma,
        selection_reason: selectionReason,
    };
}

/**
 * Save palette analysis to JSON file
 */
export async function savePaletteAnalysis(
    analysis: PaletteAnalysis,
    outputPath: string
): Promise<void> {
    await writeJsonAtomic(outputPath, analysis);
}
