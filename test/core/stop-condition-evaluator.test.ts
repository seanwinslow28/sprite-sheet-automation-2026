/**
 * Tests for stop condition evaluator
 * Per Story 4.4: Implement Stop Conditions and Run Halting
 */

import { describe, it, expect } from 'vitest';
import {
    calculateRetryRate,
    calculateRejectRate,
    countConsecutiveFails,
    calculateRunStatistics,
    evaluateStopConditions,
    createUserInterruptReason,
    DEFAULT_STOP_CONDITIONS,
    type StopConditionsConfig,
} from '../../src/core/stop-condition-evaluator.js';
import {
    initializeAttemptTracking,
    recordAttempt,
    type RunStateWithAttempts,
} from '../../src/core/attempt-tracker.js';
import { initializeState } from '../../src/core/state-manager.js';

describe('Stop Condition Evaluator', () => {
    function createTestState(totalFrames: number): RunStateWithAttempts {
        const baseState = initializeState('test-run', totalFrames);
        return initializeAttemptTracking(baseState, totalFrames);
    }

    describe('calculateRetryRate', () => {
        it('should return 0 for no attempts', () => {
            const state = createTestState(4);
            expect(calculateRetryRate(state)).toBe(0);
        });

        it('should return 0 when all frames pass on first attempt', () => {
            const state = createTestState(2);

            // Frame 0: 1 attempt, approved
            state.frameAttempts[0].attempts = [{
                attemptIndex: 1,
                timestamp: new Date().toISOString(),
                promptHash: 'a',
                result: 'passed',
                reasonCodes: [],
                durationMs: 1000,
            }];
            state.frameAttempts[0].finalStatus = 'approved';

            // Frame 1: 1 attempt, approved
            state.frameAttempts[1].attempts = [{
                attemptIndex: 1,
                timestamp: new Date().toISOString(),
                promptHash: 'b',
                result: 'passed',
                reasonCodes: [],
                durationMs: 1000,
            }];
            state.frameAttempts[1].finalStatus = 'approved';

            expect(calculateRetryRate(state)).toBe(0);
        });

        it('should calculate correct retry rate', () => {
            const state = createTestState(4);

            // Frame 0: 1 attempt (no retry)
            state.frameAttempts[0].attempts = [{ attemptIndex: 1, timestamp: '', promptHash: '', result: 'passed', reasonCodes: [], durationMs: 0 }];
            state.frameAttempts[0].finalStatus = 'approved';

            // Frame 1: 3 attempts (retried)
            state.frameAttempts[1].attempts = [
                { attemptIndex: 1, timestamp: '', promptHash: '', result: 'soft_fail', reasonCodes: [], durationMs: 0 },
                { attemptIndex: 2, timestamp: '', promptHash: '', result: 'soft_fail', reasonCodes: [], durationMs: 0 },
                { attemptIndex: 3, timestamp: '', promptHash: '', result: 'passed', reasonCodes: [], durationMs: 0 },
            ];
            state.frameAttempts[1].finalStatus = 'approved';

            // Frame 2: 2 attempts (retried)
            state.frameAttempts[2].attempts = [
                { attemptIndex: 1, timestamp: '', promptHash: '', result: 'soft_fail', reasonCodes: [], durationMs: 0 },
                { attemptIndex: 2, timestamp: '', promptHash: '', result: 'passed', reasonCodes: [], durationMs: 0 },
            ];
            state.frameAttempts[2].finalStatus = 'approved';

            // Frame 3: not attempted yet

            // 2 out of 3 attempted frames have retries = 66.7%
            expect(calculateRetryRate(state)).toBeCloseTo(0.667, 0.01);
        });
    });

    describe('calculateRejectRate', () => {
        it('should return 0 for no completed frames', () => {
            const state = createTestState(4);
            expect(calculateRejectRate(state)).toBe(0);
        });

        it('should return 0 when all frames approved', () => {
            const state = createTestState(2);
            state.frameAttempts[0].finalStatus = 'approved';
            state.frameAttempts[1].finalStatus = 'approved';

            expect(calculateRejectRate(state)).toBe(0);
        });

        it('should calculate correct reject rate', () => {
            const state = createTestState(4);
            state.frameAttempts[0].finalStatus = 'approved';
            state.frameAttempts[1].finalStatus = 'rejected';
            state.frameAttempts[2].finalStatus = 'failed';
            // Frame 3 not complete

            // 2 out of 3 are rejected/failed = 66.7%
            expect(calculateRejectRate(state)).toBeCloseTo(0.667, 0.01);
        });
    });

    describe('countConsecutiveFails', () => {
        it('should return 0 for no failures', () => {
            const state = createTestState(3);
            state.frameAttempts[0].attempts = [{ attemptIndex: 1, timestamp: '', promptHash: '', result: 'passed', reasonCodes: [], durationMs: 0 }];
            state.frameAttempts[0].finalStatus = 'approved';
            state.frameAttempts[1].attempts = [{ attemptIndex: 1, timestamp: '', promptHash: '', result: 'passed', reasonCodes: [], durationMs: 0 }];
            state.frameAttempts[1].finalStatus = 'approved';

            expect(countConsecutiveFails(state)).toBe(0);
        });

        it('should count consecutive failures from end', () => {
            const state = createTestState(5);

            state.frameAttempts[0].attempts = [{ attemptIndex: 1, timestamp: '', promptHash: '', result: 'passed', reasonCodes: [], durationMs: 0 }];
            state.frameAttempts[0].finalStatus = 'approved';

            state.frameAttempts[1].attempts = [{ attemptIndex: 1, timestamp: '', promptHash: '', result: 'passed', reasonCodes: [], durationMs: 0 }];
            state.frameAttempts[1].finalStatus = 'approved';

            state.frameAttempts[2].attempts = [{ attemptIndex: 1, timestamp: '', promptHash: '', result: 'soft_fail', reasonCodes: [], durationMs: 0 }];
            state.frameAttempts[2].finalStatus = 'failed';

            state.frameAttempts[3].attempts = [{ attemptIndex: 1, timestamp: '', promptHash: '', result: 'soft_fail', reasonCodes: [], durationMs: 0 }];
            state.frameAttempts[3].finalStatus = 'rejected';

            state.frameAttempts[4].attempts = [{ attemptIndex: 1, timestamp: '', promptHash: '', result: 'soft_fail', reasonCodes: [], durationMs: 0 }];
            state.frameAttempts[4].finalStatus = 'failed';

            // Last 3 frames all failed
            expect(countConsecutiveFails(state)).toBe(3);
        });

        it('should reset count at any success', () => {
            const state = createTestState(4);

            state.frameAttempts[0].attempts = [{ attemptIndex: 1, timestamp: '', promptHash: '', result: 'soft_fail', reasonCodes: [], durationMs: 0 }];
            state.frameAttempts[0].finalStatus = 'failed';

            state.frameAttempts[1].attempts = [{ attemptIndex: 1, timestamp: '', promptHash: '', result: 'passed', reasonCodes: [], durationMs: 0 }];
            state.frameAttempts[1].finalStatus = 'approved'; // <-- Success breaks chain

            state.frameAttempts[2].attempts = [{ attemptIndex: 1, timestamp: '', promptHash: '', result: 'soft_fail', reasonCodes: [], durationMs: 0 }];
            state.frameAttempts[2].finalStatus = 'failed';

            state.frameAttempts[3].attempts = [{ attemptIndex: 1, timestamp: '', promptHash: '', result: 'soft_fail', reasonCodes: [], durationMs: 0 }];
            state.frameAttempts[3].finalStatus = 'failed';

            // Only last 2 are consecutive
            expect(countConsecutiveFails(state)).toBe(2);
        });
    });

    describe('calculateRunStatistics', () => {
        it('should calculate all statistics correctly', () => {
            const state = createTestState(5);
            state.totalAttempts = 10;

            state.frameAttempts[0].finalStatus = 'approved';
            state.frameAttempts[0].attempts = [{ attemptIndex: 1, timestamp: '', promptHash: '', result: 'passed', reasonCodes: [], durationMs: 0 }];

            state.frameAttempts[1].finalStatus = 'approved';
            state.frameAttempts[1].attempts = [
                { attemptIndex: 1, timestamp: '', promptHash: '', result: 'soft_fail', reasonCodes: [], durationMs: 0 },
                { attemptIndex: 2, timestamp: '', promptHash: '', result: 'passed', reasonCodes: [], durationMs: 0 },
            ];

            state.frameAttempts[2].finalStatus = 'rejected';
            state.frameAttempts[3].finalStatus = 'failed';
            // Frame 4 not attempted

            const stats = calculateRunStatistics(state);

            expect(stats.totalFrames).toBe(5);
            expect(stats.framesApproved).toBe(2);
            expect(stats.framesRejected).toBe(1);
            expect(stats.framesFailed).toBe(1);
            expect(stats.framesAttempted).toBe(2); // Only frames with attempts array
            expect(stats.totalAttempts).toBe(10);
        });
    });

    describe('evaluateStopConditions', () => {
        it('should not stop when all conditions within limits', () => {
            const state = createTestState(4);
            state.totalAttempts = 10;

            // Set up normal state - all approved
            for (let i = 0; i < 4; i++) {
                state.frameAttempts[i].attempts = [{ attemptIndex: 1, timestamp: '', promptHash: '', result: 'passed', reasonCodes: [], durationMs: 0 }];
                state.frameAttempts[i].finalStatus = 'approved';
            }

            const result = evaluateStopConditions(state);

            expect(result.shouldStop).toBe(false);
            expect(result.reason).toBeUndefined();
        });

        it('should stop on circuit breaker', () => {
            const state = createTestState(4);
            state.totalAttempts = 50; // At circuit breaker limit

            const result = evaluateStopConditions(state);

            expect(result.shouldStop).toBe(true);
            expect(result.reason?.condition).toBe('CIRCUIT_BREAKER');
        });

        it('should stop on consecutive fails', () => {
            const state = createTestState(5);
            state.totalAttempts = 5;

            // Last 3 frames failed
            state.frameAttempts[0].finalStatus = 'approved';
            state.frameAttempts[0].attempts = [{ attemptIndex: 1, timestamp: '', promptHash: '', result: 'passed', reasonCodes: [], durationMs: 0 }];

            for (let i = 1; i < 5; i++) {
                state.frameAttempts[i].finalStatus = 'failed';
                state.frameAttempts[i].attempts = [{ attemptIndex: 1, timestamp: '', promptHash: '', result: 'soft_fail', reasonCodes: [], durationMs: 0 }];
            }

            const result = evaluateStopConditions(state);

            expect(result.shouldStop).toBe(true);
            expect(result.reason?.condition).toBe('CONSECUTIVE_FAILS');
        });

        it('should stop on reject rate exceeded', () => {
            const state = createTestState(3);
            state.totalAttempts = 3;

            state.frameAttempts[0].finalStatus = 'approved';
            state.frameAttempts[1].finalStatus = 'rejected';
            state.frameAttempts[2].finalStatus = 'failed';
            // 2/3 = 66.7% reject rate > 30%

            const result = evaluateStopConditions(state);

            expect(result.shouldStop).toBe(true);
            expect(result.reason?.condition).toBe('REJECT_RATE');
        });

        it('should stop on retry rate exceeded', () => {
            const state = createTestState(4);
            state.totalAttempts = 10;

            // 3 out of 4 frames have retries = 75% > 50%
            state.frameAttempts[0].finalStatus = 'approved';
            state.frameAttempts[0].attempts = [{ attemptIndex: 1, timestamp: '', promptHash: '', result: 'passed', reasonCodes: [], durationMs: 0 }];

            for (let i = 1; i < 4; i++) {
                state.frameAttempts[i].finalStatus = 'approved';
                state.frameAttempts[i].attempts = [
                    { attemptIndex: 1, timestamp: '', promptHash: '', result: 'soft_fail', reasonCodes: [], durationMs: 0 },
                    { attemptIndex: 2, timestamp: '', promptHash: '', result: 'passed', reasonCodes: [], durationMs: 0 },
                ];
            }

            const result = evaluateStopConditions(state);

            expect(result.shouldStop).toBe(true);
            expect(result.reason?.condition).toBe('RETRY_RATE');
        });

        it('should respect custom thresholds', () => {
            const state = createTestState(4);
            state.totalAttempts = 10;

            // Normal state that would pass default but fail custom
            for (let i = 0; i < 4; i++) {
                state.frameAttempts[i].finalStatus = 'approved';
                state.frameAttempts[i].attempts = [
                    { attemptIndex: 1, timestamp: '', promptHash: '', result: 'soft_fail', reasonCodes: [], durationMs: 0 },
                    { attemptIndex: 2, timestamp: '', promptHash: '', result: 'passed', reasonCodes: [], durationMs: 0 },
                ];
            }

            const customConfig: StopConditionsConfig = {
                ...DEFAULT_STOP_CONDITIONS,
                maxRetryRate: 0.1, // Very strict
            };

            const result = evaluateStopConditions(state, customConfig);

            expect(result.shouldStop).toBe(true);
            expect(result.reason?.condition).toBe('RETRY_RATE');
        });

        it('should prioritize circuit breaker over other conditions', () => {
            const state = createTestState(4);
            state.totalAttempts = 50;

            // Also trigger consecutive fails
            for (let i = 0; i < 4; i++) {
                state.frameAttempts[i].finalStatus = 'failed';
                state.frameAttempts[i].attempts = [{ attemptIndex: 1, timestamp: '', promptHash: '', result: 'soft_fail', reasonCodes: [], durationMs: 0 }];
            }

            const result = evaluateStopConditions(state);

            expect(result.reason?.condition).toBe('CIRCUIT_BREAKER');
        });
    });

    describe('createUserInterruptReason', () => {
        it('should create user interrupt stop reason', () => {
            const reason = createUserInterruptReason();

            expect(reason.condition).toBe('USER_INTERRUPT');
            expect(reason.message).toContain('interrupted');
        });
    });

    describe('DEFAULT_STOP_CONDITIONS', () => {
        it('should have expected default values', () => {
            expect(DEFAULT_STOP_CONDITIONS.maxRetryRate).toBe(0.5);
            expect(DEFAULT_STOP_CONDITIONS.maxRejectRate).toBe(0.3);
            expect(DEFAULT_STOP_CONDITIONS.maxConsecutiveFails).toBe(3);
            expect(DEFAULT_STOP_CONDITIONS.circuitBreakerLimit).toBe(50);
        });
    });
});
