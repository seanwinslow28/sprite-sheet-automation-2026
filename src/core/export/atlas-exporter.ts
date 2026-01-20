/**
 * Atlas Exporter
 * Story 5.3: Phaser-Compatible Atlas Output
 *
 * Orchestrates frame preparation, TexturePacker invocation, and output validation.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { Result, SystemError } from '../result.js';
import { logger } from '../../utils/logger.js';
import { pathExists } from '../../utils/fs-helpers.js';
import { packAtlasWithLogging } from '../../adapters/texturepacker-adapter.js';
import { prepareFramesForExport, cleanupStagingDirectory } from './frame-preparer.js';
import { validateAtlas, AtlasValidationReport } from './atlas-validator.js';
import { runPreExportValidation, ValidationReport } from './pre-export-validator.js';
import type { Manifest } from '../../domain/schemas/manifest.js';

/**
 * Atlas output paths
 */
export interface AtlasPaths {
    png: string;           // Primary PNG path (first sheet for multipack)
    pngPaths: string[];    // All PNG paths (Critical Bug #2 fix: multipack support)
    json: string;
    name: string;
}

/**
 * Result of atlas export
 */
export interface AtlasExportResult {
    paths: AtlasPaths;
    frameCount: number;
    sheetCount: number;
    preValidation: ValidationReport;
    postValidation: AtlasValidationReport;
    durationMs: number;
}

/**
 * Options for atlas export
 */
export interface ExportOptions {
    skipPreValidation?: boolean;
    skipPostValidation?: boolean;
    cleanupStaging?: boolean;
    timeoutMs?: number;
}

/**
 * Sanitize a string for use in filenames
 */
function sanitizeForFilename(str: string): string {
    return str
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}

/**
 * Generate atlas output paths
 *
 * @param runsDir - Base runs directory
 * @param runId - Run identifier
 * @param character - Character name
 * @param move - Move/animation name
 * @returns Atlas paths
 */
export function generateAtlasPaths(
    runsDir: string,
    runId: string,
    character: string,
    move: string
): AtlasPaths {
    const name = `${sanitizeForFilename(character)}_${sanitizeForFilename(move)}`;
    const exportDir = path.join(runsDir, runId, 'export');

    const pngPath = path.join(exportDir, `${name}.png`);
    return {
        png: pngPath,
        pngPaths: [pngPath],  // Will be updated with actual paths after TexturePacker
        json: path.join(exportDir, `${name}.json`),
        name,
    };
}

/**
 * Export approved frames to Phaser-compatible atlas
 *
 * This orchestrates the full export pipeline:
 * 1. Pre-export validation (Story 5.5)
 * 2. Frame preparation with naming convention (Story 5.1)
 * 3. TexturePacker invocation (Story 5.2)
 * 4. Post-export validation (Story 5.6)
 *
 * @param runId - Run identifier
 * @param manifest - Run manifest
 * @param runsDir - Base runs directory
 * @param options - Export options
 * @returns Export result or error
 */
