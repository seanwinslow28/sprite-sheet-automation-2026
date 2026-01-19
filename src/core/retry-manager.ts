/**
 * Retry manager - handles retry ladder logic and action execution
 * Per Story 4.3: Retry Ladder with Reason-to-Action Mapping
 */

import { logger } from '../utils/logger.js';
import {
    type RetryAction,
    type StopReasonType,
    ACTION_DESCRIPTIONS,
    getActionsForReason,
    getLadderLevel,
} from '../domain/retry-actions.js';

/**
 * Frame retry state tracking
 */
export interface FrameRetryState {
    frameIndex: number;
    actionsTried: RetryAction[];
    consecutiveReanchorCount: number;
    lastSF01Scores: number[];
    oscillationPattern: ('pass' | 'fail')[];
}

/**
 * Retry decision result
 */
export interface RetryDecision {
    shouldRetry: boolean;
    action: RetryAction;
    reason: string;
    escalationLevel: number;
}

/**
 * Stop decision result
 */
export interface StopDecision {
    shouldStop: true;
    stopReason: StopReasonType;
    message: string;
}

export type RetryOrStopDecision = RetryDecision | StopDecision;

// Thresholds
const SF01_COLLAPSE_THRESHOLD = 0.9;
const CONSECUTIVE_REANCHOR_COLLAPSE = 2;
const OSCILLATION_PATTERN_LENGTH = 4;

/**
 * Initialize retry state for a frame
 */
export function initializeFrameRetryState(frameIndex: number): FrameRetryState {
    return {
        frameIndex,
        actionsTried: [],
        consecutiveReanchorCount: 0,
        lastSF01Scores: [],
        oscillationPattern: [],
    };
}

/**
 * Retry state storage (per-run)
 */
export interface RetryStateStorage {
    frameStates: Map<number, FrameRetryState>;
}

/**
 * Create retry state storage
 */
export function createRetryStateStorage(): RetryStateStorage {
    return {
        frameStates: new Map(),
    };
}

/**
 * Get or create frame retry state
 */
export function getFrameRetryState(
    storage: RetryStateStorage,
    frameIndex: number
): FrameRetryState {
    let state = storage.frameStates.get(frameIndex);
    if (!state) {
        state = initializeFrameRetryState(frameIndex);
        storage.frameStates.set(frameIndex, state);
    }
    return state;
}

/**
 * Record an action as tried
 */
export function recordActionTried(
    storage: RetryStateStorage,
    frameIndex: number,
    action: RetryAction
): void {
    const state = getFrameRetryState(storage, frameIndex);
    state.actionsTried.push(action);

    // Track consecutive re-anchors
    if (action === 'RE_ANCHOR' || action === 'IDENTITY_RESCUE') {
        state.consecutiveReanchorCount++;
    } else {
        state.consecutiveReanchorCount = 0;
    }
}

/**
 * Record SF01 score for collapse detection
 */
export function recordSF01Score(
    storage: RetryStateStorage,
    frameIndex: number,
    score: number
): void {
    const state = getFrameRetryState(storage, frameIndex);
    state.lastSF01Scores.push(score);
    // Keep only last 5 scores
    if (state.lastSF01Scores.length > 5) {
        state.lastSF01Scores.shift();
    }
}

/**
 * Record pass/fail for oscillation detection
 */
export function recordPassFail(
    storage: RetryStateStorage,
    frameIndex: number,
    result: 'pass' | 'fail'
): void {
    const state = getFrameRetryState(storage, frameIndex);
    state.oscillationPattern.push(result);
    // Keep only last 6 results
    if (state.oscillationPattern.length > 6) {
        state.oscillationPattern.shift();
    }
}

/**
 * Check if identity collapse should trigger (SF01 score based)
 * Per Deep Think: 2+ consecutive re-anchors both failed SF01 < 0.9
 * Note: Oscillation is checked separately in getNextAction()
 */
export function shouldTriggerCollapse(state: FrameRetryState): boolean {
    // 2+ consecutive re-anchors both failed SF01 < 0.9
    if (state.consecutiveReanchorCount >= CONSECUTIVE_REANCHOR_COLLAPSE) {
        const recentScores = state.lastSF01Scores.slice(-CONSECUTIVE_REANCHOR_COLLAPSE);
        if (recentScores.length >= CONSECUTIVE_REANCHOR_COLLAPSE &&
            recentScores.every(score => score < SF01_COLLAPSE_THRESHOLD)) {
            return true;
        }
    }

    return false;
}

/**
 * Detect oscillation pattern (alternating pass/fail)
 */
