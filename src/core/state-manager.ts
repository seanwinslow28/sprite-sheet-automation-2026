/**
 * State manager - tracks run progress with atomic persistence
 * Per Story 2.5: state.json updated atomically after every task
 */

import { writeJsonAtomic } from '../utils/fs-helpers.js';
import { promises as fs } from 'fs';
import { Result } from './config-resolver.js';

/**
 * Individual frame state
 */
export interface FrameState {
    index: number;
    status: 'pending' | 'in_progress' | 'approved' | 'failed';
    attempts: number;
    approved_path: string | null;
    last_candidate_path: string | null;
    last_error: string | null;
}

/**
 * Overall run state
 */
export interface RunState {
    run_id: string;
    status: 'initializing' | 'in_progress' | 'paused' | 'completed' | 'failed';
    current_frame: number;
    current_attempt: number;
    total_frames: number;
    started_at: string;
    updated_at: string;
    frame_states: FrameState[];
}

/**
 * System error for state operations
 */
export interface StateError {
    code: string;
    message: string;
    cause?: unknown;
}

/**
 * Initialize state for a new run
 */
export function initializeState(runId: string, totalFrames: number): RunState {
    const now = new Date().toISOString();

    // Create initial frame states
    const frameStates: FrameState[] = [];
    for (let i = 0; i < totalFrames; i++) {
        frameStates.push({
            index: i,
            status: 'pending',
            attempts: 0,
            approved_path: null,
            last_candidate_path: null,
            last_error: null,
        });
    }

    return {
        run_id: runId,
        status: 'initializing',
        current_frame: 0,
        current_attempt: 0,
        total_frames: totalFrames,
        started_at: now,
        updated_at: now,
        frame_states: frameStates,
    };
}

/**
 * Load state from disk
 */
export async function loadState(statePath: string): Promise<Result<RunState, StateError>> {
    try {
        const content = await fs.readFile(statePath, 'utf-8');
        const state = JSON.parse(content) as RunState;
        return Result.ok(state);
    } catch (error) {
        return Result.err({
            code: 'STATE_LOAD_FAILED',
            message: `Failed to load state: ${statePath}`,
            cause: error,
        });
    }
}

/**
 * Save state atomically
 */
export async function saveState(
    statePath: string,
    state: RunState
): Promise<Result<void, StateError>> {
    try {
        // Update timestamp
        state.updated_at = new Date().toISOString();

        // Atomic write
        await writeJsonAtomic(statePath, state);

        return Result.ok(undefined);
    } catch (error) {
        return Result.err({
            code: 'STATE_SAVE_FAILED',
            message: `Failed to save state: ${statePath}`,
            cause: error,
        });
    }
}

/**
 * Update frame state
 */
export function updateFrameState(
    state: RunState,
    frameIndex: number,
    updates: Partial<FrameState>
): RunState {
    const newState = { ...state };
    newState.frame_states = [...state.frame_states];

    if (frameIndex >= 0 && frameIndex < newState.frame_states.length) {
        newState.frame_states[frameIndex] = {
            ...newState.frame_states[frameIndex],
            ...updates,
        };
    }

    return newState;
}

/**
 * Mark frame as in-progress
 */
export function markFrameInProgress(
    state: RunState,
    frameIndex: number,
    attemptIndex: number
): RunState {
    let newState = { ...state };
    newState.current_frame = frameIndex;
    newState.current_attempt = attemptIndex;

    if (state.status === 'initializing') {
        newState.status = 'in_progress';
    }

    newState = updateFrameState(newState, frameIndex, {
        status: 'in_progress',
        attempts: attemptIndex,
    });

    return newState;
}

/**
 * Mark frame as approved
 */
export function markFrameApproved(
    state: RunState,
    frameIndex: number,
    approvedPath: string
): RunState {
    return updateFrameState(state, frameIndex, {
        status: 'approved',
        approved_path: approvedPath,
    });
}

/**
 * Mark frame as failed
 */
export function markFrameFailed(
    state: RunState,
    frameIndex: number,
    error: string
): RunState {
    return updateFrameState(state, frameIndex, {
        status: 'failed',
        last_error: error,
    });
}

/**
 * Check if run is complete
 */
export function isRunComplete(state: RunState): boolean {
    return state.frame_states.every(
        frame => frame.status === 'approved' || frame.status === 'failed'
    );
}

/**
 * Count approved frames
 */
export function countApprovedFrames(state: RunState): number {
    return state.frame_states.filter(f => f.status === 'approved').length;
}

/**
 * Count failed frames
 */
export function countFailedFrames(state: RunState): number {
    return state.frame_states.filter(f => f.status === 'failed').length;
}
