/**
 * Release-Ready Gating
 * Story 5.8: Implement Release-Ready Gating
 *
 * Determines release readiness based on validation results.
 * Blocks promotion of assets that fail validation.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { Result, SystemError } from '../result.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Release status enum
 * - pending: Not yet validated
 * - release-ready: All validations passed
 * - validation-failed: One or more validations failed
 * - debug-only: Exported with --allow-validation-fail override
 */
export type ReleaseStatus =
    | 'pending'
    | 'release-ready'
    | 'validation-failed'
    | 'debug-only';

/**
 * Individual validation test result
 */
export interface ValidationTestResult {
    passed: boolean;
    message?: string;
    details?: Record<string, unknown>;
}

/**
 * Summary of all validation tests
 */
export interface ValidationSummary {
    tests: Record<string, ValidationTestResult>;
    totalTests: number;
    passedTests: number;
    failedTests: number;
}

/**
 * Release information stored in state
 */
export interface ReleaseInfo {
    status: ReleaseStatus;
    evaluated_at: string;
    validation_summary: {
        tests_passed: number;
        tests_failed: number;
        failed_tests: string[];
    };
    override_used: boolean;
    promoted: boolean;
    promoted_to?: string;
}

/**
 * Release evaluation result with logging information
 */
export interface ReleaseEvaluationResult {
    releaseInfo: ReleaseInfo;
    logs: ReleaseLog[];
}

/**
 * Log entry for release evaluation
 */
export interface ReleaseLog {
    level: 'info' | 'warn' | 'error';
    event: string;
    message: string;
    details?: Record<string, unknown>;
}

/**
 * Remediation suggestion for a failed test
 */
export interface RemediationSuggestion {
    testName: string;
    actions: string[];
}

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Create an initial pending release info
 */
export function createPendingReleaseInfo(): ReleaseInfo {
    return {
        status: 'pending',
        evaluated_at: new Date().toISOString(),
        validation_summary: {
            tests_passed: 0,
            tests_failed: 0,
            failed_tests: [],
        },
        override_used: false,
        promoted: false,
    };
}

/**
 * Evaluate release readiness based on validation results
 *
 * @param validationSummary Summary of validation test results
 * @param allowValidationFail Override flag to allow export despite failures
 * @returns Release evaluation result with info and logs
 */
export function evaluateReleaseReadiness(
    validationSummary: ValidationSummary,
    allowValidationFail: boolean = false
): ReleaseEvaluationResult {
    const logs: ReleaseLog[] = [];

    // Find all failed tests
    const failedTests = Object.entries(validationSummary.tests)
        .filter(([_, result]) => !result.passed)
        .map(([name, _]) => name);

    const passedCount = validationSummary.totalTests - failedTests.length;

    // All tests passed - release ready
    if (failedTests.length === 0) {
        logs.push({
            level: 'info',
            event: 'release_ready',
            message: 'All validation tests passed - assets are release-ready',
            details: {
                tests_passed: passedCount,
                tests_failed: 0,
            },
        });

        return {
            releaseInfo: {
                status: 'release-ready',
                evaluated_at: new Date().toISOString(),
                validation_summary: {
                    tests_passed: passedCount,
                    tests_failed: 0,
                    failed_tests: [],
                },
                override_used: false,
                promoted: false,
            },
            logs,
        };
    }

    // Tests failed but override is enabled - debug only
    if (allowValidationFail) {
        logs.push({
            level: 'warn',
            event: 'validation_override',
            message: 'Assets exported with validation failures - DEBUG ONLY',
            details: {
                failed_tests: failedTests,
                tests_passed: passedCount,
                tests_failed: failedTests.length,
            },
        });

        return {
            releaseInfo: {
                status: 'debug-only',
                evaluated_at: new Date().toISOString(),
                validation_summary: {
                    tests_passed: passedCount,
                    tests_failed: failedTests.length,
                    failed_tests: failedTests,
                },
                override_used: true,
                promoted: false,
            },
            logs,
        };
    }

    // Tests failed without override - validation failed
    logs.push({
        level: 'error',
        event: 'validation_failed',
        message: `Validation failed: ${failedTests.length} of ${validationSummary.totalTests} tests failed`,
        details: {
            failed_tests: failedTests,
            tests_passed: passedCount,
            tests_failed: failedTests.length,
        },
    });

    return {
        releaseInfo: {
            status: 'validation-failed',
            evaluated_at: new Date().toISOString(),
            validation_summary: {
                tests_passed: passedCount,
                tests_failed: failedTests.length,
                failed_tests: failedTests,
            },
            override_used: false,
            promoted: false,
        },
        logs,
    };
}

/**
 * Generate failure logs with remediation suggestions
 *
 * @param validationSummary Summary of validation results
 * @returns Array of log entries with remediation suggestions
 */
export function generateFailureLogs(
    validationSummary: ValidationSummary
): ReleaseLog[] {
    const logs: ReleaseLog[] = [];

    for (const [testName, result] of Object.entries(validationSummary.tests)) {
        if (!result.passed) {
            const remediation = getRemediationSuggestions(testName, result);

            logs.push({
                level: 'error',
                event: 'test_failure',
                message: `Test '${testName}' failed: ${result.message || 'No details'}`,
                details: {
                    test_name: testName,
                    result: result.details,
                    remediation: remediation.actions,
                },
            });
        }
    }

    return logs;
}

