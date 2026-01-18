\[Section 0\] One-paragraph mission  
Design an autonomous, auditable sprite-frame generation pipeline for 16BitFit Battle Mode (Phaser 3\) that takes **locked anchor sprites** and produces **game‑ready animations** (frames \+ packed atlas) while enforcing: **identity lock**, **palette fidelity**, **pixel/outline consistency**, **baseline/pivot stability**, **clean transparency**, **frame-to-frame coherence**, and **correct Phaser-ready export \+ naming**—using a tight **PASS/REJECT audit loop** (programmatic checks \+ vision critique), a deterministic **prompt locking system**, a bounded **retry ladder \+ stop conditions**, and a reproducible **manifest \+ export contract**. The output must be **PNG \+ JSON (Phaser-friendly)** with deterministic naming and consistent baseline/pivot across frames.

context\_packet

---

\[Section 1\] Decisions So Far (bullets)

* **Export packaging for Phaser:** **Use atlases (not uniform grid spritesheets).** Rationale: atlases support variable frame sizes, trimming, and JSON metadata (incl. pivots).  
   Claude In Chrome \- 16BitFit Spr…  
* **Atlas JSON format:** **JSON Hash (primary)** and **multiatlas when multipack needed**. Loader mapping is straightforward in Phaser (`this.load.atlas(...)` vs `this.load.multiatlas(...)`).  
   Claude In Chrome \- 16BitFit Spr…  
  Claude In Chrome \- 16BitFit Spr…  
* **TexturePacker “known-good” export flags to start from (quoted):**  
  * `--format phaser`  
  * `--trim-mode Trim`  
  * `--extrude 1`  
  * `--shape-padding 2`  
  * `--border-padding 2`  
  * `--disable-rotation`  
  * `--alpha-handling ReduceBorderArtifacts`  
  * `--max-size 2048`  
  * plus naming controls `--trim-sprite-names` \+ `--prepend-folder-name` for deterministic frame keys  
    (SOURCE: ClaudeChrome)  
     Claude In Chrome \- 16BitFit Spr…  
    Claude In Chrome \- 16BitFit Spr…  
* **Deterministic frame naming convention (in-atlas):** Prefer **path-based names** like `walk/0001` (no `.png`) by using TexturePacker `--prepend-folder-name` \+ `--trim-sprite-names`. (SOURCE: ClaudeChrome)  
   Claude In Chrome \- 16BitFit Spr…  
* **Pivot/baseline strategy (current best default):** Ground characters should use bottom-center origin: `sprite.setOrigin(0.5, 1)` (SOURCE: ClaudeChrome).  
   Claude In Chrome \- 16BitFit Spr…  
* **Pixel-art filtering policy:** Must ensure NEAREST filtering for loaded atlases (do not rely on defaults). Verified snippet: `this.textures.get('fighter').setFilterMode(Phaser.Textures.FilterMode.NEAREST);`  
   Claude In Chrome \- 16BitFit Spr…  
* **Hard requirement from project context:**  
  * Output must be **PNG \+ JSON (Phaser-friendly)**  
  * **Frame size must match anchor sprite dimensions exactly**  
  * **Transparent background**  
  * **Consistent baseline/pivot across frames**  
  * **Padding between frames: 4px (unless tool recommends otherwise)**  
  * **Naming must be deterministic**  
     context\_packet  
* **DECISION NEEDED (trim vs “frame size must match anchor”):** `--trim-mode Trim` is recommended for packing, but the project also says frames must match anchor dimensions exactly. We need a micro-test to confirm whether Phaser’s handling of trimmed frames \+ `sourceSize/spriteSourceSize/pivot` preserves stable on-screen alignment without jitter. (Test in Section 7.)  
   context\_packet  
  Claude In Chrome \- 16BitFit Spr…

---

\[Section 2\] Known Gotchas & Contradictions (bullets)

