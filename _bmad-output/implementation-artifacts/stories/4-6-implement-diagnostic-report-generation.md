# Story 4.6: Implement Diagnostic Report Generation

Status: done

---

## Story

**As an** operator,
**I want** a diagnostic report when stop conditions trigger,
**So that** I can understand root cause and plan recovery.

---

## Acceptance Criteria

### Report Generation

1. **Trigger condition** - Report generated when pipeline halts due to stop condition
2. **Output location** - Report saved to `runs/{run_id}/diagnostic.json`
3. **Stop condition** - Report includes which stop condition triggered
4. **Frame breakdown** - Report includes frame-by-frame failure breakdown
5. **Top failures** - Report includes top 3 most common failure codes
6. **Root cause** - Report includes suggested root cause based on failure patterns
7. **Recovery actions** - Report includes recommended recovery actions (FR26)
8. **Human readable** - Report is formatted for human readability

### Security

9. **Secret sanitization** - All fields that could contain secrets are sanitized before writing

---

## Tasks / Subtasks

- [x] **Task 1: Define diagnostic report schema** (AC: #3, #4, #5)
  - [x] 1.1: Create `DiagnosticReport` interface
  - [x] 1.2: Define `FrameBreakdown` structure
  - [x] 1.3: Define `FailureCode` aggregation structure
  - [x] 1.4: Add Zod schema for validation

- [x] **Task 2: Implement stop condition capture** (AC: #3)
  - [x] 2.1: Capture stop condition type (retry_rate, reject_rate, consecutive_fails)
  - [x] 2.2: Capture threshold value that was exceeded
  - [x] 2.3: Capture actual value that triggered stop
  - [x] 2.4: Capture timestamp of stop

- [x] **Task 3: Implement frame-by-frame breakdown** (AC: #4)
  - [x] 3.1: Create `generateFrameBreakdown(state: RunState): FrameBreakdown[]`
  - [x] 3.2: For each frame: index, status, attempt_count, final_reason_codes
  - [x] 3.3: Include composite scores for failed attempts
  - [x] 3.4: Include which retry actions were tried

- [x] **Task 4: Implement failure code aggregation** (AC: #5)
  - [x] 4.1: Count occurrences of each failure code across all frames
  - [x] 4.2: Sort by frequency descending
  - [x] 4.3: Return top 3 with count and percentage
  - [x] 4.4: Include example frame indices for each code

- [x] **Task 5: Implement root cause analysis** (AC: #6)
  - [x] 5.1: Define cause-to-pattern mapping
  - [x] 5.2: Analyze top failure codes for patterns:
    - High SF01: "Anchor may lack distinctive features"
    - High SF02: "Palette constraints too strict"
    - High SF03: "Pose reference conflicting with anchor"
  - [x] 5.3: Generate 1-2 sentence root cause suggestion
  - [x] 5.4: Assign confidence level (high/medium/low)

- [x] **Task 6: Implement recovery action recommendations** (AC: #7)
  - [x] 6.1: Map failure patterns to recovery actions
  - [x] 6.2: Generate actionable recommendations:
    - "Try using a higher resolution anchor image"
    - "Reduce palette strictness in manifest"
    - "Add more reference frames for complex poses"
  - [x] 6.3: Prioritize recommendations by impact
  - [x] 6.4: Include estimated effort (low/medium/high)

- [x] **Task 7: Implement secret sanitization** (AC: #9)
  - [x] 7.1: Identify fields that could contain secrets (prompts, paths)
  - [x] 7.2: Redact API key patterns: `sk-...`, `AIza...`
  - [x] 7.3: Redact file paths containing 'secret', 'key', 'token'
  - [x] 7.4: Preserve diagnostic value while protecting secrets

- [x] **Task 8: Implement report formatting** (AC: #2, #8)
  - [x] 8.1: Use pretty-printed JSON with 2-space indent
  - [x] 8.2: Include section headers as comments (where valid)
  - [x] 8.3: Add human-readable timestamps
  - [x] 8.4: Write atomically to `runs/{run_id}/diagnostic.json`

- [x] **Task 9: Write tests** (AC: all)
  - [x] 9.1: Test report generated on stop condition
  - [x] 9.2: Test frame breakdown is complete
  - [x] 9.3: Test top 3 failure codes are correct
  - [x] 9.4: Test root cause suggestions are relevant
  - [x] 9.5: Test secrets are sanitized
  - [x] 9.6: Test report is valid JSON

---

## Dev Notes

### DiagnosticReport Interface

```typescript
interface DiagnosticReport {
  generated_at: string;
  run_id: string;

  // What triggered the stop
  stop_condition: {
    type: 'retry_rate' | 'reject_rate' | 'consecutive_fails' | 'circuit_breaker';
    threshold: number;
    actual_value: number;
    triggered_at: string;
  };

  // Summary statistics
  summary: {
    total_frames: number;
    frames_attempted: number;
    frames_approved: number;
    frames_rejected: number;
    frames_failed: number;
    total_attempts: number;
    average_attempts_per_frame: number;
  };

  // Per-frame details
  frame_breakdown: FrameBreakdown[];

  // Aggregated failure analysis
  top_failures: FailureCodeSummary[];

  // AI-generated insights
  root_cause: {
    suggestion: string;
    confidence: 'high' | 'medium' | 'low';
    contributing_factors: string[];
  };

  // Actionable next steps
  recovery_actions: RecoveryAction[];
}
```

### FrameBreakdown Structure

```typescript
interface FrameBreakdown {
  frame_index: number;
  final_status: 'approved' | 'rejected' | 'failed' | 'pending';
  attempt_count: number;
  reason_codes: string[];
  composite_scores: number[];  // Score for each attempt
  actions_tried: string[];     // Retry actions attempted
  time_spent_ms: number;
}
```

### Root Cause Pattern Mapping

```typescript
const ROOT_CAUSE_PATTERNS: Record<string, RootCauseSuggestion> = {
  'SF01_dominant': {
    suggestion: 'Anchor image may lack distinctive features or resolution for reliable identity matching.',
    contributing_factors: [
      'Low contrast in anchor image',
      'Anchor pose too different from animation poses',
      'Small anchor image size'
    ],
    confidence: 'high'
  },
  'SF02_dominant': {
    suggestion: 'Color palette constraints may be too strict for the generation model.',
    contributing_factors: [
      'Palette has very similar colors',
      'Palette missing colors needed for shading',
      'Gemini interpreting palette literally'
    ],
    confidence: 'medium'
  },
  'SF03_dominant': {
    suggestion: 'Baseline detection may be struggling with the character design.',
    contributing_factors: [
      'Character has unclear feet/ground contact',
      'Transparency edge artifacts',
      'Non-standard character proportions'
    ],
    confidence: 'medium'
  },
  'consecutive_fails': {
    suggestion: 'Systematic issue detected. Model may be consistently failing on this animation type.',
    contributing_factors: [
      'Animation complexity beyond current capability',
      'Reference images conflicting',
      'Prompt template needs adjustment'
    ],
    confidence: 'low'
  }
};
```

### Recovery Action Examples

```typescript
const RECOVERY_ACTIONS: RecoveryAction[] = [
  {
    action: 'Increase anchor resolution',
    description: 'Use a 512x512 or larger anchor image with clear details',
    applies_when: ['SF01_IDENTITY_DRIFT'],
    effort: 'low',
    priority: 1
  },
  {
    action: 'Loosen identity threshold',
    description: 'Reduce auditor.thresholds.identity_min from 0.8 to 0.7',
    applies_when: ['SF01_IDENTITY_DRIFT'],
    effort: 'low',
    priority: 2
  },
  {
    action: 'Add more style references',
    description: 'Include 2-3 additional style reference images in inputs.style_refs',
    applies_when: ['SF01_IDENTITY_DRIFT', 'SF02_PALETTE_DRIFT'],
    effort: 'medium',
    priority: 3
  },
  {
    action: 'Simplify animation',
    description: 'Reduce frame count or choose simpler pose transitions',
    applies_when: ['consecutive_fails'],
    effort: 'high',
    priority: 4
  }
];
```

### Example Diagnostic Report

```json
{
  "generated_at": "2026-01-18T15:30:00.000Z",
  "run_id": "abc123",

  "stop_condition": {
    "type": "reject_rate",
    "threshold": 0.3,
    "actual_value": 0.375,
    "triggered_at": "2026-01-18T15:29:55.000Z"
  },

  "summary": {
    "total_frames": 8,
    "frames_attempted": 4,
    "frames_approved": 2,
    "frames_rejected": 1,
    "frames_failed": 1,
    "total_attempts": 15,
    "average_attempts_per_frame": 3.75
  },

  "frame_breakdown": [
    { "frame_index": 0, "final_status": "approved", "attempt_count": 1, "reason_codes": [] },
    { "frame_index": 1, "final_status": "approved", "attempt_count": 3, "reason_codes": ["SF01", "SF01"] },
    { "frame_index": 2, "final_status": "rejected", "attempt_count": 5, "reason_codes": ["SF01", "SF01", "SF01", "SF01", "HF_IDENTITY_COLLAPSE"] },
    { "frame_index": 3, "final_status": "failed", "attempt_count": 5, "reason_codes": ["SF01", "SF01", "SF02", "SF01", "SF01"] }
  ],

  "top_failures": [
    { "code": "SF01_IDENTITY_DRIFT", "count": 10, "percentage": 66.7, "example_frames": [1, 2, 3] },
    { "code": "SF02_PALETTE_DRIFT", "count": 2, "percentage": 13.3, "example_frames": [3] },
    { "code": "HF_IDENTITY_COLLAPSE", "count": 1, "percentage": 6.7, "example_frames": [2] }
  ],

  "root_cause": {
    "suggestion": "Anchor image may lack distinctive features or resolution for reliable identity matching.",
    "confidence": "high",
    "contributing_factors": [
      "SF01 accounts for 67% of all failures",
      "Multiple frames failed after re-anchor attempts",
      "Identity collapse triggered on frame 2"
    ]
  },

  "recovery_actions": [
    {
      "action": "Increase anchor resolution",
      "description": "Use a 512x512 or larger anchor image with clear details",
      "effort": "low",
      "priority": 1
    },
    {
      "action": "Loosen identity threshold",
      "description": "Reduce auditor.thresholds.identity_min from 0.8 to 0.7",
      "effort": "low",
      "priority": 2
    }
  ]
}
```

### Project Structure Notes

- New: `src/core/diagnostic-generator.ts`
- New: `src/domain/types/diagnostic-report.ts`
- Modify: `src/core/orchestrator.ts` (call diagnostic generator on halt)
- Tests: `test/core/diagnostic-generator.test.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.6]
- [Source: stories/4-4-implement-stop-conditions-run-halting.md]
- [Source: stories/4-3-implement-retry-ladder-reason-to-action.md]

---

## Dev Agent Record

### Agent Model Used

**Claude-Code**

**Rationale:** Failure pattern analysis and root cause suggestion requires reasoning about multiple failure modes and their relationships. Integration of frame data with pattern matching for intelligent recommendations.

### Debug Log References

N/A - Implementation tested via unit tests.

### Completion Notes List

- Implemented diagnostic report generation with JSON output
- Added root cause analysis with pattern matching
- Implemented recovery action recommendations with priority
- Added secret sanitization for safe logging
- Console formatting for human-readable output
- All tests passing

### File List

- `src/core/diagnostic-generator.ts` - Diagnostic report generation (474 lines)
- `test/core/diagnostic-generator.test.ts` - Unit tests
