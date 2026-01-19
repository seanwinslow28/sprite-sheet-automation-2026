/**
 * Tests for Director Session types and schemas (Story 7.1)
 */

import { describe, it, expect } from 'vitest';
import {
    DirectorSessionSchema,
    DirectorFrameStateSchema,
    DirectorOverridesSchema,
    HumanAlignmentDeltaSchema,
    PatchHistoryEntrySchema,
    FrameStatusEnum,
    SessionStatusEnum,
    isValidStatusTransition,
    createEmptyOverrides,
    createInitialFrameState,
    VALID_STATUS_TRANSITIONS,
    type DirectorSession,
    type DirectorFrameState,
    type FrameStatus,
} from '../../src/domain/types/director-session.js';

describe('Director Session Schema (Story 7.1)', () => {
    describe('FrameStatus enum (AC #3)', () => {
        it('should accept all valid status values', () => {
            const statuses = ['PENDING', 'GENERATED', 'AUDIT_FAIL', 'AUDIT_WARN', 'APPROVED'];
            for (const status of statuses) {
                const result = FrameStatusEnum.safeParse(status);
                expect(result.success).toBe(true);
            }
        });

        it('should reject invalid status values', () => {
            const result = FrameStatusEnum.safeParse('INVALID');
            expect(result.success).toBe(false);
        });
    });

    describe('SessionStatus enum', () => {
        it('should accept all valid session status values', () => {
            const statuses = ['active', 'committed', 'discarded'];
            for (const status of statuses) {
                const result = SessionStatusEnum.safeParse(status);
                expect(result.success).toBe(true);
            }
        });
    });

    describe('HumanAlignmentDelta schema (AC #2)', () => {
        it('should validate correct alignment delta', () => {
            const delta = {
                frameId: 'frame_0001',
                userOverrideX: -5,
                userOverrideY: 3,
                timestamp: '2026-01-18T12:00:00.000Z',
            };
            const result = HumanAlignmentDeltaSchema.safeParse(delta);
            expect(result.success).toBe(true);
        });

        it('should reject missing frameId', () => {
            const delta = {
                userOverrideX: 0,
                userOverrideY: 0,
                timestamp: '2026-01-18T12:00:00.000Z',
            };
            const result = HumanAlignmentDeltaSchema.safeParse(delta);
            expect(result.success).toBe(false);
        });

        it('should reject invalid timestamp format', () => {
            const delta = {
                frameId: 'frame_0001',
                userOverrideX: 0,
                userOverrideY: 0,
                timestamp: 'not-a-timestamp',
            };
            const result = HumanAlignmentDeltaSchema.safeParse(delta);
            expect(result.success).toBe(false);
        });
    });

    describe('PatchHistoryEntry schema', () => {
        it('should validate correct patch history entry', () => {
            const entry = {
                originalPath: 'runs/abc/frame_0001.png',
                patchedPath: 'runs/abc/frame_0001_patched.png',
                maskPath: 'runs/abc/frame_0001_mask.png',
                prompt: 'Fix the artifact',
                timestamp: '2026-01-18T12:00:00.000Z',
            };
            const result = PatchHistoryEntrySchema.safeParse(entry);
            expect(result.success).toBe(true);
        });
    });

    describe('DirectorOverrides schema (AC #2)', () => {
        it('should validate overrides with all fields', () => {
            const overrides = {
                alignment: {
                    frameId: 'frame_0001',
                    userOverrideX: -2,
                    userOverrideY: 0,
                    timestamp: '2026-01-18T12:00:00.000Z',
                },
                isPatched: true,
                patchHistory: [
                    {
                        originalPath: 'runs/abc/frame_0001.png',
                        patchedPath: 'runs/abc/frame_0001_patched.png',
                        maskPath: 'runs/abc/frame_0001_mask.png',
                        prompt: 'Fix artifact',
                        timestamp: '2026-01-18T12:00:00.000Z',
                    },
                ],
                notes: 'Manual adjustment needed',
            };
            const result = DirectorOverridesSchema.safeParse(overrides);
            expect(result.success).toBe(true);
        });

        it('should validate minimal overrides', () => {
            const overrides = {
                isPatched: false,
                patchHistory: [],
            };
            const result = DirectorOverridesSchema.safeParse(overrides);
            expect(result.success).toBe(true);
        });
    });

    describe('DirectorFrameState schema (AC #2)', () => {
        const validFrameState: DirectorFrameState = {
            id: 'frame_0001',
            frameIndex: 1,
            status: 'PENDING',
            imagePath: 'runs/abc/candidates/frame_0001.png',
            auditReport: {
                compositeScore: 0,
                flags: [],
                passed: false,
            },
            directorOverrides: {
                isPatched: false,
                patchHistory: [],
            },
            attemptHistory: [],
        };

        it('should validate complete frame state', () => {
            const result = DirectorFrameStateSchema.safeParse(validFrameState);
            expect(result.success).toBe(true);
        });

        it('should accept optional imageBase64', () => {
            const withBase64 = {
                ...validFrameState,
                imageBase64: 'data:image/png;base64,ABC123',
            };
            const result = DirectorFrameStateSchema.safeParse(withBase64);
            expect(result.success).toBe(true);
        });

        it('should reject negative frameIndex', () => {
            const invalid = { ...validFrameState, frameIndex: -1 };
            const result = DirectorFrameStateSchema.safeParse(invalid);
            expect(result.success).toBe(false);
        });
    });

    describe('DirectorSession schema (AC #1)', () => {
        const validSession: DirectorSession = {
            sessionId: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
            runId: '20260118_blaze_idle_abc123',
            moveId: 'idle_standard',
            anchorFrameId: 'frame_0000',
            frames: {
                '0': {
                    id: 'frame_0000',
                    frameIndex: 0,
                    status: 'APPROVED',
                    imagePath: 'runs/abc/approved/frame_0000.png',
                    auditReport: {
                        compositeScore: 0.95,
                        flags: [],
                        passed: true,
                    },
                    directorOverrides: {
                        isPatched: false,
                        patchHistory: [],
                    },
                    attemptHistory: [],
                },
            },
            createdAt: '2026-01-18T12:00:00.000Z',
            lastModified: '2026-01-18T12:30:00.000Z',
            status: 'active',
        };

        it('should validate complete session', () => {
            const result = DirectorSessionSchema.safeParse(validSession);
            expect(result.success).toBe(true);
        });

        it('should require valid UUID for sessionId', () => {
            const invalid = { ...validSession, sessionId: 'not-a-uuid' };
            const result = DirectorSessionSchema.safeParse(invalid);
            expect(result.success).toBe(false);
        });

        it('should require non-empty runId', () => {
            const invalid = { ...validSession, runId: '' };
            const result = DirectorSessionSchema.safeParse(invalid);
            expect(result.success).toBe(false);
        });

        it('should accept empty frames map', () => {
            const empty = { ...validSession, frames: {} };
            const result = DirectorSessionSchema.safeParse(empty);
            expect(result.success).toBe(true);
        });

        it('should validate all session statuses', () => {
            for (const status of ['active', 'committed', 'discarded'] as const) {
                const session = { ...validSession, status };
                const result = DirectorSessionSchema.safeParse(session);
                expect(result.success).toBe(true);
            }
        });
    });

    describe('Status transitions', () => {
        it('should allow PENDING -> GENERATED', () => {
            expect(isValidStatusTransition('PENDING', 'GENERATED')).toBe(true);
        });

        it('should allow GENERATED -> AUDIT_FAIL', () => {
            expect(isValidStatusTransition('GENERATED', 'AUDIT_FAIL')).toBe(true);
        });

        it('should allow GENERATED -> AUDIT_WARN', () => {
            expect(isValidStatusTransition('GENERATED', 'AUDIT_WARN')).toBe(true);
        });

        it('should allow GENERATED -> APPROVED', () => {
            expect(isValidStatusTransition('GENERATED', 'APPROVED')).toBe(true);
        });

        it('should allow AUDIT_FAIL -> APPROVED (human override)', () => {
            expect(isValidStatusTransition('AUDIT_FAIL', 'APPROVED')).toBe(true);
        });

        it('should allow AUDIT_WARN -> APPROVED (human review)', () => {
            expect(isValidStatusTransition('AUDIT_WARN', 'APPROVED')).toBe(true);
        });

        it('should NOT allow APPROVED -> any (terminal state)', () => {
            expect(isValidStatusTransition('APPROVED', 'PENDING')).toBe(false);
            expect(isValidStatusTransition('APPROVED', 'GENERATED')).toBe(false);
            expect(isValidStatusTransition('APPROVED', 'AUDIT_FAIL')).toBe(false);
        });

        it('should NOT allow PENDING -> APPROVED (must generate first)', () => {
            expect(isValidStatusTransition('PENDING', 'APPROVED')).toBe(false);
        });
    });

    describe('Helper functions', () => {
        describe('createEmptyOverrides', () => {
            it('should create empty overrides object', () => {
                const overrides = createEmptyOverrides();
                expect(overrides.isPatched).toBe(false);
                expect(overrides.patchHistory).toEqual([]);
                expect(overrides.alignment).toBeUndefined();
                expect(overrides.notes).toBeUndefined();
            });

            it('should pass schema validation', () => {
                const overrides = createEmptyOverrides();
                const result = DirectorOverridesSchema.safeParse(overrides);
                expect(result.success).toBe(true);
            });
        });

        describe('createInitialFrameState', () => {
            it('should create frame state with correct index', () => {
                const state = createInitialFrameState(5, 'runs/abc/frame_0005.png');
                expect(state.frameIndex).toBe(5);
                expect(state.id).toBe('frame_0005');
            });

            it('should initialize with PENDING status', () => {
                const state = createInitialFrameState(0, 'runs/abc/frame_0000.png');
                expect(state.status).toBe('PENDING');
            });

            it('should have empty audit report', () => {
                const state = createInitialFrameState(0, 'runs/abc/frame_0000.png');
                expect(state.auditReport.compositeScore).toBe(0);
                expect(state.auditReport.flags).toEqual([]);
                expect(state.auditReport.passed).toBe(false);
            });

            it('should pass schema validation', () => {
                const state = createInitialFrameState(3, 'runs/abc/frame_0003.png');
                const result = DirectorFrameStateSchema.safeParse(state);
                expect(result.success).toBe(true);
            });

            it('should pad frame ID to 4 digits', () => {
                expect(createInitialFrameState(0, 'p').id).toBe('frame_0000');
                expect(createInitialFrameState(9, 'p').id).toBe('frame_0009');
                expect(createInitialFrameState(99, 'p').id).toBe('frame_0099');
                expect(createInitialFrameState(999, 'p').id).toBe('frame_0999');
            });
        });
    });

    describe('VALID_STATUS_TRANSITIONS constant', () => {
        it('should define transitions for all statuses', () => {
            const allStatuses: FrameStatus[] = ['PENDING', 'GENERATED', 'AUDIT_FAIL', 'AUDIT_WARN', 'APPROVED'];
            for (const status of allStatuses) {
                expect(VALID_STATUS_TRANSITIONS).toHaveProperty(status);
                expect(Array.isArray(VALID_STATUS_TRANSITIONS[status])).toBe(true);
            }
        });
    });
});