* **GOTCHA: “Phaser reads pivot from JSON automatically” is NOT confirmed.**  
  * Why it matters: if pivot isn’t applied, characters will “bounce” between frames even with correct atlas metadata.  
  * Source contradiction: one place claims “Phaser reads these automatically,” but a corrections section says **NEEDS VERIFICATION** and documents manual pivot setting via `customPivot`.  
  * Action: run a 5‑minute pivot test atlas in Phaser; if not auto-applied, enforce pivot via code loop setting `frame.customPivot = true; frame.pivotX; frame.pivotY`.  
     Claude In Chrome \- 16BitFit Spr…  
* **GOTCHA: Trimming can cause baseline drift if offsets differ per frame.**  
  * Why it matters: visible jitter \+ broken hitboxes.  
  * Source: trimming risk register \+ “Trim mode effect on baseline” test item.  
     Claude In Chrome \- 16BitFit Spr…  
  * Action: either (a) disable trim at export, or (b) keep trim but enforce pivot \+ verify in-engine (micro-test).  
* **GOTCHA: `.png` suffix mismatch breaks animation generation.**  
  * Why it matters: `generateFrameNames` will produce names that don’t exist.  
  * Source: `suffix: '' // No .png if using --trim-sprite-names`.  
     Claude In Chrome \- 16BitFit Spr…  
  * Action: standardize *one* convention; manifest must record whether frame names include `.png`.  
* **GOTCHA: Aseprite per-tag export limitation.**  
  * Exact limitation (quoted): `--split-tags only works with --save-as, NOT --sheet`.  
     Claude In Chrome \- 16BitFit Spr…  
  * Action: script loop over `aseprite -b ... --list-tags`, then run `--tag "<name>"` exports per tag.  
     Claude In Chrome \- 16BitFit Spr…  
* **GOTCHA: Pivot metadata location differs by tool.**  
  * Aseprite JSON: **no frame-level pivot**; pivot exists only in `meta.slices[].keys[].pivot`.  
  * TexturePacker Phaser JSON: has frame-level `pivot: {"x":0.5,"y":1.0}`.  
  * Action: don’t expect Aseprite to supply per-frame pivots unless you build slice conventions \+ loader logic.  
* **GOTCHA: Alpha halos / dark borders are common.**  
  * Fix is explicitly called out: TexturePacker `--alpha-handling ReduceBorderArtifacts`.  
  * Action: bake this into export and audit for fringe pixels.  
* **METRICS THRESHOLD CONFLICT (must resolve):**  
  * SSIM thresholds vary by source: `SSIM drop below 0.85` indicates structural drift (Gemini), `SSIM <0.75` reject (Perplexity), and `SSIM > 0.95` proposed (Agent plan).  
     Gemini-Deep-Research\_Refining A…  
    Perplexity-AI-Assisted 2D Sprit…  
    ChatGPT-Deep-Research\_AI Sprite…  
  * Action: pick one tiered scheme (Hard Fail / Soft Fail) \+ calibrate on 1–2 real sequences.  
* **SPEC DATA INTEGRITY ISSUE:** Champion palette contains a likely invalid hex: Sean tank color `#F2FOEF` (includes “O”).  
   Champion And Boss Sprite Descri…  
  * Action: treat as **DECISION NEEDED** → confirm intended value by sampling the anchor sprite’s pixels, then lock corrected hex in manifest.

---

\[Section 3\] Audit Rubric Blueprint (structured)

**Audit outputs must be deterministic:** `{PASS|REJECT}`, plus **reason codes**, plus suggested **retry knob(s)**, plus stored metrics.

### **A) Hard Fail checks (automatic REJECT)**

1. **FORMAT\_AND\_DIMENSIONS\_MATCH**  
* Method: programmatic  
* Inputs: anchor image, candidate frame  
* Rule: candidate must be **PNG RGBA**; width/height **exactly match anchor dimensions**.  
   context\_packet  
