/**
 * Run summary generator - creates aggregate statistics for each run
 * Per Story 6.3: Summary file generated when run finishes
 */

import { promises as fs } from 'fs';
import path from 'path';
import { writeJsonAtomic } from '../../utils/fs-helpers.js';
import { logger } from '../../utils/logger.js';
import type { RunState } from '../state-manager.js';
import type { RunStateWithAttempts } from '../attempt-tracker.js';
import {
    type RunSummary,
    type FrameStatistics,
    type RateStatistics,
    type AttemptStatistics,
    type FailureCodeSummary,
    type TimingStatistics,
    type ConfigSummary,
    RunSummarySchema,
} from '../../domain/types/run-summary.js';

/**
 * Context for summary generation
 */
export interface SummaryContext {
    runPath: string;
    state: RunState | RunStateWithAttempts;
    finalStatus: 'completed' | 'stopped' | 'failed';
    startTime: Date;
    endTime?: Date;
    config?: {
        character: string;
        move: string;
        frameCount: number;
        maxAttemptsPerFrame: number;
    };
    exportInfo?: {
        atlasPath: string;
        sheetCount: number;
        releaseStatus: string;
        validationPassed: boolean;
    };
    timingBreakdown?: {
        generationMs: number;
        auditMs: number;
        exportMs: number;
    };
}

/**
 * Calculate frame statistics
 */
export function calculateFrameStatistics(state: RunState): FrameStatistics {
    const approved = state.frame_states.filter(f => f.status === 'approved').length;
    const failed = state.frame_states.filter(f => f.status === 'failed').length;
    const pending = state.frame_states.filter(f => f.status === 'pending').length;
    const inProgress = state.frame_states.filter(f => f.status === 'in_progress').length;

    // Rejected = frames with identity collapse (status could be 'failed' with specific error)
    // For now, count frames that failed on first attempt as rejected
    const rejected = state.frame_states.filter(f =>
        f.status === 'failed' && f.last_error?.includes('COLLAPSE')
    ).length;

    const attempted = approved + failed;

    return {
        total: state.total_frames,
        attempted,
        approved,
        failed: failed - rejected, // Subtract rejected from failed
        rejected,
        pending: pending + inProgress,
    };
}

/**
 * Calculate rate statistics
 */
export function calculateRateStatistics(
    frames: FrameStatistics,
    state: RunState
): RateStatistics {
    const framesWithRetries = state.frame_states.filter(f => f.attempts > 1).length;

    return {
        completion_rate: frames.total > 0 ? frames.approved / frames.total : 0,
        retry_rate: frames.attempted > 0 ? framesWithRetries / frames.attempted : 0,
        reject_rate: frames.attempted > 0 ? frames.rejected / frames.attempted : 0,
        success_rate: frames.attempted > 0 ? frames.approved / frames.attempted : 0,
    };
}

/**
 * Calculate attempt statistics
 */
export function calculateAttemptStatistics(state: RunState): AttemptStatistics {
    const attemptCounts = state.frame_states.map(f => f.attempts);
    const validCounts = attemptCounts.filter(c => c > 0);

    const total = attemptCounts.reduce((sum, c) => sum + c, 0);
    const attempted = validCounts.length;

    return {
        total,
        per_frame_average: attempted > 0 ? total / attempted : 0,
        min_per_frame: validCounts.length > 0 ? Math.min(...validCounts) : 0,
        max_per_frame: validCounts.length > 0 ? Math.max(...validCounts) : 0,
    };
}

/**
 * Calculate top failure codes from state with attempts
 */
