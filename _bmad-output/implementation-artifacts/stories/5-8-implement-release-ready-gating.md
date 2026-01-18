# Story 5.8: Implement Release-Ready Gating

Status: ready-for-dev

---

## Story

**As an** operator,
**I want** release-ready status blocked if validation fails,
**So that** broken assets don't ship to production.

---

## Acceptance Criteria

### Gating Logic

1. **Block on failure** - Run NOT marked "release-ready" if any micro-test fails
2. **Failure logging** - Failure reason clearly logged
3. **Asset retention** - Assets remain in `export/` but are not promoted
4. **Pass promotion** - If all tests pass, run marked "release-ready"
5. **Asset promotion** - Assets can be promoted to final output location

### Override Flag

6. **Debug override** - `--allow-validation-fail` flag allows export with warning (NFR26)
7. **Debug marking** - Override run marked as "debug-only, not release-ready"

---

## Tasks / Subtasks

- [ ] **Task 1: Define release status enum** (AC: #1, #4, #7)
  - [ ] 1.1: Create `ReleaseStatus` type: `release-ready`, `validation-failed`, `debug-only`
  - [ ] 1.2: Add to state.json schema
  - [ ] 1.3: Default to `validation-failed` until proven otherwise
  - [ ] 1.4: Document status meanings

- [ ] **Task 2: Implement gating logic** (AC: #1, #4)
  - [ ] 2.1: Create `evaluateReleaseReadiness(validationResults: ValidationSummary): ReleaseStatus`
  - [ ] 2.2: If all tests pass → `release-ready`
  - [ ] 2.3: If any test fails → `validation-failed`
  - [ ] 2.4: Log status determination

- [ ] **Task 3: Implement failure logging** (AC: #2)
  - [ ] 3.1: On validation failure, log specific failed tests
  - [ ] 3.2: Include failure reasons from each test
  - [ ] 3.3: Suggest remediation steps
  - [ ] 3.4: Log to both console and run artifacts

- [ ] **Task 4: Implement asset retention** (AC: #3)
  - [ ] 4.1: Keep atlas in `export/` regardless of validation outcome
  - [ ] 4.2: Do NOT delete assets on failure
  - [ ] 4.3: Mark assets with validation status in metadata
  - [ ] 4.4: Allow re-validation without re-export

- [ ] **Task 5: Implement promotion logic** (AC: #5)
  - [ ] 5.1: Create `promoteToRelease(runId: string, outputPath: string): Promise<void>`
  - [ ] 5.2: Copy atlas files to final output location
  - [ ] 5.3: Only allow promotion if status is `release-ready`
  - [ ] 5.4: Update state to track promotion

- [ ] **Task 6: Implement override flag** (AC: #6, #7)
  - [ ] 6.1: Add `--allow-validation-fail` flag to CLI
  - [ ] 6.2: When flag set, allow export despite failures
  - [ ] 6.3: Set status to `debug-only`
  - [ ] 6.4: Log warning: "⚠️ Assets exported with validation failures - DEBUG ONLY"

- [ ] **Task 7: Integrate with pipeline flow** (AC: all)
  - [ ] 7.1: After micro-tests, evaluate release readiness
  - [ ] 7.2: Update state.json with release_status
  - [ ] 7.3: Report final status to CLI output
  - [ ] 7.4: Block promotion unless release-ready (or override)

- [ ] **Task 8: Write tests** (AC: all)
  - [ ] 8.1: Test release-ready on all tests pass
  - [ ] 8.2: Test validation-failed on any test fail
  - [ ] 8.3: Test override flag sets debug-only
  - [ ] 8.4: Test promotion blocked without release-ready
  - [ ] 8.5: Test assets retained on failure

---

## Dev Notes

### ReleaseStatus Type

```typescript
type ReleaseStatus =
  | 'pending'           // Not yet validated
  | 'release-ready'     // All validations passed
  | 'validation-failed' // One or more validations failed
  | 'debug-only';       // Exported with --allow-validation-fail

interface ReleaseInfo {
  status: ReleaseStatus;
  evaluated_at: string;
  validation_summary: {
    tests_passed: number;
    tests_failed: number;
    failed_tests: string[];
  };
  override_used: boolean;
  promoted: boolean;
  promoted_to?: string;
}
```

### Gating Logic

```typescript
function evaluateReleaseReadiness(
  validationResults: ValidationSummary,
  allowValidationFail: boolean
): ReleaseInfo {
  const failedTests = Object.entries(validationResults.tests)
    .filter(([_, result]) => !result.passed)
    .map(([name, _]) => name);

  if (failedTests.length === 0) {
    return {
      status: 'release-ready',
      evaluated_at: new Date().toISOString(),
      validation_summary: {
        tests_passed: 3,
        tests_failed: 0,
        failed_tests: []
      },
      override_used: false,
      promoted: false
    };
  }

  if (allowValidationFail) {
    logger.warn({
      event: 'validation_override',
      message: 'Assets exported with validation failures - DEBUG ONLY',
      failed_tests: failedTests
    });

    return {
      status: 'debug-only',
      evaluated_at: new Date().toISOString(),
      validation_summary: {
        tests_passed: 3 - failedTests.length,
        tests_failed: failedTests.length,
        failed_tests: failedTests
      },
      override_used: true,
      promoted: false
    };
  }

  return {
    status: 'validation-failed',
    evaluated_at: new Date().toISOString(),
    validation_summary: {
      tests_passed: 3 - failedTests.length,
      tests_failed: failedTests.length,
      failed_tests: failedTests
    },
    override_used: false,
    promoted: false
  };
}
```

### Promotion Logic

```typescript
async function promoteToRelease(
  runId: string,
  outputPath: string
): Promise<Result<void, SystemError>> {
  const state = await loadRunState(runId);

  if (state.release_info.status !== 'release-ready') {
    return Result.err({
      code: 'SYS_PROMOTION_BLOCKED',
      message: `Cannot promote: status is '${state.release_info.status}'`,
      suggestion: state.release_info.status === 'validation-failed'
        ? 'Fix validation issues or use --allow-validation-fail for debug builds'
        : undefined
    });
  }

  // Copy atlas files to output path
  const exportDir = path.join('runs', runId, 'export');
  const files = await glob(path.join(exportDir, '*'));

  for (const file of files) {
    const dest = path.join(outputPath, path.basename(file));
    await fs.copyFile(file, dest);
  }

  // Update state
  state.release_info.promoted = true;
  state.release_info.promoted_to = outputPath;
  await saveRunState(state);

  logger.info({
    event: 'assets_promoted',
    run_id: runId,
    output_path: outputPath,
    files: files.map(f => path.basename(f))
  });

  return Result.ok(undefined);
}
```

### CLI Output Examples

**Validation Passed:**
```
═══════════════════════════════════════════════════════
✅ RELEASE READY

All validation tests passed:
  ✅ TEST-02 (Pivot Auto-Apply)
  ✅ TEST-03 (Trim Mode Jitter)
  ✅ TEST-04 (Suffix Convention)

Assets ready for production:
  runs/abc123/export/blaze_idle.png
  runs/abc123/export/blaze_idle.json

To promote to final location:
  pipeline promote abc123 --output ./assets/sprites/
═══════════════════════════════════════════════════════
```

**Validation Failed:**
```
═══════════════════════════════════════════════════════
❌ VALIDATION FAILED

1 of 3 tests failed:
  ✅ TEST-02 (Pivot Auto-Apply)
  ❌ TEST-03 (Trim Mode Jitter) - 3px variance detected
  ✅ TEST-04 (Suffix Convention)

Assets remain in: runs/abc123/export/

Suggested actions:
  1. Review validation/test-03-jitter.png for visual inspection
  2. Check approved frames for bounding box consistency
  3. Re-run generation with stricter alignment

For debug builds, use: --allow-validation-fail
═══════════════════════════════════════════════════════
```

**Override Used:**
```
═══════════════════════════════════════════════════════
⚠️ DEBUG ONLY (Validation Override)

1 of 3 tests failed but --allow-validation-fail was used:
  ✅ TEST-02 (Pivot Auto-Apply)
  ❌ TEST-03 (Trim Mode Jitter)
  ✅ TEST-04 (Suffix Convention)

⚠️ These assets are NOT release-ready.
⚠️ Use for development/testing only.

Assets exported to: runs/abc123/export/
═══════════════════════════════════════════════════════
```

### State.json Release Info

```json
{
  "run_id": "abc123",
  "run_status": "completed",
  "release_info": {
    "status": "release-ready",
    "evaluated_at": "2026-01-18T15:00:00.000Z",
    "validation_summary": {
      "tests_passed": 3,
      "tests_failed": 0,
      "failed_tests": []
    },
    "override_used": false,
    "promoted": true,
    "promoted_to": "./assets/sprites/blaze/"
  }
}
```

### Project Structure Notes

- New: `src/core/export/release-gating.ts`
- New: `src/commands/pipeline/promote.ts`
- Modify: `src/core/orchestrator.ts` (integrate release evaluation)
- Modify: `src/commands/pipeline/run.ts` (add --allow-validation-fail)
- Tests: `test/core/export/release-gating.test.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.8]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR26]

---

## Dev Agent Record

### Agent Model Used

**Codex-CLI**

**Rationale:** Pass/fail logic with override flag. Clear flow from validation to release status. Well-defined state transitions.

### Debug Log References

*(To be filled during implementation)*

### Completion Notes List

*(To be filled during implementation)*

### File List

*(To be filled during implementation)*
