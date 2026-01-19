/**
 * Promote command - CLI entry point for promoting release-ready assets
 * Story 5.8: Implements `banana promote <run_id> --output <path>` command
 */

import { Command } from 'commander';
import path from 'path';
import { promises as fs } from 'fs';
import {
    promoteToRelease,
    loadReleaseInfo,
    saveReleaseInfo,
} from '../core/export/release-gating.js';
import { pathExists } from '../utils/fs-helpers.js';
import { logger } from '../utils/logger.js';

/**
 * Register the promote command with Commander
 */
export function registerPromoteCommand(program: Command): void {
    program
        .command('promote <runId>')
        .description('Promote release-ready assets to final output location')
        .requiredOption('-o, --output <path>', 'Output directory for promoted assets')
        .option('-r, --runs-dir <dir>', 'Directory containing runs', 'runs')
        .option('-f, --force', 'Force promotion even if not release-ready (NOT RECOMMENDED)', false)
        .action(async (runId: string, options: {
            output: string;
            runsDir: string;
            force: boolean;
        }) => {
            console.log('');
            console.log('📦 Asset Promotion');
            console.log('==================');

            try {
                const runDir = path.join(options.runsDir, runId);

                // Check run exists
                if (!(await pathExists(runDir))) {
                    console.error(`\n❌ Run not found: ${runDir}`);
                    process.exit(1);
                    return;
                }

                // Load release info (uses class-based Result)
                const releaseInfoResult = await loadReleaseInfo(options.runsDir, runId);
                if (!releaseInfoResult.isOk()) {
                    console.error(`\n❌ Release info not found for run: ${runId}`);
                    console.error('   Run `banana validate <run_id>` first to validate the atlas.');
                    process.exit(1);
                    return;
                }

                let releaseInfo = releaseInfoResult.unwrap();

                console.log(`\nRun ID: ${runId}`);
                console.log(`Status: ${releaseInfo.status}`);
                console.log(`Output: ${options.output}`);

                // Check if already promoted
                if (releaseInfo.promoted) {
                    console.log(`\n⚠️  Already promoted to: ${releaseInfo.promoted_to}`);
                    console.log('   Use a different output path or re-run validation.');
                    process.exit(0);
                    return;
                }

                // Check status
                if (releaseInfo.status !== 'release-ready') {
                    if (options.force) {
                        console.log('\n⚠️  --force specified: promoting despite non-release-ready status');
                        console.log('   This is NOT RECOMMENDED for production use.');
                    } else {
                        console.error(`\n❌ Cannot promote: status is '${releaseInfo.status}'`);

                        if (releaseInfo.status === 'validation-failed') {
                            console.error('   Fix validation issues and re-run validation, or');
                            console.error('   use --force to promote anyway (NOT RECOMMENDED).');
                        } else if (releaseInfo.status === 'debug-only') {
                            console.error('   Assets were exported with --allow-validation-fail flag.');
                            console.error('   These are debug builds and should not be promoted.');
                        } else if (releaseInfo.status === 'pending') {
                            console.error('   Run `banana validate <run_id>` first.');
                        }

                        process.exit(1);
                        return;
                    }
                }

                // Perform promotion (uses class-based Result)
                const promoteResult = await promoteToRelease(
                    options.runsDir,
                    runId,
                    options.force
                        ? { ...releaseInfo, status: 'release-ready' } // Temporarily override for force
                        : releaseInfo,
                    options.output
                );

                if (!promoteResult.isOk()) {
                    console.error(`\n❌ Promotion failed: ${promoteResult.unwrapErr().message}`);
                    process.exit(1);
                    return;
                }

                releaseInfo = promoteResult.unwrap();

                // Save updated release info
                const saveResult = await saveReleaseInfo(releaseInfo, options.runsDir, runId);
                if (!saveResult.isOk()) {
                    console.warn(`\n⚠️  Failed to save release info: ${saveResult.unwrapErr().message}`);
                }

                console.log('\n✅ Assets promoted successfully!');
                console.log(`   Output: ${releaseInfo.promoted_to}`);

                // List promoted files
                const exportDir = path.join(options.runsDir, runId, 'export');
                const files = await fs.readdir(exportDir);
                const promotedFiles = files.filter(f => f.endsWith('.png') || f.endsWith('.json'));

                console.log('   Files:');
                for (const file of promotedFiles) {
                    console.log(`     - ${file}`);
                }

                process.exit(0);

            } catch (error) {
                logger.error({
                    event: 'promote_command_error',
                    error: error instanceof Error ? error.message : String(error),
                });
                console.error('\n❌ Unexpected error:', error);
                process.exit(1);
            }
        });
}
