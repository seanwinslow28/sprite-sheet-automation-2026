# Story 6.2: Implement Per-Frame Audit Metrics Output

Status: ready-for-dev

---

## Story

**As an** operator,
**I want** per-frame audit metrics as structured data,
**So that** I can analyze quality patterns programmatically.

---

## Acceptance Criteria

### Metrics File Structure

1. **Per-frame files** - Each frame has `audit/frame_{index}_metrics.json`
2. **Soft metric scores** - Contains all soft metric scores (SSIM, palette, alpha, baseline)
3. **Composite score** - Contains composite score and breakdown
4. **Pass/fail status** - Contains pass/fail status with reason codes
5. **Attempt history** - Contains attempt history with timestamps
6. **Consistent schema** - JSON schema is consistent across all frames

### Export Options

7. **CSV export** - Metrics can be exported in CSV format with `--csv` flag

---

## Tasks / Subtasks

- [ ] **Task 1: Define metrics file schema** (AC: #1-6)
  - [ ] 1.1: Create `FrameMetrics` interface
  - [ ] 1.2: Include all soft metric scores
  - [ ] 1.3: Include composite breakdown
  - [ ] 1.4: Include attempt history
  - [ ] 1.5: Create Zod schema for validation

- [ ] **Task 2: Implement metrics writer** (AC: #1)
  - [ ] 2.1: Create `writeFrameMetrics(runId: string, frameIndex: number, metrics: FrameMetrics): Promise<void>`
  - [ ] 2.2: Write to `audit/frame_{index}_metrics.json`
  - [ ] 2.3: Use atomic write pattern
  - [ ] 2.4: Integrate with auditor (call after each audit)

- [ ] **Task 3: Implement metrics aggregator** (AC: #2, #3, #4)
  - [ ] 3.1: Create `aggregateFrameMetrics(auditResult: AuditResult, attemptHistory: AttemptRecord[]): FrameMetrics`
  - [ ] 3.2: Collect all soft metric scores
  - [ ] 3.3: Calculate composite with breakdown
  - [ ] 3.4: Determine pass/fail with reason codes

- [ ] **Task 4: Implement attempt history tracking** (AC: #5)
  - [ ] 4.1: Track each attempt with timestamp
  - [ ] 4.2: Track prompt hash used
  - [ ] 4.3: Track result (pass/soft_fail/hard_fail)
  - [ ] 4.4: Track retry action taken

- [ ] **Task 5: Implement CSV export** (AC: #7)
  - [ ] 5.1: Add `--csv` flag to inspect command
  - [ ] 5.2: Read all frame metrics files
  - [ ] 5.3: Convert to CSV format
  - [ ] 5.4: Output to file or stdout

- [ ] **Task 6: Implement metrics reader** (AC: all)
  - [ ] 6.1: Create `readFrameMetrics(runId: string, frameIndex: number): FrameMetrics`
  - [ ] 6.2: Create `readAllFrameMetrics(runId: string): FrameMetrics[]`
  - [ ] 6.3: Handle missing files gracefully
  - [ ] 6.4: Validate against schema

- [ ] **Task 7: Write tests** (AC: all)
  - [ ] 7.1: Test metrics file is created after audit
  - [ ] 7.2: Test schema is consistent
  - [ ] 7.3: Test CSV export
  - [ ] 7.4: Test reader handles missing files

---

## Dev Notes

### FrameMetrics Interface

```typescript
interface FrameMetrics {
  frame_index: number;
  computed_at: string;

  // Final status
  passed: boolean;
  status: 'approved' | 'failed' | 'rejected';
  reason_codes: string[];

  // Composite scoring
  composite_score: number;
  threshold: number;
  breakdown: {
    identity: { raw: number; weighted: number; passed: boolean };
    stability: { raw: number; weighted: number; passed: boolean };
    palette: { raw: number; weighted: number; passed: boolean };
    style: { raw: number; weighted: number; passed: boolean };
  };

  // Individual metrics
  metrics: {
    ssim: number;
    palette_fidelity: number;
    alpha_artifact_score: number;
    baseline_drift_px: number;
    orphan_pixel_count: number;
    mapd?: {
      value: number;
      threshold: number;
      move_type: string;
      passed: boolean;
      bypassed: boolean;
    };
  };

  // Attempt history
  attempt_count: number;
  attempts: AttemptSummary[];

  // Timing
  total_generation_time_ms: number;
  total_audit_time_ms: number;
}

interface AttemptSummary {
  attempt_index: number;
  timestamp: string;
  result: 'passed' | 'soft_fail' | 'hard_fail';
  composite_score: number;
  reason_codes: string[];
  action_taken?: string;
  duration_ms: number;
}
```

### Example Metrics File (frame_3_metrics.json)

```json
{
  "frame_index": 3,
  "computed_at": "2026-01-18T14:30:52.000Z",

  "passed": true,
  "status": "approved",
  "reason_codes": [],

  "composite_score": 0.87,
  "threshold": 0.70,
  "breakdown": {
    "identity": { "raw": 0.92, "weighted": 0.276, "passed": true },
    "stability": { "raw": 0.88, "weighted": 0.308, "passed": true },
    "palette": { "raw": 0.85, "weighted": 0.170, "passed": true },
    "style": { "raw": 0.78, "weighted": 0.117, "passed": true }
  },

  "metrics": {
    "ssim": 0.92,
    "palette_fidelity": 0.85,
    "alpha_artifact_score": 0.05,
    "baseline_drift_px": 1.2,
    "orphan_pixel_count": 3,
    "mapd": {
      "value": 0.015,
      "threshold": 0.02,
      "move_type": "idle_standard",
      "passed": true,
      "bypassed": false
    }
  },

  "attempt_count": 2,
  "attempts": [
    {
      "attempt_index": 1,
      "timestamp": "2026-01-18T14:30:00.000Z",
      "result": "soft_fail",
      "composite_score": 0.65,
      "reason_codes": ["SF01_IDENTITY_DRIFT"],
      "action_taken": "identity_rescue",
      "duration_ms": 4500
    },
    {
      "attempt_index": 2,
      "timestamp": "2026-01-18T14:30:45.000Z",
      "result": "passed",
      "composite_score": 0.87,
      "reason_codes": [],
      "duration_ms": 4200
    }
  ],

  "total_generation_time_ms": 8700,
  "total_audit_time_ms": 1500
}
```

### CSV Export Format

```csv
frame_index,status,composite_score,identity,stability,palette,style,ssim,palette_fidelity,baseline_drift,attempt_count
0,approved,0.92,0.95,0.90,0.88,0.82,0.95,0.88,0.5,1
1,approved,0.85,0.88,0.85,0.82,0.78,0.88,0.82,1.2,2
2,approved,0.88,0.90,0.88,0.85,0.80,0.90,0.85,0.8,1
3,approved,0.87,0.92,0.88,0.85,0.78,0.92,0.85,1.2,2
4,failed,0.58,0.45,0.72,0.68,0.55,0.45,0.68,3.5,5
5,approved,0.83,0.85,0.82,0.80,0.75,0.85,0.80,1.5,3
6,approved,0.90,0.92,0.90,0.88,0.82,0.92,0.88,0.6,1
7,approved,0.86,0.88,0.85,0.82,0.78,0.88,0.82,1.0,2
```

### Metrics Writer Integration

```typescript
// In auditor.ts, after completing audit
async function auditFrame(
  framePath: string,
  frameIndex: number,
  context: AuditContext
): Promise<AuditResult> {
  const result = await runAuditPipeline(framePath, context);

  // Write metrics file
  const metrics = aggregateFrameMetrics(result, context.attemptHistory);
  await writeFrameMetrics(context.runId, frameIndex, metrics);

  return result;
}
```

### CSV Export Implementation

```typescript
async function exportMetricsToCSV(runId: string): Promise<string> {
  const metrics = await readAllFrameMetrics(runId);

  const headers = [
    'frame_index', 'status', 'composite_score',
    'identity', 'stability', 'palette', 'style',
    'ssim', 'palette_fidelity', 'baseline_drift',
    'attempt_count'
  ];

  const rows = metrics.map(m => [
    m.frame_index,
    m.status,
    m.composite_score.toFixed(2),
    m.breakdown.identity.raw.toFixed(2),
    m.breakdown.stability.raw.toFixed(2),
    m.breakdown.palette.raw.toFixed(2),
    m.breakdown.style.raw.toFixed(2),
    m.metrics.ssim.toFixed(2),
    m.metrics.palette_fidelity.toFixed(2),
    m.metrics.baseline_drift_px.toFixed(1),
    m.attempt_count
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}
```

### Project Structure Notes

- New: `src/core/metrics/frame-metrics-writer.ts`
- New: `src/core/metrics/csv-exporter.ts`
- New: `src/domain/types/frame-metrics.ts`
- Modify: `src/core/auditor.ts` (integrate metrics writing)
- Tests: `test/core/metrics/frame-metrics-writer.test.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.2]
- [Source: stories/3-8-implement-soft-metric-aggregation.md]

---

## Dev Agent Record

### Agent Model Used

**Codex-CLI**

**Rationale:** JSON file generation with optional CSV export. Well-defined schema and straightforward aggregation logic. No complex decision trees.

### Debug Log References

*(To be filled during implementation)*

### Completion Notes List

*(To be filled during implementation)*

### File List

*(To be filled during implementation)*