* Reject if: any mismatch or missing alpha.  
* Retry knob: lock canvas size in generation; post-process resize is disallowed unless it preserves pixel grid exactly (nearest-neighbor).  
2. **TRANSPARENCY\_BACKGROUND\_CLEAN**  
* Method: programmatic \+ vision spot-check  
* Inputs: candidate frame  
* Rule: background must be transparent.  
   context\_packet  
* Suggested measurable heuristics:  
  * Reject if large connected regions of non-zero alpha outside expected silhouette bounds.  
  * Reject if excessive semi-transparent pixels “halo ring” around silhouette (see also alpha handling).  
* Retry knob: regenerate with explicit “transparent background”; if model can’t, do keyed background \+ matte extraction (decision).  
3. **BASELINE\_PIVOT\_STABILITY**  
* Method: programmatic (mask \+ baseline estimator) \+ quick Phaser visual test  
* Inputs: all frames of a move  
* Rule: baseline/pivot must be consistent across frames.  
   context\_packet  
* Reject if: baseline row varies beyond tolerance (recommend start with ±1 px, then tune).  
* Retry knob: enforce bottom-center pivot `sprite.setOrigin(0.5, 1)` and/or per-frame pivot assignment.  
   Claude In Chrome \- 16BitFit Spr…  
4. **NAMING\_AND\_METADATA\_CONTRACT**  
* Method: programmatic  
* Inputs: exported atlas JSON \+ PNG(s) \+ manifest  
* Rule: deterministic naming \+ consistent suffix policy (extension present/absent) \+ JSON parseable \+ all expected frames present.  
   context\_packet  
  Claude In Chrome \- 16BitFit Spr…  
* Reject if: missing frames, duplicate frame keys, unexpected name patterns, JSON invalid.  
* Retry knob: re-export with standardized folder layout and TexturePacker `--prepend-folder-name` \+ `--trim-sprite-names`.  
   Claude In Chrome \- 16BitFit Spr…  
5. **GROSS\_ANATOMY\_OR\_IDENTITY\_BREAK**  
* Method: vision critique (LLM/VLM) \+ optional embeddings  
* Inputs: anchor \+ candidate  
* Rule: no extra limbs, missing limbs, wrong outfit, wrong hair, major face/shape swap.  
* Reject if: auditor flags “different character” or major structural error.  
* Retry knob: increase reference strength, lower denoise, face/hand inpaint pass (see Retry Ladder).

### **B) Soft Fail checks (score \+ retry; REJECT if below floor)**

These should produce a numeric score and “soft reasons” that guide retries.

6. **IDENTITY\_SIMILARITY\_SCORE** *(CONFLICT: thresholds vary)*  
* Method: embeddings similarity (DINO/CLIP/ArcFace) \+ SSIM \+ vision critique  
* Candidate thresholds from sources (must reconcile):  
  * Perplexity suggests reject if `DINO feature similarity <0.85`.  
     Perplexity-AI-Assisted 2D Sprit…  
  * Gemini suggests SSIM drift warning when `SSIM drop below 0.85`.  
     Gemini-Deep-Research\_Refining A…  
  * Agent plan suggests `SSIM > 0.95` (more strict).  
     ChatGPT-Deep-Research\_AI Sprite…  
* Retry knobs: lower denoise, raise reference/ID conditioning, lock palette, inpaint face.  
7. **PALETTE\_DRIFT\_SCORE**  
* Method: histogram / top-N colors / palette membership  
* Candidate threshold from Perplexity: “top 10 colors within 10% RGB tolerance” else reject.  
   Perplexity-AI-Assisted 2D Sprit…  
* Retry knobs: force palette quantization in post, tighten prompt (“use only these hex colors”), reduce CFG if oversaturating.  
8. **OUTLINE\_AND\_PIXEL\_DENSITY\_DRIFT**  
* Method: edge detection \+ line-weight stats  
* Candidate threshold from Perplexity: reject if “line weight drift \>15%”.  
   Perplexity-AI-Assisted 2D Sprit…  
