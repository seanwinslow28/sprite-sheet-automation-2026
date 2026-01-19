/**
 * Tests for frame chain resolver
 * Per Story 4.1: Frame-to-Frame Chaining
 */

import { describe, it, expect } from 'vitest';
import {
    selectReferenceFrame,
    getApprovedFrame,
    getApprovedFramePaths,
    findNextPendingFrame,
    hasSequenceGaps,
    createChainBreak,
} from '../../src/core/frame-chain-resolver.js';
import type { RunState } from '../../src/core/state-manager.js';

describe('Frame Chain Resolver', () => {
    const anchorPath = '/run/anchor.png';

    describe('selectReferenceFrame', () => {
        it('should always use anchor for frame 0', () => {
            const result = selectReferenceFrame(0, [], anchorPath);

            expect(result.source).toBe('anchor');
            expect(result.path).toBe(anchorPath);
            expect(result.reason).toContain('Frame 0');
        });

        it('should use previous frame for frame 1 when available', () => {
            const approvedFrames = ['/run/approved/frame_0000.png'];
            const result = selectReferenceFrame(1, approvedFrames, anchorPath);

            expect(result.source).toBe('previous');
            expect(result.path).toBe(approvedFrames[0]);
            expect(result.reason).toContain('Chaining from previous');
        });

        it('should use previous frame for any frame N > 0', () => {
            const approvedFrames = [
                '/run/approved/frame_0000.png',
                '/run/approved/frame_0001.png',
                '/run/approved/frame_0002.png',
            ];
            const result = selectReferenceFrame(3, approvedFrames, anchorPath);

            expect(result.source).toBe('previous');
            expect(result.path).toBe(approvedFrames[2]);
        });

        it('should fallback to anchor when previous frame missing', () => {
            const approvedFrames: string[] = []; // No approved frames
            const result = selectReferenceFrame(1, approvedFrames, anchorPath);

            expect(result.source).toBe('anchor');
            expect(result.path).toBe(anchorPath);
            expect(result.reason).toContain('Fallback');
        });

        it('should use anchor when forceReAnchor is true', () => {
            const approvedFrames = ['/run/approved/frame_0000.png'];
            const result = selectReferenceFrame(1, approvedFrames, anchorPath, true);

            expect(result.source).toBe('anchor');
            expect(result.path).toBe(anchorPath);
            expect(result.reason).toContain('Re-anchoring');
        });

        it('should handle gaps in approved sequence', () => {
            // Sparse array: only frame 0 approved, frame 1 missing
            const approvedFrames: string[] = [];
            approvedFrames[0] = '/run/approved/frame_0000.png';
            // approvedFrames[1] is undefined

            const result = selectReferenceFrame(2, approvedFrames, anchorPath);

            expect(result.source).toBe('anchor');
            expect(result.reason).toContain('Fallback');
        });
    });

    describe('getApprovedFrame', () => {
        const mockState: RunState = {
            run_id: 'test-run',
            status: 'in_progress',
            current_frame: 2,
            current_attempt: 1,
            total_frames: 4,
            started_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            frame_states: [
                { index: 0, status: 'approved', attempts: 1, approved_path: '/approved/0.png', last_candidate_path: null, last_error: null },
                { index: 1, status: 'approved', attempts: 2, approved_path: '/approved/1.png', last_candidate_path: null, last_error: null },
                { index: 2, status: 'in_progress', attempts: 1, approved_path: null, last_candidate_path: null, last_error: null },
                { index: 3, status: 'pending', attempts: 0, approved_path: null, last_candidate_path: null, last_error: null },
            ],
        };

        it('should return approved path for approved frame', () => {
            const result = getApprovedFrame(mockState, 0);
            expect(result).toBe('/approved/0.png');
        });

        it('should return undefined for non-approved frame', () => {
            const result = getApprovedFrame(mockState, 2);
            expect(result).toBeUndefined();
        });

        it('should return undefined for out-of-bounds index', () => {
            const result = getApprovedFrame(mockState, 10);
            expect(result).toBeUndefined();
        });

        it('should return undefined for negative index', () => {
            const result = getApprovedFrame(mockState, -1);
            expect(result).toBeUndefined();
        });
    });

    describe('getApprovedFramePaths', () => {
        const mockState: RunState = {
            run_id: 'test-run',
            status: 'in_progress',
            current_frame: 3,
            current_attempt: 1,
            total_frames: 4,
            started_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            frame_states: [
                { index: 0, status: 'approved', attempts: 1, approved_path: '/approved/0.png', last_candidate_path: null, last_error: null },
                { index: 1, status: 'failed', attempts: 5, approved_path: null, last_candidate_path: null, last_error: 'max attempts' },
                { index: 2, status: 'approved', attempts: 2, approved_path: '/approved/2.png', last_candidate_path: null, last_error: null },
                { index: 3, status: 'pending', attempts: 0, approved_path: null, last_candidate_path: null, last_error: null },
            ],
        };

        it('should return sparse array with only approved paths', () => {
            const paths = getApprovedFramePaths(mockState);

            expect(paths[0]).toBe('/approved/0.png');
            expect(paths[1]).toBeUndefined();
            expect(paths[2]).toBe('/approved/2.png');
            expect(paths[3]).toBeUndefined();
        });
    });

    describe('findNextPendingFrame', () => {
        it('should find first pending frame', () => {
            const state: RunState = {
                run_id: 'test',
                status: 'in_progress',
                current_frame: 0,
                current_attempt: 1,
                total_frames: 3,
                started_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                frame_states: [
                    { index: 0, status: 'approved', attempts: 1, approved_path: '/0.png', last_candidate_path: null, last_error: null },
                    { index: 1, status: 'pending', attempts: 0, approved_path: null, last_candidate_path: null, last_error: null },
                    { index: 2, status: 'pending', attempts: 0, approved_path: null, last_candidate_path: null, last_error: null },
                ],
            };

            const next = findNextPendingFrame(state);
            expect(next).toBe(1);
        });

        it('should return null when all frames processed', () => {
            const state: RunState = {
                run_id: 'test',
                status: 'completed',
                current_frame: 2,
                current_attempt: 1,
                total_frames: 2,
                started_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                frame_states: [
                    { index: 0, status: 'approved', attempts: 1, approved_path: '/0.png', last_candidate_path: null, last_error: null },
                    { index: 1, status: 'failed', attempts: 5, approved_path: null, last_candidate_path: null, last_error: 'max' },
                ],
            };

            const next = findNextPendingFrame(state);
            expect(next).toBeNull();
        });
    });

    describe('hasSequenceGaps', () => {
        it('should return false for contiguous sequence', () => {
            const frames = ['/0.png', '/1.png', '/2.png'];
            expect(hasSequenceGaps(frames, 3)).toBe(false);
        });

        it('should return true for sequence with gap', () => {
            const frames: string[] = [];
            frames[0] = '/0.png';
            // frames[1] is undefined (gap)
            frames[2] = '/2.png';

            expect(hasSequenceGaps(frames, 3)).toBe(true);
        });

        it('should only check up to specified index', () => {
            const frames: string[] = [];
            frames[0] = '/0.png';
            frames[1] = '/1.png';
            // frames[2] missing but we only check up to index 2

            expect(hasSequenceGaps(frames, 2)).toBe(false);
        });
    });

    describe('createChainBreak', () => {
        it('should create chain break record', () => {
            const chainBreak = createChainBreak(3, 'SF01_IDENTITY_DRIFT', 're_anchor');

            expect(chainBreak.frameIndex).toBe(3);
            expect(chainBreak.reason).toBe('SF01_IDENTITY_DRIFT');
            expect(chainBreak.action).toBe('re_anchor');
            expect(chainBreak.timestamp).toBeTypeOf('string');
        });
    });
});
