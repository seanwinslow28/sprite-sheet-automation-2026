# Story 6.3: Implement Run Summary Report

Status: ready-for-dev

---

## Story

**As an** operator,
**I want** aggregate statistics for each run,
**So that** I can understand overall pipeline performance.

---

## Acceptance Criteria

### Summary Content

1. **Summary file** - `runs/{run_id}/summary.json` generated when run finishes
2. **Frame statistics** - Total frames attempted vs completed
3. **Retry rate** - Retries divided by total attempts
4. **Reject rate** - Rejected frames divided by total frames
5. **Top failures** - Top 3 failure codes with counts
6. **Duration** - Total run duration
7. **Average time** - Average time per frame
8. **Human readable** - Summary is human-readable when pretty-printed

---

## Tasks / Subtasks

- [ ] **Task 1: Define summary schema** (AC: #1-7)
  - [ ] 1.1: Create `RunSummary` interface
  - [ ] 1.2: Include all required statistics
  - [ ] 1.3: Create Zod schema for validation
  - [ ] 1.4: Document each field

- [ ] **Task 2: Implement frame statistics** (AC: #2)
  - [ ] 2.1: Count total frames from manifest
  - [ ] 2.2: Count approved frames
  - [ ] 2.3: Count failed frames
  - [ ] 2.4: Count rejected frames (identity collapse)

- [ ] **Task 3: Implement rate calculations** (AC: #3, #4)
  - [ ] 3.1: Calculate retry rate: `frames_with_retries / total_frames`
  - [ ] 3.2: Calculate reject rate: `rejected_frames / total_frames`
  - [ ] 3.3: Include both as percentages and decimals
  - [ ] 3.4: Handle edge cases (0 frames)

- [ ] **Task 4: Implement failure code aggregation** (AC: #5)
  - [ ] 4.1: Collect all failure codes from all attempts
  - [ ] 4.2: Count occurrences of each code
  - [ ] 4.3: Sort by frequency descending
  - [ ] 4.4: Return top 3 with counts

- [ ] **Task 5: Implement timing statistics** (AC: #6, #7)
  - [ ] 5.1: Calculate total duration from start to end
  - [ ] 5.2: Calculate average time per frame
  - [ ] 5.3: Calculate average time per attempt
  - [ ] 5.4: Include breakdown by phase (generation, audit, export)

- [ ] **Task 6: Implement summary writer** (AC: #1, #8)
  - [ ] 6.1: Create `writeSummary(runId: string, state: RunState): Promise<void>`
  - [ ] 6.2: Aggregate all statistics
  - [ ] 6.3: Write as pretty-printed JSON
  - [ ] 6.4: Use atomic write pattern

- [ ] **Task 7: Integrate with run completion** (AC: #1)
  - [ ] 7.1: Call summary writer when run completes
  - [ ] 7.2: Call summary writer when run stops
  - [ ] 7.3: Call summary writer when run fails
  - [ ] 7.4: Include appropriate final status

- [ ] **Task 8: Write tests** (AC: all)
  - [ ] 8.1: Test summary generated on completion
  - [ ] 8.2: Test statistics are accurate
  - [ ] 8.3: Test top 3 failure codes
  - [ ] 8.4: Test timing calculations

---

## Dev Notes

### RunSummary Interface

```typescript
interface RunSummary {
  run_id: string;
  generated_at: string;
  final_status: 'completed' | 'stopped' | 'failed';

  // Frame statistics
  frames: {
    total: number;
    attempted: number;
    approved: number;
    failed: number;
    rejected: number;
    pending: number;
  };

  // Rates
  rates: {
    completion_rate: number;    // approved / total
    retry_rate: number;         // frames_with_retries / attempted
    reject_rate: number;        // rejected / attempted
    success_rate: number;       // approved / attempted
  };

  // Attempt statistics
  attempts: {
    total: number;
    per_frame_average: number;
    min_per_frame: number;
    max_per_frame: number;
  };

  // Top failure codes
  top_failures: Array<{
    code: string;
    count: number;
    percentage: number;
    example_frames: number[];
  }>;

  // Timing
  timing: {
    start_time: string;
    end_time: string;
    total_duration_ms: number;
    average_per_frame_ms: number;
    average_per_attempt_ms: number;
    breakdown: {
      generation_ms: number;
      audit_ms: number;
      export_ms: number;
      other_ms: number;
    };
  };

  // Configuration used
  config: {
    character: string;
    move: string;
    frame_count: number;
    max_attempts_per_frame: number;
  };

  // Export info
  export?: {
    atlas_path: string;
    sheet_count: number;
    release_status: string;
    validation_passed: boolean;
  };
}
```

### Example Summary File

```json
{
  "run_id": "20260118_blaze_idle_abc123",
  "generated_at": "2026-01-18T15:00:00.000Z",
  "final_status": "completed",

  "frames": {
    "total": 8,
    "attempted": 8,
    "approved": 7,
    "failed": 0,
    "rejected": 1,
    "pending": 0
  },

  "rates": {
    "completion_rate": 0.875,
    "retry_rate": 0.375,
    "reject_rate": 0.125,
    "success_rate": 0.875
  },

  "attempts": {
    "total": 15,
    "per_frame_average": 1.875,
    "min_per_frame": 1,
    "max_per_frame": 5
  },

  "top_failures": [
    {
      "code": "SF01_IDENTITY_DRIFT",
      "count": 5,
      "percentage": 62.5,
      "example_frames": [2, 3, 5]
    },
    {
      "code": "SF02_PALETTE_DRIFT",
      "count": 2,
      "percentage": 25.0,
      "example_frames": [3]
    },
    {
      "code": "HF_IDENTITY_COLLAPSE",
      "count": 1,
      "percentage": 12.5,
      "example_frames": [4]
    }
  ],

  "timing": {
    "start_time": "2026-01-18T14:45:00.000Z",
    "end_time": "2026-01-18T15:00:00.000Z",
    "total_duration_ms": 900000,
    "average_per_frame_ms": 112500,
    "average_per_attempt_ms": 60000,
    "breakdown": {
      "generation_ms": 720000,
      "audit_ms": 120000,
      "export_ms": 45000,
      "other_ms": 15000
    }
  },

  "config": {
    "character": "BLAZE",
    "move": "idle_standard",
    "frame_count": 8,
    "max_attempts_per_frame": 5
  },

  "export": {
    "atlas_path": "runs/20260118_blaze_idle_abc123/export/blaze_idle.json",
    "sheet_count": 1,
    "release_status": "release-ready",
    "validation_passed": true
  }
}
```

### Statistics Calculation

```typescript
function calculateRunStatistics(state: RunState): RunStatistics {
  const frameStates = Object.values(state.frame_states);

  // Frame counts
  const approved = frameStates.filter(f => f.status === 'approved').length;
  const failed = frameStates.filter(f => f.status === 'failed').length;
  const rejected = frameStates.filter(f => f.status === 'rejected').length;
  const attempted = approved + failed + rejected;

  // Retry rate: frames that needed more than 1 attempt
  const framesWithRetries = frameStates.filter(f => f.attempts.length > 1).length;
  const retryRate = attempted > 0 ? framesWithRetries / attempted : 0;

  // Reject rate
  const rejectRate = attempted > 0 ? rejected / attempted : 0;

  // Attempt statistics
  const attemptCounts = frameStates.map(f => f.attempts.length);
  const totalAttempts = attemptCounts.reduce((a, b) => a + b, 0);

  return {
    frames: { total: state.total_frames, attempted, approved, failed, rejected },
    rates: {
      completion_rate: approved / state.total_frames,
      retry_rate: retryRate,
      reject_rate: rejectRate,
      success_rate: attempted > 0 ? approved / attempted : 0
    },
    attempts: {
      total: totalAttempts,
      per_frame_average: attempted > 0 ? totalAttempts / attempted : 0,
      min_per_frame: Math.min(...attemptCounts),
      max_per_frame: Math.max(...attemptCounts)
    }
  };
}
```

### Top Failures Calculation

```typescript
function calculateTopFailures(
  state: RunState,
  limit: number = 3
): FailureCodeSummary[] {
  const codeCounts = new Map<string, { count: number; frames: number[] }>();

  for (const [frameIdx, frameState] of Object.entries(state.frame_states)) {
    for (const attempt of frameState.attempts) {
      for (const code of attempt.reason_codes) {
        const existing = codeCounts.get(code) || { count: 0, frames: [] };
        existing.count++;
        if (!existing.frames.includes(Number(frameIdx))) {
          existing.frames.push(Number(frameIdx));
        }
        codeCounts.set(code, existing);
      }
    }
  }

  const total = Array.from(codeCounts.values()).reduce((s, v) => s + v.count, 0);

  return Array.from(codeCounts.entries())
    .map(([code, data]) => ({
      code,
      count: data.count,
      percentage: total > 0 ? (data.count / total) * 100 : 0,
      example_frames: data.frames.slice(0, 3)
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
```

### Project Structure Notes

- New: `src/core/reporting/summary-generator.ts`
- New: `src/domain/types/run-summary.ts`
- Modify: `src/core/orchestrator.ts` (call summary on completion)
- Tests: `test/core/reporting/summary-generator.test.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.3]

---

## Dev Agent Record

### Agent Model Used

**Codex-CLI**

**Rationale:** Aggregate statistics calculation with well-defined formulas. JSON file generation. No complex decision logic.

### Debug Log References

*(To be filled during implementation)*

### Completion Notes List

*(To be filled during implementation)*

### File List

*(To be filled during implementation)*
