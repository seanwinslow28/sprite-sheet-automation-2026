/**
 * Pipeline orchestrator - state machine for generate-audit-retry loop
 * Per Story 4.8: Implement Orchestrator State Machine
 */

import { join, basename } from 'path';
import { logger } from '../utils/logger.js';
import { writeJsonAtomic } from '../utils/fs-helpers.js';

// State management
import {
    initializeState,
    saveState,
    markFrameInProgress,
    markFrameApproved,
    markFrameFailed,
    isRunComplete,
} from './state-manager.js';

// Attempt tracking
import {
    type RunStateWithAttempts,
    initializeAttemptTracking,
    recordAttempt,
    isMaxAttemptsReached,
    markFrameMaxAttemptsReached,
    markFrameRejected,
    hashPrompt,
} from './attempt-tracker.js';

// Frame chaining
import {
    selectReferenceFrame,
    getApprovedFramePaths,
    findNextPendingFrame,
} from './frame-chain-resolver.js';

// Retry management
import {
    type RetryStateStorage,
    createRetryStateStorage,
    getNextAction,
    recordActionTried,
    recordSF01Score,
    recordPassFail,
    isLadderExhausted,
    resetFrameRetryState,
    isStopDecision,
    isRetryDecision,
} from './retry-manager.js';

// Stop conditions
import {
    type StopConditionsConfig,
    type StopReason,
    DEFAULT_STOP_CONDITIONS,
    evaluateStopConditions,
    createUserInterruptReason,
    calculateRunStatistics,
} from './stop-condition-evaluator.js';

// Status reporting
import {
    createInProgressStatus,
    createCompletedStatus,
    createStoppedStatus,
    createFailedStatus,
    logStatus,
} from './status-reporter.js';

// Diagnostics
import { generateDiagnosticReport } from './diagnostic-generator.js';

// Run detection
import {
    decideResumption,
    loadStateForResumption,
    calculateManifestHash,
} from './run-detector.js';

// Types
import type { Manifest, PromptTemplates } from '../domain/schemas/manifest.js';
import type { RunPaths } from './run-folder-manager.js';
import type { AnchorAnalysis } from './anchor-analyzer.js';
import type { RetryAction } from '../domain/retry-actions.js';
import {
    type OrchestratorState,
    type StateTransition,
    isValidTransition,
    isTerminalState,
} from '../domain/types/orchestrator-state.js';
import type { RunStatus } from '../domain/types/run-status.js';

/**
 * Orchestrator context - all data needed during execution
 */
export interface OrchestratorContext {
    // Configuration
    manifest: Manifest;
    templates: PromptTemplates;
    stopConditions: StopConditionsConfig;

    // Paths
    runPaths: RunPaths;
    runsDir: string;

    // References
    anchorAnalysis: AnchorAnalysis;
    apiKey: string;

    // State machine
    currentState: OrchestratorState;
    currentFrameIndex: number;
    currentAttempt: number;
    currentRetryAction?: RetryAction;

    // Tracking
    state: RunStateWithAttempts;
    retryStorage: RetryStateStorage;
    transitionHistory: StateTransition[];

    // Timing
    startTime: Date;
    stateEntryTime: Date;

    // Flags
    forceFlag: boolean;
    dryRun: boolean;
    abortRequested: boolean;
}

/**
 * Orchestrator result
 */
export interface OrchestratorResult {
    success: boolean;
    runId: string;
    finalState: OrchestratorState;
    status: RunStatus;
    diagnosticPath?: string;
}

/**
 * Extract run ID from run path
 */
function extractRunId(runPaths: RunPaths): string {
    return basename(runPaths.root);
}

/**
 * Create initial orchestrator context
 */
