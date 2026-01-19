/**
 * Atlas Validator
 * Story 5.3: Phaser-Compatible Atlas Output
 *
 * Validates TexturePacker JSON and PNG output for Phaser 3 compatibility.
 */

import { promises as fs } from 'fs';
import sharp from 'sharp';
import {
    atlasJsonSchema,
    multipackAtlasSchema,
    isValidFrameKey,
    FRAME_KEY_PATTERN,
    type AtlasJson,
    type MultipackAtlas,
} from '../../domain/schemas/atlas.js';
import { Result, SystemError } from '../result.js';
import { pathExists } from '../../utils/fs-helpers.js';
import { logger } from '../../utils/logger.js';

/**
 * Validation result for atlas checks
 */
export interface AtlasValidationResult {
    passed: boolean;
    errors: string[];
    warnings: string[];
    details?: Record<string, unknown>;
}

/**
 * Combined atlas validation report
 */
export interface AtlasValidationReport {
    jsonValid: boolean;
    pngValid: boolean;
    frameKeysValid: boolean;
    frameDataValid: boolean;
    metaValid: boolean;
    errors: string[];
    warnings: string[];
    frameCount: number;
    sheetSize?: { w: number; h: number };
}

/**
 * Validate atlas JSON file structure
 *
 * @param jsonPath - Path to atlas JSON file
 * @returns Validation result
 */
export async function validateAtlasJson(
    jsonPath: string
): Promise<AtlasValidationResult> {
    // Check file exists
    if (!(await pathExists(jsonPath))) {
        return {
            passed: false,
            errors: [`Atlas JSON not found: ${jsonPath}`],
            warnings: [],
        };
    }

    // Read and parse JSON
    let content: string;
    let parsed: unknown;
    try {
        content = await fs.readFile(jsonPath, 'utf-8');
        parsed = JSON.parse(content);
    } catch (error) {
        return {
            passed: false,
            errors: [`Failed to read/parse atlas JSON: ${error}`],
            warnings: [],
        };
    }

    // Try standard single-texture format first
    const standardResult = atlasJsonSchema.safeParse(parsed);
    if (standardResult.success) {
        return validateStandardAtlas(standardResult.data, jsonPath);
    }

    // Try multipack format
    const multipackResult = multipackAtlasSchema.safeParse(parsed);
    if (multipackResult.success) {
        return validateMultipackAtlas(multipackResult.data, jsonPath);
    }

    // Neither format matched
    const zodErrors = standardResult.error.issues.map(
        i => `${i.path.join('.')}: ${i.message}`
    );
    return {
        passed: false,
        errors: ['Atlas JSON does not match expected format', ...zodErrors],
        warnings: [],
    };
}

/**
 * Validate standard single-texture atlas
 */
function validateStandardAtlas(
    atlas: AtlasJson,
    _jsonPath: string
): AtlasValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate frame keys
    const frameKeys = Object.keys(atlas.frames);
    const invalidKeys = frameKeys.filter(k => !isValidFrameKey(k));

    if (invalidKeys.length > 0) {
        errors.push(
            `Invalid frame keys (expected pattern ${FRAME_KEY_PATTERN}): ${invalidKeys.join(', ')}`
        );
    }

    // Validate frame data
    for (const [key, frame] of Object.entries(atlas.frames)) {
        // Check rotation is disabled
        if (frame.rotated !== false) {
            errors.push(`Frame "${key}" has rotation enabled (should be false)`);
        }

        // Check dimensions are reasonable
        if (frame.frame.w <= 0 || frame.frame.h <= 0) {
            errors.push(`Frame "${key}" has invalid dimensions: ${frame.frame.w}x${frame.frame.h}`);
        }
    }

    // Validate meta
    if (atlas.meta.format !== 'RGBA8888') {
        errors.push(`Meta format should be RGBA8888, got: ${atlas.meta.format}`);
    }

    if (!atlas.meta.image.endsWith('.png')) {
        errors.push(`Meta image should be .png, got: ${atlas.meta.image}`);
    }

    return {
        passed: errors.length === 0,
        errors,
        warnings,
        details: {
            frameCount: frameKeys.length,
            sheetSize: atlas.meta.size,
            format: 'standard',
        },
    };
}

/**
 * Validate multipack atlas
 */
function validateMultipackAtlas(
    atlas: MultipackAtlas,
    _jsonPath: string
): AtlasValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let totalFrames = 0;

    for (let i = 0; i < atlas.textures.length; i++) {
        const texture = atlas.textures[i];

        // Validate frame keys
        const frameKeys = Object.keys(texture.frames);
        totalFrames += frameKeys.length;
        const invalidKeys = frameKeys.filter(k => !isValidFrameKey(k));

        if (invalidKeys.length > 0) {
            errors.push(
                `Texture ${i}: Invalid frame keys: ${invalidKeys.join(', ')}`
            );
        }

        // Validate format
        if (texture.format !== 'RGBA8888') {
            errors.push(`Texture ${i}: Format should be RGBA8888, got: ${texture.format}`);
        }

        // Validate frame data
        for (const [key, frame] of Object.entries(texture.frames)) {
            if (frame.rotated !== false) {
                errors.push(`Texture ${i}, Frame "${key}": rotation enabled (should be false)`);
            }
        }
    }

    return {
        passed: errors.length === 0,
        errors,
        warnings,
        details: {
            frameCount: totalFrames,
            textureCount: atlas.textures.length,
            format: 'multipack',
        },
    };
}