export function detectOscillation(state: FrameRetryState): boolean {
    const pattern = state.oscillationPattern.slice(-OSCILLATION_PATTERN_LENGTH);

    if (pattern.length < OSCILLATION_PATTERN_LENGTH) {
        return false;
    }

    // Check for alternating pattern
    let isOscillating = true;
    for (let i = 1; i < pattern.length; i++) {
        if (pattern[i] === pattern[i - 1]) {
            isOscillating = false;
            break;
        }
    }

    // Additionally check if re-anchor has been tried multiple times
    if (isOscillating && state.consecutiveReanchorCount > 2) {
        return true;
    }

    return false;
}

/**
 * Get next retry action for a reason code
 */
export function getNextAction(
    storage: RetryStateStorage,
    frameIndex: number,
    reasonCode: string,
    attemptIndex: number
): RetryOrStopDecision {
    const state = getFrameRetryState(storage, frameIndex);

    // Check for identity collapse first
    if (shouldTriggerCollapse(state)) {
        logger.warn({
            event: 'identity_collapse',
            frameIndex,
            consecutiveReanchors: state.consecutiveReanchorCount,
            lastSF01Scores: state.lastSF01Scores,
        }, `Frame ${frameIndex}: Identity collapse triggered`);

        return {
            shouldStop: true,
            stopReason: 'HF_IDENTITY_COLLAPSE',
            message: 'Suggestion: Anchor may lack resolution for this pose angle',
        };
    }

    // Check for oscillation
    if (detectOscillation(state)) {
        logger.warn({
            event: 'oscillation_detected',
            frameIndex,
            pattern: state.oscillationPattern,
        }, `Frame ${frameIndex}: Oscillation detected, marking as identity collapse`);

        return {
            shouldStop: true,
            stopReason: 'OSCILLATION_DETECTED',
            message: 'Frame oscillating between pass/fail, treating as dead end',
        };
    }

    // Get actions for this reason code
    const availableActions = getActionsForReason(reasonCode);

    // Find first action not yet tried
    for (const action of availableActions) {
        if (!state.actionsTried.includes(action)) {
            const level = getLadderLevel(action);

            logger.info({
                event: 'retry_action_selected',
                frameIndex,
                attemptIndex,
                reasonCode,
                action,
                level,
                description: ACTION_DESCRIPTIONS[action],
            }, `Frame ${frameIndex}: Attempting ${action} (attempt ${attemptIndex})`);

            return {
                shouldRetry: true,
                action,
                reason: `${reasonCode} → ${ACTION_DESCRIPTIONS[action]}`,
                escalationLevel: level,
            };
        }
    }

    // All actions for this reason have been tried
    // Try to escalate to next level
    const nextEscalation = findNextEscalation(state);

    if (nextEscalation) {
        logger.info({
            event: 'retry_escalating',
            frameIndex,
            attemptIndex,
            previousActions: state.actionsTried,
            nextAction: nextEscalation,
        }, `Frame ${frameIndex}: Escalating to ${nextEscalation}`);

        return {
            shouldRetry: true,
            action: nextEscalation,
            reason: `Escalating after ${reasonCode}`,
            escalationLevel: getLadderLevel(nextEscalation),
        };
    }

    // Ladder exhausted
    return {
        shouldStop: true,
        stopReason: 'LADDER_EXHAUSTED',
        message: `All retry actions exhausted for frame ${frameIndex}`,
    };
}

/**
 * Find next escalation action not yet tried
 */
function findNextEscalation(state: FrameRetryState): RetryAction | null {
    // Escalation order: RE_ANCHOR → DEFAULT_REGENERATE
    const escalationOrder: RetryAction[] = ['RE_ANCHOR', 'DEFAULT_REGENERATE'];

    for (const action of escalationOrder) {
        if (!state.actionsTried.includes(action)) {
            return action;
        }
    }

    return null;
}

/**
 * Check if the retry ladder is exhausted for a frame
 */
export function isLadderExhausted(
    storage: RetryStateStorage,
    frameIndex: number
): boolean {
    const state = getFrameRetryState(storage, frameIndex);

    // Ladder is exhausted when RE_ANCHOR and DEFAULT_REGENERATE have both been tried
    return state.actionsTried.includes('RE_ANCHOR') &&
        state.actionsTried.includes('DEFAULT_REGENERATE');
}

/**
 * Reset retry state for a frame (on success)
 */
export function resetFrameRetryState(
    storage: RetryStateStorage,
    frameIndex: number
): void {
    storage.frameStates.set(frameIndex, initializeFrameRetryState(frameIndex));
}

/**
 * Check if result is a stop decision
 */
export function isStopDecision(
    decision: RetryOrStopDecision
): decision is StopDecision {
    return 'shouldStop' in decision && decision.shouldStop === true;
}

/**
 * Check if result is a retry decision
 */
export function isRetryDecision(
    decision: RetryOrStopDecision
): decision is RetryDecision {
    return 'shouldRetry' in decision;
}
