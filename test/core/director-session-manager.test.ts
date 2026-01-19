/**
 * Tests for Director Session Manager (Story 7.1)
 * AC #1-6: Session creation, state tracking, persistence, and lifecycle
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import {
    DirectorSessionManager,
    createDirectorSessionManager,
} from '../../src/core/director-session-manager.js';
import {
    DirectorSessionSchema,
    type DirectorSession,
    type FrameStatus,
} from '../../src/domain/types/director-session.js';

describe('DirectorSessionManager (Story 7.1)', () => {
    let tempDir: string;
    let manager: DirectorSessionManager;

    beforeEach(async () => {
        // Create temp directory for test runs
        tempDir = path.join(os.tmpdir(), `banana-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
        await fs.mkdir(tempDir, { recursive: true });
        manager = createDirectorSessionManager('test-run-123', tempDir);
    });

    afterEach(async () => {
        // Clean up temp directory
        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    describe('Session creation (AC #1)', () => {
        it('should create session with unique sessionId', async () => {
            const result = await manager.createSession({
                moveId: 'idle_standard',
                totalFrames: 8,
            });

            expect(result.isOk()).toBe(true);
            const session = result.unwrap();
            expect(session.sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
        });

        it('should create session with correct runId and moveId', async () => {
            const result = await manager.createSession({
                moveId: 'attack_punch',
                totalFrames: 4,
            });

            const session = result.unwrap();
            expect(session.runId).toBe('test-run-123');
            expect(session.moveId).toBe('attack_punch');
        });

        it('should create session with anchorFrameId set to frame_0000', async () => {
            const result = await manager.createSession({
                moveId: 'idle',
                totalFrames: 8,
            });

            const session = result.unwrap();
            expect(session.anchorFrameId).toBe('frame_0000');
        });

        it('should initialize all frames with PENDING status', async () => {
            const result = await manager.createSession({
                moveId: 'walk',
                totalFrames: 6,
            });

            const session = result.unwrap();
            expect(Object.keys(session.frames)).toHaveLength(6);

            for (let i = 0; i < 6; i++) {
                const frame = session.frames[String(i)];
                expect(frame.status).toBe('PENDING');
                expect(frame.frameIndex).toBe(i);
                expect(frame.id).toBe(`frame_${String(i).padStart(4, '0')}`);
            }
        });

        it('should mark pre-approved frames correctly', async () => {
            const approvedPaths = new Map<number, string>();
            approvedPaths.set(0, '/approved/frame_0000.png');
            approvedPaths.set(2, '/approved/frame_0002.png');

            const result = await manager.createSession({
                moveId: 'idle',
                totalFrames: 4,
                approvedFramePaths: approvedPaths,
            });

            const session = result.unwrap();
            expect(session.frames['0'].status).toBe('APPROVED');
            expect(session.frames['1'].status).toBe('PENDING');
            expect(session.frames['2'].status).toBe('APPROVED');
            expect(session.frames['3'].status).toBe('PENDING');
        });

        it('should set status to active on creation', async () => {
            const result = await manager.createSession({
                moveId: 'idle',
                totalFrames: 4,
            });

            const session = result.unwrap();
            expect(session.status).toBe('active');
        });

        it('should set timestamps on creation', async () => {
            const beforeCreate = new Date().toISOString();
            const result = await manager.createSession({
                moveId: 'idle',
                totalFrames: 4,
            });
            const afterCreate = new Date().toISOString();

            const session = result.unwrap();
            expect(session.createdAt).toBeTruthy();
            expect(session.lastModified).toBeTruthy();
            expect(session.createdAt >= beforeCreate).toBe(true);
            expect(session.createdAt <= afterCreate).toBe(true);
        });
    });

    describe('Frame state tracking (AC #2)', () => {
        beforeEach(async () => {
            await manager.createSession({
                moveId: 'idle',
                totalFrames: 4,
            });
        });

        it('should retrieve frame state by index', () => {
            const result = manager.getFrameState(0);
            expect(result.isOk()).toBe(true);
            const frame = result.unwrap();
            expect(frame.id).toBe('frame_0000');
            expect(frame.frameIndex).toBe(0);
        });

        it('should return error for non-existent frame', () => {
            const result = manager.getFrameState(99);
            expect(result.isErr()).toBe(true);
            expect(result.unwrapErr().code).toBe('FRAME_NOT_FOUND');
        });

        it('should track directorOverrides', async () => {
            await manager.updateFrameOverrides(1, {
                notes: 'Needs manual review',
            });

            const frame = manager.getFrameState(1).unwrap();
            expect(frame.directorOverrides.notes).toBe('Needs manual review');
        });

        it('should track alignment delta', async () => {
            await manager.setAlignmentDelta(1, {
                userOverrideX: -5,
                userOverrideY: 3,
            });

            const frame = manager.getFrameState(1).unwrap();
            expect(frame.directorOverrides.alignment).toBeDefined();
            expect(frame.directorOverrides.alignment?.userOverrideX).toBe(-5);
            expect(frame.directorOverrides.alignment?.userOverrideY).toBe(3);
        });
    });

    describe('Status transitions (AC #3)', () => {
        beforeEach(async () => {
            await manager.createSession({
                moveId: 'idle',
                totalFrames: 4,
            });
        });

        it('should allow PENDING -> GENERATED', async () => {
            const result = await manager.updateFrameStatus(0, 'GENERATED');
            expect(result.isOk()).toBe(true);
            expect(manager.getFrameState(0).unwrap().status).toBe('GENERATED');
        });

        it('should allow GENERATED -> AUDIT_FAIL', async () => {
            await manager.updateFrameStatus(0, 'GENERATED');
            const result = await manager.updateFrameStatus(0, 'AUDIT_FAIL');
            expect(result.isOk()).toBe(true);
        });

        it('should allow GENERATED -> AUDIT_WARN', async () => {
            await manager.updateFrameStatus(0, 'GENERATED');
            const result = await manager.updateFrameStatus(0, 'AUDIT_WARN');
            expect(result.isOk()).toBe(true);
        });

        it('should allow GENERATED -> APPROVED', async () => {
            await manager.updateFrameStatus(0, 'GENERATED');
            const result = await manager.updateFrameStatus(0, 'APPROVED');
            expect(result.isOk()).toBe(true);
        });

        it('should allow AUDIT_FAIL -> APPROVED (human override)', async () => {
            await manager.updateFrameStatus(0, 'GENERATED');
            await manager.updateFrameStatus(0, 'AUDIT_FAIL');
            const result = await manager.updateFrameStatus(0, 'APPROVED');
            expect(result.isOk()).toBe(true);
        });

        it('should allow AUDIT_WARN -> APPROVED (human review)', async () => {
            await manager.updateFrameStatus(0, 'GENERATED');
            await manager.updateFrameStatus(0, 'AUDIT_WARN');
            const result = await manager.updateFrameStatus(0, 'APPROVED');
            expect(result.isOk()).toBe(true);
        });

        it('should reject PENDING -> APPROVED (invalid skip)', async () => {
            const result = await manager.updateFrameStatus(0, 'APPROVED');
            expect(result.isErr()).toBe(true);
            expect(result.unwrapErr().code).toBe('INVALID_TRANSITION');
        });

        it('should reject APPROVED -> any (terminal)', async () => {
            await manager.updateFrameStatus(0, 'GENERATED');
            await manager.updateFrameStatus(0, 'APPROVED');

            const result = await manager.updateFrameStatus(0, 'PENDING');
            expect(result.isErr()).toBe(true);
            expect(result.unwrapErr().code).toBe('INVALID_TRANSITION');
        });
    });

    describe('Session persistence (AC #4, #5, #6)', () => {
        it('should persist session to director_session.json', async () => {
            await manager.createSession({
                moveId: 'idle',
                totalFrames: 4,
            });

            const sessionPath = manager.getSessionPath();
            const exists = await fs.access(sessionPath).then(() => true).catch(() => false);
            expect(exists).toBe(true);
        });

        it('should write valid JSON that passes schema validation', async () => {
            await manager.createSession({
                moveId: 'idle',
                totalFrames: 4,
            });

            const content = await fs.readFile(manager.getSessionPath(), 'utf-8');
            const json = JSON.parse(content);
            const result = DirectorSessionSchema.safeParse(json);
            expect(result.success).toBe(true);
        });

        it('should persist updates atomically', async () => {
            await manager.createSession({
                moveId: 'idle',
                totalFrames: 4,
            });

            await manager.updateFrameStatus(0, 'GENERATED');
            await manager.updateFrameOverrides(0, { notes: 'Test note' });

            // Reload and verify
            const content = await fs.readFile(manager.getSessionPath(), 'utf-8');
            const session = JSON.parse(content) as DirectorSession;
            expect(session.frames['0'].status).toBe('GENERATED');
            expect(session.frames['0'].directorOverrides.notes).toBe('Test note');
        });

        it('should survive reload (browser refresh simulation)', async () => {
            await manager.createSession({
                moveId: 'walk',
                totalFrames: 6,
            });

            await manager.updateFrameStatus(0, 'GENERATED');
            await manager.updateFrameStatus(0, 'APPROVED');
            await manager.updateFrameStatus(1, 'GENERATED');
            await manager.setAlignmentDelta(1, { userOverrideX: -3, userOverrideY: 0 });

            // Create new manager (simulate page refresh)
            const newManager = createDirectorSessionManager('test-run-123', tempDir);
            const result = await newManager.loadSession();
            expect(result.isOk()).toBe(true);

            const session = result.unwrap();
            expect(session.frames['0'].status).toBe('APPROVED');
            expect(session.frames['1'].status).toBe('GENERATED');
            expect(session.frames['1'].directorOverrides.alignment?.userOverrideX).toBe(-3);
        });

        it('should update lastModified on each save', async () => {
            await manager.createSession({
                moveId: 'idle',
                totalFrames: 4,
            });

            const initial = manager.getSession()!.lastModified;

            // Wait a bit and update
            await new Promise(resolve => setTimeout(resolve, 10));
            await manager.updateFrameStatus(0, 'GENERATED');

            const updated = manager.getSession()!.lastModified;
            expect(updated > initial).toBe(true);
        });
    });

    describe('Session loading (AC #5)', () => {
        it('should load existing session', async () => {
            await manager.createSession({
                moveId: 'idle',
                totalFrames: 4,
            });
            const sessionId = manager.getSession()!.sessionId;

            // Create new manager and load
            const newManager = createDirectorSessionManager('test-run-123', tempDir);
            const result = await newManager.loadSession();

            expect(result.isOk()).toBe(true);
            expect(result.unwrap().sessionId).toBe(sessionId);
        });

        it('should return error for missing session', async () => {
            const result = await manager.loadSession();
            expect(result.isErr()).toBe(true);
            expect(result.unwrapErr().code).toBe('SESSION_NOT_FOUND');
        });

        it('should return error for corrupted session', async () => {
            // Write invalid JSON
            await fs.writeFile(manager.getSessionPath(), '{ invalid json');

            const result = await manager.loadSession();
            expect(result.isErr()).toBe(true);
            expect(result.unwrapErr().code).toBe('SESSION_LOAD_FAILED');
        });

        it('should return error for schema-invalid session', async () => {
            // Write valid JSON but invalid schema
            await fs.writeFile(manager.getSessionPath(), JSON.stringify({
                sessionId: 'not-a-uuid',
                frames: {},
            }));

            const result = await manager.loadSession();
            expect(result.isErr()).toBe(true);
            expect(result.unwrapErr().code).toBe('SESSION_CORRUPTED');
        });
    });

    describe('Session lifecycle (AC #1-6)', () => {
        it('should resume existing session via initializeOrResume', async () => {
            await manager.createSession({
                moveId: 'idle',
                totalFrames: 4,
            });
            const originalId = manager.getSession()!.sessionId;

            const newManager = createDirectorSessionManager('test-run-123', tempDir);
            const result = await newManager.initializeOrResume({
                moveId: 'idle',
                totalFrames: 4,
            });

            expect(result.isOk()).toBe(true);
            expect(result.unwrap().sessionId).toBe(originalId);
        });

        it('should create new session via initializeOrResume when none exists', async () => {
            const result = await manager.initializeOrResume({
                moveId: 'walk',
                totalFrames: 6,
            });

            expect(result.isOk()).toBe(true);
            expect(result.unwrap().moveId).toBe('walk');
        });

        it('should commit session', async () => {
            await manager.createSession({
                moveId: 'idle',
                totalFrames: 4,
            });

            const result = await manager.commitSession();
            expect(result.isOk()).toBe(true);
            expect(manager.getSession()!.status).toBe('committed');
        });

        it('should discard session', async () => {
            await manager.createSession({
                moveId: 'idle',
                totalFrames: 4,
            });

            const result = await manager.discardSession();
            expect(result.isOk()).toBe(true);
            expect(manager.getSession()!.status).toBe('discarded');
        });

        it('should return error when committing without session', async () => {
            const result = await manager.commitSession();
            expect(result.isErr()).toBe(true);
            expect(result.unwrapErr().code).toBe('NO_ACTIVE_SESSION');
        });
    });

    describe('Helper methods', () => {
        beforeEach(async () => {
            await manager.createSession({
                moveId: 'idle',
                totalFrames: 4,
            });
        });

        it('should count frames by status', async () => {
            await manager.updateFrameStatus(0, 'GENERATED');
            await manager.updateFrameStatus(0, 'APPROVED');
            await manager.updateFrameStatus(1, 'GENERATED');
            await manager.updateFrameStatus(1, 'AUDIT_FAIL');

            const counts = manager.getStatusCounts();
            expect(counts.APPROVED).toBe(1);
            expect(counts.AUDIT_FAIL).toBe(1);
            expect(counts.PENDING).toBe(2);
        });

        it('should report incomplete session', () => {
            expect(manager.isComplete()).toBe(false);
        });

        it('should report complete session when all approved', async () => {
            for (let i = 0; i < 4; i++) {
                await manager.updateFrameStatus(i, 'GENERATED');
                await manager.updateFrameStatus(i, 'APPROVED');
            }
            expect(manager.isComplete()).toBe(true);
        });

        it('should return frames needing attention', async () => {
            await manager.updateFrameStatus(0, 'GENERATED');
            await manager.updateFrameStatus(0, 'APPROVED');
            await manager.updateFrameStatus(1, 'GENERATED');
            await manager.updateFrameStatus(1, 'AUDIT_WARN');

            const needsAttention = manager.getFramesNeedingAttention();
            expect(needsAttention).toHaveLength(3); // frame 1, 2, 3
            expect(needsAttention[0].frameIndex).toBe(1);
            expect(needsAttention[0].status).toBe('AUDIT_WARN');
        });

        it('should check for existing session', async () => {
            expect(await manager.hasExistingSession()).toBe(true);

            const newManager = createDirectorSessionManager('other-run', tempDir);
            expect(await newManager.hasExistingSession()).toBe(true); // Same tempDir
        });
    });

    describe('Audit report updates', () => {
        beforeEach(async () => {
            await manager.createSession({
                moveId: 'idle',
                totalFrames: 4,
            });
        });

        it('should update frame audit report', async () => {
            const result = await manager.updateFrameAuditReport(0, {
                compositeScore: 0.85,
                flags: ['SF01_IDENTITY_DRIFT'],
                passed: false,
                autoAligned: true,
                driftPixels: 4,
            });

            expect(result.isOk()).toBe(true);
            const frame = manager.getFrameState(0).unwrap();
            expect(frame.auditReport.compositeScore).toBe(0.85);
            expect(frame.auditReport.flags).toContain('SF01_IDENTITY_DRIFT');
            expect(frame.auditReport.autoAligned).toBe(true);
        });
    });
});
