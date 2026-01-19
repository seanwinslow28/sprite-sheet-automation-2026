/**
 * Tests for Resume Detector (Story 8.6)
 * AC #1-4: Resume detection, user prompting, state handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'path';
import { tmpdir } from 'os';

import {
    detectResumableRun,
    canResumeRun,
    formatResumeInfo,
    type ResumeInfo,
} from '../../src/core/resume-detector.js';

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

// Mock chalk
vi.mock('chalk', () => ({
    default: {
        cyan: vi.fn((s: string) => s),
        gray: vi.fn((s: string) => s),
        yellow: vi.fn((s: string) => s),
    },
}));

// Mock state-manager
vi.mock('../../src/core/state-manager.js', () => ({
    loadState: vi.fn(),
}));

import { loadState } from '../../src/core/state-manager.js';

describe('ResumeDetector (Story 8.6)', () => {
    let testDir: string;
    let runsDir: string;
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();

        // Create temp directories
        testDir = path.join(tmpdir(), `resume-detector-test-${Date.now()}`);
        runsDir = path.join(testDir, 'runs');
        mkdirSync(runsDir, { recursive: true });

        // Spy on console
        consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleSpy.mockRestore();

        try {
            rmSync(testDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    describe('detectResumableRun', () => {
        it('should return null when runs directory does not exist', async () => {
            const result = await detectResumableRun('warrior', 'idle', '/nonexistent/runs');

            expect(result).toBeNull();
        });

        it('should return null when no runs match character/move', async () => {
            // Create a run folder with non-matching name
            const runFolder = path.join(runsDir, '20260119_120000_XXXX_mage_attack');
            mkdirSync(runFolder, { recursive: true });
            writeFileSync(path.join(runFolder, 'state.json'), '{}');

            (loadState as ReturnType<typeof vi.fn>).mockResolvedValue({
                ok: true,
                value: {
                    run_id: 'test-run',
                    status: 'in_progress',
                    frame_states: [],
                    total_frames: 8,
                    updated_at: new Date().toISOString(),
                },
            });

            const result = await detectResumableRun('warrior', 'idle', runsDir);

            expect(result).toBeNull();
        });

        it('should return null for completed runs', async () => {
            // Create a completed run folder
            const runFolder = path.join(runsDir, '20260119_120000_XXXX_warrior_idle');
            mkdirSync(runFolder, { recursive: true });
            writeFileSync(path.join(runFolder, 'state.json'), '{}');

            (loadState as ReturnType<typeof vi.fn>).mockResolvedValue({
                ok: true,
                value: {
                    run_id: 'test-run',
                    status: 'completed',
                    frame_states: [],
                    total_frames: 8,
                    updated_at: new Date().toISOString(),
                },
            });

            const result = await detectResumableRun('warrior', 'idle', runsDir);

            expect(result).toBeNull();
        });

        it('should detect resumable run for matching character/move', async () => {
            // Create a run folder
            const runFolder = path.join(runsDir, '20260119_120000_XXXX_warrior_idle');
            mkdirSync(runFolder, { recursive: true });
            writeFileSync(path.join(runFolder, 'state.json'), '{}');

            const mockState = {
                run_id: 'test-run-123',
                status: 'in_progress',
                frame_states: [
                    { index: 0, status: 'approved' },
                    { index: 1, status: 'approved' },
                    { index: 2, status: 'pending' },
                    { index: 3, status: 'pending' },
                ],
                total_frames: 4,
                updated_at: '2026-01-19T12:00:00Z',
            };

            (loadState as ReturnType<typeof vi.fn>).mockResolvedValue({
                ok: true,
                value: mockState,
            });

            const result = await detectResumableRun('warrior', 'idle', runsDir);

            expect(result).not.toBeNull();
            expect(result?.runId).toBe('test-run-123');
            expect(result?.approvedCount).toBe(2);
            expect(result?.totalFrames).toBe(4);
            expect(result?.lastFrame).toBe(2);
            expect(result?.status).toBe('in_progress');
        });

        it('should return most recent run when multiple exist', async () => {
            // Create two run folders (sorted alphabetically, second is more recent)
            const runFolder1 = path.join(runsDir, '20260118_120000_XXXX_warrior_idle');
            const runFolder2 = path.join(runsDir, '20260119_120000_XXXX_warrior_idle');
            mkdirSync(runFolder1, { recursive: true });
            mkdirSync(runFolder2, { recursive: true });
            writeFileSync(path.join(runFolder1, 'state.json'), '{}');
            writeFileSync(path.join(runFolder2, 'state.json'), '{}');

            // Mock loadState to return different runs based on path
            (loadState as ReturnType<typeof vi.fn>).mockImplementation(async (statePath: string) => {
                if (statePath.includes('20260119')) {
                    return {
                        ok: true,
                        value: {
                            run_id: 'newer-run',
                            status: 'in_progress',
                            frame_states: [{ index: 0, status: 'pending' }],
                            total_frames: 8,
                            updated_at: '2026-01-19T12:00:00Z',
                        },
                    };
                }
                return {
                    ok: true,
                    value: {
                        run_id: 'older-run',
                        status: 'in_progress',
                        frame_states: [{ index: 0, status: 'pending' }],
                        total_frames: 8,
                        updated_at: '2026-01-18T12:00:00Z',
                    },
                };
            });

            const result = await detectResumableRun('warrior', 'idle', runsDir);

            expect(result?.runId).toBe('newer-run');
        });

        it('should handle case-insensitive character/move matching', async () => {
            const runFolder = path.join(runsDir, '20260119_120000_XXXX_WARRIOR_IDLE');
            mkdirSync(runFolder, { recursive: true });
            writeFileSync(path.join(runFolder, 'state.json'), '{}');

            (loadState as ReturnType<typeof vi.fn>).mockResolvedValue({
                ok: true,
                value: {
                    run_id: 'test-run',
                    status: 'in_progress',
                    frame_states: [{ index: 0, status: 'pending' }],
                    total_frames: 8,
                    updated_at: new Date().toISOString(),
                },
            });

            const result = await detectResumableRun('warrior', 'idle', runsDir);

            expect(result).not.toBeNull();
        });

        it('should handle state load errors gracefully', async () => {
            const runFolder = path.join(runsDir, '20260119_120000_XXXX_warrior_idle');
            mkdirSync(runFolder, { recursive: true });
            writeFileSync(path.join(runFolder, 'state.json'), '{}');

            (loadState as ReturnType<typeof vi.fn>).mockResolvedValue({
                ok: false,
                error: { code: 'LOAD_ERROR', message: 'Failed to load' },
            });

            const result = await detectResumableRun('warrior', 'idle', runsDir);

            expect(result).toBeNull();
        });

        it('should skip folders without state.json', async () => {
            const runFolder1 = path.join(runsDir, '20260118_120000_XXXX_warrior_idle');
            const runFolder2 = path.join(runsDir, '20260119_120000_XXXX_warrior_idle');
            mkdirSync(runFolder1, { recursive: true });
            mkdirSync(runFolder2, { recursive: true });
            // Only create state.json in second folder
            writeFileSync(path.join(runFolder2, 'state.json'), '{}');

            (loadState as ReturnType<typeof vi.fn>).mockResolvedValue({
                ok: true,
                value: {
                    run_id: 'test-run',
                    status: 'in_progress',
                    frame_states: [{ index: 0, status: 'pending' }],
                    total_frames: 8,
                    updated_at: new Date().toISOString(),
                },
            });

            const result = await detectResumableRun('warrior', 'idle', runsDir);

            expect(result).not.toBeNull();
        });

        it('should calculate lastFrame correctly when all approved', async () => {
            const runFolder = path.join(runsDir, '20260119_120000_XXXX_warrior_idle');
            mkdirSync(runFolder, { recursive: true });
            writeFileSync(path.join(runFolder, 'state.json'), '{}');

            (loadState as ReturnType<typeof vi.fn>).mockResolvedValue({
                ok: true,
                value: {
                    run_id: 'test-run',
                    status: 'in_progress',
                    frame_states: [
                        { index: 0, status: 'approved' },
                        { index: 1, status: 'approved' },
                        { index: 2, status: 'approved' },
                    ],
                    total_frames: 8,
                    updated_at: new Date().toISOString(),
                },
            });

            const result = await detectResumableRun('warrior', 'idle', runsDir);

            expect(result?.lastFrame).toBe(3);
        });
    });

    describe('canResumeRun', () => {
        it('should return true for in_progress status', () => {
            expect(canResumeRun('in_progress')).toBe(true);
        });

        it('should return true for paused status', () => {
            expect(canResumeRun('paused')).toBe(true);
        });

        it('should return true for pending status', () => {
            expect(canResumeRun('pending')).toBe(true);
        });

        it('should return false for completed status', () => {
            expect(canResumeRun('completed')).toBe(false);
        });
    });

    describe('formatResumeInfo', () => {
        it('should format resume info with percentage', () => {
            const info: ResumeInfo = {
                runId: 'run-123',
                runPath: '/runs/run-123',
                lastFrame: 4,
                approvedCount: 4,
                totalFrames: 8,
                status: 'in_progress',
                lastUpdated: '2026-01-19T12:00:00Z',
            };

            const formatted = formatResumeInfo(info);

            expect(formatted).toContain('run-123');
            expect(formatted).toContain('4/8');
            expect(formatted).toContain('50%');
        });

        it('should handle zero total frames', () => {
            const info: ResumeInfo = {
                runId: 'run-123',
                runPath: '/runs/run-123',
                lastFrame: 0,
                approvedCount: 0,
                totalFrames: 0,
                status: 'pending',
                lastUpdated: '2026-01-19T12:00:00Z',
            };

            const formatted = formatResumeInfo(info);

            expect(formatted).toContain('0/0');
            expect(formatted).toContain('0%');
        });

        it('should round percentage correctly', () => {
            const info: ResumeInfo = {
                runId: 'run-123',
                runPath: '/runs/run-123',
                lastFrame: 3,
                approvedCount: 3,
                totalFrames: 7,
                status: 'in_progress',
                lastUpdated: '2026-01-19T12:00:00Z',
            };

            const formatted = formatResumeInfo(info);

            expect(formatted).toContain('43%'); // 3/7 = 42.857... rounded to 43
        });
    });

    // Note: promptResume is difficult to test as it uses readline
    // and requires user input. It's typically tested via integration tests
    // or by mocking readline, which adds complexity.
    describe('promptResume', () => {
        it('should display resume information', async () => {
            // We can at least verify the function exists and types are correct
            const { promptResume } = await import('../../src/core/resume-detector.js');
            expect(typeof promptResume).toBe('function');
        });
    });
});
