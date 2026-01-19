/**
 * Stop condition evaluator - evaluates run halt conditions
 * Per Story 4.4: Implement Stop Conditions and Run Halting
 */

import { logger } from '../utils/logger.js';
import type { RunStateWithAttempts } from './attempt-tracker.js';
import { checkCircuitBreaker } from './attempt-tracker.js';

/**
 * Stop conditions configuration from manifest
 */
export interface StopConditionsConfig {
    /** Maximum retry rate before halt (default 0.5 = 50%) */
    maxRetryRate: number;
    /** Maximum reject rate before halt (default 0.3 = 30%) */
    maxRejectRate: number;
    /** Maximum consecutive frame failures before halt (default 3) */
    maxConsecutiveFails: number;
    /** Circuit breaker limit (default 50) */
    circuitBreakerLimit: number;
}

/**
 * Default stop conditions
 */
export const DEFAULT_STOP_CONDITIONS: StopConditionsConfig = {
    maxRetryRate: 0.5,
    maxRejectRate: 0.3,
    maxConsecutiveFails: 3,
    circuitBreakerLimit: 50,
};

/**
 * Stop reason details
 */
export interface StopReason {
    condition: 'RETRY_RATE' | 'REJECT_RATE' | 'CONSECUTIVE_FAILS' | 'CIRCUIT_BREAKER' | 'USER_INTERRUPT';
    value: number;
    threshold: number;
    message: string;
}

/**
 * Stop condition evaluation result
 */
export interface StopConditionResult {
    shouldStop: boolean;
    reason?: StopReason;
    statistics: RunStatistics;
}

/**
 * Run statistics
 */
export interface RunStatistics {
    totalFrames: number;
    framesAttempted: number;
    framesApproved: number;
    framesRejected: number;
    framesFailed: number;
    framesRemaining: number;
    totalAttempts: number;
    retryRate: number;
    rejectRate: number;
    consecutiveFails: number;
}

/**
 * Calculate retry rate
 * Retry rate = frames with > 1 attempt / total frames attempted
 */
export function calculateRetryRate(state: RunStateWithAttempts): number {
    const frameStates = Object.values(state.frameAttempts);
    const attemptedFrames = frameStates.filter(f =>
        f.finalStatus === 'approved' ||
        f.finalStatus === 'failed' ||
        f.finalStatus === 'rejected' ||
        f.attempts.length > 0
    );

    if (attemptedFrames.length === 0) return 0;

    const framesWithRetries = attemptedFrames.filter(f => f.attempts.length > 1);
    return framesWithRetries.length / attemptedFrames.length;
}

/**
 * Calculate reject rate
 * Reject rate = (rejected + failed frames) / total frames attempted
 */
export function calculateRejectRate(state: RunStateWithAttempts): number {
    const frameStates = Object.values(state.frameAttempts);
    const attemptedFrames = frameStates.filter(f =>
        f.finalStatus === 'approved' ||
        f.finalStatus === 'failed' ||
        f.finalStatus === 'rejected'
    );

    if (attemptedFrames.length === 0) return 0;

    const failedOrRejected = attemptedFrames.filter(f =>
        f.finalStatus === 'rejected' || f.finalStatus === 'failed'
    );

    return failedOrRejected.length / attemptedFrames.length;
}

/**
 * Count consecutive failures from the end of frame sequence
 */
export function countConsecutiveFails(state: RunStateWithAttempts): number {
    const frameStates = Object.values(state.frameAttempts)
        .sort((a, b) => a.frameIndex - b.frameIndex);

    let consecutive = 0;

    // Count from the most recently attempted frame backwards
    for (let i = frameStates.length - 1; i >= 0; i--) {
        const frame = frameStates[i];
        if (frame.attempts.length === 0) continue; // Not attempted yet

        if (frame.finalStatus === 'failed' || frame.finalStatus === 'rejected') {
            consecutive++;
        } else if (frame.finalStatus === 'approved') {
            break; // Reset on any success
        }
    }

    return consecutive;
}

/**
 * Calculate run statistics
 */
