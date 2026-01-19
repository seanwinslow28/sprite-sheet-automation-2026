/**
 * Director Session Manager - manages session lifecycle in Director Mode
 * Per Story 7.1: Tracks frame lifecycle with persistence and resume
 */

import { promises as fs } from 'fs';
import { randomUUID } from 'crypto';
import path from 'path';
import { writeJsonAtomic, pathExists } from '../utils/fs-helpers.js';
import { Result, SystemError } from './result.js';
import { logger } from '../utils/logger.js';
import {
    DirectorSession,
    DirectorSessionSchema,
    DirectorFrameState,
    DirectorOverrides,
    FrameStatus,
    AuditReport,
    HumanAlignmentDelta,
    isValidStatusTransition,
    createInitialFrameState,
} from '../domain/types/director-session.js';

/**
 * Session manager error types
 */
export interface SessionError extends SystemError {
    code: 'SESSION_NOT_FOUND' | 'SESSION_CORRUPTED' | 'SESSION_SAVE_FAILED' |
          'SESSION_LOAD_FAILED' | 'INVALID_TRANSITION' | 'FRAME_NOT_FOUND' |
          'NO_ACTIVE_SESSION';
}

/**
 * Options for creating a new session
 */
export interface CreateSessionOptions {
    runId: string;
    runPath: string;
    moveId: string;
    totalFrames: number;
    approvedFramePaths?: Map<number, string>;  // Pre-approved frames from run
}

/**
 * Director Session Manager class
 * Manages session state with atomic persistence
 */
export class DirectorSessionManager {
    private session: DirectorSession | null = null;
    private readonly sessionPath: string;

    constructor(
        private readonly runId: string,
        private readonly runPath: string
    ) {
        this.sessionPath = path.join(runPath, 'director_session.json');
    }

    /**
     * Get the current session (if any)
     */
    getSession(): DirectorSession | null {
        return this.session;
    }

    /**
     * Get the session file path
     */
    getSessionPath(): string {
        return this.sessionPath;
    }

    /**
     * Check if a session file exists
     */
    async hasExistingSession(): Promise<boolean> {
        return pathExists(this.sessionPath);
    }

    /**
     * Initialize a new session or resume an existing one
     */
    async initializeOrResume(
        options: Omit<CreateSessionOptions, 'runId' | 'runPath'>
    ): Promise<Result<DirectorSession, SessionError>> {
        if (await this.hasExistingSession()) {
            logger.info({ runId: this.runId }, 'Resuming existing session');
            return this.loadSession();
        }

        logger.info({ runId: this.runId }, 'Creating new session');
        return this.createSession(options);
    }

    /**
     * Create a new session
     */
    async createSession(
        options: Omit<CreateSessionOptions, 'runId' | 'runPath'>
    ): Promise<Result<DirectorSession, SessionError>> {
        const now = new Date().toISOString();

        // Initialize frames
        const frames: Record<string, DirectorFrameState> = {};
        for (let i = 0; i < options.totalFrames; i++) {
            const imagePath = options.approvedFramePaths?.get(i) ||
                path.join(this.runPath, 'candidates', `frame_${String(i).padStart(4, '0')}.png`);

            const frameState = createInitialFrameState(i, imagePath);

            // If frame was pre-approved, mark it
            if (options.approvedFramePaths?.has(i)) {
                frameState.status = 'APPROVED';
                frameState.auditReport = {
                    compositeScore: 1.0,
                    flags: [],
                    passed: true,
                };
            }

            frames[String(i)] = frameState;
        }

        const session: DirectorSession = {
            sessionId: randomUUID(),
            runId: this.runId,
            moveId: options.moveId,
            anchorFrameId: 'frame_0000',
            frames,
            createdAt: now,
            lastModified: now,
            status: 'active',
        };

        const saveResult = await this.saveSession(session);
        if (saveResult.isErr()) {
            return Result.err(saveResult.unwrapErr());
        }

        this.session = session;
        logger.info({ sessionId: session.sessionId, frames: options.totalFrames }, 'Session created');

        return Result.ok(session);
    }

