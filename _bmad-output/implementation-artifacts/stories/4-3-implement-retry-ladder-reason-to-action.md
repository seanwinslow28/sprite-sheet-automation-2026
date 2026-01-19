# Story 4.3: Implement Retry Ladder with Reason-to-Action Mapping

Status: done

---

## Story

**As an** operator,
**I want** failures mapped to specific recovery actions,
**So that** the system can intelligently attempt different strategies.

---

## Acceptance Criteria

### Reason-to-Action Mapping

1. **SF_IDENTITY_DRIFT** - Try "identity rescue" (re-anchor + lock prompt)
2. **SF_PALETTE_DRIFT** - Try "tighten negative" (add palette enforcement)
3. **SF_BASELINE_DRIFT** - Try "pose rescue" (add baseline guide emphasis)
4. **SF_ALPHA_HALO** - Try "post-process" (apply alpha cleanup filter)
5. **SF_PIXEL_NOISE** - Try "regenerate at higher res" or apply smoothing
6. **Action logging** - Log action before execution
7. **Ladder escalation** - If action fails, escalate to next ladder level

### HF_IDENTITY_COLLAPSE Handling (Deep Think Lock)

8. **Consecutive re-anchor tracking** - Track re-anchor attempts per frame
9. **Collapse trigger** - If 2 consecutive re-anchors both fail SF01 < 0.9, trigger HF_IDENTITY_COLLAPSE
10. **Rejection on collapse** - Frame marked REJECTED, not retried further
11. **Run continues** - Single bad frame doesn't kill batch
12. **Diagnostic suggestion** - Log: "Suggestion: Anchor may lack resolution for this pose angle"
13. **Reject rate check** - After rejection, recalculate reject_rate
14. **Stop condition** - If reject_rate > 0.3 (30%), trigger STOPPED state

### Oscillation Prevention

15. **Oscillation detection** - Detect alternating pass/fail on re-anchor
16. **Dead end escalation** - If same frame triggers re-anchor > 2 times, treat as Dead End
17. **Oscillation logging** - Log: "Frame N: Oscillation detected, marking as identity collapse"

---

## Tasks / Subtasks

