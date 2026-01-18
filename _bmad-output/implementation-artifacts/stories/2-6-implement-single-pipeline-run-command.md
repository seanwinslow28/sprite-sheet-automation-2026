# Story 2.6: Implement Single Pipeline Run Command

Status: ready-for-dev

---

## Story

**As an** operator,
**I want** to invoke a single pipeline run from a manifest file via CLI,
**So that** I can generate frames for one character move.

---

## Acceptance Criteria

1. **Manifest validation** - System validates the manifest (Story 2.1)
2. **Lock file generated** - Generates the lock file (Story 2.2)
3. **Run folder created** - Creates the run folder structure (Story 2.5)
4. **Frame 0 generated** - Generates Frame 0 using edit-from-anchor mode (Story 2.3)
5. **Candidate saved** - Saves the candidate to `candidates/frame_0_attempt_1.png`
6. **Metrics logged** - Logs generation metrics (duration, prompt hash) to structured JSON
7. **Status reported** - Reports run status to console with run ID
8. **Rate limits respected** - Respects rate limits and logs wait time if throttled (NFR21)

---

## Tasks / Subtasks

- [ ] **Task 1: Create run command** (AC: #1, #7)
  - [ ] 1.1: Create `src/commands/run.ts` using Commander.js command handler
  - [ ] 1.2: Accept manifest path as positional argument
  - [ ] 1.3: Add `--dry-run` flag to validate without generating
  - [ ] 1.4: Add `--verbose` flag for detailed output
  - [ ] 1.5: Display run ID and status on completion

- [ ] **Task 2: Implement run orchestration** (AC: #1, #2, #3)
  - [ ] 2.1: Create `src/core/pipeline-runner.ts`
  - [ ] 2.2: Load and validate manifest (call Story 2.1 validator)
  - [ ] 2.3: Generate run ID and create folder structure (Story 2.5)
  - [ ] 2.4: Generate lock file (Story 2.2)
  - [ ] 2.5: Run anchor analysis (Story 2.7 - if implemented)
  - [ ] 2.6: Return `Result<RunContext, PipelineError>`

- [ ] **Task 3: Implement frame 0 generation** (AC: #4, #5)
  - [ ] 3.1: Call Gemini generator adapter with anchor-only context (Story 2.3)
  - [ ] 3.2: Save candidate using atomic write
  - [ ] 3.3: Update state.json with frame status
  - [ ] 3.4: Log candidate path to console

- [ ] **Task 4: Implement metrics logging** (AC: #6)
  - [ ] 4.1: Create `src/utils/metrics-logger.ts`
  - [ ] 4.2: Capture generation start/end timestamps
  - [ ] 4.3: Calculate duration in milliseconds
  - [ ] 4.4: Compute prompt hash (SHA256 of prompt text)
  - [ ] 4.5: Log to `runs/{run_id}/logs/metrics.jsonl`

- [ ] **Task 5: Implement rate limit handling** (AC: #8)
  - [ ] 5.1: Detect 429 responses from Gemini API
  - [ ] 5.2: Extract retry-after header if present
  - [ ] 5.3: Log wait time to console
  - [ ] 5.4: Wait and retry automatically
  - [ ] 5.5: Count rate limit hits in metrics

- [ ] **Task 6: Implement console output** (AC: #7)
  - [ ] 6.1: Display run ID at start
  - [ ] 6.2: Display progress: "Generating frame 0..."
  - [ ] 6.3: Display success: "Frame 0 saved to candidates/frame_0000_attempt_01.png"
  - [ ] 6.4: Display summary on completion
  - [ ] 6.5: Use Pino for structured logging underneath

- [ ] **Task 7: Write tests** (AC: all)
  - [ ] 7.1: Integration test with sample manifest
  - [ ] 7.2: Test dry-run mode
  - [ ] 7.3: Test rate limit handling with mocked API
  - [ ] 7.4: Test error handling for invalid manifest

---

## Dev Notes

### Command Interface

```bash
# Basic usage
pipeline run manifests/blaze-idle.yaml

# With options
pipeline run manifests/blaze-idle.yaml --dry-run
pipeline run manifests/blaze-idle.yaml --verbose

# Expected output
Run ID: 20260118_143052_a1b2
Loading manifest: manifests/blaze-idle.yaml
✓ Manifest validated
✓ Lock file generated
✓ Run folder created
Generating frame 0...
✓ Frame 0 saved (duration: 12.3s)
Run complete: 1 frame generated
```

### Pipeline Flow (MVP - Single Frame)

```
1. Load manifest → validate
2. Generate run ID
3. Create run folder structure
4. Generate lock file
5. Analyze anchor (if 2.7 implemented)
6. Generate Frame 0:
   a. Build prompt with Semantic Interleaving
   b. Call Gemini API
   c. Save candidate
   d. Update state.json
7. Report status
```

### Metrics Log Entry

```json
{
  "timestamp": "2026-01-18T14:30:52.000Z",
  "event": "frame_generated",
  "frame_index": 0,
  "attempt_index": 1,
  "duration_ms": 12345,
  "prompt_hash": "sha256:abc123...",
  "candidate_path": "candidates/frame_0000_attempt_01.png",
  "rate_limit_waits": 0
}
```

### Error Codes

- `PIPELINE_MANIFEST_INVALID` - Manifest validation failed
- `PIPELINE_FOLDER_CREATE_FAILED` - Could not create run folder
- `PIPELINE_GENERATION_FAILED` - Frame generation failed
- `PIPELINE_RATE_LIMITED` - Rate limited (recoverable)

### Integration Points

This command integrates:
- Story 2.1: Manifest validation
- Story 2.2: Lock file generation
- Story 2.3: Gemini generator
- Story 2.5: Run folder structure

### Project Structure Notes

- Command: `src/commands/run.ts`
- Pipeline runner: `src/core/pipeline-runner.ts`
- Metrics logger: `src/utils/metrics-logger.ts`

### References

- [Source: _bmad-output/project-context.md#Architecture Patterns]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.6]
- [Source: _bmad-output/planning-artifacts/prd.md#FR1, NFR21]

---

## Dev Agent Record

### Agent Model Used

**Claude-Code**

**Rationale:** Orchestration command connecting multiple components (Stories 2.1, 2.2, 2.3, 2.5). Integration complexity requires Claude's multi-file awareness and ability to coordinate between different system parts.

### Debug Log References

*(To be filled during implementation)*

### Completion Notes List

*(To be filled during implementation)*

### File List

*(To be filled during implementation)*
