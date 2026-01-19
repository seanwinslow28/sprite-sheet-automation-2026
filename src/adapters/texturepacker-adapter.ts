/**
 * TexturePacker Adapter
 * Story 5.2: Implement TexturePacker Integration with Locked Settings
 *
 * Wraps TexturePacker CLI with locked flags for Phaser compatibility.
 * Uses Execa for cross-platform subprocess execution.
 */

import { execa, ExecaError } from 'execa';
import { promises as fs } from 'fs';
import path from 'path';
import { Result, SystemError } from '../core/result.js';
import { logger } from '../utils/logger.js';
import { writeJsonAtomic, pathExists } from '../utils/fs-helpers.js';
import {
    LOCKED_TEXTUREPACKER_FLAGS,
    ResolvedExportConfig,
} from '../core/export/export-config-resolver.js';

/**
 * Check if an error is an ENOENT (command not found) error
 */
function isENOENT(error: unknown): boolean {
    if (error && typeof error === 'object') {
        // Check various ways ENOENT can manifest
        const err = error as Record<string, unknown>;
        return err.code === 'ENOENT' ||
               (typeof err.message === 'string' && err.message.includes('ENOENT')) ||
               (typeof err.shortMessage === 'string' && err.shortMessage.includes('ENOENT'));
    }
    return false;
}

/**
 * Pack result returned after successful TexturePacker execution
 */
export interface PackResult {
    atlasPath: string;
    sheetPath: string;
    frameCount: number;
    sheetCount: number;
    durationMs: number;
}

/**
 * Options for packing
 */
export interface PackOptions {
    timeoutMs?: number;
    customFlags?: string[];
}

/**
 * TexturePacker version info
 */
export interface VersionInfo {
    version: string;
    path: string;
}

/**
 * TexturePacker execution log entry
 */
export interface TexturePackerLog {
    timestamp: string;
    runId: string;
    input: string;
    output: string;
    command: string;
    args: string[];
    stdout: string;
    stderr: string;
    exitCode: number | null;
    durationMs: number;
}

/** Default timeout for TexturePacker (2 minutes) */
const DEFAULT_TIMEOUT_MS = 120000;

/**
 * Verify TexturePacker is installed and accessible
 *
 * @returns Version info or error if not found
 */
export async function verifyTexturePackerInstallation(): Promise<Result<VersionInfo, SystemError>> {
    try {
        const result = await execa('TexturePacker', ['--version'], {
            timeout: 10000,
            reject: false,
        });

        if (result.exitCode !== 0) {
            return Result.err({
                code: 'DEP_TEXTUREPACKER_NOT_FOUND',
                message: 'TexturePacker not found or not working',
                context: { stderr: result.stderr },
                fix: 'Install TexturePacker from https://www.codeandweb.com/texturepacker',
            });
        }

        // Parse version from output (e.g., "TexturePacker 7.0.0")
        const versionMatch = result.stdout.match(/TexturePacker\s+(\d+\.\d+\.\d+)/);
        const version = versionMatch ? versionMatch[1] : 'unknown';

        return Result.ok({
            version,
            path: 'TexturePacker', // In PATH
        });
    } catch (error) {
        if (isENOENT(error)) {
            return Result.err({
                code: 'DEP_TEXTUREPACKER_NOT_FOUND',
                message: 'TexturePacker is not installed or not in PATH',
                fix: 'Install TexturePacker from https://www.codeandweb.com/texturepacker and ensure it is in your PATH',
            });
        }
        const execError = error as ExecaError;
        return Result.err({
            code: 'DEP_TEXTUREPACKER_ERROR',
            message: `Error checking TexturePacker: ${execError.message}`,
            context: { error: String(error) },
        });
    }
}

/**
 * Count PNG files in a directory
 */
async function countFramesInDir(dirPath: string): Promise<number> {
    try {
        const files = await fs.readdir(dirPath);
        return files.filter(f => f.endsWith('.png')).length;
    } catch {
        return 0;
    }
}

/**
 * Count sheet files (for multipack detection)
 */
async function countSheetFiles(basePath: string): Promise<number> {
    const dir = path.dirname(basePath);
    const baseName = path.basename(basePath, '.png');

    try {
        const files = await fs.readdir(dir);
        // Count files matching pattern: baseName.png, baseName-0.png, baseName-1.png, etc.
        const sheetFiles = files.filter(
            f => f === `${baseName}.png` || f.match(new RegExp(`^${baseName}-\\d+\\.png$`))
        );
        return sheetFiles.length || 1;
    } catch {
        return 1;
    }
}

