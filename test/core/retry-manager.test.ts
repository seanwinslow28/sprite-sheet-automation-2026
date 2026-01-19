/**
 * Tests for retry manager
 * Per Story 4.3: Retry Ladder with Reason-to-Action Mapping
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    createRetryStateStorage,
    getFrameRetryState,
    recordActionTried,
    recordSF01Score,
    recordPassFail,
    shouldTriggerCollapse,
    detectOscillation,
    getNextAction,
    isLadderExhausted,
    resetFrameRetryState,
    isStopDecision,
    isRetryDecision,
    type RetryStateStorage,
} from '../../src/core/retry-manager.js';
import type { RetryAction } from '../../src/domain/retry-actions.js';

describe('Retry Manager', () => {
    let storage: RetryStateStorage;

    beforeEach(() => {
        storage = createRetryStateStorage();
    });

    describe('createRetryStateStorage', () => {
        it('should create empty storage', () => {
            expect(storage.frameStates.size).toBe(0);
        });
    });

    describe('getFrameRetryState', () => {
        it('should create new state for unknown frame', () => {
            const state = getFrameRetryState(storage, 0);

            expect(state.frameIndex).toBe(0);
            expect(state.actionsTried).toEqual([]);
            expect(state.consecutiveReanchorCount).toBe(0);
            expect(state.lastSF01Scores).toEqual([]);
            expect(state.oscillationPattern).toEqual([]);
        });

        it('should return existing state for known frame', () => {
            const first = getFrameRetryState(storage, 0);
            first.actionsTried.push('REROLL_SEED');

            const second = getFrameRetryState(storage, 0);
            expect(second.actionsTried).toContain('REROLL_SEED');
        });
    });

    describe('recordActionTried', () => {
        it('should add action to tried list', () => {
            recordActionTried(storage, 0, 'REROLL_SEED');
            recordActionTried(storage, 0, 'TIGHTEN_NEGATIVE');

            const state = getFrameRetryState(storage, 0);
            expect(state.actionsTried).toEqual(['REROLL_SEED', 'TIGHTEN_NEGATIVE']);
        });

        it('should increment consecutive reanchor count for RE_ANCHOR', () => {
            recordActionTried(storage, 0, 'RE_ANCHOR');
            recordActionTried(storage, 0, 'RE_ANCHOR');

            const state = getFrameRetryState(storage, 0);
            expect(state.consecutiveReanchorCount).toBe(2);
        });

        it('should increment consecutive reanchor count for IDENTITY_RESCUE', () => {
            recordActionTried(storage, 0, 'IDENTITY_RESCUE');

            const state = getFrameRetryState(storage, 0);
            expect(state.consecutiveReanchorCount).toBe(1);
        });

        it('should reset consecutive reanchor count for other actions', () => {
            recordActionTried(storage, 0, 'RE_ANCHOR');
            recordActionTried(storage, 0, 'RE_ANCHOR');
            recordActionTried(storage, 0, 'TIGHTEN_NEGATIVE');

            const state = getFrameRetryState(storage, 0);
            expect(state.consecutiveReanchorCount).toBe(0);
        });
    });

    describe('recordSF01Score', () => {
        it('should add scores to list', () => {
            recordSF01Score(storage, 0, 0.85);
            recordSF01Score(storage, 0, 0.78);

            const state = getFrameRetryState(storage, 0);
            expect(state.lastSF01Scores).toEqual([0.85, 0.78]);
        });

        it('should keep only last 5 scores', () => {
            for (let i = 0; i < 7; i++) {
                recordSF01Score(storage, 0, 0.7 + i * 0.01);
            }

            const state = getFrameRetryState(storage, 0);
            expect(state.lastSF01Scores).toHaveLength(5);
            expect(state.lastSF01Scores[0]).toBe(0.72); // First 2 dropped
        });
    });

    describe('recordPassFail', () => {
        it('should add results to pattern', () => {
            recordPassFail(storage, 0, 'pass');
            recordPassFail(storage, 0, 'fail');
            recordPassFail(storage, 0, 'pass');

            const state = getFrameRetryState(storage, 0);
            expect(state.oscillationPattern).toEqual(['pass', 'fail', 'pass']);
        });

        it('should keep only last 6 results', () => {
            const results: ('pass' | 'fail')[] = ['pass', 'fail', 'pass', 'fail', 'pass', 'fail', 'pass', 'fail'];
            for (const r of results) {
                recordPassFail(storage, 0, r);
            }

            const state = getFrameRetryState(storage, 0);
            expect(state.oscillationPattern).toHaveLength(6);
        });
    });

    describe('shouldTriggerCollapse', () => {
        it('should trigger collapse after 2 consecutive re-anchors with SF01 < 0.9', () => {
            const state = getFrameRetryState(storage, 0);
            state.consecutiveReanchorCount = 2;
            state.lastSF01Scores = [0.85, 0.82]; // Both below 0.9

            expect(shouldTriggerCollapse(state)).toBe(true);
        });

        it('should not trigger collapse if SF01 scores are good', () => {
            const state = getFrameRetryState(storage, 0);
            state.consecutiveReanchorCount = 2;
            state.lastSF01Scores = [0.85, 0.92]; // Second one is good

            expect(shouldTriggerCollapse(state)).toBe(false);
        });

        it('should not trigger collapse with only 1 re-anchor', () => {
            const state = getFrameRetryState(storage, 0);
            state.consecutiveReanchorCount = 1;
            state.lastSF01Scores = [0.75];

            expect(shouldTriggerCollapse(state)).toBe(false);
        });
    });

    describe('detectOscillation', () => {
        it('should detect alternating pass/fail pattern', () => {
            const state = getFrameRetryState(storage, 0);
            state.oscillationPattern = ['pass', 'fail', 'pass', 'fail'];
            state.consecutiveReanchorCount = 3;

            expect(detectOscillation(state)).toBe(true);
        });

        it('should not detect oscillation with short pattern', () => {
            const state = getFrameRetryState(storage, 0);
            state.oscillationPattern = ['pass', 'fail', 'pass'];
            state.consecutiveReanchorCount = 3;

            expect(detectOscillation(state)).toBe(false);
        });

        it('should not detect oscillation with consecutive same results', () => {
            const state = getFrameRetryState(storage, 0);
            state.oscillationPattern = ['fail', 'fail', 'pass', 'fail'];
            state.consecutiveReanchorCount = 3;

            expect(detectOscillation(state)).toBe(false);
        });
    });

    describe('getNextAction', () => {
        it('should return first action for SF01_IDENTITY_DRIFT', () => {
            const decision = getNextAction(storage, 0, 'SF01_IDENTITY_DRIFT', 1);

            expect(isRetryDecision(decision)).toBe(true);
            if (isRetryDecision(decision)) {
                expect(decision.action).toBe('REROLL_SEED');
                expect(decision.shouldRetry).toBe(true);
            }
        });

        it('should escalate after trying first action', () => {
            recordActionTried(storage, 0, 'REROLL_SEED');

            const decision = getNextAction(storage, 0, 'SF01_IDENTITY_DRIFT', 2);

            expect(isRetryDecision(decision)).toBe(true);
            if (isRetryDecision(decision)) {
                expect(decision.action).toBe('IDENTITY_RESCUE');
            }
        });

        it('should return stop decision on identity collapse', () => {
            const state = getFrameRetryState(storage, 0);
            state.consecutiveReanchorCount = 2;
            state.lastSF01Scores = [0.85, 0.82];

            const decision = getNextAction(storage, 0, 'SF01_IDENTITY_DRIFT', 3);

            expect(isStopDecision(decision)).toBe(true);
            if (isStopDecision(decision)) {
                expect(decision.stopReason).toBe('HF_IDENTITY_COLLAPSE');
            }
        });

        it('should return stop decision on oscillation', () => {
            const state = getFrameRetryState(storage, 0);
            state.oscillationPattern = ['pass', 'fail', 'pass', 'fail'];
            state.consecutiveReanchorCount = 3;

            const decision = getNextAction(storage, 0, 'SF01_IDENTITY_DRIFT', 4);

            expect(isStopDecision(decision)).toBe(true);
            if (isStopDecision(decision)) {
                expect(decision.stopReason).toBe('OSCILLATION_DETECTED');
            }
        });

        it('should escalate to RE_ANCHOR when actions exhausted', () => {
            recordActionTried(storage, 0, 'REROLL_SEED');
            recordActionTried(storage, 0, 'IDENTITY_RESCUE');

            const decision = getNextAction(storage, 0, 'SF01_IDENTITY_DRIFT', 3);

            expect(isRetryDecision(decision)).toBe(true);
            if (isRetryDecision(decision)) {
                expect(decision.action).toBe('RE_ANCHOR');
            }
        });

        it('should return LADDER_EXHAUSTED when all actions tried', () => {
            recordActionTried(storage, 0, 'REROLL_SEED');
            recordActionTried(storage, 0, 'IDENTITY_RESCUE');
            recordActionTried(storage, 0, 'RE_ANCHOR');
            recordActionTried(storage, 0, 'DEFAULT_REGENERATE');

            const decision = getNextAction(storage, 0, 'SF01_IDENTITY_DRIFT', 5);

            expect(isStopDecision(decision)).toBe(true);
            if (isStopDecision(decision)) {
                expect(decision.stopReason).toBe('LADDER_EXHAUSTED');
            }
        });
    });

    describe('isLadderExhausted', () => {
        it('should return false initially', () => {
            expect(isLadderExhausted(storage, 0)).toBe(false);
        });

        it('should return false with only RE_ANCHOR tried', () => {
            recordActionTried(storage, 0, 'RE_ANCHOR');
            expect(isLadderExhausted(storage, 0)).toBe(false);
        });

        it('should return true when both escalation actions tried', () => {
            recordActionTried(storage, 0, 'RE_ANCHOR');
            recordActionTried(storage, 0, 'DEFAULT_REGENERATE');
            expect(isLadderExhausted(storage, 0)).toBe(true);
        });
    });

    describe('resetFrameRetryState', () => {
        it('should reset all tracking state', () => {
            recordActionTried(storage, 0, 'REROLL_SEED');
            recordActionTried(storage, 0, 'RE_ANCHOR');
            recordSF01Score(storage, 0, 0.85);
            recordPassFail(storage, 0, 'fail');

            resetFrameRetryState(storage, 0);

            const state = getFrameRetryState(storage, 0);
            expect(state.actionsTried).toEqual([]);
            expect(state.consecutiveReanchorCount).toBe(0);
            expect(state.lastSF01Scores).toEqual([]);
            expect(state.oscillationPattern).toEqual([]);
        });
    });

    describe('type guards', () => {
        it('isStopDecision should identify stop decisions', () => {
            const stop = { shouldStop: true as const, stopReason: 'LADDER_EXHAUSTED' as const, message: 'test' };
            const retry = { shouldRetry: true, action: 'REROLL_SEED' as RetryAction, reason: 'test', escalationLevel: 1 };

            expect(isStopDecision(stop)).toBe(true);
            expect(isStopDecision(retry)).toBe(false);
        });

        it('isRetryDecision should identify retry decisions', () => {
            const stop = { shouldStop: true as const, stopReason: 'LADDER_EXHAUSTED' as const, message: 'test' };
            const retry = { shouldRetry: true, action: 'REROLL_SEED' as RetryAction, reason: 'test', escalationLevel: 1 };

            expect(isRetryDecision(retry)).toBe(true);
            expect(isRetryDecision(stop)).toBe(false);
        });
    });
});
