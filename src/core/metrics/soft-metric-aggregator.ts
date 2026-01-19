/**
 * Soft Metric Aggregator - combines individual metrics into composite score
 * Per Story 3.8: Weighted scoring and retry flagging
 */

import { logger } from '../../utils/logger.js';

/**
 * Individual metric scores (inputs to aggregator)
 */
export interface MetricInputs {
    stability?: number;   // 0.0 - 1.0
    identity?: number;    // SSIM score 0.0 - 1.0
    palette?: number;     // Fidelity score 0.0 - 1.0
    style?: number;       // Style consistency 0.0 - 1.0
}

/**
 * Aggregated composite score result
 */
export interface CompositeScore {
    composite_score: number;        // 0.0 - 1.0
    weighted_scores: {
        stability: number;
        identity: number;
        palette: number;
        style: number;
    };
    weights_used: {
        stability: number;
        identity: number;
        palette: number;
        style: number;
    };
    metrics_provided: string[];
    passed: boolean;
    threshold: number;
    should_retry: boolean;
}

// Default weights per Story 3.8
const DEFAULT_WEIGHTS = {
    stability: 0.35,
    identity: 0.30,
    palette: 0.20,
    style: 0.15,
};

// Default composite threshold
const DEFAULT_COMPOSITE_THRESHOLD = 0.70;

/**
 * Calculate composite score from individual metrics
 */
export function calculateCompositeScore(
    metrics: MetricInputs,
    threshold: number = DEFAULT_COMPOSITE_THRESHOLD,
    weights: typeof DEFAULT_WEIGHTS = DEFAULT_WEIGHTS
): CompositeScore {
    // Determine which metrics were provided
    const metricsProvided: string[] = [];
    let totalWeight = 0;
    let weightedSum = 0;

    const weightedScores = {
        stability: 0,
        identity: 0,
        palette: 0,
        style: 0,
    };

    // Process each metric
    if (metrics.stability !== undefined) {
        metricsProvided.push('stability');
        weightedScores.stability = metrics.stability * weights.stability;
        weightedSum += weightedScores.stability;
        totalWeight += weights.stability;
    }

    if (metrics.identity !== undefined) {
        metricsProvided.push('identity');
        weightedScores.identity = metrics.identity * weights.identity;
        weightedSum += weightedScores.identity;
        totalWeight += weights.identity;
    }

    if (metrics.palette !== undefined) {
        metricsProvided.push('palette');
        weightedScores.palette = metrics.palette * weights.palette;
        weightedSum += weightedScores.palette;
        totalWeight += weights.palette;
    }

    if (metrics.style !== undefined) {
        metricsProvided.push('style');
        weightedScores.style = metrics.style * weights.style;
        weightedSum += weightedScores.style;
        totalWeight += weights.style;
    }

    // Normalize by total weight of provided metrics
    const compositeScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
    const passed = compositeScore >= threshold;
    const shouldRetry = !passed;

    logger.debug({
        compositeScore,
        metricsProvided,
        passed,
        threshold,
        shouldRetry,
    }, 'Composite score calculated');

    return {
        composite_score: compositeScore,
        weighted_scores: weightedScores,
        weights_used: weights,
        metrics_provided: metricsProvided,
        passed,
        threshold,
        should_retry: shouldRetry,
    };
}

/**
 * Determine if a frame should be retried based on composite score
 */
export function shouldRetryFrame(compositeScore: number, threshold: number = DEFAULT_COMPOSITE_THRESHOLD): boolean {
    return compositeScore < threshold;
}