    /**
     * Load an existing session from disk
     */
    async loadSession(): Promise<Result<DirectorSession, SessionError>> {
        try {
            const exists = await pathExists(this.sessionPath);
            if (!exists) {
                return Result.err({
                    code: 'SESSION_NOT_FOUND',
                    message: `No session file found at ${this.sessionPath}`,
                });
            }

            const content = await fs.readFile(this.sessionPath, 'utf-8');
            const json = JSON.parse(content);

            // Validate against schema
            const parseResult = DirectorSessionSchema.safeParse(json);
            if (!parseResult.success) {
                logger.error({ error: parseResult.error }, 'Session validation failed');
                return Result.err({
                    code: 'SESSION_CORRUPTED',
                    message: `Session file is corrupted: ${parseResult.error.message}`,
                    context: { path: this.sessionPath },
                });
            }

            this.session = parseResult.data;
            logger.info({ sessionId: this.session.sessionId }, 'Session loaded');

            return Result.ok(this.session);
        } catch (error) {
            logger.error({ error }, 'Failed to load session');
            return Result.err({
                code: 'SESSION_LOAD_FAILED',
                message: `Failed to load session: ${error instanceof Error ? error.message : String(error)}`,
                context: { path: this.sessionPath },
            });
        }
    }

    /**
     * Save the current session to disk atomically
     */
    private async saveSession(session: DirectorSession): Promise<Result<void, SessionError>> {
        try {
            session.lastModified = new Date().toISOString();
            await writeJsonAtomic(this.sessionPath, session);
            logger.debug({ sessionId: session.sessionId }, 'Session saved');
            return Result.ok(undefined);
        } catch (error) {
            logger.error({ error }, 'Failed to save session');
            return Result.err({
                code: 'SESSION_SAVE_FAILED',
                message: `Failed to save session: ${error instanceof Error ? error.message : String(error)}`,
                context: { path: this.sessionPath },
            });
        }
    }

    /**
     * Get a frame's current state
     */
    getFrameState(frameIndex: number): Result<DirectorFrameState, SessionError> {
        if (!this.session) {
            return Result.err({
                code: 'NO_ACTIVE_SESSION',
                message: 'No active session',
            });
        }

        const frame = this.session.frames[String(frameIndex)];
        if (!frame) {
            return Result.err({
                code: 'FRAME_NOT_FOUND',
                message: `Frame ${frameIndex} not found in session`,
            });
        }

        return Result.ok(frame);
    }

    /**
     * Update a frame's status with transition validation
     */
    async updateFrameStatus(
        frameIndex: number,
        newStatus: FrameStatus
    ): Promise<Result<void, SessionError>> {
        if (!this.session) {
            return Result.err({
                code: 'NO_ACTIVE_SESSION',
                message: 'No active session',
            });
        }

        const frame = this.session.frames[String(frameIndex)];
        if (!frame) {
            return Result.err({
                code: 'FRAME_NOT_FOUND',
                message: `Frame ${frameIndex} not found in session`,
            });
        }

        // Validate transition
        if (!isValidStatusTransition(frame.status, newStatus)) {
            return Result.err({
                code: 'INVALID_TRANSITION',
                message: `Invalid status transition from ${frame.status} to ${newStatus}`,
                context: { frameIndex, from: frame.status, to: newStatus },
            });
        }

        frame.status = newStatus;
        return this.saveSession(this.session);
    }

    /**
     * Update a frame's audit report
     */
    async updateFrameAuditReport(
        frameIndex: number,
        auditReport: AuditReport
    ): Promise<Result<void, SessionError>> {
        if (!this.session) {
            return Result.err({
                code: 'NO_ACTIVE_SESSION',
                message: 'No active session',
            });
        }

        const frame = this.session.frames[String(frameIndex)];
        if (!frame) {
            return Result.err({
                code: 'FRAME_NOT_FOUND',
                message: `Frame ${frameIndex} not found in session`,
            });
        }

        frame.auditReport = auditReport;
        return this.saveSession(this.session);
    }

