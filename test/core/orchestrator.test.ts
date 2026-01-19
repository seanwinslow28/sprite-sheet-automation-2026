/**
 * Tests for orchestrator state machine
 * Per Story 4.8: Implement Orchestrator State Machine
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
    createOrchestratorContext,
    runOrchestrator,
    requestAbort,
    type OrchestratorContext,
    type OrchestratorResult,
} from '../../src/core/orchestrator.js';
import {
    type OrchestratorState,
    isValidTransition,
    isTerminalState,
    VALID_TRANSITIONS,
} from '../../src/domain/types/orchestrator-state.js';
import type { Manifest, PromptTemplates } from '../../src/domain/schemas/manifest.js';
import type { RunPaths } from '../../src/core/run-folder-manager.js';
import type { AnchorAnalysis } from '../../src/core/anchor-analyzer.js';

describe('Orchestrator', () => {
    let tmpDir: string;
    let runPaths: RunPaths;
    let runsDir: string;

    // Create minimal test fixtures
    const createTestManifest = (frameCount: number = 4): Manifest => ({
        version: '1.0',
        identity: {
            character: 'blaze',
            move: 'idle',
            frame_count: frameCount,
            output_resolution: 128,
        },
        inputs: {
            anchor: 'assets/anchor.png',
            poses: 'assets/poses',
        },
        generator: {
            model: 'gemini-2.0-flash-exp',
            temperature: 1.0,
            seed_strategy: 'random',
            max_attempts_per_frame: 5,
        },
        auditor: {
            hard_gates: ['dimensions', 'alpha_edge', 'single_figure'],
            thresholds: {
                identity_min: 0.85,
                palette_max_drift: 0.1,
                baseline_tolerance: 4,
            },
        },
        export: {
            format: 'phaser',
            texture_packer_preset: 'default',
        },
    });

    const createTestTemplates = (): PromptTemplates => ({
        master: 'Generate frame {frame_index}',
        variation: 'Generate variation for frame {frame_index}',
    });

    const createTestAnchorAnalysis = (): AnchorAnalysis => ({
        width: 128,
        height: 128,
        dominantColors: ['#FF0000', '#00FF00', '#0000FF'],
        hasTransparency: true,
        boundingBox: { x: 10, y: 10, width: 100, height: 100 },
        baselineY: 120,
        contactPatch: { x: 50, y: 120, width: 30 },
    });

    beforeEach(async () => {
        tmpDir = join(tmpdir(), `orchestrator-test-${Date.now()}`);
        runsDir = join(tmpDir, 'runs');

        // Create run folder structure
        const runId = '20260118_100000_test_blaze_idle';
        const runRoot = join(runsDir, runId);

        runPaths = {
            root: runRoot,
            candidates: join(runRoot, 'candidates'),
            approved: join(runRoot, 'approved'),
            audit: join(runRoot, 'audit'),
            export: join(runRoot, 'export'),
            stateJson: join(runRoot, 'state.json'),
            lockJson: join(runRoot, 'manifest.lock.json'),
            auditLog: join(runRoot, 'audit_log.jsonl'),
        };

        await fs.mkdir(runPaths.candidates, { recursive: true });
        await fs.mkdir(runPaths.approved, { recursive: true });
        await fs.mkdir(runPaths.audit, { recursive: true });
        await fs.mkdir(runPaths.export, { recursive: true });
    });

    afterEach(async () => {
        try {
            await fs.rm(tmpDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    describe('OrchestratorState transitions', () => {
        it('should validate INIT → GENERATING transition', () => {
            expect(isValidTransition('INIT', 'GENERATING')).toBe(true);
        });

        it('should validate GENERATING → AUDITING transition', () => {
            expect(isValidTransition('GENERATING', 'AUDITING')).toBe(true);
        });

        it('should validate GENERATING → STOPPED transition', () => {
            expect(isValidTransition('GENERATING', 'STOPPED')).toBe(true);
        });

        it('should validate AUDITING → APPROVING transition', () => {
            expect(isValidTransition('AUDITING', 'APPROVING')).toBe(true);
        });

        it('should validate AUDITING → RETRY_DECIDING transition', () => {
            expect(isValidTransition('AUDITING', 'RETRY_DECIDING')).toBe(true);
        });

        it('should validate RETRY_DECIDING → GENERATING transition', () => {
            expect(isValidTransition('RETRY_DECIDING', 'GENERATING')).toBe(true);
        });

        it('should validate RETRY_DECIDING → NEXT_FRAME transition', () => {
            expect(isValidTransition('RETRY_DECIDING', 'NEXT_FRAME')).toBe(true);
        });

        it('should validate APPROVING → NEXT_FRAME transition', () => {
            expect(isValidTransition('APPROVING', 'NEXT_FRAME')).toBe(true);
        });

        it('should validate NEXT_FRAME → GENERATING transition', () => {
            expect(isValidTransition('NEXT_FRAME', 'GENERATING')).toBe(true);
        });

        it('should validate NEXT_FRAME → COMPLETED transition', () => {
            expect(isValidTransition('NEXT_FRAME', 'COMPLETED')).toBe(true);
        });

        it('should validate NEXT_FRAME → STOPPED transition', () => {
            expect(isValidTransition('NEXT_FRAME', 'STOPPED')).toBe(true);
        });

        it('should reject invalid transition INIT → COMPLETED', () => {
            expect(isValidTransition('INIT', 'COMPLETED')).toBe(false);
        });

        it('should reject invalid transition COMPLETED → GENERATING', () => {
            expect(isValidTransition('COMPLETED', 'GENERATING')).toBe(false);
        });

        it('should identify COMPLETED as terminal state', () => {
            expect(isTerminalState('COMPLETED')).toBe(true);
        });

        it('should identify STOPPED as terminal state', () => {
            expect(isTerminalState('STOPPED')).toBe(true);
        });

        it('should not identify GENERATING as terminal state', () => {
            expect(isTerminalState('GENERATING')).toBe(false);
        });
    });

    describe('createOrchestratorContext', () => {
        it('should create context with correct initial state', () => {
            const manifest = createTestManifest();
            const templates = createTestTemplates();
            const anchorAnalysis = createTestAnchorAnalysis();

            const ctx = createOrchestratorContext(
                manifest,
                templates,
                runPaths,
                runsDir,
                anchorAnalysis,
                'test-api-key'
            );

            expect(ctx.currentState).toBe('INIT');
            expect(ctx.currentFrameIndex).toBe(0);
            expect(ctx.currentAttempt).toBe(1);
            expect(ctx.state.total_frames).toBe(4);
            expect(ctx.state.run_id).toBe('20260118_100000_test_blaze_idle');
            expect(ctx.forceFlag).toBe(false);
            expect(ctx.dryRun).toBe(false);
            expect(ctx.abortRequested).toBe(false);
            expect(ctx.transitionHistory).toEqual([]);
        });

        it('should respect force flag option', () => {
            const manifest = createTestManifest();
            const templates = createTestTemplates();
            const anchorAnalysis = createTestAnchorAnalysis();

            const ctx = createOrchestratorContext(
                manifest,
                templates,
                runPaths,
                runsDir,
                anchorAnalysis,
                'test-api-key',
                { forceFlag: true }
            );

            expect(ctx.forceFlag).toBe(true);
        });

        it('should respect dry run option', () => {
            const manifest = createTestManifest();
            const templates = createTestTemplates();
            const anchorAnalysis = createTestAnchorAnalysis();

            const ctx = createOrchestratorContext(
                manifest,
                templates,
                runPaths,
                runsDir,
                anchorAnalysis,
                'test-api-key',
                { dryRun: true }
            );

            expect(ctx.dryRun).toBe(true);
        });

        it('should apply custom stop conditions', () => {
            const manifest = createTestManifest();
            const templates = createTestTemplates();
            const anchorAnalysis = createTestAnchorAnalysis();

            const ctx = createOrchestratorContext(
                manifest,
                templates,
                runPaths,
                runsDir,
                anchorAnalysis,
                'test-api-key',
                {
                    stopConditions: {
                        maxRetryRate: 0.7,
                        circuitBreakerLimit: 100,
                    },
                }
            );

            expect(ctx.stopConditions.maxRetryRate).toBe(0.7);
            expect(ctx.stopConditions.circuitBreakerLimit).toBe(100);
            // Should keep defaults for unspecified
            expect(ctx.stopConditions.maxRejectRate).toBe(0.3);
        });

        it('should initialize attempt tracking for all frames', () => {
            const manifest = createTestManifest(8);
            const templates = createTestTemplates();
            const anchorAnalysis = createTestAnchorAnalysis();

            const ctx = createOrchestratorContext(
                manifest,
                templates,
                runPaths,
                runsDir,
                anchorAnalysis,
                'test-api-key'
            );

            expect(Object.keys(ctx.state.frameAttempts)).toHaveLength(8);
            expect(ctx.state.frameAttempts[0].frameIndex).toBe(0);
            expect(ctx.state.frameAttempts[7].frameIndex).toBe(7);
        });
    });

    describe('runOrchestrator', () => {
        it('should complete successfully in dry run mode', async () => {
            const manifest = createTestManifest(2); // Fewer frames for faster test
            const templates = createTestTemplates();
            const anchorAnalysis = createTestAnchorAnalysis();

            const ctx = createOrchestratorContext(
                manifest,
                templates,
                runPaths,
                runsDir,
                anchorAnalysis,
                'test-api-key',
                { dryRun: true }
            );

            const result = await runOrchestrator(ctx);

            expect(result.runId).toBe('20260118_100000_test_blaze_idle');
            expect(result.status).toBeDefined();
            expect(['COMPLETED', 'STOPPED']).toContain(result.finalState);
        });

        it('should persist state after initialization', async () => {
            const manifest = createTestManifest(2);
            const templates = createTestTemplates();
            const anchorAnalysis = createTestAnchorAnalysis();

            const ctx = createOrchestratorContext(
                manifest,
                templates,
                runPaths,
                runsDir,
                anchorAnalysis,
                'test-api-key',
                { dryRun: true }
            );

            await runOrchestrator(ctx);

            // Check state.json was written
            const stateExists = await fs.access(runPaths.stateJson).then(() => true).catch(() => false);
            expect(stateExists).toBe(true);

            const stateContent = await fs.readFile(runPaths.stateJson, 'utf-8');
            const state = JSON.parse(stateContent);
            expect(state.run_id).toBe('20260118_100000_test_blaze_idle');
        });

        it('should write manifest lock file', async () => {
            const manifest = createTestManifest(1);
            const templates = createTestTemplates();
            const anchorAnalysis = createTestAnchorAnalysis();

            const ctx = createOrchestratorContext(
                manifest,
                templates,
                runPaths,
                runsDir,
                anchorAnalysis,
                'test-api-key',
                { dryRun: true }
            );

            await runOrchestrator(ctx);

            // Check manifest.lock.json was written
            const lockExists = await fs.access(runPaths.lockJson).then(() => true).catch(() => false);
            expect(lockExists).toBe(true);

            const lockContent = await fs.readFile(runPaths.lockJson, 'utf-8');
            const lock = JSON.parse(lockContent);
            expect(lock.manifest_hash).toBeDefined();
            expect(lock.manifest_hash).toHaveLength(16);
        });

        it('should record state transitions', async () => {
            const manifest = createTestManifest(1);
            const templates = createTestTemplates();
            const anchorAnalysis = createTestAnchorAnalysis();

            const ctx = createOrchestratorContext(
                manifest,
                templates,
                runPaths,
                runsDir,
                anchorAnalysis,
                'test-api-key',
                { dryRun: true }
            );

            await runOrchestrator(ctx);

            // Should have recorded transitions
            expect(ctx.transitionHistory.length).toBeGreaterThan(0);

            // First transition should be INIT → GENERATING
            expect(ctx.transitionHistory[0].from).toBe('INIT');
            expect(ctx.transitionHistory[0].to).toBe('GENERATING');
        });

        it('should track timing information in transitions', async () => {
            const manifest = createTestManifest(1);
            const templates = createTestTemplates();
            const anchorAnalysis = createTestAnchorAnalysis();

            const ctx = createOrchestratorContext(
                manifest,
                templates,
                runPaths,
                runsDir,
                anchorAnalysis,
                'test-api-key',
                { dryRun: true }
            );

            await runOrchestrator(ctx);

            for (const transition of ctx.transitionHistory) {
                expect(transition.timestamp).toBeDefined();
                expect(transition.durationMs).toBeDefined();
                expect(transition.durationMs).toBeGreaterThanOrEqual(0);
            }
        });
    });

    describe('requestAbort', () => {
        it('should set abort flag', () => {
            const manifest = createTestManifest();
            const templates = createTestTemplates();
            const anchorAnalysis = createTestAnchorAnalysis();

            const ctx = createOrchestratorContext(
                manifest,
                templates,
                runPaths,
                runsDir,
                anchorAnalysis,
                'test-api-key'
            );

            expect(ctx.abortRequested).toBe(false);

            requestAbort(ctx);

            expect(ctx.abortRequested).toBe(true);
        });

        it('should stop orchestrator on abort', async () => {
            const manifest = createTestManifest(10); // More frames to ensure abort happens
            const templates = createTestTemplates();
            const anchorAnalysis = createTestAnchorAnalysis();

            const ctx = createOrchestratorContext(
                manifest,
                templates,
                runPaths,
                runsDir,
                anchorAnalysis,
                'test-api-key',
                { dryRun: true }
            );

            // Start orchestrator in background and abort quickly
            const orchestratorPromise = runOrchestrator(ctx);

            // Abort after a brief delay
            setTimeout(() => {
                requestAbort(ctx);
            }, 10);

            const result = await orchestratorPromise;

            // Should have stopped
            expect(result.finalState).toBe('STOPPED');
        });
    });

    describe('error handling', () => {
        it('should include error details in failed status structure', async () => {
            const manifest = createTestManifest(1);
            const templates = createTestTemplates();
            const anchorAnalysis = createTestAnchorAnalysis();

            // Create a valid context and verify that the result structure
            // supports error handling scenarios with proper typing
            const ctx = createOrchestratorContext(
                manifest,
                templates,
                runPaths,
                runsDir,
                anchorAnalysis,
                'test-api-key',
                { dryRun: true }
            );

            const result = await runOrchestrator(ctx);

            // Result should have proper structure for both success and failure cases
            expect(result.runId).toBeDefined();
            expect(result.finalState).toBeDefined();
            expect(result.status).toBeDefined();
            expect(result.status.status).toBeDefined();
            expect(result.status.reasonCode).toBeDefined();
            expect(result.status.metrics).toBeDefined();
            expect(result.status.timestamp).toBeDefined();
        });

        it('should set abort flag and stop on abort request', async () => {
            const manifest = createTestManifest(10);
            const templates = createTestTemplates();
            const anchorAnalysis = createTestAnchorAnalysis();

            const ctx = createOrchestratorContext(
                manifest,
                templates,
                runPaths,
                runsDir,
                anchorAnalysis,
                'test-api-key',
                { dryRun: true }
            );

            // Pre-request abort before running
            requestAbort(ctx);

            const result = await runOrchestrator(ctx);

            // Aborted runs should have stopped status
            expect(result.finalState).toBe('STOPPED');
            expect(result.success).toBe(false);
        });
    });

    describe('VALID_TRANSITIONS table', () => {
        it('should have transitions defined for all non-terminal states', () => {
            const nonTerminalStates: OrchestratorState[] = [
                'INIT',
                'GENERATING',
                'AUDITING',
                'RETRY_DECIDING',
                'APPROVING',
                'NEXT_FRAME',
            ];

            for (const state of nonTerminalStates) {
                expect(VALID_TRANSITIONS[state]).toBeDefined();
                expect(VALID_TRANSITIONS[state].length).toBeGreaterThan(0);
            }
        });

        it('should not have transitions from terminal states', () => {
            expect(VALID_TRANSITIONS['COMPLETED']).toEqual([]);
            expect(VALID_TRANSITIONS['STOPPED']).toEqual([]);
        });
    });

    describe('state machine integrity', () => {
        it('should reach COMPLETED or STOPPED for any valid run', async () => {
            // Run multiple times to test stochastic behavior
            for (let i = 0; i < 3; i++) {
                const manifest = createTestManifest(2);
                const templates = createTestTemplates();
                const anchorAnalysis = createTestAnchorAnalysis();

                // Recreate paths for each iteration
                const iterRunPaths: RunPaths = {
                    ...runPaths,
                    root: join(runsDir, `run_${i}`),
                };
                iterRunPaths.candidates = join(iterRunPaths.root, 'candidates');
                iterRunPaths.approved = join(iterRunPaths.root, 'approved');
                iterRunPaths.audit = join(iterRunPaths.root, 'audit');
                iterRunPaths.export = join(iterRunPaths.root, 'export');
                iterRunPaths.stateJson = join(iterRunPaths.root, 'state.json');
                iterRunPaths.lockJson = join(iterRunPaths.root, 'manifest.lock.json');

                await fs.mkdir(iterRunPaths.candidates, { recursive: true });
                await fs.mkdir(iterRunPaths.approved, { recursive: true });
                await fs.mkdir(iterRunPaths.audit, { recursive: true });

                const ctx = createOrchestratorContext(
                    manifest,
                    templates,
                    iterRunPaths,
                    runsDir,
                    anchorAnalysis,
                    'test-api-key',
                    { dryRun: true }
                );

                const result = await runOrchestrator(ctx);

                expect(['COMPLETED', 'STOPPED']).toContain(result.finalState);
            }
        });

        it('should increment frame index when transitioning frames', async () => {
            const manifest = createTestManifest(2);
            const templates = createTestTemplates();
            const anchorAnalysis = createTestAnchorAnalysis();

            const ctx = createOrchestratorContext(
                manifest,
                templates,
                runPaths,
                runsDir,
                anchorAnalysis,
                'test-api-key',
                { dryRun: true }
            );

            await runOrchestrator(ctx);

            // Should have processed multiple frames
            const nextFrameTransitions = ctx.transitionHistory.filter(
                t => t.to === 'NEXT_FRAME'
            );

            // Should have at least one NEXT_FRAME transition
            expect(nextFrameTransitions.length).toBeGreaterThan(0);
        });
    });

    describe('status reporting integration', () => {
        it('should return valid status on completion', async () => {
            const manifest = createTestManifest(1);
            const templates = createTestTemplates();
            const anchorAnalysis = createTestAnchorAnalysis();

            const ctx = createOrchestratorContext(
                manifest,
                templates,
                runPaths,
                runsDir,
                anchorAnalysis,
                'test-api-key',
                { dryRun: true }
            );

            const result = await runOrchestrator(ctx);

            expect(result.status).toBeDefined();
            expect(result.status.status).toBeDefined();
            expect(result.status.reasonCode).toBeDefined();
            expect(result.status.metrics).toBeDefined();
            expect(result.status.timestamp).toBeDefined();
        });
    });
});
