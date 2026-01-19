/**
 * Post-Export Validator
 * Story 5.6: Implement Post-Export Validation
 *
 * Validates exported atlas files after TexturePacker completes.
 * Performs JSON structure, frame data, PNG integrity, and bounds validation.
 */

import { promises as fs } from 'fs';
import path from 'path';
import sharp from 'sharp';
import { Result, SystemError } from '../result.js';
import { logger } from '../../utils/logger.js';
import { pathExists, writeJsonAtomic } from '../../utils/fs-helpers.js';
import { getMultipackFrameKeys } from './multipack-validator.js';
import { isValidFrameKey, FRAME_KEY_PATTERN } from '../../domain/schemas/atlas.js';
import type { Manifest } from '../../domain/schemas/manifest.js';
import type { AtlasPaths } from './atlas-exporter.js';

/**
 * Individual check result
 */
export interface CheckResult {
    passed: boolean;
    message?: string;
    details?: Record<string, unknown>;
}

/**
 * Structured post-export validation result
 */
export interface PostExportValidationResult {
    passed: boolean;
    atlasPath: string;
    validatedAt: string;
    checks: {
        jsonStructure: CheckResult;
        frameCount: CheckResult;
        frameKeys: CheckResult;
        pngIntegrity: CheckResult;
        boundsCheck: CheckResult;
    };
    summary: {
        totalFrames: number;
        validFrames: number;
        issues: string[];
    };
}

/**
 * Validate JSON structure
 */
async function validateJsonStructure(jsonPath: string): Promise<CheckResult> {
    if (!(await pathExists(jsonPath))) {
        return {
            passed: false,
            message: `Atlas JSON not found: ${jsonPath}`,
        };
    }

    try {
        const content = await fs.readFile(jsonPath, 'utf-8');
        const json = JSON.parse(content);

        // Check for single vs multipack
        if (json.frames && typeof json.frames === 'object') {
            return {
                passed: true,
                message: 'Valid single-pack structure',
                details: { format: 'single' },
            };
        } else if (json.textures && Array.isArray(json.textures)) {
            return {
                passed: true,
                message: 'Valid multipack structure',
                details: { format: 'multipack', textureCount: json.textures.length },
            };
        } else {
            return {
                passed: false,
                message: "Invalid atlas structure: missing 'frames' or 'textures'",
            };
        }
    } catch (error) {
        if (error instanceof SyntaxError) {
            return {
                passed: false,
                message: `JSON parse error: ${error.message}`,
            };
        }
        return {
            passed: false,
            message: `Error reading JSON: ${error}`,
        };
    }
}

/**
 * Validate frame count matches manifest
 */
async function validateFrameCount(
    jsonPath: string,
    expectedCount: number,
    moveId: string
): Promise<CheckResult> {
    const frameKeys = await getMultipackFrameKeys(jsonPath);
    const found = frameKeys.length;

    if (found === expectedCount) {
        return {
            passed: true,
            message: `All ${expectedCount} frames present`,
            details: { expected: expectedCount, found },
        };
    }

    // Find missing frames
    const expectedKeys = new Set<string>();
    for (let i = 0; i < expectedCount; i++) {
        expectedKeys.add(`${moveId}/${i.toString().padStart(4, '0')}`);
    }

    const foundSet = new Set(frameKeys);
    const missing = [...expectedKeys].filter(k => !foundSet.has(k));
    const extra = [...foundSet].filter(k => !expectedKeys.has(k));

    return {
        passed: false,
        message: `Expected ${expectedCount} frames, found ${found}`,
        details: {
            expected: expectedCount,
            found,
            missing: missing.slice(0, 10),
            extra: extra.slice(0, 10),
        },
    };
}

/**
 * Validate frame key format
 */
