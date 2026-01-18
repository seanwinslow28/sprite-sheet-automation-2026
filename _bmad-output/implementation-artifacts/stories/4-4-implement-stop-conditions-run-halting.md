# Story 4.4: Implement Stop Conditions and Run Halting

Status: ready-for-dev

---

## Story

**As an** operator,
**I want** the pipeline to halt when stop conditions are met,
**So that** I don't waste API credits on runs that are failing consistently.

---

## Acceptance Criteria

### Stop Conditions

1. **Max retry rate** - Halt when retry rate exceeds `retry.stop_conditions.max_retry_rate` (default 0.5)
2. **Max reject rate** - Halt when reject rate exceeds `retry.stop_conditions.max_reject_rate` (default 0.3)
3. **Consecutive fails** - Halt after `retry.stop_conditions.max_consecutive_fails` frames fail (default 3)
4. **Condition recorded** - Specific stop condition that triggered is recorded in state

### Halt Behavior

5. **Status set** - Run status set to `stopped` (not `failed`)
6. **Work persisted** - All in-progress work persisted before halt (NFR6-7)
7. **Resume placeholder** - Run can be resumed later (FR3 - v1+ placeholder)
8. **Manifest config** - Stop conditions read from manifest `retry.stop_conditions`

---

## Tasks / Subtasks

