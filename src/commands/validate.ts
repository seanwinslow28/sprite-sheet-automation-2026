/**
 * Validate command - CLI entry point for Phaser micro-test validation
 * Story 5.7: Implements `banana validate <run_id>` command
 */

import { Command } from 'commander';
import path from 'path';
import { promises as fs } from 'fs';
import {
    runPhaserMicroTests,
    formatValidationResults,
} from '../core/validation/phaser-test-harness.js';
import {
    evaluateReleaseReadiness,
    buildValidationSummary,
    formatReleaseStatus,
    saveReleaseInfo,
} from '../core/export/release-gating.js';
import { loadState } from '../core/state-manager.js';
import { buildRunPaths } from '../core/run-folder-manager.js';
import { pathExists } from '../utils/fs-helpers.js';
import { logger } from '../utils/logger.js';

/**
 * Register the validate command with Commander
 */
export function registerValidateCommand(program: Command): void {
    program
        .command('validate <runId>')
        .description('Run Phaser micro-tests (TEST-02, TEST-03, TEST-04) on exported atlas')
        .option('-r, --runs-dir <dir>', 'Directory containing runs', 'runs')
        .option('-s, --skip-phaser', 'Skip Phaser tests, only validate files', false)
        .option('--allow-validation-fail', 'Allow export despite validation failures (debug builds)', false)
        .action(async (runId: string, options: {
            runsDir: string;
            skipPhaser: boolean;
            allowValidationFail: boolean;
        }) => {
            console.log('');
            console.log('🧪 Phaser Micro-Test Validation');
            console.log('================================');

            try {
                const runDir = path.join(options.runsDir, runId);

                // Check run exists
                if (!(await pathExists(runDir))) {
                    console.error(`\n❌ Run not found: ${runDir}`);
                    process.exit(1);
                    return;
                }

                // Load run state (uses discriminated union Result)
                const runPaths = buildRunPaths(runDir);
                const stateResult = await loadState(runPaths.stateJson);
                if (!stateResult.ok) {
                    console.error(`\n❌ Failed to load run state: ${stateResult.error.message}`);
                    process.exit(1);
                    return;
                }

                const state = stateResult.value;

                // Find atlas files in export folder
                const exportDir = path.join(runDir, 'export');
                if (!(await pathExists(exportDir))) {
                    console.error(`\n❌ Export directory not found: ${exportDir}`);
                    console.error('   Run `banana run <manifest>` first to generate and export atlas.');
                    process.exit(1);
                    return;
                }

                // Find atlas JSON and PNG
                const exportFiles = await fs.readdir(exportDir);
                const jsonFiles = exportFiles.filter(f => f.endsWith('.json') && !f.includes('mapping'));
                const pngFiles = exportFiles.filter(f => f.endsWith('.png'));

                if (jsonFiles.length === 0 || pngFiles.length === 0) {
                    console.error(`\n❌ No atlas files found in: ${exportDir}`);
                    process.exit(1);
                    return;
                }

                const atlasJsonPath = path.join(exportDir, jsonFiles[0]);
                const atlasPngPath = path.join(exportDir, pngFiles[0]);

                console.log(`\nRun ID: ${runId}`);
                console.log(`Atlas: ${jsonFiles[0]}`);

                // Extract move ID from atlas filename (format: {character}_{move}.json)
                // e.g., "blaze_idle.json" -> moveId = "idle"
                const atlasBasename = path.basename(jsonFiles[0], '.json');
                const moveIdMatch = atlasBasename.match(/_([^_]+)$/);
                const moveId = moveIdMatch ? moveIdMatch[1] : 'idle';
                const frameCount = state.total_frames || 8;

                if (options.skipPhaser) {
                    console.log('\n⚠️  Skipping Phaser tests (--skip-phaser specified)');
                    console.log('   Only file-level validation performed.');
                    process.exit(0);
                    return;
                }

                // Run Phaser micro-tests (uses class-based Result)
                console.log('\nRunning Phaser micro-tests...\n');

                const validationResult = await runPhaserMicroTests(
                    options.runsDir,
                    runId,
                    atlasJsonPath,
                    atlasPngPath,
                    moveId,
                    frameCount
                );

                if (!validationResult.isOk()) {
                    console.error(`\n❌ Validation failed: ${validationResult.unwrapErr().message}`);
                    process.exit(1);
                    return;
                }

                const summary = validationResult.unwrap();

                // Display results
                console.log(formatValidationResults(summary));

                // Evaluate release readiness
                const validationSummary = buildValidationSummary(
                    true, // pre-export already passed if we got here
                    summary.overall_passed,
                    undefined,
                    summary.overall_passed ? undefined : 'Phaser micro-tests failed'
                );

                const evaluation = evaluateReleaseReadiness(
                    validationSummary,
                    options.allowValidationFail
                );

                // Save release info (uses class-based Result)
                const saveResult = await saveReleaseInfo(evaluation.releaseInfo, options.runsDir, runId);
                if (!saveResult.isOk()) {
                    console.warn(`\n⚠️  Failed to save release info: ${saveResult.unwrapErr().message}`);
                }

                // Display release status
                console.log('');
                console.log(formatReleaseStatus(evaluation.releaseInfo, runId));

                // Exit with appropriate code
                if (summary.overall_passed) {
                    process.exit(0);
                } else if (options.allowValidationFail) {
                    console.log('\n⚠️  Exiting with code 0 due to --allow-validation-fail');
                    process.exit(0);
                } else {
                    process.exit(1);
                }

            } catch (error) {
                logger.error({
                    event: 'validate_command_error',
                    error: error instanceof Error ? error.message : String(error),
                });
                console.error('\n❌ Unexpected error:', error);
                process.exit(1);
            }
        });
}
