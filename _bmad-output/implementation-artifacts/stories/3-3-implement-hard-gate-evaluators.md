# Story 3.3: Implement Hard Gate Evaluators (HF01-HF05)

Status: done

---

## Story

**As an** operator,
**I want** frames evaluated against hard gates that block on failure,
**So that** fundamentally broken frames are rejected immediately.

---

## Acceptance Criteria

### Hard Gate Checks

1. **HF01 Dimension Check** - Verifies exact canvas size match (128×128 or 256×256)
2. **HF02 Alpha Integrity** - Verifies frame is not fully transparent (no content)
3. **HF03 Corruption Check** - Verifies image is readable and not corrupted
4. **HF04 Color Depth** - Verifies 32-bit RGBA format
5. **HF05 File Size** - Verifies file is within reasonable bounds (10KB - 5MB)

### Result Handling

6. **Error return** - Any hard gate failure returns `Result.err()` with `HFxx` error code
7. **Failure logging** - Hard gate failures are logged with specific failure reason
8. **Performance** - Hard gate evaluation completes in ≤1 second total

---

## Tasks / Subtasks

- [x] **Task 1: Create hard gate evaluator module** (AC: all)
  - [x] 1.1: Create `src/core/hard-gate-evaluator.ts`
  - [x] 1.2: Define `HardGateResult` interface
  - [x] 1.3: Implement `evaluateHardGates(imagePath: string, config: CanvasConfig): Result<HardGateResult, SystemError>`
  - [x] 1.4: Run all 5 gates in sequence, stop on first failure

