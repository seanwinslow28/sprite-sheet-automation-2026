# Story 6.8: Implement One-Command First Run

Status: ready-for-dev

---

## Story

**As an** operator,
**I want** to complete a first run with a single command,
**So that** I can verify the pipeline works before configuring custom manifests.

---

## Acceptance Criteria

### Demo Command

1. **Sample manifest** - System uses a bundled sample manifest
2. **Sample assets** - Uses bundled sample anchor and reference images
3. **Frame generation** - Generates at least 2 frames
4. **Full pipeline** - Runs audit and export pipeline
5. **Sample atlas** - Produces sample atlas in `runs/demo/export/`
6. **Time goal** - Completes within NFR16 ramp-up time goal
7. **Success message** - Outputs success message with next steps

---

## Tasks / Subtasks

- [ ] **Task 1: Create demo command** (AC: #1)
  - [ ] 1.1: Create `src/commands/pipeline/demo.ts`
  - [ ] 1.2: No required arguments
  - [ ] 1.3: Accept optional `--frames <count>` (default: 2)
  - [ ] 1.4: Accept optional `--skip-validation` flag

- [ ] **Task 2: Bundle sample assets** (AC: #2)
  - [ ] 2.1: Create `assets/demo/anchor.png` (128x128 sample sprite)
  - [ ] 2.2: Create `assets/demo/palette.png` (sample color palette)
  - [ ] 2.3: Create `assets/demo/prompts/master.txt`
  - [ ] 2.4: Create `assets/demo/prompts/variation.txt`

- [ ] **Task 3: Create sample manifest** (AC: #1)
  - [ ] 3.1: Create `assets/demo/manifest.yaml`
  - [ ] 3.2: Configure for minimal frame count (2)
  - [ ] 3.3: Use relaxed thresholds for demo
  - [ ] 3.4: Point to bundled assets

- [ ] **Task 4: Implement demo run** (AC: #3, #4)
  - [ ] 4.1: Load bundled manifest
  - [ ] 4.2: Create `runs/demo/` folder (overwrite if exists)
  - [ ] 4.3: Run generation for configured frames
  - [ ] 4.4: Run audit and export

- [ ] **Task 5: Implement export verification** (AC: #5)
  - [ ] 5.1: Verify atlas files created
  - [ ] 5.2: Run Phaser validation (unless --skip-validation)
  - [ ] 5.3: Log results

- [ ] **Task 6: Implement success output** (AC: #7)
  - [ ] 6.1: Display success message
  - [ ] 6.2: Show output location
  - [ ] 6.3: Provide next steps
  - [ ] 6.4: Link to documentation

- [ ] **Task 7: Optimize for time** (AC: #6)
  - [ ] 7.1: Use minimal frame count
  - [ ] 7.2: Skip optional validations if behind schedule
  - [ ] 7.3: Log progress to show activity
  - [ ] 7.4: Target < 5 minutes total

- [ ] **Task 8: Write tests** (AC: all)
  - [ ] 8.1: Test demo command runs without errors
  - [ ] 8.2: Test atlas is created
  - [ ] 8.3: Test success message displayed
  - [ ] 8.4: Test --skip-validation flag works

---

## Dev Notes

### Command Signature

```bash
pipeline demo [options]

Options:
  --frames <count>      Number of frames to generate (default: 2)
  --skip-validation     Skip Phaser micro-tests for faster demo
  --verbose, -v         Show detailed progress
```

### Demo Manifest

```yaml
# Demo Manifest - Sample Pipeline Run
# This manifest is used by 'pipeline demo' to verify the pipeline works

identity:
  character: "DEMO"
  move: "idle_demo"
  version: "v1"
  frame_count: 2  # Minimal for quick demo
  is_loop: true
  move_type: "idle"

inputs:
  anchor: "assets/demo/anchor.png"
  palette: "assets/demo/palette.png"
  style_refs: []
  pose_refs: []
  guides: []

generator:
  backend: "gemini"
  model: "gemini-2.0-flash-exp"
  mode: "edit"
  temperature: 1.0
  top_p: 0.95
  top_k: 40
  seed_policy: "deterministic_then_random"
  max_attempts_per_frame: 3  # Fewer attempts for demo
  prompts:
    master: "assets/demo/prompts/master.txt"
    variation: "assets/demo/prompts/variation.txt"
    lock: "assets/demo/prompts/lock.txt"
    negative: "assets/demo/prompts/negative.txt"

canvas:
  generation_size: 512
  target_size: 128
  downsample_method: "nearest"
  alignment:
    method: "contact_patch"
    vertical_lock: true
    root_zone_ratio: 0.15
    max_shift_x: 32

auditor:
  thresholds:
    identity_min: 0.70     # Relaxed for demo
    palette_min: 0.65
    alpha_artifact_max: 0.15
    baseline_drift_max: 5
    composite_min: 0.60

retry:
  stop_conditions:
    max_retry_rate: 0.80   # Very relaxed for demo
    max_reject_rate: 0.60
    max_consecutive_fails: 3

transparency:
  strategy: "true_alpha"

export:
  atlas_format: "phaser"
```

### Demo Prompt Templates

**master.txt:**
```
Create a pixel art character sprite in a relaxed idle pose.
Style: 16-bit retro game aesthetic with clean pixel art.
The character should have a slight breathing motion animation feel.
Maintain the exact color palette and visual style of the reference.
```

**variation.txt:**
```
Generate frame {{frame_index}} of {{total_frames}} for the idle animation.
Maintain perfect character identity from the anchor reference.
Add subtle breathing motion appropriate for this frame position.
Keep all proportions and colors exactly matching the reference.
```

### Demo CLI Output

```
🎮 Sprite Pipeline Demo
═══════════════════════════════════════════════════════

This demo will generate a 2-frame idle animation to verify
your pipeline setup is working correctly.

Prerequisites verified:
  ✅ Node.js v22.x
  ✅ TexturePacker installed
  ✅ Chrome available for Puppeteer
  ✅ GEMINI_API_KEY configured

Starting demo run...
═══════════════════════════════════════════════════════

⠋ Initializing demo run...
✔ Demo run initialized (run_id: demo_20260118)

⠋ Analyzing anchor image...
✔ Anchor analyzed (baseline: 120px, root: 64px)

⠋ Generating frame 0/2...
✔ Frame 0 generated (attempt 1, score: 0.85)

⠋ Generating frame 1/2...
✔ Frame 1 generated (attempt 2, score: 0.78)

⠋ Exporting atlas...
✔ Atlas exported (demo_idle_demo.png, demo_idle_demo.json)

⠋ Running Phaser validation...
✔ Validation passed (3/3 tests)

═══════════════════════════════════════════════════════
✅ Demo Complete!
═══════════════════════════════════════════════════════

Output location: runs/demo/export/
  • demo_idle_demo.png (128x64, 2 frames)
  • demo_idle_demo.json

Summary:
  • Frames: 2/2 approved
  • Attempts: 3 total
  • Duration: 2m 15s
  • Validation: PASSED

Next steps:
  1. View the output: pipeline inspect demo
  2. Create your manifest: pipeline new-manifest -c MYCHAR -m idle
  3. Read the guide: pipeline help --guide

For more information: https://docs.example.com/sprite-pipeline
═══════════════════════════════════════════════════════
```

### Time Budget (NFR16 Goal: 45 minutes total ramp-up)

| Step | Target Time | Cumulative |
|------|-------------|------------|
| Read quick start | 10 min | 10 min |
| Install dependencies | 10 min | 20 min |
| Configure .env | 5 min | 25 min |
| Run demo | 5 min | 30 min |
| Verify output | 5 min | 35 min |
| Buffer | 10 min | 45 min |

Demo itself should complete in < 5 minutes to fit the budget.

### Sample Anchor Image

The demo anchor should be:
- 128x128 pixels
- Simple geometric character (easy to generate variations)
- Clear color palette (5-8 colors)
- Distinct silhouette
- Transparent background

### Project Structure Notes

- New: `src/commands/pipeline/demo.ts`
- New: `assets/demo/anchor.png`
- New: `assets/demo/palette.png`
- New: `assets/demo/manifest.yaml`
- New: `assets/demo/prompts/*.txt`
- Tests: `test/commands/pipeline/demo.test.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.8]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR16, NFR17]

---

## Dev Agent Record

### Agent Model Used

**Codex-CLI**

**Rationale:** Demo command with bundled assets. Well-scoped CLI command. Straightforward orchestration of existing components.

### Debug Log References

*(To be filled during implementation)*

### Completion Notes List

*(To be filled during implementation)*

### File List

*(To be filled during implementation)*
