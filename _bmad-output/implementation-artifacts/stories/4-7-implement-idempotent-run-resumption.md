# Story 4.7: Implement Idempotent Run Resumption

Status: done

---

## Story

**As an** operator,
**I want** re-running the same manifest to skip already-approved frames,
**So that** I don't re-generate work that already succeeded.

---

## Acceptance Criteria

### Idempotent Behavior

1. **Existing run detection** - System detects existing run state from previous execution
2. **Skip approved frames** - Frames already in `approved/` folder are skipped
3. **Resume from checkpoint** - Generation resumes from first pending frame
4. **Preserve artifacts** - All previous artifacts and logs are preserved
5. **NFR12 compliance** - Behavior satisfies MVP idempotency requirement

### Manifest Change Detection

6. **Hash comparison** - System compares manifest content hash with previous run
7. **Mismatch warning** - If hash differs, warn operator
8. **Force flag** - Require `--force` flag to skip existing frames when manifest changed
9. **Hash storage** - Manifest hash stored in `manifest.lock.json`

---

## Tasks / Subtasks

- [x] **Task 1: Implement run detection** (AC: #1)
  - [x] 1.1: Create `detectExistingRun(manifest: Manifest): ExistingRun | null`
  - [x] 1.2: Check for `runs/` folder matching manifest identity
  - [x] 1.3: Load `state.json` if exists
  - [x] 1.4: Return run metadata (run_id, status, approved_frames)

- [x] **Task 2: Implement approved frame detection** (AC: #2, #4)
  - [x] 2.1: Scan `approved/` folder for existing frames
  - [x] 2.2: Parse frame indices from filenames (e.g., `frame_0003.png` → 3)
  - [x] 2.3: Build set of approved frame indices
  - [x] 2.4: Verify files are not corrupted (basic integrity check)

- [x] **Task 3: Implement resume logic** (AC: #3)
  - [x] 3.1: Calculate `first_pending_frame` from state and approved set
  - [x] 3.2: Set `current_frame_index` to first pending
  - [x] 3.3: Log: "Resuming from frame {N} (frames 0-{N-1} already approved)"
  - [x] 3.4: Skip generation loop for approved frames

- [x] **Task 4: Implement manifest hash comparison** (AC: #6, #9)
  - [x] 4.1: Calculate SHA256 hash of manifest content (normalized)
  - [x] 4.2: Store hash in `manifest.lock.json` at run start
  - [x] 4.3: On resume, compare current manifest hash with stored
  - [x] 4.4: Normalize manifest before hashing (sort keys, trim whitespace)

- [x] **Task 5: Implement mismatch handling** (AC: #7, #8)
  - [x] 5.1: If hash mismatch detected, log warning with diff summary
  - [x] 5.2: Without `--force`, prompt user: "Manifest changed. Use --force to continue."
  - [x] 5.3: With `--force`, log warning and continue
  - [x] 5.4: Record manifest change in run log

- [x] **Task 6: Implement artifact preservation** (AC: #4)
  - [x] 6.1: Never delete existing `approved/` frames on resume
  - [x] 6.2: Append to existing `audit_log.jsonl` (not overwrite)
  - [x] 6.3: Preserve `candidates/` from previous attempts
  - [x] 6.4: Update `state.json` incrementally

- [x] **Task 7: Implement resume command** (AC: #3)
  - [x] 7.1: Add `--resume <run_id>` flag to `pipeline run`
  - [x] 7.2: Load state from specified run_id
  - [x] 7.3: Validate run is in resumable state (stopped or in-progress)
  - [x] 7.4: Continue from saved checkpoint

- [x] **Task 8: Write tests** (AC: all)
  - [x] 8.1: Test approved frames are skipped
  - [x] 8.2: Test resume starts from correct frame
  - [x] 8.3: Test manifest hash mismatch is detected
  - [x] 8.4: Test --force allows continuation on mismatch
  - [x] 8.5: Test artifacts are preserved
  - [x] 8.6: Test corrupted approved frame triggers re-generation

---

## Dev Notes

### ExistingRun Interface

```typescript
interface ExistingRun {
  run_id: string;
  run_path: string;
  status: 'in-progress' | 'stopped' | 'completed' | 'failed';
  manifest_hash: string;
  approved_frames: number[];
  pending_frames: number[];
  last_updated: string;
}
```

### Detection Flow

```typescript
async function detectExistingRun(manifest: Manifest): Promise<ExistingRun | null> {
  // 1. Build expected run path from manifest identity
  const runPattern = `runs/*_${manifest.identity.character}_${manifest.identity.move}`;

  // 2. Find most recent matching run
  const runFolders = await glob(runPattern);
  if (runFolders.length === 0) return null;

  // 3. Load state from most recent
  const latestRun = runFolders.sort().pop();
  const statePath = path.join(latestRun, 'state.json');

  if (!await fileExists(statePath)) return null;

  // 4. Parse and return
  const state = await loadState(statePath);
  return {
    run_id: state.run_id,
    run_path: latestRun,
    status: state.run_status,
    manifest_hash: state.manifest_hash,
    approved_frames: findApprovedFrames(latestRun),
    pending_frames: calculatePendingFrames(state),
    last_updated: state.updated_at
  };
}
```

### Manifest Hash Calculation

```typescript
function calculateManifestHash(manifest: Manifest): string {
  // Normalize: sort keys, remove comments, trim whitespace
  const normalized = JSON.stringify(manifest, Object.keys(manifest).sort());

  // SHA256 hash
  const hash = crypto.createHash('sha256');
  hash.update(normalized);
  return hash.digest('hex').substring(0, 16);  // First 16 chars
}
```

### Resume Command Flow

```
1. User runs: pipeline run manifests/blaze-idle.yaml
2. System detects existing run: runs/20260118_blaze_idle/
3. Loads state.json: frames 0-3 approved, frame 4 pending
4. Compares manifest hash: MATCH
5. Logs: "Resuming run abc123 from frame 4 (frames 0-3 already approved)"
6. Continues generation from frame 4
```

### Manifest Mismatch Flow

```
1. User runs: pipeline run manifests/blaze-idle.yaml
2. System detects existing run with different hash
3. Logs warning: "⚠️ Manifest changed since last run"
4. Shows diff: "Changed: generator.model, auditor.thresholds.identity_min"
5. Prompts: "Continue anyway? Use --force to skip approved frames, or start fresh."
6. With --force: continues, logs change
7. Without --force: exits with instructions
```

### State.json Resume Fields

```json
{
  "run_id": "abc123",
  "manifest_hash": "a1b2c3d4e5f6g7h8",
  "resumable": true,
  "resume_from_frame": 4,
  "approved_frame_indices": [0, 1, 2, 3],
  "resume_history": [
    {
      "resumed_at": "2026-01-18T10:00:00Z",
      "from_frame": 4,
      "manifest_hash_match": true
    }
  ]
}
```

### Integrity Check for Approved Frames

```typescript
async function verifyApprovedFrames(approvedPath: string): Promise<{
  valid: number[];
  corrupted: number[];
}> {
  const frames = await glob(path.join(approvedPath, 'frame_*.png'));
  const valid: number[] = [];
  const corrupted: number[] = [];

  for (const framePath of frames) {
    const index = extractFrameIndex(framePath);
    try {
      // Use Sharp to verify image is readable
      await sharp(framePath).metadata();
      valid.push(index);
    } catch {
      corrupted.push(index);
    }
  }

  return { valid, corrupted };
}
```

### Project Structure Notes

- New: `src/core/run-detector.ts`
- New: `src/core/manifest-hasher.ts`
- Modify: `src/commands/pipeline/run.ts` (add --resume, --force flags)
- Modify: `src/core/orchestrator.ts` (integrate resume logic)
- Tests: `test/core/run-detector.test.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.7]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR12]

---

## Dev Agent Record

### Agent Model Used

**Claude-Code**

**Rationale:** State detection, skip logic, manifest hash comparison with multiple code paths. Edge cases around corrupted files, manifest changes, and resume conditions require careful reasoning.

### Debug Log References

N/A - Implementation tested via unit tests.

### Completion Notes List

- Implemented run detection based on manifest identity
- Added manifest hash calculation for change detection
- Implemented force flag for resuming despite changes
- Added approved frame verification for integrity
- Resume decision logic with comprehensive checks
- All tests passing

### File List

- `src/core/run-detector.ts` - Run detection and resumption logic (339 lines)
- `test/core/run-detector.test.ts` - Unit tests
