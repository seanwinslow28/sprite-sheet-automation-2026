---
stepsCompleted:
  - step-01-init
  - step-02-discovery
  - step-03-success
  - step-04-journeys
  - step-05-domain
  - step-06-innovation
  - step-07-project-type
  - step-08-scoping
  - step-09-functional
  - step-10-nonfunctional
  - step-11-polish
  - step-12-complete
status: complete
completedDate: 2026-01-17
classification:
  projectType: pipeline_toolchain_qa_system
  projectTypeNotes: >
    Manifest-driven run system (manifest → generate → audit → retry → export).
    CLI as primary interface; core product is deterministic execution + audit artifacts.
    Lightweight UI possible later, not MVP.
  domain: creative_production_asset_pipeline
  domainNotes: >
    Production engineering mindset with scientific-level validation.
    Goal is game-ready art assets, not research output.
    Metrics-driven QA with creative output.
  complexity: medium-high
  complexityNotes: >
    Well-defined constraints, but execution complexity spikes at scale.
    Key drivers: temporal coherence, alpha/halo cleanup, Phaser trim/pivot engine truth.
    12 characters × multiple moves × multiple frames = significant surface area.
  projectContext: brownfield_specs_greenfield_impl
  projectContextNotes: >
    Strong specs and anchor assets exist. Runner/pipeline being built from scratch.
    Specs inform implementation, not the other way around.
  architectureNote: pluggable_generator
  architectureNotes: >
    Nano Banana Pro is primary backend. Adapter-based design for future backends
    (ComfyUI/SD, OpenAI, etc.). Audit/export logic stays stable regardless of generator.
inputDocuments:
  # Context Documents
  - Context/16BitFit - Battle Mode Art Style.md
  - Context/Champion And Boss Sprite Descriptions.md
  - Context/Agentic Workflow Idea.md
  - Context/context_packet.md
  # Asset Generation Documents
  - Context/asset-generation/brainstorming-champion-sprites-results.md
  - Context/asset-generation/brainstorming-boss-characters-results.md
  - Context/asset-generation/Champion Character Descriptions - 12-31-25.md
  - Context/asset-generation/Champion-Poses-And-Boss-Character-Descriptions.md
  - Context/asset-generation/ChatGPT - Champion Fighter - Prompts.md
  # Phase 3 Pipeline Documents
  - Phase 3 - Decisions Into Actionable Pipeline/OPUS INPUT PACK.md
  - Phase 3 - Decisions Into Actionable Pipeline/Perplexity Labs - Project-3/exported-assets/Phaser3_Export_Compliance_Kit.md
  - Phase 3 - Decisions Into Actionable Pipeline/Perplexity Labs - Project-3/exported-assets/Quick_Reference_Card.md
  - Phase 3 - Decisions Into Actionable Pipeline/Perplexity Labs - Project-3/exported-assets/CLI_Verification_RiskRegister.md
  - Phase 3 - Decisions Into Actionable Pipeline/Perplexity Labs - Project-3/exported-assets/Kit_Delivery_Summary.md
  # Integration Specs
  - NanoBananaxLangGraph Docs/16BitFit Battle Mode — Nano Banana Pro Integration Spec.md
  - README.md
  # Research Documents (PDFs)
  - Opus-4.5-16bitfit-Audit-Rubric-Finalized.pdf
  - Gemini_Deep-Think_Sprite-Animation-Quality-Scoring-System-With-Opus-Pack.pdf
  - Claude In Chrome - 16BitFit Sprite Pipeline Extraction FULL Report.md
  - Gemini-3-CLI-NANOBANANAPRO-Extension.pdf
  - Google Article - 10 Prompting Tips For Nano Banan Pro.pdf
  - LangChain_NanoBanana_Resource-Links.pdf
  - LangGraph-LangChain-LangSmith-Sprite-Workflow.pdf
anchorAssets:
  champions:
    - assets/anchor-characters/champion-anchor-characters/Champion-Sean-anchor.png
    - assets/anchor-characters/champion-anchor-characters/Champion-Mary-anchor.png
    - assets/anchor-characters/champion-anchor-characters/Champion-Marcus-anchor.png
    - assets/anchor-characters/champion-anchor-characters/Champion-Aria-anchor.png
    - assets/anchor-characters/champion-anchor-characters/Champion-Kenji-anchor.png
    - assets/anchor-characters/champion-anchor-characters/Champion-Zara-anchor.png
  bosses:
    - assets/anchor-characters/boss-anchor-characters/Boss-Training-Dummy-anchor.png
    - assets/anchor-characters/boss-anchor-characters/Boss-Procrastination-Phantom-anchor.png
    - assets/anchor-characters/boss-anchor-characters/Boss-Sloth-Demon-anchor.png
    - assets/anchor-characters/boss-anchor-characters/Boss-Gym-Bully-anchor.png
    - assets/anchor-characters/boss-anchor-characters/Boss-Stress-Titan-anchor.png
    - assets/anchor-characters/boss-anchor-characters/Boss-Ultimate-Slump-anchor.png
workflowType: 'prd'
documentCounts:
  briefs: 0
  research: 7
  projectDocs: 17
  brainstorming: 2
---

# Product Requirements Document - Sprite-Sheet-Automation-Project_2026

**Author:** Sean
**Date:** 2026-01-17

## Executive Summary

This PRD defines a **manifest-driven sprite animation pipeline** for 16BitFit Battle Mode — a CLI toolchain that generates, validates, and exports Phaser-ready sprite atlases using AI-assisted frame generation (Nano Banana Pro / Gemini). The system is designed for a **solo operator** (Sean) during MVP, with documentation and structure that enables **clean handoff** to technical artists later. Success means producing atlases that load in Phaser **without visible jitter, halos, or identity drift**, backed by **debuggable QA** with clear reason codes for every failure. The **MVP strategy** validates the full pipeline loop with **1 Champion × 2 moves (Idle + Walk)** before scaling to the full roster.

## Success Criteria

### User Success (Operator Experience)

**What "winning" feels like for the operator:**
- One command runs the full pipeline with understandable results
- No "mystery failures" — every stop, retry, or rejection has a clear reason code
- Confidence that approved frames are Phaser-ready without manual validation
- Predictable failure handling — the system stops early with a clear report when quality collapses rather than thrashing silently

**Success moments:**
- "I ran the pipeline, it finished, and the atlas loads cleanly in Phaser"
- "When it failed, I knew exactly why and what to fix"
- "I trust the output enough to scale without babysitting every frame"

