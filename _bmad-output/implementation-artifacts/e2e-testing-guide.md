# End-to-End Testing Guide: Sprite Sheet Automation Pipeline

## Overview

This document provides comprehensive instructions for performing end-to-end (E2E) testing of the Sprite Sheet Automation Pipeline with real assets and the Gemini API. The goal is to validate the complete pipeline flow from manifest to exported Phaser-compatible atlas.

---

## Prerequisites

### 1. Environment Setup

```bash
# Verify all dependencies are installed
npm run build
./bin/run doctor

# Expected output: All 6 checks PASS
# - Node.js version (v20+)
# - TexturePacker installed
# - TexturePacker license valid
# - Chrome/Chromium available
# - Gemini API key configured
# - Environment variables set
```

### 2. Gemini API Configuration

```bash
# Set your Gemini API key
export GEMINI_API_KEY="your-api-key-here"

# Or add to .env file in project root
echo "GEMINI_API_KEY=your-api-key-here" >> .env
```

### 3. Required Assets

You need a **gold anchor sprite** that meets these requirements:

| Requirement | Specification |
|-------------|---------------|
| Format | PNG with transparency |
| Resolution | 512x512 pixels (4x target) |
| Background | Transparent (alpha channel) |
| Character | Centered, facing right |
| Baseline | Feet touching bottom ~15% of visible height |
| Style | 16-bit pixel art aesthetic |

**Recommended test anchors:**
- `assets/test/blaze_anchor_512.png` - Fire character
- `assets/test/aqua_anchor_512.png` - Water character
- Create your own following the spec above

---

## Test Scenarios

### Scenario 1: Basic Idle Animation (Smoke Test)

**Purpose:** Validate minimal pipeline flow with 4 frames.

**Manifest:** `test-manifests/e2e-idle-basic.yaml`

```yaml
# E2E Test: Basic 4-frame idle animation
identity:
  character: blaze
  move: idle
  version: "1.0.0"

inputs:
  anchor_path: ./assets/test/blaze_anchor_512.png

generator:
  total_frames: 4
  temperature: 1.0
  model: gemini-2.0-flash-exp

canvas:
  target_width: 128
  target_height: 128
  generation_scale: 4

quality:
  min_identity_score: 0.85
  max_baseline_drift: 8
  max_retries_per_frame: 3
```

**Expected Results:**
- 4 frames generated in `runs/{run_id}/candidates/`
- 4 frames approved in `runs/{run_id}/approved/`
- Atlas exported to `runs/{run_id}/export/blaze_idle.json` + `.png`
- All Phaser validation tests pass

---

### Scenario 2: Walk Cycle (Motion Test)

**Purpose:** Validate temporal coherence across motion frames.

**Manifest:** `test-manifests/e2e-walk-cycle.yaml`

```yaml
identity:
  character: blaze
  move: walk
  version: "1.0.0"

inputs:
  anchor_path: ./assets/test/blaze_anchor_512.png

generator:
  total_frames: 8
  temperature: 1.0
  model: gemini-2.0-flash-exp

canvas:
  target_width: 128
  target_height: 128
  generation_scale: 4

quality:
  min_identity_score: 0.80  # Lower for motion
  max_baseline_drift: 12    # Higher tolerance for walk
  max_retries_per_frame: 4
```

**Expected Results:**
- 8 frames with progressive leg positions
- Loop closure (frame 8 returns to frame 1 pose)
- Baseline consistency across all frames
- No "moonwalking" (feet sliding)

---

### Scenario 3: Attack Animation (High Motion)

**Purpose:** Validate MAPD bypass for high-motion frames.

**Manifest:** `test-manifests/e2e-attack.yaml`

```yaml
identity:
  character: blaze
  move: attack
  version: "1.0.0"

inputs:
  anchor_path: ./assets/test/blaze_anchor_512.png

generator:
  total_frames: 6
  temperature: 1.0
  model: gemini-2.0-flash-exp

canvas:
  target_width: 128
  target_height: 128
  generation_scale: 4

quality:
  min_identity_score: 0.75  # Lower for attack motion
  max_baseline_drift: 16    # Higher for action poses
  max_retries_per_frame: 4
  mapd_bypass_moves:
    - attack
    - special
```

**Expected Results:**
- 6 frames showing attack wind-up, strike, recovery
- Identity maintained despite pose changes
- Soft fail bypass working for high-motion frames

---

### Scenario 4: Director Mode Integration

**Purpose:** Validate human-in-the-loop review flow.

```bash
# Run with interactive mode
./bin/run gen --manifest test-manifests/e2e-idle-basic.yaml --interactive

# Expected:
# 1. Generation completes
# 2. Director Mode server starts on port 3000
# 3. Browser opens to http://localhost:3000
# 4. UI shows timeline with frame thumbnails
# 5. Each frame can be reviewed, nudged, patched
# 6. Commit saves changes and exports atlas
```

**Director Mode Test Checklist:**
- [ ] Timeline shows all frames with correct status colors
- [ ] Stage displays selected frame with onion skinning
- [ ] Nudge tool moves frame and records delta
- [ ] Mask pen tool draws selection mask
- [ ] Patch API sends mask to Gemini and updates frame
- [ ] Inspector shows audit metrics and flags
- [ ] Commit applies all deltas and exports atlas

---

### Scenario 5: Resume After Interruption

**Purpose:** Validate state persistence and resume capability.

