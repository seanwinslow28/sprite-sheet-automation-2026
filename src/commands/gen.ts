/**
 * Gen command - Generate sprite animation from manifest
 * Per Story 8.1: CLI Entry Point and Story 8.2: banana gen Command
 */

import { Command } from 'commander';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve } from 'path';
import chalk from 'chalk';
import { parse as parseYaml } from 'yaml';

import { logger } from '../utils/logger.js';
import { pathExists } from '../utils/fs-helpers.js';
import { manifestSchema, type Manifest, type PromptTemplates } from '../domain/schemas/manifest.js';
import { ProgressReporter, type SummaryStats } from '../core/progress-reporter.js';

// Core orchestration
import {
    createOrchestratorContext,
    runOrchestrator,
    requestAbort,
    type OrchestratorContext,
} from '../core/orchestrator.js';

// Run management
import {
    generateRunId,
    createRunFolder,
    type RunPaths,
} from '../core/run-folder-manager.js';

// Manifest and lock file
import { generateLockFile } from '../core/lock-file-generator.js';

// Anchor analysis
import { analyzeAnchor, type AnchorAnalysis } from '../core/anchor-analyzer.js';

// Shutdown handling
import { registerShutdownHandlers, isShutdownInProgress } from '../core/shutdown-handler.js';

// Director server
import { startDirectorServer, type DirectorServer } from '../core/director-server.js';

/**
 * Gen command options
 */
export interface GenOptions {
    move: string;
    manifest: string;
    interactive: boolean;
    frames?: number;
    skipValidation: boolean;
    allowValidationFail: boolean;
    noResume: boolean;
    verbose: boolean;
    runsDir: string;
    port: number;
    dryRun: boolean;
}

/**
 * Load and validate manifest
 */
async function loadManifest(manifestPath: string): Promise<Manifest> {
    const resolvedPath = resolve(manifestPath);

    if (!existsSync(resolvedPath)) {
        throw new Error(`Manifest not found: ${resolvedPath}`);
    }

    const content = await readFile(resolvedPath, 'utf-8');
    const parsed = parseYaml(content);
    return manifestSchema.parse(parsed);
}

/**
 * Get API key from environment
 */
function getApiKey(): string {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error(
            'GEMINI_API_KEY environment variable is required.\n' +
            'Set it with: export GEMINI_API_KEY=your_key'
        );
    }
    return apiKey;
}

/**
 * Initialize a new run
 */
async function initializeRun(
    manifest: Manifest,
    manifestPath: string,
    runsDir: string,
    reporter: ProgressReporter
): Promise<{
    runId: string;
    runPaths: RunPaths;
    anchorAnalysis: AnchorAnalysis;
    templates: PromptTemplates;
}> {
    // Generate run ID
    reporter.start('Initializing run...');
    const runId = generateRunId();

    // Create folder structure
    const createResult = await createRunFolder(runsDir, runId);
    if (!createResult.ok) {
        throw new Error(`Failed to create run folder: ${createResult.error.message}`);
    }
    const runPaths = createResult.value;
    reporter.succeed(`Run initialized (${runId})`);

    // Generate lock file
    reporter.start('Generating manifest lock...');
    const lockResult = await generateLockFile(manifest, manifestPath, runId, runPaths);
    if (!lockResult.ok) {
        throw new Error(`Failed to generate lock file: ${lockResult.error.message}`);
    }
    reporter.succeed('Manifest lock generated');

    // Analyze anchor
    reporter.start('Analyzing anchor image...');
    const anchorPath = resolve(manifest.inputs.anchor);
    if (!(await pathExists(anchorPath))) {
        throw new Error(`Anchor image not found: ${anchorPath}`);
    }
    const anchorResult = await analyzeAnchor(anchorPath);
    if (!anchorResult.ok) {
        throw new Error(`Anchor analysis failed: ${anchorResult.error.message}`);
    }
    const anchorAnalysis = anchorResult.value;
    reporter.succeed(`Anchor analyzed (baseline: ${anchorAnalysis.results.baselineY}px)`);
    reporter.debug('Anchor analysis', { baselineY: anchorAnalysis.results.baselineY });

    // Templates come from the manifest
    const templates = manifest.generator.prompts;
    reporter.succeed('Prompt templates loaded');

    return { runId, runPaths, anchorAnalysis, templates };
}

/**
 * Wait for Director Mode to complete
 */
async function waitForDirector(
    server: DirectorServer,
    reporter: ProgressReporter
): Promise<void> {
    return new Promise((resolve) => {
        // Listen for commit
        const onCommit = (): void => {
            cleanup();
            reporter.directorCommit();
            resolve();
        };

        // Listen for server close
        const onClose = (): void => {
            cleanup();
            reporter.directorCancel();
            resolve();
        };

        server.on('commit', onCommit);
        server.on('close', onClose);

        function cleanup(): void {
            server.removeListener('commit', onCommit);
            server.removeListener('close', onClose);
        }
    });
}

/**
 * Execute the gen command
 */