### Business Success

**Tiered milestones:**

| Tier | Goal | Scope | Timeline Target |
|------|------|-------|-----------------|
| **A: MVP Proof** | Prove the full loop end-to-end with real engine validation | 1 Champion × 2 moves (Idle + Walk) | First working pipeline |
| **B: Production-ready v1** | Trust it for real asset production | 1 Champion × all 15 states | Reliable single-character production |
| **C: Full Scale** | Run entire roster reliably | 6 Champions × 15 states + 6 Bosses × 9 states | Batch runs with exception-only handling |

**What success unlocks:**
- MVP proves the architecture works before scaling investment
- v1 proves quality is stable enough to scale without babysitting
- Full Scale means "overnight runs with only exception handling the next day"

### Technical Success

**Quality Gates (Hard Fails — blocking):**
- HF01: Output format (PNG, RGBA, correct dimensions)
- HF02: Transparency (alpha channel present, no opaque backgrounds)
- HF03: Baseline stability (drift ≤ 1px — the #1 cause of "ice skating")
- HF04: Naming contract (Phaser frame key format)
- HF05: Gross anatomy (silhouette recognizable, no catastrophic deformation)

**Quality Metrics (Soft Fails — trigger retry, not instant rejection):**
- SF01: Identity drift (DINO ≥ 0.90, SSIM ≥ 0.85 vs anchor)
- SF02: Palette drift (≥ 90% colors from character palette)
- SF03: Line weight consistency (no dramatic style shifts)
- SF04: Temporal coherence (LPIPS variance < 0.15 for looping cycles)
- SF05: Alpha artifacts (halo/fringe severity scoring)

**Stop Conditions (pipeline health gates):**
- >20% retry rate across a run → pipeline unstable, stop and investigate
- >50% reject rate → catastrophic failure, halt immediately
- 5 consecutive hard fails on same frame → stop, emit diagnostic report

**Export Validation (blocking gates — engine is final truth):**
- TEST-02: Pivot/origin behavior validates correctly in Phaser
- TEST-03: Trim/baseline jitter passes visual inspection in testbed
- TEST-04: Naming/suffix frame key contract matches Phaser expectations
- Pipeline fails the run if exports don't satisfy contract (no "ship it anyway")

### Measurable Outcomes

**MVP Targets:**
- ≤ 25% frames require at least 1 retry
- ≤ 10% frames require >2 attempts
- ≤ 20% manual touchup acceptable (must be identified + explainable)
- 100% of exported atlases load and animate in Phaser testbed

**Production-ready v1 Targets:**
- ≤ 15% frames require a retry
- ≤ 5% frames require >2 attempts
- Average attempts per approved frame ≤ 1.5
- ≤ 10% manual touchup (cosmetic polish only, not structural fixes)
- Zero baseline jitter visible in Phaser playback

**Full Scale Targets:**
- Batch runs complete with predictable failure handling
- Exception-only operator attention required
- Multipack/multiatlas exports maintain consistent contracts

## Product Scope

### MVP — Minimum Viable Product

**Scope:** 1 Champion (Sean or Mary) × 2 moves (Idle + Walk) — full pipeline loop from manifest to validated Phaser atlas.

**MVP deliverables:**
- Complete atlas (atlas.png + atlas.json) that loads in Phaser without jitter/halos
- Clear run artifacts: per-frame metrics, reason codes, stop report behavior
- Operator experience: one command, understandable results

> **Detailed MVP rationale, cuts, and risk mitigation:** See [Project Scoping & Phased Development](#project-scoping--phased-development).

### Growth Features (Post-MVP → v1)

**Scope expansion:**
- 1 Champion × all 15 planned animation states
- All frames approved and exported as Phaser-ready atlases

**v1 success bar:**
- Pipeline completes full character set with bounded retries
- Phaser validation consistently clean across multiple atlases
- Quality stable enough to scale without babysitting

**Operational improvements:**
- Refined prompt templates based on MVP learnings
- Tuned thresholds based on real generator behavior
- Manual touchup reduced to cosmetic polish only

### Vision (Future — Full Scale)

**Scope:**
- All 6 Champions × 15 states
- All 6 Bosses × 9 states (256×256 tiles)
- Batch runs, multipack/multiatlas where required

**Vision success bar:**
- Pipeline reliable enough to run "overnight"
- Only exception handling required the next day
- Consistent export contracts across entire roster

**Future extensibility:**
- Pluggable generator backends (ComfyUI/SD, OpenAI, etc.)
- Audit/export logic stable regardless of generator
- Potential lightweight UI for monitoring/intervention

### Definition: Manual Touchup

For clarity in success metrics, "manual touchup" means:
- **Acceptable (cosmetic):** Background cleanup, small line cleanup, minor alpha fringe removal
- **Not acceptable (structural):** Redrawing whole frames, fixing identity drift, correcting baseline, repairing gross anatomy

Structural issues should be handled by the retry ladder, not manual intervention.

## User Journeys

### Journey 1: Pipeline Operator — Interactive Run

**Persona: Sean (Primary Operator)**

Sean is the architect of the 16BitFit sprite pipeline. He knows every threshold, every reason code, and every quirk of Nano Banana Pro. During MVP, he runs the pipeline interactively — watching each frame come through, validating assumptions, and building trust in the system.

**Opening Scene:**

It's early afternoon. Sean has Champion-Sean's anchor sprite locked and a manifest ready for the Idle animation (4 frames). He wants to prove the full loop works end-to-end before scaling up.

**The Journey:**

1. **Select manifest** — Sean opens his terminal and points the CLI at `manifests/champion-sean/idle.yaml`. The manifest specifies: anchor reference, frame count, pose descriptions, quality thresholds, and export target.

2. **Run pipeline** — One command kicks off the choreographer. Sean watches as frames generate one by one. Each frame hits the auditor immediately after generation.

3. **Inspect per-frame audit** — For each frame, Sean sees a compact report: pass/fail status, metric scores (SSIM, DINO, palette match, baseline drift), and any triggered reason codes. Frame 2 comes back with `SF01: identity drift (DINO 0.88)` — below threshold but not catastrophic.

4. **Intervene on soft fail** — The system automatically retries Frame 2 with an "identity rescue" prompt. Attempt 2 scores DINO 0.92. Sean sees the retry logged with reason code and outcome.

5. **Approve frames** — All 4 frames pass audit. Sean reviews the run summary: 1 retry on Frame 2, 0 hard fails, average DINO 0.91. He approves the batch.

6. **Export atlas** — The pipeline invokes TexturePacker, produces `idle.png` + `idle.json`, and runs the Phaser micro-tests. TEST-02 (pivot), TEST-03 (baseline), TEST-04 (naming) all pass.

**Resolution:**

Sean has a working atlas. He drops it into Phaser, plays the Idle loop, and sees Champion-Sean breathing smoothly with no jitter. The system works. Time to try Walk.

**Capabilities Revealed:**
- Manifest-driven run invocation
- Per-frame generation with immediate audit feedback
- Retry ladder with reason codes
- Run summary with aggregate metrics
- Approve/reject flow per batch
- TexturePacker export with Phaser micro-tests

---

### Journey 2: Pipeline Operator — Batch Run + Morning Review

**Persona: Sean (Production Mode)**

Six months later. The pipeline is stable. Sean trusts it enough to run overnight batches and review results the next morning.

**Opening Scene:**

It's 11 PM. Sean queues up a batch manifest covering Champion-Mary's full 15 animation states. He kicks off the run and goes to bed.

**The Journey:**

1. **Queue batch manifest** — Sean runs `pipeline batch manifests/champion-mary/all-states.yaml`. The CLI confirms: 15 moves queued, estimated ~120 frames total.

2. **Autonomous execution** — Overnight, the pipeline churns through each move. The auditor scores every frame. The retry ladder fires as needed. No human in the loop.

3. **Morning summary** — Sean wakes up, opens the run report. Dashboard shows:
   - 112/120 frames approved on first attempt
   - 6 frames required 1 retry
   - 2 frames flagged for manual review (persistent SF05: alpha halo)
   - 0 hard fails, 0 stop conditions triggered

4. **Review exception queue** — Sean opens the manual review queue. Two frames from the "Jump" animation have visible halos. He inspects the audit details: both scored alpha artifact severity 0.7 (threshold 0.5). The system correctly flagged them rather than shipping garbage.

5. **Resolve exceptions** — Sean has options:
   - Accept with cosmetic touchup (export to `manual_touchup/` folder)
   - Re-run with tighter alpha constraints
   - Adjust prompt template for Jump specifically

   He chooses cosmetic touchup — 2 frames out of 120 is acceptable for v1.

6. **Approve and export** — Sean approves the batch. Atlases export for all 15 moves. Phaser micro-tests pass.

**Resolution:**

Sean spent 15 minutes reviewing a run that would have taken hours interactively. Champion-Mary is done. Five more characters to go.

**Capabilities Revealed:**
- Batch manifest execution (async/overnight)
- Run summary report with aggregate statistics
- Rank bands for quick triage (approved / retry / manual review / rejected)
- Manual review queue for exception handling
- Selective re-run or cosmetic touchup paths
- Batch export with consistent contracts

---

### Journey 3: Failure Investigation + Recovery

**Persona: Sean (Troubleshooter)**

The pipeline isn't perfect. Sometimes quality collapses and Sean needs to diagnose why.

**Opening Scene:**

Sean is running Champion-Kenji's "Punch" animation. After Frame 3, the pipeline halts with a stop condition: `5 consecutive hard fails on Frame 4`.

**The Journey:**

1. **Stop condition triggered** — The CLI outputs: `STOP: Quality collapsing. 5 consecutive HF03 (baseline drift) on frame punch/0004. See diagnostic report.`

2. **Review diagnostic report** — Sean opens `reports/champion-kenji-punch-diagnostic.json`. It shows:
   - Frame 4 attempted 5 times
   - All 5 attempts failed HF03 (baseline drift > 1px)
   - Drift measurements: 3px, 4px, 2px, 5px, 3px
   - Prompt used: standard punch template
   - Reference strategy: edit-from-prev-frame (Frame 3)

3. **Identify root cause** — The diagnostic suggests: "Baseline drift may indicate pose ambiguity or reference instability. Frame 3 showed marginal baseline (0.8px drift). Consider re-anchoring from original anchor or adding baseline guide."

4. **Choose recovery path** — Sean decides to:
   - Re-anchor Frame 4 from the original Champion-Kenji anchor (not from Frame 3)
   - Add explicit baseline constraint to the prompt: "feet must touch the baseline guide"

5. **Resume from checkpoint** — Sean runs `pipeline resume manifests/champion-kenji/punch.yaml --from-frame 4 --strategy re-anchor`. The pipeline picks up where it left off.

6. **Verify recovery** — Frame 4 generates with baseline drift 0.5px. Passes HF03. The run continues and completes.

**Resolution:**

Sean diagnosed the issue in under 5 minutes using the diagnostic report. The system told him what failed, what was attempted, and what to try next. No guessing.

**Capabilities Revealed:**
- Stop condition with clear reason code
- Diagnostic report with attempt history
- Root cause suggestions based on failure patterns
- Resume-from-checkpoint capability
- Reference strategy adjustment (re-anchor, edit-from-prev, etc.)
- Prompt template overrides

---

### Journey 4: Game Dev Consumer — Phaser Integration

**Persona: Sean (Game Developer Hat)**

Now Sean switches contexts. He's no longer operating the pipeline — he's consuming its output in Phaser.

**Opening Scene:**

Sean has a fresh atlas: `champion-sean-idle.png` + `champion-sean-idle.json`. Time to integrate it into the 16BitFit battle scene.

**The Journey:**

1. **Drop atlas into project** — Sean copies the atlas files to `assets/sprites/champions/sean/`. The folder structure matches the project convention.

2. **Load in Phaser** — In his scene's `preload()`, Sean adds:
   ```javascript
   this.load.atlas('champion-sean-idle',
     'assets/sprites/champions/sean/champion-sean-idle.png',
     'assets/sprites/champions/sean/champion-sean-idle.json');
   ```

3. **Create animation** — In `create()`, Sean defines the animation:
   ```javascript
   this.anims.create({
     key: 'sean-idle',
     frames: this.anims.generateFrameNames('champion-sean-idle', {
       prefix: 'idle/',
       start: 1,
       end: 4,
       zeroPad: 4
     }),
     frameRate: 8,
     repeat: -1
   });
   ```

4. **Play and verify** — Sean spawns Champion-Sean and plays the idle animation. He watches for:
   - Baseline jitter (feet should stay planted)
   - Alpha halos (no white fringe around the sprite)
   - Identity consistency (same character across all frames)
   - Smooth looping (no jarring pop on cycle restart)

5. **Report engine truth** — The animation plays cleanly. No jitter, no halos. Sean marks Champion-Sean Idle as "engine verified" in his tracking.

**Alternative path — failure detected:**

If Sean saw jitter, he'd document it: "TEST-03 fail: visible baseline shift between frames 2-3." This feedback loops back to the pipeline operator (also Sean, for now) as engine truth that overrides audit scores.

**Resolution:**

The atlas works. Phaser is the final arbiter. Sean trusts the pipeline's output enough to move on.

**Capabilities Revealed:**
- Predictable atlas output structure (PNG + JSON)
- Phaser-compatible frame naming convention
- Standard pivot/origin behavior
- Visual verification checklist (jitter, halo, identity, loop)
- Engine truth feedback loop

---

### Journey 5: Future Operator — Handoff

**Persona: Alex (Technical Artist / Contractor)**

It's a year later. Sean has hired Alex, a technical artist, to run the pipeline while Sean focuses on game design.

**Opening Scene:**

Alex has never seen this codebase before. Sean gave them a 30-minute walkthrough and pointed them at the docs. Now Alex needs to generate sprites for a new Boss character.

**The Journey:**

1. **Read the docs** — Alex opens `docs/operator-guide.md`. It explains:
   - What a manifest is and how to write one
   - What the quality gates mean (HF01-HF05, SF01-SF05)
   - How to interpret run reports
   - What to do when the pipeline stops

2. **Create manifest from template** — Alex copies `templates/boss-manifest.yaml` and fills in:
   - Boss name: "Cardio Crusher"
   - Anchor reference: `assets/anchor-characters/boss-anchor-characters/Boss-Cardio-Crusher-anchor.png`
   - Moves: Idle, Attack, Hit, Defeat
   - Frame counts per move

3. **Run the pipeline** — Alex runs `pipeline run manifests/boss-cardio-crusher/all-states.yaml`. They don't need to understand Nano Banana Pro internals — the manifest and templates handle that.

4. **Interpret the report** — The run completes with 2 frames in manual review. Alex reads the report: `SF05: alpha artifact severity 0.6`. The docs say: "SF05 above 0.5 suggests halo cleanup needed. Options: cosmetic touchup or re-run with --alpha-strict flag."

5. **Make a decision without escalation** — Alex chooses cosmetic touchup. They export the flagged frames to `manual_touchup/`, clean up the halos in Photoshop, and re-import.

6. **Export and deliver** — Alex exports the final atlases and commits them to the asset repo. Sean reviews the commit later and sees clean atlases with no surprises.

**Resolution:**

Alex operated the pipeline without needing Sean on a call. The system was self-explanatory enough that a competent technical artist could run it from docs alone.

**Capabilities Revealed:**
- Self-documenting manifests
- Template-based manifest creation
- Operator guide with clear decision trees
- Reports interpretable without tribal knowledge
- Escalation paths defined but rarely needed
- Clean handoff without live training

---

### Journey Requirements Summary

| Journey | Key Capabilities Required |
|---------|--------------------------|
| **Interactive Run** | Manifest invocation, per-frame audit, retry ladder, run summary, approve flow, export + micro-tests |
| **Batch Run + Morning Review** | Batch execution, async operation, run summary dashboard, exception queue, selective re-run, batch export |
| **Failure Investigation** | Stop conditions, diagnostic reports, root cause suggestions, resume-from-checkpoint, strategy overrides |
| **Phaser Integration** | Predictable atlas structure, Phaser-compatible naming, visual verification checklist, engine truth feedback |
| **Future Operator Handoff** | Operator guide docs, manifest templates, self-explanatory reports, decision trees, minimal escalation |

**Cross-cutting requirements:**
- Reason codes for every failure (no mystery stops)
- Run artifacts that make next action obvious
- Clean interfaces between pipeline and consumer
- Documentation sufficient for handoff

## Domain Constraints

This project operates in a **creative production / asset pipeline** domain without external regulatory compliance. Instead, it has strong internal constraints that function as the project's "compliance framework":

| Constraint Type | Internal Standard | Enforcement |
|-----------------|-------------------|-------------|
| **Engine Truth** | Phaser micro-tests (pivot, trim jitter, naming keys) | Blocking export gate |
| **Quality Gates** | HF/SF rubric (identity, palette, baseline, alpha) | Hard fails block; soft fails trigger retry |
| **Export Contract** | TexturePacker settings + deterministic naming | Predictable atlas structure |
| **Temporal Coherence** | LPIPS variance < 0.15 for looping cycles | Stricter for Idle/Walk/Run than attacks |

**Key difference from regulated domains:** No external auditors, certifications, or approval processes. The "regulator" is the Phaser engine — if it plays cleanly, it ships.

## Key Differentiators

This pipeline applies disciplined engineering to an emerging space (AI-assisted game asset production). The differentiation is in rigor and predictability, not novelty:

1. **AI as deterministic production backend** — Manifest-driven generation with bounded retries, not open-ended creative exploration. The pipeline treats AI output as raw material to be validated, not final product.

2. **Metrics-driven QA for creative assets** — Scientific-level validation (SSIM, DINO, LPIPS, palette fidelity) applied to inherently artistic output. Most AI asset pipelines are either "manual artist work" or "generate and hope."

3. **Reason-code retry ladder with stop conditions** — Failures are engineering problems with debuggable causes, not magic. Bounded compute prevents thrashing; early stops prevent garbage accumulation.

4. **Engine truth as final arbiter** — Phaser micro-tests override audit metrics. If it plays cleanly in-engine, it ships. If metrics say "pass" but engine says "jitter," engine wins.

5. **Atlas-first export contract** — Output is optimized for Phaser consumption (TexturePacker settings, frame naming, pivot behavior), not generic image files.

## Pipeline Technical Architecture

### CLI Command Structure

Manifest-first CLI design — minimal flags, flags only override manifest fields.

| Command | Purpose |
|---------|---------|
| `pipeline run <manifest.yml>` | Run single manifest end-to-end: generate → audit → retry → approve → export → validate |
| `pipeline batch <dir\|glob>` | Run multiple manifests (sequential or queued), outputs per-run folders + batch summary |
| `pipeline resume <run_id>` | Resume from checkpoint after stop condition, crash, or manual edits |
| `pipeline inspect <run_id> [--frame N]` | Print human-readable summary + paths to artifacts (reason codes, metrics, top failures) |
| `pipeline export <run_id>` | Pack approved frames into atlas (TexturePacker), produce atlas.png + atlas.json |
| `pipeline validate <run_id>` | Run Phaser micro-tests against export output (pivot/trim jitter/naming keys) |
| `pipeline doctor` | Dependency check: Gemini availability, TexturePacker path, Node/Phaser testbed readiness |
| `pipeline schema` | Print/export manifest schema + examples |

**Design intent:** One command produces a complete run folder with a clear PASS/FAIL summary.

### Manifest Schema

Canonical manifests live under `manifests/` and define everything needed to run deterministically.

#### Run Identity
- `character_id` — sean, mary, marcus, etc.
- `character_type` — champion | boss
- `move_id` — idle, walk, heavy_punch, etc.
- `version` — v1, v2, etc.
- `frame_count` — number of frames to generate
- `target_resolution` — 128 (champions) or 256 (bosses)
- `facing` — always `right` (flip in engine)

#### Inputs
- `anchor_path` — path to locked anchor sprite
- `style_refs[]` — optional style reference images
- `pose_refs[]` — optional pose reference images
- `guide_overlays[]` — baseline grid, safe box, etc.

#### Pose Specification (Choreographer Output)
- `frames[]` — array where each frame has:
  - `frame_index`
  - `pose_description` (or keypoints path)
  - `delta_from_prev` notes (for edit chaining)

#### Generator Configuration
- `backend` — default: Gemini (`@google/generative-ai` SDK)
- `model` — gemini-3-pro-preview
- `mode` — Multimodal Reference Stacking (Semantic Interleaving pattern)
- `reference_strategy` — `[Anchor (IDENTITY), PrevFrame (POSE)]` with drift recovery
- `candidates_per_attempt`
- `max_attempts_per_frame`
- `prompt_templates` — master / variation / lock / negative blocks
- `bg_strategy` — alpha or dynamic chroma-key (auto-detect from anchor palette)
- `seed_policy` — fixed (base + frameIndex) for attempt 1, random for retries

#### Canvas Configuration (NEW — Deep Think Architecture Lock)
- `generation_size` — Resolution for AI generation (default: 512px)
- `target_size` — Final output resolution (default: 128px for champions, 256px for bosses)
- `downsample_method` — Interpolation method (default: nearest-neighbor for pixel art)
- `alignment.method` — contact_patch | center | none (default: contact_patch)
- `alignment.vertical_lock` — Snap to anchor baseline (default: true)
- `alignment.root_zone_ratio` — Ratio of visible height for root detection (default: 0.15)
- `alignment.max_shift_x` — Safety valve for horizontal alignment (default: 32px)

#### Auditor Configuration
- `hard_gates` — enabled + thresholds (dims, alpha, baseline drift, naming, gross anatomy)
- `soft_metrics` — enabled + thresholds (SSIM, DINO, palette, LPIPS/temporal, halo severity)
- `weights` — stability / identity / palette / style
- `rank_bands` — diamond / gold / silver / bronze

#### Retry Ladder
- `reason_code_to_action` — mapping of failure codes to recovery actions
- `ordered_steps` — edit-first → re-anchor → tighten prompt → stop
- `stop_conditions` — reject streak, attempt caps

#### Export Configuration
- `packer_settings` — TexturePacker flags
- `atlas_format` — Phaser JSON Hash
- `multipack_settings` — if needed for large character sets

#### Phaser Validation
- `tests_to_run` — pivot, trim jitter, suffix keys
- `pass_fail_gating` — blocking vs advisory

**Design intent:** If you hand someone a manifest + anchors + repo, they can reproduce the run.

### Output Artifacts

Every run creates a deterministic folder structure:

```
runs/<timestamp>__<character>__<move>__<version>/
├── manifest.resolved.json    # Final config after overrides
├── pose_spec/                # Choreographer output
├── candidates/               # All generation attempts
├── approved/                 # Only accepted frames
├── rejected/                 # Failed frames grouped by reason
├── audit/
│   ├── frame_metrics.jsonl   # Per attempt, per frame
│   ├── run_summary.json      # Retry rate, bands, stop reason, top failures
│   └── stop_report.json      # If halted
├── export/
│   ├── atlas.png
│   └── atlas.json
└── validation/
    ├── phaser_test_results.json
    └── screenshots/          # Optional debug artifacts
```

**Operator goal:** No guessing — everything needed to debug is in the run folder.

### Configuration Hierarchy

| Layer | Purpose | Examples |
|-------|---------|----------|
| `.env` | Secrets + machine-specific paths | Gemini keys, TexturePacker path, default dirs |
| `config/defaults.yml` | Global defaults | Common thresholds, weights, export defaults |
| `manifests/*.yml` | Run-specific truth | Character/move overrides, frame counts, pose specs |

**Precedence:** manifest > defaults > .env (except secrets/tool paths)

### External Tool Integration

#### Nano Banana Pro (Generator Backend)
- Primary backend: `gemini-3-pro-image-preview`
- Adapter-based integration supporting:
  - **Option A (fast start):** Gemini CLI + nanobanana extension
  - **Option B (production):** Direct Gemini API for automation
- All generator calls logged (inputs, prompts, outputs) into run artifacts

#### TexturePacker
- Invoked via CLI with locked flags:
  - trim, extrude, padding, no rotation, ReduceBorderArtifacts
- Output always written to `export/`

#### Phaser Testbed
- Minimal project that loads atlas and runs micro-tests:
  - TEST-02: pivot/origin behavior
  - TEST-03: trim jitter/baseline stability
  - TEST-04: naming/key conventions
- MVP: semi-automated; v1: structured PASS/FAIL result

### Extensibility Model

Modular interfaces for future capability:

| Interface | Purpose | Swap Example |
|-----------|---------|--------------|
| `GeneratorAdapter` | `generate_frame(ctx) → image + metadata` | NanoBanana → ComfyUI → OpenAI |
| `AuditorMetrics` | Metric plugins | Add/remove metrics without breaking scoring |
| `PackerAdapter` | Atlas packing | TexturePacker → Aseprite |
| `ValidatorAdapter` | Engine validation | Phaser → headless Phaser → other engines |

**Adding a new character/move:** Data work only — drop anchors + add manifest(s) + run.

## Project Scoping & Phased Development

### MVP Philosophy

**Type:** Proof-of-Architecture MVP

The goal is not to generate the whole roster — it's to prove the system is trustworthy before investing in scale. MVP validates:
1. The full pipeline loop works (manifest → generate → audit → retry → export → validate)
2. Quality gates produce predictable, debuggable behavior
3. Phaser accepts the output without jitter/halos

**Resource model:** Solo operator (Sean) for MVP. System must be self-explanatory enough to unblock quickly.

### Explicit MVP Cuts

The following are **explicitly out of scope for MVP**:

| Feature | Rationale | Target Phase |
|---------|-----------|--------------|
| Batch mode / overnight runs | Requires async infrastructure, exception queues | v1 |
| Resume-from-checkpoint | Simple "rerun manifest" sufficient for MVP | v1 |
| Multiple generator backends | Nano Banana Pro only; adapter interface exists but unused | Future |
| Boss pipeline (256×256) | Different tile size, defer until Champion pipeline proven | v1+ |
| Multiatlas/multipack | Unlikely to hit size limits with 2 moves | v1+ |
| Full scoring sophistication | MVP uses hard gates + minimal soft scoring | v1 |
| UI layer | CLI + run folders + reports only | Post-MVP |

**MVP is intentionally minimal:** CLI, run folders, reports. No bells and whistles.

### MVP Feature Set

**Scope:** 1 Champion (Sean or Mary) × 2 moves (Idle + Walk)

**Why these moves:**
- **Idle (4 frames):** Validates identity lock, palette, alpha/halos, baseline stability with minimal motion
- **Walk (6-8 frames):** Validates temporal coherence, baseline jitter, trim/pivot stability in a looping cycle

**MVP Capabilities Required:**

| Capability | MVP Implementation |
|------------|-------------------|
| `pipeline run` | Single manifest execution, full loop |
| `pipeline export` | TexturePacker atlas generation |
| `pipeline validate` | Phaser micro-tests (semi-automated) |
| `pipeline doctor` | Dependency check to avoid setup thrash |
| Manifest schema | Full schema, but simple manifests |
| Hard gates (HF01-HF05) | Fully implemented, blocking |
| Soft metrics (SF01-SF05) | Implemented, trigger retry |
| Retry ladder | Basic ladder (edit-first → re-anchor → stop) |
| Run artifacts | Per-frame metrics, run summary, stop reports |

### Technical Risk Mitigation

**Biggest MVP Risk:** Walk temporal coherence + baseline jitter

Walk is the first real stress-test. If temporal coherence fails repeatedly, fallback plan:

| Fallback | Description | Tradeoff |
|----------|-------------|----------|
| **A (preferred)** | Improve coherence via edit-from-prev-frame chaining + re-anchor on drift | Intended Nano Banana Pro pattern |
| **B** | Reduce Walk to 6 frames (from 8) while maintaining baseline stability | Simpler animation, still proves loop |
| **C** | Simplify walk motion (smaller deltas per frame) | Less ambitious animation |
| **D (last resort)** | Treat LPIPS variance as advisory, keep baseline drift as hard gate | MVP-only compromise, tighten for v1 |

**Non-negotiable:** Baseline drift ≤ 1px stays a hard gate in all fallbacks. Phaser animation jitter is the core failure mode.

### Phase Gates

#### Gate: MVP → v1

MVP is complete when:
- [ ] Idle exports clean atlas, loads in Phaser without visible jitter/halos
- [ ] Walk exports clean atlas, loads in Phaser without visible jitter/halos
- [ ] Both achieve retry behavior within MVP tolerance (≤25% needing retries)
- [ ] Both have clear reason codes and stop reports when things fail
- [ ] Manual touchup ≤20%, and system clearly identifies problematic frames

Once these are true, v1 begins: scale within one character (all 15 states), tighten retry + manual touchup targets.

#### Gate: v1 → Full Scale

v1 is complete when:
- [ ] 1 Champion × all 15 states exports successfully
- [ ] Retry rate ≤15%, manual touchup ≤10%
- [ ] Phaser validation consistently clean across multiple atlases
- [ ] Batch mode working (overnight runs with morning review)
- [ ] Resume-from-checkpoint implemented

Once these are true, Full Scale begins: all Champions + Bosses.

### Post-MVP: UI Intent

**UI is explicitly post-MVP** and gated on "MVP trust" (Idle + Walk passing end-to-end).

UI scope will be ideated separately with dedicated agents (analyst, UX designer) once the CLI pipeline is proven. Potential UI features:
- Run monitoring dashboard
- Exception review interface
- Visual diff for audit metrics
- Batch queue management

**Not designing UI until CLI works.**

## Functional Requirements

### Pipeline Execution

- FR1: Operator can invoke a single pipeline run from a manifest file via CLI
- FR2: Operator can invoke batch runs across multiple manifests *(v1+)*
- FR3: Operator can resume a stopped or failed run from checkpoint *(v1+)*
- FR4: System can halt execution when stop conditions are met (retry rate, reject rate, consecutive fails)
- FR5: System can report run status (in-progress, completed, stopped, failed) with reason codes
- FR6: Operator can verify system dependencies before running (`pipeline doctor`)

### Frame Generation

- FR7: System can generate frames using Nano Banana Pro backend with manifest-specified parameters
- FR8: System can use edit-from-anchor mode for initial frame generation
- FR9: System can use edit-from-previous-frame chaining for animation sequences
- FR10: System can apply prompt templates (master, variation, lock, negative) per manifest configuration
- FR11: System can generate multiple candidates per attempt and select best *(v1+, default 1 for MVP)*
- FR12: System can log all generator inputs, prompts, and outputs to run artifacts

### Frame Normalization & Transparency

- FR13: System can normalize each generated candidate into a target-ready frame (exact canvas size, consistent scale, pixel-safe downscale method) before auditing and packing
- FR14: System can enforce a transparency strategy per run — either require true alpha, or use a configurable chroma-key background + deterministic background removal — and log the method used

### Quality Auditing

- FR15: System can evaluate frames against hard gates (HF01-HF05) and block on failure
- FR16: System can evaluate frames against soft metrics (SF01-SF05) and flag for retry
- FR17: System can compute identity metrics against anchor reference *(MVP: SSIM ≥ 0.85 post-alignment; v1+: DINO ≥ 0.90)*
- FR18: System can compute palette fidelity against character color palette
- FR19: System can compute temporal coherence across frame sequences *(MVP: Pixel difference delta; v1+: LPIPS variance < 0.15)*
- FR20: System can measure alpha artifact severity (halo/fringe detection)
- FR21: System can measure baseline drift in pixels from reference position

### Frame Post-Processing (NEW — Deep Think Architecture Lock)

- FR53: System can apply Contact Patch Alignment (root-based) to correct baseline and horizontal drift before auditing
- FR54: System can extract target baseline and root position from anchor image at run start
- FR55: System can apply configurable root zone ratio (default 15% of visible bounding box height) for alignment
- FR56: System can enforce safety valve (max_shift_x) to prevent alignment glitches from pushing sprites off-screen
- FR57: System can downsample from generation resolution (512px) to target resolution (128px) using nearest-neighbor interpolation

### Retry & Recovery

- FR22: System can execute retry ladder (edit-first → re-anchor → tighten prompt → stop) based on failure codes
- FR23: System can map reason codes to specific recovery actions per manifest configuration
- FR24: System can track attempt count per frame and enforce max attempts
- FR25: System can emit diagnostic report when stop condition triggers
- FR26: System can suggest root cause and recovery paths in diagnostic reports

### Run Artifacts & Reporting

- FR27: System can produce per-frame audit metrics (scores, reason codes, pass/fail) as structured data
- FR28: System can produce run summary with aggregate statistics (retry rate, reject rate, top failures)
- FR29: System can organize run artifacts in deterministic folder structure
- FR30: System can separate approved, rejected, and candidate frames into distinct folders
- FR31: Operator can inspect run artifacts via CLI (`pipeline inspect`)

### Atlas Export

- FR32: System can invoke TexturePacker with locked settings (trim, extrude, padding, no rotation)
- FR33: System can produce Phaser-compatible atlas output (PNG + JSON Hash format)
- FR34: System can produce consistent origin/pivot behavior in Phaser (via atlas metadata and/or companion config / recommended origin values) and validate it via micro-tests
- FR35: System can apply deterministic frame naming convention matching Phaser expectations

### Engine Validation

- FR36: System can run Phaser micro-tests against exported atlas (TEST-02, TEST-03, TEST-04)
- FR37: System can report validation results as structured PASS/FAIL per test
- FR38: System blocks "release-ready" promotion (or final export step) if Phaser validation fails, with explicit operator override flag for debug builds
- FR39: System can capture validation artifacts (screenshots, test logs) for debugging

### Manifest Configuration

- FR40: Operator can define run identity (character, move, version, frame count) in manifest
- FR41: Operator can specify input assets (anchor, style refs, pose refs, guides) in manifest
- FR42: Operator can configure generator parameters (backend, model, mode, prompt templates) in manifest
- FR43: Operator can configure auditor thresholds (hard gates, soft metrics, weights) in manifest
- FR44: Operator can configure retry ladder (reason-to-action mapping, stop conditions) in manifest
- FR45: Operator can configure export settings (packer flags, atlas format) in manifest
- FR46: System can validate manifest against schema before run
- FR47: System can resolve configuration hierarchy (manifest > defaults > env)
- FR48: Operator can view manifest schema and examples via CLI (`pipeline schema`)

### Operator Support

- FR49: Operator can access operator guide documentation explaining quality gates and decision trees
- FR50: Operator can create manifests from templates for new characters/moves
- FR51: Operator can route flagged frames to manual touchup queue with audit context *(v1+)*
- FR52: Operator can re-import manually touched-up frames back into pipeline for export *(v1+)*

## Non-Functional Requirements

### Performance

**MVP Targets (Interactive Runs):**

| Operation | Target | Notes |
|-----------|--------|-------|
| Frame generation attempt | ≤ 90 seconds average | External API latency acceptable if logged |
| Audit pass per candidate | ≤ 10 seconds | MVP metric set (DINO, SSIM, palette, baseline, alpha) |
| Full pipeline run (8 frames) | Completes without operator timeout frustration | No hard SLA; stability over speed |

**v1+ Targets (Batch Runs):**

| Operation | Target | Notes |
|-----------|--------|-------|
| Overnight batch (~120 frames) | ≤ 8 hours on single machine | Including retries + audits |
| Per-operation timing | Logged in run artifacts | Enables bottleneck identification |

**Observability:**
- All external API calls must log request duration
- Run summary must include timing breakdown (generation, audit, export, validation)
- Slow operations (>2× expected) should emit warnings in logs

### Reliability & Durability

**Data Loss Tolerance:** Zero loss of approved work.

**Crash Recovery Guarantees:**

| Artifact Type | Durability | Recovery Behavior |
|---------------|------------|-------------------|
| Generated candidates | Written to disk immediately | Survives crash |
| Audit results | Written per-frame as computed | Survives crash |
| Approved frames | Persisted on approval | Survives crash |
| Run metadata/logs | Incremental writes | Survives crash |
| In-flight attempt | May be lost | Acceptable; retry from last checkpoint |

**Process Termination:**
- All artifacts must survive `kill -9` / power loss
- No in-memory-only state for completed work
- File writes must be atomic or use temp-then-rename pattern

**Idempotent Re-runs (MVP):**
- Re-running the same manifest must skip already-approved frames
- System must detect existing approved frames and resume from where it left off
- Full checkpoint resume is v1+; MVP requires only "skip approved" behavior

### Reproducibility & Determinism

**Goal:** Same manifest produces *traceable* results, not necessarily identical pixels.

**Traceability Requirements:**
Every run must log:
- Model ID + version (if exposed by generator API)
- Generator adapter version
- Full prompts + inputs + reference paths used
- Timestamps for all operations
- Any seed/randomness fields exposed by the backend

**Acceptance Criteria:**
- Ability to re-run and get "functionally equivalent" output (passes same gates)
- Ability to explain differences when outputs drift between runs
- No expectation of bit-identical images across runs (generator model may change)

**Dependency Drift Detection:**
- `pipeline doctor` checks model availability and logs lifecycle status when possible
- Warn operator when generator model version changes or is marked deprecated

### Operability

**New Operator Ramp-up:**
- Technical operator can set up dependencies, configure `.env`, run first manifest, and locate outputs in ≤ 45 minutes using documentation alone
- No live training or pair session required for basic operation

**One-Command First Run:**
- Quickstart must enable a new operator to run `pipeline run <sample_manifest>` and find the exported atlas + summary report with no extra setup steps
- Sample manifest included in repo for immediate validation

**Required Documentation:**

| Document | Purpose |
|----------|---------|
| Quickstart / First Run | Dependencies, setup, run first manifest |
| How to Read Run Outputs | Folder structure, metrics files, what to look for |
| Common Failure Modes | Reason codes, what they mean, what to try next |
| Quality Gates Reference | HF/SF codes, thresholds, why they matter |

**Error Message Quality:**
Every error must include:
- **What failed:** Reason code + human-readable description
- **What was attempted:** Inputs, parameters, attempt number
- **What to try next:** Mapped recovery action or escalation path

**Example (good):**
```
STOP: Quality collapsing on frame walk/0004
  Reason: HF03 (baseline drift > 1px) — 5 consecutive failures
  Attempts: 5 (drift values: 3px, 4px, 2px, 5px, 3px)
  Suggestion: Re-anchor from original anchor or add baseline guide overlay
  See: runs/2026-01-17__sean__walk__v1/audit/stop_report.json
```

### Integration Reliability

**Gemini / Nano Banana Pro:**

| Scenario | Behavior |
|----------|----------|
| API unavailable (interactive) | Fail fast with clear message; do not retry silently |
| API unavailable (batch, v1+) | Retry with exponential backoff (max 5 retries over ~15 min total), then stop with structured report |
| Rate limited | Respect rate limits; log wait time; continue after cooldown |
| Timeout | Log timeout; treat as failed attempt; proceed to retry ladder |

**Retries must be bounded and logged.** Never silently retry forever.

**TexturePacker:**

| Scenario | Behavior |
|----------|----------|
| Packer fails | Preserve `/approved/` frames; emit packer error log |
| Packer misconfigured | `pipeline doctor` detects before run |
| Recovery | Operator can re-run `pipeline export` after fixing issue |

Packing is a deterministic downstream stage — packer failure must not invalidate upstream work.

**Phaser Testbed:**

| Scenario | Behavior |
|----------|----------|
| Validation fails | Block "release-ready" promotion |
| Debug override | `--allow-validation-fail` flag exports artifacts for inspection |
| Validation output | Structured PASS/FAIL JSON + optional screenshots/gifs |

### Security

**Secrets Handling:**
- API keys must never appear in logs, run artifacts, or error messages
- Keys loaded from `.env` only; never hardcoded
- `.env` must be in `.gitignore`; documentation must explicitly warn against committing secrets

**No Additional Security Scope:**
- No user data, PII, or payment processing
- No authentication/authorization system
- No network exposure (CLI tool, local execution only)

## Glossary & Reference

### Core Concepts

| Term | Definition |
|------|------------|
| **Anchor Sprite** | The gold-reference character image that establishes identity, palette, and proportions. All generated frames are compared against the anchor for consistency. |
| **Manifest** | A YAML file that defines everything needed for a deterministic pipeline run: character, move, frame count, thresholds, prompt templates, and export settings. Single source of truth for reproducibility. |
| **Engine Truth** | The principle that Phaser micro-tests are the final arbiter of quality. If metrics say "pass" but the animation jitters in Phaser, the frame fails. Engine truth overrides audit scores. |
| **Atlas** | A packed texture image (PNG) + metadata file (JSON) containing multiple animation frames. Produced by TexturePacker for efficient Phaser loading. Distinct from a raw spritesheet (unpacked grid of frames). |
| **Spritesheet** | A grid of frames in a single image, typically without metadata. The pipeline produces atlases, not spritesheets. |

### Quality Gate Terms

| Term | Definition |
|------|------------|
| **Hard Fail (HF)** | A blocking quality gate. If a frame fails an HF check, it cannot be approved — it must be retried or rejected. Hard fails indicate structural problems (wrong dimensions, missing alpha, baseline drift, gross anatomy errors). |
| **Soft Fail (SF)** | A non-blocking quality metric. If a frame fails an SF check, it triggers the retry ladder but doesn't instantly reject the frame. Soft fails indicate quality concerns (identity drift, palette drift, alpha halos) that may improve on retry. |
| **Retry Ladder** | The ordered sequence of recovery actions when a frame fails: edit-from-previous → re-anchor from original → tighten prompt constraints → stop with diagnostic report. Bounded retries prevent infinite thrashing. |
| **Rank Bands** | Quality tiers for approved frames: Diamond (excellent), Gold (good), Silver (acceptable), Bronze (marginal). Used for triage and prioritizing manual review. |

### Frame & Artifact Terms

| Term | Definition |
|------|------------|
| **Candidate Frame** | A generated image that has not yet passed audit. Multiple candidates may be generated per frame slot; only one becomes approved. |
| **Approved Frame** | A candidate that passed all hard gates and soft metric thresholds. Approved frames are persisted and included in the final atlas. |
| **Baseline Drift** | Vertical pixel displacement of the character's feet from the expected baseline position. Drift > 1px causes visible "ice skating" in Phaser animations. The #1 cause of animation jitter. |
| **Baseline Jitter** | Frame-to-frame variation in baseline position within an animation sequence. Even if individual frames have low drift, inconsistent drift across frames causes jitter. |
| **Temporal Coherence** | Visual consistency across frames in an animation sequence. Measured by LPIPS variance — high variance means frames look disconnected. Critical for looping animations (Idle, Walk, Run). |

### Quality Code Reference

**Hard Fails (HF01–HF05):**

| Code | Gate | Threshold |
|------|------|-----------|
| HF01 | Output format | PNG, RGBA, correct dimensions |
| HF02 | Transparency | Alpha channel present, no opaque backgrounds |
| HF03 | Baseline stability | Drift ≤ 1px |
| HF04 | Naming contract | Phaser frame key format |
| HF05 | Gross anatomy | Silhouette recognizable, no catastrophic deformation |

**Soft Fails (SF01–SF05):**

| Code | Metric | Threshold |
|------|--------|-----------|
| SF01 | Identity drift | SSIM ≥ 0.85 post-alignment vs anchor (MVP); DINO ≥ 0.90 (v1+) |
| SF02 | Palette drift | ≥ 90% colors from character palette |
| SF03 | Line weight consistency | No dramatic style shifts |
| SF04 | Temporal coherence | Pixel difference delta (MVP); LPIPS variance < 0.15 (v1+) |
| SF05 | Alpha artifacts | Halo/fringe severity scoring |

