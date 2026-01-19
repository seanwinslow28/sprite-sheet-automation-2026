/**
 * Clean command - cleanup old run folders
 * Per Story 6.4: Cleanup utilities for artifact management
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { cleanupOldRuns, type CleanupResult } from '../core/run-folder-manager.js';
import { pathExists } from '../utils/fs-helpers.js';

/**
 * Format bytes to human readable
 */
function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Display cleanup results
 */
function displayResults(result: CleanupResult, dryRun: boolean): void {
    console.log('');
    console.log(chalk.bold(dryRun ? 'Cleanup Preview (Dry Run)' : 'Cleanup Results'));
    console.log('─'.repeat(40));

    console.log(`Runs scanned:    ${result.runsScanned}`);
    console.log(`Runs ${dryRun ? 'to delete' : 'deleted'}:    ${chalk.red(result.runsDeleted.toString())}`);
    console.log(`Runs preserved:  ${chalk.green(result.runsPreserved.toString())}`);
    console.log(`Space ${dryRun ? 'to free' : 'freed'}:     ${chalk.yellow(formatBytes(result.spaceFreedBytes))}`);

    if (result.deletedRuns.length > 0 && result.deletedRuns.length <= 10) {
        console.log('');
        console.log(chalk.bold(dryRun ? 'Runs to delete:' : 'Deleted runs:'));
        for (const runId of result.deletedRuns) {
            console.log(`  ${chalk.red('×')} ${runId}`);
        }
    } else if (result.deletedRuns.length > 10) {
        console.log('');
        console.log(chalk.bold(`${dryRun ? 'To delete' : 'Deleted'}: ${result.deletedRuns.length} runs`));
    }

    if (result.errors.length > 0) {
        console.log('');
        console.log(chalk.bold.red('Errors:'));
        for (const err of result.errors) {
            console.log(`  ${chalk.red('!')} ${err.runId}: ${err.error}`);
        }
    }

    if (dryRun && result.runsDeleted > 0) {
        console.log('');
        console.log(chalk.yellow('This was a dry run. Use --force to actually delete runs.'));
    }
}

/**
 * Register clean command
 */
export function registerCleanCommand(program: Command): void {
    program
        .command('clean')
        .description('Clean up old run folders')
        .option('-d, --days <days>', 'Max age in days (default: 30)', parseInt, 30)
        .option('-p, --preserve-approved', 'Preserve runs with approved frames', false)
        .option('-f, --force', 'Actually delete (without this, runs in dry-run mode)', false)
        .option('-r, --runs-dir <dir>', 'Runs directory', 'runs')
        .action(async (options: {
            days: number;
            preserveApproved: boolean;
            force: boolean;
            runsDir: string;
        }) => {
            const { days, preserveApproved, force, runsDir } = options;

            // Validate
            if (days < 1) {
                console.error(chalk.red('Error: Days must be at least 1'));
                process.exit(1);
            }

            // Check runs directory exists
            if (!(await pathExists(runsDir))) {
                console.log(chalk.yellow(`Runs directory does not exist: ${runsDir}`));
                console.log('Nothing to clean.');
                return;
            }

            // Confirm if not dry run
            if (force) {
                console.log(chalk.yellow(`Warning: This will permanently delete runs older than ${days} days.`));
                console.log('');
            }

            const dryRun = !force;

            console.log(`Scanning runs directory: ${runsDir}`);
            console.log(`Max age: ${days} days`);
            console.log(`Preserve approved: ${preserveApproved ? 'yes' : 'no'}`);
            console.log(`Mode: ${dryRun ? 'dry-run (preview)' : chalk.red('DELETE')}`);

            const result = await cleanupOldRuns(runsDir, {
                maxAgeDays: days,
                preserveApproved,
                dryRun,
            });

            displayResults(result, dryRun);

            if (!dryRun && result.runsDeleted > 0) {
                console.log('');
                console.log(chalk.green('✓ Cleanup complete'));
            }
        });
}
