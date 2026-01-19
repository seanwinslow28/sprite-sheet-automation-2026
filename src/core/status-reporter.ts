/**
 * Status reporter - calculates and formats run status
 * Per Story 4.5: Implement Run Status Reporting
 */

import { logger } from '../utils/logger.js';
import type { RunStateWithAttempts } from './attempt-tracker.js';
import type { StopReason } from './stop-condition-evaluator.js';
import {
    type RunStatus,
    type RunMetrics,
    type InProgressDetails,
    type CompletedDetails,
    type StoppedDetails,
    type FailedDetails,
    type ReasonCode,
} from '../domain/types/run-status.js';

/**
 * Formatting constants
 */
const CLI_SEPARATOR_WIDTH = 55;
const PROGRESS_BAR_WIDTH = 16;

/**
 * Calculate run metrics from state
 */
export function calculateRunMetrics(state: RunStateWithAttempts): RunMetrics {
    const frameStates = Object.values(state.frameAttempts);

    const framesCompleted = frameStates.filter(f => f.finalStatus === 'approved').length;
    const framesFailed = frameStates.filter(f =>
        f.finalStatus === 'failed' || f.finalStatus === 'rejected'
    ).length;
    const framesRemaining = frameStates.filter(f =>
        !f.finalStatus && f.attempts.length === 0
    ).length;
    const framesWithRetries = frameStates.filter(f => f.attempts.length > 1).length;
    const attemptedFrames = frameStates.filter(f => f.attempts.length > 0).length;

    return {
        totalFrames: state.total_frames,
        framesCompleted,
        framesFailed,
        framesRemaining,
        totalAttempts: state.totalAttempts,
        retryRate: attemptedFrames > 0 ? framesWithRetries / attemptedFrames : 0,
        rejectRate: attemptedFrames > 0 ? framesFailed / attemptedFrames : 0,
    };
}

/**
 * Create in-progress status
 */
export function createInProgressStatus(
    state: RunStateWithAttempts,
    currentAction: string,
    startTime: Date
): RunStatus {
    const metrics = calculateRunMetrics(state);
    const elapsedMs = Date.now() - startTime.getTime();

    // Estimate remaining time based on average frame time
    let estimatedRemainingMs: number | undefined;
    const attemptedFrames = Object.values(state.frameAttempts).filter(f => f.attempts.length > 0).length;
    if (attemptedFrames > 0) {
        const avgTimePerFrame = elapsedMs / attemptedFrames;
        estimatedRemainingMs = Math.round(avgTimePerFrame * metrics.framesRemaining);
    }

    const details: InProgressDetails = {
        currentFrameIndex: state.current_frame,
        currentAttempt: state.current_attempt,
        elapsedTimeMs: elapsedMs,
        estimatedRemainingMs,
        currentAction,
    };

    const reasonCode: ReasonCode = mapActionToReasonCode(currentAction);

    return {
        status: 'in-progress',
        reasonCode,
        message: `${currentAction} frame ${state.current_frame + 1}/${state.total_frames}`,
        timestamp: new Date().toISOString(),
        metrics,
        details,
    };
}

/**
 * Map action string to reason code
 */
function mapActionToReasonCode(action: string): ReasonCode {
    const actionLower = action.toLowerCase();
    if (actionLower.includes('generat')) return 'GENERATING';
    if (actionLower.includes('audit')) return 'AUDITING';
    if (actionLower.includes('retry')) return 'RETRYING';
    if (actionLower.includes('align')) return 'ALIGNING';
    if (actionLower.includes('init')) return 'INITIALIZING';
    return 'GENERATING';
}

/**
 * Create completed status
 */
