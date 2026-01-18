# Story 6.4: Implement Artifact Folder Organization

Status: ready-for-dev

---

## Story

**As an** operator,
**I want** approved, rejected, and candidate frames in distinct folders,
**So that** I can easily find and review specific frame categories.

---

## Acceptance Criteria

### Folder Structure

1. **Approved folder** - `approved/` contains only frames that passed all gates
2. **Rejected folder** - `rejected/` contains frames that failed hard gates (with reason in filename)
3. **Candidates folder** - `candidates/` contains all generation attempts
4. **Audit folder** - `audit/` contains all metrics files
5. **README documentation** - Folder structure documented in README within `runs/` directory

---

## Tasks / Subtasks

- [ ] **Task 1: Define folder structure constants** (AC: #1-4)
  - [ ] 1.1: Create `RUN_FOLDERS` constant with all folder names
  - [ ] 1.2: Define folder purposes in comments
  - [ ] 1.3: Ensure consistency across codebase
  - [ ] 1.4: Export from `src/domain/constants.ts`

- [ ] **Task 2: Implement folder creation** (AC: #1-4)
  - [ ] 2.1: Create all required folders at run start
  - [ ] 2.2: Create `approved/`, `rejected/`, `candidates/`, `audit/`, `logs/`, `export/`, `validation/`
  - [ ] 2.3: Use recursive mkdir for safety
  - [ ] 2.4: Verify folder creation before proceeding

- [ ] **Task 3: Implement approved frame handling** (AC: #1)
  - [ ] 3.1: Copy frame to `approved/` when passing audit
  - [ ] 3.2: Use naming: `frame_XXXX.png` (4-digit zero-padded)
  - [ ] 3.3: Verify copy succeeded
  - [ ] 3.4: Log approval with path

- [ ] **Task 4: Implement rejected frame handling** (AC: #2)
  - [ ] 4.1: Move frame to `rejected/` on hard fail
  - [ ] 4.2: Include reason in filename: `frame_XXXX_HF01_DIMENSION_MISMATCH.png`
  - [ ] 4.3: Preserve original candidate in `candidates/`
  - [ ] 4.4: Log rejection with reason

- [ ] **Task 5: Implement candidate tracking** (AC: #3)
  - [ ] 5.1: Save all generation attempts to `candidates/`
  - [ ] 5.2: Use naming: `frame_XXXX_attempt_YY.png`
  - [ ] 5.3: Include normalized versions with `_norm` suffix
  - [ ] 5.4: Never delete candidates (debugging)

- [ ] **Task 6: Implement runs README** (AC: #5)
  - [ ] 6.1: Create `runs/README.md` template
  - [ ] 6.2: Document folder structure
  - [ ] 6.3: Document file naming conventions
  - [ ] 6.4: Copy README to each new run folder

- [ ] **Task 7: Implement cleanup utilities** (AC: all)
  - [ ] 7.1: Create `cleanupOldRuns(maxAge: number)` function
  - [ ] 7.2: Add `pipeline clean` command
  - [ ] 7.3: Never auto-delete runs without confirmation
  - [ ] 7.4: Preserve approved frames separately option

- [ ] **Task 8: Write tests** (AC: all)
  - [ ] 8.1: Test folder structure created correctly
  - [ ] 8.2: Test approved frames go to approved/
  - [ ] 8.3: Test rejected frames include reason in name
  - [ ] 8.4: Test README is created

---

## Dev Notes

### Folder Structure

```
runs/
├── README.md                           # Structure documentation
├── {run_id}/
│   ├── manifest.lock.json              # Resolved configuration
│   ├── state.json                      # Run state (progress, status)
│   ├── summary.json                    # Final statistics
│   ├── diagnostic.json                 # Failure analysis (if stopped)
│   ├── anchor_analysis.json            # Anchor baseline/root extraction
│   │
│   ├── approved/                       # ✅ Frames that passed audit
│   │   ├── frame_0000.png
│   │   ├── frame_0001.png
│   │   └── ...
│   │
│   ├── rejected/                       # ❌ Frames that failed hard gates
│   │   ├── frame_0004_HF_IDENTITY_COLLAPSE.png
│   │   └── frame_0004_HF_IDENTITY_COLLAPSE_metadata.json
│   │
│   ├── candidates/                     # 🔄 All generation attempts
│   │   ├── frame_0000_attempt_01.png
│   │   ├── frame_0000_attempt_01_norm.png
│   │   ├── frame_0001_attempt_01.png
│   │   ├── frame_0001_attempt_02.png
│   │   └── ...
│   │
│   ├── audit/                          # 📊 Quality metrics
│   │   ├── audit_log.jsonl
│   │   ├── frame_0_metrics.json
│   │   ├── frame_0_attempts.json
│   │   ├── frame_1_metrics.json
│   │   └── ...
│   │
│   ├── logs/                           # 📝 Execution logs
│   │   ├── pipeline.log
│   │   ├── texturepacker.log
│   │   └── phaser_tests.log
│   │
│   ├── export/                         # 📦 Final atlas output
│   │   ├── blaze_idle.png
│   │   ├── blaze_idle.json
│   │   └── frame_mapping.json
│   │
│   └── validation/                     # 🧪 Phaser test results
│       ├── test-results.json
│       ├── test-02-pivot.png
│       ├── test-03-jitter.png
│       └── test-04-suffix.png
```

### RUN_FOLDERS Constant

```typescript
export const RUN_FOLDERS = {
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANDIDATES: 'candidates',
  AUDIT: 'audit',
  LOGS: 'logs',
  EXPORT: 'export',
  VALIDATION: 'validation'
} as const;

export const RUN_FILES = {
  MANIFEST_LOCK: 'manifest.lock.json',
  STATE: 'state.json',
  SUMMARY: 'summary.json',
  DIAGNOSTIC: 'diagnostic.json',
  ANCHOR_ANALYSIS: 'anchor_analysis.json',
  AUDIT_LOG: 'audit/audit_log.jsonl'
} as const;
```

### Folder Creation

```typescript
async function createRunFolders(runPath: string): Promise<void> {
  const folders = Object.values(RUN_FOLDERS);

  await Promise.all(
    folders.map(folder =>
      fs.mkdir(path.join(runPath, folder), { recursive: true })
    )
  );

  logger.debug({
    event: 'run_folders_created',
    run_path: runPath,
    folders
  });
}
```

### Rejected Frame Naming

```typescript
function generateRejectedFrameName(
  frameIndex: number,
  reasonCode: string
): string {
  const paddedIndex = frameIndex.toString().padStart(4, '0');
  const sanitizedReason = reasonCode.replace(/[^a-zA-Z0-9_]/g, '_');
  return `frame_${paddedIndex}_${sanitizedReason}.png`;
}

// Examples:
// frame_0004_HF_IDENTITY_COLLAPSE.png
// frame_0006_HF01_DIMENSION_MISMATCH.png
```

### Rejected Frame Metadata

```json
{
  "frame_index": 4,
  "rejected_at": "2026-01-18T14:45:00.000Z",
  "reason_code": "HF_IDENTITY_COLLAPSE",
  "reason_message": "Frame failed identity check after 2 consecutive re-anchors",
  "attempts": 5,
  "last_composite_score": 0.58,
  "suggestion": "Anchor may lack resolution for this pose angle",
  "original_candidate": "candidates/frame_0004_attempt_05.png"
}
```

### README Template

```markdown
# Run Artifacts

This folder contains artifacts from a single pipeline run.

## Folder Structure

| Folder | Contents |
|--------|----------|
| `approved/` | Frames that passed all quality gates |
| `rejected/` | Frames that failed (with reason in filename) |
| `candidates/` | All generation attempts for debugging |
| `audit/` | Quality metrics and attempt history |
| `logs/` | Execution logs |
| `export/` | Final atlas (PNG + JSON) |
| `validation/` | Phaser micro-test results |

## File Naming

- **Approved**: `frame_XXXX.png` (4-digit zero-padded)
- **Rejected**: `frame_XXXX_REASON_CODE.png`
- **Candidates**: `frame_XXXX_attempt_YY.png`
- **Normalized**: `*_norm.png` suffix for post-processed versions

## Key Files

- `state.json` - Run progress and current status
- `summary.json` - Final statistics (generated on completion)
- `diagnostic.json` - Failure analysis (if run stopped)
- `manifest.lock.json` - Resolved configuration snapshot
```

### Project Structure Notes

- New: `src/domain/constants/run-folders.ts`
- New: `assets/templates/runs-readme.md`
- Modify: `src/core/state-manager.ts` (use folder constants)
- Modify: `src/core/orchestrator.ts` (create folders at start)
- Tests: `test/core/folder-structure.test.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.4]
- [Source: _bmad-output/project-context.md#Configuration & Artifacts]

---

## Dev Agent Record

### Agent Model Used

**Codex-CLI**

**Rationale:** File system organization with clear structure. Naming conventions are well-defined. No complex decision logic.

### Debug Log References

*(To be filled during implementation)*

### Completion Notes List

*(To be filled during implementation)*

### File List

*(To be filled during implementation)*