export function calculateRunStatistics(state: RunStateWithAttempts): RunStatistics {
    const frameStates = Object.values(state.frameAttempts);

    const framesApproved = frameStates.filter(f => f.finalStatus === 'approved').length;
    const framesRejected = frameStates.filter(f => f.finalStatus === 'rejected').length;
    const framesFailed = frameStates.filter(f => f.finalStatus === 'failed').length;
    const framesAttempted = frameStates.filter(f => f.attempts.length > 0).length;
    const framesRemaining = frameStates.filter(f =>
        !f.finalStatus && f.attempts.length === 0
    ).length;

    return {
        totalFrames: state.total_frames,
        framesAttempted,
        framesApproved,
        framesRejected,
        framesFailed,
        framesRemaining,
        totalAttempts: state.totalAttempts,
        retryRate: calculateRetryRate(state),
        rejectRate: calculateRejectRate(state),
        consecutiveFails: countConsecutiveFails(state),
    };
}

/**
 * Evaluate stop conditions
 * Returns first triggered condition (in priority order)
 *
 * Priority:
 * 1. Circuit Breaker (prevents runaway costs)
 * 2. Consecutive Fails (immediate systematic problem signal)
 * 3. Reject Rate (cumulative failure indicator)
 * 4. Retry Rate (efficiency indicator - least severe)
 */
export function evaluateStopConditions(
    state: RunStateWithAttempts,
    config: StopConditionsConfig = DEFAULT_STOP_CONDITIONS
): StopConditionResult {
    const statistics = calculateRunStatistics(state);

    // Priority 1: Circuit Breaker
    const circuitBreaker = checkCircuitBreaker(state, config.circuitBreakerLimit);
    if (circuitBreaker.tripped) {
        const reason: StopReason = {
            condition: 'CIRCUIT_BREAKER',
            value: circuitBreaker.totalAttempts,
            threshold: circuitBreaker.limit,
            message: `Circuit breaker tripped: ${circuitBreaker.totalAttempts} attempts (~$${circuitBreaker.estimatedCost.toFixed(2)})`,
        };

        logger.warn({
            event: 'stop_condition_triggered',
            ...reason,
            statistics,
        }, reason.message);

        return { shouldStop: true, reason, statistics };
    }

    // Priority 2: Consecutive Fails
    if (statistics.consecutiveFails >= config.maxConsecutiveFails) {
        const reason: StopReason = {
            condition: 'CONSECUTIVE_FAILS',
            value: statistics.consecutiveFails,
            threshold: config.maxConsecutiveFails,
            message: `Consecutive failures (${statistics.consecutiveFails}) exceeds threshold (${config.maxConsecutiveFails})`,
        };

        logger.warn({
            event: 'stop_condition_triggered',
            ...reason,
            statistics,
        }, reason.message);

        return { shouldStop: true, reason, statistics };
    }

    // Priority 3: Reject Rate
    if (statistics.rejectRate > config.maxRejectRate) {
        const reason: StopReason = {
            condition: 'REJECT_RATE',
            value: statistics.rejectRate,
            threshold: config.maxRejectRate,
            message: `Reject rate ${(statistics.rejectRate * 100).toFixed(1)}% exceeds ${config.maxRejectRate * 100}% threshold`,
        };

        logger.warn({
            event: 'stop_condition_triggered',
            ...reason,
            statistics,
        }, reason.message);

        return { shouldStop: true, reason, statistics };
    }

    // Priority 4: Retry Rate
    if (statistics.retryRate > config.maxRetryRate) {
        const reason: StopReason = {
            condition: 'RETRY_RATE',
            value: statistics.retryRate,
            threshold: config.maxRetryRate,
            message: `Retry rate ${(statistics.retryRate * 100).toFixed(1)}% exceeds ${config.maxRetryRate * 100}% threshold`,
        };

        logger.warn({
            event: 'stop_condition_triggered',
            ...reason,
            statistics,
        }, reason.message);

        return { shouldStop: true, reason, statistics };
    }

    // No stop condition triggered
    return { shouldStop: false, statistics };
}

/**
 * Create a user interrupt stop reason
 */
export function createUserInterruptReason(): StopReason {
    return {
        condition: 'USER_INTERRUPT',
        value: 0,
        threshold: 0,
        message: 'Run interrupted by user (SIGINT/SIGTERM)',
    };
}