async function validateFrameKeyFormat(
    jsonPath: string,
    moveId: string
): Promise<CheckResult> {
    const frameKeys = await getMultipackFrameKeys(jsonPath);

    if (frameKeys.length === 0) {
        return {
            passed: false,
            message: 'No frames found in atlas',
        };
    }

    // Validate against move-specific pattern
    const expectedPattern = new RegExp(`^${moveId}/\\d{4}$`);
    const invalidKeys = frameKeys.filter(k => !expectedPattern.test(k));

    if (invalidKeys.length === 0) {
        return {
            passed: true,
            message: `All ${frameKeys.length} frame keys match pattern ${moveId}/XXXX`,
            details: { pattern: `${moveId}/XXXX` },
        };
    }

    // Also check against general pattern for better error messaging
    const invalidGeneral = invalidKeys.filter(k => !isValidFrameKey(k));

    return {
        passed: false,
        message: `${invalidKeys.length} frame keys don't match expected pattern ${moveId}/XXXX`,
        details: {
            expectedPattern: `${moveId}/XXXX`,
            invalidKeys: invalidKeys.slice(0, 10),
            generalPattern: FRAME_KEY_PATTERN.source,
            alsoInvalidGeneral: invalidGeneral.length,
        },
    };
}

/**
 * Validate PNG integrity
 */
async function validatePngIntegrity(
    pngPath: string,
    expectedSize?: { w: number; h: number }
): Promise<CheckResult> {
    if (!(await pathExists(pngPath))) {
        return {
            passed: false,
            message: `Atlas PNG not found: ${pngPath}`,
        };
    }

    try {
        const metadata = await sharp(pngPath).metadata();

        const issues: string[] = [];

        if (metadata.format !== 'png') {
            issues.push(`Expected PNG format, got: ${metadata.format}`);
        }

        if (metadata.channels !== 4) {
            issues.push(`Expected 4 channels (RGBA), got: ${metadata.channels}`);
        }

        if (expectedSize) {
            if (metadata.width !== expectedSize.w || metadata.height !== expectedSize.h) {
                issues.push(
                    `Dimensions ${metadata.width}x${metadata.height} don't match ` +
                    `meta.size ${expectedSize.w}x${expectedSize.h}`
                );
            }
        }

        if (issues.length > 0) {
            return {
                passed: false,
                message: issues.join('; '),
                details: {
                    width: metadata.width,
                    height: metadata.height,
                    format: metadata.format,
                    channels: metadata.channels,
                },
            };
        }

        return {
            passed: true,
            message: 'PNG is valid',
            details: {
                dimensions: { w: metadata.width, h: metadata.height },
                format: metadata.format,
                channels: metadata.channels,
            },
        };
    } catch (error) {
        return {
            passed: false,
            message: `Error reading PNG: ${error}`,
        };
    }
}

/**
 * Validate frame bounds are within PNG dimensions
 */
async function validateFrameBounds(
    jsonPath: string,
    pngPath: string
): Promise<CheckResult> {
    try {
        const content = await fs.readFile(jsonPath, 'utf-8');
        const json = JSON.parse(content);
        const metadata = await sharp(pngPath).metadata();

        if (!metadata.width || !metadata.height) {
            return {
                passed: false,
                message: 'Could not determine PNG dimensions',
            };
        }

        const issues: string[] = [];
        let framesChecked = 0;

        // Handle both single and multipack formats
        const processFrames = (frames: Record<string, any>) => {
            for (const [key, data] of Object.entries(frames)) {
                const frame = data.frame;
                if (!frame) continue;

                framesChecked++;
                const { x, y, w, h } = frame;

                if (x + w > metadata.width!) {
                    issues.push(
                        `${key}: x(${x}) + w(${w}) = ${x + w} > PNG width ${metadata.width}`
                    );
                }
                if (y + h > metadata.height!) {
                    issues.push(
                        `${key}: y(${y}) + h(${h}) = ${y + h} > PNG height ${metadata.height}`
                    );
                }
            }
        };

        if (json.frames) {
            processFrames(json.frames);
        } else if (json.textures && Array.isArray(json.textures)) {
            // For multipack, we can't check bounds against single PNG
            // Each texture has its own PNG, so just count frames
            for (const texture of json.textures) {
                if (texture.frames) {
                    framesChecked += Object.keys(texture.frames).length;
                }
            }
            return {
                passed: true,
                message: `Multipack: ${framesChecked} frames across multiple PNGs`,
                details: { framesChecked, format: 'multipack' },
            };
        }

        if (issues.length > 0) {
            return {
                passed: false,
                message: `${issues.length} frames extend beyond atlas bounds`,
                details: {
                    issues: issues.slice(0, 10),
                    framesChecked,
                },
            };
        }

        return {
            passed: true,
            message: `All ${framesChecked} frames within bounds`,
            details: { framesChecked },
        };
    } catch (error) {
        return {
            passed: false,
            message: `Error validating bounds: ${error}`,
        };
    }
}

