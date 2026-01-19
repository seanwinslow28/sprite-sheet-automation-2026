/**
 * Frame Preparer - Stages approved frames for TexturePacker export
 * Implements Story 5.1: Deterministic Frame Naming Convention
 */

import { promises as fs } from 'fs';
import path from 'path';
import { Result, SystemError } from '../result.js';
import {
    generateFrameName,
    createFrameMapping,
    createFrameMappingLog,
    toExternalMappingFormat,
    FrameMappingEntry,
    FrameMappingLog,
} from '../../utils/frame-naming.js';
import { writeJsonAtomic, pathExists } from '../../utils/fs-helpers.js';
import { logger } from '../../utils/logger.js';

/**
 * Frame preparation result
 */
export interface FramePreparationResult {
    stagingPath: string;
    mappingLog: FrameMappingLog;
    frameCount: number;
}

/**
 * Context for frame preparation
 */
export interface FramePreparerContext {
    runId: string;
    runsDir: string;
    moveId: string;
}

/**
 * Prepare approved frames for export by copying them to a staging folder
 * with Phaser-compatible naming (4-digit zero padding)
 *
 * @param approvedPath - Path to the approved frames folder
 * @param context - Preparation context with run/move info
 * @returns Result with staging path and mapping log
 */
export async function prepareFramesForExport(
    approvedPath: string,
    context: FramePreparerContext
): Promise<Result<FramePreparationResult, SystemError>> {
    const { runId, runsDir, moveId } = context;

    logger.info({
        event: 'frame_preparation_start',
        run_id: runId,
        move_id: moveId,
        approved_path: approvedPath,
    });

    // Verify approved path exists
    if (!(await pathExists(approvedPath))) {
        return Result.err({
            code: 'SYS_PATH_NOT_FOUND',
            message: `Approved frames path does not exist: ${approvedPath}`,
            context: { approvedPath },
        });
    }

    // Create staging directory
    const stagingPath = path.join(runsDir, runId, 'export_staging', moveId);
    try {
        await fs.mkdir(stagingPath, { recursive: true });
    } catch (error) {
        return Result.err({
            code: 'SYS_MKDIR_FAILED',
            message: `Failed to create staging directory: ${stagingPath}`,
            context: { stagingPath, error: String(error) },
        });
    }

    // List approved frames (sorted for determinism)
    let approvedFiles: string[];
    try {
        const files = await fs.readdir(approvedPath);
        approvedFiles = files
            .filter(f => f.endsWith('.png'))
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    } catch (error) {
        return Result.err({
            code: 'SYS_READDIR_FAILED',
            message: `Failed to read approved directory: ${approvedPath}`,
            context: { approvedPath, error: String(error) },
        });
    }

    if (approvedFiles.length === 0) {
        return Result.err({
            code: 'SYS_NO_FRAMES',
            message: `No PNG frames found in approved directory: ${approvedPath}`,
            context: { approvedPath },
        });
    }

    // Copy frames with new naming convention
    const mappings: FrameMappingEntry[] = [];

    for (let i = 0; i < approvedFiles.length; i++) {
        const originalFile = approvedFiles[i];
        const originalPath = path.join(approvedPath, originalFile);
        const newName = `${generateFrameName(moveId, i).replace('/', '_')}.png`;
        const newPath = path.join(stagingPath, newName);

        try {
            await fs.copyFile(originalPath, newPath);
            mappings.push(createFrameMapping(originalPath, moveId, i));
        } catch (error) {
            return Result.err({
                code: 'SYS_COPY_FAILED',
                message: `Failed to copy frame: ${originalFile}`,
                context: {
                    originalPath,
                    newPath,
                    error: String(error),
                },
            });
        }
    }

    // Create mapping log
    const mappingLog = createFrameMappingLog(runId, moveId, mappings);

    // Write mapping log to disk
    const mappingLogPath = path.join(runsDir, runId, 'export', 'frame_mapping.json');
    try {
        await writeJsonAtomic(mappingLogPath, toExternalMappingFormat(mappingLog));
    } catch (error) {
        return Result.err({
            code: 'SYS_WRITE_FAILED',
            message: `Failed to write frame mapping log: ${mappingLogPath}`,
            context: { mappingLogPath, error: String(error) },
        });
    }

    logger.info({
        event: 'frame_preparation_complete',
        run_id: runId,
        move_id: moveId,
        staging_path: stagingPath,
        frame_count: approvedFiles.length,
    });

    return Result.ok({
        stagingPath,
        mappingLog,
        frameCount: approvedFiles.length,
    });
}

/**
 * Clean up staging directory after export
 *
 * @param stagingPath - Path to staging directory
 * @returns Result indicating success or failure
 */
export async function cleanupStagingDirectory(
    stagingPath: string
): Promise<Result<void, SystemError>> {
    try {
        await fs.rm(stagingPath, { recursive: true, force: true });
        logger.debug({
            event: 'staging_cleanup',
            path: stagingPath,
        });
        return Result.ok(undefined);
    } catch (error) {
        return Result.err({
            code: 'SYS_CLEANUP_FAILED',
            message: `Failed to clean up staging directory: ${stagingPath}`,
            context: { stagingPath, error: String(error) },
        });
    }
}

/**
 * Get the expected staging path for a run
 *
 * @param runsDir - Base runs directory
 * @param runId - Run identifier
 * @param moveId - Move identifier
 * @returns Full staging path
 */
export function getStagingPath(runsDir: string, runId: string, moveId: string): string {
    return path.join(runsDir, runId, 'export_staging', moveId);
}

/**
 * Get the expected export path for a run
 *
 * @param runsDir - Base runs directory
 * @param runId - Run identifier
 * @returns Full export path
 */
export function getExportPath(runsDir: string, runId: string): string {
    return path.join(runsDir, runId, 'export');
}