export function createOrchestratorContext(
    manifest: Manifest,
    templates: PromptTemplates,
    runPaths: RunPaths,
    runsDir: string,
    anchorAnalysis: AnchorAnalysis,
    apiKey: string,
    options: {
        forceFlag?: boolean;
        dryRun?: boolean;
        stopConditions?: Partial<StopConditionsConfig>;
    } = {}
): OrchestratorContext {
    const now = new Date();
    const runId = extractRunId(runPaths);

    // Initialize run state with attempt tracking
    const baseState = initializeState(runId, manifest.identity.frame_count);
    const state = initializeAttemptTracking(baseState, manifest.identity.frame_count);

    return {
        manifest,
        templates,
        stopConditions: {
            ...DEFAULT_STOP_CONDITIONS,
            ...options.stopConditions,
        },
        runPaths,
        runsDir,
        anchorAnalysis,
        apiKey,
        currentState: 'INIT',
        currentFrameIndex: 0,
        currentAttempt: 1,
        state,
        retryStorage: createRetryStateStorage(),
        transitionHistory: [],
        startTime: now,
        stateEntryTime: now,
        forceFlag: options.forceFlag ?? false,
        dryRun: options.dryRun ?? false,
        abortRequested: false,
    };
}

/**
 * Transition to a new state
 */
function transitionTo(
    ctx: OrchestratorContext,
    newState: OrchestratorState,
    reason?: string,
    metadata?: Record<string, unknown>
): void {
    const oldState = ctx.currentState;

    if (!isValidTransition(oldState, newState)) {
        logger.error({
            from: oldState,
            to: newState,
        }, `Invalid state transition: ${oldState} → ${newState}`);
        throw new Error(`Invalid state transition: ${oldState} → ${newState}`);
    }

    const now = new Date();
    const durationMs = now.getTime() - ctx.stateEntryTime.getTime();

    const transition: StateTransition = {
        from: oldState,
        to: newState,
        timestamp: now.toISOString(),
        reason,
        frameIndex: ctx.currentFrameIndex,
        attemptIndex: ctx.currentAttempt,
        durationMs,
        metadata,
    };

    ctx.transitionHistory.push(transition);
    ctx.currentState = newState;
    ctx.stateEntryTime = now;

    logger.info({
        event: 'state_transition',
        from: oldState,
        to: newState,
        frameIndex: ctx.currentFrameIndex,
        attemptIndex: ctx.currentAttempt,
        durationMs,
        reason,
    }, `State: ${oldState} → ${newState}${reason ? ` (${reason})` : ''}`);
}

/**
 * Persist state to disk
 */
async function persistState(ctx: OrchestratorContext): Promise<void> {
    // Update timestamps
    ctx.state.updated_at = new Date().toISOString();

    // Save atomically
    const result = await saveState(ctx.runPaths.stateJson, ctx.state);

    if (!result.ok) {
        logger.error({
            error: result.error,
        }, 'Failed to persist state');
        throw new Error(`Failed to persist state: ${result.error.message}`);
    }
}

/**
 * Execute INIT state
 */
async function executeInit(ctx: OrchestratorContext): Promise<void> {
    const runId = extractRunId(ctx.runPaths);
    logger.info({
        runId,
        character: ctx.manifest.identity.character,
        move: ctx.manifest.identity.move,
        totalFrames: ctx.manifest.identity.frame_count,
    }, 'Initializing orchestrator');

    // Check for existing run to resume
    const resumeDecision = await decideResumption(
        ctx.runsDir,
        ctx.manifest,
        ctx.forceFlag
    );

    if (resumeDecision.canResume && resumeDecision.existingRun) {
        // Resume existing run
        const loadResult = await loadStateForResumption(resumeDecision.existingRun);
        if (loadResult.ok) {
            const loadedState = loadResult.value;

            // High Bug #1 fix: Preserve attempt tracking from previous run
            // Check if state already has attempt tracking data
            const hasAttemptTracking = 'totalAttempts' in loadedState &&
                'frameAttempts' in loadedState;

            if (hasAttemptTracking) {
                // State already has attempt tracking - use it directly
                ctx.state = loadedState as RunStateWithAttempts;

                logger.info({
                    resumedFrom: resumeDecision.existingRun.runId,
                    totalAttempts: (loadedState as RunStateWithAttempts).totalAttempts,
                }, 'Resumed with preserved attempt tracking');
            } else {
                // Old state format - initialize attempt tracking fresh
                const resumedState = initializeAttemptTracking(
                    loadedState,
                    ctx.manifest.identity.frame_count
                );
                ctx.state = resumedState;
            }

            ctx.currentFrameIndex = resumeDecision.firstPendingFrame ?? 0;

            logger.info({
                resumedFrom: resumeDecision.existingRun.runId,
                firstPendingFrame: ctx.currentFrameIndex,
            }, 'Resumed from existing run');
        }
    }

    // Write manifest lock with hash
    const lockData = {
        manifest_hash: calculateManifestHash(ctx.manifest),
        created_at: new Date().toISOString(),
        manifest_identity: ctx.manifest.identity,
    };
    await writeJsonAtomic(ctx.runPaths.lockJson, lockData);

    // Update state status
    ctx.state.status = 'in_progress';
    await persistState(ctx);

    // Log status
    const status = createInProgressStatus(ctx.state, 'Initializing', ctx.startTime);
    logStatus(status);

    // Transition to generating
    transitionTo(ctx, 'GENERATING', 'Initialization complete');
}

