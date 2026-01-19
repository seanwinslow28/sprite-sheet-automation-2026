/**
 * Progress reporter - Visual feedback for CLI operations
 * Per Story 8.8: Implement Progress Logging and Spinners
 */

import ora, { type Ora } from 'ora';
import chalk from 'chalk';
import { appendFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger.js';

/**
 * Icons for different status types
 */
const ICONS = {
    success: chalk.green('✔'),
    warn: chalk.yellow('⚠'),
    fail: chalk.red('✖'),
    info: chalk.blue('ℹ'),
    debug: chalk.gray('🔍'),
} as const;

/**
 * Prefixes for different message types
 */
const PREFIXES = {
    GEN: chalk.cyan('[GEN]'),
    WARN: chalk.yellow('[WARN]'),
    FAIL: chalk.red('[FAIL]'),
    DEBUG: chalk.gray('[DEBUG]'),
    AUDIT: chalk.magenta('[AUDIT]'),
    EXPORT: chalk.green('[EXPORT]'),
} as const;

/**
 * Progress reporter options
 */
export interface ProgressReporterOptions {
    runPath?: string;
    verbose?: boolean;
    silent?: boolean;
}

/**
 * Frame result for progress display
 */
export interface FrameProgressResult {
    status: 'approved' | 'rejected' | 'retrying';
    score?: number;
    reason?: string;
    attempt?: number;
    autoAligned?: boolean;
    driftPixels?: number;
}

/**
 * Summary statistics for batch display
 */
export interface SummaryStats {
    approved: number;
    rejected: number;
    total: number;
    retryCount: number;
    durationMs: number;
}

/**
 * Progress reporter for CLI visual feedback
 */
export class ProgressReporter {
    private spinner: Ora | null = null;
    private logFile: string | null = null;
    private verbose: boolean;
    private silent: boolean;
    private startTime: Date;
    private isCI: boolean;

    constructor(options: ProgressReporterOptions = {}) {
        this.verbose = options.verbose ?? false;
        this.silent = options.silent ?? false;
        this.startTime = new Date();
        this.isCI = !!(process.env.CI || process.env.GITHUB_ACTIONS);

        // Disable colors and spinners in CI
        if (this.isCI) {
            chalk.level = 0;
        }

        // Set up log file if runPath provided
        if (options.runPath) {
            const logsDir = join(options.runPath, 'logs');
            if (!existsSync(logsDir)) {
                mkdirSync(logsDir, { recursive: true });
            }
            this.logFile = join(logsDir, 'pipeline.log');
        }
    }

    // === Spinner Methods ===

    /**
     * Start a spinner with message
     */
    start(message: string): void {
        if (this.silent) return;

        if (!this.isCI) {
            this.spinner = ora({
                text: message,
                color: 'cyan',
            }).start();
        } else {
            console.log(`... ${message}`);
        }
        this.log('START', message);
    }

    /**
     * Update spinner text
     */
    update(message: string): void {
        if (this.silent) return;

        if (this.spinner) {
            this.spinner.text = message;
        }
        this.log('UPDATE', message);
    }

    /**
     * Succeed and stop spinner
     */
    succeed(message: string): void {
        if (this.silent) return;

        if (this.spinner) {
            this.spinner.succeed(message);
            this.spinner = null;
        } else {
            console.log(`${ICONS.success} ${message}`);
        }
        this.log('SUCCESS', message);
    }

    /**
     * Warn and stop spinner
     */
    warn(message: string): void {
        if (this.silent) return;

        if (this.spinner) {
            this.spinner.warn(chalk.yellow(message));
            this.spinner = null;
        } else {
            console.log(`${ICONS.warn} ${message}`);
        }
        this.log('WARN', message);
    }

    /**
     * Fail and stop spinner
     */
    fail(message: string): void {
        if (this.silent) return;

        if (this.spinner) {
            this.spinner.fail(chalk.red(message));
            this.spinner = null;
        } else {
            console.log(`${ICONS.fail} ${message}`);
        }
        this.log('FAIL', message);
    }

    /**
     * Show info message
     */
    info(message: string): void {
        if (this.silent) return;

        console.log(`${ICONS.info} ${message}`);
        this.log('INFO', message);
    }

    /**
     * Stop any active spinner
     */
    stop(): void {
        if (this.spinner) {
            this.spinner.stop();
            this.spinner = null;
        }
    }

    // === Frame Progress Methods ===

    /**
     * Show frame generation starting
     */
    frameGenerating(frameIndex: number, totalFrames: number): void {
        this.start(`Generating frame ${frameIndex}/${totalFrames - 1}...`);
    }

    /**
     * Show frame generation result
     */
    frameResult(
        frameIndex: number,
        totalFrames: number,
        result: FrameProgressResult
    ): void {
        if (result.status === 'approved') {
            if (result.autoAligned && result.driftPixels !== undefined) {
                const driftSign = result.driftPixels > 0 ? '+' : '';
                this.warn(
                    `${PREFIXES.WARN} Frame ${frameIndex}/${totalFrames - 1} Auto-Aligned (Drift: ${driftSign}${result.driftPixels}px)`
                );
            } else {
                const scoreText = result.score !== undefined
                    ? ` (Audit Score: ${result.score.toFixed(2)})`
                    : '';
                this.succeed(
                    `${PREFIXES.GEN} Frame ${frameIndex}/${totalFrames - 1} Generated${scoreText}`
                );
            }
        } else if (result.status === 'rejected') {
            this.fail(
                `${PREFIXES.FAIL} Frame ${frameIndex}/${totalFrames - 1} Rejected (${result.reason ?? 'Unknown'})`
            );
        } else if (result.status === 'retrying') {
            this.update(
                `Generating frame ${frameIndex}/${totalFrames - 1}... (retry ${result.attempt ?? 0})`
            );
            this.log('RETRY', `Frame ${frameIndex} attempt ${result.attempt ?? 0}`);
        }
    }

    /**
     * Show audit in progress
     */
    auditing(frameIndex: number): void {
        this.update(`Auditing frame ${frameIndex}...`);
    }

    // === Summary Methods ===

    /**
     * Display batch generation summary
     */
    summary(stats: SummaryStats, runId: string, outputPath: string): void {
        if (this.silent) return;

        const retryRate = stats.total > 0
            ? (stats.retryCount / stats.total) * 100
            : 0;
        const rejectRate = stats.total > 0
            ? (stats.rejected / stats.total) * 100
            : 0;

        console.log('');
        console.log('═══════════════════════════════════════════════════════');
        console.log(chalk.bold('Batch Generation Complete'));
        console.log('═══════════════════════════════════════════════════════');
        console.log(`${ICONS.success} Approved: ${stats.approved}/${stats.total}`);
        if (stats.rejected > 0) {
            console.log(chalk.red(`${ICONS.fail} Rejected: ${stats.rejected}`));
        }
        console.log(`📊 Retry Rate: ${retryRate.toFixed(1)}%`);
        console.log(`📊 Reject Rate: ${rejectRate.toFixed(1)}%`);
        console.log(`⏱  Duration: ${this.formatDuration(stats.durationMs)}`);
        console.log(`📁 Output: ${outputPath}`);
        console.log('═══════════════════════════════════════════════════════');

        this.log('SUMMARY', JSON.stringify({
            runId,
            ...stats,
            retryRate,
            rejectRate,
        }));
    }

    /**
     * Display Director Mode launch message
     */
    directorLaunch(port: number): void {
        if (this.silent) return;

        console.log('');
        console.log(chalk.bold('🎬 Director Mode'));
        console.log('═══════════════════════════════════════════════════════');
        console.log(chalk.cyan('🚀 Launching Director Mode...'));
        console.log(chalk.cyan(`👉 Open http://localhost:${port} to review and patch sprites.`));
        console.log(chalk.gray('   Press Ctrl+C to cancel (changes will be lost).'));
        console.log('═══════════════════════════════════════════════════════');
        console.log('');

        this.log('DIRECTOR', `Launched on port ${port}`);
    }

    /**
     * Display Director commit message
     */
    directorCommit(): void {
        if (this.silent) return;

        console.log(chalk.green('\n✅ Director session committed. Continuing to export...\n'));
        this.log('DIRECTOR', 'Session committed');
    }

    /**
     * Display Director cancel message
     */
    directorCancel(): void {
        if (this.silent) return;

        console.log(chalk.yellow('\n⚠️ Director cancelled. Changes were not saved.\n'));
        this.log('DIRECTOR', 'Session cancelled');
    }

    /**
     * Display export summary
     */
    exportSummary(
        atlasPath: string,
        jsonPath: string,
        releaseReady: boolean
    ): void {
        if (this.silent) return;

        console.log('');
        console.log('═══════════════════════════════════════════════════════');
        if (releaseReady) {
            console.log(chalk.bold.green('✅ Export Complete - Release Ready'));
        } else {
            console.log(chalk.bold.yellow('⚠️ Export Complete - Validation Failed'));
        }
        console.log('═══════════════════════════════════════════════════════');
        console.log(`📦 Atlas: ${atlasPath}`);
        console.log(`📋 JSON:  ${jsonPath}`);
        console.log('═══════════════════════════════════════════════════════');

        this.log('EXPORT', JSON.stringify({ atlasPath, jsonPath, releaseReady }));
    }

    /**
     * Display validation results
     */
    validationResults(
        results: Array<{ testName: string; passed: boolean; message?: string }>
    ): void {
        if (this.silent) return;

        console.log('');
        for (const result of results) {
            const icon = result.passed ? chalk.green('✔') : chalk.red('✖');
            const status = result.passed ? 'PASS' : 'FAIL';
            console.log(`  ${icon} ${result.testName}: ${status}`);
            if (!result.passed && result.message) {
                console.log(chalk.gray(`      ${result.message}`));
            }
        }
        console.log('');

        this.log('VALIDATION', JSON.stringify(results));
    }

    // === Debug Methods ===

    /**
     * Show debug message (only in verbose mode)
     */
    debug(message: string, data?: Record<string, unknown>): void {
        const fullMessage = data
            ? `${message}: ${JSON.stringify(data)}`
            : message;

        // Always log to file
        this.log('DEBUG', fullMessage);

        // Only show in console if verbose
        if (this.verbose && !this.silent) {
            console.log(chalk.gray(`${PREFIXES.DEBUG} ${fullMessage}`));
        }
    }

    // === Utility Methods ===

    /**
     * Format duration in human-readable form
     */
    formatDuration(ms: number): string {
        if (ms < 1000) {
            return `${ms}ms`;
        }
        if (ms < 60000) {
            return `${(ms / 1000).toFixed(1)}s`;
        }
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        return `${minutes}m ${seconds}s`;
    }

    /**
     * Get elapsed time since start
     */
    getElapsedMs(): number {
        return Date.now() - this.startTime.getTime();
    }

    /**
     * Reset start time
     */
    resetStartTime(): void {
        this.startTime = new Date();
    }

    // === Private Methods ===

    /**
     * Log message to file
     */
    private log(level: string, message: string): void {
        if (!this.logFile) return;

        const timestamp = new Date().toISOString();
        const entry = JSON.stringify({
            timestamp,
            level,
            message,
        }) + '\n';

        try {
            appendFileSync(this.logFile, entry);
        } catch (error) {
            // Log error but don't fail
            logger.debug({
                event: 'log_write_error',
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 'Failed to write to log file');
        }
    }
}

/**
 * Create a progress reporter for a run
 */
export function createProgressReporter(
    runPath: string,
    verbose: boolean = false
): ProgressReporter {
    return new ProgressReporter({
        runPath,
        verbose,
    });
}