/**
 * Build TexturePacker command arguments
 *
 * @param inputDir - Directory containing frames to pack
 * @param outputBasePath - Base path for output (without extension)
 * @param exportConfig - Resolved export configuration
 * @param enableMultipack - Whether to enable multipack (default: true for large atlases)
 * @returns Array of command arguments
 */
export function buildTexturePackerArgs(
    inputDir: string,
    outputBasePath: string,
    exportConfig?: ResolvedExportConfig,
    enableMultipack: boolean = true
): string[] {
    // For multipack, use {n} placeholder for sheet numbering
    // TexturePacker will produce: baseName-0.png, baseName-1.png, etc.
    const jsonPath = `${outputBasePath}.json`;
    const pngPath = enableMultipack
        ? `${outputBasePath}-{n}.png`
        : `${outputBasePath}.png`;

    // Start with locked flags
    let flags = [...LOCKED_TEXTUREPACKER_FLAGS];

    // Add multipack if enabled
    if (enableMultipack) {
        flags.push('--multipack');
    }

    // Merge with custom flags if provided
    if (exportConfig?.packerFlags && exportConfig.packerFlags.length > 0) {
        // Custom flags are already merged in exportConfig.packerFlags
        flags = exportConfig.packerFlags;
        // Ensure multipack is still added if enabled
        if (enableMultipack && !flags.includes('--multipack')) {
            flags.push('--multipack');
        }
    }

    return [
        ...flags,
        '--data', jsonPath,
        '--sheet', pngPath,
        inputDir,
    ];
}

/**
 * Pack frames into a texture atlas using TexturePacker
 *
 * @param inputDir - Directory containing frames to pack
 * @param outputBasePath - Base path for output (without extension)
 * @param options - Pack options
 * @returns Pack result or error
 */
export async function packAtlas(
    inputDir: string,
    outputBasePath: string,
    options: PackOptions = {}
): Promise<Result<PackResult, SystemError>> {
    const startTime = Date.now();
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    logger.debug({
        event: 'texturepacker_start',
        inputDir,
        outputBasePath,
        timeoutMs,
    });

    // Verify input directory exists
    if (!(await pathExists(inputDir))) {
        return Result.err({
            code: 'SYS_PATH_NOT_FOUND',
            message: `Input directory does not exist: ${inputDir}`,
            context: { inputDir },
        });
    }

    // Build arguments
    const args = buildTexturePackerArgs(inputDir, outputBasePath);
    const jsonPath = `${outputBasePath}.json`;
    const pngPath = `${outputBasePath}.png`;

    // Ensure output directory exists
    const outputDir = path.dirname(outputBasePath);
    await fs.mkdir(outputDir, { recursive: true });

    logger.debug({
        event: 'texturepacker_invoke',
        command: 'TexturePacker',
        args: args.join(' '),
    });

    try {
        const result = await execa('TexturePacker', args, {
            timeout: timeoutMs,
            reject: false,
            shell: false,
        });

        const durationMs = Date.now() - startTime;

        // Log the execution
        logger.info({
            event: 'texturepacker_complete',
            exitCode: result.exitCode,
            durationMs,
            stdout: result.stdout.substring(0, 500),
        });

        if (result.exitCode !== 0) {
            return Result.err({
                code: 'DEP_TEXTUREPACKER_FAIL',
                message: `TexturePacker failed with exit code ${result.exitCode}`,
                context: {
                    exitCode: result.exitCode,
                    stderr: result.stderr,
                    stdout: result.stdout,
                },
            });
        }

        // Count frames and sheets
        const frameCount = await countFramesInDir(inputDir);
        const sheetCount = await countSheetFiles(pngPath);

        return Result.ok({
            atlasPath: jsonPath,
            sheetPath: pngPath,
            frameCount,
            sheetCount,
            durationMs,
        });
    } catch (error) {
        const execError = error as ExecaError;

        if (execError.timedOut) {
            const durationMs = Date.now() - startTime;
            logger.error({
                event: 'texturepacker_timeout',
                durationMs,
                timeoutMs,
            });

            return Result.err({
                code: 'DEP_TEXTUREPACKER_TIMEOUT',
                message: `TexturePacker timed out after ${timeoutMs}ms`,
                context: { timeoutMs, durationMs },
                fix: 'Try reducing the number of frames or increasing the timeout',
            });
        }

        if (isENOENT(error)) {
            return Result.err({
                code: 'DEP_TEXTUREPACKER_NOT_FOUND',
                message: 'TexturePacker is not installed or not in PATH',
                fix: 'Install TexturePacker from https://www.codeandweb.com/texturepacker',
            });
        }

        return Result.err({
            code: 'DEP_TEXTUREPACKER_ERROR',
            message: `TexturePacker error: ${execError.message}`,
            context: { error: String(error) },
        });
    }
}

