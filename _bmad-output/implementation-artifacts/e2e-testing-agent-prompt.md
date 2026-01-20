# BMAD Agent Kickoff Prompt: E2E Testing with Real Assets

## Agent Assignment

**Agent Type:** QA / Test Engineer Agent
**Task:** End-to-End Testing of Sprite Sheet Automation Pipeline
**Priority:** HIGH - Production Validation
**Estimated Duration:** 2-4 hours

---

## Context

The Sprite Sheet Automation Pipeline has completed implementation of all 8 epics (67 stories, 1002 unit tests passing). The pipeline generates frame-by-frame sprite animations from anchor images using Gemini AI, with automated quality gates and human-in-the-loop review via Director Mode.

**Recent Changes:**
- Fixed 8 bugs identified by adversarial code review (4 Critical, 3 High, 1 Race Condition)
- Enhanced multipack validation for TexturePacker output
- Added session mutex for race condition prevention

**What Needs Testing:**
- Real Gemini API integration (currently stubbed in tests)
- Full pipeline flow with actual image generation
- Director Mode UI with real frame data
- Export to Phaser-compatible atlas format

---

## Your Mission

Perform comprehensive end-to-end testing of the Sprite Sheet Automation Pipeline using real assets and the Gemini API. Validate that the pipeline produces production-quality sprite animations.

---

## Phase 1: Environment Verification (15 min)

### Step 1.1: Verify Dependencies

```bash
cd /path/to/Sprite-Sheet-Automation-Project_2026
npm run build
./bin/run doctor
```

**Expected:** All 6 checks pass (Node.js, TexturePacker, License, Chrome, Gemini API, Environment)

### Step 1.2: Verify Gemini API Access

```bash
# Ensure API key is set
echo $GEMINI_API_KEY  # Should show key (or check .env file)

# Quick API test (optional)
curl -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=$GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Hello"}]}]}'
```

### Step 1.3: Prepare Test Assets

Create or locate a test anchor sprite:
- 512x512 PNG with transparency
- 16-bit pixel art character
- Centered, facing right
- Clear baseline (feet position)

Place at: `assets/test/test_anchor_512.png`

---

## Phase 2: Basic Generation Test (30 min)

### Step 2.1: Create Test Manifest

Create `test-manifests/e2e-smoke-test.yaml`:

```yaml
identity:
  character: testchar
  move: idle
  version: "1.0.0"

inputs:
  anchor_path: ./assets/test/test_anchor_512.png

generator:
  total_frames: 4
  temperature: 1.0
  model: gemini-2.0-flash-exp

canvas:
  target_width: 128
  target_height: 128
  generation_scale: 4

quality:
  min_identity_score: 0.80
  max_baseline_drift: 10
  max_retries_per_frame: 3
```

### Step 2.2: Run Generation

```bash
./bin/run gen --manifest test-manifests/e2e-smoke-test.yaml --verbose
```

### Step 2.3: Verify Results

**Check generated artifacts:**
```bash
# Find run ID from output
RUN_ID="20260119_XXXXXX_testchar_idle"

# Inspect run
./bin/run inspect $RUN_ID

# Check candidates
ls -la runs/$RUN_ID/candidates/

# Check approved
ls -la runs/$RUN_ID/approved/

# Check export
ls -la runs/$RUN_ID/export/
```

**Expected:**
- 4 PNG files in `candidates/` (frame_0000_attempt_1.png, etc.)
- 4 PNG files in `approved/` (frame_0000.png, etc.)
- Atlas files in `export/` (testchar_idle.json + testchar_idle.png)

### Step 2.4: Validate Atlas

```bash
./bin/run validate --run-id $RUN_ID
./bin/run validate --run-id $RUN_ID --phaser-tests
```

**Document:** Frame quality, retry count, any soft fails encountered.

---

## Phase 3: Director Mode Test (45 min)

### Step 3.1: Run with Interactive Mode

```bash
./bin/run gen --manifest test-manifests/e2e-smoke-test.yaml --interactive
```

### Step 3.2: Test UI Components

Once server starts and browser opens:

**Timeline Component:**
- [ ] All 4 frames visible as thumbnails
- [ ] Status colors correct (green=approved, yellow=warning, red=fail)
- [ ] Click selects frame
- [ ] Arrow keys navigate frames
- [ ] Frame number displayed

**Stage Component:**
- [ ] Selected frame displays at correct size
- [ ] Onion skinning toggle works
- [ ] Previous frame shows as ghost overlay
- [ ] Zoom controls work (+/- or scroll)
- [ ] Baseline guide visible

**Nudge Tool:**
- [ ] Drag frame to reposition
- [ ] Delta values update in UI
- [ ] Preview shows new position
- [ ] Release saves nudge

**Mask Pen Tool:**
- [ ] Brush draws red mask overlay
- [ ] Brush size adjustable
- [ ] Eraser mode clears mask
- [ ] Clear all button works

**Patch Flow:**
- [ ] Draw mask on problem area
- [ ] Enter correction prompt
- [ ] Click Patch button
- [ ] Loading indicator shows
- [ ] New frame replaces old
- [ ] Patch history recorded

**Inspector Pane:**
- [ ] Composite score displayed
- [ ] Individual metrics shown (identity, palette, baseline, etc.)
- [ ] Flags listed with reason codes
- [ ] Prompt displayed
- [ ] Attempt history visible

**Commit Flow:**
- [ ] Commit button visible
- [ ] Click shows confirmation
- [ ] Progress indicator during commit
- [ ] Success message with counts
- [ ] Server closes automatically

