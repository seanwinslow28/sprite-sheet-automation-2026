/**
 * Resume detector - User-facing resume detection and prompting
 * Per Story 8.6: Implement Graceful Shutdown and Resume
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline';
import chalk from 'chalk';
import { logger } from '../utils/logger.js';
import { loadState } from './state-manager.js';

/**
 * Resume information for user display
 */
export interface ResumeInfo {
    runId: string;
    runPath: string;
    lastFrame: number;
    approvedCount: number;
    totalFrames: number;
    status: string;
    lastUpdated: string;
}

/**
 * Detect a resumable run for a character/move combination
 */
export async function detectResumableRun(
    character: string,
    move: string,
    runsDir: string
): Promise<ResumeInfo | null> {
    try {
        // Check if runs directory exists
        try {
            await fs.access(runsDir);
        } catch {
            return null;
        }

        const entries = await fs.readdir(runsDir, { withFileTypes: true });

        // Sort by name descending (most recent first based on timestamp prefix)
        const runFolders = entries
            .filter(e => e.isDirectory())
            .map(e => e.name)
            .sort()
            .reverse();

        for (const folder of runFolders) {
            const runPath = join(runsDir, folder);
            const statePath = join(runPath, 'state.json');

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

            // Skip completed runs
            if (state.status === 'completed') continue;

            // Check if this run matches character/move
            // Run ID format: YYYYMMDD_HHMMSS_XXXX_character_move or YYYYMMDD_character_move_XXXX
            const folderLower = folder.toLowerCase();
            const charLower = character.toLowerCase();
            const moveLower = move.toLowerCase().replace(/_/g, '-');

            if (!folderLower.includes(charLower) || !folderLower.includes(moveLower)) {
                continue;
            }

            // Calculate statistics
            const approvedFrames = state.frame_states.filter(f => f.status === 'approved');
            const pendingFrames = state.frame_states.filter(f => f.status === 'pending' || f.status === 'in_progress');

            // Find last active frame
            let lastFrame = 0;
            for (const frame of state.frame_states) {
                if (frame.status === 'pending' || frame.status === 'in_progress') {
                    lastFrame = frame.index;
                    break;
                }
            }

            // If no pending frames, use approved count
            if (pendingFrames.length === 0 && approvedFrames.length > 0) {
                lastFrame = approvedFrames.length;
            }

            return {
                runId: state.run_id,
                runPath,
                lastFrame,
                approvedCount: approvedFrames.length,
                totalFrames: state.total_frames,
                status: state.status,
                lastUpdated: state.updated_at,
            };
        }

        return null;
    } catch (error) {
        logger.warn({
            error: error instanceof Error ? error.message : String(error),
            character,
            move,
        }, 'Failed to detect resumable run');
        return null;
    }
}

/**
 * Prompt user to resume an existing run
 * Returns true if user wants to resume, false otherwise
 */
export async function promptResume(info: ResumeInfo): Promise<boolean> {
    // Display resume information
    console.log('');
    console.log(chalk.cyan('📂 Found existing run:'));
    console.log(chalk.gray(`   Run ID: ${info.runId}`));
    console.log(chalk.gray(`   Progress: ${info.approvedCount}/${info.totalFrames} frames approved`));
    console.log(chalk.gray(`   Last active: Frame ${info.lastFrame}`));
    console.log(chalk.gray(`   Status: ${info.status}`));
    console.log('');

    // Create readline interface for input
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) => {
        rl.question(
            chalk.yellow(`? Resume from Frame ${info.lastFrame}? (Y/n) `),
            (answer) => {
                rl.close();

                const normalizedAnswer = answer.trim().toLowerCase();

                // Default to yes (empty input or 'y'/'yes')
                const shouldResume = normalizedAnswer === '' ||
                    normalizedAnswer === 'y' ||
                    normalizedAnswer === 'yes';

                logger.info({
                    runId: info.runId,
                    resume: shouldResume,
                }, 'User resume decision');

                resolve(shouldResume);
            }
        );
    });
}

/**
 * Check if a run state indicates it can be resumed
 */
export function canResumeRun(status: string): boolean {
    // Can resume if not completed
    return status !== 'completed';
}

/**
 * Format the resume info for display
 */
export function formatResumeInfo(info: ResumeInfo): string {
    const progress = `${info.approvedCount}/${info.totalFrames}`;
    const percentage = info.totalFrames > 0
        ? Math.round((info.approvedCount / info.totalFrames) * 100)
        : 0;

    return `Run ${info.runId}: ${progress} frames (${percentage}% complete)`;
}
