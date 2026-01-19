/**
 * Inspect command - CLI entry point for inspecting run artifacts
 * Per Story 6.1: banana inspect <run_id> [options]
 */

import { Command } from 'commander';
import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';
import { loadState, type RunState } from '../core/state-manager.js';
import { formatDiagnosticForConsole, type DiagnosticReport } from '../core/diagnostic-generator.js';
import { exportRunMetricsToCSV, exportRunMetricsToCSVFile } from '../core/metrics/csv-exporter.js';

/**
 * Formatting constants
 */
const SEPARATOR_WIDTH = 55;

/**
 * Artifact folder info
 */
interface FolderInfo {
    name: string;
    fileCount: number;
    totalSize: number;
    files: { name: string; size: number }[];
}

/**
 * Audit log entry
 */
interface AuditLogEntry {
    timestamp: string;
    event: string;
    frameIndex?: number;
    attempt?: number;
    score?: number;
    reasonCodes?: string[];
    [key: string]: unknown;
}

/**
 * Frame metrics from audit file
 */
interface FrameMetrics {
    frameIndex: number;
    finalStatus: string;
    compositeScore: number;
    breakdown: {
        identity: number;
        stability: number;
        palette: number;
        style: number;
    };
    reasonCodes: string[];
    attemptHistory: {
        attempt: number;
        score: number;
        reasonCodes: string[];
        strategy: string;
    }[];
}

/**
 * Register the inspect command with Commander
 */
export function registerInspectCommand(program: Command): void {
    program
        .command('inspect <run_id>')
        .description('Inspect run artifacts and logs')
        .option('-f, --frame <index>', 'Show detailed metrics for specific frame', parseInt)
        .option('-d, --diagnostic', 'Show full diagnostic report (if available)')
        .option('--json', 'Output as JSON instead of formatted text')
        .option('--csv [output]', 'Export all frame metrics to CSV (optional: output file path)')
        .option('-r, --runs-dir <dir>', 'Runs directory', 'runs')
        .action(async (runId: string, options: {
            frame?: number;
            diagnostic?: boolean;
            json?: boolean;
            csv?: boolean | string;
            runsDir: string;
        }) => {
            try {
                await inspectRun(runId, options);
            } catch (error) {
                if (error instanceof Error) {
                    console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
                } else {
                    console.error(chalk.red('\n❌ Unknown error occurred\n'));
                }
                process.exit(1);
            }
        });
}

/**
 * Main inspect function
 */
async function inspectRun(
    runId: string,
    options: {
        frame?: number;
        diagnostic?: boolean;
        json?: boolean;
        csv?: boolean | string;
        runsDir: string;
    }
): Promise<void> {
    const runPath = path.join(options.runsDir, runId);

    // Check if run exists
    try {
        await fs.access(runPath);
    } catch {
        throw new Error(`Run not found: ${runId}`);
    }

    // Load state
    const statePath = path.join(runPath, 'state.json');
    const stateResult = await loadState(statePath);

    if (!stateResult.ok) {
        throw new Error(`Failed to load run state: ${stateResult.error.message}`);
    }

    const state = stateResult.value;

    // JSON output mode
    if (options.json) {
        const output = await gatherJsonOutput(runPath, state, options);
        console.log(JSON.stringify(output, null, 2));
        return;
    }

    // CSV export mode (Story 6.2)
    if (options.csv !== undefined) {
        try {
            if (typeof options.csv === 'string') {
                // Export to specified file
                const outputPath = await exportRunMetricsToCSVFile(runPath, options.csv);
                console.log(chalk.green(`✅ Metrics exported to: ${outputPath}`));
            } else {
                // Output to stdout
                const csv = await exportRunMetricsToCSV(runPath);
                console.log(csv);
            }
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`CSV export failed: ${error.message}`);
            }
            throw error;
        }
        return;
    }

    // Frame-specific metrics
    if (options.frame !== undefined) {
        await displayFrameMetrics(runPath, options.frame);
        return;
    }

    // Diagnostic report
    if (options.diagnostic) {
        await displayDiagnostic(runPath);
        return;
    }

    // Default: show summary, artifacts, and recent logs
    displaySummary(state);
    await displayArtifacts(runPath);
    await displayRecentLogs(runPath);
}

