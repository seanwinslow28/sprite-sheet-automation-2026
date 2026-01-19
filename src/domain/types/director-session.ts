/**
 * Director Session types and Zod schemas
 * Per Story 7.1: State object tracking frame lifecycle in Director Mode
 */

import { z } from 'zod';

/**
 * Frame status enum - tracks frame lifecycle in director review
 */
export const FrameStatusEnum = z.enum([
    'PENDING',      // Not yet processed
    'GENERATED',    // Generated but not audited
    'AUDIT_FAIL',   // Failed hard or soft gates
    'AUDIT_WARN',   // Auto-aligned, needs review
    'APPROVED',     // Passed audit or human verified
]);

export type FrameStatus = z.infer<typeof FrameStatusEnum>;

/**
 * Session status enum - tracks overall session lifecycle
 */
export const SessionStatusEnum = z.enum([
    'active',       // Session in progress
    'committed',    // Session finalized and exported
    'discarded',    // Session cancelled
]);

export type SessionStatus = z.infer<typeof SessionStatusEnum>;

/**
 * Human alignment delta - manual position adjustments
 */
export const HumanAlignmentDeltaSchema = z.object({
    frameId: z.string().min(1),
    userOverrideX: z.number(),           // Horizontal adjustment (pixels)
    userOverrideY: z.number(),           // Vertical adjustment (pixels)
    timestamp: z.string().datetime(),    // When adjustment was made
});

export type HumanAlignmentDelta = z.infer<typeof HumanAlignmentDeltaSchema>;

/**
 * Patch history entry - tracks AI inpaint operations
 */
export const PatchHistoryEntrySchema = z.object({
    originalPath: z.string().min(1),
    patchedPath: z.string().min(1),
    maskPath: z.string().min(1),
    prompt: z.string(),
    timestamp: z.string().datetime(),
});

export type PatchHistoryEntry = z.infer<typeof PatchHistoryEntrySchema>;

/**
 * Director overrides - all human modifications to a frame
 */
export const DirectorOverridesSchema = z.object({
    alignment: HumanAlignmentDeltaSchema.optional(),
    isPatched: z.boolean(),
    patchHistory: z.array(PatchHistoryEntrySchema),
    notes: z.string().optional(),        // Operator notes
});

export type DirectorOverrides = z.infer<typeof DirectorOverridesSchema>;

/**
 * Attempt info - summary of a generation attempt
 */
export const AttemptInfoSchema = z.object({
    attemptIndex: z.number().int().min(1),
    timestamp: z.string().datetime(),
    candidatePath: z.string(),
    strategy: z.string(),
    reasonCodes: z.array(z.string()),
    passed: z.boolean(),
});

export type AttemptInfo = z.infer<typeof AttemptInfoSchema>;

/**
 * Audit report summary - embedded in frame state
 */
export const AuditReportSchema = z.object({
    compositeScore: z.number().min(0).max(1),
    flags: z.array(z.string()),
    passed: z.boolean(),
    autoAligned: z.boolean().optional(),
    driftPixels: z.number().optional(),
});

export type AuditReport = z.infer<typeof AuditReportSchema>;

/**
 * Director frame state - complete state for a single frame
 */
export const DirectorFrameStateSchema = z.object({
    id: z.string().min(1),               // Unique frame identifier (e.g., "frame_0001")
    frameIndex: z.number().int().min(0), // 0-based index
    status: FrameStatusEnum,
    imagePath: z.string(),               // Path to current image file
    imageBase64: z.string().optional(),  // Base64 for UI (loaded on demand)
    auditReport: AuditReportSchema,
    directorOverrides: DirectorOverridesSchema,
    attemptHistory: z.array(AttemptInfoSchema),
});

export type DirectorFrameState = z.infer<typeof DirectorFrameStateSchema>;

/**
 * Commit info - summary of commit operation (Story 7.9)
 */
export const CommitInfoSchema = z.object({
    approvedCount: z.number().int().min(0),
    nudgedCount: z.number().int().min(0),
    patchedCount: z.number().int().min(0),
    timestamp: z.string().datetime(),
});

export type CommitInfo = z.infer<typeof CommitInfoSchema>;

/**
 * Director session - complete session state
 * Serialized to JSON with frames as Record (not Map)
 */
export const DirectorSessionSchema = z.object({
    sessionId: z.string().uuid(),                    // Unique identifier
    runId: z.string().min(1),                        // Reference to pipeline run
    moveId: z.string(),                              // Current move being reviewed
    anchorFrameId: z.string().min(1),                // Reference to Frame 0
    frames: z.record(z.string(), DirectorFrameStateSchema), // Frame index -> state
    createdAt: z.string().datetime(),                // ISO timestamp
    lastModified: z.string().datetime(),             // ISO timestamp
    status: SessionStatusEnum,
    commitInfo: CommitInfoSchema.optional(),         // Populated on commit (Story 7.9)
});

export type DirectorSession = z.infer<typeof DirectorSessionSchema>;

/**
 * Valid frame status transitions
 */
export const VALID_STATUS_TRANSITIONS: Record<FrameStatus, FrameStatus[]> = {
    PENDING: ['GENERATED'],
    GENERATED: ['AUDIT_FAIL', 'AUDIT_WARN', 'APPROVED'],
    AUDIT_FAIL: ['APPROVED', 'GENERATED'],  // Can approve manually or regenerate
    AUDIT_WARN: ['APPROVED', 'GENERATED'],  // Can approve after review or regenerate
    APPROVED: [],                           // Terminal state
};

/**
 * Check if a status transition is valid
 */
export function isValidStatusTransition(
    from: FrameStatus,
    to: FrameStatus
): boolean {
    return VALID_STATUS_TRANSITIONS[from].includes(to);
}

/**
 * Create empty director overrides
 */
export function createEmptyOverrides(): DirectorOverrides {
    return {
        isPatched: false,
        patchHistory: [],
    };
}

/**
 * Create initial frame state
 */
export function createInitialFrameState(
    frameIndex: number,
    imagePath: string
): DirectorFrameState {
    const frameId = `frame_${String(frameIndex).padStart(4, '0')}`;
    return {
        id: frameId,
        frameIndex,
        status: 'PENDING',
        imagePath,
        auditReport: {
            compositeScore: 0,
            flags: [],
            passed: false,
        },
        directorOverrides: createEmptyOverrides(),
        attemptHistory: [],
    };
}