/**
 * Run full post-export validation
 *
 * @param atlasPaths - Paths to JSON and PNG files
 * @param manifest - Run manifest
 * @param runId - Run identifier
 * @returns Validation result
 */
export async function runPostExportValidation(
    atlasPaths: AtlasPaths,
    manifest: Manifest,
    runId: string
): Promise<Result<PostExportValidationResult, SystemError>> {
    const { move, frame_count } = manifest.identity;
    const issues: string[] = [];

    logger.info({
        event: 'post_export_validation_start',
        run_id: runId,
        json_path: atlasPaths.json,
        png_path: atlasPaths.png,
    });

    // Get expected size from JSON for PNG validation
    let expectedSize: { w: number; h: number } | undefined;
    try {
        const content = await fs.readFile(atlasPaths.json, 'utf-8');
        const json = JSON.parse(content);
        if (json.meta?.size) {
            expectedSize = json.meta.size;
        }
    } catch {
        // Will be caught by jsonStructure check
    }

    // Run all checks
    const jsonStructure = await validateJsonStructure(atlasPaths.json);
    const frameCount = await validateFrameCount(atlasPaths.json, frame_count, move);
    const frameKeys = await validateFrameKeyFormat(atlasPaths.json, move);
    const pngIntegrity = await validatePngIntegrity(atlasPaths.png, expectedSize);
    const boundsCheck = await validateFrameBounds(atlasPaths.json, atlasPaths.png);

    // Collect issues
    if (!jsonStructure.passed) issues.push(jsonStructure.message || 'JSON structure invalid');
    if (!frameCount.passed) issues.push(frameCount.message || 'Frame count mismatch');
    if (!frameKeys.passed) issues.push(frameKeys.message || 'Frame key format invalid');
    if (!pngIntegrity.passed) issues.push(pngIntegrity.message || 'PNG integrity check failed');
    if (!boundsCheck.passed) issues.push(boundsCheck.message || 'Bounds check failed');

    // Calculate valid frames
    const frameKeysList = await getMultipackFrameKeys(atlasPaths.json);
    const totalFrames = frameKeysList.length;
    const validFrames = frameKeys.passed ? totalFrames :
        frameKeysList.filter(k => new RegExp(`^${move}/\\d{4}$`).test(k)).length;

    const passed = jsonStructure.passed &&
                   frameCount.passed &&
                   frameKeys.passed &&
                   pngIntegrity.passed &&
                   boundsCheck.passed;

    const result: PostExportValidationResult = {
        passed,
        atlasPath: atlasPaths.json,
        validatedAt: new Date().toISOString(),
        checks: {
            jsonStructure,
            frameCount,
            frameKeys,
            pngIntegrity,
            boundsCheck,
        },
        summary: {
            totalFrames,
            validFrames,
            issues,
        },
    };

    logger.info({
        event: 'post_export_validation_complete',
        run_id: runId,
        passed,
        total_frames: totalFrames,
        issues_count: issues.length,
    });

    return Result.ok(result);
}

/**
 * Save validation result to disk
 */
export async function savePostExportValidationResult(
    result: PostExportValidationResult,
    runsDir: string,
    runId: string
): Promise<Result<string, SystemError>> {
    const outputPath = path.join(runsDir, runId, 'export_validation.json');

    try {
        // Convert to snake_case for external storage
        const externalResult = {
            passed: result.passed,
            atlas_path: result.atlasPath,
            validated_at: result.validatedAt,
            checks: {
                json_structure: result.checks.jsonStructure,
                frame_count: result.checks.frameCount,
                frame_keys: result.checks.frameKeys,
                png_integrity: result.checks.pngIntegrity,
                bounds_check: result.checks.boundsCheck,
            },
            summary: {
                total_frames: result.summary.totalFrames,
                valid_frames: result.summary.validFrames,
                issues: result.summary.issues,
            },
        };

        await writeJsonAtomic(outputPath, externalResult);
        return Result.ok(outputPath);
    } catch (error) {
        return Result.err({
            code: 'SYS_WRITE_FAILED',
            message: `Failed to save validation result: ${error}`,
            context: { outputPath },
        });
    }
}
