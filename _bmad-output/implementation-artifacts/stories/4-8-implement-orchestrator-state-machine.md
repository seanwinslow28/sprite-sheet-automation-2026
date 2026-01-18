# Story 4.8: Implement Orchestrator State Machine

Status: ready-for-dev

---

## Story

**As an** operator,
**I want** a robust state machine managing the generate-audit-retry loop,
**So that** the pipeline executes reliably without losing progress.

---

## Acceptance Criteria

### State Machine States

1. **INIT** - Validate manifest, create lock file, analyze anchor
2. **GENERATING** - Call generator adapter to produce frame
3. **AUDITING** - Run hard gates then soft metrics on generated frame
4. **RETRY_DECIDING** - Consult retry ladder for next action
5. **APPROVING** - Move frame to approved folder, update state
6. **NEXT_FRAME** - Increment frame index, check completion
7. **COMPLETED** - All frames approved, ready for export
8. **STOPPED** - Halt condition triggered

### State Machine Behavior

9. **State logging** - State transitions are logged
10. **Atomic persistence** - Current state persisted to `state.json` after each transition (NFR11)
11. **No in-memory only** - No in-memory-only state for completed work (NFR10)
12. **Ladder exhausted handling** - Explicit transition for "retry ladder exhausted but attempts remaining"

---

## Tasks / Subtasks