```bash
# Start a run
./bin/run gen --manifest test-manifests/e2e-walk-cycle.yaml

# Interrupt with Ctrl+C after frame 3
# State should be saved to runs/{run_id}/state.json

# Resume the run
./bin/run gen --manifest test-manifests/e2e-walk-cycle.yaml
# Should detect existing run and prompt to resume

# Force fresh start
./bin/run gen --manifest test-manifests/e2e-walk-cycle.yaml --no-resume
```

**Expected Results:**
- State.json contains progress at interruption point
- Resume continues from last incomplete frame
- Already-approved frames are not regenerated
- Attempt tracking preserved across sessions

---

### Scenario 6: Multipack Atlas (Large Animation)

**Purpose:** Validate TexturePacker multipack for many frames.

**Manifest:** `test-manifests/e2e-multipack.yaml`

```yaml
identity:
  character: blaze
  move: combo
  version: "1.0.0"

inputs:
  anchor_path: ./assets/test/blaze_anchor_512.png

generator:
  total_frames: 24  # Will likely require multipack
  temperature: 1.0
  model: gemini-2.0-flash-exp

canvas:
  target_width: 128
  target_height: 128
  generation_scale: 4

export:
  max_sheet_size: 2048  # Force multipack earlier
```

**Expected Results:**
- Multiple PNG sheets: `blaze_combo-0.png`, `blaze_combo-1.png`, etc.
- Single JSON with `textures[]` array format
- All frames accessible via Phaser loader
- Post-export validation passes for all sheets

---

## Running the Tests

### Full E2E Test Suite

```bash
# Create test manifests directory
mkdir -p test-manifests

# Copy manifests from this guide (or use provided examples)

# Run each scenario
./bin/run gen --manifest test-manifests/e2e-idle-basic.yaml --verbose
./bin/run gen --manifest test-manifests/e2e-walk-cycle.yaml --verbose
./bin/run gen --manifest test-manifests/e2e-attack.yaml --verbose

# Run with Director Mode
./bin/run gen --manifest test-manifests/e2e-idle-basic.yaml --interactive

# Validate exports
./bin/run validate --run-id {run_id}
```

### Automated Validation

```bash
# After each run, verify:

# 1. Check run status
./bin/run inspect {run_id}

# 2. Validate atlas
./bin/run validate --run-id {run_id}

# 3. Check Phaser compatibility
./bin/run validate --run-id {run_id} --phaser-tests

# 4. View diagnostic report
./bin/run inspect {run_id} --diagnostic
```

---

## Success Criteria

### Per-Scenario Criteria

| Scenario | Pass Criteria |
|----------|---------------|
| Idle Basic | 4/4 frames approved, atlas valid, <3 total retries |
| Walk Cycle | 8/8 frames approved, loop closure smooth, baseline ±8px |
| Attack | 6/6 frames approved, MAPD bypass triggered, identity >0.75 |
| Director Mode | All UI interactions work, commit produces valid atlas |
| Resume | State preserved, resume works, no duplicate work |
| Multipack | All sheets valid, JSON correct, Phaser loads all frames |

### Overall E2E Criteria

- [ ] All 6 scenarios complete without errors
- [ ] Total retry rate < 30%
- [ ] No hard fail (HF01-HF05) escapes to approved
- [ ] All exported atlases pass Phaser validation
- [ ] Director Mode fully functional
- [ ] Resume capability verified
- [ ] Graceful shutdown preserves state

---

## Troubleshooting

### Common Issues

**1. Gemini API Rate Limiting**
```
Error: 429 Too Many Requests
Fix: Add delay between frames or use batch API
```

**2. Identity Drift (SF01)**
```
Warning: Identity score 0.72 < 0.85 threshold
Fix: Check anchor quality, adjust min_identity_score, or use Director Mode to patch
```

**3. Baseline Drift (SF03)**
```
Warning: Baseline drift 15px > 8px threshold
Fix: Contact patch alignment may need anchor re-analysis
```

**4. TexturePacker License**
```
Error: TexturePacker requires Pro license for JSON export
Fix: Activate TexturePacker license or use free trial
```

**5. Phaser Validation Fails**
```
Error: TEST-02 Pivot test failed
Fix: Check atlas JSON pivot points, verify frame bounds
```

---

## Test Results Template

```markdown
## E2E Test Results - [DATE]

### Environment
- Node.js: v24.x.x
- TexturePacker: 7.x.x
- Gemini Model: gemini-2.0-flash-exp
- OS: [Windows/macOS/Linux]

### Scenario Results

| Scenario | Status | Frames | Retries | Duration | Notes |
|----------|--------|--------|---------|----------|-------|
| Idle Basic | PASS/FAIL | 4/4 | 2 | 45s | |
| Walk Cycle | PASS/FAIL | 8/8 | 5 | 2m | |
| Attack | PASS/FAIL | 6/6 | 3 | 1.5m | |
| Director Mode | PASS/FAIL | - | - | - | |
| Resume | PASS/FAIL | - | - | - | |
| Multipack | PASS/FAIL | 24/24 | 8 | 5m | |

### Issues Found
1. [Description of any issues]
2. [Steps to reproduce]
3. [Suggested fix]

### Overall Assessment
[PASS/FAIL with summary]
```

---

## BMAD Agent Kickoff Prompt

See the next section for the detailed agent prompt.
