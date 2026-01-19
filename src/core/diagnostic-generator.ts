/**
 * Diagnostic report generator - creates detailed failure analysis
 * Per Story 4.6: Implement Diagnostic Report Generation
 */

import { promises as fs } from 'fs';
import { dirname } from 'path';
import { logger } from '../utils/logger.js';
import { writeJsonAtomic, redactSecrets } from '../utils/fs-helpers.js';
import type { RunStateWithAttempts } from './attempt-tracker.js';
import type { StopReason, RunStatistics } from './stop-condition-evaluator.js';

/**
 * Frame breakdown for diagnostic report
 */
export interface FrameBreakdown {
    frameIndex: number;
    finalStatus: 'approved' | 'rejected' | 'failed' | 'pending';
    attemptCount: number;
    reasonCodes: string[];
    compositeScores: number[];
    actionsTried: string[];
    timeSpentMs: number;
}

/**
 * Failure code summary
 */
export interface FailureCodeSummary {
    code: string;
    count: number;
    percentage: number;
    exampleFrames: number[];
}

/**
 * Root cause suggestion
 */
export interface RootCauseSuggestion {
    suggestion: string;
    confidence: 'high' | 'medium' | 'low';
    contributingFactors: string[];
}

/**
 * Recovery action recommendation
 */
export interface RecoveryAction {
    action: string;
    description: string;
    appliesWhen: string[];
    effort: 'low' | 'medium' | 'high';
    priority: number;
}

/**
 * Complete diagnostic report
 */
export interface DiagnosticReport {
    generatedAt: string;
    runId: string;

    stopCondition: {
        type: string;
        threshold: number;
        actualValue: number;
        triggeredAt: string;
    };

    summary: {
        totalFrames: number;
        framesAttempted: number;
        framesApproved: number;
        framesRejected: number;
        framesFailed: number;
        totalAttempts: number;
        averageAttemptsPerFrame: number;
    };

    frameBreakdown: FrameBreakdown[];
    topFailures: FailureCodeSummary[];
    rootCause: RootCauseSuggestion;
    recoveryActions: RecoveryAction[];
}

/**
 * Root cause pattern definitions
 */
const ROOT_CAUSE_PATTERNS: Record<string, RootCauseSuggestion> = {
    'SF01_dominant': {
        suggestion: 'Anchor image may lack distinctive features or resolution for reliable identity matching.',
        confidence: 'high',
        contributingFactors: [
            'Low contrast in anchor image',
            'Anchor pose too different from animation poses',
            'Small anchor image size',
        ],
    },
    'SF02_dominant': {
        suggestion: 'Color palette constraints may be too strict for the generation model.',
        confidence: 'medium',
        contributingFactors: [
            'Palette has very similar colors',
            'Palette missing colors needed for shading',
            'Gemini interpreting palette literally',
        ],
    },
    'SF03_dominant': {
        suggestion: 'Baseline detection may be struggling with the character design.',
        confidence: 'medium',
        contributingFactors: [
            'Character has unclear feet/ground contact',
            'Transparency edge artifacts',
            'Non-standard character proportions',
        ],
    },
    'consecutive_fails': {
        suggestion: 'Systematic issue detected. Model may be consistently failing on this animation type.',
        confidence: 'low',
        contributingFactors: [
            'Animation complexity beyond current capability',
            'Reference images conflicting',
            'Prompt template needs adjustment',
        ],
    },
    'collapse_detected': {
        suggestion: 'Identity collapse indicates fundamental anchor/pose incompatibility.',
        confidence: 'high',
        contributingFactors: [
            'Anchor lacks resolution for extreme pose angles',
            'Style references conflicting with anchor',
            'Model unable to maintain identity through pose transition',
        ],
    },
};

/**
 * Recovery action templates
 */
const RECOVERY_ACTIONS: RecoveryAction[] = [
    {
        action: 'Increase anchor resolution',
        description: 'Use a 512x512 or larger anchor image with clear details',
        appliesWhen: ['SF01_IDENTITY_DRIFT', 'HF_IDENTITY_COLLAPSE'],
        effort: 'low',
        priority: 1,
    },
    {
        action: 'Loosen identity threshold',
        description: 'Reduce auditor.thresholds.identity_min from 0.8 to 0.7',
        appliesWhen: ['SF01_IDENTITY_DRIFT'],
        effort: 'low',
        priority: 2,
    },
    {
        action: 'Add more style references',
        description: 'Include 2-3 additional style reference images in inputs.style_refs',
        appliesWhen: ['SF01_IDENTITY_DRIFT', 'SF02_PALETTE_DRIFT'],
        effort: 'medium',
        priority: 3,
    },
    {
        action: 'Expand color palette',
        description: 'Add shading variants to the palette (highlight and shadow versions)',
        appliesWhen: ['SF02_PALETTE_DRIFT'],
        effort: 'medium',
        priority: 4,
    },
    {
        action: 'Simplify animation',
        description: 'Reduce frame count or choose simpler pose transitions',
        appliesWhen: ['HF_IDENTITY_COLLAPSE', 'consecutive_fails'],
        effort: 'high',
        priority: 5,
    },
    {
        action: 'Review anchor pose',
        description: 'Ensure anchor shows character in neutral pose matching animation start',
        appliesWhen: ['SF03_BASELINE_DRIFT', 'HF_IDENTITY_COLLAPSE'],
        effort: 'medium',
        priority: 6,
    },
    {
        action: 'Adjust negative prompt',
        description: 'Add specific avoidance terms based on observed failure patterns',
        appliesWhen: ['SF02_PALETTE_DRIFT', 'SF_ALPHA_HALO'],
        effort: 'low',
        priority: 7,
    },
];

