/**
 * Tests for run summary generator
 * Per Story 6.3: Summary file generated when run finishes
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import {
    calculateFrameStatistics,
    calculateRateStatistics,
    calculateAttemptStatistics,
    calculateTopFailures,
    calculateTimingStatistics,
    generateRunSummary,
    writeSummary,
    generateAndWriteSummary,
    readSummary,
    type SummaryContext,
} from '../../../src/core/reporting/summary-generator.js';
import type { RunState } from '../../../src/core/state-manager.js';
import type { RunStateWithAttempts } from '../../../src/core/attempt-tracker.js';

/**
 * Create a mock run state for testing
 */
function createMockRunState(overrides: Partial<RunState> = {}): RunState {
    return {
        run_id: 'test-run-001',
        status: 'completed',
        total_frames: 8,
        approved_count: 6,
        failed_count: 2,
        current_frame: 7,
        frame_states: [
            { index: 0, status: 'approved', attempts: 1 },
            { index: 1, status: 'approved', attempts: 2 },
            { index: 2, status: 'approved', attempts: 1 },
            { index: 3, status: 'failed', attempts: 5, last_error: 'HF01_IDENTITY_COLLAPSE' },
            { index: 4, status: 'approved', attempts: 3 },
            { index: 5, status: 'approved', attempts: 1 },
            { index: 6, status: 'approved', attempts: 2 },
            { index: 7, status: 'failed', attempts: 5, last_error: 'HF02_FORMAT_INVALID' },
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...overrides,
    } as RunState;
}

/**
 * Create a mock run state with attempt tracking
 */
function createMockRunStateWithAttempts(): RunStateWithAttempts {
    const baseState = createMockRunState();
    return {
        ...baseState,
        frameAttempts: {
            0: {
                frameIndex: 0,
                attempts: [
                    { attemptNumber: 1, reasonCodes: [], timestamp: new Date().toISOString() },
                ],
            },
            1: {
                frameIndex: 1,
                attempts: [
                    { attemptNumber: 1, reasonCodes: ['SF01_IDENTITY_DRIFT'], timestamp: new Date().toISOString() },
                    { attemptNumber: 2, reasonCodes: [], timestamp: new Date().toISOString() },
                ],
            },
            3: {
                frameIndex: 3,
                attempts: [
                    { attemptNumber: 1, reasonCodes: ['SF01_IDENTITY_DRIFT'], timestamp: new Date().toISOString() },
                    { attemptNumber: 2, reasonCodes: ['SF02_PALETTE_DRIFT'], timestamp: new Date().toISOString() },
                    { attemptNumber: 3, reasonCodes: ['SF01_IDENTITY_DRIFT'], timestamp: new Date().toISOString() },
                    { attemptNumber: 4, reasonCodes: ['HF01_IDENTITY_COLLAPSE'], timestamp: new Date().toISOString() },
                    { attemptNumber: 5, reasonCodes: ['HF01_IDENTITY_COLLAPSE'], timestamp: new Date().toISOString() },
                ],
            },
            4: {
                frameIndex: 4,
                attempts: [
                    { attemptNumber: 1, reasonCodes: ['SF03_TEMPORAL_JITTER'], timestamp: new Date().toISOString() },
                    { attemptNumber: 2, reasonCodes: ['SF01_IDENTITY_DRIFT'], timestamp: new Date().toISOString() },
                    { attemptNumber: 3, reasonCodes: [], timestamp: new Date().toISOString() },
                ],
            },
            7: {
                frameIndex: 7,
                attempts: [
                    { attemptNumber: 1, reasonCodes: ['HF02_FORMAT_INVALID'], timestamp: new Date().toISOString() },
                    { attemptNumber: 2, reasonCodes: ['HF02_FORMAT_INVALID'], timestamp: new Date().toISOString() },
                    { attemptNumber: 3, reasonCodes: ['HF02_FORMAT_INVALID'], timestamp: new Date().toISOString() },
                    { attemptNumber: 4, reasonCodes: ['HF02_FORMAT_INVALID'], timestamp: new Date().toISOString() },
                    { attemptNumber: 5, reasonCodes: ['HF02_FORMAT_INVALID'], timestamp: new Date().toISOString() },
                ],
            },
        },
    } as RunStateWithAttempts;
}

describe('Frame Statistics', () => {
    it('should calculate correct frame counts', () => {
        const state = createMockRunState();
        const stats = calculateFrameStatistics(state);

        expect(stats.total).toBe(8);
        expect(stats.approved).toBe(6);
        expect(stats.attempted).toBe(8); // approved + failed
        expect(stats.pending).toBe(0);
    });

    it('should identify rejected frames with COLLAPSE errors', () => {
        const state = createMockRunState();
        // Frame 3 has COLLAPSE error
        const stats = calculateFrameStatistics(state);

        expect(stats.rejected).toBe(1);
        expect(stats.failed).toBe(1); // failed - rejected
    });

    it('should count pending and in_progress frames', () => {
        const state = createMockRunState({
            frame_states: [
                { index: 0, status: 'approved', attempts: 1 },
                { index: 1, status: 'pending', attempts: 0 },
                { index: 2, status: 'in_progress', attempts: 1 },
                { index: 3, status: 'pending', attempts: 0 },
            ],
            total_frames: 4,
        });

        const stats = calculateFrameStatistics(state);
        expect(stats.pending).toBe(3); // 2 pending + 1 in_progress
        expect(stats.attempted).toBe(1);
    });

    it('should handle empty state', () => {
        const state = createMockRunState({
            frame_states: [],
            total_frames: 0,
        });

        const stats = calculateFrameStatistics(state);
        expect(stats.total).toBe(0);
        expect(stats.approved).toBe(0);
        expect(stats.failed).toBe(0);
    });
});

describe('Rate Statistics', () => {
    it('should calculate completion rate', () => {
        const state = createMockRunState();
        const frames = calculateFrameStatistics(state);
        const rates = calculateRateStatistics(frames, state);

        expect(rates.completion_rate).toBe(0.75); // 6/8
    });

    it('should calculate retry rate', () => {
        const state = createMockRunState();
        const frames = calculateFrameStatistics(state);
        const rates = calculateRateStatistics(frames, state);

        // Frames with retries: 1, 3, 4, 6, 7 = 5 frames
        // Attempted: 8
        expect(rates.retry_rate).toBe(0.625); // 5/8
    });

    it('should calculate success rate', () => {
        const state = createMockRunState();
        const frames = calculateFrameStatistics(state);
        const rates = calculateRateStatistics(frames, state);

        expect(rates.success_rate).toBe(0.75); // 6/8 approved of attempted
    });

    it('should handle zero attempted frames', () => {
        const state = createMockRunState({
            frame_states: [
                { index: 0, status: 'pending', attempts: 0 },
            ],
            total_frames: 1,
        });

        const frames = calculateFrameStatistics(state);
        const rates = calculateRateStatistics(frames, state);

        expect(rates.completion_rate).toBe(0);
        expect(rates.retry_rate).toBe(0);
        expect(rates.success_rate).toBe(0);
    });
});

describe('Attempt Statistics', () => {
    it('should calculate total attempts', () => {
        const state = createMockRunState();
        const stats = calculateAttemptStatistics(state);

        // 1 + 2 + 1 + 5 + 3 + 1 + 2 + 5 = 20
        expect(stats.total).toBe(20);
    });

    it('should calculate average attempts per frame', () => {
        const state = createMockRunState();
        const stats = calculateAttemptStatistics(state);

        expect(stats.per_frame_average).toBe(2.5); // 20/8
    });

    it('should find min and max attempts', () => {
        const state = createMockRunState();
        const stats = calculateAttemptStatistics(state);

        expect(stats.min_per_frame).toBe(1);
        expect(stats.max_per_frame).toBe(5);
    });

    it('should handle frames with zero attempts', () => {
        const state = createMockRunState({
            frame_states: [
                { index: 0, status: 'pending', attempts: 0 },
                { index: 1, status: 'approved', attempts: 2 },
            ],
            total_frames: 2,
        });

        const stats = calculateAttemptStatistics(state);
        expect(stats.total).toBe(2);
        expect(stats.per_frame_average).toBe(2); // Only counts frame with attempts > 0
        expect(stats.min_per_frame).toBe(2);
        expect(stats.max_per_frame).toBe(2);
    });
});

describe('Top Failure Codes', () => {
    it('should extract top failures from state with attempts', () => {
        const state = createMockRunStateWithAttempts();
        const failures = calculateTopFailures(state, 3);

        expect(failures.length).toBeLessThanOrEqual(3);
        expect(failures[0].count).toBeGreaterThan(0);
    });

    it('should sort by count descending', () => {
        const state = createMockRunStateWithAttempts();
        const failures = calculateTopFailures(state);

        for (let i = 1; i < failures.length; i++) {
            expect(failures[i - 1].count).toBeGreaterThanOrEqual(failures[i].count);
        }
    });

    it('should include example frames', () => {
        const state = createMockRunStateWithAttempts();
        const failures = calculateTopFailures(state);

        if (failures.length > 0) {
            expect(Array.isArray(failures[0].example_frames)).toBe(true);
            expect(failures[0].example_frames.length).toBeLessThanOrEqual(3);
        }
    });

    it('should calculate percentage correctly', () => {
        const state = createMockRunStateWithAttempts();
        // Get all failures without limit to verify percentages sum to 100
        const failures = calculateTopFailures(state, 100);

        const totalPercentage = failures.reduce((sum, f) => sum + f.percentage, 0);
        expect(totalPercentage).toBeCloseTo(100, 0);
    });

    it('should fallback to last_error when no detailed attempts', () => {
        const state = createMockRunState(); // No frameAttempts
        const failures = calculateTopFailures(state);

        // Should still find failures from last_error
        expect(failures.length).toBeGreaterThan(0);
        expect(failures.some(f => f.code === 'HF01_IDENTITY_COLLAPSE')).toBe(true);
    });

    it('should limit results to specified count', () => {
        const state = createMockRunStateWithAttempts();
        const failures = calculateTopFailures(state, 2);

        expect(failures.length).toBeLessThanOrEqual(2);
    });
});

describe('Timing Statistics', () => {
    it('should calculate total duration', () => {
        const startTime = new Date('2024-01-01T10:00:00Z');
        const endTime = new Date('2024-01-01T10:05:00Z');
        const frames = { total: 8, attempted: 8, approved: 6, failed: 2, rejected: 0, pending: 0 };
        const attempts = { total: 20, per_frame_average: 2.5, min_per_frame: 1, max_per_frame: 5 };

        const timing = calculateTimingStatistics(startTime, endTime, frames, attempts);

        expect(timing.total_duration_ms).toBe(300000); // 5 minutes
    });

    it('should calculate average per frame', () => {
        const startTime = new Date('2024-01-01T10:00:00Z');
        const endTime = new Date('2024-01-01T10:05:00Z');
        const frames = { total: 8, attempted: 8, approved: 6, failed: 2, rejected: 0, pending: 0 };
        const attempts = { total: 20, per_frame_average: 2.5, min_per_frame: 1, max_per_frame: 5 };

        const timing = calculateTimingStatistics(startTime, endTime, frames, attempts);

        expect(timing.average_per_frame_ms).toBe(37500); // 300000 / 8
    });

    it('should calculate average per attempt', () => {
        const startTime = new Date('2024-01-01T10:00:00Z');
        const endTime = new Date('2024-01-01T10:05:00Z');
        const frames = { total: 8, attempted: 8, approved: 6, failed: 2, rejected: 0, pending: 0 };
        const attempts = { total: 20, per_frame_average: 2.5, min_per_frame: 1, max_per_frame: 5 };

        const timing = calculateTimingStatistics(startTime, endTime, frames, attempts);

        expect(timing.average_per_attempt_ms).toBe(15000); // 300000 / 20
    });

    it('should use provided breakdown', () => {
        const startTime = new Date('2024-01-01T10:00:00Z');
        const endTime = new Date('2024-01-01T10:05:00Z');
        const frames = { total: 8, attempted: 8, approved: 6, failed: 2, rejected: 0, pending: 0 };
        const attempts = { total: 20, per_frame_average: 2.5, min_per_frame: 1, max_per_frame: 5 };
        const breakdown = { generationMs: 200000, auditMs: 50000, exportMs: 30000 };

        const timing = calculateTimingStatistics(startTime, endTime, frames, attempts, breakdown);

        expect(timing.breakdown.generation_ms).toBe(200000);
        expect(timing.breakdown.audit_ms).toBe(50000);
        expect(timing.breakdown.export_ms).toBe(30000);
        expect(timing.breakdown.other_ms).toBe(20000); // 300000 - 200000 - 50000 - 30000
    });

    it('should estimate breakdown when not provided', () => {
        const startTime = new Date('2024-01-01T10:00:00Z');
        const endTime = new Date('2024-01-01T10:05:00Z');
        const frames = { total: 8, attempted: 8, approved: 6, failed: 2, rejected: 0, pending: 0 };
        const attempts = { total: 20, per_frame_average: 2.5, min_per_frame: 1, max_per_frame: 5 };

        const timing = calculateTimingStatistics(startTime, endTime, frames, attempts);

        // Default estimates: 80% generation, 15% audit, 0% export
        expect(timing.breakdown.generation_ms).toBe(240000); // 80% of 300000
        expect(timing.breakdown.audit_ms).toBe(45000); // 15% of 300000
        expect(timing.breakdown.export_ms).toBe(0);
    });

    it('should include ISO timestamps', () => {
        const startTime = new Date('2024-01-01T10:00:00Z');
        const endTime = new Date('2024-01-01T10:05:00Z');
        const frames = { total: 8, attempted: 8, approved: 6, failed: 2, rejected: 0, pending: 0 };
        const attempts = { total: 20, per_frame_average: 2.5, min_per_frame: 1, max_per_frame: 5 };

        const timing = calculateTimingStatistics(startTime, endTime, frames, attempts);

        expect(timing.start_time).toBe('2024-01-01T10:00:00.000Z');
        expect(timing.end_time).toBe('2024-01-01T10:05:00.000Z');
    });
});

describe('Generate Run Summary', () => {
    it('should generate complete summary', () => {
        const context: SummaryContext = {
            runPath: '/test/run',
            state: createMockRunState(),
            finalStatus: 'completed',
            startTime: new Date('2024-01-01T10:00:00Z'),
            endTime: new Date('2024-01-01T10:05:00Z'),
            config: {
                character: 'warrior',
                move: 'attack',
                frameCount: 8,
                maxAttemptsPerFrame: 5,
            },
        };

        const summary = generateRunSummary(context);

        expect(summary.run_id).toBe('test-run-001');
        expect(summary.final_status).toBe('completed');
        expect(summary.frames.total).toBe(8);
        expect(summary.frames.approved).toBe(6);
        expect(summary.config.character).toBe('warrior');
    });

    it('should include export info when provided', () => {
        const context: SummaryContext = {
            runPath: '/test/run',
            state: createMockRunState(),
            finalStatus: 'completed',
            startTime: new Date(),
            exportInfo: {
                atlasPath: '/test/atlas.json',
                sheetCount: 2,
                releaseStatus: 'approved',
                validationPassed: true,
            },
        };

        const summary = generateRunSummary(context);

        expect(summary.export).toBeDefined();
        expect(summary.export?.atlas_path).toBe('/test/atlas.json');
        expect(summary.export?.sheet_count).toBe(2);
        expect(summary.export?.validation_passed).toBe(true);
    });

    it('should use default config when not provided', () => {
        const context: SummaryContext = {
            runPath: '/test/run',
            state: createMockRunState(),
            finalStatus: 'stopped',
            startTime: new Date(),
        };

        const summary = generateRunSummary(context);

        expect(summary.config.character).toBe('unknown');
        expect(summary.config.frame_count).toBe(8);
    });

    it('should use current time as endTime when not provided', () => {
        const startTime = new Date();
        const context: SummaryContext = {
            runPath: '/test/run',
            state: createMockRunState(),
            finalStatus: 'completed',
            startTime,
        };

        const summary = generateRunSummary(context);

        // End time should be close to now
        const endTime = new Date(summary.timing.end_time);
        expect(endTime.getTime()).toBeGreaterThanOrEqual(startTime.getTime());
    });

    it('should include generated_at timestamp', () => {
        const context: SummaryContext = {
            runPath: '/test/run',
            state: createMockRunState(),
            finalStatus: 'completed',
            startTime: new Date(),
        };

        const before = new Date();
        const summary = generateRunSummary(context);
        const after = new Date();

        const generatedAt = new Date(summary.generated_at);
        expect(generatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
        expect(generatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
});

describe('Summary File I/O', () => {
    let testDir: string;

    beforeEach(async () => {
        testDir = path.join(tmpdir(), `summary-test-${Date.now()}`);
        await fs.mkdir(testDir, { recursive: true });
    });

    afterEach(async () => {
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    it('should write summary to summary.json', async () => {
        const context: SummaryContext = {
            runPath: testDir,
            state: createMockRunState(),
            finalStatus: 'completed',
            startTime: new Date(),
        };

        const summary = generateRunSummary(context);
        const summaryPath = await writeSummary(testDir, summary);

        expect(summaryPath).toBe(path.join(testDir, 'summary.json'));

        const exists = await fs.access(summaryPath).then(() => true).catch(() => false);
        expect(exists).toBe(true);
    });

    it('should write valid JSON', async () => {
        const context: SummaryContext = {
            runPath: testDir,
            state: createMockRunState(),
            finalStatus: 'completed',
            startTime: new Date(),
        };

        const summary = generateRunSummary(context);
        await writeSummary(testDir, summary);

        const content = await fs.readFile(path.join(testDir, 'summary.json'), 'utf-8');
        const parsed = JSON.parse(content);

        expect(parsed.run_id).toBe(summary.run_id);
        expect(parsed.final_status).toBe(summary.final_status);
    });

    it('should read summary from file', async () => {
        const context: SummaryContext = {
            runPath: testDir,
            state: createMockRunState(),
            finalStatus: 'completed',
            startTime: new Date(),
        };

        const original = generateRunSummary(context);
        await writeSummary(testDir, original);

        const read = await readSummary(testDir);

        expect(read).not.toBeNull();
        expect(read?.run_id).toBe(original.run_id);
        expect(read?.frames.approved).toBe(original.frames.approved);
    });

    it('should return null for non-existent summary', async () => {
        const read = await readSummary(path.join(testDir, 'nonexistent'));
        expect(read).toBeNull();
    });

    it('should return null for invalid summary file', async () => {
        await fs.writeFile(
            path.join(testDir, 'summary.json'),
            JSON.stringify({ invalid: 'data' })
        );

        const read = await readSummary(testDir);
        expect(read).toBeNull();
    });

    it('should generate and write in one call', async () => {
        const context: SummaryContext = {
            runPath: testDir,
            state: createMockRunState(),
            finalStatus: 'completed',
            startTime: new Date(),
        };

        const summary = await generateAndWriteSummary(context);

        expect(summary.run_id).toBe('test-run-001');

        const read = await readSummary(testDir);
        expect(read?.run_id).toBe(summary.run_id);
    });
});
