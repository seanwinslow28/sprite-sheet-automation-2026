/**
 * Frame metrics writer - persists per-frame audit metrics
 * Per Story 6.2: Each frame has audit/frame_{index}_metrics.json
 */

import { promises as fs } from 'fs';
import path from 'path';
import { writeJsonAtomic } from '../../utils/fs-helpers.js';
import { logger } from '../../utils/logger.js';
import {
    type FrameMetrics,
    type AttemptSummary,
    FrameMetricsSchema,
    createEmptyFrameMetrics,
} from '../../domain/types/frame-metrics.js';
import type { CompositeScore } from './soft-metric-aggregator.js';

/**
 * Write frame metrics to file
 */
export async function writeFrameMetrics(
    runPath: string,
    frameIndex: number,
    metrics: FrameMetrics
): Promise<void> {
    const auditDir = path.join(runPath, 'audit');

    // Ensure audit directory exists
    await fs.mkdir(auditDir, { recursive: true });

    // Format frame index with leading zeros
    const paddedIndex = String(frameIndex).padStart(4, '0');
    const metricsPath = path.join(auditDir, `frame_${paddedIndex}_metrics.json`);

    // Atomic write
    await writeJsonAtomic(metricsPath, metrics);

    logger.debug({
        frameIndex,
        metricsPath,
        compositeScore: metrics.composite_score,
        passed: metrics.passed,
    }, `Frame ${frameIndex} metrics written`);
}

/**
 * Read frame metrics from file
 */
export async function readFrameMetrics(
    runPath: string,
    frameIndex: number
): Promise<FrameMetrics | null> {
    const paddedIndex = String(frameIndex).padStart(4, '0');
    const metricsPath = path.join(runPath, 'audit', `frame_${paddedIndex}_metrics.json`);

    try {
        const content = await fs.readFile(metricsPath, 'utf-8');
        const data = JSON.parse(content);

        // Validate against schema
        const result = FrameMetricsSchema.safeParse(data);
        if (!result.success) {
            logger.warn({
                frameIndex,
                metricsPath,
                errors: result.error.issues,
            }, 'Frame metrics file failed schema validation');
            return null;
        }

        return result.data;
    } catch (error) {
        // Try alternative naming (without leading zeros)
        const altPath = path.join(runPath, 'audit', `frame_${frameIndex}_metrics.json`);
        try {
            const content = await fs.readFile(altPath, 'utf-8');
            const data = JSON.parse(content);
            const result = FrameMetricsSchema.safeParse(data);
            if (result.success) {
                return result.data;
            }
        } catch {
            // File doesn't exist
        }

        return null;
    }
}

/**
 * Read all frame metrics from a run
 */
export async function readAllFrameMetrics(runPath: string): Promise<FrameMetrics[]> {
    const auditDir = path.join(runPath, 'audit');
    const metrics: FrameMetrics[] = [];

    try {
        const files = await fs.readdir(auditDir);

        // Find all frame metrics files and sort them
        const metricsFiles = files
            .filter(f => f.match(/^frame_\d+_metrics\.json$/))
            .sort((a, b) => {
                const indexA = parseInt(a.match(/frame_(\d+)_metrics\.json/)?.[1] ?? '0');
                const indexB = parseInt(b.match(/frame_(\d+)_metrics\.json/)?.[1] ?? '0');
                return indexA - indexB;
            });

        for (const file of metricsFiles) {
            const filePath = path.join(auditDir, file);
            try {
                const content = await fs.readFile(filePath, 'utf-8');
                const data = JSON.parse(content);
                const result = FrameMetricsSchema.safeParse(data);
                if (result.success) {
                    metrics.push(result.data);
                }
            } catch {
                // Skip files that can't be parsed
            }
        }
    } catch {
        // Audit directory doesn't exist
    }

    return metrics;
}

/**
 * Aggregation context for building frame metrics
 */
