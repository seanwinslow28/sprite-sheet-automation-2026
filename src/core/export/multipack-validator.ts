/**
 * Multipack Validator
 * Story 5.4: Implement Multipack Support for Large Atlases
 *
 * Validates TexturePacker multipack output (textures[] array format).
 */

import { promises as fs } from 'fs';
import path from 'path';
import { Result, SystemError } from '../result.js';
import { pathExists } from '../../utils/fs-helpers.js';
import { logger } from '../../utils/logger.js';
import { isValidFrameKey, FRAME_KEY_PATTERN } from '../../domain/schemas/atlas.js';

/**
 * Info about a single sheet in a multipack
 */
export interface SheetInfo {
    index: number;
    pngPath: string;
    pngExists: boolean;
    image: string;
    size: { w: number; h: number };
    frameCount: number;
}

/**
 * Result of multipack detection
 */
export interface MultipackDetectionResult {
    isMultipack: boolean;
    sheets: SheetInfo[];
    totalFrames: number;
    masterJsonPath: string;
}

/**
 * Result of multipack validation
 */
export interface MultipackValidationResult {
    passed: boolean;
    isMultipack: boolean;
    sheets: SheetInfo[];
    totalFrames: number;
    frameKeys: string[];
    errors: string[];
    warnings: string[];
}

/**
 * Detect if atlas is multipack and gather sheet information
 *
 * @param exportDir - Directory containing atlas files
 * @param baseName - Base name of the atlas (e.g., "blaze_idle")
 * @returns Detection result
 */
export async function detectMultipack(
    exportDir: string,
    baseName: string
): Promise<MultipackDetectionResult> {
    const sheets: SheetInfo[] = [];
    const masterJsonPath = path.join(exportDir, `${baseName}.json`);

    // Check for multipack pattern: baseName_0.png, baseName_1.png, etc.
    let index = 0;
    while (true) {
        const pngPath = path.join(exportDir, `${baseName}-${index}.png`);
        const exists = await pathExists(pngPath);
        if (!exists) break;

        sheets.push({
            index,
            pngPath,
            pngExists: true,
            image: `${baseName}-${index}.png`,
            size: { w: 0, h: 0 }, // Will be filled from JSON
            frameCount: 0,
        });
        index++;
    }

    // If no multipack files found, check for single sheet
    if (sheets.length === 0) {
        const singlePng = path.join(exportDir, `${baseName}.png`);
        const exists = await pathExists(singlePng);
        if (exists) {
            sheets.push({
                index: 0,
                pngPath: singlePng,
                pngExists: true,
                image: `${baseName}.png`,
                size: { w: 0, h: 0 },
                frameCount: 0,
            });
        }
    }

    return {
        isMultipack: sheets.length > 1,
        sheets,
        totalFrames: 0,
        masterJsonPath,
    };
}

/**
 * Validate a multipack atlas
 *
 * @param jsonPath - Path to the master JSON file
 * @param expectedFrameCount - Expected number of frames from manifest
 * @param moveId - Move ID for frame key validation
 * @returns Validation result
 */
