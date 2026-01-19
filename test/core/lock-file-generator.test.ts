/**
 * Tests for lock file generation (Story 2.2)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
    generateLockFile,
    loadLockFile,
    resolvePaths,
    captureEnvironment,
    calculateFileHash,
    hasManifestChanged,
} from '../../src/core/lock-file-generator.js';
import { createRunFolder, generateRunId } from '../../src/core/run-folder-manager.js';
import { type Manifest } from '../../src/domain/schemas/manifest.js';

// Test manifest fixture
const testManifest: Manifest = {
    identity: {
        character: 'champion_01',
        move: 'idle',
        version: '1.0.0',
        frame_count: 8,
        is_loop: true,
    },
    inputs: {
        anchor: './assets/anchor.png',
        style_refs: ['./assets/style1.png'],
        pose_refs: [],
        guides: [],
    },
    generator: {
        backend: 'gemini',
        model: 'gemini-2.0-flash-exp',
        mode: 'edit',
        seed_policy: 'fixed_then_random',
        max_attempts_per_frame: 4,
        prompts: {
            master: 'Generate frame 0...',
            variation: 'Generate frame {frame_index}...',
            lock: 'Identity rescue...',
            negative: 'blurry',
        },
    },
    canvas: {
        generation_size: 512,
        target_size: 128,
        downsample_method: 'nearest',
        alignment: {
            method: 'contact_patch',
            vertical_lock: true,
            root_zone_ratio: 0.15,
            max_shift_x: 32,
        },
    },
    auditor: {
        hard_gates: {},
        soft_metrics: {},
        weights: {},
    },
    retry: {
        ladder: [],
        stop_conditions: {},
    },
    export: {
        packer_flags: '',
        atlas_format: 'phaser-hash',
    },
};

describe('Lock File Generation (Story 2.2)', () => {
    let testDir: string;
    let manifestPath: string;

    beforeEach(async () => {
        testDir = join(tmpdir(), `banana-lock-test-${Date.now()}`);
        await fs.mkdir(testDir, { recursive: true });

        // Create test manifest file
        manifestPath = join(testDir, 'manifest.yaml');
        await fs.writeFile(manifestPath, JSON.stringify(testManifest, null, 2));

        // Create anchor file referenced in manifest
        await fs.mkdir(join(testDir, 'assets'), { recursive: true });
        await fs.writeFile(join(testDir, 'assets', 'anchor.png'), 'fake png');
        await fs.writeFile(join(testDir, 'assets', 'style1.png'), 'fake png');
    });

    afterEach(async () => {
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch {
            // Ignore
        }
    });

    describe('AC #1: Lock file generated', () => {
        it('should generate manifest.lock.json in run directory', async () => {
            const runId = generateRunId();
            const runsDir = join(testDir, 'runs');
            const folderResult = await createRunFolder(runsDir, runId);
            expect(folderResult.ok).toBe(true);
            if (!folderResult.ok) return;

            const result = await generateLockFile(
                testManifest,
                manifestPath,
                runId,
                folderResult.value
            );

            expect(result.ok).toBe(true);
            if (result.ok) {
                const lockExists = await fs.access(folderResult.value.lockJson)
                    .then(() => true)
                    .catch(() => false);
                expect(lockExists).toBe(true);
            }
        });
    });

    describe('AC #2: Absolute paths resolved', () => {
        it('should resolve relative paths to absolute', () => {
            const resolved = resolvePaths(testManifest, testDir);
            const inputs = resolved.inputs as Record<string, unknown>;

            expect(inputs.anchor).toContain('assets/anchor.png');
            expect((inputs.anchor as string).startsWith('./')).toBe(false);
        });

        it('should use forward slashes for consistency', () => {
            const resolved = resolvePaths(testManifest, testDir);
            const inputs = resolved.inputs as Record<string, unknown>;

            expect((inputs.anchor as string).includes('\\')).toBe(false);
        });
    });

    describe('AC #3 & #4: Adapter and model version recorded', () => {
        it('should capture environment info', () => {
            const env = captureEnvironment(testManifest);

            expect(env.node_version).toBe(process.version);
            expect(env.os).toBe(process.platform);
            expect(env.adapter_version).toBeDefined();
            expect(env.model_id).toBe('gemini-2.0-flash-exp');
        });
    });

    describe('AC #5: Timestamp recorded', () => {
        it('should include run_start timestamp', async () => {
            const runId = generateRunId();
            const runsDir = join(testDir, 'runs');
            const folderResult = await createRunFolder(runsDir, runId);
            expect(folderResult.ok).toBe(true);
            if (!folderResult.ok) return;

            const result = await generateLockFile(
                testManifest,
                manifestPath,
                runId,
                folderResult.value
            );

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.run_start).toMatch(/^\d{4}-\d{2}-\d{2}T/);
            }
        });
    });

    describe('AC #6: Atomic writes', () => {
        it('should persist lock file that can be loaded', async () => {
            const runId = generateRunId();
            const runsDir = join(testDir, 'runs');
            const folderResult = await createRunFolder(runsDir, runId);
            expect(folderResult.ok).toBe(true);
            if (!folderResult.ok) return;

            await generateLockFile(testManifest, manifestPath, runId, folderResult.value);
            const loadResult = await loadLockFile(folderResult.value.lockJson);

            expect(loadResult.ok).toBe(true);
            if (loadResult.ok) {
                expect(loadResult.value.run_id).toBe(runId);
            }
        });
    });

    describe('Manifest hash', () => {
        it('should calculate consistent hash', async () => {
            const hash1 = await calculateFileHash(manifestPath);
            const hash2 = await calculateFileHash(manifestPath);

            expect(hash1).toBe(hash2);
            expect(hash1).toMatch(/^sha256:[a-f0-9]+$/);
        });

        it('should detect manifest changes', async () => {
            const runId = generateRunId();
            const runsDir = join(testDir, 'runs');
            const folderResult = await createRunFolder(runsDir, runId);
            expect(folderResult.ok).toBe(true);
            if (!folderResult.ok) return;

            const genResult = await generateLockFile(
                testManifest,
                manifestPath,
                runId,
                folderResult.value
            );
            expect(genResult.ok).toBe(true);
            if (!genResult.ok) return;

            // Should not be changed
            const unchanged = await hasManifestChanged(manifestPath, genResult.value);
            expect(unchanged).toBe(false);

            // Modify manifest
            await fs.writeFile(manifestPath, JSON.stringify({ ...testManifest, identity: { ...testManifest.identity, version: '2.0.0' } }));

            // Should now be changed
            const changed = await hasManifestChanged(manifestPath, genResult.value);
            expect(changed).toBe(true);
        });
    });
});