export interface AggregationContext {
    ssim: number;
    paletteFidelity: number;
    alphaArtifactScore: number;
    baselineDriftPx: number;
    orphanPixelCount: number;
    mapd?: {
        value: number;
        threshold: number;
        moveType: string;
        passed: boolean;
        bypassed: boolean;
    };
}

/**
 * Aggregate audit results into FrameMetrics
 */
export function aggregateFrameMetrics(
    frameIndex: number,
    compositeScore: CompositeScore,
    rawMetrics: AggregationContext,
    attemptHistory: AttemptSummary[],
    finalStatus: 'approved' | 'failed' | 'rejected' | 'pending',
    reasonCodes: string[],
    totalGenerationTimeMs: number,
    totalAuditTimeMs: number
): FrameMetrics {
    const now = new Date().toISOString();

    // Calculate weighted scores for breakdown with safe division
    // Guard against division by zero - if weight is 0, raw score is 0
    const safeDiv = (numerator: number, denominator: number): number =>
        denominator !== 0 ? numerator / denominator : 0;

    const identityRaw = safeDiv(compositeScore.weighted_scores.identity, compositeScore.weights_used.identity);
    const stabilityRaw = safeDiv(compositeScore.weighted_scores.stability, compositeScore.weights_used.stability);
    const paletteRaw = safeDiv(compositeScore.weighted_scores.palette, compositeScore.weights_used.palette);
    const styleRaw = safeDiv(compositeScore.weighted_scores.style, compositeScore.weights_used.style);

    return {
        frame_index: frameIndex,
        computed_at: now,

        passed: compositeScore.passed,
        status: finalStatus,
        reason_codes: reasonCodes,

        composite_score: compositeScore.composite_score,
        threshold: compositeScore.threshold,
        breakdown: {
            identity: {
                raw: identityRaw,
                weighted: compositeScore.weighted_scores.identity,
                passed: identityRaw >= 0.7,
            },
            stability: {
                raw: stabilityRaw,
                weighted: compositeScore.weighted_scores.stability,
                passed: stabilityRaw >= 0.7,
            },
            palette: {
                raw: paletteRaw,
                weighted: compositeScore.weighted_scores.palette,
                passed: paletteRaw >= 0.7,
            },
            style: {
                raw: styleRaw,
                weighted: compositeScore.weighted_scores.style,
                passed: styleRaw >= 0.7,
            },
        },

        metrics: {
            ssim: rawMetrics.ssim,
            palette_fidelity: rawMetrics.paletteFidelity,
            alpha_artifact_score: rawMetrics.alphaArtifactScore,
            baseline_drift_px: rawMetrics.baselineDriftPx,
            orphan_pixel_count: rawMetrics.orphanPixelCount,
            mapd: rawMetrics.mapd ? {
                value: rawMetrics.mapd.value,
                threshold: rawMetrics.mapd.threshold,
                move_type: rawMetrics.mapd.moveType,
                passed: rawMetrics.mapd.passed,
                bypassed: rawMetrics.mapd.bypassed,
            } : undefined,
        },

        attempt_count: attemptHistory.length,
        attempts: attemptHistory,

        total_generation_time_ms: totalGenerationTimeMs,
        total_audit_time_ms: totalAuditTimeMs,
    };
}

/**
 * Create attempt summary from attempt data
 */
export function createAttemptSummary(
    attemptIndex: number,
    result: 'passed' | 'soft_fail' | 'hard_fail',
    compositeScore: number,
    reasonCodes: string[],
    durationMs: number,
    actionTaken?: string
): AttemptSummary {
    return {
        attempt_index: attemptIndex,
        timestamp: new Date().toISOString(),
        result,
        composite_score: compositeScore,
        reason_codes: reasonCodes,
        action_taken: actionTaken,
        duration_ms: durationMs,
    };
}

// Re-export types
export { FrameMetrics, AttemptSummary, createEmptyFrameMetrics };