    /**
     * Update a frame's overrides
     */
    async updateFrameOverrides(
        frameIndex: number,
        overrides: Partial<DirectorOverrides>
    ): Promise<Result<void, SessionError>> {
        if (!this.session) {
            return Result.err({
                code: 'NO_ACTIVE_SESSION',
                message: 'No active session',
            });
        }

        const frame = this.session.frames[String(frameIndex)];
        if (!frame) {
            return Result.err({
                code: 'FRAME_NOT_FOUND',
                message: `Frame ${frameIndex} not found in session`,
            });
        }

        // Merge overrides
        frame.directorOverrides = {
            ...frame.directorOverrides,
            ...overrides,
        };

        return this.saveSession(this.session);
    }

    /**
     * Set alignment delta for a frame
     */
    async setAlignmentDelta(
        frameIndex: number,
        delta: Omit<HumanAlignmentDelta, 'frameId' | 'timestamp'>
    ): Promise<Result<void, SessionError>> {
        if (!this.session) {
            return Result.err({
                code: 'NO_ACTIVE_SESSION',
                message: 'No active session',
            });
        }

        const frame = this.session.frames[String(frameIndex)];
        if (!frame) {
            return Result.err({
                code: 'FRAME_NOT_FOUND',
                message: `Frame ${frameIndex} not found in session`,
            });
        }

        frame.directorOverrides.alignment = {
            frameId: frame.id,
            userOverrideX: delta.userOverrideX,
            userOverrideY: delta.userOverrideY,
            timestamp: new Date().toISOString(),
        };

        return this.saveSession(this.session);
    }

    /**
     * Get the run path
     */
    getRunPath(): string {
        return this.runPath;
    }

    /**
     * Commit the session (finalize for export)
     */
    async commitSession(): Promise<Result<void, SessionError>> {
        if (!this.session) {
            return Result.err({
                code: 'NO_ACTIVE_SESSION',
                message: 'No active session',
            });
        }

        this.session.status = 'committed';
        logger.info({ sessionId: this.session.sessionId }, 'Session committed');
        return this.saveSession(this.session);
    }

    /**
     * Mark session as committed with commit info (for Story 7.9)
     */
    async markCommitted(commitInfo: {
        approvedCount: number;
        nudgedCount: number;
        patchedCount: number;
        timestamp: string;
    }): Promise<Result<void, SessionError>> {
        if (!this.session) {
            return Result.err({
                code: 'NO_ACTIVE_SESSION',
                message: 'No active session',
            });
        }

        this.session.status = 'committed';
        this.session.commitInfo = commitInfo;
        logger.info({
            sessionId: this.session.sessionId,
            ...commitInfo,
        }, 'Session marked committed');
        return this.saveSession(this.session);
    }

    /**
     * Discard the session (cancel)
     */
    async discardSession(): Promise<Result<void, SessionError>> {
        if (!this.session) {
            return Result.err({
                code: 'NO_ACTIVE_SESSION',
                message: 'No active session',
            });
        }

        this.session.status = 'discarded';
        logger.info({ sessionId: this.session.sessionId }, 'Session discarded');
        return this.saveSession(this.session);
    }

    /**
     * Get count of frames in each status
     */
    getStatusCounts(): Record<FrameStatus, number> {
        const counts: Record<FrameStatus, number> = {
            PENDING: 0,
            GENERATED: 0,
            AUDIT_FAIL: 0,
            AUDIT_WARN: 0,
            APPROVED: 0,
        };

        if (!this.session) {
            return counts;
        }

        for (const frame of Object.values(this.session.frames)) {
            counts[frame.status]++;
        }

        return counts;
    }

    /**
     * Check if all frames are approved
     */
    isComplete(): boolean {
        if (!this.session) {
            return false;
        }

        return Object.values(this.session.frames).every(
            frame => frame.status === 'APPROVED'
        );
    }

    /**
     * Get frames that need attention (not approved)
     */
    getFramesNeedingAttention(): DirectorFrameState[] {
        if (!this.session) {
            return [];
        }

        return Object.values(this.session.frames)
            .filter(frame => frame.status !== 'APPROVED')
            .sort((a, b) => a.frameIndex - b.frameIndex);
    }
}

/**
 * Factory function to create a session manager
 */
export function createDirectorSessionManager(
    runId: string,
    runPath: string
): DirectorSessionManager {
    return new DirectorSessionManager(runId, runPath);
}
