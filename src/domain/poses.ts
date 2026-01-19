/**
 * Phase-based pose library for animation generation
 * Per Story 2.11: Kinematic phases instead of per-frame descriptions
 */

/**
 * Pose phase with description and tension level
 */
export interface PosePhase {
    description: string;
    tension: 'relaxed' | 'tense' | 'explosive';
}

/**
 * Pose map for a move - frame index to phase
 */
export type MovePoseMap = Record<number, PosePhase>;

/**
 * Complete pose library - move ID to pose map
 */
export type PoseLibrary = Record<string, MovePoseMap>;

/**
 * Default fallback pose when no specific description exists
 */
export const FALLBACK_POSE: PosePhase = {
    description: 'Maintain style and consistent volume.',
    tension: 'relaxed',
};

/**
 * Moves library with kinematic phase descriptions
 * Frame 0 is always anchor pose (implicit, no description needed)
 */
export const MOVES_LIBRARY: PoseLibrary = {
    // Idle animation - 8 frames breathing sine wave
    idle_standard: {
        // Frame 0: Anchor pose (implicit)
        1: { description: 'Slight exhale, shoulders drop 1px', tension: 'relaxed' },
        2: { description: 'Full exhale, minimal compression', tension: 'relaxed' },
        3: { description: 'Begin inhale, chest rises', tension: 'relaxed' },
        4: { description: 'Mid inhale, upward energy', tension: 'relaxed' },
        5: { description: 'Full inhale, maximum expansion', tension: 'relaxed' },
        6: { description: 'Hold, stable peak', tension: 'relaxed' },
        7: { description: 'Exhale begins, return to Frame 0 energy', tension: 'relaxed' },
    },

    // Idle variant for champions
    idle: {
        1: { description: 'Slight exhale, shoulders drop 1px', tension: 'relaxed' },
        2: { description: 'Full exhale, minimal compression', tension: 'relaxed' },
        3: { description: 'Begin inhale, chest rises', tension: 'relaxed' },
        4: { description: 'Mid inhale, upward energy', tension: 'relaxed' },
        5: { description: 'Full inhale, maximum expansion', tension: 'relaxed' },
        6: { description: 'Hold, stable peak', tension: 'relaxed' },
        7: { description: 'Exhale begins, return to Frame 0 energy', tension: 'relaxed' },
    },

    // Walk animation - 8 frames standard locomotion cycle
    walk_forward: {
        // Frame 0: Contact - right foot forward (anchor)
        1: { description: 'Recoil - weight shifts onto right foot, left foot lifts', tension: 'tense' },
        2: { description: 'Passing - left leg swings forward, body at midpoint', tension: 'relaxed' },
        3: { description: 'High Point - left leg at maximum forward extension', tension: 'tense' },
        4: { description: 'Contact - left foot strikes ground', tension: 'tense' },
        5: { description: 'Recoil - weight shifts onto left foot, right foot lifts', tension: 'tense' },
        6: { description: 'Passing - right leg swings forward, body at midpoint', tension: 'relaxed' },
        7: { description: 'High Point - right leg at maximum forward extension', tension: 'tense' },
    },

    // Walk variant
    walk: {
        1: { description: 'Recoil - weight shifts onto leading foot, trailing foot lifts', tension: 'tense' },
        2: { description: 'Passing - trailing leg swings forward, body at midpoint', tension: 'relaxed' },
        3: { description: 'High Point - trailing leg at maximum forward extension', tension: 'tense' },
        4: { description: 'Contact - trailing foot becomes leading foot', tension: 'tense' },
        5: { description: 'Recoil - weight shifts onto new leading foot', tension: 'tense' },
        6: { description: 'Passing - trailing leg swings forward', tension: 'relaxed' },
        7: { description: 'High Point - trailing leg at maximum extension', tension: 'tense' },
    },

    // Run animation - faster with more extreme poses
    run: {
        1: { description: 'Recoil - deep knee bend, strong push-off', tension: 'explosive' },
        2: { description: 'Flight phase - both feet off ground, leaning forward', tension: 'explosive' },
        3: { description: 'High Point - trailing leg fully extended behind', tension: 'tense' },
        4: { description: 'Contact - leading foot strikes with forward lean', tension: 'explosive' },
        5: { description: 'Recoil - absorb impact, prepare for push', tension: 'explosive' },
        6: { description: 'Flight phase - aerial moment, arms pumping', tension: 'explosive' },
        7: { description: 'High Point - maximum extension before landing', tension: 'tense' },
    },

    // Attack animation - non-looping
    attack: {
        1: { description: 'Wind-up - body rotates back, weapon raised', tension: 'tense' },
        2: { description: 'Anticipation - maximum wind-up, energy coiled', tension: 'tense' },
        3: { description: 'Strike - explosive forward motion, weapon arc begins', tension: 'explosive' },
        4: { description: 'Contact - impact moment, maximum extension', tension: 'explosive' },
        5: { description: 'Follow-through - momentum continues past impact', tension: 'tense' },
        6: { description: 'Recovery - returning to ready stance', tension: 'relaxed' },
        7: { description: 'Return - nearly back to ready position', tension: 'relaxed' },
    },
};

/**
 * Get pose phase for a specific frame in a move
 * Returns null for frame 0 (anchor pose - no description needed)
 * Returns fallback for undefined frames or moves
 */
export function getPoseForFrame(moveId: string, frameIndex: number): PosePhase | null {
    // Frame 0 is anchor pose - no pose description needed
    if (frameIndex === 0) {
        return null;
    }

    // Normalize move ID (lowercase, handle common aliases)
    const normalizedMoveId = moveId.toLowerCase().replace(/_/g, '_');

    // Try exact match first
    const moveMap = MOVES_LIBRARY[normalizedMoveId];
    if (moveMap && moveMap[frameIndex]) {
        return moveMap[frameIndex];
    }

    // Try fuzzy match (idle_standard, idle, etc.)
    for (const [key, map] of Object.entries(MOVES_LIBRARY)) {
        if (normalizedMoveId.includes(key) || key.includes(normalizedMoveId)) {
            if (map[frameIndex]) {
                return map[frameIndex];
            }
        }
    }

    // Return fallback for undefined frames
    return FALLBACK_POSE;
}

/**
 * Check if a move exists in the library
 */
export function hasMoveDefinition(moveId: string): boolean {
    const normalizedMoveId = moveId.toLowerCase();
    return Object.keys(MOVES_LIBRARY).some(
        key => key === normalizedMoveId || normalizedMoveId.includes(key) || key.includes(normalizedMoveId)
    );
}

/**
 * Get all defined frames for a move
 */
export function getDefinedFrames(moveId: string): number[] {
    const moveMap = MOVES_LIBRARY[moveId.toLowerCase()];
    if (!moveMap) {
        return [];
    }
    return Object.keys(moveMap).map(k => parseInt(k, 10)).sort((a, b) => a - b);
}