/**
 * Execute GENERATING state
 */
async function executeGenerating(ctx: OrchestratorContext): Promise<{
    success: boolean;
    candidatePath?: string;
    rawPrompt?: string;
    error?: string;
}> {
    const frameIndex = ctx.currentFrameIndex;
    const attemptIndex = ctx.currentAttempt;

    logger.info({
        frameIndex,
        attemptIndex,
        retryAction: ctx.currentRetryAction,
    }, `Generating frame ${frameIndex} (attempt ${attemptIndex})`);

    // Mark frame in progress
    ctx.state = markFrameInProgress(ctx.state, frameIndex, attemptIndex) as RunStateWithAttempts;
    await persistState(ctx);

    // Select reference frame
    const approvedPaths = getApprovedFramePaths(ctx.state);
    const forceReAnchor = ctx.currentRetryAction === 'RE_ANCHOR' ||
        ctx.currentRetryAction === 'IDENTITY_RESCUE';

    const reference = selectReferenceFrame(
        frameIndex,
        approvedPaths,
        ctx.manifest.inputs.anchor,
        forceReAnchor
    );

    logger.info({
        frameIndex,
        referenceSource: reference.source,
        referencePath: reference.path,
    }, reference.reason);

    // In dry run mode, simulate success
    if (ctx.dryRun) {
        const candidatePath = join(
            ctx.runPaths.candidates,
            `frame_${frameIndex.toString().padStart(4, '0')}_attempt_${attemptIndex}.png`
        );

        return {
            success: true,
            candidatePath,
            rawPrompt: '[DRY RUN] Simulated prompt',
        };
    }

    // TODO: Call actual generator adapter here
    // For now, return simulated result
    // In production, this would call:
    // const result = await generateFrame(generatorContext, ctx.templates, ctx.apiKey);

    const candidatePath = join(
        ctx.runPaths.candidates,
        `frame_${frameIndex.toString().padStart(4, '0')}_attempt_${attemptIndex}.png`
    );

    // Simulated success for orchestrator testing
    return {
        success: true,
        candidatePath,
        rawPrompt: `[SIMULATED] Frame ${frameIndex}, Attempt ${attemptIndex}`,
    };
}

/**
 * Execute AUDITING state
 */
async function executeAuditing(ctx: OrchestratorContext, candidatePath: string): Promise<{
    passed: boolean;
    reasonCodes: string[];
    compositeScore?: number;
    sf01Score?: number;
}> {
    const frameIndex = ctx.currentFrameIndex;

    logger.info({
        frameIndex,
        candidatePath,
    }, `Auditing frame ${frameIndex}`);

    // TODO: Call actual auditor here
    // For now, simulate random pass/fail for testing
    // In production, this would run:
    // 1. Hard gates (evaluateHardGates)
    // 2. Soft metrics (SSIM, palette, baseline)
    // 3. Composite score calculation

    // Simulated audit result (80% pass rate for testing)
    const passed = Math.random() > 0.2;
    const sf01Score = 0.7 + Math.random() * 0.25; // 0.7-0.95
    const compositeScore = 0.6 + Math.random() * 0.35; // 0.6-0.95

    const reasonCodes: string[] = [];
    if (!passed) {
        // Randomly assign failure reason
        const failures = ['SF01_IDENTITY_DRIFT', 'SF02_PALETTE_DRIFT', 'SF03_BASELINE_DRIFT'];
        reasonCodes.push(failures[Math.floor(Math.random() * failures.length)]);
    }

    // Record SF01 score for collapse detection
    recordSF01Score(ctx.retryStorage, frameIndex, sf01Score);

    return {
        passed,
        reasonCodes,
        compositeScore,
        sf01Score,
    };
}