export function createCompletedStatus(
    state: RunStateWithAttempts,
    startTime: Date,
    exportLocation?: string,
    atlasFiles?: string[],
    validationPassed?: boolean
): RunStatus {
    const metrics = calculateRunMetrics(state);
    const totalDurationMs = Date.now() - startTime.getTime();
    const successRate = metrics.totalFrames > 0
        ? metrics.framesCompleted / metrics.totalFrames
        : 0;

    const details: CompletedDetails = {
        successRate,
        totalDurationMs,
        exportLocation,
        atlasFiles,
        validationPassed,
    };

    const reasonCode: ReasonCode = metrics.framesCompleted === metrics.totalFrames
        ? 'ALL_FRAMES_APPROVED'
        : 'PARTIAL_SUCCESS';

    const message = reasonCode === 'ALL_FRAMES_APPROVED'
        ? `All ${metrics.totalFrames} frames approved`
        : `${metrics.framesCompleted}/${metrics.totalFrames} frames approved (${metrics.framesFailed} failed)`;

    return {
        status: 'completed',
        reasonCode,
        message,
        timestamp: new Date().toISOString(),
        metrics,
        details,
    };
}

/**
 * Create stopped status
 */
export function createStoppedStatus(
    state: RunStateWithAttempts,
    stopReason: StopReason,
    _statistics?: unknown // Reserved for future use
): RunStatus {
    const metrics = calculateRunMetrics(state);

    const details: StoppedDetails = {
        stopCondition: stopReason.condition,
        threshold: stopReason.threshold,
        actualValue: stopReason.value,
        resumeCommand: `pipeline run --resume ${state.run_id}`,
        framesRemaining: metrics.framesRemaining,
    };

    const reasonCode = mapStopConditionToReasonCode(stopReason.condition);

    return {
        status: 'stopped',
        reasonCode,
        message: stopReason.message,
        timestamp: new Date().toISOString(),
        metrics,
        details,
    };
}

/**
 * Map stop condition to reason code
 */
function mapStopConditionToReasonCode(
    condition: 'RETRY_RATE' | 'REJECT_RATE' | 'CONSECUTIVE_FAILS' | 'CIRCUIT_BREAKER' | 'USER_INTERRUPT'
): ReasonCode {
    const mapping: Record<string, ReasonCode> = {
        'RETRY_RATE': 'RETRY_RATE_EXCEEDED',
        'REJECT_RATE': 'REJECT_RATE_EXCEEDED',
        'CONSECUTIVE_FAILS': 'CONSECUTIVE_FAILS',
        'CIRCUIT_BREAKER': 'CIRCUIT_BREAKER',
        'USER_INTERRUPT': 'USER_INTERRUPT',
    };
    return mapping[condition] ?? 'CIRCUIT_BREAKER';
}

/**
 * Create failed status
 */
export function createFailedStatus(
    state: RunStateWithAttempts,
    errorType: 'system' | 'dependency' | 'audit',
    errorCode: string,
    errorMessage: string,
    diagnosticPath?: string
): RunStatus {
    const metrics = calculateRunMetrics(state);

    const details: FailedDetails = {
        errorType,
        errorCode,
        errorMessage,
        diagnosticPath,
    };

    const reasonCode = mapErrorCodeToReasonCode(errorCode);

    return {
        status: 'failed',
        reasonCode,
        message: errorMessage,
        timestamp: new Date().toISOString(),
        metrics,
        details,
    };
}

/**
 * Map error code to reason code
 */
function mapErrorCodeToReasonCode(errorCode: string): ReasonCode {
    if (errorCode.includes('MANIFEST')) return 'SYS_MANIFEST_INVALID';
    if (errorCode.includes('API') || errorCode.includes('GEMINI')) return 'DEP_API_UNAVAILABLE';
    if (errorCode.includes('TEXTUREPACKER')) return 'DEP_TEXTUREPACKER_FAIL';
    if (errorCode.includes('WRITE') || errorCode.includes('FILE')) return 'SYS_WRITE_ERROR';
    return 'SYS_UNKNOWN_ERROR';
}

/**
 * Format status for CLI output
 */