export async function validateMultipack(
    jsonPath: string,
    expectedFrameCount: number,
    moveId: string
): Promise<Result<MultipackValidationResult, SystemError>> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const sheets: SheetInfo[] = [];
    const allFrameKeys: string[] = [];

    logger.debug({
        event: 'multipack_validation_start',
        jsonPath,
        expectedFrameCount,
        moveId,
    });

    // Check JSON exists
    if (!(await pathExists(jsonPath))) {
        return Result.err({
            code: 'HF_ATLAS_FORMAT',
            message: `Atlas JSON not found: ${jsonPath}`,
            context: { jsonPath },
        });
    }

    // Read and parse JSON
    let json: unknown;
    try {
        const content = await fs.readFile(jsonPath, 'utf-8');
        json = JSON.parse(content);
    } catch (error) {
        return Result.err({
            code: 'HF_ATLAS_FORMAT',
            message: `Failed to parse atlas JSON: ${error}`,
            context: { jsonPath },
        });
    }

    const jsonObj = json as Record<string, unknown>;
    const exportDir = path.dirname(jsonPath);

    // Determine if this is multipack or single format
    const isMultipack = 'textures' in jsonObj && Array.isArray(jsonObj.textures);
    const isSingle = 'frames' in jsonObj && typeof jsonObj.frames === 'object';

    if (!isMultipack && !isSingle) {
        return Result.err({
            code: 'HF_ATLAS_FORMAT',
            message: "Missing 'textures' array for MultiAtlas or 'frames' object for single atlas",
            context: { jsonPath },
        });
    }

    if (isMultipack) {
        // Validate multipack format
        const textures = jsonObj.textures as Array<Record<string, unknown>>;

        for (let i = 0; i < textures.length; i++) {
            const texture = textures[i];

            // Validate texture has required fields
            if (!texture.image || typeof texture.image !== 'string') {
                errors.push(`Texture ${i}: Missing 'image' property`);
                continue;
            }

            if (!texture.frames || typeof texture.frames !== 'object') {
                errors.push(`Texture ${i}: Missing 'frames' object`);
                continue;
            }

            // Check PNG exists
            const pngPath = path.join(exportDir, texture.image as string);
            const pngExists = await pathExists(pngPath);

            if (!pngExists) {
                errors.push(`Texture ${i}: Missing PNG file: ${texture.image}`);
            }

            // Get size
            const size = (texture.size as { w: number; h: number }) || { w: 0, h: 0 };

            // Collect frames
            const frames = texture.frames as Record<string, unknown>;
            const frameKeys = Object.keys(frames);

            sheets.push({
                index: i,
                pngPath,
                pngExists,
                image: texture.image as string,
                size,
                frameCount: frameKeys.length,
            });

            allFrameKeys.push(...frameKeys);
        }
    } else {
        // Single atlas format
        const frames = jsonObj.frames as Record<string, unknown>;
        const frameKeys = Object.keys(frames);
        const meta = jsonObj.meta as Record<string, unknown> | undefined;

        const image = (meta?.image as string) || path.basename(jsonPath).replace('.json', '.png');
        const pngPath = path.join(exportDir, image);
        const pngExists = await pathExists(pngPath);

        if (!pngExists) {
            errors.push(`Missing PNG file: ${image}`);
        }

        const size = (meta?.size as { w: number; h: number }) || { w: 0, h: 0 };

        sheets.push({
            index: 0,
            pngPath,
            pngExists,
            image,
            size,
            frameCount: frameKeys.length,
        });

        allFrameKeys.push(...frameKeys);
    }

    // Validate frame count
    const uniqueFrames = new Set(allFrameKeys);
    if (uniqueFrames.size !== expectedFrameCount) {
        errors.push(
            `Expected ${expectedFrameCount} frames, found ${uniqueFrames.size}`
        );
    }

    // Validate duplicate frames across textures
    if (allFrameKeys.length !== uniqueFrames.size) {
        warnings.push(
            `Duplicate frame keys detected: ${allFrameKeys.length} total, ${uniqueFrames.size} unique`
        );
    }

    // Validate frame key format
    const frameKeyPattern = new RegExp(`^${moveId}/\\d{4}$`);
    const invalidKeys = [...uniqueFrames].filter(k => !frameKeyPattern.test(k));

    if (invalidKeys.length > 0) {
        errors.push(
            `Invalid frame keys (expected pattern ${moveId}/XXXX): ${invalidKeys.slice(0, 5).join(', ')}${invalidKeys.length > 5 ? '...' : ''}`
        );
    }

    // Also validate with the general pattern
    const invalidGeneral = [...uniqueFrames].filter(k => !isValidFrameKey(k));
    if (invalidGeneral.length > 0 && invalidKeys.length === 0) {
        errors.push(
            `Frame keys don't match general pattern ${FRAME_KEY_PATTERN}: ${invalidGeneral.slice(0, 5).join(', ')}`
        );
    }

    const totalFrames = uniqueFrames.size;
    const passed = errors.length === 0;

    logger.info({
        event: 'multipack_validation_complete',
        passed,
        isMultipack,
        sheetCount: sheets.length,
        totalFrames,
        errors: errors.length,
        warnings: warnings.length,
    });

    return Result.ok({
        passed,
        isMultipack,
        sheets,
        totalFrames,
        frameKeys: [...uniqueFrames].sort(),
        errors,
        warnings,
    });
}

/**
 * Get all frame keys from a multipack atlas
 *
 * @param jsonPath - Path to the atlas JSON
 * @returns Array of frame keys or empty array on error
 */
export async function getMultipackFrameKeys(jsonPath: string): Promise<string[]> {
    try {
        const content = await fs.readFile(jsonPath, 'utf-8');
        const json = JSON.parse(content);

        if ('textures' in json && Array.isArray(json.textures)) {
            // Multipack format
            const keys: string[] = [];
            for (const texture of json.textures) {
                if (texture.frames) {
                    keys.push(...Object.keys(texture.frames));
                }
            }
            return keys;
        } else if ('frames' in json) {
            // Single format
            return Object.keys(json.frames);
        }

        return [];
    } catch {
        return [];
    }
}

/**
 * Count sheets in a multipack atlas
 *
 * @param jsonPath - Path to the atlas JSON
 * @returns Number of sheets (1 for single, N for multipack)
 */
export async function getSheetCount(jsonPath: string): Promise<number> {
    try {
        const content = await fs.readFile(jsonPath, 'utf-8');
        const json = JSON.parse(content);

        if ('textures' in json && Array.isArray(json.textures)) {
            return json.textures.length;
        }

        return 1; // Single atlas
    } catch {
        return 0;
    }
}
