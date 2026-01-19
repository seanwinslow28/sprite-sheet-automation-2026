/**
 * Tests for diagnostic report generator
 * Per Story 4.6: Implement Diagnostic Report Generation
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
    generateDiagnosticReport,
    formatDiagnosticForConsole,
    type DiagnosticReport,
    type FrameBreakdown,
    type FailureCodeSummary,
    type RootCauseSuggestion,
    type RecoveryAction,
} from '../../src/core/diagnostic-generator.js';
import {
    initializeAttemptTracking,
    recordAttempt,
    type RunStateWithAttempts,
} from '../../src/core/attempt-tracker.js';
import { initializeState } from '../../src/core/state-manager.js';
import type { StopReason, RunStatistics } from '../../src/core/stop-condition-evaluator.js';

describe('Diagnostic Generator', () => {
    let state: RunStateWithAttempts;
    let tmpDir: string;

    beforeEach(async () => {
        const baseState = initializeState('test-run', 4);
        state = initializeAttemptTracking(baseState, 4);

        // Create temp directory for test outputs
        tmpDir = join(tmpdir(), `diagnostic-test-${Date.now()}`);
        await fs.mkdir(tmpDir, { recursive: true });
    });

    afterEach(async () => {
        // Clean up temp directory
        try {
            await fs.rm(tmpDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    describe('generateDiagnosticReport', () => {
        it('should generate a complete diagnostic report', async () => {
            // Set up state with some failures
            state = recordAttempt(state, 0, {
                timestamp: new Date().toISOString(),
                promptHash: 'a',
                result: 'passed',
                reasonCodes: [],
                durationMs: 1000,
            });
            state.frameAttempts[0].finalStatus = 'approved';

            state = recordAttempt(state, 1, {
                timestamp: new Date().toISOString(),
                promptHash: 'b1',
                result: 'soft_fail',
                reasonCodes: ['SF01_IDENTITY_DRIFT'],
                compositeScore: 0.65,
                durationMs: 1200,
                strategy: 'REROLL_SEED',
            });
            state = recordAttempt(state, 1, {
                timestamp: new Date().toISOString(),
                promptHash: 'b2',
                result: 'soft_fail',
                reasonCodes: ['SF01_IDENTITY_DRIFT'],
                compositeScore: 0.7,
                durationMs: 1100,
                strategy: 'IDENTITY_RESCUE',
            });
            state.frameAttempts[1].finalStatus = 'failed';

            const stopReason: StopReason = {
                condition: 'RETRY_RATE',
                value: 0.6,
                threshold: 0.5,
                message: 'Retry rate exceeded',
            };

            const statistics: RunStatistics = {
                totalFrames: 4,
                framesAttempted: 2,
                framesApproved: 1,
                framesRejected: 0,
                framesFailed: 1,
                framesRemaining: 2,
                totalAttempts: 3,
                retryRate: 0.5,
                rejectRate: 0.5,
                consecutiveFails: 1,
            };

            const outputPath = join(tmpDir, 'diagnostic.json');
            const report = await generateDiagnosticReport(
                state,
                stopReason,
                statistics,
                outputPath
            );

            // Verify report structure
            expect(report.generatedAt).toBeDefined();
            expect(report.runId).toBe('test-run');
            expect(report.stopCondition.type).toBe('RETRY_RATE');
            expect(report.stopCondition.threshold).toBe(0.5);
            expect(report.stopCondition.actualValue).toBe(0.6);

            // Verify summary
            expect(report.summary.totalFrames).toBe(4);
            expect(report.summary.framesApproved).toBe(1);
            expect(report.summary.framesFailed).toBe(1);
            expect(report.summary.totalAttempts).toBe(3);

            // Verify frame breakdown
            expect(report.frameBreakdown).toHaveLength(4);
            expect(report.frameBreakdown[0].finalStatus).toBe('approved');
            expect(report.frameBreakdown[1].finalStatus).toBe('failed');
            expect(report.frameBreakdown[1].attemptCount).toBe(2);
            expect(report.frameBreakdown[1].reasonCodes).toContain('SF01_IDENTITY_DRIFT');
            expect(report.frameBreakdown[1].actionsTried).toContain('REROLL_SEED');
            expect(report.frameBreakdown[1].actionsTried).toContain('IDENTITY_RESCUE');

            // Verify top failures
            expect(report.topFailures.length).toBeGreaterThan(0);
            expect(report.topFailures[0].code).toContain('SF01');

            // Verify root cause
            expect(report.rootCause.suggestion).toBeDefined();
            expect(report.rootCause.confidence).toBeDefined();
            expect(report.rootCause.contributingFactors.length).toBeGreaterThan(0);

            // Verify file was written
            const fileContent = await fs.readFile(outputPath, 'utf-8');
            const parsedFile = JSON.parse(fileContent);
            expect(parsedFile.runId).toBe('test-run');
        });

        it('should handle empty state', async () => {
            const stopReason: StopReason = {
                condition: 'CIRCUIT_BREAKER',
                value: 0,
                threshold: 50,
                message: 'Circuit breaker',
            };

            const statistics: RunStatistics = {
                totalFrames: 4,
                framesAttempted: 0,
                framesApproved: 0,
                framesRejected: 0,
                framesFailed: 0,
                framesRemaining: 4,
                totalAttempts: 0,
                retryRate: 0,
                rejectRate: 0,
                consecutiveFails: 0,
            };

            const outputPath = join(tmpDir, 'diagnostic-empty.json');
            const report = await generateDiagnosticReport(
                state,
                stopReason,
                statistics,
                outputPath
            );

            expect(report.frameBreakdown).toHaveLength(4);
            expect(report.frameBreakdown.every(f => f.finalStatus === 'pending')).toBe(true);
            expect(report.summary.totalAttempts).toBe(0);
        });

        it('should identify SF01 dominant root cause', async () => {
            // Create multiple SF01 failures
            for (let i = 0; i < 3; i++) {
                state = recordAttempt(state, i, {
                    timestamp: new Date().toISOString(),
                    promptHash: `${i}`,
                    result: 'soft_fail',
                    reasonCodes: ['SF01_IDENTITY_DRIFT'],
                    compositeScore: 0.6,
                    durationMs: 1000,
                });
                state.frameAttempts[i].finalStatus = 'failed';
            }

            const stopReason: StopReason = {
                condition: 'CONSECUTIVE_FAILS',
                value: 3,
                threshold: 3,
                message: 'Consecutive fails',
            };

            const statistics: RunStatistics = {
                totalFrames: 4,
                framesAttempted: 3,
                framesApproved: 0,
                framesRejected: 0,
                framesFailed: 3,
                framesRemaining: 1,
                totalAttempts: 3,
                retryRate: 0,
                rejectRate: 1,
                consecutiveFails: 3,
            };

            const outputPath = join(tmpDir, 'diagnostic-sf01.json');
            const report = await generateDiagnosticReport(
                state,
                stopReason,
                statistics,
                outputPath
            );

            expect(report.topFailures[0].code).toContain('SF01');
            expect(report.rootCause.suggestion).toContain('identity');
            expect(report.rootCause.confidence).toBe('high');
        });

        it('should identify identity collapse root cause', async () => {
            state = recordAttempt(state, 0, {
                timestamp: new Date().toISOString(),
                promptHash: 'a',
                result: 'hard_fail',
                reasonCodes: ['HF_IDENTITY_COLLAPSE'],
                durationMs: 1000,
            });
            state.frameAttempts[0].finalStatus = 'rejected';

            const stopReason: StopReason = {
                condition: 'CONSECUTIVE_FAILS',
                value: 1,
                threshold: 3,
                message: 'Identity collapse detected',
            };

            const statistics: RunStatistics = {
                totalFrames: 4,
                framesAttempted: 1,
                framesApproved: 0,
                framesRejected: 1,
                framesFailed: 0,
                framesRemaining: 3,
                totalAttempts: 1,
                retryRate: 0,
                rejectRate: 1,
                consecutiveFails: 1,
            };

            const outputPath = join(tmpDir, 'diagnostic-collapse.json');
            const report = await generateDiagnosticReport(
                state,
                stopReason,
                statistics,
                outputPath
            );

            expect(report.rootCause.suggestion).toContain('collapse');
            expect(report.rootCause.confidence).toBe('high');
        });

        it('should select relevant recovery actions', async () => {
            state = recordAttempt(state, 0, {
                timestamp: new Date().toISOString(),
                promptHash: 'a',
                result: 'soft_fail',
                reasonCodes: ['SF01_IDENTITY_DRIFT'],
                durationMs: 1000,
            });
            state.frameAttempts[0].finalStatus = 'failed';

            const stopReason: StopReason = {
                condition: 'RETRY_RATE',
                value: 1,
                threshold: 0.5,
                message: 'Retry rate exceeded',
            };

            const statistics: RunStatistics = {
                totalFrames: 4,
                framesAttempted: 1,
                framesApproved: 0,
                framesRejected: 0,
                framesFailed: 1,
                framesRemaining: 3,
                totalAttempts: 1,
                retryRate: 0,
                rejectRate: 1,
                consecutiveFails: 1,
            };

            const outputPath = join(tmpDir, 'diagnostic-actions.json');
            const report = await generateDiagnosticReport(
                state,
                stopReason,
                statistics,
                outputPath
            );

            expect(report.recoveryActions.length).toBeGreaterThan(0);
            // Should include anchor resolution action for SF01
            expect(report.recoveryActions.some(a =>
                a.action.toLowerCase().includes('anchor') ||
                a.action.toLowerCase().includes('identity')
            )).toBe(true);
        });

        it('should calculate average attempts per frame', async () => {
            // 3 attempts for frame 0
            for (let i = 0; i < 3; i++) {
                state = recordAttempt(state, 0, {
                    timestamp: new Date().toISOString(),
                    promptHash: `0-${i}`,
                    result: i === 2 ? 'passed' : 'soft_fail',
                    reasonCodes: i === 2 ? [] : ['SF01'],
                    durationMs: 1000,
                });
            }
            state.frameAttempts[0].finalStatus = 'approved';

            // 2 attempts for frame 1
            for (let i = 0; i < 2; i++) {
                state = recordAttempt(state, 1, {
                    timestamp: new Date().toISOString(),
                    promptHash: `1-${i}`,
                    result: i === 1 ? 'passed' : 'soft_fail',
                    reasonCodes: i === 1 ? [] : ['SF02'],
                    durationMs: 1000,
                });
            }
            state.frameAttempts[1].finalStatus = 'approved';

            const stopReason: StopReason = {
                condition: 'CIRCUIT_BREAKER',
                value: 5,
                threshold: 50,
                message: 'Circuit breaker',
            };

            const statistics: RunStatistics = {
                totalFrames: 4,
                framesAttempted: 2,
                framesApproved: 2,
                framesRejected: 0,
                framesFailed: 0,
                framesRemaining: 2,
                totalAttempts: 5,
                retryRate: 1,
                rejectRate: 0,
                consecutiveFails: 0,
            };

            const outputPath = join(tmpDir, 'diagnostic-avg.json');
            const report = await generateDiagnosticReport(
                state,
                stopReason,
                statistics,
                outputPath
            );

            // 5 attempts / 2 frames = 2.5
            expect(report.summary.averageAttemptsPerFrame).toBe(2.5);
        });

        it('should create nested directories if needed', async () => {
            const nestedPath = join(tmpDir, 'nested', 'deep', 'diagnostic.json');

            const stopReason: StopReason = {
                condition: 'CIRCUIT_BREAKER',
                value: 0,
                threshold: 50,
                message: 'Test',
            };

            const statistics: RunStatistics = {
                totalFrames: 4,
                framesAttempted: 0,
                framesApproved: 0,
                framesRejected: 0,
                framesFailed: 0,
                framesRemaining: 4,
                totalAttempts: 0,
                retryRate: 0,
                rejectRate: 0,
                consecutiveFails: 0,
            };

            await generateDiagnosticReport(state, stopReason, statistics, nestedPath);

            const exists = await fs.access(nestedPath).then(() => true).catch(() => false);
            expect(exists).toBe(true);
        });

        it('should dedupe reason codes per frame', async () => {
            // Multiple attempts with same reason code
            for (let i = 0; i < 3; i++) {
                state = recordAttempt(state, 0, {
                    timestamp: new Date().toISOString(),
                    promptHash: `${i}`,
                    result: 'soft_fail',
                    reasonCodes: ['SF01_IDENTITY_DRIFT'],
                    durationMs: 1000,
                });
            }

            const stopReason: StopReason = {
                condition: 'RETRY_RATE',
                value: 1,
                threshold: 0.5,
                message: 'Retry rate exceeded',
            };

            const statistics: RunStatistics = {
                totalFrames: 4,
                framesAttempted: 1,
                framesApproved: 0,
                framesRejected: 0,
                framesFailed: 0,
                framesRemaining: 3,
                totalAttempts: 3,
                retryRate: 0,
                rejectRate: 0,
                consecutiveFails: 0,
            };

            const outputPath = join(tmpDir, 'diagnostic-dedupe.json');
            const report = await generateDiagnosticReport(
                state,
                stopReason,
                statistics,
                outputPath
            );

            // Reason codes should be deduped in frame breakdown
            expect(report.frameBreakdown[0].reasonCodes.length).toBe(1);
        });

        it('should return top 3 failure codes', async () => {
            // Create diverse failures - note that the implementation dedupes reason codes per frame,
            // so to get SF01 count of 2, we need it on 2 different frames
            const failures = [
                'SF01_IDENTITY_DRIFT',
                'SF02_PALETTE_DRIFT',
                'SF03_BASELINE_DRIFT',
                'SF01_IDENTITY_DRIFT',  // SF01 on frame 3 as well to get count of 2
            ];

            for (let i = 0; i < 4; i++) {
                state = recordAttempt(state, i, {
                    timestamp: new Date().toISOString(),
                    promptHash: `${i}`,
                    result: 'soft_fail',
                    reasonCodes: [failures[i]],
                    durationMs: 1000,
                });
                state.frameAttempts[i].finalStatus = 'failed';
            }

            const stopReason: StopReason = {
                condition: 'CONSECUTIVE_FAILS',
                value: 4,
                threshold: 3,
                message: 'Consecutive fails',
            };

            const statistics: RunStatistics = {
                totalFrames: 4,
                framesAttempted: 4,
                framesApproved: 0,
                framesRejected: 0,
                framesFailed: 4,
                framesRemaining: 0,
                totalAttempts: 4,
                retryRate: 0,
                rejectRate: 1,
                consecutiveFails: 4,
            };

            const outputPath = join(tmpDir, 'diagnostic-top3.json');
            const report = await generateDiagnosticReport(
                state,
                stopReason,
                statistics,
                outputPath
            );

            // Should return at most 3 failure codes
            expect(report.topFailures.length).toBeLessThanOrEqual(3);
            // SF01 should be first (2 occurrences from frames 0 and 3)
            expect(report.topFailures[0].code).toBe('SF01_IDENTITY_DRIFT');
            expect(report.topFailures[0].count).toBe(2);
        });
    });

    describe('formatDiagnosticForConsole', () => {
        it('should format diagnostic report for console', () => {
            const report: DiagnosticReport = {
                generatedAt: new Date().toISOString(),
                runId: 'test-run',
                stopCondition: {
                    type: 'RETRY_RATE',
                    threshold: 0.5,
                    actualValue: 0.6,
                    triggeredAt: new Date().toISOString(),
                },
                summary: {
                    totalFrames: 8,
                    framesAttempted: 4,
                    framesApproved: 2,
                    framesRejected: 1,
                    framesFailed: 1,
                    totalAttempts: 10,
                    averageAttemptsPerFrame: 2.5,
                },
                frameBreakdown: [
                    {
                        frameIndex: 0,
                        finalStatus: 'approved',
                        attemptCount: 1,
                        reasonCodes: [],
                        compositeScores: [0.9],
                        actionsTried: [],
                        timeSpentMs: 1000,
                    },
                ],
                topFailures: [
                    {
                        code: 'SF01_IDENTITY_DRIFT',
                        count: 5,
                        percentage: 50,
                        exampleFrames: [1, 2, 3],
                    },
                ],
                rootCause: {
                    suggestion: 'Anchor image lacks distinctive features.',
                    confidence: 'high',
                    contributingFactors: ['Low contrast', 'Small size'],
                },
                recoveryActions: [
                    {
                        action: 'Increase anchor resolution',
                        description: 'Use 512x512 or larger',
                        appliesWhen: ['SF01_IDENTITY_DRIFT'],
                        effort: 'low',
                        priority: 1,
                    },
                ],
            };

            const output = formatDiagnosticForConsole(report);

            expect(output).toContain('DIAGNOSTIC REPORT');
            expect(output).toContain('STOP CONDITION: RETRY_RATE');
            expect(output).toContain('Threshold: 0.5');
            expect(output).toContain('Actual:    0.6');
            expect(output).toContain('SUMMARY:');
            expect(output).toContain('2/8 approved');
            expect(output).toContain('TOP FAILURE CODES:');
            expect(output).toContain('SF01_IDENTITY_DRIFT: 5');
            expect(output).toContain('50.0%');
            expect(output).toContain('ROOT CAUSE');
            expect(output).toContain('high confidence');
            expect(output).toContain('Anchor image lacks distinctive');
            expect(output).toContain('Contributing factors:');
            expect(output).toContain('RECOMMENDED ACTIONS:');
            expect(output).toContain('Increase anchor resolution');
        });

        it('should include average attempts per frame', () => {
            const report: DiagnosticReport = {
                generatedAt: new Date().toISOString(),
                runId: 'test',
                stopCondition: {
                    type: 'CIRCUIT_BREAKER',
                    threshold: 50,
                    actualValue: 50,
                    triggeredAt: new Date().toISOString(),
                },
                summary: {
                    totalFrames: 4,
                    framesAttempted: 4,
                    framesApproved: 2,
                    framesRejected: 0,
                    framesFailed: 2,
                    totalAttempts: 12,
                    averageAttemptsPerFrame: 3,
                },
                frameBreakdown: [],
                topFailures: [],
                rootCause: {
                    suggestion: 'Unknown cause',
                    confidence: 'low',
                    contributingFactors: [],
                },
                recoveryActions: [],
            };

            const output = formatDiagnosticForConsole(report);

            expect(output).toContain('12');
            expect(output).toContain('avg 3.0/frame');
        });

        it('should format multiple recovery actions with priority', () => {
            const report: DiagnosticReport = {
                generatedAt: new Date().toISOString(),
                runId: 'test',
                stopCondition: {
                    type: 'CONSECUTIVE_FAILS',
                    threshold: 3,
                    actualValue: 3,
                    triggeredAt: new Date().toISOString(),
                },
                summary: {
                    totalFrames: 4,
                    framesAttempted: 3,
                    framesApproved: 0,
                    framesRejected: 0,
                    framesFailed: 3,
                    totalAttempts: 3,
                    averageAttemptsPerFrame: 1,
                },
                frameBreakdown: [],
                topFailures: [],
                rootCause: {
                    suggestion: 'Multiple issues',
                    confidence: 'low',
                    contributingFactors: [],
                },
                recoveryActions: [
                    {
                        action: 'Action 1',
                        description: 'First action',
                        appliesWhen: [],
                        effort: 'low',
                        priority: 1,
                    },
                    {
                        action: 'Action 2',
                        description: 'Second action',
                        appliesWhen: [],
                        effort: 'medium',
                        priority: 2,
                    },
                    {
                        action: 'Action 3',
                        description: 'Third action',
                        appliesWhen: [],
                        effort: 'high',
                        priority: 3,
                    },
                ],
            };

            const output = formatDiagnosticForConsole(report);

            expect(output).toContain('1. [LOW]');
            expect(output).toContain('2. [MEDIUM]');
            expect(output).toContain('3. [HIGH]');
        });
    });
});
