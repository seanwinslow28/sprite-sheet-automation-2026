/**
 * Run folder constants - defines folder structure for pipeline runs
 * Per Story 6.4: Consistent folder organization across codebase
 */

/**
 * Run folder subdirectories
 */
export const RUN_FOLDERS = {
    /** Frames that passed all quality gates */
    APPROVED: 'approved',
    /** Frames that failed hard gates (with reason in filename) */
    REJECTED: 'rejected',
    /** All generation attempts for debugging */
    CANDIDATES: 'candidates',
    /** Quality metrics and attempt history */
    AUDIT: 'audit',
    /** Execution logs */
    LOGS: 'logs',
    /** Final atlas output (PNG + JSON) */
    EXPORT: 'export',
    /** Phaser micro-test results */
    VALIDATION: 'validation',
} as const;

export type RunFolderName = typeof RUN_FOLDERS[keyof typeof RUN_FOLDERS];

/**
 * Run file names
 */
export const RUN_FILES = {
    /** Resolved configuration snapshot */
    MANIFEST_LOCK: 'manifest.lock.json',
    /** Run progress and current status */
    STATE: 'state.json',
    /** Final statistics (generated on completion) */
    SUMMARY: 'summary.json',
    /** Failure analysis (if run stopped) */
    DIAGNOSTIC: 'diagnostic.json',
    /** Anchor baseline/root extraction */
    ANCHOR_ANALYSIS: 'anchor_analysis.json',
    /** Run folder documentation */
    README: 'README.md',
    /** Audit log */
    AUDIT_LOG: 'audit/audit_log.jsonl',
    /** Metrics summary CSV */
    METRICS_CSV: 'audit/metrics_summary.csv',
} as const;

export type RunFileName = typeof RUN_FILES[keyof typeof RUN_FILES];

/**
 * All folder names as array for iteration
 */
export const ALL_RUN_FOLDERS = Object.values(RUN_FOLDERS);

/**
 * Ordered folders for display
 */
export const RUN_FOLDER_DISPLAY_ORDER: RunFolderName[] = [
    RUN_FOLDERS.APPROVED,
    RUN_FOLDERS.REJECTED,
    RUN_FOLDERS.CANDIDATES,
    RUN_FOLDERS.AUDIT,
    RUN_FOLDERS.LOGS,
    RUN_FOLDERS.EXPORT,
    RUN_FOLDERS.VALIDATION,
];

/**
 * Folder descriptions for documentation
 */
export const RUN_FOLDER_DESCRIPTIONS: Record<RunFolderName, string> = {
    [RUN_FOLDERS.APPROVED]: 'Frames that passed all quality gates',
    [RUN_FOLDERS.REJECTED]: 'Frames that failed (with reason in filename)',
    [RUN_FOLDERS.CANDIDATES]: 'All generation attempts for debugging',
    [RUN_FOLDERS.AUDIT]: 'Quality metrics and attempt history',
    [RUN_FOLDERS.LOGS]: 'Execution logs',
    [RUN_FOLDERS.EXPORT]: 'Final atlas (PNG + JSON)',
    [RUN_FOLDERS.VALIDATION]: 'Phaser micro-test results',
};