/**
 * Gather all data for JSON output
 */
async function gatherJsonOutput(
    runPath: string,
    state: RunState,
    options: { frame?: number; diagnostic?: boolean }
): Promise<Record<string, unknown>> {
    const output: Record<string, unknown> = {
        runId: state.run_id,
        status: state.status,
        summary: calculateSummary(state),
    };

    if (options.frame !== undefined) {
        const metricsPath = path.join(runPath, 'audit', `frame_${options.frame}_metrics.json`);
        try {
            const content = await fs.readFile(metricsPath, 'utf-8');
            output.frameMetrics = JSON.parse(content);
        } catch {
            output.frameMetrics = null;
        }
    }

    if (options.diagnostic) {
        const diagPath = path.join(runPath, 'diagnostic.json');
        try {
            const content = await fs.readFile(diagPath, 'utf-8');
            output.diagnostic = JSON.parse(content);
        } catch {
            output.diagnostic = null;
        }
    }

    return output;
}

/**
 * Calculate summary statistics
 */
function calculateSummary(state: RunState): {
    status: string;
    framesCompleted: number;
    framesFailed: number;
    totalFrames: number;
    retryRate: number;
    startedAt: string;
    duration: string;
} {
    const framesCompleted = state.frame_states.filter(f => f.status === 'approved').length;
    const framesFailed = state.frame_states.filter(f => f.status === 'failed').length;
    const framesWithRetries = state.frame_states.filter(f => f.attempts > 1).length;
    const attemptedFrames = state.frame_states.filter(f => f.attempts > 0).length;
    const retryRate = attemptedFrames > 0 ? framesWithRetries / attemptedFrames : 0;

    // Calculate duration
    const startTime = new Date(state.started_at);
    const endTime = new Date(state.updated_at);
    const durationMs = endTime.getTime() - startTime.getTime();

    return {
        status: state.status,
        framesCompleted,
        framesFailed,
        totalFrames: state.total_frames,
        retryRate,
        startedAt: state.started_at,
        duration: formatDuration(durationMs),
    };
}

/**
 * Display run summary (AC: #1)
 */
function displaySummary(state: RunState): void {
    const summary = calculateSummary(state);
    const completionPercent = summary.totalFrames > 0
        ? ((summary.framesCompleted / summary.totalFrames) * 100).toFixed(1)
        : '0.0';
    const failedPercent = summary.totalFrames > 0
        ? ((summary.framesFailed / summary.totalFrames) * 100).toFixed(1)
        : '0.0';

    console.log('');
    console.log(chalk.cyan(`📊 Run Inspection: ${state.run_id}`));
    console.log(chalk.gray('═'.repeat(SEPARATOR_WIDTH)));
    console.log('');

    // Status with icon
    const statusIcon = getStatusIcon(summary.status);
    const statusColor = getStatusColor(summary.status);
    console.log(`Status:         ${statusIcon} ${statusColor(summary.status)}`);
    console.log(`Started:        ${formatTimestamp(summary.startedAt)}`);
    console.log(`Duration:       ${summary.duration}`);
    console.log('');

    console.log('Frames:');
    console.log(`  Completed:    ${summary.framesCompleted}/${summary.totalFrames} (${completionPercent}%)`);
    console.log(`  Failed:       ${summary.framesFailed}/${summary.totalFrames} (${failedPercent}%)`);
    console.log(`  Retry Rate:   ${(summary.retryRate * 100).toFixed(1)}%`);
    console.log('');

    // Stop condition (if applicable)
    if (summary.status === 'paused' || summary.status === 'failed') {
        console.log(`Stop Condition: ${chalk.yellow('Run did not complete normally')}`);
    } else if (summary.status === 'completed') {
        console.log(`Stop Condition: ${chalk.green('None (run completed normally)')}`);
    }

    console.log(chalk.gray('═'.repeat(SEPARATOR_WIDTH)));
}

