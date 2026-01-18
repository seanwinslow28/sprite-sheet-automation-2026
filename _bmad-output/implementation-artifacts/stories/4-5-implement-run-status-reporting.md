# Story 4.5: Implement Run Status Reporting

Status: ready-for-dev

---

## Story

**As an** operator,
**I want** to see run status with reason codes,
**So that** I understand what happened during pipeline execution.

---

## Acceptance Criteria

### Status Reporting

1. **Status values** - System reports one of: `in-progress`, `completed`, `stopped`, `failed`
2. **Reason code** - Status includes reason code explaining the status
3. **Aggregate metrics** - Status includes: frames_completed, frames_failed, total_attempts, retry_rate
4. **Atomic persistence** - Status persisted to `state.json` atomically

### Status Details

5. **In-progress details** - Shows current frame, attempt number, elapsed time
6. **Completed details** - Shows success rate, total duration, export location
7. **Stopped details** - Shows stop condition, resume instructions
8. **Failed details** - Shows error type, diagnostic location

---

## Tasks / Subtasks

- [ ] **Task 1: Define RunStatus interface** (AC: #1, #2)
  - [ ] 1.1: Create `RunStatus` type with: `status`, `reason_code`, `message`
  - [ ] 1.2: Define status enum: `in-progress`, `completed`, `stopped`, `failed`
  - [ ] 1.3: Define reason codes for each status type
  - [ ] 1.4: Add to `src/domain/types/run-status.ts`

- [ ] **Task 2: Implement status calculation** (AC: #3)
  - [ ] 2.1: Create `calculateRunStatus(state: RunState): RunStatus`
  - [ ] 2.2: Aggregate: `frames_completed` (approved count)
  - [ ] 2.3: Aggregate: `frames_failed` (failed + rejected count)
  - [ ] 2.4: Aggregate: `total_attempts` (sum of all attempts)
  - [ ] 2.5: Aggregate: `retry_rate` (frames with >1 attempt / total)

- [ ] **Task 3: Implement in-progress status** (AC: #5)
  - [ ] 3.1: Include `current_frame_index`
  - [ ] 3.2: Include `current_attempt` for current frame
  - [ ] 3.3: Calculate `elapsed_time` from run start
  - [ ] 3.4: Estimate `remaining_frames`

- [ ] **Task 4: Implement completed status** (AC: #6)
  - [ ] 4.1: Calculate `success_rate` (approved / total)
  - [ ] 4.2: Calculate `total_duration` from start to end
  - [ ] 4.3: Include `export_location` path
  - [ ] 4.4: Include `atlas_files` list

- [ ] **Task 5: Implement stopped status** (AC: #7)
  - [ ] 5.1: Include `stop_condition` that triggered
  - [ ] 5.2: Include `stop_threshold` and `actual_value`
  - [ ] 5.3: Generate resume command: `pipeline run --resume {run_id}`
  - [ ] 5.4: Include `frames_remaining` count

- [ ] **Task 6: Implement failed status** (AC: #8)
  - [ ] 6.1: Include `error_type` (system error vs. audit failure)
  - [ ] 6.2: Include `error_message` (sanitized, no secrets)
  - [ ] 6.3: Include `diagnostic_path` for detailed error info
  - [ ] 6.4: Include `stack_trace` if available (dev mode only)

- [ ] **Task 7: Implement status persistence** (AC: #4)
  - [ ] 7.1: Update `state.json` with current status after each transition
  - [ ] 7.2: Use atomic write pattern (temp-then-rename)
  - [ ] 7.3: Include timestamp of status change
  - [ ] 7.4: Preserve status history for debugging

- [ ] **Task 8: Implement CLI status output** (AC: all)
  - [ ] 8.1: Create `formatStatusForCLI(status: RunStatus): string`
  - [ ] 8.2: Use colors: green (completed), yellow (in-progress), red (failed/stopped)
  - [ ] 8.3: Format metrics as table or key-value pairs
  - [ ] 8.4: Include progress bar for in-progress runs

- [ ] **Task 9: Write tests** (AC: all)
  - [ ] 9.1: Test status calculation for each state
  - [ ] 9.2: Test aggregate metrics are correct
  - [ ] 9.3: Test status persistence is atomic
  - [ ] 9.4: Test CLI formatting

---

## Dev Notes

### RunStatus Interface

```typescript
interface RunStatus {
  status: 'in-progress' | 'completed' | 'stopped' | 'failed';
  reason_code: string;
  message: string;
  timestamp: string;

  metrics: RunMetrics;
  details: InProgressDetails | CompletedDetails | StoppedDetails | FailedDetails;
}

interface RunMetrics {
  total_frames: number;
  frames_completed: number;
  frames_failed: number;
  frames_remaining: number;
  total_attempts: number;
  retry_rate: number;
  reject_rate: number;
}
```

### Status Details Types

```typescript
interface InProgressDetails {
  current_frame_index: number;
  current_attempt: number;
  elapsed_time_ms: number;
  estimated_remaining_ms?: number;
  current_action?: string;  // e.g., "Generating", "Auditing"
}

interface CompletedDetails {
  success_rate: number;
  total_duration_ms: number;
  export_location: string;
  atlas_files: string[];
  validation_passed: boolean;
}

interface StoppedDetails {
  stop_condition: string;
  threshold: number;
  actual_value: number;
  resume_command: string;
  frames_remaining: number;
}

interface FailedDetails {
  error_type: 'system' | 'dependency' | 'audit';
  error_code: string;
  error_message: string;
  diagnostic_path?: string;
}
```

### Reason Codes

| Status | Reason Code | Description |
|--------|-------------|-------------|
| in-progress | `GENERATING` | Currently generating frame |
| in-progress | `AUDITING` | Currently auditing frame |
| in-progress | `RETRYING` | Executing retry action |
| completed | `ALL_FRAMES_APPROVED` | All frames passed audit |
| completed | `PARTIAL_SUCCESS` | Some frames failed but run completed |
| stopped | `RETRY_RATE_EXCEEDED` | Retry rate > threshold |
| stopped | `REJECT_RATE_EXCEEDED` | Reject rate > threshold |
| stopped | `CONSECUTIVE_FAILS` | Too many consecutive failures |
| stopped | `CIRCUIT_BREAKER` | Total attempts exceeded |
| stopped | `USER_INTERRUPT` | Ctrl+C or SIGTERM |
| failed | `SYS_MANIFEST_INVALID` | Manifest validation failed |
| failed | `DEP_API_UNAVAILABLE` | Gemini API unreachable |
| failed | `DEP_TEXTUREPACKER_FAIL` | TexturePacker error |
| failed | `SYS_WRITE_ERROR` | File system error |

### CLI Output Format (In-Progress)

```
📊 Run Status: abc123
═══════════════════════════════════════════════════════

Status:     🔄 in-progress (GENERATING)
Frame:      3 of 8 (Attempt 2)
Elapsed:    4m 32s
Progress:   [████████░░░░░░░░] 37.5%

Metrics:
  Completed:  2/8 frames
  Failed:     1/8 frames
  Attempts:   7 total
  Retry Rate: 25.0%

Current:    Generating frame 3 with IDENTITY_RESCUE strategy
```

### CLI Output Format (Completed)

```
📊 Run Status: abc123
═══════════════════════════════════════════════════════

Status:     ✅ completed (ALL_FRAMES_APPROVED)
Duration:   12m 45s
Progress:   [████████████████] 100%

Metrics:
  Success:    7/8 frames (87.5%)
  Failed:     1/8 frames
  Attempts:   15 total
  Retry Rate: 37.5%

Export:
  Location:   runs/abc123/export/
  Atlas:      blaze_idle.png, blaze_idle.json
  Validation: ✅ PASSED
```

### Project Structure Notes

- New: `src/domain/types/run-status.ts`
- New: `src/core/status-reporter.ts`
- Modify: `src/core/state-manager.ts` (add status tracking)
- Modify: `src/commands/pipeline/run.ts` (display status)
- Tests: `test/core/status-reporter.test.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.5]
- [Source: stories/4-4-implement-stop-conditions-run-halting.md]

---

## Dev Agent Record

### Agent Model Used

**Codex-CLI**

**Rationale:** Status aggregation and reporting with well-defined outputs. Clear interface definitions and formatting logic. No complex decision trees—straightforward data collection and presentation.

### Debug Log References

*(To be filled during implementation)*

### Completion Notes List

*(To be filled during implementation)*

### File List

*(To be filled during implementation)*
