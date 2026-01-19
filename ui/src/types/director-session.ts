/**
 * Director Session types for the UI
 * Mirrors the backend types from src/domain/types/director-session.ts
 */

export type FrameStatus =
  | 'PENDING'
  | 'GENERATED'
  | 'AUDIT_FAIL'
  | 'AUDIT_WARN'
  | 'APPROVED';

export type SessionStatus = 'active' | 'committed' | 'discarded';

export interface HumanAlignmentDelta {
  frameId: string;
  userOverrideX: number;
  userOverrideY: number;
  timestamp: string;
}

export interface PatchHistoryEntry {
  originalPath: string;
  patchedPath: string;
  maskPath: string;
  prompt: string;
  timestamp: string;
}

export interface DirectorOverrides {
  alignment?: HumanAlignmentDelta;
  isPatched: boolean;
  patchHistory: PatchHistoryEntry[];
  notes?: string;
}

export interface AttemptInfo {
  attemptIndex: number;
  timestamp: string;
  candidatePath: string;
  strategy: string;
  reasonCodes: string[];
  passed: boolean;
}

export interface AuditReport {
  compositeScore: number;
  flags: string[];
  passed: boolean;
  autoAligned?: boolean;
  driftPixels?: number;
}

export interface DirectorFrameState {
  id: string;
  frameIndex: number;
  status: FrameStatus;
  imagePath: string;
  imageBase64?: string;
  auditReport: AuditReport;
  directorOverrides: DirectorOverrides;
  attemptHistory: AttemptInfo[];
}

export interface DirectorSession {
  sessionId: string;
  runId: string;
  moveId: string;
  anchorFrameId: string;
  frames: Record<string, DirectorFrameState>;
  createdAt: string;
  lastModified: string;
  status: SessionStatus;
}
