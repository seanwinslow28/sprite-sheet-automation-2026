**Implementation doc** for integrating **Nano Banana Pro (gemini-3-pro-image-preview)** into your **16BitFit Battle Mode sprite pipeline**, written so future agentic coding tools can pick it up and execute.

---

# **16BitFit Battle Mode — Nano Banana Pro Integration Spec**

**Model:** `gemini-3-pro-image-preview` (Nano Banana Pro)  
**Interface:** Gemini CLI \+ `nanobanana` extension (primary), Gemini API/Vertex API (optional future backend)  
**Status:** Adopt now. LangChain/LangFlow intentionally deferred.

---

## **1\) Purpose**

Integrate **Nano Banana Pro** as a **first-class Generator backend** inside the existing autonomous sprite pipeline:

**Choreographer → Generator (edit-from-anchor) → Auditor → Retry Ladder → Approve → Pack Atlas → Phaser micro-tests**

This integration must preserve the pipeline’s core “production truth”:

* **Frame-by-frame generation** (not monolithic sprite sheets), because we need per-frame audit, per-frame retry, and baseline/pivot stability.  
* **Anchor-locked identity** with minimal drift over long sequences.  
* **Deterministic exports** (PNG \+ JSON atlas) that Phaser loads without jitter or halo artifacts.

Battle Mode style target is **full-color SF2/Capcom-inspired 2D fighting sprites**, landscape context, and classic arcade UI compatibility.

16BitFit \- Battle Mode Art Style

---

## **2\) Why Nano Banana Pro fits this job**

### **2.1 It’s explicitly positioned for “professional asset production”**

Google’s prompting guide frames Nano Banana Pro as moving from “fun” generation to “functional professional asset production,” emphasizing **character consistency** and **high-resolution output**.

Google Article \- 10 Prompting T…

### **2.2 It’s a “Thinking” model — better at following production constraints**

The guide explicitly says it’s a **“Thinking” model** that understands intent/physics/composition and advises avoiding “tag soups” in favor of natural creative direction.

Google Article \- 10 Prompting T…

### **2.3 The workflow style matches animation needs: “Edit, don’t re-roll”**

This is the single most important operational rule for animation: if a frame is 80% correct, **edit it** rather than regenerating from scratch.

Google Article \- 10 Prompting T…

That maps perfectly to your retry ladder philosophy: bounded, reason-code-driven refinement instead of random rerolls.

---

## **3\) What we are NOT doing right now**

* We are **not** adopting LangChain/LangFlow at this time (you’ll translate the *idea* into your own UX/UI).  
* We are **not** redesigning the pipeline architecture. Nano Banana Pro is a **drop-in generator backend** that must conform to your existing manifest \+ audit \+ export contract.

---

## **4\) Required context pack for future agentic coding tools**

If you want a future coding agent to implement this cleanly, include these documents as “context / source of truth”:

### **Core pipeline \+ audit \+ scoring**

1. **Opus Audit Rubric** — hard fails, soft fails, reason codes, thresholds, prompt templates, manifest schema, stop conditions, packing/export contract.  
    Opus-4.5-16bitfit-Audit-Rubric-…  
2. **Gemini scoring system aligned with Opus** — weights, gates, stability/identity prioritization.  
    Gemini\_Deep-Think\_Sprite-Animat…  
3. **Claude pipeline extraction report** — atlas vs spritesheet rationale, TexturePacker CLI settings, Phaser loading stubs, pivot notes.  
    Claude In Chrome \- 16BitFit Spr…

### **Style \+ animation spec**

4. **16BitFit Battle Mode Art Style** — SF2/Capcom full-color rules.  
    16BitFit \- Battle Mode Art Style  
5. **Champion pose \+ boss prompt planning** — 128×128 champions, 256×256 bosses, facing RIGHT, bold outlines, crisp pixels, no AA/motion blur.  
    Champion-Poses-And-Boss-Charact…  
   Champion-Poses-And-Boss-Charact…

### **Nano Banana Pro integration sources**

6. **Nano Banana Pro prompting guide** (Google) — “edit don’t reroll”, natural language, identity locking, grids/layout control, high-res, thinking process.  
    Google Article \- 10 Prompting T…  
