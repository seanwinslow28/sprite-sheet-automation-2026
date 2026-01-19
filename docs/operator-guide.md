# Sprite Pipeline Operator Guide

A comprehensive guide for operating the autonomous sprite animation generation pipeline.

## Table of Contents

1. [Quick Start](#1-quick-start)
2. [Understanding Quality Gates](#2-understanding-quality-gates)
3. [The Retry Ladder](#3-the-retry-ladder)
4. [Common Failure Patterns](#4-common-failure-patterns)
5. [Manifest Configuration Reference](#5-manifest-configuration-reference)
6. [Troubleshooting FAQ](#6-troubleshooting-faq)
7. [Advanced Topics](#7-advanced-topics)

---

## 1. Quick Start

Get your first sprite animation generated in under 45 minutes.

### Prerequisites

Before you begin, ensure you have:

- **Node.js** 22.x or later (LTS recommended)
- **TexturePacker CLI** with Pro license (for atlas export)
- **Google Chrome** or Chromium (for Phaser validation tests)
- **Gemini API Key** (set in environment)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd sprite-pipeline

# Install dependencies
npm install

# Build the project
npm run build
```

### Environment Setup

Create a `.env` file in the project root:

```bash
# Required: Gemini API key for image generation
GEMINI_API_KEY=your-api-key-here

# Optional: Custom TexturePacker path
# TEXTUREPACKER_PATH=/usr/local/bin/TexturePacker
```

### Verify Dependencies

Run the doctor command to check all dependencies:

```bash
banana doctor
```

Expected output:
```
Checking dependencies...
  Node.js v22.x.x ................ OK
  TexturePacker .................. OK
  Chrome/Chromium ................ OK
  GEMINI_API_KEY ................. OK

All checks passed!
```

### First Run (Demo)

Run the built-in demo to verify everything works:

```bash
banana demo
```

This will:
1. Use a bundled demo anchor image
2. Generate a simple 4-frame idle animation
3. Export to Phaser-compatible atlas
4. Run validation tests

### Creating Your First Manifest

Generate a manifest template for a new character:

```bash
banana new-manifest --character NOVA --move idle --preset champion
```

This creates `manifests/nova-idle.yaml` with all required fields.

### Running a Full Pipeline

```bash
banana run manifests/nova-idle.yaml
```

Monitor progress in the terminal. The pipeline will:
1. Validate the manifest
2. Analyze the anchor image
3. Generate frames using Gemini
4. Audit each frame for quality
5. Retry failed frames automatically
6. Export to atlas when complete

### Verifying Output

After a successful run, find your outputs in:

```
runs/<run-id>/
├── approved/           # Final approved frames
├── export/             # Atlas files
│   ├── nova-idle.json  # Phaser JSON
│   └── nova-idle.png   # Sprite sheet
├── audit/              # Audit logs and metrics
└── summary.json        # Run summary
```

---

## 2. Understanding Quality Gates

The pipeline uses a two-tier quality system: **Hard Failures** that immediately reject frames, and **Soft Failures** that trigger retries.

### Hard Failures (HFxx)

These codes indicate fundamental problems that cannot be retried. The frame is immediately rejected.

| Code | Name | Description | Cause | Solution |
|------|------|-------------|-------|----------|
| HF01 | Dimension Mismatch | Frame size doesn't match target | Generator output wrong size | Check `canvas.target_size` in manifest |
| HF02 | Fully Transparent | Image has no visible content | Generation produced empty frame | Improve anchor image, retry |
| HF03 | Image Corrupted | File is unreadable or malformed | API error, network issue | Automatic retry usually fixes |
| HF04 | Wrong Color Depth | Not 32-bit RGBA | Generator settings wrong | Ensure PNG with alpha channel |
| HF05 | File Size Invalid | File too small or too large | Corruption or encoding issue | Check generator output |
| HF_NO_ALPHA | No Alpha Channel | Missing transparency (true_alpha mode) | Input image lacks alpha | Convert to PNG with transparency |

### Soft Failures (SFxx)

These codes indicate quality issues that may be fixed with a different generation attempt.

| Code | Name | Threshold | Description | Retry Strategy |
|------|------|-----------|-------------|----------------|
| SF01 | Identity Drift | SSIM < 0.85 | Character looks different from anchor | Reroll seed → Identity rescue → Re-anchor |
| SF02 | Palette Drift | Fidelity < 0.90 | Colors don't match palette | Tighten negative → Identity rescue |
| SF03 | Alpha Halo | Severity > 0.20 | Fringe artifacts around edges | Post-process → Two-stage inpaint |
| SF04 | Baseline Drift | Drift > 4px | Character floats or sinks | Pose rescue → Re-anchor |
| SF04 | Temporal Flicker | MAPD too high | Excessive motion between frames | Reroll seed → Tighten negative |
| SF05 | Pixel Noise | Orphans > 15 | Too many isolated pixels | Regenerate high-res → Post-process |
| SF_FRINGE_RISK | Chroma Fringe | Detected | Color fringing from chroma key | Post-process cleanup |

### System and Dependency Errors

| Code | Description | Solution |
|------|-------------|----------|
| DEP_NODE_VERSION | Node.js version too old | Upgrade to Node.js 22+ |
| DEP_TEXTUREPACKER_NOT_FOUND | TexturePacker not in PATH | Install and add to PATH |
| DEP_TEXTUREPACKER_LICENSE | No Pro license detected | Activate Pro license |
| DEP_CHROME_NOT_FOUND | Chrome/Chromium not found | Install Chrome browser |
| DEP_WEBGL_UNAVAILABLE | WebGL not available | Check GPU drivers |
| DEP_GEMINI_UNAVAILABLE | Gemini API unreachable | Check API key and network |
| SYS_PUPPETEER_LAUNCH_FAILED | Browser launch failed | Check Chrome installation |
| SYS_PHASER_LOAD_FAILED | Phaser couldn't load atlas | Validate atlas JSON format |

---

## 3. The Retry Ladder

When a frame fails a soft metric, the pipeline escalates through a series of retry strategies.

### Retry Ladder Visualization

```
           ┌─────────────────────────────────────┐
           │          FRAME GENERATION           │
           └─────────────────┬───────────────────┘
                             │
                             ▼
           ┌─────────────────────────────────────┐
           │              AUDIT                   │
           └─────────────────┬───────────────────┘
                             │
            ┌────────────────┴────────────────┐
            │                                  │
      PASS  ▼                            FAIL  ▼
   ┌────────────────┐                ┌────────────────┐
   │    APPROVE     │                │  RETRY LADDER  │
   └────────────────┘                └───────┬────────┘
                                             │
         Level 1-2                    Level 3-4                   Level 5-6
       ┌───────────┐                ┌───────────┐                ┌───────────┐
       │ Reroll    │                │ Identity  │                │ Post-     │
       │ Seed      │ ─────────────► │ Rescue    │ ─────────────► │ Process   │
       │           │                │ Re-Anchor │                │ Inpaint   │
       └───────────┘                └───────────┘                └───────────┘
                                                                        │
                                                                        ▼
                                         Level 7                  Level 8
                                       ┌───────────┐            ┌───────────┐
                                       │  Escalate │ ─────────► │   STOP    │
                                       │  Re-Anchor│            │  HALTED   │
                                       └───────────┘            └───────────┘
```

### Retry Ladder Levels

| Level | Action | Description | Triggered By |
|-------|--------|-------------|--------------|
| 1 | REROLL_SEED | Try a different random seed | SF01, SF04 (temporal) |
| 2 | TIGHTEN_NEGATIVE | Add constraints to negative prompt | SF02, SF04 (temporal) |
| 3 | IDENTITY_RESCUE | Re-anchor + apply lock prompt | SF01, SF02 |
| 4 | POSE_RESCUE | Emphasize baseline guide in prompt | SF03 (baseline) |
| 5 | TWO_STAGE_INPAINT | Masked region correction | SF_ALPHA_HALO |
| 6 | POST_PROCESS | Apply alpha cleanup filter | SF_ALPHA_HALO, SF05, SF_FRINGE |
| 7 | RE_ANCHOR | Drop previous frame, regenerate from anchor | Multiple failures, oscillation |
| 8 | STOP | Halt retries, mark frame as failed | HF_IDENTITY_COLLAPSE, ladder exhausted |

### Reason Code to Action Mapping

Each soft failure code has a specific sequence of actions:

```
SF01_IDENTITY_DRIFT  → REROLL_SEED → IDENTITY_RESCUE → RE_ANCHOR
SF02_PALETTE_DRIFT   → TIGHTEN_NEGATIVE → IDENTITY_RESCUE
SF03_BASELINE_DRIFT  → POSE_RESCUE → RE_ANCHOR
SF04_TEMPORAL_FLICKER → REROLL_SEED → TIGHTEN_NEGATIVE
SF_ALPHA_HALO        → POST_PROCESS → TWO_STAGE_INPAINT
SF_PIXEL_NOISE       → REGENERATE_HIGHRES → POST_PROCESS
SF_FRINGE_RISK       → POST_PROCESS
```

### HF_IDENTITY_COLLAPSE (Identity Collapse)

This special condition triggers when:
- Two consecutive RE_ANCHOR attempts fail
- Character identity cannot be recovered from anchor

When this occurs, the frame is marked as permanently failed. This usually indicates:
- Anchor image lacks distinctive features
- Pose is too different from anchor
- Model cannot maintain character consistency

**Solution:** Improve anchor image quality or choose a more neutral pose.

---

## 4. Common Failure Patterns

### Pattern: High SF01 Rate (Identity Drift)

**Symptoms:**
- Many frames fail with SF01_IDENTITY_DRIFT
- Retry rate > 40%
- Characters look different frame-to-frame

**Common Causes:**
1. Anchor image is too low resolution
2. Anchor pose is very different from animation poses
3. Identity threshold too strict for the character style

**Solutions:**
1. Use a higher resolution anchor (512x512 recommended before downsampling)
2. Choose an anchor pose that's mid-range for the animation (not extreme)
3. Lower `auditor.soft_metrics.SF01_IDENTITY_DRIFT` to 0.75-0.80
4. Ensure anchor has distinct, recognizable features

**Example Diagnostic:**
```json
{
  "top_failures": [
    { "code": "SF01_IDENTITY_DRIFT", "count": 12, "percentage": 60 }
  ],
  "root_cause_analysis": {
    "primary": "Identity drift affecting majority of frames",
    "anchor_quality": "Anchor may lack distinctive features"
  }
}
```

### Pattern: High SF02 Rate (Palette Drift)

**Symptoms:**
- Frames have off-palette colors
- Generated sprites have different color tones
- Retry rate increases over animation

**Common Causes:**
1. Anchor uses subtle color gradients that AI interprets differently
2. Style references conflict with anchor colors
3. Palette threshold too strict

**Solutions:**
1. Use more saturated, distinct colors in anchor
2. Remove conflicting style references
3. Lower `auditor.soft_metrics.SF02_PALETTE_DRIFT` to 0.80
4. Add explicit color constraints in negative prompt

### Pattern: Baseline Swimming (SF04)

**Symptoms:**
- Character appears to float up and down
- Walking animations have inconsistent ground contact
- Idle loops have vertical wobble

**Common Causes:**
1. Generator doesn't understand ground plane
2. Anchor feet are unclear or cut off
3. Root zone detection failing

**Solutions:**
1. Ensure anchor shows clear feet/ground contact
2. Adjust `canvas.alignment.root_zone_ratio` (default 0.15)
3. Increase `canvas.alignment.max_shift_x` if character has wide movement
4. Use center alignment for flying/floating characters

### Pattern: Export Failures

**Symptoms:**
- Pipeline completes generation but fails on export
- TexturePacker errors in log
- Missing atlas files

**Common Causes:**
1. TexturePacker not found or not licensed
2. Approved frames missing or corrupted
3. Frame dimensions inconsistent

**Solutions:**
1. Run `banana doctor` to verify TexturePacker
2. Check approved/ folder has all expected frames
3. Run `banana inspect <run-id>` to verify frame integrity

---

## 5. Manifest Configuration Reference

### Complete Structure

```yaml
identity:
  character: string      # Required: Character ID
  move: string          # Required: Move name
  version: string       # Required: Manifest version
  frame_count: number   # Required: Total frames
  is_loop: boolean      # Default: false

inputs:
  anchor: string        # Required: Path to anchor image
  style_refs: string[]  # Optional: Style reference images
  pose_refs: string[]   # Optional: Pose reference images
  guides: string[]      # Optional: Guide overlays

generator:
  backend: "gemini"     # Locked: Only gemini for MVP
  model: string         # Model ID (e.g., "gemini-2.0-flash-exp")
  mode: "edit"          # Locked: Edit mode
  seed_policy: string   # Default: "fixed_then_random"
  max_attempts_per_frame: number  # Default: 5
  prompts:
    master: string      # Required: Path to master prompt
    variation: string   # Required: Path to variation prompt
    lock: string        # Required: Path to lock prompt
    negative: string    # Required: Path to negative prompt

canvas:
  generation_size: 512  # Locked: AI generates at 512px
  target_size: 128|256  # Final output (128 for champions, 256 for bosses)
  downsample_method: "nearest"  # Locked: Pixel art requires nearest
  alignment:
    method: "contact_patch"|"center"|"none"  # Default: contact_patch
    vertical_lock: boolean   # Default: true
    root_zone_ratio: number  # Default: 0.15 (15% of visible height)
    max_shift_x: number      # Default: 32 pixels

auditor:
  hard_gates:           # HF thresholds (fail = reject)
    HF01_DIMENSION_MISMATCH: 0
    HF02_FULLY_TRANSPARENT: 0
    HF03_IMAGE_CORRUPTED: 0
    HF04_WRONG_COLOR_DEPTH: 0
    HF05_FILE_SIZE_INVALID: 0
  soft_metrics:         # SF thresholds (fail = retry)
    SF01_IDENTITY_DRIFT: 0.85
    SF02_PALETTE_DRIFT: 0.90
    SF03_ALPHA_HALO: 0.20
    SF04_BASELINE_DRIFT: 4
    SF05_PIXEL_NOISE: 15
  weights:              # Scoring weights
    stability: 0.35
    identity: 0.30
    palette: 0.20
    style: 0.15

retry:
  ladder:               # Retry strategy sequence
    - "retry_same"
    - "tighten_negative"
    - "identity_rescue"
    - "re_anchor"
  stop_conditions:
    max_retry_rate: 0.50      # Stop if >50% frames need retries
    max_reject_rate: 0.30     # Stop if >30% frames rejected
    max_consecutive_fails: 3  # Stop after 3 consecutive failures

export:
  atlas_format: "phaser"  # Default: phaser (only option for MVP)
  packer_flags: []        # Additional TexturePacker flags
  output_path: string     # Optional: Custom export location
```

### Field Reference

#### identity

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| character | string | Yes | - | Character ID (e.g., "NOVA", "BLAZE") |
| move | string | Yes | - | Move name (e.g., "idle", "walk_forward") |
| version | string | Yes | - | Manifest version for tracking |
| frame_count | number | Yes | - | Total frames in animation |
| is_loop | boolean | No | false | Whether animation loops (affects final frame) |

#### inputs

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| anchor | string | Yes | - | Path to anchor/identity image |
| style_refs | string[] | No | [] | Style reference images (max 6) |
| pose_refs | string[] | No | [] | Pose reference images |
| guides | string[] | No | [] | Grid overlay guides |

#### canvas.alignment

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| method | enum | contact_patch | Alignment method |
| vertical_lock | boolean | true | Lock to anchor baseline |
| root_zone_ratio | number | 0.15 | Bottom % for root detection |
| max_shift_x | number | 32 | Max horizontal shift (pixels) |

#### auditor.soft_metrics Defaults

| Metric | Default | Description |
|--------|---------|-------------|
| SF01_IDENTITY_DRIFT | 0.85 | Minimum SSIM score |
| SF02_PALETTE_DRIFT | 0.90 | Minimum palette fidelity |
| SF03_ALPHA_HALO | 0.20 | Maximum halo severity |
| SF04_BASELINE_DRIFT | 4 | Maximum baseline drift (px) |
| SF05_PIXEL_NOISE | 15 | Maximum orphan pixels |

---

## 6. Troubleshooting FAQ

### Q: My frames keep failing identity check (SF01)

**A:** This usually means the anchor image doesn't have enough distinctive features, or the pose difference is too large.

**Try these steps:**
1. Use a higher quality anchor (512x512 minimum)
2. Choose an anchor pose closer to the animation poses
3. Lower the identity threshold: `SF01_IDENTITY_DRIFT: 0.75`
4. Add more style references that show the character at different angles

### Q: TexturePacker says "license not found"

**A:** TexturePacker requires a Pro license for CLI usage. The free version only works with the GUI.

**Solutions:**
1. Purchase and activate a TexturePacker Pro license
2. Ensure the license file is in the expected location
3. Run `TexturePacker --version` to verify the license status

### Q: Phaser tests fail but the atlas looks fine visually

**A:** The micro-tests check specific behaviors that may not be visually obvious:

- **TEST-02 (Pivot):** Checks anchor point is at feet, not center
- **TEST-03 (Jitter):** Detects sub-pixel movement between frames
- **TEST-04 (Suffix):** Validates frame naming convention

**Check:**
1. Run `banana inspect <run-id> --diagnostic` for details
2. Verify alignment method is `contact_patch` for walking characters
3. Check frame naming matches `character_move_0001.png` pattern

### Q: How do I resume a stopped run?

**A:** The pipeline supports idempotent resumption:

```bash
# Resume automatically detects incomplete run
banana run manifests/nova-idle.yaml

# Force fresh start (ignores existing run)
banana run manifests/nova-idle.yaml --force
```

The pipeline:
1. Checks for existing run folder
2. Validates manifest hash matches
3. Skips already-approved frames
4. Continues from last incomplete frame

### Q: The run stops with "RETRY_RATE_EXCEEDED"

**A:** This safety stop triggers when too many frames need retries.

**Causes:**
- Anchor image quality issues
- Threshold values too strict
- Model struggling with character style

**Solutions:**
1. Check diagnostic report: `banana inspect <run-id> --diagnostic`
2. Lower thresholds slightly and retry
3. Improve anchor image quality
4. Try different style references

### Q: How do I check what went wrong in a failed run?

**A:** Use the inspect command:

```bash
# View run summary
banana inspect <run-id>

# View specific frame details
banana inspect <run-id> --frame 5

# View diagnostic analysis
banana inspect <run-id> --diagnostic

# Export as JSON for analysis
banana inspect <run-id> --json > analysis.json
```

### Q: Can I adjust thresholds without re-running from scratch?

**A:** Yes, but with caveats:

1. Lower thresholds: Approved frames stay approved
2. Higher thresholds: May need to re-audit existing frames

Use `--force` to re-run with new settings:
```bash
banana run manifests/nova-idle.yaml --force
```

### Q: My character's feet keep moving (baseline drift)

**A:** Enable vertical lock and use contact patch alignment:

```yaml
canvas:
  alignment:
    method: "contact_patch"  # Use feet, not center
    vertical_lock: true      # Lock to anchor baseline
    root_zone_ratio: 0.15    # Adjust if feet are higher/lower
```

If character floats or sinks, the anchor's feet area may be unclear. Use an anchor with visible ground contact.

### Q: How do I generate larger boss sprites?

**A:** Use the boss preset or set target_size to 256:

```bash
banana new-manifest --character TITAN --move smash --preset boss
```

Or manually set:
```yaml
canvas:
  target_size: 256  # 256px for bosses
```

Note: Generation still happens at 512px, but the soft metric thresholds may need adjustment for larger sprites.

### Q: The export step fails with "frames missing"

**A:** Pre-export validation checks that all frames are approved:

1. Check approved/ folder: `ls runs/<run-id>/approved/`
2. Verify frame count matches manifest
3. Run inspect to see missing frames: `banana inspect <run-id>`

If frames are missing, the run didn't complete successfully. Check for stop conditions in the summary.

---

## 7. Advanced Topics

### Custom Retry Ladders

Override the default retry strategy in your manifest:

```yaml
retry:
  ladder:
    - "reroll_seed"
    - "reroll_seed"         # Try twice before escalating
    - "identity_rescue"
    - "re_anchor"
```

### Batch Processing

Process multiple characters:

```bash
# Run multiple manifests
for manifest in manifests/*.yaml; do
  banana run "$manifest"
done
```

### Integrating with CI/CD

```yaml
# GitHub Actions example
- name: Generate sprites
  run: |
    banana doctor
    banana run manifests/nova-idle.yaml
    banana promote runs/$(ls -t runs | head -1)
```

### Director Mode (Future)

Interactive review and correction will be available in a future version:

```bash
banana run manifests/nova-idle.yaml --interactive
```

This opens a web UI for:
- Reviewing individual frames
- Nudging sprite position
- Mask-based corrections
- Manual approve/reject

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| GEMINI_API_KEY | Gemini API key (required) | - |
| TEXTUREPACKER_PATH | Custom TexturePacker location | (auto-detect) |
| CHROME_PATH | Custom Chrome/Chromium location | (auto-detect) |
| BANANA_LOG_LEVEL | Log verbosity (debug, info, warn, error) | info |
| BANANA_RUNS_DIR | Custom runs directory | ./runs |

### Performance Tuning

For faster generation:
- Use `gemini-2.0-flash-exp` (faster) vs `gemini-pro-vision` (higher quality)
- Lower frame count for testing
- Use smaller style_refs array

For higher quality:
- Use more style references (up to 6)
- Increase max_attempts_per_frame
- Use stricter thresholds

---

## Appendix: CLI Command Reference

```bash
# Check dependencies
banana doctor

# Show manifest schema
banana schema

# Create new manifest
banana new-manifest -c CHARACTER -m MOVE [-p PRESET]

# Run pipeline
banana run <manifest> [--dry-run] [--force] [--verbose]

# Inspect run
banana inspect <run-id> [--frame N] [--diagnostic] [--json]

# Validate exported atlas
banana validate <run-id>

# Promote to release
banana promote <run-id> [--allow-validation-fail]

# Clean old runs
banana clean [--days N] [--preserve-approved]

# Show this guide
banana guide
```