/**
 * Generate frame breakdown from state
 */
function generateFrameBreakdown(state: RunStateWithAttempts): FrameBreakdown[] {
    return Object.values(state.frameAttempts).map(frame => {
        const reasonCodes: string[] = [];
        const compositeScores: number[] = [];
        const actionsTried: string[] = [];
        let timeSpentMs = 0;

        for (const attempt of frame.attempts) {
            reasonCodes.push(...attempt.reasonCodes);
            if (attempt.compositeScore !== undefined) {
                compositeScores.push(attempt.compositeScore);
            }
            if (attempt.strategy) {
                actionsTried.push(attempt.strategy);
            }
            timeSpentMs += attempt.durationMs;
        }

        const finalStatus: FrameBreakdown['finalStatus'] = frame.finalStatus ?? 'pending';
        return {
            frameIndex: frame.frameIndex,
            finalStatus,
            attemptCount: frame.attempts.length,
            reasonCodes: [...new Set(reasonCodes)], // Dedupe
            compositeScores,
            actionsTried: [...new Set(actionsTried)],
            timeSpentMs,
        };
    }).sort((a, b) => a.frameIndex - b.frameIndex);
}

/**
 * Aggregate failure codes
 */
function aggregateFailureCodes(
    frameBreakdown: FrameBreakdown[]
): FailureCodeSummary[] {
    const codeCounts = new Map<string, { count: number; frames: number[] }>();

    for (const frame of frameBreakdown) {
        for (const code of frame.reasonCodes) {
            const existing = codeCounts.get(code) ?? { count: 0, frames: [] };
            existing.count++;
            if (!existing.frames.includes(frame.frameIndex)) {
                existing.frames.push(frame.frameIndex);
            }
            codeCounts.set(code, existing);
        }
    }

    // Calculate total for percentage
    const totalCodes = Array.from(codeCounts.values())
        .reduce((sum, v) => sum + v.count, 0);

    // Convert to sorted array
    const summaries: FailureCodeSummary[] = Array.from(codeCounts.entries())
        .map(([code, data]) => ({
            code,
            count: data.count,
            percentage: totalCodes > 0 ? (data.count / totalCodes) * 100 : 0,
            exampleFrames: data.frames.slice(0, 3), // Top 3 examples
        }))
        .sort((a, b) => b.count - a.count);

    // Return top 3
    return summaries.slice(0, 3);
}

/**
 * Analyze root cause based on failure patterns
 */
function analyzeRootCause(
    topFailures: FailureCodeSummary[],
    stopReason: StopReason
): RootCauseSuggestion {
    // Check for identity collapse
    const hasCollapse = topFailures.some(f =>
        f.code.includes('COLLAPSE') || f.code.includes('HF_IDENTITY')
    );
    if (hasCollapse) {
        return {
            ...ROOT_CAUSE_PATTERNS['collapse_detected'],
            contributingFactors: [
                ...ROOT_CAUSE_PATTERNS['collapse_detected'].contributingFactors,
                `Top failure: ${topFailures[0]?.code} (${topFailures[0]?.count} occurrences)`,
            ],
        };
    }

    // Check for dominant SF01 (identity drift)
    if (topFailures[0]?.code.includes('SF01') && topFailures[0].percentage > 50) {
        return {
            ...ROOT_CAUSE_PATTERNS['SF01_dominant'],
            contributingFactors: [
                ...ROOT_CAUSE_PATTERNS['SF01_dominant'].contributingFactors,
                `SF01 accounts for ${topFailures[0].percentage.toFixed(0)}% of all failures`,
            ],
        };
    }

    // Check for dominant SF02 (palette)
    if (topFailures[0]?.code.includes('SF02') && topFailures[0].percentage > 40) {
        return {
            ...ROOT_CAUSE_PATTERNS['SF02_dominant'],
            contributingFactors: [
                ...ROOT_CAUSE_PATTERNS['SF02_dominant'].contributingFactors,
                `SF02 accounts for ${topFailures[0].percentage.toFixed(0)}% of all failures`,
            ],
        };
    }

    // Check for baseline drift
    if (topFailures[0]?.code.includes('SF03')) {
        return ROOT_CAUSE_PATTERNS['SF03_dominant'];
    }

    // Check for consecutive fails stop condition
    if (stopReason.condition === 'CONSECUTIVE_FAILS') {
        return {
            ...ROOT_CAUSE_PATTERNS['consecutive_fails'],
            contributingFactors: [
                ...ROOT_CAUSE_PATTERNS['consecutive_fails'].contributingFactors,
                `${stopReason.value} consecutive frames failed`,
            ],
        };
    }

    // Default: generic suggestion based on top failure
    return {
        suggestion: `Primary failure mode: ${topFailures[0]?.code ?? 'unknown'}. Review frame audit logs for details.`,
        confidence: 'low',
        contributingFactors: topFailures.map(f => `${f.code}: ${f.count} occurrences`),
    };
}

