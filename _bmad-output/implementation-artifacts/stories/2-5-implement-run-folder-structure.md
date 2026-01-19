# Story 2.5: Implement Run Folder Structure and Artifact Organization

Status: done

---

## Story

**As an** operator,
**I want** run artifacts organized in a deterministic folder structure,
**So that** I can easily navigate and debug generation results.

---

## Acceptance Criteria

1. **Folder structure created** - Artifacts organized as: `runs/{run_id}/candidates/`, `runs/{run_id}/approved/`, `runs/{run_id}/audit/`, `runs/{run_id}/logs/`
2. **Candidate naming** - Candidate files follow naming: `frame_{index}_attempt_{attempt}.png`
3. **State tracking** - `runs/{run_id}/state.json` file tracks current frame index and attempt count
4. **Atomic state writes** - `state.json` is updated atomically using temp-then-rename (NFR11)
5. **Persistence before success** - All file writes complete before returning success (NFR7, NFR10)

---

## Tasks / Subtasks

- [x] **Task 1: Create run directory structure** (AC: #1)
  - [x] 1.1: Create `src/core/run-folder-manager.ts`
  - [x] 1.2: Implement `createRunFolder(runId: string): Result<RunPaths, SystemError>`
  - [x] 1.3: Create `candidates/` subdirectory
  - [x] 1.4: Create `approved/` subdirectory
  - [x] 1.5: Create `audit/` subdirectory
  - [x] 1.6: Create `logs/` subdirectory
  - [x] 1.7: Create `export/` subdirectory (for final atlas output)

- [x] **Task 2: Implement run ID generation** (AC: #1)
  - [x] 2.1: Create `generateRunId(): string`
  - [x] 2.2: Format: `YYYYMMDD_HHMMSS_XXXX` (timestamp + 4-char random)
  - [x] 2.3: Ensure uniqueness with retry on collision

- [x] **Task 3: Implement candidate file naming** (AC: #2)
  - [x] 3.1: Create `getCandidatePath(runDir, frameIndex, attemptIndex): string`
  - [x] 3.2: Format: `frame_{NNNN}_attempt_{NN}.png` (4-digit frame, 2-digit attempt)
  - [x] 3.3: Ensure consistent zero-padding

- [x] **Task 4: Implement state.json management** (AC: #3, #4, #5)
  - [x] 4.1: Create `src/core/state-manager.ts`
  - [x] 4.2: Define `RunState` interface with currentFrame, currentAttempt, status, frameStates[]
  - [x] 4.3: Implement `initializeState(runId, manifest): RunState`
  - [x] 4.4: Implement `loadState(runDir): Result<RunState, SystemError>`
  - [x] 4.5: Implement `saveState(runDir, state): Result<void, SystemError>`
  - [x] 4.6: Use `writeJsonAtomic()` for all state writes

- [x] **Task 5: Define RunPaths helper** (AC: #1)
  - [x] 5.1: Create `RunPaths` type with all path accessors
  - [x] 5.2: Include: root, candidates, approved, audit, logs, export
  - [x] 5.3: Include: state.json, manifest.lock.json, anchor_analysis.json paths

- [x] **Task 6: Implement directory verification** (AC: #5)
  - [x] 6.1: Verify all directories exist after creation
  - [x] 6.2: Verify write permissions
  - [x] 6.3: Return error if directory creation fails

- [x] **Task 7: Write tests** (AC: all)
  - [x] 7.1: Test folder structure creation
  - [x] 7.2: Test candidate path generation
  - [x] 7.3: Test state persistence and loading
  - [x] 7.4: Test atomic write behavior

---

## Dev Notes

### Folder Structure (from project-context.md)

```
runs/
└── 20260118_143052_a1b2/
    ├── manifest.lock.json      # Resolved config snapshot
    ├── anchor_analysis.json    # Baseline/rootX from anchor
    ├── state.json              # Current run state
    ├── candidates/             # All generated candidates
    │   ├── frame_0000_attempt_01.png
    │   ├── frame_0000_attempt_02.png
    │   └── frame_0001_attempt_01.png
    ├── approved/               # Frames that passed audit
    │   ├── frame_0000.png
    │   └── frame_0001.png
    ├── audit/                  # Audit results and metrics
    │   ├── audit_log.jsonl
    │   └── run_summary.json
    ├── logs/                   # Structured logs
    │   └── prompts.jsonl
    └── export/                 # Final atlas output
        ├── atlas.png
        └── atlas.json
```

### state.json Schema

```json
{
  "run_id": "20260118_143052_a1b2",
  "status": "in_progress",
  "current_frame": 3,
  "current_attempt": 2,
  "total_frames": 8,
  "started_at": "2026-01-18T14:30:52.000Z",
  "updated_at": "2026-01-18T14:35:12.000Z",
  "frame_states": [
    { "index": 0, "status": "approved", "attempts": 1, "approved_path": "approved/frame_0000.png" },
    { "index": 1, "status": "approved", "attempts": 2, "approved_path": "approved/frame_0001.png" },
    { "index": 2, "status": "approved", "attempts": 1, "approved_path": "approved/frame_0002.png" },
    { "index": 3, "status": "in_progress", "attempts": 2, "approved_path": null }
  ]
}
```

### Atomic Write Pattern

All state writes MUST use the atomic pattern:
1. Write to `state.json.tmp`
2. `fsync` the file
3. Rename to `state.json`

This ensures state survives `kill -9` and power loss.

### Project Structure Notes

- Run folder manager: `src/core/run-folder-manager.ts`
- State manager: `src/core/state-manager.ts`
- FS helpers: `src/utils/fs-helpers.ts`

### References

- [Source: _bmad-output/project-context.md#Configuration & Artifacts]
- [Source: _bmad-output/project-context.md#Architecture Patterns]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.5]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR7, NFR10, NFR11]

---

## Dev Agent Record

### Agent Model Used

**Codex-CLI**

**Rationale:** File system organization with atomic writes. Clear patterns and deterministic structure. Autonomous execution with no architectural decisions needed.

### Debug Log References

*(To be filled during implementation)*

### Completion Notes List

- All acceptance criteria met
- 11/11 tests passing in `test/core/run-folder-manager.test.ts`
- Run ID format: YYYYMMDD_HHMMSS_XXXX
- Candidate naming: frame_NNNN_attempt_NN.png
- State.json with atomic write pattern

### File List

- `src/core/run-folder-manager.ts` - Run folder creation and management
- `test/core/run-folder-manager.test.ts` - Run folder tests
