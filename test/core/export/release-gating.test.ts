/**
 * Tests for Release-Ready Gating
 * Story 5.8: Implement Release-Ready Gating
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import {
    evaluateReleaseReadiness,
    promoteToRelease,
    saveReleaseInfo,
    loadReleaseInfo,
    canPromote,
    createPendingReleaseInfo,
    generateFailureLogs,
    getRemediationSuggestions,
    formatReleaseStatus,
    buildValidationSummary,
} from '../../../src/core/export/release-gating.js';
import type {
    ValidationSummary,
    ReleaseInfo,
    ReleaseStatus,
} from '../../../src/core/export/release-gating.js';

describe('Release-Ready Gating (Story 5.8)', () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'release-gating-test-'));
    });

    afterEach(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    // Helper to create a validation summary
    function createValidationSummary(
        testResults: Record<string, boolean>
    ): ValidationSummary {
        const tests: Record<string, { passed: boolean; message?: string }> = {};
        let passed = 0;
        let failed = 0;

        for (const [name, result] of Object.entries(testResults)) {
            tests[name] = {
                passed: result,
                message: result ? 'Test passed' : 'Test failed',
            };
            if (result) passed++;
            else failed++;
        }

        return {
            tests,
            totalTests: Object.keys(testResults).length,
            passedTests: passed,
            failedTests: failed,
        };
    }

    describe('createPendingReleaseInfo', () => {
        it('should create pending release info', () => {
            const info = createPendingReleaseInfo();

            expect(info.status).toBe('pending');
            expect(info.validation_summary.tests_passed).toBe(0);
            expect(info.validation_summary.tests_failed).toBe(0);
            expect(info.validation_summary.failed_tests).toEqual([]);
            expect(info.override_used).toBe(false);
            expect(info.promoted).toBe(false);
            expect(info.evaluated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        });
    });

    describe('evaluateReleaseReadiness', () => {
        it('should return release-ready when all tests pass', () => {
            const summary = createValidationSummary({
                'pre-export': true,
                'post-export': true,
                'pivot-test': true,
            });

            const result = evaluateReleaseReadiness(summary, false);

            expect(result.releaseInfo.status).toBe('release-ready');
            expect(result.releaseInfo.validation_summary.tests_passed).toBe(3);
            expect(result.releaseInfo.validation_summary.tests_failed).toBe(0);
            expect(result.releaseInfo.validation_summary.failed_tests).toEqual([]);
            expect(result.releaseInfo.override_used).toBe(false);
            expect(result.logs.some((l) => l.event === 'release_ready')).toBe(true);
        });

        it('should return validation-failed when any test fails', () => {
            const summary = createValidationSummary({
                'pre-export': true,
                'post-export': false,
                'pivot-test': true,
            });

            const result = evaluateReleaseReadiness(summary, false);

            expect(result.releaseInfo.status).toBe('validation-failed');
            expect(result.releaseInfo.validation_summary.tests_passed).toBe(2);
            expect(result.releaseInfo.validation_summary.tests_failed).toBe(1);
            expect(result.releaseInfo.validation_summary.failed_tests).toContain(
                'post-export'
            );
            expect(result.releaseInfo.override_used).toBe(false);
            expect(result.logs.some((l) => l.event === 'validation_failed')).toBe(true);
        });

        it('should return debug-only when override is used', () => {
            const summary = createValidationSummary({
                'pre-export': true,
                'post-export': false,
                'jitter-test': false,
            });

            const result = evaluateReleaseReadiness(summary, true);

            expect(result.releaseInfo.status).toBe('debug-only');
            expect(result.releaseInfo.validation_summary.tests_failed).toBe(2);
            expect(result.releaseInfo.override_used).toBe(true);
            expect(result.logs.some((l) => l.event === 'validation_override')).toBe(
                true
            );
            expect(result.logs.some((l) => l.level === 'warn')).toBe(true);
        });

        it('should still return release-ready with override if all pass', () => {
            const summary = createValidationSummary({
                'pre-export': true,
                'post-export': true,
            });

            const result = evaluateReleaseReadiness(summary, true);

            expect(result.releaseInfo.status).toBe('release-ready');
            expect(result.releaseInfo.override_used).toBe(false);
        });

        it('should list all failed tests', () => {
            const summary = createValidationSummary({
                'test-1': false,
                'test-2': true,
                'test-3': false,
                'test-4': false,
            });

            const result = evaluateReleaseReadiness(summary, false);

            expect(result.releaseInfo.validation_summary.failed_tests).toHaveLength(3);
            expect(result.releaseInfo.validation_summary.failed_tests).toContain(
                'test-1'
            );
            expect(result.releaseInfo.validation_summary.failed_tests).toContain(
                'test-3'
            );
            expect(result.releaseInfo.validation_summary.failed_tests).toContain(
                'test-4'
            );
        });
    });

    describe('canPromote', () => {
        it('should allow promotion for release-ready status', () => {
            const info: ReleaseInfo = {
                status: 'release-ready',
                evaluated_at: new Date().toISOString(),
                validation_summary: {
                    tests_passed: 3,
                    tests_failed: 0,
                    failed_tests: [],
                },
                override_used: false,
                promoted: false,
            };

            expect(canPromote(info)).toBe(true);
        });

        it('should block promotion for validation-failed status', () => {
            const info: ReleaseInfo = {
                status: 'validation-failed',
                evaluated_at: new Date().toISOString(),
                validation_summary: {
                    tests_passed: 2,
                    tests_failed: 1,
                    failed_tests: ['test-1'],
                },
                override_used: false,
                promoted: false,
            };

            expect(canPromote(info)).toBe(false);
        });

        it('should block promotion for debug-only status', () => {
            const info: ReleaseInfo = {
                status: 'debug-only',
                evaluated_at: new Date().toISOString(),
                validation_summary: {
                    tests_passed: 2,
                    tests_failed: 1,
                    failed_tests: ['test-1'],
                },
                override_used: true,
                promoted: false,
            };

            expect(canPromote(info)).toBe(false);
        });

        it('should block promotion for pending status', () => {
            const info = createPendingReleaseInfo();
            expect(canPromote(info)).toBe(false);
        });
    });

    describe('promoteToRelease', () => {
        it('should promote assets when release-ready', async () => {
            const runId = 'test-run';
            const runsDir = path.join(tempDir, 'runs');
            const exportDir = path.join(runsDir, runId, 'export');
            const outputDir = path.join(tempDir, 'output');

            // Create export files
            await fs.mkdir(exportDir, { recursive: true });
            await fs.writeFile(path.join(exportDir, 'atlas.png'), 'png data');
            await fs.writeFile(path.join(exportDir, 'atlas.json'), '{}');

            const releaseInfo: ReleaseInfo = {
                status: 'release-ready',
                evaluated_at: new Date().toISOString(),
                validation_summary: {
                    tests_passed: 3,
                    tests_failed: 0,
                    failed_tests: [],
                },
                override_used: false,
                promoted: false,
            };

            const result = await promoteToRelease(runsDir, runId, releaseInfo, outputDir);

            expect(result.isOk()).toBe(true);
            if (result.isOk()) {
                const updated = result.unwrap();
                expect(updated.promoted).toBe(true);
                expect(updated.promoted_to).toBe(outputDir);

                // Check files were copied
                const files = await fs.readdir(outputDir);
                expect(files).toContain('atlas.png');
                expect(files).toContain('atlas.json');
            }
        });

        it('should block promotion for validation-failed', async () => {
            const releaseInfo: ReleaseInfo = {
                status: 'validation-failed',
                evaluated_at: new Date().toISOString(),
                validation_summary: {
                    tests_passed: 2,
                    tests_failed: 1,
                    failed_tests: ['test-1'],
                },
                override_used: false,
                promoted: false,
            };

            const result = await promoteToRelease(
                tempDir,
                'test-run',
                releaseInfo,
                '/output'
            );

            expect(result.isErr()).toBe(true);
            if (result.isErr()) {
                expect(result.unwrapErr().code).toBe('SYS_PROMOTION_BLOCKED');
                expect(result.unwrapErr().message).toContain('validation-failed');
            }
        });

        it('should block promotion for debug-only', async () => {
            const releaseInfo: ReleaseInfo = {
                status: 'debug-only',
                evaluated_at: new Date().toISOString(),
                validation_summary: {
                    tests_passed: 2,
                    tests_failed: 1,
                    failed_tests: ['test-1'],
                },
                override_used: true,
                promoted: false,
            };

            const result = await promoteToRelease(
                tempDir,
                'test-run',
                releaseInfo,
                '/output'
            );

            expect(result.isErr()).toBe(true);
            if (result.isErr()) {
                expect(result.unwrapErr().code).toBe('SYS_PROMOTION_BLOCKED');
            }
        });

        it('should fail for missing export directory', async () => {
            const releaseInfo: ReleaseInfo = {
                status: 'release-ready',
                evaluated_at: new Date().toISOString(),
                validation_summary: {
                    tests_passed: 3,
                    tests_failed: 0,
                    failed_tests: [],
                },
                override_used: false,
                promoted: false,
            };

            const result = await promoteToRelease(
                tempDir,
                'nonexistent-run',
                releaseInfo,
                '/output'
            );

            expect(result.isErr()).toBe(true);
            if (result.isErr()) {
                expect(result.unwrapErr().code).toBe('SYS_PATH_NOT_FOUND');
            }
        });

        it('should fail for empty export directory', async () => {
            const runId = 'empty-run';
            const exportDir = path.join(tempDir, runId, 'export');
            await fs.mkdir(exportDir, { recursive: true });

            const releaseInfo: ReleaseInfo = {
                status: 'release-ready',
                evaluated_at: new Date().toISOString(),
                validation_summary: {
                    tests_passed: 3,
                    tests_failed: 0,
                    failed_tests: [],
                },
                override_used: false,
                promoted: false,
            };

            const result = await promoteToRelease(
                tempDir,
                runId,
                releaseInfo,
                path.join(tempDir, 'output')
            );

            expect(result.isErr()).toBe(true);
            if (result.isErr()) {
                expect(result.unwrapErr().code).toBe('SYS_EXPORT_EMPTY');
            }
        });
    });

    describe('saveReleaseInfo and loadReleaseInfo', () => {
        it('should save and load release info', async () => {
            const runId = 'test-run';
            const releaseInfo: ReleaseInfo = {
                status: 'release-ready',
                evaluated_at: '2026-01-19T10:00:00.000Z',
                validation_summary: {
                    tests_passed: 3,
                    tests_failed: 0,
                    failed_tests: [],
                },
                override_used: false,
                promoted: true,
                promoted_to: '/final/output',
            };

            const saveResult = await saveReleaseInfo(releaseInfo, tempDir, runId);
            expect(saveResult.isOk()).toBe(true);

            const loadResult = await loadReleaseInfo(tempDir, runId);
            expect(loadResult.isOk()).toBe(true);

            if (loadResult.isOk()) {
                const loaded = loadResult.unwrap();
                expect(loaded.status).toBe('release-ready');
                expect(loaded.evaluated_at).toBe('2026-01-19T10:00:00.000Z');
                expect(loaded.validation_summary.tests_passed).toBe(3);
                expect(loaded.promoted).toBe(true);
                expect(loaded.promoted_to).toBe('/final/output');
            }
        });

        it('should fail to load nonexistent release info', async () => {
            const result = await loadReleaseInfo(tempDir, 'nonexistent');

            expect(result.isErr()).toBe(true);
            if (result.isErr()) {
                expect(result.unwrapErr().code).toBe('SYS_READ_FAILED');
            }
        });
    });

    describe('generateFailureLogs', () => {
        it('should generate logs for failed tests', () => {
            const summary = createValidationSummary({
                'pre-export': true,
                'jitter-test': false,
                'pivot-test': false,
            });

            const logs = generateFailureLogs(summary);

            expect(logs).toHaveLength(2);
            expect(logs.every((l) => l.level === 'error')).toBe(true);
            expect(logs.every((l) => l.event === 'test_failure')).toBe(true);
            expect(logs.some((l) => l.message.includes('jitter-test'))).toBe(true);
            expect(logs.some((l) => l.message.includes('pivot-test'))).toBe(true);
        });

        it('should return empty array when all pass', () => {
            const summary = createValidationSummary({
                'pre-export': true,
                'post-export': true,
            });

            const logs = generateFailureLogs(summary);

            expect(logs).toHaveLength(0);
        });
    });

    describe('getRemediationSuggestions', () => {
        it('should provide pre-export suggestions', () => {
            const suggestions = getRemediationSuggestions('pre-export-check', {
                passed: false,
            });

            expect(suggestions.testName).toBe('pre-export-check');
            expect(suggestions.actions.length).toBeGreaterThan(0);
            expect(
                suggestions.actions.some((a) => a.toLowerCase().includes('frame'))
            ).toBe(true);
        });

        it('should provide jitter suggestions', () => {
            const suggestions = getRemediationSuggestions('jitter-test', {
                passed: false,
            });

            expect(suggestions.actions.some((a) => a.includes('bounding box'))).toBe(
                true
            );
        });

        it('should provide generic suggestions for unknown tests', () => {
            const suggestions = getRemediationSuggestions('unknown-test-xyz', {
                passed: false,
            });

            expect(suggestions.testName).toBe('unknown-test-xyz');
            expect(suggestions.actions.length).toBeGreaterThan(0);
        });
    });

    describe('formatReleaseStatus', () => {
        it('should format release-ready status', () => {
            const info: ReleaseInfo = {
                status: 'release-ready',
                evaluated_at: new Date().toISOString(),
                validation_summary: {
                    tests_passed: 3,
                    tests_failed: 0,
                    failed_tests: [],
                },
                override_used: false,
                promoted: false,
            };

            const output = formatReleaseStatus(info, 'abc123');

            expect(output).toContain('RELEASE READY');
            expect(output).toContain('All validation tests passed');
            expect(output).toContain('abc123');
        });

        it('should format validation-failed status', () => {
            const info: ReleaseInfo = {
                status: 'validation-failed',
                evaluated_at: new Date().toISOString(),
                validation_summary: {
                    tests_passed: 2,
                    tests_failed: 1,
                    failed_tests: ['jitter-test'],
                },
                override_used: false,
                promoted: false,
            };

            const output = formatReleaseStatus(info, 'abc123');

            expect(output).toContain('VALIDATION FAILED');
            expect(output).toContain('jitter-test');
            expect(output).toContain('--allow-validation-fail');
        });

        it('should format debug-only status', () => {
            const info: ReleaseInfo = {
                status: 'debug-only',
                evaluated_at: new Date().toISOString(),
                validation_summary: {
                    tests_passed: 2,
                    tests_failed: 1,
                    failed_tests: ['pivot-test'],
                },
                override_used: true,
                promoted: false,
            };

            const output = formatReleaseStatus(info, 'abc123');

            expect(output).toContain('DEBUG ONLY');
            expect(output).toContain('NOT release-ready');
            expect(output).toContain('pivot-test');
        });

        it('should format pending status', () => {
            const info = createPendingReleaseInfo();
            const output = formatReleaseStatus(info, 'abc123');

            expect(output).toContain('PENDING');
            expect(output).toContain('not been run');
        });
    });

    describe('buildValidationSummary', () => {
        it('should build summary from pre/post results', () => {
            const summary = buildValidationSummary(true, true);

            expect(summary.totalTests).toBe(2);
            expect(summary.passedTests).toBe(2);
            expect(summary.failedTests).toBe(0);
            expect(summary.tests['pre-export-validation'].passed).toBe(true);
            expect(summary.tests['post-export-validation'].passed).toBe(true);
        });

        it('should track failures in summary', () => {
            const summary = buildValidationSummary(true, false, undefined, 'Frame count mismatch');

            expect(summary.passedTests).toBe(1);
            expect(summary.failedTests).toBe(1);
            expect(summary.tests['post-export-validation'].passed).toBe(false);
            expect(summary.tests['post-export-validation'].message).toBe(
                'Frame count mismatch'
            );
        });
    });

    describe('Assets Retention on Failure', () => {
        it('should keep assets in export folder even when validation fails', async () => {
            const runId = 'test-run';
            const runsDir = path.join(tempDir, 'runs');
            const exportDir = path.join(runsDir, runId, 'export');

            // Create export files
            await fs.mkdir(exportDir, { recursive: true });
            await fs.writeFile(path.join(exportDir, 'atlas.png'), 'png data');
            await fs.writeFile(path.join(exportDir, 'atlas.json'), '{}');

            // Evaluate as validation-failed
            const summary = createValidationSummary({
                'pre-export': true,
                'post-export': false,
            });
            const result = evaluateReleaseReadiness(summary, false);

            expect(result.releaseInfo.status).toBe('validation-failed');

            // Save release info (simulating pipeline saving state)
            await saveReleaseInfo(result.releaseInfo, runsDir, runId);

            // Assets should still exist
            const files = await fs.readdir(exportDir);
            expect(files).toContain('atlas.png');
            expect(files).toContain('atlas.json');
        });
    });
});