7. **Gemini CLI Nano Banana Pro extension summary** — notes model lifecycle \+ CLI support for `gemini-3-pro-image-preview`.  
    Gemini-3-CLI-NANOBANANAPRO-Exte…  
8. **Gemini CLI `nanobanana` extension repo** (web) — exact commands, env vars, options (`/generate`, `/edit`, `--seed`, etc.).  
9. **Gemini 3 thought signatures docs** (web) — required if you later build a direct API adapter for multi-turn edits.  
10. **Vertex image generation doc** (web) — max input images, max output resolution, multi-turn editing guidance.  
11. **Nano Banana image generation doc** (web) — clarifies model IDs \+ mentions SynthID watermark.

---

## **5\) Tooling: Gemini CLI \+ Nano Banana extension (how to run Nano Banana Pro)**

### **5.1 Install \+ activate the extension (CLI)**

The extension is installed via Gemini CLI and exposes image commands including `/generate` and `/edit`.

Example install command (from the repo):

`gemini extensions install https://github.com/gemini-cli-extensions/nanobanana`

### **5.2 Select Nano Banana Pro model**

Set:

* `NANOBANANA_MODEL=gemini-3-pro-image-preview`

### **5.3 Provide an API key (required by the extension)**

The repo documents supported env vars (recommended \+ fallback):

* `NANOBANANA_GEMINI_API_KEY` / `NANOBANANA_GOOGLE_API_KEY`  
* fallbacks: `GEMINI_API_KEY` / `GOOGLE_API_KEY`

### **5.4 Commands we will use**

* `/generate "prompt..."` — generates images (supports `--seed`, `--count`, `--styles`, etc.)  
* `/edit input.png "edit instruction..."` — edits an existing image using natural language instructions

**Pipeline rule:** Prefer `/edit` over `/generate` for animation frames, because “edit, don’t re-roll” is a core Nano Banana Pro best practice.

Google Article \- 10 Prompting T…

---

## **6\) Integration point in your pipeline**

### **6.1 Nano Banana Pro \= Generator backend for Step 2**

Nano Banana Pro is used inside **Editor / Generator (edit-from-anchor)**:

**Inputs (per frame attempt):**

* `anchor.png` (identity lock)  
* `pose_spec` (from Choreographer)  
* `style_rules` (Battle Mode: SF2/Capcom)  
* `palette_spec` (character palette JSON)  
* `frame_size` (128×128 champions, 256×256 bosses)  
* `facing=right` (flip in-engine later)

**Outputs (per attempt):**

* `candidate_frame.png`  
* `generator_metadata.json` (model id, seed if used, prompt text, command used, timestamp)  
* optional: `thoughtSignature` equivalents if ever using direct API (see §12)

### **6.2 Generator adapter contract (implementation requirement)**

Create a generator adapter interface so you can swap generators later without changing the audit system:

**Function signature (conceptual):**

* `generate_frame(manifest, frame_index, attempt_index) -> CandidateResult`

Where `CandidateResult` includes:

* `image_path`  
* `raw_prompt`  
* `generator_params` (model id, seed, mode generate/edit, etc.)  
* `attempt_id`  
* `errors` (if CLI call fails)

This adapter should be callable by your run orchestrator, and return deterministic file outputs into the run folder.

---

## **7\) Manifest additions (Nano Banana Pro specific)**

Add a `generator` block to your manifest (or equivalent config object):

`{`  
  `"generator": {`  
    `"backend": "gemini_cli_nanobanana",`  
    `"model": "gemini-3-pro-image-preview",`  
    `"mode": "edit_from_anchor",`  
    `"use_prev_frame_chaining": true,`  
    `"seed_policy": "fixed_per_frame_attempt",`  
    `"max_attempts_per_frame": 12`  
  `}`  
`}`

**Notes:**

* `mode=edit_from_anchor` means frame 1 edits from anchor; later frames edit from previous approved frame or anchor (see §9).  
* `seed_policy`: if you use `/generate --seed`, store it. `/edit` may not expose seeds; don’t invent them. Log what you can.  
* `max_attempts_per_frame` should mirror your stop conditions (Opus).  
   Opus-4.5-16bitfit-Audit-Rubric-…

