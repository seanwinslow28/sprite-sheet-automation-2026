# Story 7.1: Implement Director Session State Management

Status: ready-for-dev

---

## Story

**As an** operator,
**I want** a robust state object tracking the lifecycle of every frame in Director Mode,
**So that** I can resume reviews and maintain progress across browser sessions.

---

## Acceptance Criteria

### Session Initialization

1. **Session creation** - System creates `DirectorSession` object with sessionId, moveId, anchorFrameId, and frames map
2. **Frame state tracking** - Each frame tracks id, status, imageBase64, auditReport, and directorOverrides
3. **Status values** - Frame status can be: `PENDING | GENERATED | AUDIT_FAIL | AUDIT_WARN | APPROVED`

### Persistence

4. **Session persistence** - Session state persisted to `runs/{run_id}/director_session.json`
5. **Browser survival** - State survives browser refresh
6. **Atomic writes** - Session file uses atomic write pattern for crash safety

---

## Tasks / Subtasks

- [ ] **Task 1: Define DirectorSession schema** (AC: #1, #3)
  - [ ] 1.1: Create `src/domain/types/director-session.ts`
  - [ ] 1.2: Define `DirectorSession` interface with all required fields
  - [ ] 1.3: Define `FrameStatus` enum with all status values
  - [ ] 1.4: Define `DirectorFrameState` interface
  - [ ] 1.5: Create Zod schema for validation

- [ ] **Task 2: Define DirectorOverrides schema** (AC: #2)
  - [ ] 2.1: Define `HumanAlignmentDelta` interface (userOverrideX, userOverrideY)
  - [ ] 2.2: Define `PatchHistory` interface (original, patched, timestamp)
  - [ ] 2.3: Define `DirectorOverrides` interface combining all overrides
  - [ ] 2.4: Add validation rules

- [ ] **Task 3: Implement session creation** (AC: #1, #2)
  - [ ] 3.1: Create `src/core/director-session-manager.ts`
  - [ ] 3.2: Implement `createSession(runId, manifest, frames)` function
  - [ ] 3.3: Generate unique sessionId using crypto
  - [ ] 3.4: Initialize frames map from run state
  - [ ] 3.5: Load audit reports for each frame

- [ ] **Task 4: Implement frame state management** (AC: #2, #3)
  - [ ] 4.1: Implement `updateFrameStatus(frameId, status)` function
  - [ ] 4.2: Implement `updateFrameOverrides(frameId, overrides)` function
  - [ ] 4.3: Implement `getFrameState(frameId)` function
  - [ ] 4.4: Handle status transitions (validate legal transitions)

- [ ] **Task 5: Implement session persistence** (AC: #4, #5, #6)
  - [ ] 5.1: Implement `saveSession()` with atomic writes
  - [ ] 5.2: Use temp-then-rename pattern for crash safety
  - [ ] 5.3: Save after each state change
  - [ ] 5.4: Include lastModified timestamp

- [ ] **Task 6: Implement session loading** (AC: #5)
  - [ ] 6.1: Implement `loadSession(runId)` function
  - [ ] 6.2: Validate session data against Zod schema
  - [ ] 6.3: Handle missing/corrupted session file
  - [ ] 6.4: Restore full state from disk

- [ ] **Task 7: Implement session lifecycle** (AC: #1-6)
  - [ ] 7.1: Implement `initializeOrResumeSession(runId)` entry point
  - [ ] 7.2: Detect existing session and offer resume
  - [ ] 7.3: Implement `commitSession()` for final export
  - [ ] 7.4: Implement `discardSession()` for cancel

- [ ] **Task 8: Write tests** (AC: all)
  - [ ] 8.1: Test session creation with valid manifest
  - [ ] 8.2: Test frame status transitions
  - [ ] 8.3: Test persistence and reload
  - [ ] 8.4: Test session survives simulated browser refresh

---

## Dev Notes

### DirectorSession Interface

```typescript
interface DirectorSession {
  sessionId: string;           // Unique identifier (UUID)
  runId: string;               // Reference to pipeline run
  moveId: string;              // Current move being reviewed
  anchorFrameId: string;       // Reference to Frame 0
  frames: Map<number, DirectorFrameState>;
  createdAt: string;           // ISO timestamp
  lastModified: string;        // ISO timestamp
  status: 'active' | 'committed' | 'discarded';
}

type FrameStatus =
  | 'PENDING'      // Not yet processed
  | 'GENERATED'    // Generated but not audited
  | 'AUDIT_FAIL'   // Failed hard or soft gates
  | 'AUDIT_WARN'   // Auto-aligned, needs review
  | 'APPROVED';    // Passed audit or human verified

interface DirectorFrameState {
  id: string;                  // Unique frame identifier
  frameIndex: number;          // 0-based index
  status: FrameStatus;
  imagePath: string;           // Path to current image file
  imageBase64?: string;        // Base64 for UI (loaded on demand)
  auditReport: AuditReport;    // Flags and scores from Auditor
  directorOverrides: DirectorOverrides;
  attemptHistory: AttemptInfo[];
}

interface DirectorOverrides {
  alignment?: HumanAlignmentDelta;
  isPatched: boolean;
  patchHistory: PatchHistoryEntry[];
  notes?: string;              // Operator notes
}

interface HumanAlignmentDelta {
  frameId: string;
  userOverrideX: number;       // Horizontal adjustment (pixels)
  userOverrideY: number;       // Vertical adjustment (pixels)
  timestamp: string;           // When adjustment was made
}

interface PatchHistoryEntry {
  originalPath: string;
  patchedPath: string;
  maskPath: string;
  prompt: string;
  timestamp: string;
}
```

### Session File Structure

```json
{
  "sessionId": "d290f1ee-6c54-4b01-90e6-d701748f0851",
  "runId": "20260118_blaze_idle_abc123",
  "moveId": "idle_standard",
  "anchorFrameId": "frame_0000",
  "status": "active",
  "createdAt": "2026-01-18T12:00:00.000Z",
  "lastModified": "2026-01-18T12:30:00.000Z",
  "frames": {
    "0": {
      "id": "frame_0000",
      "frameIndex": 0,
      "status": "APPROVED",
      "imagePath": "runs/abc123/approved/frame_0000.png",
      "auditReport": {
        "composite_score": 0.92,
        "flags": [],
        "passed": true
      },
      "directorOverrides": {
        "isPatched": false,
        "patchHistory": []
      }
    },
    "1": {
      "id": "frame_0001",
      "frameIndex": 1,
      "status": "AUDIT_WARN",
      "imagePath": "runs/abc123/candidates/frame_0001_attempt_01_norm.png",
      "auditReport": {
        "composite_score": 0.78,
        "flags": ["SF01_IDENTITY_DRIFT"],
        "passed": false,
        "auto_aligned": true,
        "drift_pixels": 4
      },
      "directorOverrides": {
        "alignment": {
          "frameId": "frame_0001",
          "userOverrideX": -2,
          "userOverrideY": 0,
          "timestamp": "2026-01-18T12:25:00.000Z"
        },
        "isPatched": false,
        "patchHistory": []
      }
    }
  }
}
```

### Session Manager Implementation

```typescript
class DirectorSessionManager {
  private session: DirectorSession | null = null;
  private sessionPath: string;

  constructor(private runId: string, private runPath: string) {
    this.sessionPath = path.join(runPath, 'director_session.json');
  }

  async initializeOrResume(): Promise<DirectorSession> {
    if (await fs.pathExists(this.sessionPath)) {
      return this.loadSession();
    }
    return this.createSession();
  }

  private async createSession(): Promise<DirectorSession> {
    const session: DirectorSession = {
      sessionId: crypto.randomUUID(),
      runId: this.runId,
      moveId: '', // Set from manifest
      anchorFrameId: 'frame_0000',
      frames: new Map(),
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      status: 'active'
    };

    await this.saveSession(session);
    this.session = session;
    return session;
  }

  async updateFrameStatus(frameIndex: number, status: FrameStatus): Promise<void> {
    if (!this.session) throw new Error('No active session');

    const frame = this.session.frames.get(frameIndex);
    if (!frame) throw new Error(`Frame ${frameIndex} not found`);

    frame.status = status;
    this.session.lastModified = new Date().toISOString();

    await this.saveSession(this.session);
  }

  private async saveSession(session: DirectorSession): Promise<void> {
    // Atomic write with temp-then-rename
    const tempPath = `${this.sessionPath}.tmp`;
    const data = JSON.stringify(sessionToJson(session), null, 2);

    await fs.writeFile(tempPath, data, 'utf-8');
    await fs.rename(tempPath, this.sessionPath);
  }
}

// Serialization helpers (Map -> Object for JSON)
function sessionToJson(session: DirectorSession): object {
  return {
    ...session,
    frames: Object.fromEntries(session.frames)
  };
}

function jsonToSession(json: object): DirectorSession {
  return {
    ...json,
    frames: new Map(Object.entries(json.frames))
  } as DirectorSession;
}
```

### Status Transitions

| From | To | Trigger |
|------|-----|---------|
| PENDING | GENERATED | Frame generation complete |
| GENERATED | AUDIT_FAIL | Audit hard/soft gate failure |
| GENERATED | AUDIT_WARN | Audit pass with auto-align |
| GENERATED | APPROVED | Audit pass, no issues |
| AUDIT_FAIL | APPROVED | Human override/patch |
| AUDIT_WARN | APPROVED | Human review/nudge |

### Project Structure Notes

- New: `src/domain/types/director-session.ts`
- New: `src/core/director-session-manager.ts`
- New: `runs/{run_id}/director_session.json` (per-run)
- Tests: `test/core/director-session-manager.test.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.1]
- [Source: _bmad-output/project-context.md#Architecture Patterns]

---

## Dev Agent Record

### Agent Model Used

**Claude-Code**

**Rationale:** Complex state management with session lifecycle, persistence, and resume capabilities. Core architectural component requiring careful design of state transitions and crash recovery patterns.

### Debug Log References

*(To be filled during implementation)*

### Completion Notes List

*(To be filled during implementation)*

### File List

*(To be filled during implementation)*