/**
 * Execute RETRY_DECIDING state
 */
async function executeRetryDeciding(
    ctx: OrchestratorContext,
    reasonCodes: string[],
    compositeScore?: number
): Promise<{
    shouldRetry: boolean;
    action?: RetryAction;
    shouldReject?: boolean;
    rejectReason?: string;
}> {
    const frameIndex = ctx.currentFrameIndex;
    const attemptIndex = ctx.currentAttempt;
    const primaryReason = reasonCodes[0] ?? 'UNKNOWN';

    logger.info({
        frameIndex,
        attemptIndex,
        reasonCodes,
        compositeScore,
    }, `Deciding retry action for frame ${frameIndex}`);

    // Check max attempts first
    const maxAttempts = ctx.manifest.generator.max_attempts_per_frame ?? 5;
    if (isMaxAttemptsReached(ctx.state, frameIndex, maxAttempts)) {
        ctx.state = markFrameMaxAttemptsReached(ctx.state, frameIndex);
        // Critical Bug #1 fix: Also update frame_states to mark as failed
        ctx.state = markFrameFailed(ctx.state, frameIndex, 'MAX_ATTEMPTS_REACHED');
        await persistState(ctx);

        return {
            shouldRetry: false,
        };
    }

    // Consult retry ladder
    const decision = getNextAction(
        ctx.retryStorage,
        frameIndex,
        primaryReason,
        attemptIndex
    );

    if (isStopDecision(decision)) {
        // Frame should be rejected (identity collapse or oscillation)
        ctx.state = markFrameRejected(ctx.state, frameIndex, decision.stopReason);
        // Critical Bug #1 fix: Also update frame_states to mark as failed
        ctx.state = markFrameFailed(ctx.state, frameIndex, decision.stopReason);
        await persistState(ctx);

        return {
            shouldRetry: false,
            shouldReject: true,
            rejectReason: decision.stopReason,
        };
    }

    if (isRetryDecision(decision)) {
        // Record action as tried
        recordActionTried(ctx.retryStorage, frameIndex, decision.action);

        return {
            shouldRetry: true,
            action: decision.action,
        };
    }

    // Ladder exhausted but attempts remaining - try default regeneration
    if (!isLadderExhausted(ctx.retryStorage, frameIndex)) {
        recordActionTried(ctx.retryStorage, frameIndex, 'DEFAULT_REGENERATE');
        return {
            shouldRetry: true,
            action: 'DEFAULT_REGENERATE',
        };
    }

    // Both ladder and attempts exhausted
    ctx.state = markFrameMaxAttemptsReached(ctx.state, frameIndex);
    // Critical Bug #1 fix: Also update frame_states to mark as failed
    ctx.state = markFrameFailed(ctx.state, frameIndex, 'LADDER_EXHAUSTED');
    await persistState(ctx);

    return {
        shouldRetry: false,
    };
}

/**
 * Execute APPROVING state
 */
async function executeApproving(
    ctx: OrchestratorContext,
    candidatePath: string
): Promise<void> {
    const frameIndex = ctx.currentFrameIndex;

    logger.info({
        frameIndex,
        candidatePath,
    }, `Approving frame ${frameIndex}`);

    // Build approved path
    const approvedFilename = `frame_${frameIndex.toString().padStart(4, '0')}.png`;
    const approvedPath = join(ctx.runPaths.approved, approvedFilename);

    // In production, copy file to approved folder
    // For now, just update state
    // await fs.copyFile(candidatePath, approvedPath);

    // Mark frame approved
    ctx.state = markFrameApproved(ctx.state, frameIndex, approvedPath) as RunStateWithAttempts;

    // Update frame attempts state
    ctx.state.frameAttempts[frameIndex].finalStatus = 'approved';

    // Reset retry state for this frame
    resetFrameRetryState(ctx.retryStorage, frameIndex);

    // High Bug #2 fix: REMOVED duplicate recordPassFail call
    // Pass/fail is already recorded in AUDITING state (line ~727)
    // Recording twice skews oscillation detection pattern

    await persistState(ctx);

    logger.info({
        frameIndex,
        approvedPath,
        attemptCount: ctx.currentAttempt,
    }, `Frame ${frameIndex} approved`);
}

