/**
 * Tests for attempt tracker
 * Per Story 4.2: Attempt Tracking and Max Attempts Enforcement
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    initializeAttemptTracking,
    getAttemptCount,
    recordAttempt,
    isMaxAttemptsReached,
    markFrameMaxAttemptsReached,
    markFrameRejected,
    checkCircuitBreaker,
    getAttemptHistory,
    getLastAttemptResult,
    hashPrompt,
    countFramesWithRetries,
    countRejectedFrames,
    countFailedAttemptFrames,
    type RunStateWithAttempts,
} from '../../src/core/attempt-tracker.js';
import { initializeState } from '../../src/core/state-manager.js';

describe('Attempt Tracker', () => {
    describe('initializeAttemptTracking', () => {
        it('should initialize tracking for all frames', () => {
            const baseState = initializeState('test-run', 4);
            const state = initializeAttemptTracking(baseState, 4);

            expect(state.totalAttempts).toBe(0);
            expect(Object.keys(state.frameAttempts)).toHaveLength(4);

            for (let i = 0; i < 4; i++) {
                expect(state.frameAttempts[i].frameIndex).toBe(i);
                expect(state.frameAttempts[i].attempts).toHaveLength(0);
                expect(state.frameAttempts[i].currentAttempt).toBe(0);
            }
        });
    });

    describe('getAttemptCount', () => {
        it('should return 0 for frame with no attempts', () => {
            const baseState = initializeState('test-run', 2);
            const state = initializeAttemptTracking(baseState, 2);

            expect(getAttemptCount(state, 0)).toBe(0);
        });

        it('should return correct count after recording attempts', () => {
            const baseState = initializeState('test-run', 2);
            let state = initializeAttemptTracking(baseState, 2);

            state = recordAttempt(state, 0, {
                timestamp: new Date().toISOString(),
                promptHash: 'abc123',
                result: 'soft_fail',
                reasonCodes: ['SF01'],
                durationMs: 1000,
            });

            state = recordAttempt(state, 0, {
                timestamp: new Date().toISOString(),
                promptHash: 'def456',
                result: 'passed',
                reasonCodes: [],
                durationMs: 1200,
            });

            expect(getAttemptCount(state, 0)).toBe(2);
            expect(getAttemptCount(state, 1)).toBe(0);
        });
    });

    describe('recordAttempt', () => {
        it('should add attempt to frame history', () => {
            const baseState = initializeState('test-run', 2);
            let state = initializeAttemptTracking(baseState, 2);

            state = recordAttempt(state, 0, {
                timestamp: '2026-01-18T10:00:00Z',
                promptHash: 'abc123',
                seed: 42,
                result: 'soft_fail',
                reasonCodes: ['SF01_IDENTITY_DRIFT'],
                compositeScore: 0.75,
                durationMs: 1500,
                strategy: 'REROLL_SEED',
            });

            const history = state.frameAttempts[0].attempts;
            expect(history).toHaveLength(1);
            expect(history[0].attemptIndex).toBe(1);
            expect(history[0].promptHash).toBe('abc123');
            expect(history[0].seed).toBe(42);
            expect(history[0].result).toBe('soft_fail');
            expect(history[0].reasonCodes).toEqual(['SF01_IDENTITY_DRIFT']);
            expect(history[0].compositeScore).toBe(0.75);
            expect(history[0].strategy).toBe('REROLL_SEED');
        });

        it('should increment total attempts', () => {
            const baseState = initializeState('test-run', 2);
            let state = initializeAttemptTracking(baseState, 2);

            expect(state.totalAttempts).toBe(0);

            state = recordAttempt(state, 0, {
                timestamp: new Date().toISOString(),
                promptHash: 'a',
                result: 'soft_fail',
                reasonCodes: [],
                durationMs: 1000,
            });

            expect(state.totalAttempts).toBe(1);

            state = recordAttempt(state, 1, {
                timestamp: new Date().toISOString(),
                promptHash: 'b',
                result: 'passed',
                reasonCodes: [],
                durationMs: 1000,
            });

            expect(state.totalAttempts).toBe(2);
        });
    });

    describe('isMaxAttemptsReached', () => {
        it('should return false when under limit', () => {
            const baseState = initializeState('test-run', 2);
            let state = initializeAttemptTracking(baseState, 2);

            state = recordAttempt(state, 0, {
                timestamp: new Date().toISOString(),
                promptHash: 'a',
                result: 'soft_fail',
                reasonCodes: [],
                durationMs: 1000,
            });

            expect(isMaxAttemptsReached(state, 0, 5)).toBe(false);
        });

        it('should return true when at limit', () => {
            const baseState = initializeState('test-run', 2);
            let state = initializeAttemptTracking(baseState, 2);

            // Record 5 attempts
            for (let i = 0; i < 5; i++) {
                state = recordAttempt(state, 0, {
                    timestamp: new Date().toISOString(),
                    promptHash: `attempt${i}`,
                    result: 'soft_fail',
                    reasonCodes: ['SF01'],
                    durationMs: 1000,
                });
            }

            expect(isMaxAttemptsReached(state, 0, 5)).toBe(true);
        });

        it('should use default max of 5', () => {
            const baseState = initializeState('test-run', 1);
            let state = initializeAttemptTracking(baseState, 1);

            for (let i = 0; i < 4; i++) {
                state = recordAttempt(state, 0, {
                    timestamp: new Date().toISOString(),
                    promptHash: `${i}`,
                    result: 'soft_fail',
                    reasonCodes: [],
                    durationMs: 1000,
                });
            }

            expect(isMaxAttemptsReached(state, 0)).toBe(false);

            state = recordAttempt(state, 0, {
                timestamp: new Date().toISOString(),
                promptHash: '5',
                result: 'soft_fail',
                reasonCodes: [],
                durationMs: 1000,
            });

            expect(isMaxAttemptsReached(state, 0)).toBe(true);
        });
    });

    describe('markFrameMaxAttemptsReached', () => {
        it('should set final status to failed', () => {
            const baseState = initializeState('test-run', 2);
            let state = initializeAttemptTracking(baseState, 2);

            state = markFrameMaxAttemptsReached(state, 0);

            expect(state.frameAttempts[0].finalStatus).toBe('failed');
            expect(state.frameAttempts[0].finalReason).toBe('MAX_ATTEMPTS_REACHED');
        });
    });

    describe('markFrameRejected', () => {
        it('should set final status to rejected with reason', () => {
            const baseState = initializeState('test-run', 2);
            let state = initializeAttemptTracking(baseState, 2);

            state = markFrameRejected(state, 0, 'HF_IDENTITY_COLLAPSE');

            expect(state.frameAttempts[0].finalStatus).toBe('rejected');
            expect(state.frameAttempts[0].finalReason).toBe('HF_IDENTITY_COLLAPSE');
        });
    });

    describe('checkCircuitBreaker', () => {
        it('should not trip when under limit', () => {
            const baseState = initializeState('test-run', 2);
            let state = initializeAttemptTracking(baseState, 2);
            state.totalAttempts = 49;

            const result = checkCircuitBreaker(state);

            expect(result.tripped).toBe(false);
            expect(result.totalAttempts).toBe(49);
        });

        it('should trip at default limit of 50', () => {
            const baseState = initializeState('test-run', 2);
            let state = initializeAttemptTracking(baseState, 2);
            state.totalAttempts = 50;

            const result = checkCircuitBreaker(state);

            expect(result.tripped).toBe(true);
            expect(result.limit).toBe(50);
        });

        it('should respect custom limit', () => {
            const baseState = initializeState('test-run', 2);
            let state = initializeAttemptTracking(baseState, 2);
            state.totalAttempts = 25;

            const result = checkCircuitBreaker(state, 25);

            expect(result.tripped).toBe(true);
            expect(result.limit).toBe(25);
        });

        it('should calculate estimated cost', () => {
            const baseState = initializeState('test-run', 2);
            let state = initializeAttemptTracking(baseState, 2);
            state.totalAttempts = 50;

            const result = checkCircuitBreaker(state);

            // 50 * $0.004 = $0.20
            expect(result.estimatedCost).toBeCloseTo(0.20, 0.01);
        });
    });

    describe('getAttemptHistory', () => {
        it('should return empty array for frame with no attempts', () => {
            const baseState = initializeState('test-run', 2);
            const state = initializeAttemptTracking(baseState, 2);

            const history = getAttemptHistory(state, 0);
            expect(history).toEqual([]);
        });

        it('should return all attempts in order', () => {
            const baseState = initializeState('test-run', 2);
            let state = initializeAttemptTracking(baseState, 2);

            state = recordAttempt(state, 0, {
                timestamp: '2026-01-18T10:00:00Z',
                promptHash: 'first',
                result: 'soft_fail',
                reasonCodes: ['SF01'],
                durationMs: 1000,
            });

            state = recordAttempt(state, 0, {
                timestamp: '2026-01-18T10:01:00Z',
                promptHash: 'second',
                result: 'passed',
                reasonCodes: [],
                durationMs: 1200,
            });

            const history = getAttemptHistory(state, 0);
            expect(history).toHaveLength(2);
            expect(history[0].promptHash).toBe('first');
            expect(history[1].promptHash).toBe('second');
        });
    });

    describe('getLastAttemptResult', () => {
        it('should return undefined for frame with no attempts', () => {
            const baseState = initializeState('test-run', 2);
            const state = initializeAttemptTracking(baseState, 2);

            const last = getLastAttemptResult(state, 0);
            expect(last).toBeUndefined();
        });

        it('should return most recent attempt', () => {
            const baseState = initializeState('test-run', 2);
            let state = initializeAttemptTracking(baseState, 2);

            state = recordAttempt(state, 0, {
                timestamp: '2026-01-18T10:00:00Z',
                promptHash: 'first',
                result: 'soft_fail',
                reasonCodes: ['SF01'],
                durationMs: 1000,
            });

            state = recordAttempt(state, 0, {
                timestamp: '2026-01-18T10:01:00Z',
                promptHash: 'second',
                result: 'passed',
                reasonCodes: [],
                durationMs: 1200,
            });

            const last = getLastAttemptResult(state, 0);
            expect(last?.promptHash).toBe('second');
            expect(last?.result).toBe('passed');
        });
    });

    describe('hashPrompt', () => {
        it('should produce consistent hash for same input', () => {
            const hash1 = hashPrompt('test prompt');
            const hash2 = hashPrompt('test prompt');

            expect(hash1).toBe(hash2);
        });

        it('should produce different hash for different input', () => {
            const hash1 = hashPrompt('test prompt 1');
            const hash2 = hashPrompt('test prompt 2');

            expect(hash1).not.toBe(hash2);
        });

        it('should return 8-character hex string', () => {
            const hash = hashPrompt('any text');

            expect(hash).toHaveLength(8);
            expect(hash).toMatch(/^[0-9a-f]{8}$/);
        });
    });

    describe('count functions', () => {
        let state: RunStateWithAttempts;

        beforeEach(() => {
            const baseState = initializeState('test-run', 4);
            state = initializeAttemptTracking(baseState, 4);

            // Frame 0: 1 attempt, approved
            state = recordAttempt(state, 0, {
                timestamp: new Date().toISOString(),
                promptHash: 'a',
                result: 'passed',
                reasonCodes: [],
                durationMs: 1000,
            });
            state.frameAttempts[0].finalStatus = 'approved';

            // Frame 1: 3 attempts (retried), approved
            for (let i = 0; i < 3; i++) {
                state = recordAttempt(state, 1, {
                    timestamp: new Date().toISOString(),
                    promptHash: `b${i}`,
                    result: i < 2 ? 'soft_fail' : 'passed',
                    reasonCodes: i < 2 ? ['SF01'] : [],
                    durationMs: 1000,
                });
            }
            state.frameAttempts[1].finalStatus = 'approved';

            // Frame 2: rejected
            state.frameAttempts[2].finalStatus = 'rejected';
            state.frameAttempts[2].finalReason = 'HF_IDENTITY_COLLAPSE';

            // Frame 3: failed (max attempts)
            state.frameAttempts[3].finalStatus = 'failed';
            state.frameAttempts[3].finalReason = 'MAX_ATTEMPTS_REACHED';
        });

        it('countFramesWithRetries should count frames with >1 attempt', () => {
            expect(countFramesWithRetries(state)).toBe(1); // Only frame 1 has >1 attempt
        });

        it('countRejectedFrames should count rejected frames', () => {
            expect(countRejectedFrames(state)).toBe(1); // Frame 2
        });

        it('countFailedAttemptFrames should count failed frames', () => {
            expect(countFailedAttemptFrames(state)).toBe(1); // Frame 3
        });
    });
});