* Retry knobs: reduce CFG, enforce “crisp pixel edges / no blur”, nearest-neighbor downscale, outline reinforcement step.  
9. **FRAME\_TO\_FRAME\_COHERENCE / FLICKER**  
* Method: temporal SSIM/LPIPS between adjacent frames; variance in “static” regions  
* Candidate metric suggestion: “LPIPS variance \<0.15 across walk cycle” (Gemini).  
   Gemini-Deep-Research\_Refining A…  
* Retry knobs: anchor-to-anchor chaining, reduce noise/denoise, enforce consistent lighting, run a temporal smoothing pass (only if it doesn’t blur pixel edges).  
10. **ALPHA\_EDGE\_ARTIFACTS (HALO/FRINGE)**  
* Method: analyze pixels in 1–2 px band outside silhouette; count semi-transparent \+ tinted fringe pixels  
* Mitigation is explicit: TexturePacker `--alpha-handling ReduceBorderArtifacts`.  
* Retry knobs: ensure extrude/padding, re-pack with correct alpha handling, adjust background removal approach.

### **C) Human review gates (only when necessary)**

* **Metrics disagreement** (e.g., identity passes but palette fails) → queue for quick accept/reject or rule adjustment.  
* **Known reality check:** some research expects **20–30% manual touchup** in current-gen AI sprite pipelines; build a manual override path, not silent failure.  
   Perplexity-AI-Assisted 2D Sprit…

---

\[Section 4\] Retry Ladder (ordered list)

1. **Reroll seeds (N candidates) with identical locked prompt \+ references**  
* Use when: random artifacts, minor deformities.  
* Stop after: 2–3 rerolls per frame.  
2. **Tighten negative prompt \+ reroll**  
* Target: extra limbs, background leakage, blur/anti-aliasing, “painterly” textures.  
3. **Identity rescue pass**  
* Adjust: lower denoise / increase anchor/reference strength.  
* Target: face/hair/outfit drift, silhouette changes.  
4. **Pose rescue pass**  
* Adjust: strengthen pose conditioning (ControlNet weight), regenerate with corrected pose map / keypoints.  
* Target: pose mismatch, limb placement errors.  
5. **Two-stage generate → inpaint critical regions**  
* Target: face, hands, signature outfit elements.  
* Goal: fix localized drift without changing whole frame.  
6. **Post-process corrections (only if pixel-safe)**  
* Palette quantization (strict or near-strict), nearest-neighbor resize, outline reinforcement, halo cleanup.  
* Target: palette drift, pixel density drift, edge artifacts.  
7. **Escalation: per-character fine-tuning / LoRA (only if systemic failures)**  
* Trigger: if rejection rate stays high across frames/moves. Perplexity suggests: if “\>50% rejection rate”, retrain LoRA or adjust conditioning.  
   Perplexity-AI-Assisted 2D Sprit…  
8. **Stop conditions (global)**  
* Hard stop if: any single frame exceeds max retries (recommend 3\) OR if \>20% of frames in a move need retries (pipeline instability signal).  
   Perplexity-AI-Assisted 2D Sprit…  
* Emit: summary report \+ recommended knob changes (not silent fail).

---

\[Section 5\] Prompt System Requirements \+ Draft Templates (4 templates)

**Prompt system requirements (must encode):**

* **Identity is locked to anchor sprite** (no redesign).  
   context\_packet  
* **Style lock:** full-color 2D fighting-game aesthetic (Street Fighter/Capcom vibe), landscape battle stage, SF2-like UI framing (where relevant).  
   16BitFit \- Battle Mode Art Style  
* **Output constraints:** transparent background; exact frame dimensions; consistent scale; consistent baseline/pivot.  
   context\_packet  
* **Palette lock:** enforce character’s canonical colors; if spec hex values are malformed, sample from anchor and correct in manifest (Sean tank has `#F2FOEF` typo).  
   Champion And Boss Sprite Descri…  
* **Camera consistency:** facing direction \+ angle must be consistent across frames within a move. (Not fully specified in docs → treat as “locked to anchor” and mirror in-engine if needed.)