/**
 * Execute NEXT_FRAME state
 */
async function executeNextFrame(ctx: OrchestratorContext): Promise<{
    complete: boolean;
    stopped: boolean;
    stopReason?: StopReason;
}> {
    // Check if run is complete
    if (isRunComplete(ctx.state)) {
        return { complete: true, stopped: false };
    }

    // Find next pending frame
    const nextFrame = findNextPendingFrame(ctx.state);

    if (nextFrame === null) {
        return { complete: true, stopped: false };
    }

    // Check stop conditions
    const stopCheck = evaluateStopConditions(ctx.state, ctx.stopConditions);

    if (stopCheck.shouldStop && stopCheck.reason) {
        return {
            complete: false,
            stopped: true,
            stopReason: stopCheck.reason,
        };
    }

    // Move to next frame
    ctx.currentFrameIndex = nextFrame;
    ctx.currentAttempt = 1;
    ctx.currentRetryAction = undefined;

    logger.info({
        nextFrame,
        statistics: stopCheck.statistics,
    }, `Moving to frame ${nextFrame}`);

    return { complete: false, stopped: false };
}

/**
 * Execute STOPPED state
 */
async function executeStopped(
    ctx: OrchestratorContext,
    stopReason: StopReason
): Promise<void> {
    logger.warn({
        stopReason: stopReason.condition,
        message: stopReason.message,
    }, 'Run stopped');

    // Update state
    ctx.state.status = 'paused';
    await persistState(ctx);

    // Generate diagnostic report
    const statistics = calculateRunStatistics(ctx.state);
    const diagnosticPath = join(ctx.runPaths.root, 'diagnostic.json');

    await generateDiagnosticReport(
        ctx.state,
        stopReason,
        statistics,
        diagnosticPath
    );

    logger.info({
        diagnosticPath,
    }, 'Diagnostic report generated');
}

/**
 * Execute COMPLETED state
 */
async function executeCompleted(ctx: OrchestratorContext): Promise<void> {
    const runId = extractRunId(ctx.runPaths);
    logger.info({
        runId,
        approvedFrames: ctx.state.frame_states.filter(f => f.status === 'approved').length,
        totalFrames: ctx.state.total_frames,
    }, 'Run completed');

    // Update state
    ctx.state.status = 'completed';
    await persistState(ctx);
}

/**
 * Main orchestrator execution loop
 */