export async function exportAtlas(
    runId: string,
    manifest: Manifest,
    runsDir: string,
    options: ExportOptions = {}
): Promise<Result<AtlasExportResult, SystemError>> {
    const startTime = Date.now();
    const { character, move } = manifest.identity;

    logger.info({
        event: 'atlas_export_start',
        run_id: runId,
        character,
        move,
    });

    // Resolve paths
    const approvedPath = path.join(runsDir, runId, 'approved');
    const atlasPaths = generateAtlasPaths(runsDir, runId, character, move);

    // Note: Export config resolution (manifest.export) will be wired up
    // in a future iteration to pass custom packer flags to TexturePacker

    // Step 1: Pre-export validation
    let preValidation: ValidationReport;
    if (!options.skipPreValidation) {
        const preValidResult = await runPreExportValidation(approvedPath, manifest, runId);
        if (preValidResult.isErr()) {
            return Result.err(preValidResult.unwrapErr());
        }
        preValidation = preValidResult.unwrap();

        if (preValidation.blocking) {
            logger.error({
                event: 'pre_export_validation_blocked',
                run_id: runId,
                reason: preValidation.blockingReason,
            });
            return Result.err({
                code: 'SYS_PRE_EXPORT_VALIDATION_FAILED',
                message: preValidation.blockingReason || 'Pre-export validation failed',
                context: {
                    summary: preValidation.summary,
                    checks: preValidation.checks.filter(c => !c.passed),
                },
            });
        }
    } else {
        // Create a placeholder validation report
        preValidation = {
            runId,
            validatedAt: new Date().toISOString(),
            approvedPath,
            passed: true,
            summary: { totalChecks: 0, passed: 0, failed: 0, warnings: 0 },
            checks: [],
            blocking: false,
        };
    }

    // Step 2: Prepare frames with naming convention
    const prepareResult = await prepareFramesForExport(approvedPath, {
        runId,
        runsDir,
        moveId: move,
    });

    if (prepareResult.isErr()) {
        return Result.err(prepareResult.unwrapErr());
    }

    const { stagingPath, frameCount } = prepareResult.unwrap();

    // Step 3: Ensure export directory exists
    const exportDir = path.dirname(atlasPaths.png);
    try {
        await fs.mkdir(exportDir, { recursive: true });
    } catch (error) {
        return Result.err({
            code: 'SYS_MKDIR_FAILED',
            message: `Failed to create export directory: ${exportDir}`,
            context: { error: String(error) },
        });
    }

    // Step 4: Call TexturePacker
    const outputBasePath = atlasPaths.png.replace('.png', '');
    const packResult = await packAtlasWithLogging(
        stagingPath,
        outputBasePath,
        runId,
        runsDir,
        { timeoutMs: options.timeoutMs }
    );

    if (packResult.isErr()) {
        // Cleanup staging on failure if requested
        if (options.cleanupStaging) {
            await cleanupStagingDirectory(stagingPath);
        }
        return Result.err(packResult.unwrapErr());
    }

    const pack = packResult.unwrap();

    // Critical Bug #2 fix: Update atlasPaths with actual PNG paths from TexturePacker
    atlasPaths.png = pack.sheetPath;
    atlasPaths.pngPaths = pack.sheetPaths;

    // Step 5: Post-export validation
    let postValidation: AtlasValidationReport;
    if (!options.skipPostValidation) {
        // Use actual primary sheet path from pack result
        const postValidResult = await validateAtlas(atlasPaths.json, pack.sheetPath);
        if (postValidResult.isErr()) {
            return Result.err(postValidResult.unwrapErr());
        }
        postValidation = postValidResult.unwrap();

        if (!postValidation.jsonValid || !postValidation.pngValid) {
            logger.error({
                event: 'post_export_validation_failed',
                run_id: runId,
                errors: postValidation.errors,
            });
            return Result.err({
                code: 'SYS_POST_EXPORT_VALIDATION_FAILED',
                message: 'Atlas validation failed after TexturePacker',
                context: {
                    jsonValid: postValidation.jsonValid,
                    pngValid: postValidation.pngValid,
                    errors: postValidation.errors,
                },
            });
        }
    } else {
        // Create placeholder validation report
        postValidation = {
            jsonValid: true,
            pngValid: true,
            frameKeysValid: true,
            frameDataValid: true,
            metaValid: true,
            errors: [],
            warnings: [],
            frameCount: pack.frameCount,
        };
    }

    // Step 6: Cleanup staging if requested
    if (options.cleanupStaging) {
        await cleanupStagingDirectory(stagingPath);
    }

    const durationMs = Date.now() - startTime;

    logger.info({
        event: 'atlas_export_complete',
        run_id: runId,
        paths: atlasPaths,
        frame_count: frameCount,
        sheet_count: pack.sheetCount,
        duration_ms: durationMs,
    });

    return Result.ok({
        paths: atlasPaths,
        frameCount,
        sheetCount: pack.sheetCount,
        preValidation,
        postValidation,
        durationMs,
    });
}

/**
 * Check if atlas files exist for a run
 *
 * @param runsDir - Base runs directory
 * @param runId - Run identifier
 * @param character - Character name
 * @param move - Move name
 * @returns True if both PNG and JSON exist
 */
export async function atlasExists(
    runsDir: string,
    runId: string,
    character: string,
    move: string
): Promise<boolean> {
    const paths = generateAtlasPaths(runsDir, runId, character, move);
    const pngExists = await pathExists(paths.png);
    const jsonExists = await pathExists(paths.json);
    return pngExists && jsonExists;
}

/**
 * Get atlas info if it exists
 *
 * @param runsDir - Base runs directory
 * @param runId - Run identifier
 * @param character - Character name
 * @param move - Move name
 * @returns Atlas paths and frame count, or null if not found
 */
export async function getAtlasInfo(
    runsDir: string,
    runId: string,
    character: string,
    move: string
): Promise<{ paths: AtlasPaths; frameCount: number } | null> {
    const paths = generateAtlasPaths(runsDir, runId, character, move);

    if (!(await pathExists(paths.json))) {
        return null;
    }

    try {
        const content = await fs.readFile(paths.json, 'utf-8');
        const parsed = JSON.parse(content);

        let frameCount = 0;
        if ('frames' in parsed) {
            frameCount = Object.keys(parsed.frames).length;
        } else if ('textures' in parsed) {
            frameCount = parsed.textures.reduce(
                (sum: number, tex: { frames: object }) =>
                    sum + Object.keys(tex.frames || {}).length,
                0
            );
        }

        return { paths, frameCount };
    } catch {
        return null;
    }
}
