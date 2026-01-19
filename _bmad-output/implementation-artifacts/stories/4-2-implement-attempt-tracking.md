# Story 4.2: Implement Attempt Tracking and Max Attempts Enforcement

Status: done

---

## Story

**As an** operator,
**I want** the system to track attempts per frame and stop when max is reached,
**So that** the pipeline doesn't loop infinitely on problematic frames.

---

## Acceptance Criteria

### Attempt Counting

1. **Attempt counter** - System tracks `attempt_count` in `state.json` per frame
2. **Counter increment** - Counter increments after each generation attempt
3. **Max attempts enforcement** - When `attempt_count >= max_attempts_per_frame`, frame is marked as `failed`
4. **Pipeline continues** - After max attempts, pipeline moves to next frame (or triggers stop condition)
5. **Attempt history** - Attempt history preserved in audit artifacts

### Configuration

6. **Manifest config** - Read `generator.max_attempts_per_frame` from manifest
7. **Default value** - Default to 5 attempts if not specified
8. **Circuit breaker** - Global circuit breaker at 50 total attempts per run

---

## Tasks / Subtasks

- [x] **Task 1: Extend state schema for attempt tracking** (AC: #1, #5)
  - [x] 1.1: Add `frame_attempts: Record<number, AttemptRecord[]>` to state schema
  - [x] 1.2: Define `AttemptRecord` interface with: `attempt_index`, `timestamp`, `result`, `reason_code`
  - [x] 1.3: Update Zod schema in `src/domain/schemas/state-schema.ts`
  - [x] 1.4: Ensure backwards compatibility with existing state files

- [x] **Task 2: Implement attempt counter logic** (AC: #1, #2)
  - [x] 2.1: Create `getAttemptCount(frameIndex: number): number`
  - [x] 2.2: Create `incrementAttempt(frameIndex: number, result: AttemptResult): void`
  - [x] 2.3: Store attempt with timestamp and outcome
  - [x] 2.4: Use atomic write for state update

- [x] **Task 3: Implement max attempts check** (AC: #3, #6, #7)
  - [x] 3.1: Read `generator.max_attempts_per_frame` from resolved manifest
  - [x] 3.2: Default to 5 if not specified
  - [x] 3.3: Create `isMaxAttemptsReached(frameIndex: number): boolean`
  - [x] 3.4: Return true when `attempt_count >= max_attempts_per_frame`

- [x] **Task 4: Implement frame failure handling** (AC: #3, #4)
  - [x] 4.1: When max attempts reached, mark frame as `status: 'failed'`
  - [x] 4.2: Record final reason: "MAX_ATTEMPTS_REACHED"
  - [x] 4.3: Log warning with frame index and attempt count
  - [x] 4.4: Move to next frame in sequence

- [x] **Task 5: Implement circuit breaker** (AC: #8)
  - [x] 5.1: Track `total_attempts` across entire run
  - [x] 5.2: Check against circuit breaker limit (50)
  - [x] 5.3: If exceeded, trigger run halt with `CIRCUIT_BREAKER_TRIPPED`
  - [x] 5.4: Log estimated API cost at circuit breaker: "~$0.20 risk per run"

- [x] **Task 6: Implement attempt history logging** (AC: #5)
  - [x] 6.1: Write attempt details to `audit/frame_{N}_attempts.json`
  - [x] 6.2: Include all attempts with: index, timestamp, prompt_hash, result, metrics
  - [x] 6.3: Preserve full history even after approval
  - [x] 6.4: Use atomic write pattern

- [x] **Task 7: Integrate with orchestrator** (AC: #4)
  - [x] 7.1: Before generation, check if max attempts reached
  - [x] 7.2: After audit failure, increment attempt counter
  - [x] 7.3: After approval, reset attempt tracking for next frame
  - [x] 7.4: Handle transition from failed frame to next frame

- [x] **Task 8: Write tests** (AC: all)
  - [x] 8.1: Test attempt counter increments correctly
  - [x] 8.2: Test max attempts triggers failure
  - [x] 8.3: Test pipeline continues after frame failure
  - [x] 8.4: Test circuit breaker triggers at 50 attempts
  - [x] 8.5: Test attempt history is preserved

---

## Dev Notes

### AttemptRecord Interface

```typescript
interface AttemptRecord {
  attempt_index: number;      // 1-based attempt number
  timestamp: string;          // ISO 8601
  prompt_hash: string;        // Hash of prompt used
  seed?: number;              // Seed used (if applicable)
  result: 'pending' | 'passed' | 'soft_fail' | 'hard_fail';
  reason_codes: string[];     // e.g., ['SF01_IDENTITY_DRIFT']
  composite_score?: number;   // Audit score if available
  duration_ms: number;        // Time for generation + audit
}
```

### Frame State Extension

```typescript
interface FrameState {
  index: number;
  status: 'pending' | 'generating' | 'auditing' | 'approved' | 'failed';
  attempts: AttemptRecord[];
  current_attempt: number;
  approved_path?: string;
  failed_reason?: string;
}
```

### State.json Example

```json
{
  "run_id": "abc123",
  "current_frame_index": 3,
  "total_attempts": 12,
  "frame_states": {
    "0": {
      "status": "approved",
      "attempts": [
        { "attempt_index": 1, "result": "passed", "composite_score": 0.92 }
      ],
      "approved_path": "runs/abc123/approved/frame_0000.png"
    },
    "1": {
      "status": "approved",
      "attempts": [
        { "attempt_index": 1, "result": "soft_fail", "reason_codes": ["SF01"] },
        { "attempt_index": 2, "result": "passed", "composite_score": 0.85 }
      ],
      "approved_path": "runs/abc123/approved/frame_0001.png"
    },
    "2": {
      "status": "failed",
      "attempts": [
        { "attempt_index": 1, "result": "soft_fail" },
        { "attempt_index": 2, "result": "soft_fail" },
        { "attempt_index": 3, "result": "soft_fail" },
        { "attempt_index": 4, "result": "soft_fail" },
        { "attempt_index": 5, "result": "soft_fail" }
      ],
      "failed_reason": "MAX_ATTEMPTS_REACHED"
    }
  }
}
```

### Circuit Breaker Calculation

```typescript
const CIRCUIT_BREAKER_LIMIT = 50;
const ESTIMATED_COST_PER_ATTEMPT = 0.004; // $0.004 per generation

function checkCircuitBreaker(totalAttempts: number): boolean {
  if (totalAttempts >= CIRCUIT_BREAKER_LIMIT) {
    const estimatedCost = totalAttempts * ESTIMATED_COST_PER_ATTEMPT;
    logger.warn({
      event: 'circuit_breaker_tripped',
      total_attempts: totalAttempts,
      estimated_cost: `$${estimatedCost.toFixed(2)}`,
      limit: CIRCUIT_BREAKER_LIMIT
    });
    return true;
  }
  return false;
}
```

### Attempt History File (audit/frame_3_attempts.json)

```json
{
  "frame_index": 3,
  "total_attempts": 5,
  "final_status": "failed",
  "attempts": [
    {
      "attempt_index": 1,
      "timestamp": "2026-01-18T10:30:00.000Z",
      "prompt_hash": "abc123...",
      "seed": 42,
      "result": "soft_fail",
      "reason_codes": ["SF01_IDENTITY_DRIFT"],
      "composite_score": 0.58,
      "duration_ms": 4500,
      "strategy": "default"
    },
    {
      "attempt_index": 2,
      "timestamp": "2026-01-18T10:30:45.000Z",
      "prompt_hash": "def456...",
      "result": "soft_fail",
      "reason_codes": ["SF01_IDENTITY_DRIFT"],
      "composite_score": 0.62,
      "duration_ms": 4200,
      "strategy": "re_anchor"
    }
  ]
}
```

### Project Structure Notes

- Modify: `src/domain/schemas/state-schema.ts` (add AttemptRecord)
- Modify: `src/core/state-manager.ts` (add attempt tracking methods)
- New: `src/core/attempt-tracker.ts`
- Tests: `test/core/attempt-tracker.test.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.2]
- [Source: _bmad-output/project-context.md#Circuit Breaker]

---

## Dev Agent Record

### Agent Model Used

**Codex-CLI**

**Rationale:** Counter in state.json with clear increment/check logic. Straightforward persistence and retrieval. No complex decision trees—just counting and threshold comparison.

### Debug Log References

N/A - Implementation tested via unit tests.

### Completion Notes List

- Implemented RunStateWithAttempts extended state interface
- Added attempt recording with prompt hash and strategy tracking
- Implemented circuit breaker with cost estimation
- Frame rejection and max attempts handling
- All 24 tests passing

### File List

- `src/core/attempt-tracker.ts` - Attempt tracking logic
- `test/core/attempt-tracker.test.ts` - Unit tests (24 tests)
