# Story 5.5: Implement Pre-Export Validation Checklist

Status: ready-for-dev

---

## Story

**As an** operator,
**I want** approved frames validated before packing,
**So that** export problems are caught early.

---

## Acceptance Criteria

### 12-Item Validation Checklist

1. **Frame count** - All frames present (count matches manifest)
2. **Dimensions** - Dimensions match target canvas size
3. **Alpha channel** - Alpha channel present on all frames
4. **Corruption check** - No corrupted images
5. **Naming convention** - Naming convention valid
6. **No duplicates** - No duplicate frames (by hash)
7. **File sizes** - File sizes within bounds
8. **Color depth** - Color depth is 32-bit RGBA
9. **No stray files** - No stray files in approved folder
10. **Contiguous sequence** - Frame sequence is contiguous (no gaps)
11. **Total size** - Total file size reasonable for packing
12. **Bounding box consistency** - Bounding box consistency across frames (prevents trim jitter)

### Behavior

13. **Specific reporting** - Failures reported with specific frame and issue
14. **Blocking** - Export blocked on pre-validation failure

---

## Tasks / Subtasks

- [ ] **Task 1: Create validation checklist runner** (AC: #1-12)
  - [ ] 1.1: Create `src/core/export/pre-export-validator.ts`
  - [ ] 1.2: Define `PreExportCheck` interface with name, check function, severity
  - [ ] 1.3: Implement `runPreExportChecks(approvedPath: string, manifest: Manifest): ValidationResult`
  - [ ] 1.4: Run all 12 checks in sequence

- [ ] **Task 2: Implement frame count check** (AC: #1)
  - [ ] 2.1: Count PNG files in approved folder
  - [ ] 2.2: Compare against `manifest.identity.frame_count`
  - [ ] 2.3: Report: "Expected 8 frames, found 7"
  - [ ] 2.4: List missing frame indices

- [ ] **Task 3: Implement dimension check** (AC: #2)
  - [ ] 3.1: For each frame, load with Sharp and get metadata
  - [ ] 3.2: Compare against `manifest.canvas.target_size`
  - [ ] 3.3: Report: "Frame 3: Expected 128x128, found 127x128"
  - [ ] 3.4: Check both width and height

- [ ] **Task 4: Implement alpha channel check** (AC: #3, #8)
  - [ ] 4.1: Verify each frame has 4 channels (RGBA)
  - [ ] 4.2: Report: "Frame 5: Missing alpha channel (3 channels found)"
  - [ ] 4.3: Verify color depth is 8 bits per channel
  - [ ] 4.4: Report: "Frame 2: Expected 32-bit RGBA, found 24-bit RGB"

- [ ] **Task 5: Implement corruption check** (AC: #4)
  - [ ] 5.1: Attempt to load each frame with Sharp
  - [ ] 5.2: Catch load errors as corruption
  - [ ] 5.3: Report: "Frame 6: Image corrupted or unreadable"
  - [ ] 5.4: Include error details in report

- [ ] **Task 6: Implement naming convention check** (AC: #5)
  - [ ] 6.1: Verify filenames match pattern `frame_XXXX.png`
  - [ ] 6.2: Report: "Invalid filename: 'sprite_3.png' (expected 'frame_0003.png')"
  - [ ] 6.3: Check for case sensitivity issues
  - [ ] 6.4: Verify file extensions

- [ ] **Task 7: Implement duplicate check** (AC: #6)
  - [ ] 7.1: Calculate SHA256 hash of each frame
  - [ ] 7.2: Detect duplicate hashes
  - [ ] 7.3: Report: "Duplicate frames detected: frame_0003.png == frame_0004.png"
  - [ ] 7.4: This might indicate copy-paste error

- [ ] **Task 8: Implement file size check** (AC: #7, #11)
  - [ ] 8.1: For each frame, check file size is 1KB - 500KB
  - [ ] 8.2: Report: "Frame 1: File too small (512 bytes) - may be empty"
  - [ ] 8.3: Sum all frame sizes for total
  - [ ] 8.4: Warn if total exceeds 50MB (reasonable for packing)

- [ ] **Task 9: Implement stray file check** (AC: #9)
  - [ ] 9.1: List all files in approved folder
  - [ ] 9.2: Filter out expected frame files
  - [ ] 9.3: Report: "Stray files found: thumbs.db, .DS_Store"
  - [ ] 9.4: Ignore common system files (configurable)

- [ ] **Task 10: Implement sequence contiguity check** (AC: #10)
  - [ ] 10.1: Extract frame indices from filenames
  - [ ] 10.2: Sort and check for gaps
  - [ ] 10.3: Report: "Missing frames: 4, 5" (gap detected)
  - [ ] 10.4: Verify sequence starts at 0

- [ ] **Task 11: Implement bounding box consistency check** (AC: #12)
  - [ ] 11.1: For each frame, calculate opaque bounding box
  - [ ] 11.2: Check variance across frames (allow ±5%)
  - [ ] 11.3: Report: "Bounding box variance too high: frame 3 is 50% larger"
  - [ ] 11.4: This prevents trim jitter in TexturePacker

- [ ] **Task 12: Implement failure reporting** (AC: #13, #14)
  - [ ] 12.1: Aggregate all check results
  - [ ] 12.2: Format report with frame-specific issues
  - [ ] 12.3: Return blocking result if any critical check fails
  - [ ] 12.4: Log report to `runs/{run_id}/pre_export_validation.json`

- [ ] **Task 13: Write tests** (AC: all)
  - [ ] 13.1: Test each individual check with valid/invalid inputs
  - [ ] 13.2: Test aggregation of multiple failures
  - [ ] 13.3: Test blocking behavior
  - [ ] 13.4: Test report format

---

## Dev Notes

### PreExportCheck Interface

```typescript
interface PreExportCheck {
  id: string;
  name: string;
  severity: 'critical' | 'warning';
  check: (frames: FrameInfo[], manifest: Manifest) => Promise<CheckResult>;
}

interface CheckResult {
  passed: boolean;
  message?: string;
  details?: Record<string, unknown>;
  affectedFrames?: number[];
}

interface FrameInfo {
  index: number;
  path: string;
  metadata?: Sharp.Metadata;
  hash?: string;
}
```

### 12-Check Registry

```typescript
const PRE_EXPORT_CHECKS: PreExportCheck[] = [
  {
    id: 'frame_count',
    name: 'Frame Count',
    severity: 'critical',
    check: checkFrameCount
  },
  {
    id: 'dimensions',
    name: 'Dimensions',
    severity: 'critical',
    check: checkDimensions
  },
  {
    id: 'alpha_channel',
    name: 'Alpha Channel',
    severity: 'critical',
    check: checkAlphaChannel
  },
  {
    id: 'corruption',
    name: 'Image Corruption',
    severity: 'critical',
    check: checkCorruption
  },
  {
    id: 'naming',
    name: 'Naming Convention',
    severity: 'warning',
    check: checkNamingConvention
  },
  {
    id: 'duplicates',
    name: 'Duplicate Detection',
    severity: 'warning',
    check: checkDuplicates
  },
  {
    id: 'file_size',
    name: 'File Size Bounds',
    severity: 'warning',
    check: checkFileSizeBounds
  },
  {
    id: 'color_depth',
    name: 'Color Depth (32-bit)',
    severity: 'critical',
    check: checkColorDepth
  },
  {
    id: 'stray_files',
    name: 'Stray Files',
    severity: 'warning',
    check: checkStrayFiles
  },
  {
    id: 'sequence',
    name: 'Sequence Contiguity',
    severity: 'critical',
    check: checkSequenceContiguity
  },
  {
    id: 'total_size',
    name: 'Total Size',
    severity: 'warning',
    check: checkTotalSize
  },
  {
    id: 'bounding_box',
    name: 'Bounding Box Consistency',
    severity: 'warning',
    check: checkBoundingBoxConsistency
  }
];
```

### Example Validation Report

```json
{
  "run_id": "abc123",
  "validated_at": "2026-01-18T14:00:00.000Z",
  "approved_path": "runs/abc123/approved/",
  "passed": false,
  "summary": {
    "total_checks": 12,
    "passed": 10,
    "failed": 2,
    "warnings": 1
  },
  "checks": [
    {
      "id": "frame_count",
      "name": "Frame Count",
      "severity": "critical",
      "passed": true,
      "message": "All 8 frames present"
    },
    {
      "id": "dimensions",
      "name": "Dimensions",
      "severity": "critical",
      "passed": false,
      "message": "Dimension mismatch on 1 frame",
      "affectedFrames": [3],
      "details": {
        "expected": { "w": 128, "h": 128 },
        "actual": { "w": 127, "h": 128 }
      }
    },
    {
      "id": "duplicates",
      "name": "Duplicate Detection",
      "severity": "warning",
      "passed": false,
      "message": "Duplicate frames detected",
      "affectedFrames": [3, 4],
      "details": {
        "hash": "abc123def456...",
        "duplicate_pairs": [[3, 4]]
      }
    }
  ],
  "blocking": true,
  "blocking_reason": "Critical check 'dimensions' failed"
}
```

### Bounding Box Consistency Algorithm

```typescript
async function checkBoundingBoxConsistency(
  frames: FrameInfo[]
): Promise<CheckResult> {
  const bounds: Array<{ w: number; h: number }> = [];

  for (const frame of frames) {
    const bbox = await calculateOpaqueBounds(frame.path);
    bounds.push({ w: bbox.right - bbox.left, h: bbox.bottom - bbox.top });
  }

  // Calculate mean size
  const meanW = bounds.reduce((s, b) => s + b.w, 0) / bounds.length;
  const meanH = bounds.reduce((s, b) => s + b.h, 0) / bounds.length;

  // Check variance (allow ±20%)
  const threshold = 0.20;
  const outliers: number[] = [];

  bounds.forEach((b, i) => {
    const wDiff = Math.abs(b.w - meanW) / meanW;
    const hDiff = Math.abs(b.h - meanH) / meanH;
    if (wDiff > threshold || hDiff > threshold) {
      outliers.push(i);
    }
  });

  if (outliers.length > 0) {
    return {
      passed: false,
      message: `Bounding box variance too high on ${outliers.length} frames`,
      affectedFrames: outliers,
      details: { meanSize: { w: meanW, h: meanH }, threshold }
    };
  }

  return { passed: true };
}
```

### Project Structure Notes

- New: `src/core/export/pre-export-validator.ts`
- New: `src/core/export/checks/*.ts` (individual check implementations)
- Integrates with: Story 5.3 (before atlas export)
- Tests: `test/core/export/pre-export-validator.test.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.5]
- [Source: Agentic-Sprite-Sheet-Deep-Research/Phaser3_Export_Compliance_Kit.md#Pre-Export Validation]

---

## Dev Agent Record

### Agent Model Used

**Codex-CLI**

**Rationale:** 12-item checklist with independent checks. Each check is well-defined with clear pass/fail criteria. No complex interdependencies between checks.

### Debug Log References

*(To be filled during implementation)*

### Completion Notes List

*(To be filled during implementation)*

### File List

*(To be filled during implementation)*