**Draft templates (placeholders exactly as requested):**

1. **MASTER TEMPLATE**

`You are generating a single animation frame for a 2D pixel-art fighting game (Phaser 3).`  
`Character: {CHAR_ID}`  
`Move: {MOVE}`  
`Pose spec (must match exactly): {POSE_SPEC}`

`LOCKED REFERENCE (do not redesign): {ANCHOR_REF}`  
`- Preserve identity: face, hair, body shape, outfit silhouette, accessories.`  
`- Preserve scale: same pixel scale as anchor.`  
`- Canvas size MUST be exactly {FRAME_W} x {FRAME_H}.`  
`- Baseline/pivot must remain consistent across all frames of this move.`

`Style rules (must follow): {STYLE_RULES}`  
`Palette lock (prefer these exact colors / closest shades): {PALETTE}`

`Background: fully transparent (alpha), no scenery, no props unless explicitly part of the move.`  
`Render: crisp pixel-art edges, no blur, no painterly textures, no anti-aliasing halos.`

2. **VARIATION TEMPLATE (frame i of N)**

`Generate frame {i}/{N} for {CHAR_ID} performing {MOVE}.`  
`Pose spec: {POSE_SPEC}`  
`Anchor reference: {ANCHOR_REF}`

`Hard locks:`  
`- Same character identity and outfit as anchor.`  
`- Same camera angle and facing direction as anchor.`  
`- Exact canvas: {FRAME_W} x {FRAME_H}.`  
`- Feet/ground contact must align to the same baseline as the anchor sequence.`

`Style: {STYLE_RULES}`  
`Palette constraint: {PALETTE}`

`Only change what is required by the pose progression for {MOVE}; keep everything else stable.`

3. **LOCK TEMPLATE (use after a REJECT for identity drift)**

`STRICT CONSISTENCY MODE.`  
`Character: {CHAR_ID}`  
`Move: {MOVE}`  
`Pose spec: {POSE_SPEC}`  
`Anchor reference: {ANCHOR_REF}`

`Do NOT change: face shape, hair shape, outfit design, color distribution, body proportions.`  
`Match anchor pixel density and outline thickness.`  
`Exact size: {FRAME_W} x {FRAME_H}.`  
`Style rules: {STYLE_RULES}`  
`Palette lock: {PALETTE}`

`Goal: re-render the same pose with higher identity fidelity and cleaner edges.`

4. **NEGATIVE TEMPLATE**

`Avoid: background/scene, gradients, blur, soft shading, painterly texture, anti-aliasing halos,`  
`motion blur, lens effects, depth of field, extra limbs/fingers, missing limbs, wrong outfit,`  
`logos/text/watermarks, new accessories, random color shifts, glowing outlines, noisy dithering.`  
`Must remain consistent with {ANCHOR_REF}, {STYLE_RULES}, and {PALETTE}.`

**Canonical palette refs (from spec doc; use as “required colors” \+ audit anchors):**

* Sean: skin `#F5D6C6`, hair `#C2A769`, eyes `#4682B4`, shorts `#2323FF`, tank `#F2FOEF` *(invalid hex → needs correction)*, shoes `#272929`.  
   Champion And Boss Sprite Descri…  
* Mary: skin `#F0C8A0`, hair `#8D5524`, eyes `#654321`, sports bra `#FF69B4`, shorts `#1E90FF`, shoes `#C0C0C0`.  
   Champion And Boss Sprite Descri…  
* Marcus: skin `#A66A4A`, hair `#3A2A1A`, eyes `#654321`, shirt `#FFFFFF`, shorts `#708090`, shoes `#272929`, gloves `#FFD700`.  
   Champion And Boss Sprite Descri…  
* Aria: skin `#F1C27D`, hair `#3C2F2F`, eyes `#4682B4`, top `#800020`, leggings `#2F4F4F`, shoes `#A9A9A9`.  
   16BitFit \- Battle Mode Art Style  
