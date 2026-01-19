/**
 * Frame metrics types and Zod schema
 * Per Story 6.2: Per-frame audit metrics as structured data
 */

import { z } from 'zod';

/**
 * Attempt summary for attempt history
 */
export const AttemptSummarySchema = z.object({
    attempt_index: z.number().int().min(1),
    timestamp: z.string().datetime(),
    result: z.enum(['passed', 'soft_fail', 'hard_fail']),
    composite_score: z.number().min(0).max(1),
    reason_codes: z.array(z.string()),
    action_taken: z.string().optional(),
    duration_ms: z.number().int().min(0),
});

export type AttemptSummary = z.infer<typeof AttemptSummarySchema>;

/**
 * Metric breakdown item
 */
export const MetricBreakdownItemSchema = z.object({
    raw: z.number().min(0).max(1),
    weighted: z.number().min(0),
    passed: z.boolean(),
});

export type MetricBreakdownItem = z.infer<typeof MetricBreakdownItemSchema>;

/**
 * MAPD metric details
 */
export const MAPDMetricSchema = z.object({
    value: z.number().min(0),
    threshold: z.number().min(0),
    move_type: z.string(),
    passed: z.boolean(),
    bypassed: z.boolean(),
});

export type MAPDMetric = z.infer<typeof MAPDMetricSchema>;

/**
 * Individual metrics values
 */
export const IndividualMetricsSchema = z.object({
    ssim: z.number().min(0).max(1),
    palette_fidelity: z.number().min(0).max(1),
    alpha_artifact_score: z.number().min(0).max(1),
    baseline_drift_px: z.number().min(0),
    orphan_pixel_count: z.number().int().min(0),
    mapd: MAPDMetricSchema.optional(),
});

export type IndividualMetrics = z.infer<typeof IndividualMetricsSchema>;

/**
 * Full frame metrics schema
 */
export const FrameMetricsSchema = z.object({
    frame_index: z.number().int().min(0),
    computed_at: z.string().datetime(),

    // Final status
    passed: z.boolean(),
    status: z.enum(['approved', 'failed', 'rejected', 'pending']),
    reason_codes: z.array(z.string()),

    // Composite scoring
    composite_score: z.number().min(0).max(1),
    threshold: z.number().min(0).max(1),
    breakdown: z.object({
        identity: MetricBreakdownItemSchema,
        stability: MetricBreakdownItemSchema,
        palette: MetricBreakdownItemSchema,
        style: MetricBreakdownItemSchema,
    }),

    // Individual metrics
    metrics: IndividualMetricsSchema,

    // Attempt history
    attempt_count: z.number().int().min(0),
    attempts: z.array(AttemptSummarySchema),

    // Timing
    total_generation_time_ms: z.number().int().min(0),
    total_audit_time_ms: z.number().int().min(0),
});

export type FrameMetrics = z.infer<typeof FrameMetricsSchema>;

/**
 * Create default/empty frame metrics for initialization
 */
export function createEmptyFrameMetrics(frameIndex: number): FrameMetrics {
    const now = new Date().toISOString();
    return {
        frame_index: frameIndex,
        computed_at: now,
        passed: false,
        status: 'pending',
        reason_codes: [],
        composite_score: 0,
        threshold: 0.70,
        breakdown: {
            identity: { raw: 0, weighted: 0, passed: false },
            stability: { raw: 0, weighted: 0, passed: false },
            palette: { raw: 0, weighted: 0, passed: false },
            style: { raw: 0, weighted: 0, passed: false },
        },
        metrics: {
            ssim: 0,
            palette_fidelity: 0,
            alpha_artifact_score: 0,
            baseline_drift_px: 0,
            orphan_pixel_count: 0,
        },
        attempt_count: 0,
        attempts: [],
        total_generation_time_ms: 0,
        total_audit_time_ms: 0,
    };
}
