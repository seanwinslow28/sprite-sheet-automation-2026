# Story 2.2: Implement Manifest Lock File Generation

Status: ready-for-dev

---

## Story

**As an** operator,
**I want** the system to generate a lock file at run start,
**So that** I have a reproducible record of resolved paths and versions.

---

## Acceptance Criteria

1. **Lock file generated** - System generates `manifest.lock.json` in the run directory
2. **Absolute paths resolved** - Lock file contains resolved absolute paths for all input assets
3. **Adapter version recorded** - Lock file records generator adapter version
4. **Model info recorded** - Lock file records model ID and version string (NFR13)
5. **Timestamp recorded** - Lock file records run start timestamp
6. **Atomic writes** - Lock file is written atomically using temp-then-rename pattern (NFR11)

---

## Tasks / Subtasks

- [ ] **Task 1: Create lock file generator** (AC: #1, #2)
  - [ ] 1.1: Create `src/core/lock-file-generator.ts`
  - [ ] 1.2: Define `LockFile` interface matching schema
  - [ ] 1.3: Implement `generateLockFile(manifest: Manifest, runDir: string): Result<LockFile, SystemError>`
  - [ ] 1.4: Resolve all relative paths to absolute paths using `path.resolve()`
  - [ ] 1.5: Verify all resolved paths exist on disk

- [ ] **Task 2: Capture environment info** (AC: #3, #4)
  - [ ] 2.1: Capture Node.js version from `process.version`
  - [ ] 2.2: Capture OS platform from `process.platform`
  - [ ] 2.3: Read generator adapter version from package.json or constant
  - [ ] 2.4: Extract model ID from manifest config
  - [ ] 2.5: Query Gemini API for model version if available (graceful fallback)

- [ ] **Task 3: Add timestamp and run metadata** (AC: #5)
  - [ ] 3.1: Generate ISO 8601 timestamp for `run_start`
  - [ ] 3.2: Generate unique `run_id` (timestamp + short UUID)
  - [ ] 3.3: Include manifest file path (original location)
  - [ ] 3.4: Include manifest hash (SHA256 of content)

- [ ] **Task 4: Implement atomic file write** (AC: #6)
  - [ ] 4.1: Create `src/utils/fs-helpers.ts` with `writeJsonAtomic()`
  - [ ] 4.2: Write to `manifest.lock.json.tmp` first
  - [ ] 4.3: Rename to `manifest.lock.json` after write completes
  - [ ] 4.4: Handle rename failures with proper error codes

- [ ] **Task 5: Implement security redaction** (AC: related to NFR27)
  - [ ] 5.1: Create `redactSecrets(config: object): object`
  - [ ] 5.2: Replace API keys with `[REDACTED]`
  - [ ] 5.3: Replace tokens and credentials
  - [ ] 5.4: Preserve structure for debugging

- [ ] **Task 6: Write tests** (AC: all)
  - [ ] 6.1: Test lock file contains all required fields
  - [ ] 6.2: Test paths are resolved to absolute
  - [ ] 6.3: Test atomic write survives simulated crash
  - [ ] 6.4: Test secrets are properly redacted

---

## Dev Notes

### Lock File Schema (from project-context.md)

```json
{
  "run_id": "20260118_143052_a1b2c3",
  "run_start": "2026-01-18T14:30:52.000Z",
  "manifest_path": "/absolute/path/to/manifest.yaml",
  "manifest_hash": "sha256:abc123...",
  "environment": {
    "node_version": "v22.x.x",
    "os": "win32",
    "adapter_version": "1.0.0",
    "model_id": "gemini-2.0-flash-exp"
  },
  "resolved_config": {
    "identity": { ... },
    "inputs": {
      "anchor": "/absolute/path/to/anchor.png",
      "style_refs": [],
      "pose_refs": [],
      "guides": []
    },
    "generator": {
      "backend": "gemini",
      "model": "gemini-2.0-flash-exp",
      "api_key": "[REDACTED]"
    }
  }
}
```

### Atomic Write Pattern

```typescript
import { rename, writeFile } from 'fs/promises';
import { join } from 'path';

async function writeJsonAtomic(filePath: string, data: object): Promise<void> {
  const tempPath = `${filePath}.tmp`;
  await writeFile(tempPath, JSON.stringify(data, null, 2));
  await rename(tempPath, filePath);
}
```

### Path Resolution

- Use `path.resolve()` for all path conversions
- Handle Windows backslashes correctly
- Store in lock file with forward slashes for consistency

### NFR13 Requirements

Must log:
- Model ID + version
- Generator adapter version
- Full prompts/inputs (redacted)
- Timestamps
- Seeds

### Project Structure Notes

- Lock file generator: `src/core/lock-file-generator.ts`
- FS helpers: `src/utils/fs-helpers.ts`
- Output: `runs/{run_id}/manifest.lock.json`

### References

- [Source: _bmad-output/project-context.md#Configuration & Artifacts]
- [Source: _bmad-output/project-context.md#Architecture Patterns]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.2]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR11, NFR13]

---

## Dev Agent Record

### Agent Model Used

**Codex-CLI**

**Rationale:** Clear spec with well-defined input/output. Read manifest, resolve paths, write lock file atomically. Each step is deterministic with no architectural decisions needed.

### Debug Log References

*(To be filled during implementation)*

### Completion Notes List

*(To be filled during implementation)*

### File List

*(To be filled during implementation)*