export async function runOrchestrator(
    ctx: OrchestratorContext
): Promise<OrchestratorResult> {
    let candidatePath: string | undefined;
    let auditResult: { passed: boolean; reasonCodes: string[]; compositeScore?: number; sf01Score?: number } | undefined;

    try {
        // Main state machine loop
        while (!isTerminalState(ctx.currentState) && !ctx.abortRequested) {
            switch (ctx.currentState) {
                case 'INIT':
                    await executeInit(ctx);
                    break;

                case 'GENERATING': {
                    const genResult = await executeGenerating(ctx);

                    // Record attempt
                    ctx.state = recordAttempt(ctx.state, ctx.currentFrameIndex, {
                        timestamp: new Date().toISOString(),
                        promptHash: hashPrompt(genResult.rawPrompt ?? ''),
                        result: 'pending',
                        reasonCodes: [],
                        durationMs: 0,
                        strategy: ctx.currentRetryAction,
                    });

                    if (!genResult.success) {
                        // Generation failed - go to retry deciding
                        transitionTo(ctx, 'AUDITING', 'Generation failed');
                        auditResult = {
                            passed: false,
                            reasonCodes: ['SYS_GENERATION_FAILED'],
                        };
                    } else {
                        candidatePath = genResult.candidatePath;
                        transitionTo(ctx, 'AUDITING', 'Frame generated');
                    }
                    break;
                }

                case 'AUDITING': {
                    if (!candidatePath) {
                        // No candidate - treat as failure
                        auditResult = {
                            passed: false,
                            reasonCodes: ['SYS_NO_CANDIDATE'],
                        };
                    } else {
                        auditResult = await executeAuditing(ctx, candidatePath);
                    }

                    // Update attempt record
                    const history = ctx.state.frameAttempts[ctx.currentFrameIndex].attempts;
                    if (history.length > 0) {
                        const lastAttempt = history[history.length - 1];
                        lastAttempt.result = auditResult.passed ? 'passed' : 'soft_fail';
                        lastAttempt.reasonCodes = auditResult.reasonCodes;
                        lastAttempt.compositeScore = auditResult.compositeScore;
                    }

                    // Record pass/fail for oscillation detection
                    recordPassFail(
                        ctx.retryStorage,
                        ctx.currentFrameIndex,
                        auditResult.passed ? 'pass' : 'fail'
                    );

                    if (auditResult.passed) {
                        transitionTo(ctx, 'APPROVING', 'Audit passed');
                    } else {
                        transitionTo(ctx, 'RETRY_DECIDING', `Audit failed: ${auditResult.reasonCodes.join(', ')}`);
                    }
                    break;
                }

                case 'RETRY_DECIDING': {
                    const retryResult = await executeRetryDeciding(
                        ctx,
                        auditResult?.reasonCodes ?? [],
                        auditResult?.compositeScore
                    );

                    if (retryResult.shouldRetry && retryResult.action) {
                        ctx.currentAttempt++;
                        ctx.currentRetryAction = retryResult.action;
                        transitionTo(ctx, 'GENERATING', `Retry with ${retryResult.action}`);
                    } else {
                        // Frame failed or rejected - move to next
                        transitionTo(ctx, 'NEXT_FRAME', retryResult.rejectReason ?? 'Max attempts reached');
                    }
                    break;
                }

                case 'APPROVING': {
                    if (candidatePath) {
                        await executeApproving(ctx, candidatePath);
                    }
                    transitionTo(ctx, 'NEXT_FRAME', 'Frame approved');
                    break;
                }

                case 'NEXT_FRAME': {
                    const nextResult = await executeNextFrame(ctx);

                    if (nextResult.complete) {
                        await executeCompleted(ctx);
                        transitionTo(ctx, 'COMPLETED', 'All frames processed');
                    } else if (nextResult.stopped && nextResult.stopReason) {
                        await executeStopped(ctx, nextResult.stopReason);
                        transitionTo(ctx, 'STOPPED', nextResult.stopReason.message);
                    } else {
                        transitionTo(ctx, 'GENERATING', `Processing frame ${ctx.currentFrameIndex}`);
                    }
                    break;
                }
            }

            // Persist state after each transition
            await persistState(ctx);
        }

        // Handle abort
        if (ctx.abortRequested) {
            const abortReason = createUserInterruptReason();
            await executeStopped(ctx, abortReason);
            ctx.currentState = 'STOPPED';
        }

        // Generate final status
        const status = ctx.currentState === 'COMPLETED'
            ? createCompletedStatus(ctx.state, ctx.startTime)
            : createStoppedStatus(
                ctx.state,
                { condition: 'USER_INTERRUPT', value: 0, threshold: 0, message: 'Run stopped' },
                calculateRunStatistics(ctx.state)
            );

        logStatus(status);

        const runId = extractRunId(ctx.runPaths);
        return {
            success: ctx.currentState === 'COMPLETED',
            runId,
            finalState: ctx.currentState,
            status,
            diagnosticPath: ctx.currentState === 'STOPPED'
                ? join(ctx.runPaths.root, 'diagnostic.json')
                : undefined,
        };

    } catch (error) {
        logger.error({
            error,
            state: ctx.currentState,
            frameIndex: ctx.currentFrameIndex,
        }, 'Orchestrator error');

        // Create failed status
        const errorMessage = error instanceof Error ? error.message : String(error);
        const status = createFailedStatus(
            ctx.state,
            'system',
            'SYS_ORCHESTRATOR_ERROR',
            errorMessage
        );

        logStatus(status);

        const runId = extractRunId(ctx.runPaths);
        return {
            success: false,
            runId,
            finalState: ctx.currentState,
            status,
        };
    }
}

/**
 * Request abort of the orchestrator
 */
export function requestAbort(ctx: OrchestratorContext): void {
    ctx.abortRequested = true;
    logger.warn('Abort requested - will stop after current operation');
}