/**
 * Get remediation suggestions for a failed test
 *
 * @param testName Name of the failed test
 * @param result Test result with details
 * @returns Remediation suggestion
 */
export function getRemediationSuggestions(
    testName: string,
    _result: ValidationTestResult
): RemediationSuggestion {
    const suggestions: Record<string, string[]> = {
        'pre-export': [
            'Check that all frames exist in approved/ folder',
            'Verify frame dimensions match target_size',
            'Ensure no corrupted PNG files',
        ],
        'post-export': [
            'Verify TexturePacker completed successfully',
            'Check atlas JSON structure',
            'Validate frame keys match expected pattern',
        ],
        'pivot-test': [
            'Review pivot point configuration',
            'Check that anchor sprite has correct pivot',
            'Verify Phaser pivot settings in atlas JSON',
        ],
        'jitter-test': [
            'Review approved frames for bounding box consistency',
            'Check trim settings in TexturePacker',
            'Consider regenerating frames with stricter alignment',
        ],
        'suffix-test': [
            'Verify frame naming convention',
            'Check that all frames follow {moveId}/{paddedIndex} pattern',
            'Review naming configuration in manifest',
        ],
    };

    // Find matching suggestions or use generic
    for (const [key, actions] of Object.entries(suggestions)) {
        if (testName.toLowerCase().includes(key)) {
            return { testName, actions };
        }
    }

    // Generic suggestions
    return {
        testName,
        actions: [
            `Review validation output for '${testName}'`,
            'Check related configuration in manifest',
            'Re-run validation with verbose logging',
        ],
    };
}

/**
 * Check if promotion is allowed based on release info
 *
 * @param releaseInfo Current release info
 * @returns Whether promotion is allowed
 */
export function canPromote(releaseInfo: ReleaseInfo): boolean {
    return releaseInfo.status === 'release-ready';
}

/**
 * Promote assets to release location
 *
 * @param runsDir Base directory for runs
 * @param runId Run ID to promote
 * @param releaseInfo Current release info
 * @param outputPath Target output path for promotion
 * @returns Result with updated release info or error
 */
export async function promoteToRelease(
    runsDir: string,
    runId: string,
    releaseInfo: ReleaseInfo,
    outputPath: string
): Promise<Result<ReleaseInfo, SystemError>> {
    // Check if promotion is allowed
    if (!canPromote(releaseInfo)) {
        return Result.err({
            code: 'SYS_PROMOTION_BLOCKED',
            message: `Cannot promote: status is '${releaseInfo.status}'`,
        });
    }

    // Get export directory
    const exportDir = path.join(runsDir, runId, 'export');

    // Check export directory exists
    try {
        await fs.access(exportDir);
    } catch {
        return Result.err({
            code: 'SYS_PATH_NOT_FOUND',
            message: `Export directory not found: ${exportDir}`,
        });
    }

    // Create output directory
    try {
        await fs.mkdir(outputPath, { recursive: true });
    } catch {
        return Result.err({
            code: 'SYS_WRITE_FAILED',
            message: `Failed to create output directory: ${outputPath}`,
        });
    }

    // Get files to copy
    let files: string[];
    try {
        const entries = await fs.readdir(exportDir);
        files = entries
            .filter((f) => f.endsWith('.png') || f.endsWith('.json'))
            .sort();
    } catch {
        return Result.err({
            code: 'SYS_READ_FAILED',
            message: `Failed to read export directory: ${exportDir}`,
        });
    }

    if (files.length === 0) {
        return Result.err({
            code: 'SYS_EXPORT_EMPTY',
            message: 'No exportable files found in export directory',
        });
    }

    // Copy files
    try {
        for (const file of files) {
            const src = path.join(exportDir, file);
            const dest = path.join(outputPath, file);
            await fs.copyFile(src, dest);
        }
    } catch {
        return Result.err({
            code: 'SYS_WRITE_FAILED',
            message: `Failed to copy files to output: ${outputPath}`,
        });
    }

    // Update release info
    const updatedInfo: ReleaseInfo = {
        ...releaseInfo,
        promoted: true,
        promoted_to: outputPath,
    };

    return Result.ok(updatedInfo);
}

/**
 * Save release info to run directory
 *
 * @param releaseInfo Release info to save
 * @param runsDir Base directory for runs
 * @param runId Run ID
 * @returns Result with saved path or error
 */