---

## **8\) Prompt system: Nano Banana Pro-optimized (but still pipeline-compatible)**

Your existing prompt locking system from Opus is already very close to what Nano Banana Pro wants: full sentences, clear constraints, locked reference, and explicit “do not change” lists.

Opus-4.5-16bitfit-Audit-Rubric-…

### **8.1 Core prompting rules to enforce**

From Google’s guide:

* Use natural language \+ full sentences.  
   Google Article \- 10 Prompting T…  
* Be specific \+ descriptive.  
   Google Article \- 10 Prompting T…  
* Provide context (“why / for whom”).  
   Google Article \- 10 Prompting T…  
* Edit, don’t re-roll.  
   Google Article \- 10 Prompting T…

### **8.2 Prompt templates you should maintain (required)**

Maintain four templates (the pipeline calls the correct one depending on reason codes):

1. **Master Prompt** (used for first attempt of a move)  
2. **Variation Prompt** (per frame i of N)  
3. **Consistency Lock / Recovery Prompt** (used after identity drift / line drift / halo issues)  
4. **Negative Prompt Block** (inlined into others where supported; otherwise appended as “Avoid:” text)

Opus already provides Variation \+ Lock/Recovery templates in a production-friendly structure.

Opus-4.5-16bitfit-Audit-Rubric-…

### **8.3 Recommended Nano Banana frame prompt pattern (copy-ready)**

Use this structure inside `/edit`:

**Frame i prompt (Variation template):**

* Start with intent: “You are generating a single animation frame…”  
* Declare hard locks: identity, outfit, proportions, scale, camera angle, facing, canvas size  
* Declare style rules (SF2/Capcom, crisp pixel edges)  
* Declare palette lock  
* Declare background rules (transparent / or fallback method)  
* Provide the specific pose spec  
* End with “Only change what is required…”

This is consistent with Opus’ template wording.

Opus-4.5-16bitfit-Audit-Rubric-…

---

## **9\) Frame generation algorithm (the operational heart)**

### **9.1 Golden rule: Frame-by-frame, edit-first**

Even though Nano Banana Pro can be pushed to do storyboard or grid outputs, the pipeline should generate **one frame at a time** for auditability and drift control.

This is aligned with Google’s “generate sequential images one at a time” guidance in the storyboarding examples.

Google Article \- 10 Prompting T…

### **9.2 Canonical facing direction (RIGHT)**

All generation is **facing RIGHT**; left-facing is done via engine flip. This halves generation work and drift risk. (This is already embedded in your prompt planning docs.)

Champion-Poses-And-Boss-Charact…

### **9.3 Per-move generation flow (recommended)**

For each move (Idle, Walk, Punches, etc.):

**Step A — Prep**

1. Load manifest move block: `expected_frames`, naming policy, pose specs.  
2. Confirm anchor exists \+ matches target canvas size.

**Step B — Generate frame 1**

* Use `/edit anchor.png "<frame1_prompt>"`  
* Save output to:  
  * `.../moves/<move_id>/candidates/frame_0001_try1.png`

**Step C — Audit**

* Run hard gates first (format/dims/alpha, baseline stability, naming contract).  
   Opus-4.5-16bitfit-Audit-Rubric-…  
* If hard fail → reason code → retry ladder (Step E).  
* If pass hard gates → compute soft metrics (SSIM/DINO/palette/line drift/temporal).  
   Opus-4.5-16bitfit-Audit-Rubric-…

**Step D — Approve**

* If pass: move to `approved/frame_0001.png`  
* Record attempt \+ metrics in `audit.json` (Opus schema).  
   Opus-4.5-16bitfit-Audit-Rubric-…

**Step E — Frame i chaining (critical for temporal coherence)**  
For frame i\>1, default to **previous approved frame chaining**:

* `/edit approved/frame_{i-1}.png "<frame_i_delta_prompt>"`

Why:

* Opus explicitly recommends “anchor-to-anchor chaining (use prev frame as reference)” to reduce temporal flicker.  
   Opus-4.5-16bitfit-Audit-Rubric-…

**Step F — Escalation rule**  
If frame i repeatedly drifts:

