/**
 * Run detector - detects and validates existing runs for resumption
 * Per Story 4.7: Implement Idempotent Run Resumption
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { logger } from '../utils/logger.js';
import { loadState, type RunState } from './state-manager.js';
import type { Manifest } from '../domain/schemas/manifest.js';
import { Result } from './config-resolver.js';

/**
 * Information about an existing run
 */
export interface ExistingRun {
    runId: string;
    runPath: string;
    status: 'initializing' | 'in_progress' | 'paused' | 'completed' | 'failed' | 'stopped';
    manifestHash: string;
    approvedFrames: number[];
    pendingFrames: number[];
    lastUpdated: string;
}

/**
 * Manifest change detection result
 */
export interface ManifestChangeResult {
    hashMatch: boolean;
    previousHash: string;
    currentHash: string;
    changedFields?: string[];
}

/**
 * Resume decision
 */
export interface ResumeDecision {
    canResume: boolean;
    reason: string;
    existingRun?: ExistingRun;
    manifestChange?: ManifestChangeResult;
    firstPendingFrame?: number;
}

/**
 * Recursively sort object keys for consistent JSON serialization
 */
function sortObjectKeys(obj: unknown): unknown {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(sortObjectKeys);
    }

    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(obj as Record<string, unknown>).sort();
    for (const key of keys) {
        sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
    }
    return sorted;
}

/**
 * Calculate normalized hash of manifest content
 * Normalizes by sorting keys recursively and trimming whitespace
 */
export function calculateManifestHash(manifest: Manifest): string {
    // Deep sort all keys for consistent hashing
    const sortedManifest = sortObjectKeys(manifest);
    const sortedJson = JSON.stringify(sortedManifest);

    const hash = createHash('sha256');
    hash.update(sortedJson);
    return hash.digest('hex').substring(0, 16);
}

/**
 * Find existing runs matching manifest identity
 */
export async function findExistingRuns(
    runsDir: string,
    manifest: Manifest
): Promise<ExistingRun[]> {
    try {
        const entries = await fs.readdir(runsDir, { withFileTypes: true });
        const runFolders = entries
            .filter(e => e.isDirectory())
            .map(e => e.name)
            .sort()
            .reverse(); // Most recent first

        const matchingRuns: ExistingRun[] = [];

        for (const folder of runFolders) {
            const runPath = join(runsDir, folder);
            const statePath = join(runPath, 'state.json');
            const lockPath = join(runPath, 'manifest.lock.json');

            // Check if state.json exists
            try {
                await fs.access(statePath);
            } catch {
                continue;
            }

            // Load state
            const stateResult = await loadState(statePath);
            if (!stateResult.ok) continue;

            const state = stateResult.value;

            // Match by character and move in the run_id pattern
            // Format: YYYYMMDD_HHMMSS_XXXX_character_move
            const parts = folder.split('_');
            if (parts.length < 5) continue;

            const runCharacter = parts[3];
            const runMove = parts[4];

            if (runCharacter !== manifest.identity.character ||
                runMove !== manifest.identity.move) {
                continue;
            }

            // Load manifest hash from lock file
            let manifestHash = '';
            try {
                const lockContent = await fs.readFile(lockPath, 'utf-8');
                const lockData = JSON.parse(lockContent);
                manifestHash = lockData.manifest_hash ?? '';
            } catch {
                // Lock file might not exist for old runs
            }

            // Calculate approved and pending frames
            const approvedFrames: number[] = [];
            const pendingFrames: number[] = [];

            for (const frame of state.frame_states) {
                if (frame.status === 'approved') {
                    approvedFrames.push(frame.index);
                } else if (frame.status === 'pending') {
                    pendingFrames.push(frame.index);
                }
            }

            matchingRuns.push({
                runId: state.run_id,
                runPath,
                status: state.status as ExistingRun['status'],
                manifestHash,
                approvedFrames,
                pendingFrames,
                lastUpdated: state.updated_at,
            });
        }

        return matchingRuns;
    } catch (error) {
        logger.warn({
            error,
            runsDir,
        }, 'Failed to scan runs directory');
        return [];
    }
}

/**
 * Detect existing run for potential resumption
 */
export async function detectExistingRun(
    runsDir: string,
    manifest: Manifest
): Promise<ExistingRun | null> {
    const runs = await findExistingRuns(runsDir, manifest);

    if (runs.length === 0) {
        return null;
    }

    // Return most recent matching run
    return runs[0];
}

