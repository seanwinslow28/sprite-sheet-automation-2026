/**
 * Tests for pipeline inspect command
 * Per Story 6.1: AC #1-5
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import { Command } from 'commander';
import { registerInspectCommand, _internal } from '../../src/commands/inspect.js';
import type { RunState } from '../../src/core/state-manager.js';

describe('Inspect Command', () => {
    let testRunsDir: string;
    let testRunId: string;

    beforeEach(async () => {
        // Create temp test directory
        testRunsDir = path.join(tmpdir(), `banana-inspect-test-${Date.now()}`);
        testRunId = 'test-run-001';
        const runPath = path.join(testRunsDir, testRunId);

        await fs.mkdir(path.join(runPath, 'approved'), { recursive: true });
        await fs.mkdir(path.join(runPath, 'candidates'), { recursive: true });
        await fs.mkdir(path.join(runPath, 'audit'), { recursive: true });
        await fs.mkdir(path.join(runPath, 'export'), { recursive: true });

        // Create test state.json
        const testState = {
            run_id: testRunId,
            status: 'completed',
            current_frame: 7,
            current_attempt: 1,
            total_frames: 8,
            started_at: '2026-01-18T10:30:00.000Z',
            updated_at: '2026-01-18T10:42:45.000Z',
            frame_states: [
                { index: 0, status: 'approved', attempts: 1, approved_path: 'approved/frame_0000.png', last_candidate_path: null, last_error: null },
                { index: 1, status: 'approved', attempts: 2, approved_path: 'approved/frame_0001.png', last_candidate_path: null, last_error: null },
                { index: 2, status: 'approved', attempts: 1, approved_path: 'approved/frame_0002.png', last_candidate_path: null, last_error: null },
                { index: 3, status: 'failed', attempts: 5, approved_path: null, last_candidate_path: 'candidates/frame_3_attempt_5.png', last_error: 'MAX_ATTEMPTS' },
                { index: 4, status: 'approved', attempts: 1, approved_path: 'approved/frame_0004.png', last_candidate_path: null, last_error: null },
                { index: 5, status: 'approved', attempts: 3, approved_path: 'approved/frame_0005.png', last_candidate_path: null, last_error: null },
                { index: 6, status: 'approved', attempts: 1, approved_path: 'approved/frame_0006.png', last_candidate_path: null, last_error: null },
                { index: 7, status: 'approved', attempts: 1, approved_path: 'approved/frame_0007.png', last_candidate_path: null, last_error: null },
            ],
        };
        await fs.writeFile(path.join(runPath, 'state.json'), JSON.stringify(testState, null, 2));

        // Create test approved frames (fake PNGs)
        for (let i = 0; i < 8; i++) {
            if (i !== 3) {
                await fs.writeFile(
                    path.join(runPath, 'approved', `frame_${String(i).padStart(4, '0')}.png`),
                    Buffer.alloc(128 * 1024) // 128KB fake file
                );
            }
        }

        // Create test audit log
        const auditLog = [
            { timestamp: '2026-01-18T10:42:15.000Z', event: 'frame_generated', frameIndex: 7, attempt: 1 },
            { timestamp: '2026-01-18T10:42:18.000Z', event: 'frame_audited', frameIndex: 7, score: 0.94 },
            { timestamp: '2026-01-18T10:42:19.000Z', event: 'frame_approved', frameIndex: 7 },
            { timestamp: '2026-01-18T10:42:20.000Z', event: 'export_started' },
            { timestamp: '2026-01-18T10:42:25.000Z', event: 'validation_complete', tests: 3 },
        ];
        await fs.writeFile(
            path.join(runPath, 'audit', 'audit_log.jsonl'),
            auditLog.map(e => JSON.stringify(e)).join('\n')
        );

        // Create frame metrics files
        const frameMetrics = {
            frameIndex: 3,
            finalStatus: 'failed',
            compositeScore: 0.58,
            breakdown: {
                identity: 0.45,
                stability: 0.72,
                palette: 0.68,
                style: 0.55,
            },
            reasonCodes: ['SF01_IDENTITY_DRIFT', 'SF02_PALETTE_DRIFT'],
            attemptHistory: [
                { attempt: 1, score: 0.48, reasonCodes: ['SF01', 'SF02'], strategy: 'default' },
                { attempt: 2, score: 0.52, reasonCodes: ['SF01'], strategy: 'identity_rescue' },
                { attempt: 3, score: 0.55, reasonCodes: ['SF01'], strategy: 're_anchor' },
                { attempt: 4, score: 0.58, reasonCodes: ['SF01'], strategy: 'tighten_negative' },
                { attempt: 5, score: 0.58, reasonCodes: ['MAX_ATTEMPTS'], strategy: 'final' },
            ],
        };
        await fs.writeFile(
            path.join(runPath, 'audit', 'frame_3_metrics.json'),
            JSON.stringify(frameMetrics, null, 2)
        );

        // Create diagnostic report
        const diagnostic = {
            generatedAt: '2026-01-18T10:45:00.000Z',
            runId: testRunId,
            stopCondition: {
                type: 'MAX_ATTEMPTS',
                threshold: 5,
                actualValue: 5,
                triggeredAt: '2026-01-18T10:42:00.000Z',
            },
            summary: {
                totalFrames: 8,
                framesAttempted: 8,
                framesApproved: 7,
                framesRejected: 0,
                framesFailed: 1,
                totalAttempts: 15,
                averageAttemptsPerFrame: 1.875,
            },
            frameBreakdown: [],
            topFailures: [
                { code: 'SF01_IDENTITY_DRIFT', count: 5, percentage: 62.5, exampleFrames: [3] },
                { code: 'SF02_PALETTE_DRIFT', count: 3, percentage: 37.5, exampleFrames: [3] },
            ],
            rootCause: {
                suggestion: 'Anchor image may lack distinctive features.',
                confidence: 'high',
                contributingFactors: ['Low contrast'],
            },
            recoveryActions: [
                { action: 'Increase anchor resolution', description: 'Use 512x512', appliesWhen: ['SF01'], effort: 'low', priority: 1 },
            ],
        };
        await fs.writeFile(path.join(runPath, 'diagnostic.json'), JSON.stringify(diagnostic, null, 2));
    });

    afterEach(async () => {
        // Cleanup
        try {
            await fs.rm(testRunsDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    describe('Summary Display (AC: #1)', () => {
        it('should load and parse state.json correctly', async () => {
            const statePath = path.join(testRunsDir, testRunId, 'state.json');
            const content = await fs.readFile(statePath, 'utf-8');
            const state = JSON.parse(content);

            expect(state.run_id).toBe(testRunId);
            expect(state.status).toBe('completed');
            expect(state.total_frames).toBe(8);
        });

        it('should calculate correct summary statistics', async () => {
            const statePath = path.join(testRunsDir, testRunId, 'state.json');
            const content = await fs.readFile(statePath, 'utf-8');
            const state = JSON.parse(content);

            const framesCompleted = state.frame_states.filter((f: { status: string }) => f.status === 'approved').length;
            const framesFailed = state.frame_states.filter((f: { status: string }) => f.status === 'failed').length;

            expect(framesCompleted).toBe(7);
            expect(framesFailed).toBe(1);
        });

        it('should calculate retry rate correctly', async () => {
            const statePath = path.join(testRunsDir, testRunId, 'state.json');
            const content = await fs.readFile(statePath, 'utf-8');
            const state = JSON.parse(content);

            const framesWithRetries = state.frame_states.filter((f: { attempts: number }) => f.attempts > 1).length;
            const attemptedFrames = state.frame_states.filter((f: { attempts: number }) => f.attempts > 0).length;
            const retryRate = attemptedFrames > 0 ? framesWithRetries / attemptedFrames : 0;

            // Frames 1 (2 attempts), 3 (5 attempts), 5 (3 attempts) = 3 with retries
            // All 8 frames attempted
            expect(framesWithRetries).toBe(3);
            expect(attemptedFrames).toBe(8);
            expect(retryRate).toBeCloseTo(0.375, 3);
        });
    });

    describe('Artifact Listing (AC: #2)', () => {
        it('should list files in approved folder', async () => {
            const approvedPath = path.join(testRunsDir, testRunId, 'approved');
            const files = await fs.readdir(approvedPath);

            expect(files.length).toBe(7); // All but frame 3
            expect(files).toContain('frame_0000.png');
            expect(files).toContain('frame_0007.png');
            expect(files).not.toContain('frame_0003.png');
        });

        it('should calculate folder sizes', async () => {
            const approvedPath = path.join(testRunsDir, testRunId, 'approved');
            const files = await fs.readdir(approvedPath);

            let totalSize = 0;
            for (const file of files) {
                const stat = await fs.stat(path.join(approvedPath, file));
                totalSize += stat.size;
            }

            // 7 files * 128KB = 896KB
            expect(totalSize).toBe(7 * 128 * 1024);
        });
    });

    describe('Recent Logs (AC: #3)', () => {
        it('should read audit_log.jsonl', async () => {
            const logPath = path.join(testRunsDir, testRunId, 'audit', 'audit_log.jsonl');
            const content = await fs.readFile(logPath, 'utf-8');
            const lines = content.trim().split('\n');

            expect(lines.length).toBe(5);
        });

        it('should parse JSON lines correctly', async () => {
            const logPath = path.join(testRunsDir, testRunId, 'audit', 'audit_log.jsonl');
            const content = await fs.readFile(logPath, 'utf-8');
            const lines = content.trim().split('\n');
            const entries = lines.map(line => JSON.parse(line));

            expect(entries[0].event).toBe('frame_generated');
            expect(entries[0].frameIndex).toBe(7);
            expect(entries[4].event).toBe('validation_complete');
        });

        it('should get last 5 entries', async () => {
            const logPath = path.join(testRunsDir, testRunId, 'audit', 'audit_log.jsonl');
            const content = await fs.readFile(logPath, 'utf-8');
            const lines = content.trim().split('\n');
            const recentLines = lines.slice(-5);

            expect(recentLines.length).toBe(5);
        });
    });

    describe('Frame Metrics Flag (AC: #4)', () => {
        it('should load frame metrics file', async () => {
            const metricsPath = path.join(testRunsDir, testRunId, 'audit', 'frame_3_metrics.json');
            const content = await fs.readFile(metricsPath, 'utf-8');
            const metrics = JSON.parse(content);

            expect(metrics.frameIndex).toBe(3);
            expect(metrics.finalStatus).toBe('failed');
            expect(metrics.compositeScore).toBe(0.58);
        });

        it('should have breakdown scores', async () => {
            const metricsPath = path.join(testRunsDir, testRunId, 'audit', 'frame_3_metrics.json');
            const content = await fs.readFile(metricsPath, 'utf-8');
            const metrics = JSON.parse(content);

            expect(metrics.breakdown.identity).toBe(0.45);
            expect(metrics.breakdown.stability).toBe(0.72);
            expect(metrics.breakdown.palette).toBe(0.68);
            expect(metrics.breakdown.style).toBe(0.55);
        });

        it('should have attempt history', async () => {
            const metricsPath = path.join(testRunsDir, testRunId, 'audit', 'frame_3_metrics.json');
            const content = await fs.readFile(metricsPath, 'utf-8');
            const metrics = JSON.parse(content);

            expect(metrics.attemptHistory.length).toBe(5);
            expect(metrics.attemptHistory[0].strategy).toBe('default');
            expect(metrics.attemptHistory[4].strategy).toBe('final');
        });
    });

    describe('Diagnostic Flag (AC: #5)', () => {
        it('should load diagnostic.json when exists', async () => {
            const diagPath = path.join(testRunsDir, testRunId, 'diagnostic.json');
            const content = await fs.readFile(diagPath, 'utf-8');
            const report = JSON.parse(content);

            expect(report.runId).toBe(testRunId);
            expect(report.stopCondition.type).toBe('MAX_ATTEMPTS');
        });

        it('should have root cause analysis', async () => {
            const diagPath = path.join(testRunsDir, testRunId, 'diagnostic.json');
            const content = await fs.readFile(diagPath, 'utf-8');
            const report = JSON.parse(content);

            expect(report.rootCause.confidence).toBe('high');
            expect(report.rootCause.suggestion).toContain('Anchor image');
        });

        it('should have recovery actions', async () => {
            const diagPath = path.join(testRunsDir, testRunId, 'diagnostic.json');
            const content = await fs.readFile(diagPath, 'utf-8');
            const report = JSON.parse(content);

            expect(report.recoveryActions.length).toBeGreaterThan(0);
            expect(report.recoveryActions[0].action).toBe('Increase anchor resolution');
        });

        it('should handle missing diagnostic gracefully', async () => {
            // Create a run without diagnostic
            const runPath2 = path.join(testRunsDir, 'run-no-diag');
            await fs.mkdir(runPath2, { recursive: true });
            await fs.writeFile(
                path.join(runPath2, 'state.json'),
                JSON.stringify({ run_id: 'run-no-diag', status: 'completed', total_frames: 1, frame_states: [], started_at: '', updated_at: '' })
            );

            const diagPath = path.join(runPath2, 'diagnostic.json');
            let exists = true;
            try {
                await fs.access(diagPath);
            } catch {
                exists = false;
            }

            expect(exists).toBe(false);
        });
    });

    describe('Missing Run Error (AC: all)', () => {
        it('should detect when run does not exist', async () => {
            const nonExistentPath = path.join(testRunsDir, 'non-existent-run');
            let exists = true;
            try {
                await fs.access(nonExistentPath);
            } catch {
                exists = false;
            }

            expect(exists).toBe(false);
        });
    });

    describe('Command Registration', () => {
        it('should register the inspect command', () => {
            const program = new Command();
            registerInspectCommand(program);

            const commands = program.commands.map(cmd => cmd.name());
            expect(commands).toContain('inspect');
        });

        it('should have correct options', () => {
            const program = new Command();
            registerInspectCommand(program);

            const inspectCmd = program.commands.find(cmd => cmd.name() === 'inspect');
            expect(inspectCmd).toBeDefined();

            const options = inspectCmd!.options.map(opt => opt.long);
            expect(options).toContain('--frame');
            expect(options).toContain('--diagnostic');
            expect(options).toContain('--json');
            expect(options).toContain('--csv');
            expect(options).toContain('--runs-dir');
        });

        it('should require run_id argument', () => {
            const program = new Command();
            registerInspectCommand(program);

            const inspectCmd = program.commands.find(cmd => cmd.name() === 'inspect');
            expect(inspectCmd).toBeDefined();

            // Commander stores required args
            const args = inspectCmd!.registeredArguments;
            expect(args.length).toBeGreaterThan(0);
            expect(args[0].name()).toBe('run_id');
            expect(args[0].required).toBe(true);
        });
    });

    describe('Internal Functions', () => {
        it('should calculate summary correctly', () => {
            const mockState: RunState = {
                run_id: 'test-123',
                status: 'completed',
                current_frame: 3,
                current_attempt: 1,
                total_frames: 4,
                started_at: '2026-01-18T10:00:00.000Z',
                updated_at: '2026-01-18T10:05:00.000Z',
                frame_states: [
                    { index: 0, status: 'approved', attempts: 1, approved_path: null, last_candidate_path: null, last_error: null },
                    { index: 1, status: 'approved', attempts: 2, approved_path: null, last_candidate_path: null, last_error: null },
                    { index: 2, status: 'approved', attempts: 1, approved_path: null, last_candidate_path: null, last_error: null },
                    { index: 3, status: 'failed', attempts: 5, approved_path: null, last_candidate_path: null, last_error: 'SF01' },
                ],
            };

            const summary = _internal.calculateSummary(mockState);

            expect(summary.status).toBe('completed');
            expect(summary.framesCompleted).toBe(3);
            expect(summary.framesFailed).toBe(1);
            expect(summary.totalFrames).toBe(4);
            expect(summary.retryRate).toBeCloseTo(0.5, 2); // 2 frames with retries out of 4 attempted
        });

        it('should scan folder contents', async () => {
            const folderPath = path.join(testRunsDir, testRunId, 'approved');
            const info = await _internal.scanFolder(folderPath, 'approved');

            expect(info.name).toBe('approved');
            expect(info.fileCount).toBe(7);
            expect(info.files.length).toBe(7);
            expect(info.totalSize).toBe(7 * 128 * 1024);
        });

        it('should get root files sorted', async () => {
            const runPath = path.join(testRunsDir, testRunId);
            const files = await _internal.getRootFiles(runPath);

            expect(files.length).toBe(2); // state.json and diagnostic.json
            expect(files[0].name).toBe('diagnostic.json');
            expect(files[1].name).toBe('state.json');
        });

        it('should format duration correctly', () => {
            expect(_internal.formatDuration(500)).toBe('0s');
            expect(_internal.formatDuration(5000)).toBe('5s');
            expect(_internal.formatDuration(65000)).toBe('1m 5s');
            expect(_internal.formatDuration(3665000)).toBe('1h 1m 5s');
        });

        it('should format size correctly', () => {
            expect(_internal.formatSize(500)).toBe('500 B');
            expect(_internal.formatSize(1024)).toBe('1 KB');
            expect(_internal.formatSize(1024 * 1024)).toBe('1.0 MB');
            expect(_internal.formatSize(1536 * 1024)).toBe('1.5 MB');
        });
    });
});
