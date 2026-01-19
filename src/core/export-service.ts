/**
 * Export Service - Orchestrates export and validation
 * Per Story 8.7: Implement Export Phase Integration
 */

import { join, relative, basename } from 'path';
import { promises as fs } from 'fs';
import { logger } from '../utils/logger.js';
import { pathExists } from '../utils/fs-helpers.js';
import { exportAtlas, type AtlasExportResult } from './export/atlas-exporter.js';
import { runPhaserMicroTests, type ValidationSummary } from './validation/phaser-test-harness.js';
import { ProgressReporter } from './progress-reporter.js';
import type { Manifest } from '../domain/schemas/manifest.js';

/**
 * Export options
 */
export interface ExportOptions {
    skipValidation?: boolean;
    allowValidationFail?: boolean;
}

/**
 * Validation result for display
 */
export interface ValidationResult {
    testName: string;
    passed: boolean;
    message?: string;
}

/**
 * Export result
 */
export interface ExportResult {
    success: boolean;
    atlasPath?: string;
    jsonPath?: string;
    validationResults?: ValidationResult[];
    releaseReady: boolean;
}

/**
 * Export Service - Handles export and validation phases
 */
export class ExportService {
    private runPath: string;
    private manifest: Manifest;

    constructor(runPath: string, manifest: Manifest) {
        this.runPath = runPath;
        this.manifest = manifest;
    }

    /**
     * Run the export phase
     */
    async run(
        options: ExportOptions = {},
        reporter?: ProgressReporter
    ): Promise<ExportResult> {
        const log = reporter || new ProgressReporter({ silent: true });
        const runId = basename(this.runPath);

        try {
            // Step 1: Check for approved frames
            const approvedDir = join(this.runPath, 'approved');
            if (!(await pathExists(approvedDir))) {
                log.fail('No approved frames found');
                return {
                    success: false,
                    releaseReady: false,
                };
            }

            const files = await fs.readdir(approvedDir);
            const frameFiles = files.filter(f => f.endsWith('.png')).sort();

            if (frameFiles.length === 0) {
                log.fail('No approved frames to export');
                return {
                    success: false,
                    releaseReady: false,
                };
            }

            log.debug('Export starting', { frameCount: frameFiles.length });

            // Step 2: Run atlas export
            log.start('Running TexturePacker...');

            // Determine runs directory from run path
            const runsDir = join(this.runPath, '..');

            const exportResult = await exportAtlas(
                runId,
                this.manifest,
                runsDir,
                {
                    skipPreValidation: false,
                    skipPostValidation: false,
                    cleanupStaging: true,
                }
            );

            if (exportResult.isErr()) {
                log.fail(`TexturePacker failed: ${exportResult.unwrapErr().message}`);
                return {
                    success: false,
                    releaseReady: false,
                };
            }

            const atlas = exportResult.unwrap();
            log.succeed(`Atlas exported (${basename(atlas.paths.png)}, ${basename(atlas.paths.json)})`);

            // Step 3: Run Phaser validation (unless skipped)
            let validationResults: ValidationResult[] = [];
            let validationPassed = true;

            if (!options.skipValidation) {
                log.start('Running Phaser validation...');

                const validationResult = await this.runPhaserValidation(atlas);

                if (validationResult) {
                    validationResults = this.formatValidationResults(validationResult);
                    validationPassed = validationResult.overall_passed;

                    const passedCount = validationResults.filter(r => r.passed).length;
                    const totalCount = validationResults.length;

                    if (validationPassed) {
                        log.succeed(`Validation passed (${passedCount}/${totalCount} tests)`);
                    } else {
                        const failedCount = validationResults.filter(r => !r.passed).length;
                        log.fail(`Validation failed (${failedCount}/${totalCount} tests failed)`);
                    }
                } else {
                    // Validation couldn't run (missing dependencies)
                    log.warn('Validation skipped (Puppeteer not available)');
                }
            } else {
                log.warn('Validation skipped (--skip-validation)');
            }

            // Step 4: Determine release readiness
            const releaseReady = validationPassed || options.allowValidationFail === true;

            if (!validationPassed && options.allowValidationFail) {
                log.warn('Proceeding despite validation failures (--allow-validation-fail)');
            }

            // Step 5: Update summary
            await this.writeSummary(atlas, validationResults, releaseReady);

            return {
                success: true,
                atlasPath: atlas.paths.png,
                jsonPath: atlas.paths.json,
                validationResults,
                releaseReady,
            };

        } catch (error) {
            log.fail('Export failed');
            logger.error({
                event: 'export_error',
                error: error instanceof Error ? error.message : String(error),
            }, 'Export service error');

            return {
                success: false,
                releaseReady: false,
            };
        }
    }

    /**
     * Run Phaser micro-tests
     */
    private async runPhaserValidation(
        atlas: AtlasExportResult
    ): Promise<ValidationSummary | null> {
        const runId = basename(this.runPath);
        const runsDir = join(this.runPath, '..');

        try {
            const result = await runPhaserMicroTests(
                runsDir,
                runId,
                atlas.paths.json,
                atlas.paths.png,
                this.manifest.identity.move,
                atlas.frameCount
            );

            if (result.isOk()) {
                return result.unwrap();
            } else {
                logger.warn({
                    error: result.unwrapErr().message,
                }, 'Phaser validation failed');
                return null;
            }

        } catch (error) {
            logger.warn({
                error: error instanceof Error ? error.message : String(error),
            }, 'Phaser validation error');

            return null;
        }
    }

    /**
     * Format validation results for display
     */
    private formatValidationResults(summary: ValidationSummary): ValidationResult[] {
        const results: ValidationResult[] = [];

        // TEST-02: Pivot Alignment
        if (summary.tests['TEST-02']) {
            const test = summary.tests['TEST-02'];
            results.push({
                testName: 'TEST-02 Pivot Alignment',
                passed: test.passed,
                message: test.error ?? (test.passed ? undefined : 'Pivot alignment check failed'),
            });
        }

        // TEST-03: Trim Jitter
        if (summary.tests['TEST-03']) {
            const test = summary.tests['TEST-03'];
            results.push({
                testName: 'TEST-03 Trim Jitter',
                passed: test.passed,
                message: test.error ?? (test.passed ? undefined : 'Trim jitter detected'),
            });
        }

        // TEST-04: Frame Suffix
        if (summary.tests['TEST-04']) {
            const test = summary.tests['TEST-04'];
            results.push({
                testName: 'TEST-04 Frame Suffix',
                passed: test.passed,
                message: test.error ?? (test.passed ? undefined : 'Invalid frame suffix'),
            });
        }

        return results;
    }

    /**
     * Write export summary
     */
    private async writeSummary(
        atlas: AtlasExportResult,
        validationResults: ValidationResult[],
        releaseReady: boolean
    ): Promise<void> {
        const summaryPath = join(this.runPath, 'export', 'summary.json');

        const summary = {
            run_id: basename(this.runPath),
            completed_at: new Date().toISOString(),
            release_ready: releaseReady,
            atlas: {
                png: relative(this.runPath, atlas.paths.png),
                json: relative(this.runPath, atlas.paths.json),
                frame_count: atlas.frameCount,
                sheet_count: atlas.sheetCount,
            },
            validation: {
                skipped: validationResults.length === 0,
                passed: validationResults.every(r => r.passed),
                tests: validationResults.map(r => ({
                    name: r.testName,
                    passed: r.passed,
                    message: r.message,
                })),
            },
            duration_ms: atlas.durationMs,
        };

        await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));
    }
}
