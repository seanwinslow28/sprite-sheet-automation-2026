/**
 * Run folder manager - creates and manages run directory structure
 * Per Story 2.5: Deterministic folder organization for artifacts
 * Per Story 6.4: Artifact folder organization with rejected handling
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { pathExists, isWritable, writeJsonAtomic } from '../utils/fs-helpers.js';
import { Result } from './config-resolver.js';
import { RUN_FOLDERS, ALL_RUN_FOLDERS, RUN_FILES } from '../domain/constants/run-folders.js';
import { logger } from '../utils/logger.js';

// Use constant from domain (backward compatible)
const RUN_SUBDIRS = ALL_RUN_FOLDERS;

/**
 * Paths to all important locations within a run directory
 */
export interface RunPaths {
    root: string;
    candidates: string;
    approved: string;
    rejected: string;
    audit: string;
    logs: string;
    export: string;
    validation: string;
    stateJson: string;
    lockJson: string;
    anchorAnalysisJson: string;
    summaryJson: string;
    diagnosticJson: string;
    readmeMd: string;
}

/**
 * System error for run folder operations
 */
export interface RunFolderError {
    code: string;
    message: string;
    cause?: unknown;
}

/**
 * Generate a unique run ID
 * Format: YYYYMMDD_HHMMSS_XXXX (timestamp + 4-char random)
 */
export function generateRunId(): string {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    const random = Math.random().toString(36).substring(2, 6);

    return `${year}${month}${day}_${hours}${minutes}${seconds}_${random}`;
}

/**
 * Build RunPaths from a run directory
 */
export function buildRunPaths(runDir: string): RunPaths {
    return {
        root: runDir,
        candidates: join(runDir, RUN_FOLDERS.CANDIDATES),
        approved: join(runDir, RUN_FOLDERS.APPROVED),
        rejected: join(runDir, RUN_FOLDERS.REJECTED),
        audit: join(runDir, RUN_FOLDERS.AUDIT),
        logs: join(runDir, RUN_FOLDERS.LOGS),
        export: join(runDir, RUN_FOLDERS.EXPORT),
        validation: join(runDir, RUN_FOLDERS.VALIDATION),
        stateJson: join(runDir, RUN_FILES.STATE),
        lockJson: join(runDir, RUN_FILES.MANIFEST_LOCK),
        anchorAnalysisJson: join(runDir, RUN_FILES.ANCHOR_ANALYSIS),
        summaryJson: join(runDir, RUN_FILES.SUMMARY),
        diagnosticJson: join(runDir, RUN_FILES.DIAGNOSTIC),
        readmeMd: join(runDir, RUN_FILES.README),
    };
}

/**
 * Create a run folder with all subdirectories
 */
export async function createRunFolder(
    runsDir: string,
    runId: string
): Promise<Result<RunPaths, RunFolderError>> {
    const runDir = join(runsDir, runId);
    const paths = buildRunPaths(runDir);

    try {
        // Check parent directory is writable
        if (await pathExists(runsDir)) {
            if (!(await isWritable(runsDir))) {
                return Result.err({
                    code: 'PIPELINE_FOLDER_CREATE_FAILED',
                    message: `Runs directory is not writable: ${runsDir}`,
                });
            }
        }

        // Create run directory
        await fs.mkdir(runDir, { recursive: true });

        // Create all subdirectories
        for (const subdir of RUN_SUBDIRS) {
            await fs.mkdir(join(runDir, subdir), { recursive: true });
        }

        // Verify all directories exist
        for (const subdir of RUN_SUBDIRS) {
            const subdirPath = join(runDir, subdir);
            if (!(await pathExists(subdirPath))) {
                return Result.err({
                    code: 'PIPELINE_FOLDER_CREATE_FAILED',
                    message: `Failed to create subdirectory: ${subdirPath}`,
                });
            }
        }

        return Result.ok(paths);
    } catch (error) {
        return Result.err({
            code: 'PIPELINE_FOLDER_CREATE_FAILED',
            message: `Failed to create run folder: ${runDir}`,
            cause: error,
        });
    }
}