export function calculateTopFailures(
    state: RunState | RunStateWithAttempts,
    limit: number = 3
): FailureCodeSummary[] {
    const codeCounts = new Map<string, { count: number; frames: number[] }>();

    // Check if we have detailed attempt tracking
    const stateWithAttempts = state as RunStateWithAttempts;
    if (stateWithAttempts.frameAttempts) {
        for (const [frameIdx, frameData] of Object.entries(stateWithAttempts.frameAttempts)) {
            for (const attempt of frameData.attempts) {
                for (const code of attempt.reasonCodes) {
                    const existing = codeCounts.get(code) ?? { count: 0, frames: [] };
                    existing.count++;
                    const idx = parseInt(frameIdx);
                    if (!existing.frames.includes(idx)) {
                        existing.frames.push(idx);
                    }
                    codeCounts.set(code, existing);
                }
            }
        }
    } else {
        // Fallback: use last_error from basic state
        for (const frame of state.frame_states) {
            if (frame.last_error) {
                const existing = codeCounts.get(frame.last_error) ?? { count: 0, frames: [] };
                existing.count++;
                if (!existing.frames.includes(frame.index)) {
                    existing.frames.push(frame.index);
                }
                codeCounts.set(frame.last_error, existing);
            }
        }
    }

    const total = Array.from(codeCounts.values()).reduce((s, v) => s + v.count, 0);

    return Array.from(codeCounts.entries())
        .map(([code, data]) => ({
            code,
            count: data.count,
            percentage: total > 0 ? (data.count / total) * 100 : 0,
            example_frames: data.frames.slice(0, 3),
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
}

/**
 * Calculate timing statistics
 */
export function calculateTimingStatistics(
    startTime: Date,
    endTime: Date,
    frames: FrameStatistics,
    attempts: AttemptStatistics,
    breakdown?: { generationMs: number; auditMs: number; exportMs: number }
): TimingStatistics {
    const totalDurationMs = endTime.getTime() - startTime.getTime();
    const avgPerFrame = frames.attempted > 0 ? totalDurationMs / frames.attempted : 0;
    const avgPerAttempt = attempts.total > 0 ? totalDurationMs / attempts.total : 0;

    // Calculate breakdown
    const generationMs = breakdown?.generationMs ?? Math.round(totalDurationMs * 0.8);
    const auditMs = breakdown?.auditMs ?? Math.round(totalDurationMs * 0.15);
    const exportMs = breakdown?.exportMs ?? 0;
    const otherMs = totalDurationMs - generationMs - auditMs - exportMs;

    return {
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        total_duration_ms: totalDurationMs,
        average_per_frame_ms: Math.round(avgPerFrame),
        average_per_attempt_ms: Math.round(avgPerAttempt),
        breakdown: {
            generation_ms: generationMs,
            audit_ms: auditMs,
            export_ms: exportMs,
            other_ms: Math.max(0, otherMs),
        },
    };
}

/**
 * Generate run summary
 */
export function generateRunSummary(context: SummaryContext): RunSummary {
    const endTime = context.endTime ?? new Date();
    const frames = calculateFrameStatistics(context.state);
    const rates = calculateRateStatistics(frames, context.state);
    const attempts = calculateAttemptStatistics(context.state);
    const topFailures = calculateTopFailures(context.state);
    const timing = calculateTimingStatistics(
        context.startTime,
        endTime,
        frames,
        attempts,
        context.timingBreakdown
    );

    // Convert camelCase context config to snake_case schema format
    const config: ConfigSummary = context.config
        ? {
            character: context.config.character,
            move: context.config.move,
            frame_count: context.config.frameCount,
            max_attempts_per_frame: context.config.maxAttemptsPerFrame,
        }
        : {
            character: 'unknown',
            move: 'unknown',
            frame_count: context.state.total_frames,
            max_attempts_per_frame: 5,
        };

    const summary: RunSummary = {
        run_id: context.state.run_id,
        generated_at: new Date().toISOString(),
        final_status: context.finalStatus,
        frames,
        rates,
        attempts,
        top_failures: topFailures,
        timing,
        config,
    };

    // Add export info if available
    if (context.exportInfo) {
        summary.export = {
            atlas_path: context.exportInfo.atlasPath,
            sheet_count: context.exportInfo.sheetCount,
            release_status: context.exportInfo.releaseStatus,
            validation_passed: context.exportInfo.validationPassed,
        };
    }

    return summary;
}

/**
 * Write summary to file
 */
export async function writeSummary(
    runPath: string,
    summary: RunSummary
): Promise<string> {
    const summaryPath = path.join(runPath, 'summary.json');

    // Validate before writing
    const validated = RunSummarySchema.parse(summary);

    // Write atomically with pretty formatting
    await writeJsonAtomic(summaryPath, validated);

    logger.info({
        event: 'summary_generated',
        runId: summary.run_id,
        summaryPath,
        finalStatus: summary.final_status,
        approved: summary.frames.approved,
        total: summary.frames.total,
    }, `Run summary written: ${summaryPath}`);

    return summaryPath;
}

/**
 * Generate and write summary in one call
 */
export async function generateAndWriteSummary(
    context: SummaryContext
): Promise<RunSummary> {
    const summary = generateRunSummary(context);
    await writeSummary(context.runPath, summary);
    return summary;
}

/**
 * Read summary from file
 */
export async function readSummary(runPath: string): Promise<RunSummary | null> {
    const summaryPath = path.join(runPath, 'summary.json');

    try {
        const content = await fs.readFile(summaryPath, 'utf-8');
        const data = JSON.parse(content);
        const result = RunSummarySchema.safeParse(data);
        if (result.success) {
            return result.data;
        }
        logger.warn({ runPath, errors: result.error.issues }, 'Summary file failed validation');
        return null;
    } catch {
        return null;
    }
}