export function formatStatusForCLI(status: RunStatus): string {
    const lines: string[] = [];

    // Header
    lines.push('');
    lines.push('═'.repeat(CLI_SEPARATOR_WIDTH));

    // Status with icon
    const statusIcon = getStatusIcon(status.status);
    lines.push(`Status:     ${statusIcon} ${status.status.toUpperCase()} (${status.reasonCode})`);

    // Progress
    if (status.status === 'in-progress') {
        const details = status.details as InProgressDetails;
        const progress = status.metrics.totalFrames > 0
            ? ((status.metrics.framesCompleted + 1) / status.metrics.totalFrames * 100)
            : 0;
        lines.push(`Frame:      ${details.currentFrameIndex + 1} of ${status.metrics.totalFrames} (Attempt ${details.currentAttempt})`);
        lines.push(`Elapsed:    ${formatDuration(details.elapsedTimeMs)}`);
        lines.push(`Progress:   ${formatProgressBar(progress)}`);
    }

    if (status.status === 'completed') {
        const details = status.details as CompletedDetails;
        const progress = 100;
        lines.push(`Duration:   ${formatDuration(details.totalDurationMs)}`);
        lines.push(`Progress:   ${formatProgressBar(progress)}`);
    }

    // Metrics
    lines.push('');
    lines.push('Metrics:');
    lines.push(`  Completed:  ${status.metrics.framesCompleted}/${status.metrics.totalFrames} frames`);
    lines.push(`  Failed:     ${status.metrics.framesFailed}/${status.metrics.totalFrames} frames`);
    lines.push(`  Attempts:   ${status.metrics.totalAttempts} total`);
    lines.push(`  Retry Rate: ${(status.metrics.retryRate * 100).toFixed(1)}%`);

    // Status-specific details
    if (status.status === 'stopped') {
        const details = status.details as StoppedDetails;
        lines.push('');
        lines.push(`Stop Reason: ${details.stopCondition}`);
        lines.push(`Resume:      ${details.resumeCommand}`);
    }

    if (status.status === 'completed') {
        const details = status.details as CompletedDetails;
        if (details.exportLocation) {
            lines.push('');
            lines.push('Export:');
            lines.push(`  Location:   ${details.exportLocation}`);
            if (details.atlasFiles) {
                lines.push(`  Atlas:      ${details.atlasFiles.join(', ')}`);
            }
            if (details.validationPassed !== undefined) {
                lines.push(`  Validation: ${details.validationPassed ? '✅ PASSED' : '❌ FAILED'}`);
            }
        }
    }

    if (status.status === 'failed') {
        const details = status.details as FailedDetails;
        lines.push('');
        lines.push('Error:');
        lines.push(`  Type:       ${details.errorType}`);
        lines.push(`  Code:       ${details.errorCode}`);
        lines.push(`  Message:    ${details.errorMessage}`);
        if (details.diagnosticPath) {
            lines.push(`  Diagnostic: ${details.diagnosticPath}`);
        }
    }

    lines.push('═'.repeat(CLI_SEPARATOR_WIDTH));
    lines.push('');

    return lines.join('\n');
}

/**
 * Get status icon
 */
function getStatusIcon(status: string): string {
    switch (status) {
        case 'in-progress': return '🔄';
        case 'completed': return '✅';
        case 'stopped': return '⚠️';
        case 'failed': return '❌';
        default: return '❓';
    }
}

/**
 * Get status color (for terminals that support ANSI)
 * Reserved for future terminal coloring support
 */
export function getStatusColor(status: string): string {
    switch (status) {
        case 'in-progress': return '\x1b[33m'; // Yellow
        case 'completed': return '\x1b[32m';   // Green
        case 'stopped': return '\x1b[33m';     // Yellow
        case 'failed': return '\x1b[31m';      // Red
        default: return '\x1b[0m';             // Reset
    }
}

/**
 * Format duration in human-readable form
 */
function formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
        return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    }
    if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
}

/**
 * Format progress bar
 */
function formatProgressBar(percent: number): string {
    const filled = Math.round(percent / 100 * PROGRESS_BAR_WIDTH);
    const empty = PROGRESS_BAR_WIDTH - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${percent.toFixed(1)}%`;
}

/**
 * Log status to structured logger
 */
export function logStatus(status: RunStatus): void {
    const level = status.status === 'failed' ? 'error'
        : status.status === 'stopped' ? 'warn'
            : 'info';

    logger[level]({
        event: 'run_status',
        status: status.status,
        reasonCode: status.reasonCode,
        metrics: status.metrics,
    }, status.message);
}
