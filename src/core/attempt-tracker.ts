/**
 * Attempt tracker - tracks generation attempts per frame with history
 * Per Story 4.2: Attempt Tracking and Max Attempts Enforcement
 */

import { logger } from '../utils/logger.js';
import type { RunState } from './state-manager.js';

/**
 * Record of a single generation attempt
 */
export interface AttemptRecord {
    /** 1-based attempt number */
    attemptIndex: number;
    /** ISO 8601 timestamp */
    timestamp: string;
    /** Hash of prompt used */
    promptHash: string;
    /** Seed used (undefined for random) */
    seed?: number;
    /** Result of this attempt */
    result: 'pending' | 'passed' | 'soft_fail' | 'hard_fail';
    /** Reason codes triggered */
    reasonCodes: string[];
    /** Composite audit score if available */
    compositeScore?: number;
    /** Time for generation + audit */
    durationMs: number;
    /** Retry strategy used */
    strategy?: string;
}

/**
 * Frame attempt tracking state
 */
export interface FrameAttemptState {
    frameIndex: number;
    attempts: AttemptRecord[];
    currentAttempt: number;
    finalStatus?: 'approved' | 'failed' | 'rejected';
    finalReason?: string;
}

// Default limits
const DEFAULT_MAX_ATTEMPTS = 5;
const CIRCUIT_BREAKER_LIMIT = 50;
const ESTIMATED_COST_PER_ATTEMPT = 0.004; // $0.004 per generation

/**
 * Extended run state with attempt tracking
 */
export interface RunStateWithAttempts extends RunState {
    /** Total attempts across entire run */
    totalAttempts: number;
    /** Per-frame attempt details */
    frameAttempts: Record<number, FrameAttemptState>;
}

/**
 * Initialize attempt tracking for a run state
 */
export function initializeAttemptTracking(
    state: RunState,
    totalFrames: number
): RunStateWithAttempts {
    const frameAttempts: Record<number, FrameAttemptState> = {};

    for (let i = 0; i < totalFrames; i++) {
        frameAttempts[i] = {
            frameIndex: i,
            attempts: [],
            currentAttempt: 0,
        };
    }

    return {
        ...state,
        totalAttempts: 0,
        frameAttempts,
    };
}

/**
 * Get current attempt count for a frame
 */
export function getAttemptCount(
    state: RunStateWithAttempts,
    frameIndex: number
): number {
    const frameState = state.frameAttempts[frameIndex];
    return frameState?.currentAttempt ?? 0;
}

/**
 * Record a new attempt for a frame
 */
export function recordAttempt(
    state: RunStateWithAttempts,
    frameIndex: number,
    attempt: Omit<AttemptRecord, 'attemptIndex'>
): RunStateWithAttempts {
    const newState = { ...state };
    newState.frameAttempts = { ...state.frameAttempts };
    newState.frameAttempts[frameIndex] = {
        ...state.frameAttempts[frameIndex],
        attempts: [
            ...state.frameAttempts[frameIndex].attempts,
            {
                ...attempt,
                attemptIndex: state.frameAttempts[frameIndex].currentAttempt + 1,
            },
        ],
        currentAttempt: state.frameAttempts[frameIndex].currentAttempt + 1,
    };
    newState.totalAttempts = state.totalAttempts + 1;

    return newState;
}

/**
 * Check if max attempts reached for a frame
 */
export function isMaxAttemptsReached(
    state: RunStateWithAttempts,
    frameIndex: number,
    maxAttempts: number = DEFAULT_MAX_ATTEMPTS
): boolean {
    const attemptCount = getAttemptCount(state, frameIndex);
    return attemptCount >= maxAttempts;
}

/**
 * Mark a frame as failed due to max attempts
 */
export function markFrameMaxAttemptsReached(
    state: RunStateWithAttempts,
    frameIndex: number
): RunStateWithAttempts {
    const newState = { ...state };
    newState.frameAttempts = { ...state.frameAttempts };
    newState.frameAttempts[frameIndex] = {
        ...state.frameAttempts[frameIndex],
        finalStatus: 'failed',
        finalReason: 'MAX_ATTEMPTS_REACHED',
    };

    logger.warn({
        event: 'max_attempts_reached',
        frameIndex,
        attemptCount: getAttemptCount(state, frameIndex),
    }, `Frame ${frameIndex}: Max attempts reached, marking as failed`);

    return newState;
}

/**
 * Mark a frame as rejected (HF_IDENTITY_COLLAPSE)
 */
export function markFrameRejected(
    state: RunStateWithAttempts,
    frameIndex: number,
    reason: string
): RunStateWithAttempts {
    const newState = { ...state };
    newState.frameAttempts = { ...state.frameAttempts };
    newState.frameAttempts[frameIndex] = {
        ...state.frameAttempts[frameIndex],
        finalStatus: 'rejected',
        finalReason: reason,
    };

    logger.warn({
        event: 'frame_rejected',
        frameIndex,
        reason,
    }, `Frame ${frameIndex}: Rejected - ${reason}`);

    return newState;
}

/**
 * Circuit breaker result
 */
export interface CircuitBreakerResult {
    tripped: boolean;
    totalAttempts: number;
    estimatedCost: number;
    limit: number;
}

/**
 * Check circuit breaker (global attempt limit)
 */
export function checkCircuitBreaker(
    state: RunStateWithAttempts,
    limit: number = CIRCUIT_BREAKER_LIMIT
): CircuitBreakerResult {
    const totalAttempts = state.totalAttempts;
    const estimatedCost = totalAttempts * ESTIMATED_COST_PER_ATTEMPT;

    if (totalAttempts >= limit) {
        logger.warn({
            event: 'circuit_breaker_tripped',
            totalAttempts,
            estimatedCost: `$${estimatedCost.toFixed(2)}`,
            limit,
        }, `Circuit breaker tripped: ${totalAttempts} attempts (~$${estimatedCost.toFixed(2)})`);

        return {
            tripped: true,
            totalAttempts,
            estimatedCost,
            limit,
        };
    }

    return {
        tripped: false,
        totalAttempts,
        estimatedCost,
        limit,
    };
}

/**
 * Get attempt history for a frame
 */
export function getAttemptHistory(
    state: RunStateWithAttempts,
    frameIndex: number
): AttemptRecord[] {
    return state.frameAttempts[frameIndex]?.attempts ?? [];
}

/**
 * Get the last attempt result for a frame
 */
export function getLastAttemptResult(
    state: RunStateWithAttempts,
    frameIndex: number
): AttemptRecord | undefined {
    const history = getAttemptHistory(state, frameIndex);
    return history.length > 0 ? history[history.length - 1] : undefined;
}

/**
 * Calculate simple hash for prompt (for logging purposes)
 */
export function hashPrompt(prompt: string): string {
    let hash = 0;
    for (let i = 0; i < prompt.length; i++) {
        const char = prompt.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Count frames with retries
 */
export function countFramesWithRetries(state: RunStateWithAttempts): number {
    return Object.values(state.frameAttempts).filter(
        frame => frame.attempts.length > 1
    ).length;
}

/**
 * Count rejected frames
 */
export function countRejectedFrames(state: RunStateWithAttempts): number {
    return Object.values(state.frameAttempts).filter(
        frame => frame.finalStatus === 'rejected'
    ).length;
}

/**
 * Count failed frames (max attempts reached)
 */
export function countFailedAttemptFrames(state: RunStateWithAttempts): number {
    return Object.values(state.frameAttempts).filter(
        frame => frame.finalStatus === 'failed'
    ).length;
}