/**
 * Get candidate file path with consistent naming
 * Format: frame_NNNN_attempt_NN.png (4-digit frame, 2-digit attempt)
 */
export function getCandidatePath(
    runPaths: RunPaths,
    frameIndex: number,
    attemptIndex: number,
    suffix: string = ''
): string {
    const frameStr = String(frameIndex).padStart(4, '0');
    const attemptStr = String(attemptIndex).padStart(2, '0');
    const filename = `frame_${frameStr}_attempt_${attemptStr}${suffix}.png`;
    return join(runPaths.candidates, filename);
}

/**
 * Get approved frame path
 * Format: frame_NNNN.png
 */
export function getApprovedPath(
    runPaths: RunPaths,
    frameIndex: number
): string {
    const frameStr = String(frameIndex).padStart(4, '0');
    return join(runPaths.approved, `frame_${frameStr}.png`);
}

/**
 * Generate rejected frame filename with reason code
 * Format: frame_XXXX_REASON_CODE.png
 */
export function generateRejectedFrameName(
    frameIndex: number,
    reasonCode: string
): string {
    const paddedIndex = String(frameIndex).padStart(4, '0');
    const sanitizedReason = reasonCode.replace(/[^a-zA-Z0-9_]/g, '_');
    return `frame_${paddedIndex}_${sanitizedReason}.png`;
}

/**
 * Get rejected frame path
 */
export function getRejectedPath(
    runPaths: RunPaths,
    frameIndex: number,
    reasonCode: string
): string {
    const filename = generateRejectedFrameName(frameIndex, reasonCode);
    return join(runPaths.rejected, filename);
}

/**
 * Get rejected frame metadata path
 */
export function getRejectedMetadataPath(
    runPaths: RunPaths,
    frameIndex: number,
    reasonCode: string
): string {
    const paddedIndex = String(frameIndex).padStart(4, '0');
    const sanitizedReason = reasonCode.replace(/[^a-zA-Z0-9_]/g, '_');
    return join(runPaths.rejected, `frame_${paddedIndex}_${sanitizedReason}_metadata.json`);
}

/**
 * Rejected frame metadata
 */
export interface RejectedFrameMetadata {
    frame_index: number;
    rejected_at: string;
    reason_code: string;
    reason_message: string;
    attempts: number;
    last_composite_score?: number;
    suggestion?: string;
    original_candidate: string;
}

/**
 * Save rejected frame with metadata
 */
export async function saveRejectedFrame(
    runPaths: RunPaths,
    frameIndex: number,
    reasonCode: string,
    candidatePath: string,
    metadata: Omit<RejectedFrameMetadata, 'frame_index' | 'rejected_at' | 'reason_code' | 'original_candidate'>
): Promise<{ framePath: string; metadataPath: string }> {
    const framePath = getRejectedPath(runPaths, frameIndex, reasonCode);
    const metadataPath = getRejectedMetadataPath(runPaths, frameIndex, reasonCode);

    // Copy candidate to rejected folder
    await fs.copyFile(candidatePath, framePath);

    // Write metadata
    const fullMetadata: RejectedFrameMetadata = {
        frame_index: frameIndex,
        rejected_at: new Date().toISOString(),
        reason_code: reasonCode,
        original_candidate: candidatePath,
        ...metadata,
    };

    await writeJsonAtomic(metadataPath, fullMetadata);

    logger.info({
        event: 'frame_rejected_saved',
        frameIndex,
        reasonCode,
        framePath,
        metadataPath,
    }, `Frame ${frameIndex} rejected: ${reasonCode}`);

    return { framePath, metadataPath };
}

/**
 * README template for run folders
 */