/**
 * Select relevant recovery actions
 */
function selectRecoveryActions(
    topFailures: FailureCodeSummary[]
): RecoveryAction[] {
    const relevantActions: RecoveryAction[] = [];
    const failureCodes = topFailures.map(f => f.code);

    for (const action of RECOVERY_ACTIONS) {
        const applies = action.appliesWhen.some(code =>
            failureCodes.some(fc => fc.includes(code) || code === 'consecutive_fails')
        );

        if (applies) {
            relevantActions.push(action);
        }
    }

    // Sort by priority and return top 4
    return relevantActions
        .sort((a, b) => a.priority - b.priority)
        .slice(0, 4);
}

/**
 * Generate complete diagnostic report
 */
export async function generateDiagnosticReport(
    state: RunStateWithAttempts,
    stopReason: StopReason,
    statistics: RunStatistics,
    outputPath: string
): Promise<DiagnosticReport> {
    const frameBreakdown = generateFrameBreakdown(state);
    const topFailures = aggregateFailureCodes(frameBreakdown);
    const rootCause = analyzeRootCause(topFailures, stopReason);
    const recoveryActions = selectRecoveryActions(topFailures);

    const report: DiagnosticReport = {
        generatedAt: new Date().toISOString(),
        runId: state.run_id,

        stopCondition: {
            type: stopReason.condition,
            threshold: stopReason.threshold,
            actualValue: stopReason.value,
            triggeredAt: new Date().toISOString(),
        },

        summary: {
            totalFrames: state.total_frames,
            framesAttempted: statistics.framesAttempted,
            framesApproved: statistics.framesApproved,
            framesRejected: statistics.framesRejected,
            framesFailed: statistics.framesFailed,
            totalAttempts: state.totalAttempts,
            averageAttemptsPerFrame: statistics.framesAttempted > 0
                ? state.totalAttempts / statistics.framesAttempted
                : 0,
        },

        frameBreakdown,
        topFailures,
        rootCause,
        recoveryActions,
    };

    // Sanitize and write to file
    const sanitizedReport = redactSecrets(report as unknown as Record<string, unknown>);

    // Ensure directory exists
    await fs.mkdir(dirname(outputPath), { recursive: true });

    // Write atomically
    await writeJsonAtomic(outputPath, sanitizedReport);

    logger.info({
        event: 'diagnostic_report_generated',
        runId: state.run_id,
        outputPath,
        topFailure: topFailures[0]?.code,
        rootCause: rootCause.suggestion.substring(0, 50) + '...',
    }, `Diagnostic report generated: ${outputPath}`);

    return report;
}

/**
 * Format diagnostic report for console output
 */
export function formatDiagnosticForConsole(report: DiagnosticReport): string {
    const lines: string[] = [];

    lines.push('');
    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('                    DIAGNOSTIC REPORT                           ');
    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('');

    // Stop condition
    lines.push(`STOP CONDITION: ${report.stopCondition.type}`);
    lines.push(`  Threshold: ${report.stopCondition.threshold}`);
    lines.push(`  Actual:    ${report.stopCondition.actualValue}`);
    lines.push('');

    // Summary
    lines.push('SUMMARY:');
    lines.push(`  Frames:     ${report.summary.framesApproved}/${report.summary.totalFrames} approved`);
    lines.push(`  Rejected:   ${report.summary.framesRejected}`);
    lines.push(`  Failed:     ${report.summary.framesFailed}`);
    lines.push(`  Attempts:   ${report.summary.totalAttempts} (avg ${report.summary.averageAttemptsPerFrame.toFixed(1)}/frame)`);
    lines.push('');

    // Top failures
    lines.push('TOP FAILURE CODES:');
    for (const failure of report.topFailures) {
        lines.push(`  ${failure.code}: ${failure.count} (${failure.percentage.toFixed(1)}%) [frames: ${failure.exampleFrames.join(', ')}]`);
    }
    lines.push('');

    // Root cause
    lines.push(`ROOT CAUSE (${report.rootCause.confidence} confidence):`);
    lines.push(`  ${report.rootCause.suggestion}`);
    lines.push('');
    lines.push('  Contributing factors:');
    for (const factor of report.rootCause.contributingFactors) {
        lines.push(`    - ${factor}`);
    }
    lines.push('');

    // Recovery actions
    lines.push('RECOMMENDED ACTIONS:');
    for (const action of report.recoveryActions) {
        lines.push(`  ${action.priority}. [${action.effort.toUpperCase()}] ${action.action}`);
        lines.push(`     ${action.description}`);
    }
    lines.push('');

    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('');

    return lines.join('\n');
}