* fall back to `/edit anchor.png "<frame_i_prompt_with_strict_lock>"`  
  This re-anchors identity when chaining accumulates drift.

---

## **10\) Retry ladder mapping (Nano Banana Pro version)**

Your existing retry ladder concept stays the same, but “knobs” are different because this is not a denoise/ControlNet workflow.

### **10.1 Reason-code → Action mapping (examples)**

**HF01\_FORMAT\_MISMATCH / HF01\_NO\_ALPHA**

* Regenerate with explicit canvas \+ format instructions.  
* Never resize post-hoc (Opus rule).  
   Opus-4.5-16bitfit-Audit-Rubric-…

**HF02\_OPAQUE\_BACKGROUND / HF02\_EXCESSIVE\_HALO**

* Retry with stricter background instructions.  
* If persistent, use keyed BG \+ matte extraction (Opus explicitly allows this fallback).  
   Opus-4.5-16bitfit-Audit-Rubric-…

**HF03\_BASELINE\_DRIFT**

* Add stricter baseline lock language.  
* Use structural control guides (grid/baseline overlay reference) (see §11).

**SF01\_IDENTITY\_DRIFT**

* Switch to **Lock/Recovery prompt template**.  
* Increase “do NOT change” explicit list.  
* Re-anchor from original anchor (not prev frame) for one attempt.

**SF04\_TEMPORAL\_FLICKER**

* Re-run using prev-frame chaining more aggressively.  
   Opus-4.5-16bitfit-Audit-Rubric-…

---

## **11\) Identity locking \+ structural control (where Nano Banana Pro shines)**

### **11.1 Multi-image reference strategy**

Google’s guide states Nano Banana Pro supports **up to 14 reference images**, with **6 “high fidelity”** for identity locking.

Google Article \- 10 Prompting T…

Vertex docs also recommend **max 14 images** for best results with Gemini 3 Pro Image.

**Recommended “reference stack” priority (for direct API mode later):**  
High-fidelity slots (most important):

1. Full-body anchor (canonical)  
2. Face/hair crop  
3. Outfit/torso crop  
4. Shoes/feet crop (baseline consistency)  
5. Last approved frame (temporal continuity)  
6. Pose guide overlay (stick figure / skeletal key pose)

Additional (non-high-fidelity) refs:

* palette swatches / callout sheet  
* style reference (SF2 sprite sample)  
* “baseline \+ safe box grid” overlay (see next)

### **11.2 Structural control with grids / guides**

Google explicitly recommends using **grids** to force generation for tile-based games and even gives sprite/grid examples.

Google Article \- 10 Prompting T…

**Pipeline action item:** Create and standardize these guide images:

* `guide_128.png` and `guide_256.png` containing:  
  * baseline line  
  * vertical centerline  
  * safe area box  
  * “feet zone”  
  * optional frame index label (outside safe area)

When you use them as references, instruct:

* “Follow the guide layout exactly; do not render the guide lines in the final.”

If guide lines appear, Auditor should reject and retry with tighter instructions.

---

## **12\) Thought signatures (important for future API integration)**

If/when you build a **direct API adapter** instead of relying on the CLI extension, you must handle **thought signatures** for multi-turn image editing.

* Gemini 3 API docs state thought signatures are critical for `gemini-3-pro-image-preview` editing and missing signatures can cause errors in strict validation contexts.  
* Vertex docs say Gemini 3 Pro Image may not enforce strict validation in the same way, but still recommends returning them to maintain context.

**Implementation requirement:**

* Persist the model’s response parts (including any `thoughtSignature`/`thought_signature`) in your per-frame attempt logs so edits can remain consistent across turns.

---

## **13\) Output resolution \+ “SynthID watermark” risk**

### **13.1 Max resolution behavior**

Vertex docs: Gemini 3 Pro Image can generate images up to **4096px**; Gemini 2.5 Flash Image is 1024px.

**Pipeline policy (recommended):**

* Generate at high resolution only if it improves edge quality after downscale.  
* Downscale deterministically to 128×128 or 256×256 before auditing pixel-edge rules.  
* If downscaling introduces blur, add post steps: nearest-neighbor downscale \+ outline reinforcement (Opus suggests this as a mitigation).  
   Opus-4.5-16bitfit-Audit-Rubric-…