const RUN_README_TEMPLATE = `# Run Artifacts

This folder contains artifacts from a single pipeline run.

## Folder Structure

| Folder | Contents |
|--------|----------|
| \`approved/\` | Frames that passed all quality gates |
| \`rejected/\` | Frames that failed (with reason in filename) |
| \`candidates/\` | All generation attempts for debugging |
| \`audit/\` | Quality metrics and attempt history |
| \`logs/\` | Execution logs |
| \`export/\` | Final atlas (PNG + JSON) |
| \`validation/\` | Phaser micro-test results |

## File Naming

- **Approved**: \`frame_XXXX.png\` (4-digit zero-padded)
- **Rejected**: \`frame_XXXX_REASON_CODE.png\`
- **Candidates**: \`frame_XXXX_attempt_YY.png\`
- **Normalized**: \`*_norm.png\` suffix for post-processed versions

## Key Files

- \`state.json\` - Run progress and current status
- \`summary.json\` - Final statistics (generated on completion)
- \`diagnostic.json\` - Failure analysis (if run stopped)
- \`manifest.lock.json\` - Resolved configuration snapshot
`;

/**
 * Write README to run folder
 */
export async function writeRunReadme(runPaths: RunPaths): Promise<void> {
    await fs.writeFile(runPaths.readmeMd, RUN_README_TEMPLATE, 'utf-8');

    logger.debug({
        event: 'run_readme_written',
        path: runPaths.readmeMd,
    });
}

/**
 * Options for cleanup
 */
export interface CleanupOptions {
    maxAgeDays: number;
    preserveApproved?: boolean;
    dryRun?: boolean;
}

/**
 * Cleanup result
 */
export interface CleanupResult {
    runsScanned: number;
    runsDeleted: number;
    runsPreserved: number;
    spaceFreedBytes: number;
    deletedRuns: string[];
    preservedRuns: string[];
    errors: Array<{ runId: string; error: string }>;
}

/**
 * Get directory size in bytes
 */
async function getDirectorySize(dirPath: string): Promise<number> {
    let size = 0;
    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            const entryPath = join(dirPath, entry.name);
            if (entry.isDirectory()) {
                size += await getDirectorySize(entryPath);
            } else {
                const stats = await fs.stat(entryPath);
                size += stats.size;
            }
        }
    } catch {
        // Ignore errors
    }
    return size;
}

/**
 * Cleanup old runs based on age
 */
export async function cleanupOldRuns(
    runsDir: string,
    options: CleanupOptions
): Promise<CleanupResult> {
    const result: CleanupResult = {
        runsScanned: 0,
        runsDeleted: 0,
        runsPreserved: 0,
        spaceFreedBytes: 0,
        deletedRuns: [],
        preservedRuns: [],
        errors: [],
    };

    const maxAgeMs = options.maxAgeDays * 24 * 60 * 60 * 1000;
    const cutoffTime = Date.now() - maxAgeMs;

    try {
        const entries = await fs.readdir(runsDir, { withFileTypes: true });

        for (const entry of entries) {
            if (!entry.isDirectory() || entry.name === 'README.md') {
                continue;
            }

            result.runsScanned++;
            const runPath = join(runsDir, entry.name);

            try {
                const stats = await fs.stat(runPath);

                if (stats.mtimeMs < cutoffTime) {
                    // Check if we should preserve approved frames
                    if (options.preserveApproved) {
                        const approvedPath = join(runPath, RUN_FOLDERS.APPROVED);
                        if (await pathExists(approvedPath)) {
                            const approvedFiles = await fs.readdir(approvedPath);
                            if (approvedFiles.length > 0) {
                                result.runsPreserved++;
                                result.preservedRuns.push(entry.name);
                                continue;
                            }
                        }
                    }

                    // Calculate size before deletion
                    const size = await getDirectorySize(runPath);

                    if (!options.dryRun) {
                        await fs.rm(runPath, { recursive: true, force: true });
                    }

                    result.runsDeleted++;
                    result.spaceFreedBytes += size;
                    result.deletedRuns.push(entry.name);
                } else {
                    result.runsPreserved++;
                    result.preservedRuns.push(entry.name);
                }
            } catch (error) {
                result.errors.push({
                    runId: entry.name,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
    } catch (error) {
        logger.error({ error, runsDir }, 'Failed to scan runs directory');
    }

    logger.info({
        event: 'cleanup_complete',
        ...result,
        dryRun: options.dryRun,
    }, `Cleanup: ${result.runsDeleted} runs deleted, ${result.runsPreserved} preserved`);

    return result;
}