export async function saveReleaseInfo(
    releaseInfo: ReleaseInfo,
    runsDir: string,
    runId: string
): Promise<Result<string, SystemError>> {
    const runDir = path.join(runsDir, runId);
    const filePath = path.join(runDir, 'release_info.json');

    try {
        await fs.mkdir(runDir, { recursive: true });
    } catch {
        return Result.err({
            code: 'SYS_WRITE_FAILED',
            message: `Failed to create run directory: ${runDir}`,
        });
    }

    // Convert to snake_case for JSON output
    const output = {
        status: releaseInfo.status,
        evaluated_at: releaseInfo.evaluated_at,
        validation_summary: {
            tests_passed: releaseInfo.validation_summary.tests_passed,
            tests_failed: releaseInfo.validation_summary.tests_failed,
            failed_tests: releaseInfo.validation_summary.failed_tests,
        },
        override_used: releaseInfo.override_used,
        promoted: releaseInfo.promoted,
        promoted_to: releaseInfo.promoted_to,
    };

    try {
        await fs.writeFile(filePath, JSON.stringify(output, null, 2));
        return Result.ok(filePath);
    } catch {
        return Result.err({
            code: 'SYS_WRITE_FAILED',
            message: `Failed to write release info: ${filePath}`,
        });
    }
}

/**
 * Load release info from run directory
 *
 * @param runsDir Base directory for runs
 * @param runId Run ID
 * @returns Result with release info or error
 */
export async function loadReleaseInfo(
    runsDir: string,
    runId: string
): Promise<Result<ReleaseInfo, SystemError>> {
    const filePath = path.join(runsDir, runId, 'release_info.json');

    try {
        const content = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(content);

        return Result.ok({
            status: data.status,
            evaluated_at: data.evaluated_at,
            validation_summary: {
                tests_passed: data.validation_summary.tests_passed,
                tests_failed: data.validation_summary.tests_failed,
                failed_tests: data.validation_summary.failed_tests,
            },
            override_used: data.override_used,
            promoted: data.promoted,
            promoted_to: data.promoted_to,
        });
    } catch {
        return Result.err({
            code: 'SYS_READ_FAILED',
            message: `Failed to read release info: ${filePath}`,
        });
    }
}

// =============================================================================
// CLI Output Formatting
// =============================================================================

/**
 * Format release status for CLI output
 *
 * @param releaseInfo Release info to format
 * @param runId Run ID for asset paths
 * @returns Formatted string for CLI output
 */
export function formatReleaseStatus(
    releaseInfo: ReleaseInfo,
    runId: string
): string {
    const lines: string[] = [];
    const divider = '═'.repeat(55);

    lines.push(divider);

    switch (releaseInfo.status) {
        case 'release-ready':
            lines.push('✅ RELEASE READY');
            lines.push('');
            lines.push('All validation tests passed.');
            lines.push('');
            lines.push('Assets ready for production:');
            lines.push(`  runs/${runId}/export/`);
            lines.push('');
            lines.push('To promote to final location:');
            lines.push(`  pipeline promote ${runId} --output ./assets/sprites/`);
            break;

        case 'validation-failed':
            lines.push('❌ VALIDATION FAILED');
            lines.push('');
            lines.push(
                `${releaseInfo.validation_summary.tests_failed} of ${releaseInfo.validation_summary.tests_passed + releaseInfo.validation_summary.tests_failed} tests failed:`
            );
            for (const test of releaseInfo.validation_summary.failed_tests) {
                lines.push(`  ❌ ${test}`);
            }
            lines.push('');
            lines.push(`Assets remain in: runs/${runId}/export/`);
            lines.push('');
            lines.push('For debug builds, use: --allow-validation-fail');
            break;

        case 'debug-only':
            lines.push('⚠️ DEBUG ONLY (Validation Override)');
            lines.push('');
            lines.push(
                `${releaseInfo.validation_summary.tests_failed} tests failed but --allow-validation-fail was used:`
            );
            for (const test of releaseInfo.validation_summary.failed_tests) {
                lines.push(`  ❌ ${test}`);
            }
            lines.push('');
            lines.push('⚠️ These assets are NOT release-ready.');
            lines.push('⚠️ Use for development/testing only.');
            lines.push('');
            lines.push(`Assets exported to: runs/${runId}/export/`);
            break;

        case 'pending':
            lines.push('⏳ PENDING VALIDATION');
            lines.push('');
            lines.push('Validation has not been run yet.');
            break;
    }

    lines.push(divider);

    return lines.join('\n');
}

/**
 * Build validation summary from pre-export and post-export results
 *
 * @param preExportPassed Whether pre-export validation passed
 * @param postExportPassed Whether post-export validation passed
 * @param preExportDetails Optional details from pre-export
 * @param postExportDetails Optional details from post-export
 * @returns Validation summary
 */
export function buildValidationSummary(
    preExportPassed: boolean,
    postExportPassed: boolean,
    preExportDetails?: string,
    postExportDetails?: string
): ValidationSummary {
    const tests: Record<string, ValidationTestResult> = {
        'pre-export-validation': {
            passed: preExportPassed,
            message: preExportPassed ? 'All pre-export checks passed' : preExportDetails,
        },
        'post-export-validation': {
            passed: postExportPassed,
            message: postExportPassed
                ? 'All post-export checks passed'
                : postExportDetails,
        },
    };

    const failedCount = [preExportPassed, postExportPassed].filter((p) => !p).length;

    return {
        tests,
        totalTests: 2,
        passedTests: 2 - failedCount,
        failedTests: failedCount,
    };
}
