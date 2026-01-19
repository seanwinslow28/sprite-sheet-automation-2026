/**
 * Tests for Progress Reporter (Story 8.8)
 * AC #1-4: Spinner feedback, frame progress, summary, file logging
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import path from 'path';
import { tmpdir } from 'os';

import {
    ProgressReporter,
    createProgressReporter,
    type ProgressReporterOptions,
    type FrameProgressResult,
    type SummaryStats,
} from '../../src/core/progress-reporter.js';

// Mock ora spinner
vi.mock('ora', () => ({
    default: vi.fn().mockImplementation(() => ({
        start: vi.fn().mockReturnThis(),
        succeed: vi.fn().mockReturnThis(),
        fail: vi.fn().mockReturnThis(),
        warn: vi.fn().mockReturnThis(),
        stop: vi.fn().mockReturnThis(),
        text: '',
    })),
}));

// Don't mock chalk - let it work naturally
// The module uses chalk directly, mocking it causes issues with bold() etc.

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

describe('ProgressReporter (Story 8.8)', () => {
    let testDir: string;
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();

        // Create temp directory
        testDir = path.join(tmpdir(), `progress-reporter-test-${Date.now()}`);
        mkdirSync(testDir, { recursive: true });

        // Spy on console.log
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

    describe('Constructor', () => {
        it('should create reporter with default options', () => {
            const reporter = new ProgressReporter();

            expect(reporter.getElapsedMs()).toBeGreaterThanOrEqual(0);
        });

        it('should create reporter with verbose mode', () => {
            const reporter = new ProgressReporter({ verbose: true });

            // Verbose mode should be set - we can test by checking debug output
            reporter.debug('Test message');
            expect(consoleSpy).toHaveBeenCalled();
        });

        it('should create reporter with silent mode', () => {
            const reporter = new ProgressReporter({ silent: true });

            reporter.info('Test message');
            expect(consoleSpy).not.toHaveBeenCalled();
        });

        it('should create logs directory when runPath provided', () => {
            const reporter = new ProgressReporter({ runPath: testDir });

            expect(existsSync(path.join(testDir, 'logs'))).toBe(true);
        });
    });

    describe('createProgressReporter helper', () => {
        it('should create reporter with runPath', () => {
            const reporter = createProgressReporter(testDir, false);

            expect(existsSync(path.join(testDir, 'logs'))).toBe(true);
        });

        it('should create reporter with verbose flag', () => {
            const reporter = createProgressReporter(testDir, true);

            reporter.debug('Test');
            expect(consoleSpy).toHaveBeenCalled();
        });
    });

    describe('Spinner methods', () => {
        let reporter: ProgressReporter;

        beforeEach(() => {
            reporter = new ProgressReporter();
        });

        it('should start spinner with message', () => {
            reporter.start('Loading...');
            // The spinner is mocked, so just verify no errors thrown
            // In real usage, ora spinner or console.log is called
        });

        it('should update spinner text', () => {
            reporter.start('Initial');
            reporter.update('Updated');
            // Should not throw
        });

        it('should succeed and stop spinner', () => {
            reporter.start('Working...');
            reporter.succeed('Done!');
            // The spinner is mocked, just verify no errors thrown
        });

        it('should warn and stop spinner', () => {
            reporter.start('Working...');
            reporter.warn('Warning!');
            // The spinner is mocked, just verify no errors thrown
        });

        it('should fail and stop spinner', () => {
            reporter.start('Working...');
            reporter.fail('Failed!');
            // The spinner is mocked, just verify no errors thrown
        });

        it('should show info message', () => {
            reporter.info('Information');
            expect(consoleSpy).toHaveBeenCalled();
        });

        it('should stop spinner', () => {
            reporter.start('Working...');
            reporter.stop();
            // Should not throw
        });

        it('should not output in silent mode', () => {
            const silentReporter = new ProgressReporter({ silent: true });

            silentReporter.start('Test');
            silentReporter.succeed('Done');
            silentReporter.fail('Error');
            silentReporter.warn('Warning');
            silentReporter.info('Info');

            expect(consoleSpy).not.toHaveBeenCalled();
        });
    });

    describe('Frame progress methods', () => {
        let reporter: ProgressReporter;

        beforeEach(() => {
            reporter = new ProgressReporter();
        });

        it('should show frame generating', () => {
            reporter.frameGenerating(1, 8);
            // The spinner is mocked, just verify no errors thrown
        });

        it('should show approved frame result', () => {
            const result: FrameProgressResult = {
                status: 'approved',
                score: 0.95,
            };

            reporter.frameResult(1, 8, result);
            expect(consoleSpy).toHaveBeenCalled();
        });

        it('should show auto-aligned frame result', () => {
            const result: FrameProgressResult = {
                status: 'approved',
                autoAligned: true,
                driftPixels: 5,
            };

            reporter.frameResult(2, 8, result);
            expect(consoleSpy).toHaveBeenCalled();
        });

        it('should show rejected frame result', () => {
            const result: FrameProgressResult = {
                status: 'rejected',
                reason: 'HF01_FORMAT',
            };

            reporter.frameResult(3, 8, result);
            expect(consoleSpy).toHaveBeenCalled();
        });

        it('should show retrying frame result', () => {
            const result: FrameProgressResult = {
                status: 'retrying',
                attempt: 2,
            };

            reporter.frameResult(4, 8, result);
            // Retrying updates spinner, may not output to console
        });

        it('should show auditing progress', () => {
            reporter.auditing(5);
            // Updates spinner
        });
    });

    describe('Summary methods', () => {
        let reporter: ProgressReporter;

        beforeEach(() => {
            reporter = new ProgressReporter();
        });

        it('should display batch summary', () => {
            const stats: SummaryStats = {
                approved: 7,
                rejected: 1,
                total: 8,
                retryCount: 3,
                durationMs: 45000,
            };

            reporter.summary(stats, 'run-123', '/output/path');

            expect(consoleSpy).toHaveBeenCalled();
            // Should include key stats
            const calls = consoleSpy.mock.calls.flat().join(' ');
            expect(calls).toContain('7');
            expect(calls).toContain('8');
        });

        it('should display director launch message', () => {
            reporter.directorLaunch(3000);

            expect(consoleSpy).toHaveBeenCalled();
            const calls = consoleSpy.mock.calls.flat().join(' ');
            expect(calls).toContain('Director');
            expect(calls).toContain('3000');
        });

        it('should display director commit message', () => {
            reporter.directorCommit();

            expect(consoleSpy).toHaveBeenCalled();
            const calls = consoleSpy.mock.calls.flat().join(' ');
            expect(calls).toContain('committed');
        });

        it('should display director cancel message', () => {
            reporter.directorCancel();

            expect(consoleSpy).toHaveBeenCalled();
            const calls = consoleSpy.mock.calls.flat().join(' ');
            expect(calls).toContain('cancelled');
        });

        it('should display export summary', () => {
            reporter.exportSummary('/atlas.png', '/atlas.json', true);

            expect(consoleSpy).toHaveBeenCalled();
            const calls = consoleSpy.mock.calls.flat().join(' ');
            expect(calls).toContain('Export');
        });

        it('should display validation results', () => {
            const results = [
                { testName: 'Frame Count', passed: true },
                { testName: 'Dimensions', passed: false, message: 'Wrong size' },
            ];

            reporter.validationResults(results);

            expect(consoleSpy).toHaveBeenCalled();
            const calls = consoleSpy.mock.calls.flat().join(' ');
            expect(calls).toContain('Frame Count');
            expect(calls).toContain('Dimensions');
        });

        it('should not output summary in silent mode', () => {
            const silentReporter = new ProgressReporter({ silent: true });

            silentReporter.summary(
                { approved: 8, rejected: 0, total: 8, retryCount: 0, durationMs: 1000 },
                'run-123',
                '/path'
            );

            expect(consoleSpy).not.toHaveBeenCalled();
        });
    });

    describe('Debug methods', () => {
        it('should show debug in verbose mode', () => {
            const reporter = new ProgressReporter({ verbose: true });

            reporter.debug('Debug message', { key: 'value' });

            expect(consoleSpy).toHaveBeenCalled();
            const calls = consoleSpy.mock.calls.flat().join(' ');
            expect(calls).toContain('Debug message');
        });

        it('should not show debug in normal mode', () => {
            const reporter = new ProgressReporter({ verbose: false });

            reporter.debug('Debug message');

            expect(consoleSpy).not.toHaveBeenCalled();
        });

        it('should still log debug to file in normal mode', () => {
            const reporter = new ProgressReporter({ runPath: testDir, verbose: false });

            reporter.debug('Debug message');

            const logPath = path.join(testDir, 'logs', 'pipeline.log');
            expect(existsSync(logPath)).toBe(true);

            const content = readFileSync(logPath, 'utf-8');
            expect(content).toContain('Debug message');
        });
    });

    describe('Utility methods', () => {
        let reporter: ProgressReporter;

        beforeEach(() => {
            reporter = new ProgressReporter();
        });

        it('should format milliseconds', () => {
            expect(reporter.formatDuration(500)).toBe('500ms');
        });

        it('should format seconds', () => {
            expect(reporter.formatDuration(5000)).toBe('5.0s');
            expect(reporter.formatDuration(30500)).toBe('30.5s');
        });

        it('should format minutes', () => {
            expect(reporter.formatDuration(60000)).toBe('1m 0s');
            expect(reporter.formatDuration(90000)).toBe('1m 30s');
            expect(reporter.formatDuration(125000)).toBe('2m 5s');
        });

        it('should track elapsed time', async () => {
            const elapsed1 = reporter.getElapsedMs();

            await new Promise((resolve) => setTimeout(resolve, 50));

            const elapsed2 = reporter.getElapsedMs();
            expect(elapsed2).toBeGreaterThan(elapsed1);
        });

        it('should reset start time', async () => {
            await new Promise((resolve) => setTimeout(resolve, 50));
            const elapsed1 = reporter.getElapsedMs();

            reporter.resetStartTime();
            const elapsed2 = reporter.getElapsedMs();

            expect(elapsed2).toBeLessThan(elapsed1);
        });
    });

    describe('File logging', () => {
        it('should write logs to file when runPath provided', () => {
            const reporter = new ProgressReporter({ runPath: testDir });

            reporter.start('Starting');
            reporter.succeed('Done');
            reporter.fail('Error');
            reporter.warn('Warning');
            reporter.info('Info');

            const logPath = path.join(testDir, 'logs', 'pipeline.log');
            expect(existsSync(logPath)).toBe(true);

            const content = readFileSync(logPath, 'utf-8');
            const lines = content.trim().split('\n');

            expect(lines.length).toBeGreaterThanOrEqual(5);

            // Verify log format
            const parsed = JSON.parse(lines[0]);
            expect(parsed).toHaveProperty('timestamp');
            expect(parsed).toHaveProperty('level');
            expect(parsed).toHaveProperty('message');
        });

        it('should not write logs when no runPath provided', () => {
            const reporter = new ProgressReporter();

            reporter.info('Test');

            const logPath = path.join(testDir, 'logs', 'pipeline.log');
            expect(existsSync(logPath)).toBe(false);
        });

        it('should log summary to file', () => {
            const reporter = new ProgressReporter({ runPath: testDir });

            reporter.summary(
                { approved: 8, rejected: 0, total: 8, retryCount: 2, durationMs: 5000 },
                'run-123',
                '/output'
            );

            const logPath = path.join(testDir, 'logs', 'pipeline.log');
            const content = readFileSync(logPath, 'utf-8');
            expect(content).toContain('SUMMARY');
        });

        it('should log director events to file', () => {
            const reporter = new ProgressReporter({ runPath: testDir });

            reporter.directorLaunch(3000);
            reporter.directorCommit();
            reporter.directorCancel();

            const logPath = path.join(testDir, 'logs', 'pipeline.log');
            const content = readFileSync(logPath, 'utf-8');
            expect(content).toContain('DIRECTOR');
        });

        it('should log validation results to file', () => {
            const reporter = new ProgressReporter({ runPath: testDir });

            reporter.validationResults([
                { testName: 'Test1', passed: true },
            ]);

            const logPath = path.join(testDir, 'logs', 'pipeline.log');
            const content = readFileSync(logPath, 'utf-8');
            expect(content).toContain('VALIDATION');
        });

        it('should log export summary to file', () => {
            const reporter = new ProgressReporter({ runPath: testDir });

            reporter.exportSummary('/atlas.png', '/atlas.json', true);

            const logPath = path.join(testDir, 'logs', 'pipeline.log');
            const content = readFileSync(logPath, 'utf-8');
            expect(content).toContain('EXPORT');
        });
    });

    describe('CI mode', () => {
        const originalCI = process.env.CI;

        beforeEach(() => {
            process.env.CI = 'true';
        });

        afterEach(() => {
            if (originalCI) {
                process.env.CI = originalCI;
            } else {
                delete process.env.CI;
            }
        });

        it('should output plain text in CI mode', () => {
            const reporter = new ProgressReporter();

            reporter.start('Loading...');
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('...'));
        });
    });
});