/**
 * Compare manifest hashes
 */
export function compareManifestHash(
    existingRun: ExistingRun,
    manifest: Manifest
): ManifestChangeResult {
    const currentHash = calculateManifestHash(manifest);

    return {
        hashMatch: existingRun.manifestHash === currentHash,
        previousHash: existingRun.manifestHash,
        currentHash,
    };
}

/**
 * Verify approved frames are still valid (not corrupted)
 */
export async function verifyApprovedFrames(
    approvedPath: string
): Promise<{ valid: number[]; corrupted: number[] }> {
    const valid: number[] = [];
    const corrupted: number[] = [];

    try {
        const entries = await fs.readdir(approvedPath);
        const frameFiles = entries.filter(f => f.startsWith('frame_') && f.endsWith('.png'));

        for (const file of frameFiles) {
            // Extract frame index from filename: frame_0003.png -> 3
            const match = file.match(/frame_(\d+)\.png$/);
            if (!match) continue;

            const index = parseInt(match[1], 10);
            const filePath = join(approvedPath, file);

            try {
                // Basic integrity check: file exists and has content
                const stats = await fs.stat(filePath);
                if (stats.size > 0) {
                    valid.push(index);
                } else {
                    corrupted.push(index);
                }
            } catch {
                corrupted.push(index);
            }
        }
    } catch {
        // Directory doesn't exist or can't be read
    }

    return { valid: valid.sort((a, b) => a - b), corrupted: corrupted.sort((a, b) => a - b) };
}

/**
 * Calculate first pending frame for resumption
 */
export function calculateFirstPendingFrame(
    existingRun: ExistingRun,
    totalFrames: number
): number {
    // Start from the first non-approved frame
    for (let i = 0; i < totalFrames; i++) {
        if (!existingRun.approvedFrames.includes(i)) {
            return i;
        }
    }
    return totalFrames; // All frames approved
}

/**
 * Decide whether to resume an existing run
 */
export async function decideResumption(
    runsDir: string,
    manifest: Manifest,
    forceFlag: boolean = false
): Promise<ResumeDecision> {
    // Check for existing run
    const existingRun = await detectExistingRun(runsDir, manifest);

    if (!existingRun) {
        return {
            canResume: false,
            reason: 'No existing run found for this manifest',
        };
    }

    // Check if run is in resumable state
    if (existingRun.status === 'completed') {
        return {
            canResume: false,
            reason: 'Previous run already completed',
            existingRun,
        };
    }

    // Compare manifest hash
    const manifestChange = compareManifestHash(existingRun, manifest);

    if (!manifestChange.hashMatch && !forceFlag) {
        logger.warn({
            previousHash: manifestChange.previousHash,
            currentHash: manifestChange.currentHash,
        }, 'Manifest changed since previous run');

        return {
            canResume: false,
            reason: 'Manifest changed since previous run. Use --force to continue anyway.',
            existingRun,
            manifestChange,
        };
    }

    // Calculate first pending frame
    const firstPendingFrame = calculateFirstPendingFrame(
        existingRun,
        manifest.identity.frame_count
    );

    if (firstPendingFrame >= manifest.identity.frame_count) {
        return {
            canResume: false,
            reason: 'All frames already approved',
            existingRun,
            manifestChange,
        };
    }

    // Verify existing approved frames
    const approvedPath = join(existingRun.runPath, 'approved');
    const verification = await verifyApprovedFrames(approvedPath);

    if (verification.corrupted.length > 0) {
        logger.warn({
            corrupted: verification.corrupted,
        }, 'Some approved frames appear corrupted');
    }

    const message = manifestChange.hashMatch
        ? `Resuming from frame ${firstPendingFrame} (frames 0-${firstPendingFrame - 1} already approved)`
        : `Resuming from frame ${firstPendingFrame} with --force (manifest changed)`;

    logger.info({
        runId: existingRun.runId,
        firstPendingFrame,
        approvedCount: existingRun.approvedFrames.length,
        manifestHashMatch: manifestChange.hashMatch,
    }, message);

    return {
        canResume: true,
        reason: message,
        existingRun,
        manifestChange,
        firstPendingFrame,
    };
}

/**
 * Load state for resumption
 */
export async function loadStateForResumption(
    existingRun: ExistingRun
): Promise<Result<RunState, { code: string; message: string }>> {
    const statePath = join(existingRun.runPath, 'state.json');
    return loadState(statePath);
}