### Step 3.3: Verify Committed Output

```bash
# After commit, check approved folder
ls -la runs/$RUN_ID/approved/

# Verify deltas were applied (if any nudges made)
# Compare file sizes/content with pre-commit

# Check director_session.json
cat runs/$RUN_ID/director_session.json | jq '.status'
# Should be "committed"
```

---

## Phase 4: Motion Animation Test (30 min)

### Step 4.1: Create Walk Cycle Manifest

Create `test-manifests/e2e-walk-test.yaml`:

```yaml
identity:
  character: testchar
  move: walk
  version: "1.0.0"

inputs:
  anchor_path: ./assets/test/test_anchor_512.png

generator:
  total_frames: 8
  temperature: 1.0
  model: gemini-2.0-flash-exp

canvas:
  target_width: 128
  target_height: 128
  generation_scale: 4

quality:
  min_identity_score: 0.75
  max_baseline_drift: 12
  max_retries_per_frame: 4
```

### Step 4.2: Run and Evaluate

```bash
./bin/run gen --manifest test-manifests/e2e-walk-test.yaml --verbose
```

**Evaluate:**
- Temporal coherence (smooth motion between frames)
- Loop closure (frame 8 returns to frame 1 pose)
- Baseline consistency (no "floating" character)
- Identity preservation across motion

---

## Phase 5: Resume/Interrupt Test (20 min)

### Step 5.1: Start Long Run

```bash
./bin/run gen --manifest test-manifests/e2e-walk-test.yaml --verbose
```

### Step 5.2: Interrupt

Press `Ctrl+C` after 3-4 frames complete.

**Verify:**
```bash
# Check state was saved
cat runs/$RUN_ID/state.json | jq '.current_frame'
# Should show last completed frame

# Check frames exist
ls runs/$RUN_ID/approved/
# Should have partial frames
```

### Step 5.3: Resume

```bash
./bin/run gen --manifest test-manifests/e2e-walk-test.yaml
# Should prompt: "Resume existing run? (Y/n)"
# Press Y
```

**Verify:**
- Continues from correct frame
- Doesn't regenerate already-approved frames
- Completes successfully

### Step 5.4: Force Fresh Start

```bash
./bin/run gen --manifest test-manifests/e2e-walk-test.yaml --no-resume
# Should start fresh run with new ID
```

---

## Phase 6: Error Handling Test (20 min)

### Step 6.1: Test Invalid Anchor

Create manifest with non-existent anchor:
```yaml
inputs:
  anchor_path: ./assets/test/does_not_exist.png
```

**Expected:** Clear error message, no crash.

### Step 6.2: Test Gemini Failure

Temporarily set invalid API key and run:
```bash
GEMINI_API_KEY=invalid ./bin/run gen --manifest test-manifests/e2e-smoke-test.yaml
```

**Expected:**
- Error caught and reported
- State preserved
- Recoverable with correct key

### Step 6.3: Test Max Retries

Create manifest with very strict thresholds:
```yaml
quality:
  min_identity_score: 0.99  # Nearly impossible
  max_retries_per_frame: 2
```

**Expected:**
- Frame fails after max retries
- Circuit breaker may trigger
- Run halts gracefully with diagnostic

---

## Phase 7: Report Generation

### Results Template

```markdown
# E2E Test Report - [DATE]

## Environment
- Node.js: [version]
- TexturePacker: [version]
- Gemini Model: gemini-2.0-flash-exp
- OS: [OS]
- Tester: [Agent/Human]

## Test Results Summary

| Test | Status | Duration | Notes |
|------|--------|----------|-------|
| Environment Verify | PASS/FAIL | Xm | |
| Basic Generation | PASS/FAIL | Xm | |
| Director Mode UI | PASS/FAIL | Xm | |
| Motion Animation | PASS/FAIL | Xm | |
| Resume/Interrupt | PASS/FAIL | Xm | |
| Error Handling | PASS/FAIL | Xm | |

## Detailed Findings

### Generation Quality
- Average identity score: X.XX
- Average retry rate: X%
- Hard fails encountered: X
- Soft fails resolved: X

### Director Mode
- All UI components functional: YES/NO
- Patch flow working: YES/NO
- Commit produces valid atlas: YES/NO

### Issues Found

#### Issue 1: [Title]
- **Severity:** Critical/High/Medium/Low
- **Steps to Reproduce:**
  1. ...
  2. ...
- **Expected:** ...
- **Actual:** ...
- **Suggested Fix:** ...

### Recommendations
1. [Any recommended changes before production]
2. [Performance observations]
3. [UX improvements]

## Overall Assessment

**PRODUCTION READY:** YES / NO / CONDITIONAL

[Summary paragraph]
```

---

## Success Criteria

The E2E testing is considered PASSED if:

1. **Basic Generation:** 4/4 frames approved with <30% retry rate
2. **Director Mode:** All UI interactions functional, commit produces valid atlas
3. **Motion Animation:** 8/8 frames with temporal coherence
4. **Resume:** State preserved and resume works correctly
5. **Error Handling:** All error cases handled gracefully
6. **Atlas Validation:** All Phaser tests pass (TEST-02, TEST-03, TEST-04)

---

## Notes for Agent

- Take screenshots of Director Mode UI at each step
- Log exact error messages if any failures occur
- Record actual vs expected for any discrepancies
- If Gemini rate limits, wait and retry (document the limit)
- The UI folder (`ui/`) contains React components - these run in browser
- Real image generation can take 5-15 seconds per frame
- Keep API key secure - don't log it in reports

**Good luck! Report findings in the results template above.**