/**
 * Pack atlas with full logging to run folder
 *
 * @param inputDir - Directory containing frames to pack
 * @param outputBasePath - Base path for output
 * @param runId - Run identifier for logging
 * @param runsDir - Base runs directory
 * @param options - Pack options
 * @returns Pack result or error
 */
export async function packAtlasWithLogging(
    inputDir: string,
    outputBasePath: string,
    runId: string,
    runsDir: string,
    options: PackOptions = {}
): Promise<Result<PackResult, SystemError>> {
    const startTime = Date.now();
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const args = buildTexturePackerArgs(inputDir, outputBasePath);

    let stdout = '';
    let stderr = '';
    let exitCode: number | null = null;

    try {
        // Ensure output and log directories exist
        const outputDir = path.dirname(outputBasePath);
        const logsDir = path.join(runsDir, runId, 'logs');
        await fs.mkdir(outputDir, { recursive: true });
        await fs.mkdir(logsDir, { recursive: true });

        const result = await execa('TexturePacker', args, {
            timeout: timeoutMs,
            reject: false,
            shell: false,
        });

        stdout = result.stdout;
        stderr = result.stderr;
        exitCode = result.exitCode;

        const durationMs = Date.now() - startTime;

        // Write log file
        const log: TexturePackerLog = {
            timestamp: new Date().toISOString(),
            runId,
            input: inputDir,
            output: outputBasePath,
            command: 'TexturePacker',
            args,
            stdout,
            stderr,
            exitCode,
            durationMs,
        };

        const logPath = path.join(logsDir, 'texturepacker.json');
        await writeJsonAtomic(logPath, log);

        if (result.exitCode !== 0) {
            return Result.err({
                code: 'DEP_TEXTUREPACKER_FAIL',
                message: `TexturePacker failed with exit code ${result.exitCode}`,
                context: { exitCode, stderr, logPath },
            });
        }

        const frameCount = await countFramesInDir(inputDir);
        const sheetCount = await countSheetFiles(`${outputBasePath}.png`);

        return Result.ok({
            atlasPath: `${outputBasePath}.json`,
            sheetPath: `${outputBasePath}.png`,
            frameCount,
            sheetCount,
            durationMs,
        });
    } catch (error) {
        const execError = error as ExecaError;
        const durationMs = Date.now() - startTime;

        // Write error log
        const logsDir = path.join(runsDir, runId, 'logs');
        await fs.mkdir(logsDir, { recursive: true });

        const log: TexturePackerLog = {
            timestamp: new Date().toISOString(),
            runId,
            input: inputDir,
            output: outputBasePath,
            command: 'TexturePacker',
            args,
            stdout,
            stderr: execError.stderr || stderr,
            exitCode,
            durationMs,
        };

        const logPath = path.join(logsDir, 'texturepacker.json');
        await writeJsonAtomic(logPath, log);

        if (execError.timedOut) {
            return Result.err({
                code: 'DEP_TEXTUREPACKER_TIMEOUT',
                message: `TexturePacker timed out after ${timeoutMs}ms`,
                context: { timeoutMs, durationMs, logPath },
                fix: 'Try reducing the number of frames or increasing the timeout',
            });
        }

        if (isENOENT(error)) {
            return Result.err({
                code: 'DEP_TEXTUREPACKER_NOT_FOUND',
                message: 'TexturePacker is not installed or not in PATH',
                fix: 'Install TexturePacker from https://www.codeandweb.com/texturepacker',
            });
        }

        return Result.err({
            code: 'DEP_TEXTUREPACKER_ERROR',
            message: `TexturePacker error: ${execError.message}`,
            context: { error: String(error), logPath },
        });
    }
}
