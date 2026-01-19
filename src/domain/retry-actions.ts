/**
 * Retry action types and reason-to-action mapping
 * Per Story 4.3: Retry Ladder with Reason-to-Action Mapping
 */

/**
 * Available retry actions
 */
export type RetryAction =
    | 'REROLL_SEED'           // Level 1: Try different seed
    | 'TIGHTEN_NEGATIVE'      // Level 2: Add constraints to negative prompt
    | 'IDENTITY_RESCUE'       // Level 3: Re-anchor + lock prompt
    | 'POSE_RESCUE'           // Level 4: Emphasize baseline/pose
    | 'TWO_STAGE_INPAINT'     // Level 5: Masked inpainting
    | 'POST_PROCESS'          // Level 6: Apply alpha cleanup
    | 'REGENERATE_HIGHRES'    // Level 6 alt: Bump resolution
    | 'RE_ANCHOR'             // Level 7: Drop previous frame, use anchor only
    | 'DEFAULT_REGENERATE'    // Final: Basic regeneration (ladder exhausted)
    | 'STOP';                 // Level 8: Stop attempting

/**
 * Stop reason types
 */
export type StopReasonType =
    | 'MAX_ATTEMPTS_REACHED'
    | 'LADDER_EXHAUSTED'
    | 'HF_IDENTITY_COLLAPSE'
    | 'OSCILLATION_DETECTED'
    | 'CIRCUIT_BREAKER_TRIPPED'
    | 'RETRY_RATE_EXCEEDED'
    | 'REJECT_RATE_EXCEEDED'
    | 'CONSECUTIVE_FAILS'
    | 'USER_INTERRUPT'
    | 'API_UNAVAILABLE';

/**
 * Reason code to action sequence mapping
 * Each reason code maps to a sequence of actions to try in order
 */
export const REASON_ACTION_MAP: Record<string, RetryAction[]> = {
    // Identity drift - escalates from reroll to rescue to re-anchor
    'SF01_IDENTITY_DRIFT': ['REROLL_SEED', 'IDENTITY_RESCUE', 'RE_ANCHOR'],

    // Palette drift - tighten constraints then rescue
    'SF02_PALETTE_DRIFT': ['TIGHTEN_NEGATIVE', 'IDENTITY_RESCUE'],

    // Baseline drift - pose rescue then re-anchor
    'SF03_BASELINE_DRIFT': ['POSE_RESCUE', 'RE_ANCHOR'],

    // Temporal flicker - reroll then tighten
    'SF04_TEMPORAL_FLICKER': ['REROLL_SEED', 'TIGHTEN_NEGATIVE'],

    // Alpha halo - post-process or inpaint
    'SF_ALPHA_HALO': ['POST_PROCESS', 'TWO_STAGE_INPAINT'],

    // Pixel noise - higher resolution or post-process
    'SF_PIXEL_NOISE': ['REGENERATE_HIGHRES', 'POST_PROCESS'],

    // Fringe risk - post-process
    'SF_FRINGE_RISK': ['POST_PROCESS'],
};

/**
 * 8-Level Retry Ladder from OPUS INPUT PACK
 */
export interface RetryLadderLevel {
    level: number;
    action: RetryAction;
    description: string;
    triggeredBy: string[];
}

export const RETRY_LADDER: RetryLadderLevel[] = [
    {
        level: 1,
        action: 'REROLL_SEED',
        description: 'Reroll seeds - try different random variation',
        triggeredBy: ['SF01_IDENTITY_DRIFT', 'SF04_TEMPORAL_FLICKER'],
    },
    {
        level: 2,
        action: 'TIGHTEN_NEGATIVE',
        description: 'Tighten negative prompt - add palette/style constraints',
        triggeredBy: ['SF02_PALETTE_DRIFT', 'SF04_TEMPORAL_FLICKER'],
    },
    {
        level: 3,
        action: 'IDENTITY_RESCUE',
        description: 'Identity rescue - re-anchor + apply lock prompt',
        triggeredBy: ['SF01_IDENTITY_DRIFT', 'SF02_PALETTE_DRIFT'],
    },
    {
        level: 4,
        action: 'POSE_RESCUE',
        description: 'Pose rescue - emphasize baseline guide in prompt',
        triggeredBy: ['SF03_BASELINE_DRIFT'],
    },
    {
        level: 5,
        action: 'TWO_STAGE_INPAINT',
        description: 'Two-stage inpaint - masked region correction',
        triggeredBy: ['SF_ALPHA_HALO'],
    },
    {
        level: 6,
        action: 'POST_PROCESS',
        description: 'Post-process - apply alpha cleanup filter',
        triggeredBy: ['SF_ALPHA_HALO', 'SF_PIXEL_NOISE', 'SF_FRINGE_RISK'],
    },
    {
        level: 7,
        action: 'RE_ANCHOR',
        description: 'Escalate - drop previous frame, regenerate from anchor only',
        triggeredBy: ['multiple_failures', 'oscillation'],
    },
    {
        level: 8,
        action: 'STOP',
        description: 'Stop - ladder exhausted or identity collapse',
        triggeredBy: ['HF_IDENTITY_COLLAPSE', 'ladder_exhausted'],
    },
];

/**
 * Action descriptions for logging
 */
export const ACTION_DESCRIPTIONS: Record<RetryAction, string> = {
    'REROLL_SEED': 'Rerolling seed for different variation',
    'TIGHTEN_NEGATIVE': 'Adding palette/style constraints to negative prompt',
    'IDENTITY_RESCUE': 'Applying identity rescue with lock prompt',
    'POSE_RESCUE': 'Emphasizing baseline and pose constraints',
    'TWO_STAGE_INPAINT': 'Applying two-stage inpainting',
    'POST_PROCESS': 'Applying alpha cleanup post-processing',
    'REGENERATE_HIGHRES': 'Regenerating at higher resolution',
    'RE_ANCHOR': 'Dropping previous frame, re-anchoring',
    'DEFAULT_REGENERATE': 'Default regeneration (ladder exhausted)',
    'STOP': 'Stopping retry attempts',
};

/**
 * Get actions for a specific reason code
 */
export function getActionsForReason(reasonCode: string): RetryAction[] {
    return REASON_ACTION_MAP[reasonCode] ?? ['REROLL_SEED'];
}

/**
 * Get ladder level for an action
 */
export function getLadderLevel(action: RetryAction): number {
    const level = RETRY_LADDER.find(l => l.action === action);
    return level?.level ?? 8;
}

/**
 * Check if an action is terminal (stops retrying)
 */
export function isTerminalAction(action: RetryAction): boolean {
    return action === 'STOP';
}
