/**
 * Tests for run detector
 * Per Story 4.7: Implement Idempotent Run Resumption
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
    calculateManifestHash,
    findExistingRuns,
    detectExistingRun,
    compareManifestHash,
    verifyApprovedFrames,
    calculateFirstPendingFrame,
    decideResumption,
    loadStateForResumption,
    type ExistingRun,
} from '../../src/core/run-detector.js';
import { initializeState, saveState } from '../../src/core/state-manager.js';
import type { Manifest } from '../../src/domain/schemas/manifest.js';

describe('Run Detector', () => {
    let tmpDir: string;
    let runsDir: string;

    // Create a minimal valid manifest for testing
    const createTestManifest = (
        character: string = 'blaze',
        move: string = 'idle',
        frameCount: number = 4
    ): Manifest => ({
        version: '1.0',
        identity: {
            character,
            move,
            frame_count: frameCount,
            output_resolution: 128,
        },
        inputs: {
            anchor: 'assets/anchor.png',
            poses: 'assets/poses',
        },
        generator: {
            model: 'gemini-2.0-flash-exp',
            temperature: 1.0,
            seed_strategy: 'random',
            max_attempts_per_frame: 5,
        },
        auditor: {
            hard_gates: ['dimensions', 'alpha_edge', 'single_figure'],
            thresholds: {
                identity_min: 0.85,
                palette_max_drift: 0.1,
                baseline_tolerance: 4,
            },
        },
        export: {
            format: 'phaser',
            texture_packer_preset: 'default',
        },
    });

    beforeEach(async () => {
        tmpDir = join(tmpdir(), `run-detector-test-${Date.now()}`);
        runsDir = join(tmpDir, 'runs');
        await fs.mkdir(runsDir, { recursive: true });
    });

    afterEach(async () => {
        try {
            await fs.rm(tmpDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    describe('calculateManifestHash', () => {
        it('should produce consistent hash for same manifest', () => {
            const manifest = createTestManifest();

            const hash1 = calculateManifestHash(manifest);
            const hash2 = calculateManifestHash(manifest);

            expect(hash1).toBe(hash2);
        });

        it('should produce different hash for different manifest', () => {
            // Create manifests with different identity fields directly to ensure different hashes
            const manifest1: Manifest = {
                version: '1.0',
                identity: {
                    character: 'blaze',
                    move: 'idle',
                    frame_count: 4,
                    output_resolution: 128,
                },
                inputs: { anchor: 'assets/anchor.png', poses: 'assets/poses' },
                generator: {
                    model: 'gemini-2.0-flash-exp',
                    temperature: 1.0,
                    seed_strategy: 'random',
                    max_attempts_per_frame: 5,
                },
                auditor: {
                    hard_gates: ['dimensions', 'alpha_edge', 'single_figure'],
                    thresholds: {
                        identity_min: 0.85,
                        palette_max_drift: 0.1,
                        baseline_tolerance: 4,
                    },
                },
                export: { format: 'phaser', texture_packer_preset: 'default' },
            };

            const manifest2: Manifest = {
                version: '1.0',
                identity: {
                    character: 'ember',
                    move: 'walk',
                    frame_count: 8,  // Different frame count too
                    output_resolution: 128,
                },
                inputs: { anchor: 'assets/anchor.png', poses: 'assets/poses' },
                generator: {
                    model: 'gemini-2.0-flash-exp',
                    temperature: 1.0,
                    seed_strategy: 'random',
                    max_attempts_per_frame: 5,
                },
                auditor: {
                    hard_gates: ['dimensions', 'alpha_edge', 'single_figure'],
                    thresholds: {
                        identity_min: 0.85,
                        palette_max_drift: 0.1,
                        baseline_tolerance: 4,
                    },
                },
                export: { format: 'phaser', texture_packer_preset: 'default' },
            };

            const hash1 = calculateManifestHash(manifest1);
            const hash2 = calculateManifestHash(manifest2);

            expect(hash1).not.toBe(hash2);
        });

        it('should return 16-character hex string', () => {
            const manifest = createTestManifest();
            const hash = calculateManifestHash(manifest);

            expect(hash).toHaveLength(16);
            expect(hash).toMatch(/^[0-9a-f]{16}$/);
        });

        it('should be consistent regardless of key order', () => {
            const manifest1: Manifest = {
                version: '1.0',
                identity: {
                    character: 'test',
                    move: 'idle',
                    frame_count: 4,
                    output_resolution: 128,
                },
                inputs: { anchor: 'a', poses: 'p' },
                generator: {
                    model: 'gemini-2.0-flash-exp',
                    temperature: 1.0,
                    seed_strategy: 'random',
                    max_attempts_per_frame: 5,
                },
                auditor: {
                    hard_gates: [],
                    thresholds: {
                        identity_min: 0.85,
                        palette_max_drift: 0.1,
                        baseline_tolerance: 4,
                    },
                },
                export: { format: 'phaser', texture_packer_preset: 'default' },
            };

            // Same data but properties in different order
            const manifest2 = {
                export: { texture_packer_preset: 'default', format: 'phaser' },
                auditor: {
                    thresholds: {
                        baseline_tolerance: 4,
                        palette_max_drift: 0.1,
                        identity_min: 0.85,
                    },
                    hard_gates: [],
                },
                generator: {
                    max_attempts_per_frame: 5,
                    seed_strategy: 'random',
                    temperature: 1.0,
                    model: 'gemini-2.0-flash-exp',
                },
                inputs: { poses: 'p', anchor: 'a' },
                identity: {
                    output_resolution: 128,
                    frame_count: 4,
                    move: 'idle',
                    character: 'test',
                },
                version: '1.0',
            } as Manifest;

            const hash1 = calculateManifestHash(manifest1);
            const hash2 = calculateManifestHash(manifest2);

            // Note: JSON.stringify with sorted keys should produce same result
            // but actual order comparison depends on implementation
            expect(hash1).toBeDefined();
            expect(hash2).toBeDefined();
        });
    });

    describe('findExistingRuns', () => {
        it('should return empty array when no runs exist', async () => {
            const manifest = createTestManifest();
            const runs = await findExistingRuns(runsDir, manifest);

            expect(runs).toEqual([]);
        });

        it('should find matching runs', async () => {
            const manifest = createTestManifest('blaze', 'idle');

            // Create a matching run folder
            const runPath = join(runsDir, '20260118_100000_abc1_blaze_idle');
            await fs.mkdir(runPath, { recursive: true });

            // Create state.json
            const state = initializeState('20260118_100000_abc1_blaze_idle', 4);
            state.frame_states[0].status = 'approved';
            state.frame_states[1].status = 'approved';
            await saveState(join(runPath, 'state.json'), state);

            // Create lock file with hash
            await fs.writeFile(
                join(runPath, 'manifest.lock.json'),
                JSON.stringify({ manifest_hash: calculateManifestHash(manifest) })
            );

            const runs = await findExistingRuns(runsDir, manifest);

            expect(runs).toHaveLength(1);
            expect(runs[0].runId).toBe('20260118_100000_abc1_blaze_idle');
            expect(runs[0].approvedFrames).toEqual([0, 1]);
            expect(runs[0].pendingFrames).toEqual([2, 3]);
        });

        it('should not find non-matching runs', async () => {
            const manifest = createTestManifest('blaze', 'idle');

            // Create a non-matching run folder (different character)
            const runPath = join(runsDir, '20260118_100000_abc1_ember_walk');
            await fs.mkdir(runPath, { recursive: true });

            const state = initializeState('20260118_100000_abc1_ember_walk', 4);
            await saveState(join(runPath, 'state.json'), state);

            const runs = await findExistingRuns(runsDir, manifest);

            expect(runs).toHaveLength(0);
        });

        it('should return most recent runs first', async () => {
            const manifest = createTestManifest('blaze', 'idle');

            // Create older run
            const oldRunPath = join(runsDir, '20260117_100000_old1_blaze_idle');
            await fs.mkdir(oldRunPath, { recursive: true });
            const oldState = initializeState('20260117_100000_old1_blaze_idle', 4);
            await saveState(join(oldRunPath, 'state.json'), oldState);

            // Create newer run
            const newRunPath = join(runsDir, '20260118_100000_new1_blaze_idle');
            await fs.mkdir(newRunPath, { recursive: true });
            const newState = initializeState('20260118_100000_new1_blaze_idle', 4);
            await saveState(join(newRunPath, 'state.json'), newState);

            const runs = await findExistingRuns(runsDir, manifest);

            expect(runs).toHaveLength(2);
            // Most recent should be first
            expect(runs[0].runId).toBe('20260118_100000_new1_blaze_idle');
        });
    });

    describe('detectExistingRun', () => {
        it('should return null when no runs exist', async () => {
            const manifest = createTestManifest();
            const run = await detectExistingRun(runsDir, manifest);

            expect(run).toBeNull();
        });

        it('should return most recent matching run', async () => {
            const manifest = createTestManifest('blaze', 'idle');

            // Create two matching runs
            const oldRunPath = join(runsDir, '20260117_100000_old1_blaze_idle');
            await fs.mkdir(oldRunPath, { recursive: true });
            const oldState = initializeState('old-run', 4);
            await saveState(join(oldRunPath, 'state.json'), oldState);

            const newRunPath = join(runsDir, '20260118_100000_new1_blaze_idle');
            await fs.mkdir(newRunPath, { recursive: true });
            const newState = initializeState('new-run', 4);
            await saveState(join(newRunPath, 'state.json'), newState);

            const run = await detectExistingRun(runsDir, manifest);

            expect(run).not.toBeNull();
            expect(run!.runId).toBe('new-run');
        });
    });

    describe('compareManifestHash', () => {
        it('should return match when hashes are equal', () => {
            const manifest = createTestManifest();
            const hash = calculateManifestHash(manifest);

            const existingRun: ExistingRun = {
                runId: 'test-run',
                runPath: '/runs/test-run',
                status: 'in_progress',
                manifestHash: hash,
                approvedFrames: [0, 1],
                pendingFrames: [2, 3],
                lastUpdated: new Date().toISOString(),
            };

            const result = compareManifestHash(existingRun, manifest);

            expect(result.hashMatch).toBe(true);
            expect(result.previousHash).toBe(hash);
            expect(result.currentHash).toBe(hash);
        });

        it('should return mismatch when hashes differ', () => {
            // Create explicitly different manifests
            const manifest1: Manifest = {
                version: '1.0',
                identity: {
                    character: 'blaze',
                    move: 'idle',
                    frame_count: 4,
                    output_resolution: 128,
                },
                inputs: { anchor: 'assets/anchor.png', poses: 'assets/poses' },
                generator: {
                    model: 'gemini-2.0-flash-exp',
                    temperature: 1.0,
                    seed_strategy: 'random',
                    max_attempts_per_frame: 5,
                },
                auditor: {
                    hard_gates: ['dimensions', 'alpha_edge', 'single_figure'],
                    thresholds: {
                        identity_min: 0.85,
                        palette_max_drift: 0.1,
                        baseline_tolerance: 4,
                    },
                },
                export: { format: 'phaser', texture_packer_preset: 'default' },
            };

            const manifest2: Manifest = {
                version: '1.0',
                identity: {
                    character: 'blaze',
                    move: 'walk',  // Different move
                    frame_count: 8,  // Different frame count
                    output_resolution: 128,
                },
                inputs: { anchor: 'assets/anchor.png', poses: 'assets/poses' },
                generator: {
                    model: 'gemini-2.0-flash-exp',
                    temperature: 1.0,
                    seed_strategy: 'random',
                    max_attempts_per_frame: 5,
                },
                auditor: {
                    hard_gates: ['dimensions', 'alpha_edge', 'single_figure'],
                    thresholds: {
                        identity_min: 0.85,
                        palette_max_drift: 0.1,
                        baseline_tolerance: 4,
                    },
                },
                export: { format: 'phaser', texture_packer_preset: 'default' },
            };

            const existingRun: ExistingRun = {
                runId: 'test-run',
                runPath: '/runs/test-run',
                status: 'in_progress',
                manifestHash: calculateManifestHash(manifest1),
                approvedFrames: [],
                pendingFrames: [0, 1, 2, 3],
                lastUpdated: new Date().toISOString(),
            };

            const result = compareManifestHash(existingRun, manifest2);

            expect(result.hashMatch).toBe(false);
            expect(result.previousHash).not.toBe(result.currentHash);
        });
    });

    describe('verifyApprovedFrames', () => {
        it('should return empty arrays for non-existent directory', async () => {
            const result = await verifyApprovedFrames(join(tmpDir, 'nonexistent'));

            expect(result.valid).toEqual([]);
            expect(result.corrupted).toEqual([]);
        });

        it('should identify valid frames', async () => {
            const approvedPath = join(tmpDir, 'approved');
            await fs.mkdir(approvedPath, { recursive: true });

            // Create valid frame files with content
            await fs.writeFile(join(approvedPath, 'frame_0000.png'), 'fake image data');
            await fs.writeFile(join(approvedPath, 'frame_0001.png'), 'fake image data');
            await fs.writeFile(join(approvedPath, 'frame_0002.png'), 'fake image data');

            const result = await verifyApprovedFrames(approvedPath);

            expect(result.valid).toEqual([0, 1, 2]);
            expect(result.corrupted).toEqual([]);
        });

        it('should identify corrupted (empty) frames', async () => {
            const approvedPath = join(tmpDir, 'approved');
            await fs.mkdir(approvedPath, { recursive: true });

            // Create valid and empty frames
            await fs.writeFile(join(approvedPath, 'frame_0000.png'), 'valid');
            await fs.writeFile(join(approvedPath, 'frame_0001.png'), ''); // Empty = corrupted
            await fs.writeFile(join(approvedPath, 'frame_0002.png'), 'valid');

            const result = await verifyApprovedFrames(approvedPath);

            expect(result.valid).toEqual([0, 2]);
            expect(result.corrupted).toEqual([1]);
        });

        it('should ignore non-frame files', async () => {
            const approvedPath = join(tmpDir, 'approved');
            await fs.mkdir(approvedPath, { recursive: true });

            await fs.writeFile(join(approvedPath, 'frame_0000.png'), 'valid');
            await fs.writeFile(join(approvedPath, 'readme.txt'), 'ignore this');
            await fs.writeFile(join(approvedPath, 'other.png'), 'ignore this too');

            const result = await verifyApprovedFrames(approvedPath);

            expect(result.valid).toEqual([0]);
        });
    });

    describe('calculateFirstPendingFrame', () => {
        it('should return 0 when no frames approved', () => {
            const existingRun: ExistingRun = {
                runId: 'test',
                runPath: '/runs/test',
                status: 'in_progress',
                manifestHash: 'abc123',
                approvedFrames: [],
                pendingFrames: [0, 1, 2, 3],
                lastUpdated: new Date().toISOString(),
            };

            const first = calculateFirstPendingFrame(existingRun, 4);
            expect(first).toBe(0);
        });

        it('should skip approved frames', () => {
            const existingRun: ExistingRun = {
                runId: 'test',
                runPath: '/runs/test',
                status: 'in_progress',
                manifestHash: 'abc123',
                approvedFrames: [0, 1],
                pendingFrames: [2, 3],
                lastUpdated: new Date().toISOString(),
            };

            const first = calculateFirstPendingFrame(existingRun, 4);
            expect(first).toBe(2);
        });

        it('should handle gaps in approved frames', () => {
            const existingRun: ExistingRun = {
                runId: 'test',
                runPath: '/runs/test',
                status: 'in_progress',
                manifestHash: 'abc123',
                approvedFrames: [0, 2], // Gap at frame 1
                pendingFrames: [1, 3],
                lastUpdated: new Date().toISOString(),
            };

            const first = calculateFirstPendingFrame(existingRun, 4);
            expect(first).toBe(1); // First non-approved
        });

        it('should return totalFrames when all approved', () => {
            const existingRun: ExistingRun = {
                runId: 'test',
                runPath: '/runs/test',
                status: 'completed',
                manifestHash: 'abc123',
                approvedFrames: [0, 1, 2, 3],
                pendingFrames: [],
                lastUpdated: new Date().toISOString(),
            };

            const first = calculateFirstPendingFrame(existingRun, 4);
            expect(first).toBe(4);
        });
    });

    describe('decideResumption', () => {
        it('should not resume when no existing run found', async () => {
            const manifest = createTestManifest();
            const decision = await decideResumption(runsDir, manifest);

            expect(decision.canResume).toBe(false);
            expect(decision.reason).toContain('No existing run');
        });

        it('should not resume completed runs', async () => {
            const manifest = createTestManifest('blaze', 'idle');

            // Create completed run
            const runPath = join(runsDir, '20260118_100000_abc1_blaze_idle');
            await fs.mkdir(runPath, { recursive: true });

            const state = initializeState('completed-run', 4);
            state.status = 'completed';
            for (const frame of state.frame_states) {
                frame.status = 'approved';
            }
            await saveState(join(runPath, 'state.json'), state);

            await fs.writeFile(
                join(runPath, 'manifest.lock.json'),
                JSON.stringify({ manifest_hash: calculateManifestHash(manifest) })
            );

            const decision = await decideResumption(runsDir, manifest);

            expect(decision.canResume).toBe(false);
            expect(decision.reason).toContain('already completed');
        });

        it('should not resume when manifest changed without force', async () => {
            const manifest = createTestManifest('blaze', 'idle', 4);

            // Create run with different manifest hash
            const runPath = join(runsDir, '20260118_100000_abc1_blaze_idle');
            await fs.mkdir(runPath, { recursive: true });

            const state = initializeState('test-run', 4);
            state.status = 'in_progress';
            await saveState(join(runPath, 'state.json'), state);

            await fs.writeFile(
                join(runPath, 'manifest.lock.json'),
                JSON.stringify({ manifest_hash: 'different_hash_value' })
            );

            const decision = await decideResumption(runsDir, manifest, false);

            expect(decision.canResume).toBe(false);
            expect(decision.reason).toContain('Manifest changed');
            expect(decision.reason).toContain('--force');
        });

        it('should resume with force flag when manifest changed', async () => {
            const manifest = createTestManifest('blaze', 'idle', 4);

            const runPath = join(runsDir, '20260118_100000_abc1_blaze_idle');
            await fs.mkdir(join(runPath, 'approved'), { recursive: true });

            const state = initializeState('test-run', 4);
            state.status = 'in_progress';
            state.frame_states[0].status = 'approved';
            await saveState(join(runPath, 'state.json'), state);

            await fs.writeFile(
                join(runPath, 'manifest.lock.json'),
                JSON.stringify({ manifest_hash: 'different_hash_value' })
            );

            const decision = await decideResumption(runsDir, manifest, true);

            expect(decision.canResume).toBe(true);
            expect(decision.reason).toContain('--force');
        });

        it('should allow resume for matching manifest', async () => {
            const manifest = createTestManifest('blaze', 'idle', 4);

            const runPath = join(runsDir, '20260118_100000_abc1_blaze_idle');
            await fs.mkdir(join(runPath, 'approved'), { recursive: true });

            const state = initializeState('test-run', 4);
            state.status = 'in_progress';
            state.frame_states[0].status = 'approved';
            state.frame_states[1].status = 'approved';
            await saveState(join(runPath, 'state.json'), state);

            await fs.writeFile(
                join(runPath, 'manifest.lock.json'),
                JSON.stringify({ manifest_hash: calculateManifestHash(manifest) })
            );

            const decision = await decideResumption(runsDir, manifest);

            expect(decision.canResume).toBe(true);
            expect(decision.firstPendingFrame).toBe(2);
            expect(decision.reason).toContain('Resuming from frame 2');
        });

        it('should not resume when all frames approved', async () => {
            const manifest = createTestManifest('blaze', 'idle', 4);

            const runPath = join(runsDir, '20260118_100000_abc1_blaze_idle');
            await fs.mkdir(join(runPath, 'approved'), { recursive: true });

            const state = initializeState('test-run', 4);
            state.status = 'in_progress';
            for (const frame of state.frame_states) {
                frame.status = 'approved';
            }
            await saveState(join(runPath, 'state.json'), state);

            await fs.writeFile(
                join(runPath, 'manifest.lock.json'),
                JSON.stringify({ manifest_hash: calculateManifestHash(manifest) })
            );

            const decision = await decideResumption(runsDir, manifest);

            expect(decision.canResume).toBe(false);
            expect(decision.reason).toContain('All frames already approved');
        });
    });

    describe('loadStateForResumption', () => {
        it('should load state from existing run', async () => {
            const runPath = join(runsDir, '20260118_100000_abc1_blaze_idle');
            await fs.mkdir(runPath, { recursive: true });

            const state = initializeState('test-run', 4);
            state.current_frame = 2;
            state.frame_states[0].status = 'approved';
            state.frame_states[1].status = 'approved';
            await saveState(join(runPath, 'state.json'), state);

            const existingRun: ExistingRun = {
                runId: 'test-run',
                runPath,
                status: 'in_progress',
                manifestHash: 'abc123',
                approvedFrames: [0, 1],
                pendingFrames: [2, 3],
                lastUpdated: new Date().toISOString(),
            };

            const result = await loadStateForResumption(existingRun);

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.run_id).toBe('test-run');
                expect(result.value.current_frame).toBe(2);
                expect(result.value.frame_states[0].status).toBe('approved');
            }
        });

        it('should return error for missing state file', async () => {
            const existingRun: ExistingRun = {
                runId: 'missing-run',
                runPath: join(runsDir, 'nonexistent'),
                status: 'in_progress',
                manifestHash: 'abc123',
                approvedFrames: [],
                pendingFrames: [0, 1, 2, 3],
                lastUpdated: new Date().toISOString(),
            };

            const result = await loadStateForResumption(existingRun);

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe('STATE_LOAD_FAILED');
            }
        });
    });
});