- [x] **Task 2: Implement HF01 Dimension Check** (AC: #1)
  - [x] 2.1: Load image metadata with Sharp
  - [x] 2.2: Compare `width` and `height` to `canvas.target_size`
  - [x] 2.3: Return `HF01_DIMENSION_MISMATCH` if mismatch
  - [x] 2.4: Include expected vs actual dimensions in error

- [x] **Task 3: Implement HF02 Alpha Integrity** (AC: #2)
  - [x] 3.1: Load raw pixel data with Sharp
  - [x] 3.2: Scan alpha channel for any non-zero values
  - [x] 3.3: Return `HF02_FULLY_TRANSPARENT` if all pixels are transparent
  - [x] 3.4: Calculate percentage of opaque pixels for logging

- [x] **Task 4: Implement HF03 Corruption Check** (AC: #3)
  - [x] 4.1: Attempt to load image with Sharp
  - [x] 4.2: Try to read metadata and raw buffer
  - [x] 4.3: Return `HF03_IMAGE_CORRUPTED` if Sharp throws
  - [x] 4.4: Include original error message in result

- [x] **Task 5: Implement HF04 Color Depth Check** (AC: #4)
  - [x] 5.1: Check `metadata().channels` equals 4
  - [x] 5.2: Check `metadata().depth` is appropriate for RGBA
  - [x] 5.3: Return `HF04_WRONG_COLOR_DEPTH` if not 32-bit RGBA
  - [x] 5.4: Support both 8-bit per channel and 16-bit per channel

- [x] **Task 6: Implement HF05 File Size Check** (AC: #5)
  - [x] 6.1: Get file size using `fs.stat()`
  - [x] 6.2: Define bounds: min = 10KB (10 * 1024), max = 5MB (5 * 1024 * 1024)
  - [x] 6.3: Return `HF05_FILE_SIZE_INVALID` if outside bounds
  - [x] 6.4: Include actual size and bounds in error

- [x] **Task 7: Implement result aggregation** (AC: #6, #8)
  - [x] 7.1: Track timing for each gate
  - [x] 7.2: Return on first failure (fail-fast)
  - [x] 7.3: Build `HardGateResult` with all gate statuses
  - [x] 7.4: Log total evaluation time

- [x] **Task 8: Implement logging** (AC: #7)
  - [x] 8.1: Log each gate result (pass/fail)
  - [x] 8.2: Log failure reason with context
  - [x] 8.3: Log to `audit_log.jsonl`
  - [x] 8.4: Include gate timing in metrics

- [x] **Task 9: Write tests** (AC: all)
  - [x] 9.1: Test HF01 with correct dimensions passes
  - [x] 9.2: Test HF01 with wrong dimensions fails
  - [x] 9.3: Test HF02 with valid sprite passes
  - [x] 9.4: Test HF02 with transparent image fails
  - [x] 9.5: Test HF03 with valid PNG passes
  - [x] 9.6: Test HF03 with corrupted file fails
  - [x] 9.7: Test HF04 with RGBA passes
  - [x] 9.8: Test HF04 with RGB-only fails
  - [x] 9.9: Test HF05 with normal file passes
  - [x] 9.10: Test HF05 with tiny/huge file fails

---

## Dev Notes

### Hard Gate Error Codes

| Code | Name | Description | Recoverable? |
|------|------|-------------|--------------|
| HF01 | DIMENSION_MISMATCH | Canvas size incorrect | No - retry won't help |
| HF02 | FULLY_TRANSPARENT | No visible content | Yes - regenerate |
| HF03 | IMAGE_CORRUPTED | File unreadable | Yes - regenerate |
| HF04 | WRONG_COLOR_DEPTH | Not 32-bit RGBA | No - indicates pipeline bug |
| HF05 | FILE_SIZE_INVALID | Size outside bounds | Yes - regenerate |

### HardGateResult Interface

```typescript
interface HardGateResult {
  passed: boolean;
  gates: {
    HF01: GateStatus;
    HF02: GateStatus;
    HF03: GateStatus;
    HF04: GateStatus;
    HF05: GateStatus;
  };
  failedGate?: 'HF01' | 'HF02' | 'HF03' | 'HF04' | 'HF05';
  failureReason?: string;
  evaluationTimeMs: number;
}

interface GateStatus {
  passed: boolean;
  timeMs: number;
  details?: Record<string, unknown>;
}
```

### Fail-Fast Implementation

```typescript
async function evaluateHardGates(imagePath: string, config: CanvasConfig): Promise<Result<HardGateResult, SystemError>> {
  const startTime = Date.now();
  const gates: Partial<HardGateResult['gates']> = {};

  // HF01: Dimension Check
  const hf01 = await checkDimensions(imagePath, config.target_size);
  gates.HF01 = hf01;
  if (!hf01.passed) {
    return Result.err({ code: 'HF01', message: 'Dimension mismatch', details: hf01.details });
  }

  // HF02: Alpha Integrity
  const hf02 = await checkAlphaIntegrity(imagePath);
  gates.HF02 = hf02;
  if (!hf02.passed) {
    return Result.err({ code: 'HF02', message: 'Fully transparent', details: hf02.details });
  }

  // ... continue for HF03, HF04, HF05

  return Result.ok({
    passed: true,
    gates: gates as HardGateResult['gates'],
    evaluationTimeMs: Date.now() - startTime
  });
}
```

### File Size Rationale

- **Minimum (10KB):** A 128×128 PNG with any content should be at least 10KB
- **Maximum (5MB):** 512×512 raw RGBA is 1MB; 5MB allows for PNG overhead
- Files outside these bounds indicate corruption or wrong file type

### Performance Targets

| Gate | Target | Operation |
|------|--------|-----------|
| HF01 | <50ms | Read metadata only |
| HF02 | <200ms | Scan alpha channel |
| HF03 | <100ms | Try to parse PNG |
| HF04 | <50ms | Read metadata only |
| HF05 | <10ms | File stat only |
| **Total** | **<500ms** | All gates |

### Integration with Auditor

```typescript
// In auditor pipeline
const hardGateResult = await evaluateHardGates(normalizedPath, config);

if (hardGateResult.isErr()) {
  // Log failure
  await logAuditEvent({
    type: 'hard_gate_failure',
    code: hardGateResult.error.code,
    reason: hardGateResult.error.message
  });

  // Return early - no point running soft metrics
  return Result.err(hardGateResult.error);
}

// Continue to soft metrics...
```

### Project Structure Notes

- Hard gate evaluator: `src/core/hard-gate-evaluator.ts`
- Error codes: `src/domain/error-codes.ts`
- Integration: Called from `src/core/auditor.ts`

### References

- [Source: _bmad-output/project-context.md#Anti-Patterns (NEVER DO)]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.3]

---

## Dev Agent Record

### Agent Model Used

**Codex-CLI**

**Rationale:** 5 discrete checks (HF01-HF05). Each is independent and well-defined with clear pass/fail logic. No architectural decisions or complex state management.

### Debug Log References

*(To be filled during implementation)*

### Completion Notes List

*(To be filled during implementation)*

### File List

*(To be filled during implementation)*
