# Story 5.6: Implement Post-Export Validation

Status: done

---

## Story

**As an** operator,
**I want** exported atlas validated after packing,
**So that** I know the output is structurally correct.

---

## Acceptance Criteria

### Validation Checks

1. **JSON structure** - JSON structure integrity verified (valid JSON, correct schema)
2. **Frame data** - Frame data verified (all expected frames present in JSON)
3. **PNG integrity** - PNG integrity verified (valid image, correct dimensions)
4. **Frame key format** - Frame key format matches `{ACTION}/{ZERO_PAD}` pattern
5. **Structured output** - Validation results logged as structured PASS/FAIL

---

## Tasks / Subtasks

- [x] **Task 1: Create post-export validator** (AC: #1-5)
  - [x] 1.1: Create `src/core/export/post-export-validator.ts`
  - [x] 1.2: Implement `validateExportedAtlas(atlasPath: AtlasPaths, manifest: Manifest): ValidationResult`
  - [x] 1.3: Run all validation checks
  - [x] 1.4: Return structured result

- [x] **Task 2: Implement JSON structure validation** (AC: #1)
  - [x] 2.1: Parse JSON file and catch parse errors
  - [x] 2.2: Validate against atlas Zod schema (from Story 5.3)
  - [x] 2.3: Check for `frames` object or `textures` array (multipack)
  - [x] 2.4: Report: "JSON parse error at line 42: unexpected token"

- [x] **Task 3: Implement frame data validation** (AC: #2)
  - [x] 3.1: Count frames in JSON (handle both single and multipack)
  - [x] 3.2: Compare against `manifest.identity.frame_count`
  - [x] 3.3: Report missing frame keys
  - [x] 3.4: Report extra unexpected frame keys

- [x] **Task 4: Implement PNG integrity validation** (AC: #3)
  - [x] 4.1: Load PNG with Sharp
  - [x] 4.2: Verify dimensions match `meta.size`
  - [x] 4.3: Verify format is PNG with alpha
  - [x] 4.4: Report: "PNG dimensions 512x256 don't match meta.size 512x128"

- [x] **Task 5: Implement frame key format validation** (AC: #4)
  - [x] 5.1: Extract all frame keys from JSON
  - [x] 5.2: Validate each against regex `^[a-z_]+/\d{4}$`
  - [x] 5.3: Report invalid keys: "Invalid key 'idle_0001' (expected 'idle/0001')"
  - [x] 5.4: Verify keys use correct move ID from manifest

- [x] **Task 6: Implement cross-reference validation** (AC: #2, #3)
  - [x] 6.1: Verify each frame's position is within PNG bounds
  - [x] 6.2: Check frame.x + frame.w <= meta.size.w
  - [x] 6.3: Check frame.y + frame.h <= meta.size.h
  - [x] 6.4: Report: "Frame 'idle/0005' extends beyond atlas bounds"

- [x] **Task 7: Implement structured result output** (AC: #5)
  - [x] 7.1: Create `PostExportValidationResult` interface
  - [x] 7.2: Include individual check results
  - [x] 7.3: Log to `runs/{run_id}/export_validation.json`
  - [x] 7.4: Include pass/fail summary

- [x] **Task 8: Write tests** (AC: all)
  - [x] 8.1: Test valid atlas passes all checks
  - [x] 8.2: Test invalid JSON is caught
  - [x] 8.3: Test missing frames are detected
  - [x] 8.4: Test PNG dimension mismatch is caught
  - [x] 8.5: Test invalid frame keys are caught

---

## Dev Notes

### PostExportValidationResult Interface

```typescript
interface PostExportValidationResult {
  passed: boolean;
  atlas_path: string;
  validated_at: string;
  checks: {
    json_structure: CheckResult;
    frame_count: CheckResult;
    frame_keys: CheckResult;
    png_integrity: CheckResult;
    bounds_check: CheckResult;
  };
  summary: {
    total_frames: number;
    valid_frames: number;
    issues: string[];
  };
}
```

### JSON Structure Validation

```typescript
async function validateJsonStructure(
  jsonPath: string
): Promise<CheckResult> {
  try {
    const content = await fs.readFile(jsonPath, 'utf-8');
    const json = JSON.parse(content);

    // Check for single vs multipack
    if (json.frames) {
      // Single pack - validate frames object
      return { passed: true, format: 'single' };
    } else if (json.textures && Array.isArray(json.textures)) {
      // Multipack - validate textures array
      return { passed: true, format: 'multipack' };
    } else {
      return {
        passed: false,
        message: "Invalid atlas structure: missing 'frames' or 'textures'"
      };
    }
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        passed: false,
        message: `JSON parse error: ${error.message}`
      };
    }
    throw error;
  }
}
```

### Frame Bounds Validation

```typescript
async function validateFrameBounds(
  json: AtlasJson,
  pngPath: string
): Promise<CheckResult> {
  const pngMeta = await sharp(pngPath).metadata();
  const issues: string[] = [];

  const frames = json.frames || collectMultipackFrames(json);

  for (const [key, data] of Object.entries(frames)) {
    const { x, y, w, h } = data.frame;

    if (x + w > pngMeta.width) {
      issues.push(`${key}: x(${x}) + w(${w}) = ${x + w} > PNG width ${pngMeta.width}`);
    }
    if (y + h > pngMeta.height) {
      issues.push(`${key}: y(${y}) + h(${h}) = ${y + h} > PNG height ${pngMeta.height}`);
    }
  }

  if (issues.length > 0) {
    return {
      passed: false,
      message: `${issues.length} frames extend beyond atlas bounds`,
      details: { issues: issues.slice(0, 10) }  // Limit to 10
    };
  }

  return { passed: true };
}
```

### Frame Key Validation

```typescript
function validateFrameKeys(
  frameKeys: string[],
  moveId: string
): CheckResult {
  const expectedPattern = new RegExp(`^${moveId}/\\d{4}$`);
  const invalid: string[] = [];

  for (const key of frameKeys) {
    if (!expectedPattern.test(key)) {
      invalid.push(key);
    }
  }

  if (invalid.length > 0) {
    return {
      passed: false,
      message: `${invalid.length} frame keys don't match expected pattern`,
      details: {
        expectedPattern: `${moveId}/XXXX`,
        invalidKeys: invalid.slice(0, 10)
      }
    };
  }

  return { passed: true };
}
```

### Example Validation Output

```json
{
  "passed": true,
  "atlas_path": "runs/abc123/export/blaze_idle.json",
  "validated_at": "2026-01-18T14:30:00.000Z",
  "checks": {
    "json_structure": {
      "passed": true,
      "format": "single"
    },
    "frame_count": {
      "passed": true,
      "expected": 8,
      "found": 8
    },
    "frame_keys": {
      "passed": true,
      "pattern": "idle_standard/XXXX"
    },
    "png_integrity": {
      "passed": true,
      "dimensions": { "w": 512, "h": 256 },
      "format": "png",
      "channels": 4
    },
    "bounds_check": {
      "passed": true,
      "frames_checked": 8
    }
  },
  "summary": {
    "total_frames": 8,
    "valid_frames": 8,
    "issues": []
  }
}
```

### Failed Validation Example

```json
{
  "passed": false,
  "atlas_path": "runs/abc123/export/blaze_idle.json",
  "validated_at": "2026-01-18T14:30:00.000Z",
  "checks": {
    "json_structure": {
      "passed": true,
      "format": "single"
    },
    "frame_count": {
      "passed": false,
      "expected": 8,
      "found": 7,
      "missing": ["idle_standard/0005"]
    },
    "frame_keys": {
      "passed": false,
      "message": "1 frame key doesn't match expected pattern",
      "invalidKeys": ["idle-standard/0006"]
    },
    "png_integrity": {
      "passed": true
    },
    "bounds_check": {
      "passed": true
    }
  },
  "summary": {
    "total_frames": 7,
    "valid_frames": 6,
    "issues": [
      "Missing frame: idle_standard/0005",
      "Invalid frame key: idle-standard/0006 (uses hyphen instead of underscore)"
    ]
  }
}
```

### Project Structure Notes

- New: `src/core/export/post-export-validator.ts`
- Integrates with: Story 5.3 (after atlas export), Story 5.7 (before Phaser tests)
- Tests: `test/core/export/post-export-validator.test.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.6]
- [Source: Agentic-Sprite-Sheet-Deep-Research/Phaser3_Export_Compliance_Kit.md#Post-Export Validation]

---

## Dev Agent Record

### Agent Model Used

**Codex-CLI**

**Rationale:** JSON/PNG integrity checks with well-defined validation logic. Clear pass/fail criteria for each check. No complex decision trees.

### Debug Log References

- Code review completed 2026-01-19

### Completion Notes List

- All 8 tasks completed
- post-export-validator.ts implements full validation suite
- Checks JSON structure, frame count, frame keys, PNG integrity, bounds
- Supports both single and multipack formats
- Structured PostExportValidationResult output
- Saves validation results to export_validation.json
- 12 tests passing

### File List

- `src/core/export/post-export-validator.ts` - Post-export validation logic
- `test/core/export/post-export-validator.test.ts` - Unit tests

### Completion Date

2026-01-19
