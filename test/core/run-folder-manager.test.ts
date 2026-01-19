/**
 * Tests for run folder structure and state management (Story 2.5)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
    generateRunId,
    buildRunPaths,
    createRunFolder,
    getCandidatePath,
    getApprovedPath,
} from '../../src/core/run-folder-manager.js';
import {
    initializeState,
    loadState,
    saveState,
    markFrameInProgress,
    markFrameApproved,
    markFrameFailed,
    isRunComplete,
    countApprovedFrames,
    type RunState,
} from '../../src/core/state-manager.js';

describe('Run Folder Structure (Story 2.5)', () => {
    let testDir: string;

    beforeEach(async () => {
        testDir = join(tmpdir(), `banana-test-${Date.now()}`);
        await fs.mkdir(testDir, { recursive: true });
    });

    afterEach(async () => {
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    describe('AC #1: Folder structure created', () => {
        it('should create all required subdirectories', async () => {
            const runId = generateRunId();
            const result = await createRunFolder(testDir, runId);

            expect(result.ok).toBe(true);
            if (result.ok) {
                const paths = result.value;

                // Check all subdirectories exist
                expect(await pathExists(paths.candidates)).toBe(true);
                expect(await pathExists(paths.approved)).toBe(true);
                expect(await pathExists(paths.audit)).toBe(true);
                expect(await pathExists(paths.logs)).toBe(true);
                expect(await pathExists(paths.export)).toBe(true);
            }
        });

        it('should return correct path structure', async () => {
            const runId = '20260118_143052_test';
            const result = await createRunFolder(testDir, runId);

            expect(result.ok).toBe(true);
            if (result.ok) {
                const paths = result.value;
                expect(paths.root).toBe(join(testDir, runId));
                expect(paths.stateJson).toBe(join(testDir, runId, 'state.json'));
                expect(paths.lockJson).toBe(join(testDir, runId, 'manifest.lock.json'));
            }
        });
    });

    describe('AC #2: Candidate naming', () => {
        it('should format candidate path with zero-padded frame and attempt', () => {
            const paths = buildRunPaths('/test/run');

            const path0 = getCandidatePath(paths, 0, 1);
            expect(path0).toContain('frame_0000_attempt_01.png');

            const path12 = getCandidatePath(paths, 12, 3);
            expect(path12).toContain('frame_0012_attempt_03.png');
        });

        it('should support optional suffix for high-res candidates', () => {
            const paths = buildRunPaths('/test/run');

            const pathHiRes = getCandidatePath(paths, 0, 1, '_512');
            expect(pathHiRes).toContain('frame_0000_attempt_01_512.png');
        });
    });

    describe('AC #3: State tracking', () => {
        it('should initialize state with all frames pending', () => {
            const state = initializeState('test_run', 8);

            expect(state.run_id).toBe('test_run');
            expect(state.status).toBe('initializing');
            expect(state.total_frames).toBe(8);
            expect(state.frame_states).toHaveLength(8);
            expect(state.frame_states.every(f => f.status === 'pending')).toBe(true);
        });

        it('should track frame progress', () => {
            let state = initializeState('test_run', 4);

            state = markFrameInProgress(state, 0, 1);
            expect(state.current_frame).toBe(0);
            expect(state.current_attempt).toBe(1);
            expect(state.frame_states[0].status).toBe('in_progress');

            state = markFrameApproved(state, 0, '/path/to/approved.png');
            expect(state.frame_states[0].status).toBe('approved');
            expect(state.frame_states[0].approved_path).toBe('/path/to/approved.png');
        });

        it('should detect run completion', () => {
            let state = initializeState('test_run', 2);
            expect(isRunComplete(state)).toBe(false);

            state = markFrameApproved(state, 0, '/approved0.png');
            expect(isRunComplete(state)).toBe(false);

            state = markFrameApproved(state, 1, '/approved1.png');
            expect(isRunComplete(state)).toBe(true);
        });

        it('should count approved and failed frames', () => {
            let state = initializeState('test_run', 4);
            state = markFrameApproved(state, 0, '/a.png');
            state = markFrameApproved(state, 1, '/b.png');
            state = markFrameFailed(state, 2, 'Max attempts exceeded');

            expect(countApprovedFrames(state)).toBe(2);
        });
    });

    describe('AC #4: Atomic state writes', () => {
        it('should persist and load state correctly', async () => {
            const runId = generateRunId();
            const runsResult = await createRunFolder(testDir, runId);
            expect(runsResult.ok).toBe(true);
            if (!runsResult.ok) return;

            const paths = runsResult.value;
            const state = initializeState(runId, 8);

            // Save state
            const saveResult = await saveState(paths.stateJson, state);
            expect(saveResult.ok).toBe(true);

            // Load state
            const loadResult = await loadState(paths.stateJson);
            expect(loadResult.ok).toBe(true);
            if (loadResult.ok) {
                expect(loadResult.value.run_id).toBe(runId);
                expect(loadResult.value.total_frames).toBe(8);
            }
        });
    });

    describe('Run ID generation', () => {
        it('should generate unique run IDs', () => {
            const id1 = generateRunId();
            const id2 = generateRunId();

            expect(id1).not.toBe(id2);
        });

        it('should follow YYYYMMDD_HHMMSS_XXXX format', () => {
            const id = generateRunId();
            const pattern = /^\d{8}_\d{6}_[a-z0-9]{4}$/;

            expect(pattern.test(id)).toBe(true);
        });
    });
});

// Helper function
async function pathExists(path: string): Promise<boolean> {
    try {
        await fs.access(path);
        return true;
    } catch {
        return false;
    }
}