async function executeGen(options: GenOptions): Promise<void> {
    const reporter = new ProgressReporter({
        verbose: options.verbose,
    });

    let orchestratorCtx: OrchestratorContext | null = null;
    let directorServer: DirectorServer | null = null;

    try {
        // Print banner
        console.log('');
        console.log(chalk.bold.cyan('Banana Pipeline'));
        console.log(chalk.gray('═'.repeat(50)));
        console.log('');

        // Load and validate manifest
        reporter.start('Loading manifest...');
        const manifest = await loadManifest(options.manifest);
        reporter.succeed('Manifest validated');
        reporter.debug('Manifest identity', {
            character: manifest.identity.character,
            move: manifest.identity.move,
        });

        // Get API key
        const apiKey = getApiKey();

        // Override frame count if specified
        if (options.frames !== undefined && options.frames > 0) {
            manifest.identity.frame_count = options.frames;
            reporter.info(`Frame count overridden to ${options.frames}`);
        }

        // Initialize run
        const { runId, runPaths, anchorAnalysis, templates } = await initializeRun(
            manifest,
            options.manifest,
            options.runsDir,
            reporter
        );

        // Update reporter with run path for logging
        const runReporter = new ProgressReporter({
            runPath: runPaths.root,
            verbose: options.verbose,
        });

        // Create orchestrator context
        orchestratorCtx = createOrchestratorContext(
            manifest,
            templates,
            runPaths,
            options.runsDir,
            anchorAnalysis,
            apiKey,
            {
                dryRun: options.dryRun,
                forceFlag: options.noResume,
            }
        );

        // Register shutdown handlers
        registerShutdownHandlers(orchestratorCtx, runReporter);

        // Run generation
        runReporter.start(`Starting generation of ${manifest.identity.frame_count} frames...`);
        const genResult = await runOrchestrator(orchestratorCtx);

        // Calculate summary stats
        const approved = orchestratorCtx.state.frame_states.filter(f => f.status === 'approved').length;
        const failed = orchestratorCtx.state.frame_states.filter(f => f.status === 'failed').length;

        // Calculate retry count from attempt tracking (retries = attempts beyond the first)
        const retryCount = Object.values(orchestratorCtx.state.frameAttempts)
            .reduce((sum, frame) => sum + Math.max(0, frame.attempts.length - 1), 0);

        const stats: SummaryStats = {
            approved,
            rejected: failed,
            total: manifest.identity.frame_count,
            retryCount,
            durationMs: runReporter.getElapsedMs(),
        };

        // Show summary
        runReporter.summary(stats, runId, runPaths.root);

        // Check if we should proceed to Director Mode
        if (options.interactive && genResult.success) {
            // Start Director server
            directorServer = await startDirectorServer(
                runPaths.root,
                runId,
                options.port
            );

            runReporter.directorLaunch(options.port);

            // Wait for Director to complete
            await waitForDirector(directorServer, runReporter);

            // Close server
            directorServer.close();
            directorServer = null;
        }

        // Final message
        console.log('');
        if (genResult.success) {
            console.log(chalk.green('Pipeline completed successfully!'));
            console.log(chalk.gray(`Run ID: ${runId}`));
            console.log(chalk.gray(`Output: ${runPaths.root}`));
        } else {
            console.log(chalk.yellow('Pipeline completed with issues.'));
            console.log(chalk.gray(`Run 'banana inspect ${runId}' for details.`));
        }
        console.log('');

        if (!genResult.success) {
            process.exit(1);
        }

    } catch (error) {
        reporter.fail('Generation failed');
        logger.error({
            event: 'gen_error',
            error: error instanceof Error ? error.message : String(error),
        }, 'Generation command failed');

        console.error(chalk.red(error instanceof Error ? error.message : String(error)));

        // Clean up Director server if running
        if (directorServer) {
            directorServer.close();
        }

        // Request abort if orchestrator is running
        if (orchestratorCtx && !isShutdownInProgress()) {
            requestAbort(orchestratorCtx);
        }

        process.exit(1);
    }
}

/**
 * Register the gen command
 */
export function registerGenCommand(program: Command): void {
    program
        .command('gen')
        .description('Generate sprite animation from manifest')
        .requiredOption('-m, --move <name>', 'Move name to generate (e.g., idle_standard, walk)')
        .option('--manifest <path>', 'Path to manifest file', 'manifest.yaml')
        .option('-i, --interactive', 'Launch Director Mode for review after generation', false)
        .option('--frames <count>', 'Override frame count', parseInt)
        .option('--skip-validation', 'Skip Phaser micro-tests after export', false)
        .option('--allow-validation-fail', 'Export despite validation failures', false)
        .option('--no-resume', 'Start fresh run, ignoring existing progress', false)
        .option('-v, --verbose', 'Show detailed progress and debug info', false)
        .option('--runs-dir <dir>', 'Runs output directory', 'runs')
        .option('--port <number>', 'Director Mode server port', parseInt, 3000)
        .option('--dry-run', 'Simulate generation without calling Gemini API', false)
        .action(async (options: {
            move: string;
            manifest: string;
            interactive: boolean;
            frames?: number;
            skipValidation: boolean;
            allowValidationFail: boolean;
            resume: boolean; // Note: Commander inverts --no-resume
            verbose: boolean;
            runsDir: string;
            port: number;
            dryRun: boolean;
        }) => {
            await executeGen({
                move: options.move,
                manifest: options.manifest,
                interactive: options.interactive,
                frames: options.frames,
                skipValidation: options.skipValidation,
                allowValidationFail: options.allowValidationFail,
                noResume: !options.resume, // Invert back
                verbose: options.verbose,
                runsDir: options.runsDir,
                port: options.port,
                dryRun: options.dryRun,
            });
        });
}
