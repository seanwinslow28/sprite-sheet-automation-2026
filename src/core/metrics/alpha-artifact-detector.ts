/**
 * Alpha Artifact Detector - detects halos and fringe artifacts
 * Per Story 3.6: Identify edge artifacts from poor transparency handling
 */

import sharp from 'sharp';
import { Result } from '../config-resolver.js';
import { logger } from '../../utils/logger.js';

/**
 * Alpha artifact detection result
 */
export interface AlphaArtifactResult {
    severity_score: number;         // 0.0 - 1.0
    halo_detected: boolean;
    fringe_detected: boolean;
    artifact_counts: {
        halo_pixels: number;
        fringe_pixels: number;
        edge_pixels: number;        // Total edge pixels examined
    };
    artifact_locations: Array<{
        x: number;
        y: number;
        type: 'halo' | 'fringe';
    }>;
    passed: boolean;
    threshold: number;
    computation_time_ms: number;
}

/**
 * Error for alpha artifact detection
 */
export interface AlphaArtifactError {
    code: string;
    message: string;
    cause?: unknown;
}

// Default artifact threshold (max acceptable severity)
const DEFAULT_ARTIFACT_THRESHOLD = 0.20;
// Halo detection threshold (semi-transparent edge pixels)
const HALO_ALPHA_MIN = 1;
const HALO_ALPHA_MAX = 254;
// Fringe detection threshold (edge pixels with unexpected color)
const FRINGE_BRIGHTNESS_THRESHOLD = 200; // Light edges are suspicious

/**
 * Detect alpha artifacts in an image
 */
export async function detectAlphaArtifacts(
    imagePath: string,
    threshold: number = DEFAULT_ARTIFACT_THRESHOLD
): Promise<Result<AlphaArtifactResult, AlphaArtifactError>> {
    const startTime = Date.now();

    try {
        const { data, info } = await sharp(imagePath)
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });

        const { width, height, channels } = info;

        let haloPixels = 0;
        let fringePixels = 0;
        let edgePixels = 0;
        const artifactLocations: AlphaArtifactResult['artifact_locations'] = [];

        // Scan for edge pixels (opaque adjacent to transparent)
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = (y * width + x) * channels;
                const alpha = data[idx + 3];

                // Skip fully transparent or fully opaque interiors
                if (alpha === 0) continue;

                // Check if this is an edge pixel
                const isEdge = isEdgePixel(data, x, y, width, height, channels);
                if (!isEdge) continue;

                edgePixels++;

                // Check for halo (semi-transparent edge)
                if (alpha > HALO_ALPHA_MIN && alpha < HALO_ALPHA_MAX) {
                    haloPixels++;
                    if (artifactLocations.length < 100) {
                        artifactLocations.push({ x, y, type: 'halo' });
                    }
                }

                // Check for fringe (bright edge pixel)
                const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
                if (brightness > FRINGE_BRIGHTNESS_THRESHOLD && alpha > 200) {
                    fringePixels++;
                    if (artifactLocations.length < 100) {
                        artifactLocations.push({ x, y, type: 'fringe' });
                    }
                }
            }
        }

        // Calculate severity score
        const totalArtifacts = haloPixels + fringePixels;
        const severityScore = edgePixels > 0
            ? Math.min(1.0, totalArtifacts / edgePixels)
            : 0;

        const haloDetected = haloPixels > 5;
        const fringeDetected = fringePixels > 5;
        const passed = severityScore <= threshold;
        const computationTimeMs = Date.now() - startTime;

        logger.debug({
            imagePath,
            severityScore,
            haloPixels,
            fringePixels,
            edgePixels,
            passed,
            computationTimeMs,
        }, 'Alpha artifact detection complete');

        return Result.ok({
            severity_score: severityScore,
            halo_detected: haloDetected,
            fringe_detected: fringeDetected,
            artifact_counts: {
                halo_pixels: haloPixels,
                fringe_pixels: fringePixels,
                edge_pixels: edgePixels,
            },
            artifact_locations: artifactLocations,
            passed,
            threshold,
            computation_time_ms: computationTimeMs,
        });
    } catch (error) {
        return Result.err({
            code: 'ALPHA_ARTIFACT_DETECTION_FAILED',
            message: 'Failed to detect alpha artifacts',
            cause: error,
        });
    }
}

/**
 * Check if a pixel is at the edge (adjacent to transparent)
 */
function isEdgePixel(
    data: Buffer,
    x: number,
    y: number,
    width: number,
    height: number,
    channels: number
): boolean {
    const neighbors = [
        [-1, 0], [1, 0], [0, -1], [0, 1], // 4-connected
    ];

    for (const [dx, dy] of neighbors) {
        const nx = x + dx;
        const ny = y + dy;

        if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
            return true; // At image boundary = edge
        }

        const nidx = (ny * width + nx) * channels;
        if (data[nidx + 3] === 0) {
            return true; // Adjacent to transparent = edge
        }
    }

    return false;
}