- [x] **Task 1: Define retry action types** (AC: #1-5)
  - [x] 1.1: Create `RetryAction` enum: `IDENTITY_RESCUE`, `TIGHTEN_NEGATIVE`, `POSE_RESCUE`, `POST_PROCESS`, `REGENERATE_HIGHRES`, `RE_ANCHOR`, `STOP`
  - [x] 1.2: Create `ReasonToActionMap` type
  - [x] 1.3: Define default mapping in `src/domain/retry-ladder.ts`
  - [x] 1.4: Allow manifest override via `retry.ladder` config

- [x] **Task 2: Implement RetryManager** (AC: #6, #7)
  - [x] 2.1: Create `src/core/retry-manager.ts`
  - [x] 2.2: Implement `getNextAction(reasonCode: string, attemptIndex: number): RetryAction`
  - [x] 2.3: Log action before returning: "Frame N: Attempting IDENTITY_RESCUE (attempt 2)"
  - [x] 2.4: Track which actions have been tried for current frame

- [x] **Task 3: Implement action executors** (AC: #1-5)
  - [x] 3.1: `executeIdentityRescue()`: Force re-anchor + apply lock prompt template
  - [x] 3.2: `executeTightenNegative()`: Append palette constraints to negative prompt
  - [x] 3.3: `executePoseRescue()`: Emphasize baseline/pose in prompt
  - [x] 3.4: `executePostProcess()`: Apply alpha cleanup filter via Sharp
  - [x] 3.5: `executeRegenerateHighRes()`: Bump generation_size temporarily

- [x] **Task 4: Implement consecutive re-anchor tracking** (AC: #8, #9)
  - [x] 4.1: Track `consecutive_reanchor_count` per frame in state
  - [x] 4.2: Increment when re-anchor action is taken
  - [x] 4.3: Reset to 0 when different action is taken or frame passes
  - [x] 4.4: Check threshold: if >= 2 and both failed SF01 < 0.9

- [x] **Task 5: Implement HF_IDENTITY_COLLAPSE** (AC: #10, #11, #12)
  - [x] 5.1: When collapse triggered, set frame status to `rejected`
  - [x] 5.2: Record `rejected_reason: 'HF_IDENTITY_COLLAPSE'`
  - [x] 5.3: Do NOT retry further on this frame
  - [x] 5.4: Log diagnostic: "Suggestion: Anchor may lack resolution for this pose angle"
  - [x] 5.5: Continue to next frame index

- [x] **Task 6: Implement reject rate calculation** (AC: #13, #14)
  - [x] 6.1: After each rejection, calculate `reject_rate = rejected_count / total_frames_attempted`
  - [x] 6.2: If reject_rate > 0.3, trigger run STOPPED state
  - [x] 6.3: Record stop reason: "REJECT_RATE_EXCEEDED"
  - [x] 6.4: Log: "Run stopped: Reject rate {X}% exceeds 30% threshold"

- [x] **Task 7: Implement oscillation detection** (AC: #15, #16, #17)
  - [x] 7.1: Track attempt results in sequence for each frame
  - [x] 7.2: Detect pattern: [fail, pass, fail] or [pass, fail, pass] with re-anchor
  - [x] 7.3: If re-anchor triggered > 2 times, classify as oscillation
  - [x] 7.4: Escalate to HF_IDENTITY_COLLAPSE
  - [x] 7.5: Log: "Frame N: Oscillation detected, marking as identity collapse"

- [x] **Task 8: Implement ladder exhaustion handling** (AC: #7)
  - [x] 8.1: Track which actions have been tried for current frame
  - [x] 8.2: If all actions exhausted, mark frame as failed (not collapsed)
  - [x] 8.3: Record `failed_reason: 'LADDER_EXHAUSTED'`
  - [x] 8.4: Move to next frame

- [x] **Task 9: Write tests** (AC: all)
  - [x] 9.1: Test SF01 triggers IDENTITY_RESCUE
  - [x] 9.2: Test ladder escalation on repeated failures
  - [x] 9.3: Test HF_IDENTITY_COLLAPSE after 2 consecutive re-anchors
  - [x] 9.4: Test run continues after frame rejection
  - [x] 9.5: Test reject_rate triggers STOPPED
  - [x] 9.6: Test oscillation detection

---

## Dev Notes

### Retry Ladder (8-Level from OPUS INPUT PACK)

| Level | Action | When Triggered |
|-------|--------|----------------|
| 1 | Reroll seeds | SF_IDENTITY_DRIFT (attempt 1) |
| 2 | Tighten negative | SF_PALETTE_DRIFT or SF_STYLE_DRIFT |
| 3 | Identity rescue | SF_IDENTITY_DRIFT (attempt 2+) |
| 4 | Pose rescue | SF_BASELINE_DRIFT |
| 5 | Two-stage inpaint | SF_ALPHA_HALO (if mask available) |
| 6 | Post-process | SF_ALPHA_HALO or SF_PIXEL_NOISE |
| 7 | Escalate | Multiple codes, oscillation |
| 8 | Stop | Ladder exhausted, collapse |

### RetryManager Interface

```typescript
interface RetryManager {
  getNextAction(
    auditResult: AuditResult,
    frameState: FrameState
  ): Result<RetryAction, StopReason>;

  executeAction(
    action: RetryAction,
    context: GenerationContext
  ): Promise<void>;

  isLadderExhausted(frameState: FrameState): boolean;
}
```

### Reason-to-Action Default Mapping

```typescript
const DEFAULT_REASON_ACTION_MAP: Record<string, RetryAction[]> = {
  'SF01_IDENTITY_DRIFT': ['REROLL_SEED', 'IDENTITY_RESCUE', 'RE_ANCHOR'],
  'SF02_PALETTE_DRIFT': ['TIGHTEN_NEGATIVE', 'IDENTITY_RESCUE'],
  'SF03_BASELINE_DRIFT': ['POSE_RESCUE', 'RE_ANCHOR'],
  'SF04_TEMPORAL_FLICKER': ['REROLL_SEED', 'TIGHTEN_NEGATIVE'],
  'SF_ALPHA_HALO': ['POST_PROCESS', 'TWO_STAGE_INPAINT'],
  'SF_PIXEL_NOISE': ['REGENERATE_HIGHRES', 'POST_PROCESS'],
};
```

### State Tracking for Retry

```typescript
interface FrameRetryState {
  frame_index: number;
  actions_tried: RetryAction[];
  consecutive_reanchor_count: number;
  last_sf01_scores: number[];  // Track SF01 for collapse detection
  oscillation_pattern: ('pass' | 'fail')[];
}
```

### Collapse Detection Logic

```typescript
function shouldTriggerCollapse(state: FrameRetryState): boolean {
  // Condition 1: 2+ consecutive re-anchors both failed SF01 < 0.9
  if (state.consecutive_reanchor_count >= 2) {
    const recentScores = state.last_sf01_scores.slice(-2);
    if (recentScores.every(score => score < 0.9)) {
      return true;
    }
  }

  // Condition 2: Oscillation detected
  const pattern = state.oscillation_pattern.slice(-4);
  if (pattern.length >= 4) {
    const isOscillating = pattern[0] !== pattern[1] &&
                          pattern[1] !== pattern[2] &&
                          pattern[2] !== pattern[3];
    if (isOscillating && state.consecutive_reanchor_count > 2) {
      return true;
    }
  }

  return false;
}
```

### Reject Rate Calculation

```typescript
function calculateRejectRate(state: RunState): number {
  const attemptedFrames = Object.keys(state.frame_states).length;
  const rejectedFrames = Object.values(state.frame_states)
    .filter(f => f.status === 'rejected').length;

  return attemptedFrames > 0 ? rejectedFrames / attemptedFrames : 0;
}
```

### Project Structure Notes

- New: `src/core/retry-manager.ts`
- New: `src/domain/retry-actions.ts`
- Modify: `src/core/state-manager.ts` (add retry state tracking)
- Modify: `src/core/orchestrator.ts` (integrate retry manager)
- Tests: `test/core/retry-manager.test.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.3]
- [Source: _bmad-output/project-context.md#RetryManager Logic]
- [Source: _bmad-output/project-context.md#Deep Think Follow-Up Lock]

---

## Dev Agent Record

### Agent Model Used

**Claude-Code**

**Rationale:** DECISION TREE with HF_IDENTITY_COLLAPSE escalation, oscillation prevention. Complex state transitions require reasoning about multiple conditions, history tracking, and edge cases. Central to pipeline reliability.

### Debug Log References

N/A - Implementation tested via unit tests.

### Completion Notes List

- Implemented 8-level retry ladder with reason-to-action mapping
- Added HF_IDENTITY_COLLAPSE detection with 2+ consecutive re-anchors
- Implemented oscillation detection for alternating pass/fail patterns
- Integrated with orchestrator for automatic retry decisions
- All 29 tests passing

### File List

- `src/core/retry-manager.ts` - Retry ladder logic
- `src/domain/retry-actions.ts` - Retry action types and mappings
- `test/core/retry-manager.test.ts` - Unit tests (29 tests)