* Kenji: skin `#FAD7B5`, hair `#1C1C1C`, eyes `#4B3621`, gi `#FFFFFF`, belt `#000000`, gloves `#DC143C`, feet wraps `#FFFFFF`.  
   Champion And Boss Sprite Descri…  
* Zara: skin `#D2A679`, hair `#8B0000`, eyes `#2F4F4F`, top `#FFFFFF`, shorts `#FFD700`, shoes `#A9A9A9`, bandana `#8B0000`.  
   Champion And Boss Sprite Descri…

---

\[Section 6\] Implementation Interfaces (folder \+ manifest schema)

**A) Folder structure (characters/moves/frames)**

`/assets_src/`  
  `/characters/{CHAR_ID}/`  
    `/anchors/`  
      `anchor.png`  
    `/spec/`  
      `palette.json`  
    `/moves/{MOVE}/`  
      `/pose_refs/            # pose images / keypoints (if used)`  
        `frame_0001.png`  
      `/candidates/`  
        `frame_0001_try1.png`  
        `frame_0001_try2.png`  
      `/approved/`  
        `frame_0001.png`  
        `frame_0002.png`  
      `/audit/`  
        `frame_0001.json`  
        `move_summary.json`

`/exports/`  
  `/phaser/{CHAR_ID}/`  
    `atlas.json`  
    `atlas.png               # or atlas{n}.png if multipack`  
  `/manifests/`  
    `run_{RUN_ID}.json`

**B) Generation \+ audit manifest schema (minimal but sufficient)**

`{`  
  `"run_id": "RUN_2026_01_11_001",`  
  `"character_id": "{CHAR_ID}",`  
  `"anchor_ref": "{ANCHOR_REF}",`  
  `"frame_w": "{FRAME_W}",`  
  `"frame_h": "{FRAME_H}",`  
  `"style_rules": "{STYLE_RULES}",`  
  `"palette": "{PALETTE}",`  
  `"moves": [`  
    `{`  
      `"move_id": "{MOVE}",`  
      `"expected_frames": 12,`  
      `"naming_policy": { "prefix": "walk/", "zeroPad": 4, "suffix": "" },`  
      `"frames": [`  
        `{`  
          `"frame_index": 1,`  
          `"pose_spec": "{POSE_SPEC}",`  
          `"attempts": [`  
            `{`  
              `"attempt": 1,`  
              `"seed": 123456,`  
              `"prompt_hash": "sha256...",`  
              `"candidate_path": "candidates/frame_0001_try1.png",`  
              `"audit": {`  
                `"result": "REJECT",`  
                `"reason_codes": ["IDENTITY_DRIFT", "PALETTE_DRIFT"],`  
                `"metrics": { "ssim": 0.82, "dino": 0.83, "line_weight_drift": 0.21 }`  
              `}`  
            `}`  
          `],`  
          `"final": {`  
            `"path": "approved/frame_0001.png",`  
            `"audit_result": "PASS"`  
          `}`  
        `}`  
      `]`  
    `}`  
  `],`  
  `"export": {`  
    `"packer": "TexturePacker",`  
    `"format_flag": "--format phaser",`  
    `"multiatlas": false,`  
    `"phaser_loader": "this.load.atlas"`  
  `}`  
`}`

**C) Phaser export constraints \+ loader mapping (quoted strings)**

* **Single atlas export** uses TexturePacker “Phaser” format and loads via:  
  * Loader: `this.load.atlas('fighter', 'assets/fighter.png', 'assets/fighter.json');`  
     Claude In Chrome \- 16BitFit Spr…  
* **Multiatlas (multipack)** loads via:  
  * Loader: `this.load.multiatlas('cityscene', 'assets/cityscene.json', 'assets/');` (3rd param is PNG path).  
     Claude In Chrome \- 16BitFit Spr…  
* **Animation frame name generation** must match naming policy:  
  * `this.anims.generateFrameNames('fighter', { start: 1, end: 8, zeroPad: 4, prefix: 'walk/', suffix: '' });`  
     Claude In Chrome \- 16BitFit Spr…  
