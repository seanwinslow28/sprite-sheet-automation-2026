/**
 * Frame chain resolver - determines reference frame for generation
 * Per Story 4.1: Frame-to-Frame Chaining (Edit-from-Previous)
 */

import { logger } from '../utils/logger.js';
import type { RunState } from './state-manager.js';

/**
 * Reference frame selection result
 */
export interface ReferenceSelection {
    /** Path to the reference frame */
    path: string;
    /** Source of the reference: anchor for frame 0, previous for chaining, anchor for re-anchor */
    source: 'anchor' | 'previous';
    /** Reason for selection (for logging) */
    reason: string;
}

/**
 * Chain break record for diagnostic purposes
 */
export interface ChainBreak {
    frameIndex: number;
    reason: string;
    action: 're_anchor' | 'fallback';
    timestamp: string;
}

/**
 * Select the reference frame for generation
 *
 * Decision tree:
 * 1. Frame 0 always uses anchor
 * 2. Force re-anchor uses anchor (drift recovery)
 * 3. Try to use previous approved frame
 * 4. Fallback to anchor if previous doesn't exist
 */
export function selectReferenceFrame(
    frameIndex: number,
    approvedFrames: string[],
    anchorPath: string,
    forceReAnchor: boolean = false
): ReferenceSelection {
    // Frame 0 always uses anchor
    if (frameIndex === 0) {
        return {
            path: anchorPath,
            source: 'anchor',
            reason: 'Frame 0: Using anchor as edit base',
        };
    }

    // Force re-anchor (drift recovery)
    if (forceReAnchor) {
        logger.info({
            frameIndex,
            action: 're_anchor',
        }, 'Force re-anchor triggered for drift recovery');

        return {
            path: anchorPath,
            source: 'anchor',
            reason: `Frame ${frameIndex}: Re-anchoring due to drift/recovery`,
        };
    }

    // Try to use previous approved frame
    const previousIndex = frameIndex - 1;
    const previousFrame = approvedFrames[previousIndex];

    if (previousFrame) {
        return {
            path: previousFrame,
            source: 'previous',
            reason: `Frame ${frameIndex}: Chaining from previous approved frame (${previousIndex})`,
        };
    }

    // Fallback to anchor if previous doesn't exist (gap in sequence)
    logger.warn({
        frameIndex,
        previousIndex,
        approvedFrameCount: approvedFrames.length,
    }, 'Previous frame not found - falling back to anchor');

    return {
        path: anchorPath,
        source: 'anchor',
        reason: `Frame ${frameIndex}: Fallback to anchor (frame ${previousIndex} not approved)`,
    };
}

/**
 * Get approved frame path by index from state
 */
export function getApprovedFrame(
    state: RunState,
    frameIndex: number
): string | undefined {
    if (frameIndex < 0 || frameIndex >= state.frame_states.length) {
        return undefined;
    }

    const frameState = state.frame_states[frameIndex];
    if (frameState.status === 'approved' && frameState.approved_path) {
        return frameState.approved_path;
    }

    return undefined;
}

/**
 * Get all approved frame paths in order from state
 */
export function getApprovedFramePaths(state: RunState): string[] {
    const paths: string[] = [];

    for (let i = 0; i < state.frame_states.length; i++) {
        const frame = state.frame_states[i];
        if (frame.status === 'approved' && frame.approved_path) {
            paths[i] = frame.approved_path;
        }
    }

    return paths;
}

/**
 * Find next pending frame index
 */
export function findNextPendingFrame(state: RunState): number | null {
    for (let i = 0; i < state.frame_states.length; i++) {
        if (state.frame_states[i].status === 'pending') {
            return i;
        }
    }
    return null;
}

/**
 * Check if frame sequence has gaps before the given index
 */
export function hasSequenceGaps(
    approvedFrames: string[],
    upToIndex: number
): boolean {
    for (let i = 0; i < upToIndex; i++) {
        if (!approvedFrames[i]) {
            return true;
        }
    }
    return false;
}

/**
 * Record a chain break event
 */
export function createChainBreak(
    frameIndex: number,
    reason: string,
    action: 're_anchor' | 'fallback'
): ChainBreak {
    return {
        frameIndex,
        reason,
        action,
        timestamp: new Date().toISOString(),
    };
}