### **13.2 SynthID watermark**

Google’s Nano Banana doc states generated images include a **SynthID watermark**.

This watermark is typically designed to be imperceptible, but **you must micro-test** whether it introduces visible artifacts in pixel art after downscaling.

**Required micro-test:**

* Generate a flat-color sprite output → downscale → zoom to 800–1600% → verify no repeating patterns or odd noise.  
* If present: consider switching generation resolution, or applying a post-process cleanup.

---

## **14\) Auditor \+ scoring integration (unchanged, but enforce these gates)**

### **14.1 Hard fails (kill switches)**

Opus hard fails include:

* PNG RGBA, exact width/height match anchor, alpha present.  
   Opus-4.5-16bitfit-Audit-Rubric-…  
* Background transparency \+ halo thresholds.  
   Opus-4.5-16bitfit-Audit-Rubric-…  
* Baseline drift detection across frames.  
   Opus-4.5-16bitfit-Audit-Rubric-…  
* Naming/metadata contract must be valid.  
   Opus-4.5-16bitfit-Audit-Rubric-…

Gemini scoring system reiterates: if any hard gate fails, **Score=0** immediately.

Gemini\_Deep-Think\_Sprite-Animat…

### **14.2 Score weights**

Scoring prioritizes stability \+ identity (hygiene factors):

* Stability 0.35  
* Identity 0.30  
* Palette 0.20  
* Style/structure 0.15  
   Gemini\_Deep-Think\_Sprite-Animat…

---

## **15\) Packing \+ Phaser export (unchanged; still required)**

### **15.1 Atlases (not spritesheets)**

You standardized on atlases because fighting frames vary in bounding boxes and atlases support trim/pivot metadata.

Claude In Chrome \- 16BitFit Spr…

### **15.2 TexturePacker settings (must match)**

TexturePacker CLI settings that prevent halos/bleed are already standardized:

* `--trim-mode Trim`  
* `--extrude 1`  
* `--shape-padding 2`  
* `--border-padding 2`  
* `--disable-rotation`  
* `--alpha-handling ReduceBorderArtifacts`  
   Claude In Chrome \- 16BitFit Spr…

Opus also includes a copy-ready export contract with those flags.

Opus-4.5-16bitfit-Audit-Rubric-…

### **15.3 Naming policy (Phaser-friendly)**

Keep frame keys deterministic (prefix \+ zeroPad \+ suffix). Opus’ contract shows using **no `.png` suffix** when using `--trim-sprite-names`.

Opus-4.5-16bitfit-Audit-Rubric-…

---

## **16\) Recommended “first pilot” run (minimum viable integration test)**

Run a tiny move to validate the integration end-to-end without burning time:

**Champion:** Sean or Mary  
**Move:** Idle  
**Frames:** 4 (as defined in your prompt planning doc)

Champion-Poses-And-Boss-Charact…

**Success criteria:**

* All frames pass hard gates  
* Baseline drift ≤ 1px  
* Identity metrics above thresholds  
* Packed atlas loads in Phaser and animates with no jitter

---

## **17\) Open implementation decisions (not blockers, but pick soon)**

These are choices your implementation will need, but the pipeline can start without perfect answers:

1. **Do we expect true alpha from Nano Banana outputs consistently?**  
   * If not, adopt keyed BG \+ matte extraction fallback (explicitly allowed by Opus).  
      Opus-4.5-16bitfit-Audit-Rubric-…  
2. **Do we want “prev-frame chaining” on by default?**  
   * Recommended: yes (Opus suggests chaining to reduce flicker).  
      Opus-4.5-16bitfit-Audit-Rubric-…  
3. **Do we generate at 1024 vs 2048 vs 4096 and downscale?**  
   * Required micro-test: determine which preserves crisp outlines best after scaling.

---

## **18\) Questions for you (only if you want to tighten implementation)**

I don’t need answers to proceed, but if you want the *future coding agents* to be extra deterministic:

1. Where do you want the “sprite generation runner” to live (repo folder path)?  
2. Are your anchor sprites already exactly 128×128 / 256×256, or are they higher-res concept anchors?  
3. Do you want the pilot run to target **Sean** or **Mary** first?

