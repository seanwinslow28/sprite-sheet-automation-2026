/**
 * Pipeline runner - orchestrates single pipeline run
 * Per Story 2.6: Connects manifest validation, lock file, run folder, and generation
 */

import { promises as fs } from 'fs';
import { resolve, dirname } from 'path';
import { validateManifest, Result } from './config-resolver.js';
import { generateLockFile } from './lock-file-generator.js';
import { createRunFolder, generateRunId, type RunPaths } from './run-folder-manager.js';
import { initializeState, saveState, type RunState } from './state-manager.js';
import { analyzeAnchor, saveAnchorAnalysis, type AnchorAnalysis } from './anchor-analyzer.js';
import { type Manifest } from '../domain/schemas/manifest.js';

/**
 * Pipeline run context
 */
export interface RunContext {
    manifest: Manifest;
    runId: string;
    runPaths: RunPaths;
    anchorAnalysis: AnchorAnalysis;
    state: RunState;
}

/**
 * Pipeline error
 */
export interface PipelineError {
    code: string;
    message: string;
    cause?: unknown;
}

/**
 * Run options
 */
export interface RunOptions {
    manifestPath: string;
    runsDir?: string;
    dryRun?: boolean;
    verbose?: boolean;
}

/**
 * Load and parse manifest file
 */
async function loadManifest(manifestPath: string): Promise<Result<unknown, PipelineError>> {
    try {
        const absolutePath = resolve(manifestPath);
        const content = await fs.readFile(absolutePath, 'utf-8');

        // Try JSON first, then YAML
        try {
            return Result.ok(JSON.parse(content));
        } catch {
            // If not JSON, try YAML (simple implementation)
            // For full YAML support, would need yaml package
            return Result.ok(JSON.parse(content));
        }
    } catch (error) {
        return Result.err({
            code: 'PIPELINE_MANIFEST_LOAD_FAILED',
            message: `Failed to load manifest: ${manifestPath}`,
            cause: error,
        });
    }
}

/**
 * Initialize a pipeline run
 * Returns RunContext ready for generation
 */
export async function initializeRun(
    options: RunOptions
): Promise<Result<RunContext, PipelineError>> {
    const { manifestPath, runsDir = 'runs', dryRun = false, verbose = false } = options;

    // Step 1: Load manifest
    if (verbose) console.log(`Loading manifest: ${manifestPath}`);
    const rawResult = await loadManifest(manifestPath);
    if (!rawResult.ok) {
        return Result.err(rawResult.error);
    }

    // Step 2: Validate manifest
    if (verbose) console.log('Validating manifest...');
    const validateResult = validateManifest(rawResult.value);
    if (!validateResult.ok) {
        return Result.err({
            code: 'PIPELINE_MANIFEST_INVALID',
            message: `Manifest validation failed: ${validateResult.error.map(e => e.field).join(', ')}`,
            cause: validateResult.error,
        });
    }
    const manifest = validateResult.value;
    if (verbose) console.log('✓ Manifest validated');

    // Step 3: Generate run ID and create folder structure
    const runId = generateRunId();
    if (verbose) console.log(`Run ID: ${runId}`);

    const folderResult = await createRunFolder(runsDir, runId);
    if (!folderResult.ok) {
        return Result.err({
            code: folderResult.error.code,
            message: folderResult.error.message,
            cause: folderResult.error.cause,
        });
    }
    const runPaths = folderResult.value;
    if (verbose) console.log('✓ Run folder created');

    // Step 4: Generate lock file
    if (!dryRun) {
        if (verbose) console.log('Generating lock file...');
        const lockResult = await generateLockFile(manifest, manifestPath, runId, runPaths);
        if (!lockResult.ok) {
            return Result.err({
                code: lockResult.error.code,
                message: lockResult.error.message,
                cause: lockResult.error.cause,
            });
        }
        if (verbose) console.log('✓ Lock file generated');
    }

    // Step 5: Analyze anchor
    if (verbose) console.log('Analyzing anchor image...');
    const manifestDir = dirname(resolve(manifestPath));
    const anchorPath = resolve(manifestDir, manifest.inputs.anchor);

    const anchorResult = await analyzeAnchor(
        anchorPath,
        manifest.canvas.alignment.root_zone_ratio
    );
    if (!anchorResult.ok) {
        return Result.err({
            code: anchorResult.error.code,
            message: anchorResult.error.message,
            cause: anchorResult.error.cause,
        });
    }
    const anchorAnalysis = anchorResult.value;

    // Save anchor analysis
    if (!dryRun) {
        await saveAnchorAnalysis(anchorAnalysis, runPaths.anchorAnalysisJson);
    }
    if (verbose) console.log(`✓ Anchor analyzed (baselineY=${anchorAnalysis.results.baselineY}, rootX=${anchorAnalysis.results.rootX})`);

    // Step 6: Initialize state
    const state = initializeState(runId, manifest.identity.frame_count);
    if (!dryRun) {
        const saveResult = await saveState(runPaths.stateJson, state);
        if (!saveResult.ok) {
            return Result.err({
                code: saveResult.error.code,
                message: saveResult.error.message,
                cause: saveResult.error.cause,
            });
        }
    }
    if (verbose) console.log('✓ State initialized');

    return Result.ok({
        manifest,
        runId,
        runPaths,
        anchorAnalysis,
        state,
    });
}

/**
 * Run summary for reporting
 */
export interface RunSummary {
    runId: string;
    status: 'completed' | 'partial' | 'failed';
    framesGenerated: number;
    totalFrames: number;
    durationMs: number;
    errors: string[];
}

/**
 * Generate run summary
 */
export function generateRunSummary(
    context: RunContext,
    framesGenerated: number,
    durationMs: number,
    errors: string[]
): RunSummary {
    const status = framesGenerated === context.manifest.identity.frame_count
        ? 'completed'
        : framesGenerated > 0
            ? 'partial'
            : 'failed';

    return {
        runId: context.runId,
        status,
        framesGenerated,
        totalFrames: context.manifest.identity.frame_count,
        durationMs,
        errors,
    };
}
