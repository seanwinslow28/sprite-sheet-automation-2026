# Master Architecture Lock Document
## Sprite-Sheet-Automation-Project_2026
### Consolidated Deep Think Decisions — 2026-01-18

> **STATUS: LOCKED FOR IMPLEMENTATION**
>
> This document consolidates all architectural decisions from the Gemini 3 Deep Think analysis sessions. These decisions are immutable for MVP development unless explicitly unlocked via formal review.

---

## Table of Contents

1. [Category 1: Generator Adapter & Gemini API Integration](#category-1-generator-adapter--gemini-api-integration)
2. [Category 2: Post-Processor Pipeline](#category-2-post-processor-pipeline)
3. [Category 3: Quality Auditing & Metrics](#category-3-quality-auditing--metrics)
4. [Category 4: Retry Ladder & Orchestration](#category-4-retry-ladder--orchestration)
5. [Category 5: Export & Phaser Validation](#category-5-export--phaser-validation)
6. [Category 6: Prompting Techniques](#category-6-prompting-techniques)
7. [Category 7: Infrastructure & Tooling](#category-7-infrastructure--tooling)
8. [Category 8: Director Mode (Human-in-the-Loop)](#category-8-director-mode-human-in-the-loop)
9. [Category 9: Pipeline Integration (CLI)](#category-9-pipeline-integration-cli)
10. [Appendix A: Reason Codes](#appendix-a-reason-codes)
11. [Appendix B: State Machine](#appendix-b-state-machine)
12. [Appendix C: Thresholds Reference](#appendix-c-thresholds-reference)

---

## Category 1: Generator Adapter & Gemini API Integration

### 1.1 Thought Signature Persistence

| Decision | Stateless MVP with Visual Reference Chaining |
|----------|---------------------------------------------|
| Mechanism | Pass image binary of Frame N-1 as reference, NOT latent state token |
| Traceability | Extract and log `thoughtSignature` to `audit_log.jsonl` for future v2 migration |
| Error Handling | Lost signature is irrelevant; requests are stateless |

### 1.2 Part[] Array Structure (Semantic Interleaving)

**Decision: Option A — Text Labels Precede Images**

```json
[
  { "text": "SYSTEM: You are a professional pixel artist..." },

  { "text": "[IMAGE 1]: MASTER ANCHOR (IDENTITY TRUTH)..." },
  { "inlineData": { "mimeType": "image/png", "data": "<ANCHOR_BASE64>" } },

  { "text": "[IMAGE 2]: PREVIOUS FRAME (POSE REFERENCE)..." },
  { "inlineData": { "mimeType": "image/png", "data": "<PREV_FRAME_BASE64>" } },

  { "text": "HIERARCHY: If [IMAGE 2] conflicts with [IMAGE 1], [IMAGE 1] wins.\nCOMMAND: ..." }
]
```

**Note:** Omit [IMAGE 2] entirely if SF01 (Identity Score) < 0.9 to "reset" the chain.

### 1.3 Reference Image Limit

| Decision | Strict 2-Image Limit for MVP |
|----------|------------------------------|
| Slots | [IMAGE 1]: Anchor, [IMAGE 2]: Previous Frame |
| Slot 3 | Reserved for `guide_overlay.png` (Retry Level 3 only) |
| Slot 4 | Reserved for `style_palette.png` (v1+ if palette drift persists) |

### 1.4 Temperature Parameter

| Decision | **LOCK TO 1.0** |
|----------|-----------------|
| Rationale | Values < 1.0 cause mode collapse on Gemini 2.0/3.0 scale (0.0-2.0) |
| Code | `temperature: 1.0, topP: 0.95, topK: 40` |

**WARNING:** Never use `temperature: 0.7` — this causes "fried pixels" and identical frames.

### 1.5 Seed Policy

| Attempt | Seed Strategy |
|---------|---------------|
| Attempt 1 | `CRC32(RunID + FrameIndex + AttemptIndex)` — Deterministic |
| Attempt 2+ | Random Integer — Entropy to escape failure mode |

**Implementation:**
```typescript
export function calculateSeed(runId: string, frameIndex: number, attemptIndex: number): number {
  if (attemptIndex === 1) {
    const uniqueKey = `${runId}::${frameIndex}::${attemptIndex}`;
    return crc32(uniqueKey); // Use precomputed lookup table
  }
  return undefined; // Let API randomize
}
```

### 1.6 API Error Handling

| HTTP Code | Error Type | Action | Backoff |
|-----------|------------|--------|---------|
| 429 | Rate Limit | Wait & Retry | Exponential (1s, 2s, 4s...) Max 5 |
| 503 | Overloaded | Wait & Retry | Exponential (Start 5s) |
| 400 | Invalid | Fail Fast | Stop Frame |
| Blocked | Safety | Fail Frame | Do not retry prompt |

### 1.7 Thought Signature Extraction

```typescript
export function extractThoughtArtifacts(response: GenerateContentResponse): AuditMetadata {
  const candidate = response.candidates?.[0];
  if (!candidate?.content?.parts) return {};

  const signaturePart = candidate.content.parts.find(p => 'thoughtSignature' in p);
  const thoughtSignature = signaturePart ? (signaturePart as any).thoughtSignature : undefined;

  const thoughtPart = candidate.content.parts.find(p => (p as any).thought === true);
  const thoughtContent = thoughtPart ? thoughtPart.text : undefined;

  return { thoughtSignature, thoughtContent };
}
```

---

## Category 2: Post-Processor Pipeline

### 2.1 Alignment Recalculation

| Decision | Anchor's `baselineY` is Immutable Ground Truth |
|----------|------------------------------------------------|
| Logic | Never update target to match generated frame |
| Action | Physically shift generated frame to match target |
| Failure | If aligned feet don't match baseline → `SF_BASELINE_DRIFT` |

### 2.2 Root Zone Calculation

| Scenario | Strategy |
|----------|----------|
| Standard | 15% of `visibleHeight` from bottom |
| Jumping | `alignment.method: 'none'` — Trust AI spatial placement |
| Trailing Cape/Tail | Increase to `alignment.root_zone_ratio: 0.30` |
| Crouching | Standard logic (15% scales automatically) |
| Alpha Fringe | Hard threshold: `alphaThreshold = 128` |

### 2.3 Safety Valve Behavior

| Trigger | Shift exceeds ±32px |
|---------|----------------------|
| Action | Clamp shift to 32px, log `WARN: Safety valve triggered` |
| Result | Frame proceeds to Auditor with residual drift |
| Audit | `SF_BASELINE_DRIFT` measures residual, triggers SF03 if > 1px |

### 2.4 Downsampling Artifact Validation

| Metric | Orphan Pixel Count |
|--------|-------------------|
| Algorithm | Scan 128px output, count pixels with zero orthogonal neighbors of same color |
| Threshold | > 15 orphans = `SF_PIXEL_NOISE` (Soft Fail) |

**Implementation:**
```typescript
export async function detectOrphanPixels(buffer: Buffer, width = 128, threshold = 15): Promise<OrphanResult> {
  // Scan internal pixels (skipping 1px border)
  // Count pixels where NO orthogonal neighbor shares color
  // Return { count, isSoftFail: count > threshold }
}
```

### 2.5 Dynamic Chroma Key Selection

| Algorithm | Furthest Neighbor (RGB Euclidean) |
|-----------|-----------------------------------|
| Candidates | Magenta (#FF00FF), Green (#00FF00), Cyan (#00FFFF), Blue (#0000FF) |
| Logic | Select candidate with largest minimum distance to any anchor color |
| Warning | Log if `maxMinDistance < 15` RGB units |

---

## Category 3: Quality Auditing & Metrics

### 3.1 SSIM Calculation

| Decision | Post-Alignment (Aligned Frame vs. Anchor) |
|----------|-------------------------------------------|
| Rationale | SSIM penalizes spatial mismatches; alignment handles position |
| Threshold | SF01_IDENTITY if SSIM < 0.9 |

### 3.2 Baseline Drift Metric

| Metric | Residual Drift (Post-Alignment Error) |
|--------|---------------------------------------|
| Scenario A | Aligner shifts +5px, feet on baseline → Drift = 0 → PASS |
| Scenario B | Safety valve clamps +50px to +32px → Residual 18px → FAIL |
| Scenario C | Aligner detects shadow as feet → Real feet floating → FAIL |

### 3.3 Alpha Artifact Detection (Halo)

| Algorithm | Perimeter Band Scan |
|-----------|---------------------|
| Definition | Pixel is "edge" if opaque and touching transparent |
| Halo | Edge pixel with alpha < 254 |
| Metric | `haloRatio = haloPixels / edgePixels` |

### 3.4 Palette Fidelity

| Method | Delta-E (CIELAB) |
|--------|------------------|
| Tolerance | Delta-E ≤ 2.3 (Just Noticeable Difference) |
| Threshold | If Match % < 90% → `SF_PALETTE_DRIFT` |

### 3.5 Temporal Coherence (MAPD)

| Algorithm | Masked Mean Absolute Pixel Difference |
|-----------|---------------------------------------|
| Mask | Intersection of non-transparent pixels in Frame N and N-1 |
| Normalization | Divide raw RGB difference by 255 |

**Thresholds by Move Type:**

| Move Type | MAPD Threshold | Rationale |
|-----------|----------------|-----------|
| **Idle** | > 0.02 (2%) | Sub-pixel breathing only |
| **Walk** | > 0.10 (10%) | Limbs move, torso stable |
| **Block** | > 0.05 (5%) | Minimal shift |
| **Attack** | BYPASS | Frames barely overlap |
| **Jump** | BYPASS | Use SSIM instead |
| **Hit** | BYPASS | Distortion expected |

---

## Category 4: Retry Ladder & Orchestration

### 4.1 Engine Validation Failure

| Decision | Terminal Hard Block (Manual Intervention Required) |
|----------|---------------------------------------------------|
| Status | `HF_ENGINE_FAIL` (New code) |
| Action | Halt export, log Phaser error, operator adjusts manifest |
| Exception | TEST-03 (Trim Jitter) from pixel noise → Trigger Alpha Cleanup once |

### 4.2 Retry Ladder Exhausted

| Decision | `HF_MAX_ATTEMPTS` (Counts as Rejection) |
|----------|----------------------------------------|
| Action | Move frame to `runs/{id}/rejected/` |
| Report | List chain of failures (e.g., "3x SF01 → 1x HF03 → Exhausted") |

### 4.3 Drift Recovery

| Decision | Increment Attempt Count, Use Lock Template |
|----------|-------------------------------------------|
| Oscillation Rule | If frame triggers Re-anchor twice → `HF_IDENTITY_COLLAPSE` |

### 4.4 State Machine States

| State | Description |
|-------|-------------|
| PENDING | Waiting for generation |
| GENERATING | API call in progress |
| AUDITING | Running quality checks |
| RETRY_DECIDING | Evaluating retry strategy |
| APPROVING | Writing to approved/ |
| REJECTING | Writing to rejected/ |
| EXPORTING | TexturePacker processing |
| VALIDATING | Phaser micro-tests |
| COMPLETED | Run finished successfully |
| FAILED | Quality failure |
| STOPPED | Stop condition met (reject rate) |
| ERROR_SYSTEM | Infrastructure failure (recoverable via resume) |

### 4.5 Stop Condition Calculation

| Timing | Evaluate after every finalized frame |
|--------|--------------------------------------|
| Denominator | Total Frames Attempted So Far |
| Threshold | `max_reject_rate: 0.3` |
| Example | 1 reject + 1 approve = 50% → Triggers immediately if > 30% |

### 4.6 HF_IDENTITY_COLLAPSE Recovery

| Decision | Stop the Frame (Reject), Continue the Run |
|----------|------------------------------------------|
| Rationale | Single bad frame shouldn't kill entire run |
| Circuit Breaker | If collapse happens 5 times, reject_rate > 30% triggers STOPPED |
| Diagnostic | "Anchor may lack resolution for pose angle, or prompt conflicts with anatomy" |

---

## Category 5: Export & Phaser Validation

### 5.1 Pivot/Origin Behavior

| Decision | Bottom-Center Default (0.5, 1.0) |
|----------|----------------------------------|
| Override | Generate `pivots.json` only if specific frames need offset |
| Validation | TEST-02 confirms visual feet position matches expected coordinate |

### 5.2 TEST-02 Pivot Auto-Apply

| Method | Visual Bounding Box Check |
|--------|---------------------------|
| Logic | Place Anchor at (100,100), place Exported Frame at (100,100) |
| Assertion | Bottom-most opaque pixel Y must match (within 1px) |

### 5.3 TEST-03 Trim Jitter Detection

| Method | Headless Bounds Comparison |
|--------|---------------------------|
| Logic | Load all frames, read `sprite.getBottomCenter()` |
| Assertion | Y value constant across all frames in grounded sequence |
| Tolerance | ≤ 1px variance |

### 5.4 TEST-04 Suffix Convention

| Method | Validate `texture.getFrameNames()` |
|--------|-----------------------------------|
| Assertions | Keys match `^{move}/\d{4}$`, no `.png` suffix, count matches manifest |

### 5.5 Frame Key Zero-Padding

| Decision | **Strict 4-Digit Padding (0000)** |
|----------|----------------------------------|
| TexturePacker | Use token `{n4}` |
| Phaser | `zeroPad: 4` |
| Example | `idle/0000`, `idle/0001`, `idle/0002`... |

### 5.6 Multipack Validation

| Structure Check | Root contains `textures[]` array (MultiAtlas format) |
|-----------------|------------------------------------------------------|
| Frame Reachability | Collect all frame names from all sub-textures |
| Assertions | Set contains exactly `manifest.frame_count` items |

```typescript
function validateMultipack(jsonContent: any, expectedFrameCount: number): ValidationResult {
  if (!Array.isArray(jsonContent.textures)) {
    return Result.fail("HF_ATLAS_FORMAT: Missing 'textures' array");
  }

  const allKeys = new Set<string>();
  jsonContent.textures.forEach(texture => {
    // Verify PNG exists, collect keys
  });

  if (allKeys.size !== expectedFrameCount) {
    return Result.fail(`Frame count mismatch`);
  }
  return Result.ok();
}
```

---

## Category 6: Prompting Techniques

### 6.1 Master Prompt Template (Identity Locking)

**Structure:**
1. Role Definition
2. Visual Context (Labeled): `[IMAGE 1]: MASTER ANCHOR (IDENTITY TRUTH)`
3. Command: Dense natural language (40-60 words)

**Hierarchy: Identity > Style > Pose**

### 6.2 Variation Prompt Template (Temporal Flow)

**Pattern: Reference Sandwich**
```
[Identity Truth] + [Pose Reference] + [Command]
```

**Rules:**
- Pass previous frame as `[IMAGE 2]: PREVIOUS FRAME (POSE REFERENCE)`
- Explicit hierarchy: "If [IMAGE 2] conflicts with [IMAGE 1], [IMAGE 1] takes priority"
- Describe delta (change) not static state

### 6.3 Lock/Recovery Prompt Template (Drift Rescue)

**Trigger:** SF01_IDENTITY_DRIFT (< 0.9)

**Action:** Drop [IMAGE 2] entirely, revert to Anchor-only structure

**Template:**
```
RECOVERY MODE: Previous generation drifted.
INSTRUCTION: IGNORE previous frame context. RESET strictly to [IMAGE 1] (Anchor).
POSE: {pose_description} from scratch.
EMPHASIS: Ensure exact match of face shape to [IMAGE 1].
```

### 6.4 Negative Prompt

```
AVOID: Anti-aliasing, semi-transparent pixels, blur, bokeh, 3D render,
vector art, gradient mesh, noise, text, watermark, cropped limbs,
dithering, photographic texture.
```

### 6.5 Pose Description Granularity

| Level | Decision |
|-------|----------|
| **Optimal** | Mid-Level Intent (Natural Language) |
| Good | "Athletic crouching guard. Weight on back leg, fists protecting chin." |
| Bad (Too Low) | "Left foot 2px behind left." |
| Bad (Too High) | "Fighting." |

### 6.6 Guide Overlay Injection

| Decision | Code-First Alignment |
|----------|---------------------|
| Primary | Post-process: Detect Feet → Shift Y to match Anchor Baseline |
| Fallback | Retry Level 3 only: Inject `guide_128.png` as [IMAGE 3] |

### 6.7 Cycle Completion (Loop Closure)

**Pattern: Loop Closure**

For final frame of cycle (e.g., Frame 7 of 8):
- Origin: [IMAGE 2] (Frame 6)
- Destination: [IMAGE 1] (Frame 0)
- Task: Generate the bridge (Frame 7)

**Template Addition:**
```
CRITICAL CONTEXT: This is the FINAL frame of a looping animation.
OBJECTIVE: Create the missing link that connects [IMAGE 2] back to [IMAGE 1].
CONSTRAINT: The pose must be 85% transitioned towards [IMAGE 1].
PHYSICS: Ensure momentum decelerates to match the starting state.
```

### 6.8 Pose Description Workflow

| Decision | Phase-Based Parametric Templates |
|----------|----------------------------------|
| Structure | Define Phases (Contact, Recoil, Passing, High Point) |
| Mapping | Map frame indices to phases |
| Location | `src/domain/poses.ts` |

**Example (Walk Cycle):**
```typescript
export const MOVES_LIBRARY: Record<string, Record<number, PosePhase>> = {
  "walk_forward": {
    1: { description: "Left leg bears full weight, knee bends (Recoil)...", tension: "tense" },
    2: { description: "Left leg straightens. Right leg passes knee...", tension: "tense" },
    // ... frames 3-7
  }
};
```

---

## Category 7: Infrastructure & Tooling

### 7.1 Puppeteer + Phaser Headless

| Decision | SwiftShader (Software Rasterizer) |
|----------|----------------------------------|
| Flag | `--use-gl=swiftshader` |
| Backup | `--use-gl=egl` if performance unacceptable |

### 7.2 TexturePacker License Validation

| Method | Trial Watermark Detection |
|--------|--------------------------|
| Checks | stderr for "trial"/"expired", output PNG for watermark |
| MVP | `grep` stderr/stdout for "Trial" |

### 7.3 Sharp Performance

| Decision | Sequential Processing |
|----------|----------------------|
| Rationale | Bottleneck is Gemini API (seconds), not Sharp (ms) |
| Optimization | `sharp.cache(false)` to prevent memory leaks |

### 7.4 Atomic File Writes

| Decision | `write-file-atomic` Package |
|----------|----------------------------|
| Rationale | Handles Windows EPERM errors automatically |
| Pattern | temp file → flush → rename |

---

## Category 8: Director Mode (Human-in-the-Loop)

### 8.1 UX Architecture

**Layout: Timeline-Stage-Inspector (3-Pane)**

| Pane | Purpose |
|------|---------|
| Timeline | Horizontal filmstrip with status borders (Green/Yellow/Red) |
| Stage | Central canvas at 4x zoom with Onion Skinning |
| Inspector | Metadata, Audit Score, Action Panel |

### 8.2 Nudge (Manual Alignment Override)

**Workflow:**
1. User drags sprite
2. System records Human Delta (non-destructive)
3. Delta applied at export time

```typescript
interface HumanAlignmentDelta {
  frameId: string;
  userOverrideX: number;
  userOverrideY: number;
  timestamp: string;
}
```

### 8.3 Patch (Corrective Inpainting)

**Workflow:**
1. Select Mask Pen
2. Draw over malformed area
3. Type correction prompt
4. Click Patch → Gemini Inpaint API

### 8.4 Visual Diffing

| Failure | Visual Feedback |
|---------|-----------------|
| SF01 (Palette) | Highlight illegal pixels in blinking magenta |
| HF03 (Baseline) | Cyan line at Anchor floor, Red line at current floor |

### 8.5 Frame Lifecycle Status

```typescript
type FrameLifecycleStatus =
  | 'PENDING'
  | 'GENERATED'
  | 'AUDIT_FAIL'
  | 'AUDIT_WARN'
  | 'APPROVED';
```

---

## Category 9: Pipeline Integration (CLI)

### 9.1 CLI Structure

**Command:** `banana gen --move=<id> [--interactive]`

```typescript
program
  .name('banana')
  .description('Nano Banana Pro - AI Sprite Pipeline')
  .version('1.0.0');
```

### 9.2 Orchestrator Flow

1. **Phase 1: Generation Loop**
   - Generate frame
   - Audit frame
   - Auto-align if drift detected
   - Store with audit report

2. **Phase 2: Director Mode** (if `--interactive`)
   - Launch Express server on port 3000
   - Serve React UI
   - Wait for commit
   - Save to disk

### 9.3 Director Server

**Endpoints:**
| Route | Purpose |
|-------|---------|
| `GET /api/session` | Fetch current session state |
| `POST /api/patch` | Trigger inpainting |
| `POST /api/commit` | Save & quit |

---

## Appendix A: Reason Codes

### Hard Fails (HF) — Terminal

| Code | Description | Recovery |
|------|-------------|----------|
| HF01 | API Blocked (Safety) | Manual prompt revision |
| HF02 | Dimension Mismatch | Check generation config |
| HF03 | Baseline Drift (Post-Align) | AutoAligner failed |
| HF04 | Transparent Frame | Regenerate |
| HF_ENGINE_FAIL | Phaser micro-test failed | Adjust manifest |
| HF_MAX_ATTEMPTS | Retry ladder exhausted | Manual intervention |
| HF_IDENTITY_COLLAPSE | Double re-anchor failed | Skip frame, continue run |
| HF_ATLAS_FORMAT | Invalid MultiAtlas structure | Fix TexturePacker config |

### Soft Fails (SF) — Retriable

| Code | Description | Strategy |
|------|-------------|----------|
| SF01 | Identity Drift (SSIM < 0.9) | Re-anchor (drop [IMAGE 2]) |
| SF02 | Style Drift | Adjust temperature |
| SF03 | Baseline Drift (Pre-Align) | AutoAlign + Retry |
| SF04 | Temporal Flicker (MAPD) | Chain from previous |
| SF_PIXEL_NOISE | Orphan pixels > 15 | Regenerate at higher res |
| SF_PALETTE_DRIFT | > 10% rogue colors | Lock template |

---

## Appendix B: State Machine

```
PENDING → GENERATING → AUDITING → RETRY_DECIDING
                                       ↓
                              ┌────────┴────────┐
                              ↓                 ↓
                         APPROVING          REJECTING
                              ↓                 ↓
                         EXPORTING         NEXT_FRAME
                              ↓
                         VALIDATING
                              ↓
                    ┌─────────┴─────────┐
                    ↓                   ↓
               COMPLETED            FAILED
                                       ↓
                              (if recoverable)
                                       ↓
                               ERROR_SYSTEM
                                       ↓
                              (resume available)
```

**Stop Condition:** If `reject_rate > 0.3` at any point → `STOPPED`

---

## Appendix C: Thresholds Reference

### Quality Metrics

| Metric | Pass | Soft Fail | Hard Fail |
|--------|------|-----------|-----------|
| SSIM (Identity) | ≥ 0.9 | 0.85-0.9 | < 0.85 |
| Baseline Drift | ≤ 1px | 2-3px | > 3px |
| Orphan Pixels | 0-5 | 6-15 | > 15 (SF only) |
| Palette Match | ≥ 90% | 85-90% | < 85% |
| Halo Ratio | < 1% | 1-5% | > 5% |

### MAPD by Move Type

| Move | Threshold |
|------|-----------|
| Idle | > 0.02 |
| Walk | > 0.10 |
| Block | > 0.05 |
| Attack | BYPASS |
| Jump | BYPASS |
| Hit | BYPASS |

### Retry Ladder

| Level | Strategy | Max Attempts |
|-------|----------|--------------|
| 1 | Temperature bump | 2 |
| 2 | Re-anchor (drop [IMAGE 2]) | 2 |
| 3 | Pose rescue (add guide) | 1 |
| Total | — | 5 |

### Pipeline Limits

| Parameter | Value |
|-----------|-------|
| Max Images per Request | 2 (MVP) |
| Safety Valve Shift | ±32px |
| Root Zone Ratio | 15% (default) |
| Generation Resolution | 512px |
| Output Resolution | 128px |
| Frame Key Padding | 4 digits |
| Max Reject Rate | 30% |

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-18 | Deep Think Analysis | Initial consolidation from Sessions A, B, C + Category 6 + Follow-ups |

**Lock Status:** 🔒 LOCKED FOR MVP IMPLEMENTATION

**Next Review:** Post-MVP retrospective