/**
 * Display artifact listing (AC: #2)
 */
async function displayArtifacts(runPath: string): Promise<void> {
    console.log('');
    console.log(chalk.cyan('📁 Artifacts'));
    console.log(chalk.gray('═'.repeat(SEPARATOR_WIDTH)));
    console.log('');

    const folders = ['approved', 'candidates', 'audit', 'export'];
    const folderInfos: FolderInfo[] = [];

    for (const folder of folders) {
        const folderPath = path.join(runPath, folder);
        try {
            const info = await scanFolder(folderPath, folder);
            folderInfos.push(info);
        } catch {
            // Folder doesn't exist, skip
        }
    }

    // Also check for root-level files
    const rootFiles = await getRootFiles(runPath);
    if (rootFiles.length > 0) {
        folderInfos.push({
            name: '(root)',
            fileCount: rootFiles.length,
            totalSize: rootFiles.reduce((sum, f) => sum + f.size, 0),
            files: rootFiles,
        });
    }

    let totalFiles = 0;
    let totalSize = 0;

    for (const info of folderInfos) {
        totalFiles += info.fileCount;
        totalSize += info.totalSize;

        console.log(`${info.name}/ (${info.fileCount} files, ${formatSize(info.totalSize)})`);

        // Show first few files
        const filesToShow = info.files.slice(0, 4);
        for (let i = 0; i < filesToShow.length; i++) {
            const file = filesToShow[i];
            const prefix = i === filesToShow.length - 1 && info.files.length <= 4 ? '└──' : '├──';
            console.log(chalk.gray(`  ${prefix} ${file.name}`) + chalk.dim(`     ${formatSize(file.size)}`));
        }

        if (info.files.length > 4) {
            console.log(chalk.gray(`  └── ... (${info.files.length - 4} more)`));
        }

        console.log('');
    }

    console.log(`Total: ${totalFiles} files, ${formatSize(totalSize)}`);
    console.log(chalk.gray('═'.repeat(SEPARATOR_WIDTH)));
}

/**
 * Scan a folder for files
 */
async function scanFolder(folderPath: string, folderName: string): Promise<FolderInfo> {
    const files: { name: string; size: number }[] = [];

    async function scanRecursive(dir: string, prefix: string = ''): Promise<void> {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        // Sort entries for determinism
        entries.sort((a, b) => a.name.localeCompare(b.name));

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                await scanRecursive(fullPath, prefix + entry.name + '/');
            } else {
                const stat = await fs.stat(fullPath);
                files.push({
                    name: prefix + entry.name,
                    size: stat.size,
                });
            }
        }
    }

    await scanRecursive(folderPath);

    return {
        name: folderName,
        fileCount: files.length,
        totalSize: files.reduce((sum, f) => sum + f.size, 0),
        files,
    };
}

/**
 * Get root-level files in run folder
 */
