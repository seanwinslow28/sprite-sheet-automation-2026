/**
 * Run command - CLI entry point for pipeline execution
 * Per Story 2.6: banana run <manifest> [options]
 */

import { Command } from 'commander';
import { initializeRun, generateRunSummary } from '../core/pipeline-runner.js';

/**
 * Register the run command with Commander
 */
export function registerRunCommand(program: Command): void {
    program
        .command('run <manifest>')
        .description('Run the sprite generation pipeline from a manifest file')
        .option('-d, --dry-run', 'Validate manifest without generating frames', false)
        .option('-v, --verbose', 'Show detailed output', false)
        .option('-r, --runs-dir <dir>', 'Output directory for runs', 'runs')
        .action(async (manifestPath: string, options: {
            dryRun: boolean;
            verbose: boolean;
            runsDir: string;
        }) => {
            const startTime = Date.now();

            console.log('');
            console.log('🍌 Banana Pipeline');
            console.log('==================');

            try {
                // Initialize run
                const initResult = await initializeRun({
                    manifestPath,
                    runsDir: options.runsDir,
                    dryRun: options.dryRun,
                    verbose: options.verbose,
                });

                if (!initResult.ok) {
                    console.error(`\n❌ ${initResult.error.code}: ${initResult.error.message}`);
                    process.exit(1);
                    return;
                }

                const context = initResult.value;

                if (options.dryRun) {
                    console.log('\n✓ Dry run complete - manifest is valid');
                    console.log(`  Character: ${context.manifest.identity.character}`);
                    console.log(`  Move: ${context.manifest.identity.move}`);
                    console.log(`  Frames: ${context.manifest.identity.frame_count}`);
                    console.log(`  Is Loop: ${context.manifest.identity.is_loop}`);
                    return;
                }

                console.log(`\nRun ID: ${context.runId}`);
                console.log(`Output: ${context.runPaths.root}`);

                // TODO: Implement frame generation loop
                // For MVP, we just initialize - full generation in Epic 4
                console.log('\n⚠️  Frame generation not yet implemented (Epic 2 MVP)');
                console.log('   Run folder and state initialized successfully.');

                const durationMs = Date.now() - startTime;
                const summary = generateRunSummary(context, 0, durationMs, []);

                console.log(`\nRun ${summary.status} in ${Math.round(durationMs / 1000)}s`);
                console.log(`  Frames: ${summary.framesGenerated}/${summary.totalFrames}`);

            } catch (error) {
                console.error('\n❌ Unexpected error:', error);
                process.exit(1);
            }
        });
}
