# Story 6.6: Implement Operator Guide Documentation

Status: done

---

## Story

**As an** operator,
**I want** comprehensive documentation explaining quality gates and decision trees,
**So that** I can troubleshoot issues and tune the pipeline effectively.

---

## Acceptance Criteria

### CLI Access

1. **CLI command** - Run `banana guide` to display/output operator guide ✅

### Guide Content

2. **Quick start** - First run in ≤45 minutes using documentation alone (NFR16) ✅
3. **Quality gate explanations** - What each HF and SF code means ✅
4. **Retry ladder visualization** - Decision tree for retry actions ✅
5. **Failure patterns** - Common failure patterns and solutions ✅
6. **Manifest reference** - Complete manifest configuration reference ✅
7. **Troubleshooting FAQ** - Common issues and resolutions ✅

### File Access

8. **File location** - Guide available as `docs/operator-guide.md` in project ✅

---

## Tasks / Subtasks

- [x] **Task 1: Create guide command** (AC: #1)
  - [x] 1.1: Create `banana guide` command
  - [x] 1.2: Load and display operator-guide.md
  - [x] 1.3: Use markdown rendering for terminal
  - [x] 1.4: Support `--output <path>` to save to file
  - [x] 1.5: Support `--section <name>` to display specific section
  - [x] 1.6: Support `--list` to list all sections
  - [x] 1.7: Support `--raw` for unformatted output

- [x] **Task 2: Write quick start section** (AC: #2)
  - [x] 2.1: Prerequisites (Node.js, TexturePacker, Chrome)
  - [x] 2.2: Installation steps
  - [x] 2.3: Environment setup (.env configuration)
  - [x] 2.4: First run with demo command
  - [x] 2.5: Verify output

- [x] **Task 3: Write quality gate documentation** (AC: #3)
  - [x] 3.1: List all HF codes with explanations
  - [x] 3.2: List all SF codes with explanations
  - [x] 3.3: List all SYS/DEP codes with explanations
  - [x] 3.4: Include threshold defaults and recommendations

- [x] **Task 4: Write retry ladder documentation** (AC: #4)
  - [x] 4.1: Create ASCII art decision tree
  - [x] 4.2: Explain each ladder level
  - [x] 4.3: Document escalation conditions
  - [x] 4.4: Include HF_IDENTITY_COLLAPSE trigger conditions

- [x] **Task 5: Write failure patterns section** (AC: #5)
  - [x] 5.1: Common SF01 causes and solutions
  - [x] 5.2: Common SF02 causes and solutions
  - [x] 5.3: Export failures and solutions
  - [x] 5.4: Include example diagnostic output

- [x] **Task 6: Write manifest reference** (AC: #6)
  - [x] 6.1: Document all manifest sections
  - [x] 6.2: Include field descriptions and types
  - [x] 6.3: Include default values
  - [x] 6.4: Include complete manifest structure reference

- [x] **Task 7: Write troubleshooting FAQ** (AC: #7)
  - [x] 7.1: "My frames keep failing identity check"
  - [x] 7.2: "TexturePacker is not found"
  - [x] 7.3: "Phaser tests fail but atlas looks fine"
  - [x] 7.4: "How do I resume a stopped run"
  - [x] 7.5: Include 10+ common questions

- [x] **Task 8: Test documentation completeness** (AC: #2, #8)
  - [x] 8.1: Write automated tests to verify code documentation
  - [x] 8.2: Verify all codes are documented
  - [x] 8.3: Verify manifest reference is complete
  - [x] 8.4: Ensure file is in docs/ folder

---

## Dev Notes

### Document Structure

```markdown
# Sprite Pipeline Operator Guide

## Table of Contents
1. Quick Start
2. Understanding Quality Gates
3. The Retry Ladder
4. Common Failure Patterns
5. Manifest Configuration Reference
6. Troubleshooting FAQ
7. Advanced Topics

---

## 1. Quick Start

### Prerequisites
...

### Installation
...

### First Run (< 45 minutes)
...

---

## 2. Understanding Quality Gates

### Hard Failures (HFxx)
These immediately reject a frame. No retry possible.

| Code | Name | Description | Solution |
|------|------|-------------|----------|
| HF01 | Dimension Mismatch | Frame size != target size | Check canvas.target_size |
| HF02 | Alpha Missing | No alpha channel | Ensure PNG with transparency |
| HF03 | Corruption | Image unreadable | Retry generation |
| HF04 | Color Depth | Not 32-bit RGBA | Check generator settings |
| HF05 | File Size | Outside bounds | Investigate empty/corrupt |
| HF_IDENTITY_COLLAPSE | Identity Lost | 2+ re-anchors failed | Improve anchor quality |

### Soft Failures (SFxx)
These trigger retry with escalating strategies.

| Code | Name | Description | Retry Action |
|------|------|-------------|--------------|
| SF01 | Identity Drift | SSIM < threshold | Identity rescue, Re-anchor |
| SF02 | Palette Drift | Colors off-palette | Tighten negative prompt |
| SF03 | Baseline Drift | >3px from anchor baseline | Pose rescue |
| SF04 | Temporal Flicker | MAPD too high for move type | Reroll seed |
| SF_ALPHA_HALO | Halo Artifacts | Fringe around edges | Post-process cleanup |
| SF_PIXEL_NOISE | Orphan Pixels | >15 isolated pixels | Higher res regenerate |

---

## 3. The Retry Ladder

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
                          ┌──────────────────┼──────────────────┐
                          │                  │                  │
                    Level 1-2          Level 3-4          Level 5-6
                  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
                  │ Reroll Seed │    │ Identity    │    │ Post-Process│
                  │ Tighten Neg │    │ Rescue      │    │ Two-Stage   │
                  └─────────────┘    │ Re-Anchor   │    │ Inpaint     │
                                     └─────────────┘    └─────────────┘
                                             │
                          ┌──────────────────┼──────────────────┐
                          │                  │                  │
                    Level 7            Level 8            STOP
                  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
                  │  Escalate   │    │    STOP     │    │   HALTED    │
                  └─────────────┘    └─────────────┘    └─────────────┘
```

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
3. Identity threshold too strict

**Solutions:**
1. Use higher resolution anchor (512x512 recommended)
2. Choose anchor pose that's mid-range for the animation
3. Lower `auditor.thresholds.identity_min` to 0.75

### Pattern: High SF02 Rate (Palette Drift)

...

---

## 5. Manifest Configuration Reference

### identity
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| character | string | required | Character ID |
| move | string | required | Move ID |
| version | string | "v1" | Version tracking |
| frame_count | number | required | Total frames |
| is_loop | boolean | true | Animation loops? |
| move_type | string | "idle" | idle/walk/attack/jump |

...

---

## 6. Troubleshooting FAQ

### Q: My frames keep failing identity check
**A:** This usually means the anchor image doesn't have enough distinctive features...

### Q: TexturePacker says "license not found"
**A:** TexturePacker requires a Pro license for CLI usage...

### Q: Phaser tests fail but the atlas looks fine
**A:** The micro-tests check specific behaviors...

...

---

## 7. Advanced Topics

### Custom Retry Ladders
...

### Batch Processing (v1+)
...

### Director Mode
...
```

### Reason Code Reference

```typescript
const REASON_CODES = {
  // Hard Failures
  HF01: { name: 'Dimension Mismatch', severity: 'hard', retryable: false },
  HF02: { name: 'Alpha Missing', severity: 'hard', retryable: false },
  HF03: { name: 'Image Corruption', severity: 'hard', retryable: true },
  HF04: { name: 'Color Depth', severity: 'hard', retryable: false },
  HF05: { name: 'File Size', severity: 'hard', retryable: true },
  HF_IDENTITY_COLLAPSE: { name: 'Identity Collapse', severity: 'hard', retryable: false },

  // Soft Failures
  SF01: { name: 'Identity Drift', severity: 'soft', retryable: true },
  SF02: { name: 'Palette Drift', severity: 'soft', retryable: true },
  SF03: { name: 'Baseline Drift', severity: 'soft', retryable: true },
  SF04: { name: 'Temporal Flicker', severity: 'soft', retryable: true },
  SF_ALPHA_HALO: { name: 'Alpha Halo', severity: 'soft', retryable: true },
  SF_PIXEL_NOISE: { name: 'Pixel Noise', severity: 'soft', retryable: true },

  // System Errors
  SYS_MANIFEST_INVALID: { name: 'Invalid Manifest', severity: 'system' },
  SYS_WRITE_ERROR: { name: 'File Write Error', severity: 'system' },

  // Dependency Errors
  DEP_API_UNAVAILABLE: { name: 'API Unavailable', severity: 'dependency' },
  DEP_TEXTUREPACKER_FAIL: { name: 'TexturePacker Error', severity: 'dependency' }
};
```

### Project Structure Notes

- New: `docs/operator-guide.md`
- Modify: `src/commands/pipeline/help.ts` (add --guide flag)
- Tests: `test/docs/operator-guide.test.ts` (verify completeness)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.6]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR16]

---

## Dev Agent Record

### Agent Model Used

**Claude Opus 4.5**

**Rationale:** Documentation quality requires natural language generation. Comprehensive guide covering multiple topics. Claude writes the most natural, user-friendly documentation.

### Debug Log References

- Fixed extractSection regex to properly extract full sections including content after header
- Changed from regex-based approach to line-by-line parsing for reliable section extraction
- Added "Identity Collapse" phrase to HF_IDENTITY_COLLAPSE heading for test compatibility

### Completion Notes List

- Created comprehensive 700+ line operator guide covering all 7 sections
- Implemented `banana guide` command with options: --section, --list, --output, --raw
- Terminal formatting converts markdown headers, code blocks, bold, and links
- 40 tests verify guide content completeness (all HF/SF/DEP codes, retry ladder, FAQ, etc.)
- Guide includes ASCII art retry ladder visualization
- 10+ FAQ entries covering common issues

### File List

- `docs/operator-guide.md` - Comprehensive operator guide (700+ lines)
- `src/commands/guide.ts` - CLI command implementation
- `test/commands/guide.test.ts` - Unit tests (40 tests)
- `src/bin.ts` - Added registerGuideCommand
