# Story 5.7: Implement Phaser Micro-Test Suite (TEST-02, TEST-03, TEST-04)

Status: done

---

## Story

**As an** operator,
**I want** exported atlas validated in actual Phaser 3,
**So that** I have "Engine Truth" confirmation before release.

---

## Acceptance Criteria

### Micro-Test Suite

1. **TEST-02 (Pivot)** - Pivot Auto-Apply verifies origin/pivot behavior is consistent
2. **TEST-03 (Trim Jitter)** - Trim Mode Jitter verifies no visual jitter between frames
3. **TEST-04 (Suffix)** - Suffix Convention verifies frame key resolution works
4. **Headless execution** - Each test runs in headless Chrome via Puppeteer
5. **PASS/FAIL output** - Each test reports PASS/FAIL with specific failure details
6. **Screenshot capture** - Screenshots captured for each test (FR39)
7. **Log storage** - Test logs saved to `runs/{run_id}/validation/`

---

## Tasks / Subtasks

- [x] **Task 1: Create Phaser test harness** (AC: #4)
  - [x] 1.1: Create `src/core/validation/phaser-test-harness.ts`
  - [x] 1.2: Initialize Puppeteer with WebGL support
  - [x] 1.3: Serve static HTML page with Phaser loaded
  - [x] 1.4: Establish communication channel (console.log JSON parsing)

- [x] **Task 2: Implement TEST-02 (Pivot Auto-Apply)** (AC: #1)
  - [x] 2.1: Create test scene that loads atlas
  - [x] 2.2: Create sprite and set origin to (0.5, 1) (feet)
  - [x] 2.3: Animate through all frames
  - [x] 2.4: For each frame, capture sprite's getBounds()
  - [x] 2.5: Verify bottom edge stays consistent (within 1px tolerance)
  - [x] 2.6: PASS if consistent, FAIL if jitter detected

- [x] **Task 3: Implement TEST-03 (Trim Mode Jitter)** (AC: #2)
  - [x] 3.1: Create test scene with animation at 1fps
  - [x] 3.2: Step through each frame manually
  - [x] 3.3: Capture screen position of sprite center
  - [x] 3.4: Compare positions across frames
  - [x] 3.5: PASS if positions stable, FAIL if >2px variance

- [x] **Task 4: Implement TEST-04 (Suffix Convention)** (AC: #3)
  - [x] 4.1: Load atlas with `this.load.atlas()`
  - [x] 4.2: Use `generateFrameNames()` with zeroPad: 4
  - [x] 4.3: Create animation from generated names
  - [x] 4.4: Verify all frames resolve (no missing frames)
  - [x] 4.5: PASS if animation plays, FAIL if frames missing

- [x] **Task 5: Implement screenshot capture** (AC: #6)
  - [x] 5.1: After each test, capture screenshot
  - [x] 5.2: Save to `runs/{run_id}/validation/test-02-pivot.png`
  - [x] 5.3: For jitter tests, capture frame-by-frame sequence
  - [x] 5.4: Include timestamp in filename

- [x] **Task 6: Implement test result parsing** (AC: #5)
  - [x] 6.1: Define test result JSON format
  - [x] 6.2: Parse console.log output from Phaser
  - [x] 6.3: Extract PASS/FAIL and details
  - [x] 6.4: Handle test timeouts and crashes

- [x] **Task 7: Implement log storage** (AC: #7)
  - [x] 7.1: Create `runs/{run_id}/validation/` folder
  - [x] 7.2: Save test results to `test-results.json`
  - [x] 7.3: Save console logs to `console.log`
  - [x] 7.4: Save screenshots with descriptive names

- [x] **Task 8: Create CLI command** (AC: #4, #5)
  - [x] 8.1: Add `pipeline validate <run_id>` command
  - [x] 8.2: Run all three micro-tests
  - [x] 8.3: Report summary to console
  - [x] 8.4: Return exit code based on results

- [x] **Task 9: Write tests** (AC: all)
  - [x] 9.1: Test with known-good atlas (should PASS)
  - [x] 9.2: Test with bad pivot atlas (should FAIL TEST-02)
  - [x] 9.3: Test with missing frames atlas (should FAIL TEST-04)
  - [x] 9.4: Test screenshot capture works
  - [x] 9.5: Test timeout handling

---

## Dev Notes

### Test Harness Architecture

```
┌─────────────────────────────────────────────────┐
│                   Node.js CLI                    │
├─────────────────────────────────────────────────┤
│  phaser-test-harness.ts                         │
│  - Puppeteer Core                               │
│  - Express server (static files)                │
│  - Console log parser                           │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│              Headless Chrome                     │
├─────────────────────────────────────────────────┤
│  test-page.html                                 │
│  - Phaser 3.x loaded                            │
│  - Test scene implementation                    │
│  - Results output via console.log JSON          │
└─────────────────────────────────────────────────┘
```

### TEST-02: Pivot Auto-Apply

```typescript
// In Phaser test scene
class TEST02_PivotScene extends Phaser.Scene {
  create() {
    // Load sprite with feet origin
    const sprite = this.add.sprite(256, 256, 'atlas', 'idle/0000');
    sprite.setOrigin(0.5, 1);  // Center-bottom (feet)

    const baselineY = sprite.getBounds().bottom;
    const results: number[] = [];

    // Step through all frames
    for (let i = 0; i < 8; i++) {
      sprite.setFrame(`idle/${i.toString().padStart(4, '0')}`);
      const currentY = sprite.getBounds().bottom;
      results.push(currentY);
    }

    // Check consistency
    const maxDrift = Math.max(...results) - Math.min(...results);
    const passed = maxDrift <= 1;  // 1px tolerance

    console.log(JSON.stringify({
      test: 'TEST-02',
      passed,
      maxDrift,
      baselineY,
      frameResults: results
    }));
  }
}
```

### TEST-03: Trim Mode Jitter

```typescript
class TEST03_TrimJitterScene extends Phaser.Scene {
  create() {
    const sprite = this.add.sprite(256, 256, 'atlas', 'idle/0000');
    const positions: Array<{ x: number; y: number }> = [];

    // Capture center position for each frame
    for (let i = 0; i < 8; i++) {
      sprite.setFrame(`idle/${i.toString().padStart(4, '0')}`);
      const bounds = sprite.getBounds();
      positions.push({
        x: bounds.centerX,
        y: bounds.centerY
      });
    }

    // Calculate variance
    const xVariance = this.calculateVariance(positions.map(p => p.x));
    const yVariance = this.calculateVariance(positions.map(p => p.y));

    const passed = xVariance <= 2 && yVariance <= 2;  // 2px tolerance

    console.log(JSON.stringify({
      test: 'TEST-03',
      passed,
      xVariance,
      yVariance,
      positions
    }));
  }
}
```

### TEST-04: Suffix Convention

```typescript
class TEST04_SuffixScene extends Phaser.Scene {
  create() {
    // Use generateFrameNames with our naming convention
    const frames = this.anims.generateFrameNames('atlas', {
      prefix: 'idle/',
      start: 0,
      end: 7,
      zeroPad: 4
    });

    // Verify all frames resolved
    const missingFrames = frames.filter(f =>
      !this.textures.get('atlas').has(f.frame as string)
    );

    const passed = missingFrames.length === 0;

    console.log(JSON.stringify({
      test: 'TEST-04',
      passed,
      totalFrames: frames.length,
      resolvedFrames: frames.length - missingFrames.length,
      missingFrames: missingFrames.map(f => f.frame)
    }));
  }
}
```

### Test Result Schema

```typescript
interface MicroTestResult {
  test: 'TEST-02' | 'TEST-03' | 'TEST-04';
  passed: boolean;
  details: Record<string, unknown>;
  screenshot?: string;
  duration_ms: number;
}

interface ValidationSummary {
  run_id: string;
  atlas_path: string;
  validated_at: string;
  overall_passed: boolean;
  tests: {
    'TEST-02': MicroTestResult;
    'TEST-03': MicroTestResult;
    'TEST-04': MicroTestResult;
  };
}
```

### CLI Output Example

```
🧪 Running Phaser Micro-Tests for run abc123...
═══════════════════════════════════════════════════════

TEST-02 (Pivot Auto-Apply)
  ✅ PASS - Baseline consistent within 1px
  Max drift: 0.5px
  Screenshot: validation/test-02-pivot.png

TEST-03 (Trim Mode Jitter)
  ✅ PASS - No visual jitter detected
  X variance: 0.2px, Y variance: 0.1px
  Screenshot: validation/test-03-jitter.png

TEST-04 (Suffix Convention)
  ✅ PASS - All 8 frames resolved
  Frame keys validated
  Screenshot: validation/test-04-suffix.png

═══════════════════════════════════════════════════════
OVERALL: ✅ PASS (3/3 tests passed)
Results saved to: runs/abc123/validation/test-results.json
```

### Test Page HTML

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.min.js"></script>
</head>
<body>
  <script>
    const config = {
      type: Phaser.WEBGL,
      width: 512,
      height: 512,
      backgroundColor: '#333333',
      scene: [TEST02_PivotScene, TEST03_TrimJitterScene, TEST04_SuffixScene]
    };

    const game = new Phaser.Game(config);

    // Atlas path passed via URL params
    const urlParams = new URLSearchParams(window.location.search);
    const atlasJson = urlParams.get('atlas');
    const testToRun = urlParams.get('test');
  </script>
</body>
</html>
```

### Project Structure Notes

- New: `src/core/validation/phaser-test-harness.ts`
- New: `src/core/validation/micro-tests/test-02-pivot.ts`
- New: `src/core/validation/micro-tests/test-03-jitter.ts`
- New: `src/core/validation/micro-tests/test-04-suffix.ts`
- New: `assets/validation/test-page.html`
- New: `src/commands/pipeline/validate.ts`
- Tests: `test/core/validation/phaser-tests.test.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.7]
- [Source: Agentic-Sprite-Sheet-Deep-Research/Phaser3_Export_Compliance_Kit.md#Micro-Test Harness]
- [Source: stories/1-4-engine-truth-spike-puppeteer-phaser.md]

---

## Dev Agent Record

### Agent Model Used

**Claude-Code**

**Rationale:** Puppeteer+Phaser integration tests with multi-file setup. WebGL context, screenshot capture, and console log parsing. Complex test harness architecture requiring reasoning about browser communication patterns.

### Debug Log References

- Code review completed 2026-01-19

### Completion Notes List

- All 9 tasks completed
- phaser-test-harness.ts implements full Puppeteer integration
- TEST-02 (Pivot), TEST-03 (Jitter), TEST-04 (Suffix) implemented
- validate command CLI with --allow-validation-fail flag
- Screenshot capture and result logging
- ValidationTestResult and ValidationSummary types
- 15 tests passing

### File List

- `src/core/validation/phaser-test-harness.ts` - Puppeteer harness with micro-tests
- `src/commands/validate.ts` - CLI validate command
- `test/core/validation/phaser-test-harness.test.ts` - Unit tests

### Completion Date

2026-01-19