async function getRootFiles(runPath: string): Promise<{ name: string; size: number }[]> {
    const files: { name: string; size: number }[] = [];
    const entries = await fs.readdir(runPath, { withFileTypes: true });

    for (const entry of entries) {
        if (!entry.isDirectory()) {
            const fullPath = path.join(runPath, entry.name);
            const stat = await fs.stat(fullPath);
            files.push({ name: entry.name, size: stat.size });
        }
    }

    return files.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Display recent logs (AC: #3)
 */
async function displayRecentLogs(runPath: string): Promise<void> {
    console.log('');
    console.log(chalk.cyan('📜 Recent Activity (last 5 events)'));
    console.log(chalk.gray('═'.repeat(SEPARATOR_WIDTH)));
    console.log('');

    const auditLogPath = path.join(runPath, 'audit', 'audit_log.jsonl');

    try {
        const content = await fs.readFile(auditLogPath, 'utf-8');
        const lines = content.trim().split('\n').filter(line => line.trim());

        // Get last 5 entries
        const recentLines = lines.slice(-5);
        const entries: AuditLogEntry[] = recentLines.map(line => {
            try {
                return JSON.parse(line);
            } catch {
                return { timestamp: '', event: 'parse_error' };
            }
        });

        for (const entry of entries) {
            const time = formatLogTime(entry.timestamp);
            const eventType = formatEventType(entry.event);
            const message = formatLogMessage(entry);
            console.log(`${chalk.dim(time)}  ${eventType}  ${message}`);
        }
    } catch {
        console.log(chalk.gray('No audit log found'));
    }

    console.log('');
    console.log(chalk.gray('═'.repeat(SEPARATOR_WIDTH)));
}

/**
 * Display frame metrics (AC: #4)
 */
async function displayFrameMetrics(runPath: string, frameIndex: number): Promise<void> {
    const metricsPath = path.join(runPath, 'audit', `frame_${frameIndex}_metrics.json`);

    let metrics: FrameMetrics;
    try {
        const content = await fs.readFile(metricsPath, 'utf-8');
        metrics = JSON.parse(content);
    } catch {
        // Try alternative naming
        const altPath = path.join(runPath, 'audit', `frame_${String(frameIndex).padStart(4, '0')}_metrics.json`);
        try {
            const content = await fs.readFile(altPath, 'utf-8');
            metrics = JSON.parse(content);
        } catch {
            throw new Error(`No metrics found for frame ${frameIndex}`);
        }
    }

    console.log('');
    console.log(chalk.cyan(`📊 Frame ${frameIndex} Metrics`));
    console.log(chalk.gray('═'.repeat(SEPARATOR_WIDTH)));
    console.log('');

    // Status
    const statusIcon = metrics.finalStatus === 'approved' ? '✅' : '❌';
    console.log(`Status:         ${statusIcon} ${metrics.finalStatus}`);
    console.log(`Attempts:       ${metrics.attemptHistory?.length ?? 0}`);
    console.log('');

    // Composite score
    const threshold = 0.70;
    const scoreIcon = metrics.compositeScore >= threshold ? '✅' : '❌';
    console.log(`Composite Score: ${metrics.compositeScore.toFixed(2)} ${scoreIcon} (threshold: ${threshold.toFixed(2)})`);
    console.log('');

    // Breakdown
    console.log('Breakdown:');
    if (metrics.breakdown) {
        const weights = { identity: 0.30, stability: 0.35, palette: 0.20, style: 0.15 };
        for (const [key, value] of Object.entries(metrics.breakdown)) {
            const weight = weights[key as keyof typeof weights] ?? 0;
            const icon = value >= 0.7 ? '✅' : value >= 0.5 ? '⚠️' : '❌';
            console.log(`  ${capitalize(key)}:     ${value.toFixed(2)} ${icon} (weight: ${weight.toFixed(2)})`);
        }
    }
    console.log('');

    // Reason codes
    if (metrics.reasonCodes && metrics.reasonCodes.length > 0) {
        console.log(`Reason Codes:   ${chalk.yellow(metrics.reasonCodes.join(', '))}`);
        console.log('');
    }

    // Attempt history
    if (metrics.attemptHistory && metrics.attemptHistory.length > 0) {
        console.log('Attempt History:');
        for (const attempt of metrics.attemptHistory) {
            const icon = attempt.reasonCodes.length === 0 ? '✅' : '❌';
            const codes = attempt.reasonCodes.length > 0
                ? attempt.reasonCodes.join(', ')
                : 'PASSED';
            const strategy = attempt.strategy ?? 'default';
            console.log(`  #${attempt.attempt}  ${icon}  ${attempt.score.toFixed(2)}  ${chalk.dim(codes.padEnd(20))} (${strategy})`);
        }
    }

    console.log('');
    console.log(chalk.gray('═'.repeat(SEPARATOR_WIDTH)));
}

/**
 * Display diagnostic report (AC: #5)
 */
async function displayDiagnostic(runPath: string): Promise<void> {
    const diagPath = path.join(runPath, 'diagnostic.json');

    let report: DiagnosticReport;
    try {
        const content = await fs.readFile(diagPath, 'utf-8');
        report = JSON.parse(content);
    } catch {
        console.log('');
        console.log(chalk.yellow('⚠️  No diagnostic report found for this run.'));
        console.log(chalk.gray('   Diagnostic reports are generated when a run stops due to error conditions.'));
        console.log('');
        return;
    }

    // Use existing formatter from diagnostic-generator
    console.log(formatDiagnosticForConsole(report));
}

/**
 * Format helpers
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

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTimestamp(iso: string): string {
    const date = new Date(iso);
    return date.toLocaleString();
}

function formatLogTime(iso: string): string {
    try {
        const date = new Date(iso);
        return date.toLocaleTimeString('en-US', { hour12: false });
    } catch {
        return '--:--:--';
    }
}

function formatEventType(event: string): string {
    const eventMap: Record<string, { label: string; color: typeof chalk.green }> = {
        'frame_generated': { label: '[GEN]', color: chalk.blue },
        'frame_audited': { label: '[AUD]', color: chalk.cyan },
        'frame_approved': { label: '[APP]', color: chalk.green },
        'frame_rejected': { label: '[REJ]', color: chalk.red },
        'frame_retry': { label: '[RTY]', color: chalk.yellow },
        'export_started': { label: '[EXP]', color: chalk.magenta },
        'validation_complete': { label: '[VAL]', color: chalk.green },
        'run_started': { label: '[RUN]', color: chalk.blue },
        'run_completed': { label: '[END]', color: chalk.green },
    };

    const mapping = eventMap[event] ?? { label: `[${event.substring(0, 3).toUpperCase()}]`, color: chalk.gray };
    return mapping.color(mapping.label);
}

function formatLogMessage(entry: AuditLogEntry): string {
    const parts: string[] = [];

    if (entry.frameIndex !== undefined) {
        parts.push(`Frame ${entry.frameIndex}`);
    }

    if (entry.event === 'frame_generated' && entry.attempt !== undefined) {
        parts.push(`generated (attempt ${entry.attempt})`);
    } else if (entry.event === 'frame_audited' && entry.score !== undefined) {
        const status = entry.score >= 0.7 ? 'passed' : 'failed';
        parts.push(`${status} (score: ${entry.score.toFixed(2)})`);
    } else if (entry.event === 'frame_approved') {
        parts.push('approved');
    } else if (entry.event === 'frame_rejected' && entry.reasonCodes) {
        parts.push(`rejected (${entry.reasonCodes.join(', ')})`);
    } else if (entry.event === 'validation_complete') {
        parts.push('Validation complete');
    } else if (entry.event === 'export_started') {
        parts.push('Export started');
    } else if (entry.event === 'run_started') {
        parts.push('Run started');
    } else if (entry.event === 'run_completed') {
        parts.push('Run completed');
    } else {
        parts.push(entry.event);
    }

    return parts.join(' ');
}

function getStatusIcon(status: string): string {
    switch (status) {
        case 'initializing': return '🔄';
        case 'in_progress': return '🔄';
        case 'paused': return '⏸️';
        case 'completed': return '✅';
        case 'failed': return '❌';
        default: return '❓';
    }
}

function getStatusColor(status: string): typeof chalk.green {
    switch (status) {
        case 'initializing': return chalk.yellow;
        case 'in_progress': return chalk.yellow;
        case 'paused': return chalk.yellow;
        case 'completed': return chalk.green;
        case 'failed': return chalk.red;
        default: return chalk.gray;
    }
}

function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Export internal functions for testing
export const _internal = {
    calculateSummary,
    scanFolder,
    getRootFiles,
    formatDuration,
    formatSize,
};