* **Pivot enforcement (manual, verified pattern):**  
  * Set per sprite: `sprite.setOrigin(0.5, 1)` OR set per frame via `frame.customPivot = true; frame.pivotX = 0.5; frame.pivotY = 1.0`.  
     Claude In Chrome \- 16BitFit Spr…  
* **Pixel-art filtering:** `this.textures.get('fighter').setFilterMode(Phaser.Textures.FilterMode.NEAREST);`  
   Claude In Chrome \- 16BitFit Spr…

**D) TexturePacker command contract (quoted, source ClaudeChrome)**

* Single atlas export flags include `--trim-sprite-names` \+ `--prepend-folder-name` to stabilize keys.  
   Claude In Chrome \- 16BitFit Spr…  
* Multipack adds `--multipack` and uses `--sheet atlas{n}.png`.  
   Claude In Chrome \- 16BitFit Spr…

---

\[Section 7\] Open Questions \+ Micro-Experiments (table)

| Open Question (DECISION NEEDED) | Why we care | Smallest micro-experiment | Pass/Fail observation | Decision after test |
| ----- | ----- | ----- | ----- | ----- |
| Does Phaser auto-apply `pivot: {x,y}` from TexturePacker JSON? | If not, we must manually set pivots or baseline jitter occurs | Export 2-frame atlas with different pivots; load; inspect `frame.pivotX/Y` \+ rendered anchor | PASS if pivot affects render without manual code | If FAIL → always run pivot-setting loop (`customPivot=true`) |
| Can we use `--trim-mode Trim` while still satisfying “frame size matches anchor”? | Trim changes frame rects; may violate constraints or cause jitter | Pack same frames with Trim vs None; animate in Phaser; compare baseline jitter | PASS if no jitter and apparent size stable | Keep Trim (more efficient) or disable Trim |
| What is the correct Sean tank hex (spec shows `#F2FOEF` invalid)? | Palette lock/audit will fail if spec is wrong | Sample tank pixels from anchor sprite; compute most common hex | PASS when a valid hex consistently appears | Update spec \+ manifest palette |
| Should frame keys include `.png` or not? | Animation generation depends on it | Export with `--trim-sprite-names` on/off; run `generateFrameNames` with suffix `''` vs `'.png'` | PASS if animation finds all frames | Lock one convention and enforce in manifest \+ CI check |
| What SSIM/DINO thresholds correlate with “looks right”? | Current sources conflict | Run audit metrics on 10 known-good \+ 10 known-bad frames; plot distributions | Choose thresholds that separate sets cleanly | Finalize Hard/Soft thresholds |
| Is `roundPixels` needed to avoid shimmer? | Subpixel jitter in WebGL scaling | Toggle `game.config.roundPixels = true` and compare | PASS if shimmer reduced without artifacts | Turn on/off globally |
| Optimal extrude/padding combo vs context “4px padding”? | Bleeding can happen at scale changes | Export variants (extrude 1, shape-padding 2 vs 4\) and test at 0.5x/2x scale | PASS if no fringe/bleed | Lock export defaults |
| Do we generate on transparent background or do keyed BG \+ matting? | Alpha halos / bad cutouts risk | Generate 5 frames both ways; audit halo rate | PASS if transparent is clean enough | Choose one and standardize |
| Can Aseprite tags drive Phaser anim defs automatically? | Eliminates manual animation config | Export Aseprite json-hash; parse `meta.frameTags`; auto-create anims | PASS if correct frame ranges | Implement generator step |
| Multiatlas frame ordering deterministic? | Animation sequences must be stable | Multipack 100+ frames; compare `getFrameNames()` order to expected | PASS if deterministic | If FAIL → build explicit ordered list from manifest |

(Several of these tests are explicitly suggested as “Gaps & Next Tests” in ClaudeChrome; we’re converting them into actionable micro-experiments.)