- [ ] **Task 1: Define stop condition schema** (AC: #1, #2, #3, #8)
  - [ ] 1.1: Add `StopConditions` to manifest Zod schema
  - [ ] 1.2: Define fields: `max_retry_rate`, `max_reject_rate`, `max_consecutive_fails`
  - [ ] 1.3: Set defaults: 0.5, 0.3, 3
  - [ ] 1.4: Allow per-manifest override

- [ ] **Task 2: Implement rate calculators** (AC: #1, #2)
  - [ ] 2.1: Create `calculateRetryRate(state: RunState): number`
  - [ ] 2.2: Retry rate = frames_with_retries / total_frames_attempted
  - [ ] 2.3: Create `calculateRejectRate(state: RunState): number`
  - [ ] 2.4: Reject rate = rejected_frames / total_frames_attempted

- [ ] **Task 3: Implement consecutive fail tracker** (AC: #3)
  - [ ] 3.1: Track `consecutive_fail_count` in run state
  - [ ] 3.2: Increment on frame failure/rejection
  - [ ] 3.3: Reset to 0 on frame approval
  - [ ] 3.4: Compare against threshold after each frame

- [ ] **Task 4: Implement stop condition evaluator** (AC: #1, #2, #3)
  - [ ] 4.1: Create `evaluateStopConditions(state: RunState, config: StopConditions): StopReason | null`
  - [ ] 4.2: Check retry rate against max_retry_rate
  - [ ] 4.3: Check reject rate against max_reject_rate
  - [ ] 4.4: Check consecutive fails against max_consecutive_fails
  - [ ] 4.5: Return first triggered condition (priority order)

- [ ] **Task 5: Implement graceful halt** (AC: #5, #6)
  - [ ] 5.1: Set `run_status: 'stopped'` in state
  - [ ] 5.2: Record `stop_reason: { condition, value, threshold }`
  - [ ] 5.3: Complete current frame if possible (don't corrupt mid-write)
  - [ ] 5.4: Flush all pending writes atomically
  - [ ] 5.5: Log halt with summary statistics

- [ ] **Task 6: Implement resume placeholder** (AC: #7)
  - [ ] 6.1: Add `resumable: true` flag to stopped runs
  - [ ] 6.2: Store `resume_from_frame: number` in state
  - [ ] 6.3: Log: "Run can be resumed with: pipeline run --resume {run_id}"
  - [ ] 6.4: Actual resume logic deferred to v1+ (Story 4.7 handles basic idempotency)

- [ ] **Task 7: Integrate with orchestrator** (AC: #4)
  - [ ] 7.1: Call `evaluateStopConditions()` after each frame completes
  - [ ] 7.2: If condition triggered, break out of generation loop
  - [ ] 7.3: Execute graceful halt sequence
  - [ ] 7.4: Return appropriate status to CLI

- [ ] **Task 8: Write tests** (AC: all)
  - [ ] 8.1: Test retry rate triggers halt at 50%
  - [ ] 8.2: Test reject rate triggers halt at 30%
  - [ ] 8.3: Test consecutive fails triggers halt at 3
  - [ ] 8.4: Test state is persisted before halt
  - [ ] 8.5: Test run status is 'stopped' not 'failed'
  - [ ] 8.6: Test custom thresholds from manifest

---

## Dev Notes

### StopConditions Schema

```typescript
const StopConditionsSchema = z.object({
  max_retry_rate: z.number().min(0).max(1).default(0.5),
  max_reject_rate: z.number().min(0).max(1).default(0.3),
  max_consecutive_fails: z.number().int().min(1).default(3),
});
```

### Rate Calculation Logic

```typescript
function calculateRetryRate(state: RunState): number {
  const frameStates = Object.values(state.frame_states);
  const attemptedFrames = frameStates.filter(f =>
    f.status === 'approved' || f.status === 'failed' || f.status === 'rejected'
  );

  if (attemptedFrames.length === 0) return 0;

  const framesWithRetries = attemptedFrames.filter(f =>
    f.attempts.length > 1
  );

  return framesWithRetries.length / attemptedFrames.length;
}

function calculateRejectRate(state: RunState): number {
  const frameStates = Object.values(state.frame_states);
  const attemptedFrames = frameStates.filter(f =>
    f.status === 'approved' || f.status === 'failed' || f.status === 'rejected'
  );

  if (attemptedFrames.length === 0) return 0;

  const rejectedFrames = attemptedFrames.filter(f =>
    f.status === 'rejected' || f.status === 'failed'
  );

  return rejectedFrames.length / attemptedFrames.length;
}
```

### StopReason Interface

```typescript
interface StopReason {
  condition: 'RETRY_RATE' | 'REJECT_RATE' | 'CONSECUTIVE_FAILS' | 'CIRCUIT_BREAKER';
  value: number;         // Current value that triggered
  threshold: number;     // Threshold that was exceeded
  message: string;       // Human-readable explanation
}
```

### Stop Condition Evaluation Priority

1. Circuit Breaker (50 total attempts) - highest priority, prevents runaway costs
2. Consecutive Fails - immediate signal of systematic problem
3. Reject Rate - cumulative failure indicator
4. Retry Rate - efficiency indicator (least severe)

### State.json After Halt

```json
{
  "run_id": "abc123",
  "run_status": "stopped",
  "stop_reason": {
    "condition": "REJECT_RATE",
    "value": 0.375,
    "threshold": 0.3,
    "message": "Reject rate 37.5% exceeds 30% threshold"
  },
  "resumable": true,
  "resume_from_frame": 4,
  "statistics": {
    "total_frames": 8,
    "frames_attempted": 4,
    "frames_approved": 2,
    "frames_rejected": 1,
    "frames_failed": 1,
    "retry_rate": 0.25,
    "reject_rate": 0.375,
    "consecutive_fails": 2
  }
}
```

### Graceful Halt Sequence

```typescript
async function executeGracefulHalt(
  state: RunState,
  reason: StopReason
): Promise<void> {
  // 1. Mark run as stopped
  state.run_status = 'stopped';
  state.stop_reason = reason;
  state.stopped_at = new Date().toISOString();

  // 2. Calculate final statistics
  state.statistics = calculateRunStatistics(state);

  // 3. Set resume info
  state.resumable = true;
  state.resume_from_frame = findNextPendingFrame(state);

  // 4. Persist atomically
  await stateManager.saveState(state);

  // 5. Log summary
  logger.warn({
    event: 'run_halted',
    run_id: state.run_id,
    reason: reason.condition,
    message: reason.message,
    statistics: state.statistics
  });
}
```

### Project Structure Notes

- New: `src/core/stop-condition-evaluator.ts`
- Modify: `src/domain/schemas/manifest-schema.ts` (add StopConditions)
- Modify: `src/core/state-manager.ts` (add halt methods)
- Modify: `src/core/orchestrator.ts` (integrate stop checks)
- Tests: `test/core/stop-condition-evaluator.test.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.4]
- [Source: _bmad-output/project-context.md#Circuit Breaker]
- [Source: stories/4-2-implement-attempt-tracking.md] (circuit breaker)

---

## Dev Agent Record

### Agent Model Used

**Claude-Code**

**Rationale:** Multiple stop condition evaluation with graceful halt. State preservation during shutdown requires careful reasoning about write ordering and atomicity. Integration across orchestrator and state manager.

### Debug Log References

*(To be filled during implementation)*

### Completion Notes List

*(To be filled during implementation)*

### File List

*(To be filled during implementation)*