- [ ] **Task 1: Define state machine schema** (AC: #1-8)
  - [ ] 1.1: Create `OrchestratorState` enum with all states
  - [ ] 1.2: Define valid transitions between states
  - [ ] 1.3: Create state machine diagram documentation
  - [ ] 1.4: Add to `src/domain/types/orchestrator-state.ts`

- [ ] **Task 2: Implement INIT state** (AC: #1)
  - [ ] 2.1: Validate manifest against schema (Story 2.1)
  - [ ] 2.2: Create manifest.lock.json (Story 2.2)
  - [ ] 2.3: Analyze anchor image (Story 2.7)
  - [ ] 2.4: Initialize run folder structure (Story 2.5)
  - [ ] 2.5: Transition to GENERATING

- [ ] **Task 3: Implement GENERATING state** (AC: #2)
  - [ ] 3.1: Determine reference frame (anchor vs previous)
  - [ ] 3.2: Select prompt template (master vs variation)
  - [ ] 3.3: Call generator adapter
  - [ ] 3.4: Save candidate to disk immediately
  - [ ] 3.5: Transition to AUDITING on success, handle errors

- [ ] **Task 4: Implement AUDITING state** (AC: #3)
  - [ ] 4.1: Run normalization pipeline (Story 3.1)
  - [ ] 4.2: Run hard gates (Story 3.3)
  - [ ] 4.3: If hard gate fails, transition to RETRY_DECIDING
  - [ ] 4.4: Run soft metrics (Stories 3.4-3.8)
  - [ ] 4.5: Calculate composite score
  - [ ] 4.6: If pass, transition to APPROVING; else RETRY_DECIDING

- [ ] **Task 5: Implement RETRY_DECIDING state** (AC: #4, #12)
  - [ ] 5.1: Increment attempt counter
  - [ ] 5.2: Check max attempts (Story 4.2)
  - [ ] 5.3: Consult retry ladder (Story 4.3)
  - [ ] 5.4: If ladder exhausted AND attempts remaining, try default regeneration
  - [ ] 5.5: If max attempts reached, mark frame failed
  - [ ] 5.6: Transition to GENERATING (retry) or NEXT_FRAME (give up)

- [ ] **Task 6: Implement APPROVING state** (AC: #5)
  - [ ] 6.1: Copy normalized frame to `approved/`
  - [ ] 6.2: Record approval in state.json
  - [ ] 6.3: Add to approved_frames list
  - [ ] 6.4: Log approval with metrics
  - [ ] 6.5: Transition to NEXT_FRAME

- [ ] **Task 7: Implement NEXT_FRAME state** (AC: #6)
  - [ ] 7.1: Increment current_frame_index
  - [ ] 7.2: Check if all frames complete
  - [ ] 7.3: Check stop conditions (Story 4.4)
  - [ ] 7.4: If complete, transition to COMPLETED
  - [ ] 7.5: If stopped, transition to STOPPED
  - [ ] 7.6: Otherwise, transition to GENERATING

- [ ] **Task 8: Implement COMPLETED state** (AC: #7)
  - [ ] 8.1: Calculate final statistics
  - [ ] 8.2: Generate run summary
  - [ ] 8.3: Set run_status to 'completed'
  - [ ] 8.4: Log completion message
  - [ ] 8.5: Return control to CLI for export phase

- [ ] **Task 9: Implement STOPPED state** (AC: #8)
  - [ ] 9.1: Execute graceful halt (Story 4.4)
  - [ ] 9.2: Generate diagnostic report (Story 4.6)
  - [ ] 9.3: Set run_status to 'stopped'
  - [ ] 9.4: Log stop reason
  - [ ] 9.5: Return control to CLI

- [ ] **Task 10: Implement state persistence** (AC: #9, #10, #11)
  - [ ] 10.1: After each state transition, persist to state.json
  - [ ] 10.2: Use atomic write (temp-then-rename)
  - [ ] 10.3: Include current state, frame index, attempt count
  - [ ] 10.4: Verify no work exists only in memory

- [ ] **Task 11: Implement state logging** (AC: #9)
  - [ ] 11.1: Log state entry: "Entering AUDITING state for frame 3"
  - [ ] 11.2: Log state exit: "Exiting AUDITING → APPROVING"
  - [ ] 11.3: Include timing information
  - [ ] 11.4: Use structured JSON logging

- [ ] **Task 12: Write tests** (AC: all)
  - [ ] 12.1: Test full happy path: INIT → ... → COMPLETED
  - [ ] 12.2: Test retry path: AUDITING → RETRY_DECIDING → GENERATING
  - [ ] 12.3: Test stop condition path: NEXT_FRAME → STOPPED
  - [ ] 12.4: Test state persistence after each transition
  - [ ] 12.5: Test resume from any state

---

## Dev Notes

### State Machine Diagram

```
                    ┌─────────┐
                    │  INIT   │
                    └────┬────┘
                         │
                         ▼
              ┌──────────────────┐
              │    GENERATING    │◄────────────┐
              └────────┬─────────┘             │
                       │                       │
                       ▼                       │
              ┌──────────────────┐             │
              │    AUDITING      │             │
              └────────┬─────────┘             │
                       │                       │
            ┌──────────┴──────────┐            │
            │                     │            │
            ▼                     ▼            │
   ┌─────────────────┐   ┌─────────────────┐   │
   │    APPROVING    │   │ RETRY_DECIDING  │───┘
   └────────┬────────┘   └────────┬────────┘
            │                     │
            │                     ▼
            │            ┌─────────────────┐
            └───────────►│   NEXT_FRAME    │
                         └────────┬────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
                    ▼                           ▼
           ┌─────────────────┐         ┌─────────────────┐
           │    COMPLETED    │         │     STOPPED     │
           └─────────────────┘         └─────────────────┘
```

### OrchestratorState Type

```typescript
type OrchestratorState =
  | 'INIT'
  | 'GENERATING'
  | 'AUDITING'
  | 'RETRY_DECIDING'
  | 'APPROVING'
  | 'NEXT_FRAME'
  | 'COMPLETED'
  | 'STOPPED';

interface StateTransition {
  from: OrchestratorState;
  to: OrchestratorState;
  timestamp: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}
```

### State Machine Context

```typescript
interface OrchestratorContext {
  // Configuration
  manifest: Manifest;
  config: ResolvedConfig;

  // Current position
  currentState: OrchestratorState;
  currentFrameIndex: number;
  currentAttempt: number;

  // Accumulated data
  approvedFrames: string[];
  frameStates: Map<number, FrameState>;

  // Timing
  startTime: Date;
  stateEntryTime: Date;

  // References
  anchorAnalysis: AnchorAnalysis;
  retryManager: RetryManager;
  stateManager: StateManager;
}
```

### Transition Table

| From | To | Condition |
|------|-----|-----------|
| INIT | GENERATING | Manifest valid, anchor analyzed |
| GENERATING | AUDITING | Frame generated successfully |
| GENERATING | STOPPED | API error (fail fast) |
| AUDITING | APPROVING | All gates pass |
| AUDITING | RETRY_DECIDING | Any gate fails |
| RETRY_DECIDING | GENERATING | Retry action determined |
| RETRY_DECIDING | NEXT_FRAME | Max attempts or ladder exhausted |
| APPROVING | NEXT_FRAME | Frame saved to approved/ |
| NEXT_FRAME | GENERATING | More frames pending |
| NEXT_FRAME | COMPLETED | All frames done |
| NEXT_FRAME | STOPPED | Stop condition triggered |

### Ladder Exhausted Handling

```typescript
// In RETRY_DECIDING state:
if (retryManager.isLadderExhausted(frameState)) {
  if (attemptCount < maxAttempts) {
    // Ladder exhausted but attempts remaining
    // Try one more time with default prompt (no special action)
    logger.warn({
      event: 'ladder_exhausted_retry',
      frame: currentFrameIndex,
      attempt: attemptCount + 1,
      message: 'Retry ladder exhausted, attempting default regeneration'
    });
    return { nextState: 'GENERATING', action: 'DEFAULT_REGENERATE' };
  } else {
    // Both ladder and attempts exhausted
    return { nextState: 'NEXT_FRAME', action: 'MARK_FAILED' };
  }
}
```

### State Persistence

```typescript
async function persistState(context: OrchestratorContext): Promise<void> {
  const stateSnapshot = {
    current_state: context.currentState,
    current_frame_index: context.currentFrameIndex,
    current_attempt: context.currentAttempt,
    approved_frames: context.approvedFrames,
    frame_states: Object.fromEntries(context.frameStates),
    updated_at: new Date().toISOString()
  };

  await stateManager.saveState(stateSnapshot);  // Atomic write
}
```

### Project Structure Notes

- New: `src/core/orchestrator.ts` (main state machine)
- New: `src/domain/types/orchestrator-state.ts`
- Integrates: All previous Epic 4 stories
- Integrates: Stories 2.1-2.9 (generation), 3.1-3.10 (auditing)
- Tests: `test/core/orchestrator.test.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.8]
- [Source: _bmad-output/project-context.md#Architecture Patterns]
- [Source: All Epic 4 stories]

---

## Dev Agent Record

### Agent Model Used

**Claude-Code**

**Rationale:** CENTRAL STATE MACHINE with 8 states and complex transitions. Core architecture requiring deep reasoning about state persistence, transition conditions, and integration with all other components. Highest complexity in Epic 4.

### Debug Log References

*(To be filled during implementation)*

### Completion Notes List

*(To be filled during implementation)*

### File List

*(To be filled during implementation)*
