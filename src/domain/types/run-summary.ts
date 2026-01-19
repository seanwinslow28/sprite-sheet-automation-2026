/**
 * Run summary types and Zod schema
 * Per Story 6.3: Aggregate statistics for each run
 */

import { z } from 'zod';

/**
 * Failure code summary
 */
export const FailureCodeSummarySchema = z.object({
    code: z.string(),
    count: z.number().int().min(0),
    percentage: z.number().min(0).max(100),
    example_frames: z.array(z.number().int().min(0)),
});

export type FailureCodeSummary = z.infer<typeof FailureCodeSummarySchema>;

/**
 * Frame statistics
 */
export const FrameStatisticsSchema = z.object({
    total: z.number().int().min(0),
    attempted: z.number().int().min(0),
    approved: z.number().int().min(0),
    failed: z.number().int().min(0),
    rejected: z.number().int().min(0),
    pending: z.number().int().min(0),
});

export type FrameStatistics = z.infer<typeof FrameStatisticsSchema>;

/**
 * Rate statistics
 */
export const RateStatisticsSchema = z.object({
    completion_rate: z.number().min(0).max(1),
    retry_rate: z.number().min(0).max(1),
    reject_rate: z.number().min(0).max(1),
    success_rate: z.number().min(0).max(1),
});

export type RateStatistics = z.infer<typeof RateStatisticsSchema>;

/**
 * Attempt statistics
 */
export const AttemptStatisticsSchema = z.object({
    total: z.number().int().min(0),
    per_frame_average: z.number().min(0),
    min_per_frame: z.number().int().min(0),
    max_per_frame: z.number().int().min(0),
});

export type AttemptStatistics = z.infer<typeof AttemptStatisticsSchema>;

/**
 * Timing breakdown
 */
export const TimingBreakdownSchema = z.object({
    generation_ms: z.number().int().min(0),
    audit_ms: z.number().int().min(0),
    export_ms: z.number().int().min(0),
    other_ms: z.number().int().min(0),
});

export type TimingBreakdown = z.infer<typeof TimingBreakdownSchema>;

/**
 * Timing statistics
 */
export const TimingStatisticsSchema = z.object({
    start_time: z.string().datetime(),
    end_time: z.string().datetime(),
    total_duration_ms: z.number().int().min(0),
    average_per_frame_ms: z.number().min(0),
    average_per_attempt_ms: z.number().min(0),
    breakdown: TimingBreakdownSchema,
});

export type TimingStatistics = z.infer<typeof TimingStatisticsSchema>;

/**
 * Configuration used
 */
export const ConfigSummarySchema = z.object({
    character: z.string(),
    move: z.string(),
    frame_count: z.number().int().min(0),
    max_attempts_per_frame: z.number().int().min(1),
});

export type ConfigSummary = z.infer<typeof ConfigSummarySchema>;

/**
 * Export info
 */
export const ExportSummarySchema = z.object({
    atlas_path: z.string(),
    sheet_count: z.number().int().min(0),
    release_status: z.string(),
    validation_passed: z.boolean(),
});

export type ExportSummary = z.infer<typeof ExportSummarySchema>;

/**
 * Full run summary schema
 */
export const RunSummarySchema = z.object({
    run_id: z.string(),
    generated_at: z.string().datetime(),
    final_status: z.enum(['completed', 'stopped', 'failed']),

    frames: FrameStatisticsSchema,
    rates: RateStatisticsSchema,
    attempts: AttemptStatisticsSchema,
    top_failures: z.array(FailureCodeSummarySchema),
    timing: TimingStatisticsSchema,
    config: ConfigSummarySchema,
    export: ExportSummarySchema.optional(),
});

export type RunSummary = z.infer<typeof RunSummarySchema>;
