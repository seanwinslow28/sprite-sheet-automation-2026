/**
 * Tests for status reporter
 * Per Story 4.5: Implement Run Status Reporting
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    calculateRunMetrics,
    createInProgressStatus,
    createCompletedStatus,
    createStoppedStatus,
    createFailedStatus,
    formatStatusForCLI,
    getStatusColor,
    logStatus,
} from '../../src/core/status-reporter.js';
import {
    initializeAttemptTracking,
    recordAttempt,
    type RunStateWithAttempts,
} from '../../src/core/attempt-tracker.js';
import { initializeState } from '../../src/core/state-manager.js';
import type { StopReason } from '../../src/core/stop-condition-evaluator.js';
import {
    isInProgressDetails,
    isCompletedDetails,
    isStoppedDetails,
    isFailedDetails,
} from '../../src/domain/types/run-status.js';

describe('Status Reporter', () => {
    let state: RunStateWithAttempts;

    beforeEach(() => {
        const baseState = initializeState('test-run', 4);
        state = initializeAttemptTracking(baseState, 4);
    });

    describe('calculateRunMetrics', () => {
        it('should calculate metrics for empty state', () => {
            const metrics = calculateRunMetrics(state);

            expect(metrics.totalFrames).toBe(4);
            expect(metrics.framesCompleted).toBe(0);
            expect(metrics.framesFailed).toBe(0);
            expect(metrics.framesRemaining).toBe(4);
            expect(metrics.totalAttempts).toBe(0);
            expect(metrics.retryRate).toBe(0);
            expect(metrics.rejectRate).toBe(0);
        });

        it('should calculate metrics after some attempts', () => {
            // Frame 0: approved on first try
            state = recordAttempt(state, 0, {
                timestamp: new Date().toISOString(),
                promptHash: 'a',
                result: 'passed',
                reasonCodes: [],
                durationMs: 1000,
            });
            state.frameAttempts[0].finalStatus = 'approved';

            // Frame 1: approved on second try
            state = recordAttempt(state, 1, {
                timestamp: new Date().toISOString(),
                promptHash: 'b1',
                result: 'soft_fail',
                reasonCodes: ['SF01'],
                durationMs: 1000,
            });
            state = recordAttempt(state, 1, {
                timestamp: new Date().toISOString(),
                promptHash: 'b2',
                result: 'passed',
                reasonCodes: [],
                durationMs: 1000,
            });
            state.frameAttempts[1].finalStatus = 'approved';

            // Frame 2: failed
            state.frameAttempts[2].finalStatus = 'failed';

            const metrics = calculateRunMetrics(state);

            expect(metrics.framesCompleted).toBe(2);
            expect(metrics.framesFailed).toBe(1);
            expect(metrics.framesRemaining).toBe(1);
            expect(metrics.totalAttempts).toBe(3);
            // 1 of 2 attempted frames had retries
            expect(metrics.retryRate).toBeCloseTo(0.5);
            // 1 of 2 attempted frames failed
            expect(metrics.rejectRate).toBeCloseTo(0.5);
        });

        it('should handle rejected frames', () => {
            state.frameAttempts[0].finalStatus = 'rejected';
            state.frameAttempts[1].finalStatus = 'rejected';

            const metrics = calculateRunMetrics(state);

            expect(metrics.framesFailed).toBe(2);
        });
    });

    describe('createInProgressStatus', () => {
        it('should create in-progress status with generating action', () => {
            const startTime = new Date(Date.now() - 60000); // 1 minute ago
            const status = createInProgressStatus(state, 'Generating', startTime);

            expect(status.status).toBe('in-progress');
            expect(status.reasonCode).toBe('GENERATING');
            expect(status.message).toContain('Generating');
            expect(status.timestamp).toBeDefined();

            expect(isInProgressDetails(status.details)).toBe(true);
            if (isInProgressDetails(status.details)) {
                expect(status.details.currentFrameIndex).toBe(0);
                expect(status.details.currentAttempt).toBe(0);
                expect(status.details.elapsedTimeMs).toBeGreaterThan(0);
                expect(status.details.currentAction).toBe('Generating');
            }
        });

        it('should create in-progress status with auditing action', () => {
            const startTime = new Date();
            const status = createInProgressStatus(state, 'Auditing frame', startTime);

            expect(status.reasonCode).toBe('AUDITING');
        });

        it('should create in-progress status with retry action', () => {
            const startTime = new Date();
            const status = createInProgressStatus(state, 'Retrying with IDENTITY_RESCUE', startTime);

            expect(status.reasonCode).toBe('RETRYING');
        });

        it('should estimate remaining time based on progress', () => {
            // Record an attempt
            state = recordAttempt(state, 0, {
                timestamp: new Date().toISOString(),
                promptHash: 'a',
                result: 'passed',
                reasonCodes: [],
                durationMs: 1000,
            });
            state.frameAttempts[0].finalStatus = 'approved';

            const startTime = new Date(Date.now() - 5000); // 5 seconds ago
            const status = createInProgressStatus(state, 'Generating', startTime);

            if (isInProgressDetails(status.details)) {
                // Should estimate based on average time per frame
                expect(status.details.estimatedRemainingMs).toBeDefined();
            }
        });
    });

    describe('createCompletedStatus', () => {
        it('should create completed status with all frames approved', () => {
            // Mark all frames approved
            for (let i = 0; i < 4; i++) {
                state = recordAttempt(state, i, {
                    timestamp: new Date().toISOString(),
                    promptHash: `${i}`,
                    result: 'passed',
                    reasonCodes: [],
                    durationMs: 1000,
                });
                state.frameAttempts[i].finalStatus = 'approved';
            }

            const startTime = new Date(Date.now() - 60000);
            const status = createCompletedStatus(
                state,
                startTime,
                'runs/test/export',
                ['blaze_idle.png', 'blaze_idle.json'],
                true
            );

            expect(status.status).toBe('completed');
            expect(status.reasonCode).toBe('ALL_FRAMES_APPROVED');
            expect(status.message).toContain('All 4 frames approved');

            expect(isCompletedDetails(status.details)).toBe(true);
            if (isCompletedDetails(status.details)) {
                expect(status.details.successRate).toBe(1);
                expect(status.details.totalDurationMs).toBeGreaterThan(0);
                expect(status.details.exportLocation).toBe('runs/test/export');
                expect(status.details.atlasFiles).toEqual(['blaze_idle.png', 'blaze_idle.json']);
                expect(status.details.validationPassed).toBe(true);
            }
        });

        it('should create partial success status when some frames failed', () => {
            // 2 approved, 2 failed
            for (let i = 0; i < 2; i++) {
                state.frameAttempts[i].finalStatus = 'approved';
            }
            for (let i = 2; i < 4; i++) {
                state.frameAttempts[i].finalStatus = 'failed';
            }

            const startTime = new Date();
            const status = createCompletedStatus(state, startTime);

            expect(status.reasonCode).toBe('PARTIAL_SUCCESS');
            expect(status.message).toContain('2/4');
            expect(status.message).toContain('2 failed');
        });

        it('should calculate correct success rate', () => {
            // 3 approved, 1 failed
            for (let i = 0; i < 3; i++) {
                state.frameAttempts[i].finalStatus = 'approved';
            }
            state.frameAttempts[3].finalStatus = 'failed';

            const status = createCompletedStatus(state, new Date());

            if (isCompletedDetails(status.details)) {
                expect(status.details.successRate).toBeCloseTo(0.75);
            }
        });
    });

    describe('createStoppedStatus', () => {
        it('should create stopped status with retry rate exceeded', () => {
            const stopReason: StopReason = {
                condition: 'RETRY_RATE',
                value: 0.6,
                threshold: 0.5,
                message: 'Retry rate exceeded: 60.0% > 50.0%',
            };

            const status = createStoppedStatus(state, stopReason);

            expect(status.status).toBe('stopped');
            expect(status.reasonCode).toBe('RETRY_RATE_EXCEEDED');
            expect(status.message).toBe('Retry rate exceeded: 60.0% > 50.0%');

            expect(isStoppedDetails(status.details)).toBe(true);
            if (isStoppedDetails(status.details)) {
                expect(status.details.stopCondition).toBe('RETRY_RATE');
                expect(status.details.threshold).toBe(0.5);
                expect(status.details.actualValue).toBe(0.6);
                expect(status.details.resumeCommand).toBe('pipeline run --resume test-run');
            }
        });

        it('should create stopped status with reject rate exceeded', () => {
            const stopReason: StopReason = {
                condition: 'REJECT_RATE',
                value: 0.4,
                threshold: 0.3,
                message: 'Reject rate exceeded',
            };

            const status = createStoppedStatus(state, stopReason);

            expect(status.reasonCode).toBe('REJECT_RATE_EXCEEDED');
        });

        it('should create stopped status with consecutive fails', () => {
            const stopReason: StopReason = {
                condition: 'CONSECUTIVE_FAILS',
                value: 3,
                threshold: 3,
                message: 'Too many consecutive failures',
            };

            const status = createStoppedStatus(state, stopReason);

            expect(status.reasonCode).toBe('CONSECUTIVE_FAILS');
        });

        it('should create stopped status with circuit breaker', () => {
            const stopReason: StopReason = {
                condition: 'CIRCUIT_BREAKER',
                value: 50,
                threshold: 50,
                message: 'Circuit breaker tripped',
            };

            const status = createStoppedStatus(state, stopReason);

            expect(status.reasonCode).toBe('CIRCUIT_BREAKER');
        });

        it('should create stopped status with user interrupt', () => {
            const stopReason: StopReason = {
                condition: 'USER_INTERRUPT',
                value: 0,
                threshold: 0,
                message: 'User requested stop',
            };

            const status = createStoppedStatus(state, stopReason);

            expect(status.reasonCode).toBe('USER_INTERRUPT');
        });
    });

    describe('createFailedStatus', () => {
        it('should create failed status for system error', () => {
            const status = createFailedStatus(
                state,
                'system',
                'SYS_WRITE_ERROR',
                'Failed to write state file',
                'runs/test/diagnostic.json'
            );

            expect(status.status).toBe('failed');
            expect(status.reasonCode).toBe('SYS_WRITE_ERROR');
            expect(status.message).toBe('Failed to write state file');

            expect(isFailedDetails(status.details)).toBe(true);
            if (isFailedDetails(status.details)) {
                expect(status.details.errorType).toBe('system');
                expect(status.details.errorCode).toBe('SYS_WRITE_ERROR');
                expect(status.details.errorMessage).toBe('Failed to write state file');
                expect(status.details.diagnosticPath).toBe('runs/test/diagnostic.json');
            }
        });

        it('should create failed status for dependency error', () => {
            const status = createFailedStatus(
                state,
                'dependency',
                'DEP_GEMINI_API_ERROR',
                'Gemini API returned 503'
            );

            expect(status.reasonCode).toBe('DEP_API_UNAVAILABLE');

            if (isFailedDetails(status.details)) {
                expect(status.details.errorType).toBe('dependency');
            }
        });

        it('should create failed status for manifest error', () => {
            const status = createFailedStatus(
                state,
                'system',
                'MANIFEST_VALIDATION_FAILED',
                'Invalid manifest schema'
            );

            expect(status.reasonCode).toBe('SYS_MANIFEST_INVALID');
        });

        it('should create failed status for TexturePacker error', () => {
            const status = createFailedStatus(
                state,
                'dependency',
                'TEXTUREPACKER_FAILED',
                'TexturePacker exited with code 1'
            );

            expect(status.reasonCode).toBe('DEP_TEXTUREPACKER_FAIL');
        });

        it('should handle unknown error codes', () => {
            const status = createFailedStatus(
                state,
                'system',
                'UNKNOWN_ERROR',
                'Something unexpected happened'
            );

            expect(status.reasonCode).toBe('SYS_UNKNOWN_ERROR');
        });
    });

    describe('formatStatusForCLI', () => {
        it('should format in-progress status', () => {
            const status = createInProgressStatus(state, 'Generating', new Date());
            const output = formatStatusForCLI(status);

            expect(output).toContain('IN-PROGRESS');
            expect(output).toContain('GENERATING');
            expect(output).toContain('Frame:');
            expect(output).toContain('Elapsed:');
            expect(output).toContain('Progress:');
            expect(output).toContain('Metrics:');
        });

        it('should format completed status', () => {
            for (let i = 0; i < 4; i++) {
                state.frameAttempts[i].finalStatus = 'approved';
            }

            const status = createCompletedStatus(
                state,
                new Date(),
                'runs/test/export',
                ['atlas.png'],
                true
            );
            const output = formatStatusForCLI(status);

            expect(output).toContain('COMPLETED');
            expect(output).toContain('ALL_FRAMES_APPROVED');
            expect(output).toContain('Duration:');
            expect(output).toContain('100.0%');
            expect(output).toContain('Export:');
            expect(output).toContain('runs/test/export');
            expect(output).toContain('PASSED');
        });

        it('should format stopped status', () => {
            const stopReason: StopReason = {
                condition: 'RETRY_RATE',
                value: 0.6,
                threshold: 0.5,
                message: 'Retry rate exceeded',
            };

            const status = createStoppedStatus(state, stopReason);
            const output = formatStatusForCLI(status);

            expect(output).toContain('STOPPED');
            expect(output).toContain('RETRY_RATE_EXCEEDED');
            expect(output).toContain('Stop Reason:');
            expect(output).toContain('Resume:');
            expect(output).toContain('pipeline run --resume');
        });

        it('should format failed status', () => {
            const status = createFailedStatus(
                state,
                'system',
                'SYS_WRITE_ERROR',
                'Disk full',
                '/path/to/diagnostic.json'
            );
            const output = formatStatusForCLI(status);

            expect(output).toContain('FAILED');
            expect(output).toContain('Error:');
            expect(output).toContain('system');
            expect(output).toContain('SYS_WRITE_ERROR');
            expect(output).toContain('Disk full');
            expect(output).toContain('Diagnostic:');
        });

        it('should include progress bar', () => {
            const status = createInProgressStatus(state, 'Generating', new Date());
            const output = formatStatusForCLI(status);

            expect(output).toContain('[');
            expect(output).toContain(']');
            expect(output).toMatch(/[█░]/); // Progress bar characters
        });
    });

    describe('getStatusColor', () => {
        it('should return yellow for in-progress', () => {
            expect(getStatusColor('in-progress')).toContain('33'); // Yellow ANSI
        });

        it('should return green for completed', () => {
            expect(getStatusColor('completed')).toContain('32'); // Green ANSI
        });

        it('should return yellow for stopped', () => {
            expect(getStatusColor('stopped')).toContain('33'); // Yellow ANSI
        });

        it('should return red for failed', () => {
            expect(getStatusColor('failed')).toContain('31'); // Red ANSI
        });

        it('should return reset for unknown', () => {
            expect(getStatusColor('unknown')).toBe('\x1b[0m');
        });
    });

    describe('logStatus', () => {
        it('should not throw when logging status', () => {
            const status = createInProgressStatus(state, 'Generating', new Date());

            expect(() => logStatus(status)).not.toThrow();
        });

        it('should not throw for any status type', () => {
            const inProgress = createInProgressStatus(state, 'Generating', new Date());
            const completed = createCompletedStatus(state, new Date());
            const stopped = createStoppedStatus(state, {
                condition: 'CIRCUIT_BREAKER',
                value: 50,
                threshold: 50,
                message: 'Circuit breaker',
            });
            const failed = createFailedStatus(state, 'system', 'ERROR', 'Error');

            expect(() => logStatus(inProgress)).not.toThrow();
            expect(() => logStatus(completed)).not.toThrow();
            expect(() => logStatus(stopped)).not.toThrow();
            expect(() => logStatus(failed)).not.toThrow();
        });
    });

    describe('type guards', () => {
        it('should correctly identify InProgressDetails', () => {
            const status = createInProgressStatus(state, 'Generating', new Date());
            expect(isInProgressDetails(status.details)).toBe(true);
            expect(isCompletedDetails(status.details)).toBe(false);
            expect(isStoppedDetails(status.details)).toBe(false);
            expect(isFailedDetails(status.details)).toBe(false);
        });

        it('should correctly identify CompletedDetails', () => {
            const status = createCompletedStatus(state, new Date());
            expect(isInProgressDetails(status.details)).toBe(false);
            expect(isCompletedDetails(status.details)).toBe(true);
            expect(isStoppedDetails(status.details)).toBe(false);
            expect(isFailedDetails(status.details)).toBe(false);
        });

        it('should correctly identify StoppedDetails', () => {
            const status = createStoppedStatus(state, {
                condition: 'CIRCUIT_BREAKER',
                value: 50,
                threshold: 50,
                message: 'CB',
            });
            expect(isInProgressDetails(status.details)).toBe(false);
            expect(isCompletedDetails(status.details)).toBe(false);
            expect(isStoppedDetails(status.details)).toBe(true);
            expect(isFailedDetails(status.details)).toBe(false);
        });

        it('should correctly identify FailedDetails', () => {
            const status = createFailedStatus(state, 'system', 'ERR', 'Error');
            expect(isInProgressDetails(status.details)).toBe(false);
            expect(isCompletedDetails(status.details)).toBe(false);
            expect(isStoppedDetails(status.details)).toBe(false);
            expect(isFailedDetails(status.details)).toBe(true);
        });
    });
});
