/**
 * Run status types and interfaces
 * Per Story 4.5: Implement Run Status Reporting
 */

/**
 * Run status values
 */
export type RunStatusValue = 'in-progress' | 'completed' | 'stopped' | 'failed';

/**
 * Reason codes for each status type
 */
export type InProgressReasonCode =
    | 'GENERATING'
    | 'AUDITING'
    | 'RETRYING'
    | 'ALIGNING'
    | 'INITIALIZING';

export type CompletedReasonCode =
    | 'ALL_FRAMES_APPROVED'
    | 'PARTIAL_SUCCESS';

export type StoppedReasonCode =
    | 'RETRY_RATE_EXCEEDED'
    | 'REJECT_RATE_EXCEEDED'
    | 'CONSECUTIVE_FAILS'
    | 'CIRCUIT_BREAKER'
    | 'USER_INTERRUPT';

export type FailedReasonCode =
    | 'SYS_MANIFEST_INVALID'
    | 'DEP_API_UNAVAILABLE'
    | 'DEP_TEXTUREPACKER_FAIL'
    | 'SYS_WRITE_ERROR'
    | 'SYS_UNKNOWN_ERROR';

export type ReasonCode =
    | InProgressReasonCode
    | CompletedReasonCode
    | StoppedReasonCode
    | FailedReasonCode;

/**
 * Run metrics aggregate
 */
export interface RunMetrics {
    totalFrames: number;
    framesCompleted: number;
    framesFailed: number;
    framesRemaining: number;
    totalAttempts: number;
    retryRate: number;
    rejectRate: number;
}

/**
 * In-progress status details
 */
export interface InProgressDetails {
    currentFrameIndex: number;
    currentAttempt: number;
    elapsedTimeMs: number;
    estimatedRemainingMs?: number;
    currentAction?: string;
}

/**
 * Completed status details
 */
export interface CompletedDetails {
    successRate: number;
    totalDurationMs: number;
    exportLocation?: string;
    atlasFiles?: string[];
    validationPassed?: boolean;
}

/**
 * Stopped status details
 */
export interface StoppedDetails {
    stopCondition: string;
    threshold: number;
    actualValue: number;
    resumeCommand: string;
    framesRemaining: number;
}

/**
 * Failed status details
 */
export interface FailedDetails {
    errorType: 'system' | 'dependency' | 'audit';
    errorCode: string;
    errorMessage: string;
    diagnosticPath?: string;
}

/**
 * Union of all status detail types
 */
export type StatusDetails =
    | InProgressDetails
    | CompletedDetails
    | StoppedDetails
    | FailedDetails;

/**
 * Complete run status
 */
export interface RunStatus {
    status: RunStatusValue;
    reasonCode: ReasonCode;
    message: string;
    timestamp: string;
    metrics: RunMetrics;
    details: StatusDetails;
}

/**
 * Reason code descriptions
 */
export const REASON_CODE_DESCRIPTIONS: Record<ReasonCode, string> = {
    // In-progress
    'GENERATING': 'Currently generating frame',
    'AUDITING': 'Currently auditing frame',
    'RETRYING': 'Executing retry action',
    'ALIGNING': 'Applying contact patch alignment',
    'INITIALIZING': 'Initializing run',

    // Completed
    'ALL_FRAMES_APPROVED': 'All frames passed audit',
    'PARTIAL_SUCCESS': 'Some frames failed but run completed',

    // Stopped
    'RETRY_RATE_EXCEEDED': 'Retry rate exceeded threshold',
    'REJECT_RATE_EXCEEDED': 'Reject rate exceeded threshold',
    'CONSECUTIVE_FAILS': 'Too many consecutive failures',
    'CIRCUIT_BREAKER': 'Total attempts exceeded circuit breaker limit',
    'USER_INTERRUPT': 'User interrupted the run',

    // Failed
    'SYS_MANIFEST_INVALID': 'Manifest validation failed',
    'DEP_API_UNAVAILABLE': 'Gemini API unreachable',
    'DEP_TEXTUREPACKER_FAIL': 'TexturePacker error',
    'SYS_WRITE_ERROR': 'File system error',
    'SYS_UNKNOWN_ERROR': 'Unknown system error',
};

/**
 * Check if details are InProgressDetails
 */
export function isInProgressDetails(details: StatusDetails): details is InProgressDetails {
    return 'currentFrameIndex' in details && 'currentAttempt' in details;
}

/**
 * Check if details are CompletedDetails
 */
export function isCompletedDetails(details: StatusDetails): details is CompletedDetails {
    return 'successRate' in details && 'totalDurationMs' in details;
}

/**
 * Check if details are StoppedDetails
 */
export function isStoppedDetails(details: StatusDetails): details is StoppedDetails {
    return 'stopCondition' in details && 'resumeCommand' in details;
}

/**
 * Check if details are FailedDetails
 */
export function isFailedDetails(details: StatusDetails): details is FailedDetails {
    return 'errorType' in details && 'errorCode' in details;
}