/**
 * Validate atlas PNG file
 *
 * @param pngPath - Path to atlas PNG file
 * @param expectedSize - Expected dimensions from JSON meta (optional)
 * @returns Validation result
 */
export async function validateAtlasPng(
    pngPath: string,
    expectedSize?: { w: number; h: number }
): Promise<AtlasValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check file exists
    if (!(await pathExists(pngPath))) {
        return {
            passed: false,
            errors: [`Atlas PNG not found: ${pngPath}`],
            warnings: [],
        };
    }

    // Read image metadata
    let metadata: sharp.Metadata;
    try {
        metadata = await sharp(pngPath).metadata();
    } catch (error) {
        return {
            passed: false,
            errors: [`Failed to read atlas PNG: ${error}`],
            warnings: [],
        };
    }

    // Validate format
    if (metadata.format !== 'png') {
        errors.push(`Expected PNG format, got: ${metadata.format}`);
    }

    // Validate alpha channel
    if (metadata.channels !== 4) {
        errors.push(`Expected 4 channels (RGBA), got: ${metadata.channels}`);
    }

    // Validate dimensions match meta
    if (expectedSize) {
        if (metadata.width !== expectedSize.w || metadata.height !== expectedSize.h) {
            errors.push(
                `Dimensions mismatch: PNG is ${metadata.width}x${metadata.height}, ` +
                `meta says ${expectedSize.w}x${expectedSize.h}`
            );
        }
    }

    return {
        passed: errors.length === 0,
        errors,
        warnings,
        details: {
            width: metadata.width,
            height: metadata.height,
            channels: metadata.channels,
            format: metadata.format,
        },
    };
}

/**
 * Perform full atlas validation (JSON + PNG)
 *
 * @param jsonPath - Path to atlas JSON
 * @param pngPath - Path to atlas PNG
 * @returns Combined validation report
 */
export async function validateAtlas(
    jsonPath: string,
    pngPath: string
): Promise<Result<AtlasValidationReport, SystemError>> {
    logger.debug({
        event: 'atlas_validation_start',
        jsonPath,
        pngPath,
    });

    // Validate JSON
    const jsonResult = await validateAtlasJson(jsonPath);

    // Get expected size from JSON for PNG validation
    let expectedSize: { w: number; h: number } | undefined;
    if (jsonResult.passed && jsonResult.details?.sheetSize) {
        expectedSize = jsonResult.details.sheetSize as { w: number; h: number };
    }

    // Validate PNG
    const pngResult = await validateAtlasPng(pngPath, expectedSize);

    // Combine results
    const allErrors = [...jsonResult.errors, ...pngResult.errors];
    const allWarnings = [...jsonResult.warnings, ...pngResult.warnings];
    const passed = jsonResult.passed && pngResult.passed;

    const report: AtlasValidationReport = {
        jsonValid: jsonResult.passed,
        pngValid: pngResult.passed,
        frameKeysValid: !jsonResult.errors.some(e => e.includes('frame key')),
        frameDataValid: !jsonResult.errors.some(e => e.includes('Frame "')),
        metaValid: !jsonResult.errors.some(e => e.includes('Meta')),
        errors: allErrors,
        warnings: allWarnings,
        frameCount: (jsonResult.details?.frameCount as number) || 0,
        sheetSize: expectedSize,
    };

    logger.info({
        event: 'atlas_validation_complete',
        passed,
        errors: allErrors.length,
        warnings: allWarnings.length,
        frameCount: report.frameCount,
    });

    return Result.ok(report);
}

/**
 * Check if an atlas is in multipack format
 *
 * @param jsonPath - Path to atlas JSON
 * @returns True if multipack format
 */
export async function isMultipackAtlas(jsonPath: string): Promise<boolean> {
    try {
        const content = await fs.readFile(jsonPath, 'utf-8');
        const parsed = JSON.parse(content);
        return 'textures' in parsed && Array.isArray(parsed.textures);
    } catch {
        return false;
    }
}

/**
 * Get frame count from atlas JSON
 *
 * @param jsonPath - Path to atlas JSON
 * @returns Number of frames or 0 on error
 */
export async function getAtlasFrameCount(jsonPath: string): Promise<number> {
    try {
        const content = await fs.readFile(jsonPath, 'utf-8');
        const parsed = JSON.parse(content);

        // Standard format
        if ('frames' in parsed && typeof parsed.frames === 'object') {
            return Object.keys(parsed.frames).length;
        }

        // Multipack format
        if ('textures' in parsed && Array.isArray(parsed.textures)) {
            return parsed.textures.reduce(
                (sum: number, tex: { frames: object }) =>
                    sum + Object.keys(tex.frames || {}).length,
                0
            );
        }

        return 0;
    } catch {
        return 0;
    }
}
