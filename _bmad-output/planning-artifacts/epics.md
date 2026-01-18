---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
inputDocuments:
  # Core Planning Artifacts
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  # Deep Research - Tier 1 (Critical Implementation Specs)
  - Agentic-Sprite-Sheet-Deep-Research/NanoBananaxLangGraph Docs/16BitFit Battle Mode — Nano Banana Pro Integration Spec.md
  - Agentic-Sprite-Sheet-Deep-Research/Phase 3 - Decisions Into Actionable Pipeline/OPUS INPUT PACK.md
  - Agentic-Sprite-Sheet-Deep-Research/Phase 3 - Decisions Into Actionable Pipeline/Perplexity Labs - Project-3/exported-assets/Phaser3_Export_Compliance_Kit.md
  # Deep Research - Tier 2 (Essential Context)
  - Agentic-Sprite-Sheet-Deep-Research/Context/context_packet.md
  - Agentic-Sprite-Sheet-Deep-Research/Context/Agentic Workflow Idea.md
  - Agentic-Sprite-Sheet-Deep-Research/Phase 1 - Deep Research/Claude In Chrome - 16BitFit Sprite Pipeline Extraction FULL Report.md
  # Deep Research - Tier 3 (Supporting Reference)
  - Agentic-Sprite-Sheet-Deep-Research/Phase 3 - Decisions Into Actionable Pipeline/Perplexity Labs - Project-3/exported-assets/CLI_Verification_RiskRegister.md
  - Agentic-Sprite-Sheet-Deep-Research/Phase 3 - Decisions Into Actionable Pipeline/Perplexity Labs - Project-3/exported-assets/Quick_Reference_Card.md
  - Agentic-Sprite-Sheet-Deep-Research/Context/asset-generation/Champion Character Descriptions - 12-31-25.md
---

# Sprite-Sheet-Automation-Project_2026 - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Sprite-Sheet-Automation-Project_2026, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

**Pipeline Execution**
FR1: Operator can invoke a single pipeline run from a manifest file via CLI
FR2: Operator can invoke batch runs across multiple manifests *(v1+)*
FR3: Operator can resume a stopped or failed run from checkpoint *(v1+)*
FR4: System can halt execution when stop conditions are met (retry rate, reject rate, consecutive fails)
FR5: System can report run status (in-progress, completed, stopped, failed) with reason codes
FR6: Operator can verify system dependencies before running (`pipeline doctor`)

**Frame Generation**
FR7: System can generate frames using Nano Banana Pro backend with manifest-specified parameters
FR8: System can use edit-from-anchor mode for initial frame generation
FR9: System can use edit-from-previous-frame chaining for animation sequences
FR10: System can apply prompt templates (master, variation, lock, negative) per manifest configuration
FR11: System can generate multiple candidates per attempt and select best *(v1+, default 1 for MVP)*
FR12: System can log all generator inputs, prompts, and outputs to run artifacts

**Frame Normalization & Transparency**
FR13: System can normalize each generated candidate into a target-ready frame (exact canvas size, consistent scale, pixel-safe downscale method) before auditing and packing
FR14: System can enforce a transparency strategy per run — either require true alpha, or use a configurable chroma-key background + deterministic background removal — and log the method used

**Quality Auditing**
FR15: System can evaluate frames against hard gates (HF01-HF05) and block on failure
FR16: System can evaluate frames against soft metrics (SF01-SF05) and flag for retry
FR17: System can compute identity metrics (DINO, SSIM) against anchor reference *(DINO is v1+, SSIM is MVP)*
FR18: System can compute palette fidelity against character color palette
FR19: System can compute temporal coherence (LPIPS variance) across frame sequences *(LPIPS is v1+)*
FR20: System can measure alpha artifact severity (halo/fringe detection)
FR21: System can measure baseline drift in pixels from reference position

**Retry & Recovery**
FR22: System can execute retry ladder (edit-first → re-anchor → tighten prompt → stop) based on failure codes
FR23: System can map reason codes to specific recovery actions per manifest configuration
FR24: System can track attempt count per frame and enforce max attempts
FR25: System can emit diagnostic report when stop condition triggers
FR26: System can suggest root cause and recovery paths in diagnostic reports

**Run Artifacts & Reporting**
FR27: System can produce per-frame audit metrics (scores, reason codes, pass/fail) as structured data
FR28: System can produce run summary with aggregate statistics (retry rate, reject rate, top failures)
FR29: System can organize run artifacts in deterministic folder structure
FR30: System can separate approved, rejected, and candidate frames into distinct folders
FR31: Operator can inspect run artifacts via CLI (`pipeline inspect`)

**Atlas Export**
FR32: System can invoke TexturePacker with locked settings (trim, extrude, padding, no rotation)
FR33: System can produce Phaser-compatible atlas output (PNG + JSON Hash format)
FR34: System can produce consistent origin/pivot behavior in Phaser (via atlas metadata and/or companion config / recommended origin values) and validate it via micro-tests
FR35: System can apply deterministic frame naming convention matching Phaser expectations

**Engine Validation**
FR36: System can run Phaser micro-tests against exported atlas (TEST-02, TEST-03, TEST-04)
FR37: System can report validation results as structured PASS/FAIL per test
FR38: System blocks "release-ready" promotion (or final export step) if Phaser validation fails, with explicit operator override flag for debug builds
FR39: System can capture validation artifacts (screenshots, test logs) for debugging

**Manifest Configuration**
FR40: Operator can define run identity (character, move, version, frame count) in manifest
FR41: Operator can specify input assets (anchor, style refs, pose refs, guides) in manifest
FR42: Operator can configure generator parameters (backend, model, mode, prompt templates) in manifest
FR43: Operator can configure auditor thresholds (hard gates, soft metrics, weights) in manifest
FR44: Operator can configure retry ladder (reason-to-action mapping, stop conditions) in manifest
FR45: Operator can configure export settings (packer flags, atlas format) in manifest
FR46: System can validate manifest against schema before run
FR47: System can resolve configuration hierarchy (manifest > defaults > env)
FR48: Operator can view manifest schema and examples via CLI (`pipeline schema`)

**Operator Support**
FR49: Operator can access operator guide documentation explaining quality gates and decision trees
FR50: Operator can create manifests from templates for new characters/moves
FR51: Operator can route flagged frames to manual touchup queue with audit context *(v1+)*
FR52: Operator can re-import manually touched-up frames back into pipeline for export *(v1+)*

### NonFunctional Requirements

**Performance**
NFR1: Frame generation attempt ≤ 90 seconds average
NFR2: Audit pass per candidate ≤ 10 seconds (MVP metric set)
NFR3: Full pipeline run (8 frames) completes without operator timeout frustration
NFR4: Overnight batch (~120 frames) ≤ 8 hours on single machine (v1+)
NFR5: Slow operations (>2× expected) must emit warnings in logs

**Reliability & Durability**
NFR6: Zero data loss of approved work
NFR7: Generated candidates, audit results, and approved frames must survive crashes (persist immediately)
NFR8: Run metadata/logs must use incremental writes to survive crashes
NFR9: All artifacts must survive `kill -9` / power loss
NFR10: No in-memory-only state for completed work
NFR11: File writes must be atomic or use temp-then-rename pattern
NFR12: Re-running the same manifest must skip already-approved frames (MVP idempotency)

**Reproducibility & Determinism**
NFR13: Must log Model ID + version, Generator adapter version, full prompts/inputs, timestamps, and seeds
NFR14: `pipeline doctor` checks model availability and logs lifecycle status
NFR15: Warn operator when generator model version changes or is marked deprecated

**Operability**
NFR16: New operator ramp-up ≤ 45 minutes using documentation alone (setup dependencies, configure env, run manifest)
NFR17: One-command first run capability with sample manifest
NFR18: Error messages must include What failed (Reason code), What was attempted, and What to try next

**Integration Reliability**
NFR19: Gemini/Nano Banana Pro - Fail fast with clear message if API unavailable (interactive)
NFR20: Gemini/Nano Banana Pro - Retry with exponential backoff if API unavailable (batch v1+)
NFR21: Respect rate limits; log wait time; continue after cooldown
NFR22: Log timeouts; treat as failed attempt; proceed to retry ladder
NFR23: TexturePacker failure must not invalidate upstream work (preserve approved frames)
NFR24: `pipeline doctor` detects packer misconfiguration before run
NFR25: Phaser validation failure blocks "release-ready" promotion
NFR26: `--allow-validation-fail` flag allows debug export despite validation failure

**Security**
NFR27: API keys must never appear in logs, run artifacts, or error messages
NFR28: Keys loaded from `.env` only; never hardcoded
NFR29: `.env` must be in `.gitignore`; docs must warn against committing secrets
NFR30: No network exposure (local CLI only)

### Additional Requirements

**Architecture & Technical Requirements**
- **Starter Template**: Initialize project with Commander.js CLI structure (`src/bin.ts` entry point).
- **Language**: TypeScript 5+ (Strict Mode).
- **CLI Framework**: Commander.js 12.x (lightweight, TypeScript-native, fits Director Mode integration).
- **Validation**: Zod for runtime schema validation (manifests, external data).
- **Logging**: Pino (JSON-first, structured).
- **Subprocesses**: Execa 8.x (cross-platform safety).
- **Image Processing**: Sharp (Node.js native).
- **Headless Engine**: Puppeteer Core launching Chrome for Phaser 3 WebGL context.
- **State Management**: Atomic writes (temp-then-rename) for `state.json`.
- **Manifest Locking**: Generate `manifest.lock.json` at run start (resolving paths, versions).
- **Project Structure**: Strict adherence to `src/commands`, `src/core`, `src/adapters`, `src/domain`, `runs/` structure.
- **Error Handling**: Implement `Result<T, E>` pattern; map all errors to `HFxx`, `SFxx`, `SYS_xx`, or `DEP_xx` codes.
- **Retry Logic**: Implement specific decision tree: Edit -> Re-anchor -> Tighten -> Stop.

**Nano Banana Pro Integration Requirements** *(from Integration Spec)*
- **Generator Adapter Contract**: `generate_frame(manifest, frame_index, attempt_index) -> CandidateResult` with image_path, raw_prompt, generator_params, attempt_id, errors.
- **Manifest Generator Block**: Must include `backend`, `model`, `mode`, `use_prev_frame_chaining`, `seed_policy`, `max_attempts_per_frame`.
- **Frame-by-Frame Generation**: Generate one frame at a time (not monolithic sheets) for auditability and drift control.
- **Edit-First Workflow**: Frame 1 edits from anchor; frames 2+ chain from previous approved frame (or re-anchor on drift).
- **Multi-Image Reference Stack**: Support up to 14 reference images (6 high-fidelity) for identity locking.
- **Grid/Baseline Guide Overlays**: Create standardized `guide_128.png` and `guide_256.png` with baseline, centerline, safe area.
- **Thought Signature Persistence**: Log and persist model response parts for future API mode compatibility.
- **SynthID Watermark Micro-test**: Validate watermark doesn't introduce visible artifacts in pixel art after downscaling.

**Audit Rubric Requirements** *(from OPUS INPUT PACK)*
- **Scoring Weights**: Stability 0.35, Identity 0.30, Palette 0.20, Style 0.15.
- **8-Level Retry Ladder**: Reroll seeds → Tighten negative → Identity rescue → Pose rescue → Two-stage inpaint → Post-process → Escalate → Stop.
- **4 Prompt Templates**: Master (first attempt), Variation (frame i of N), Lock/Recovery (after drift), Negative (avoid list).
- **Folder Structure**: `/assets_src/characters/{CHAR_ID}/moves/{MOVE}/candidates|approved|audit/`.
- **Manifest Audit Schema**: Per-frame attempt tracking with seed, prompt_hash, candidate_path, audit result, metrics.
- **Open Questions Table**: 10 micro-experiments to resolve before production (pivot auto-apply, trim jitter, palette hex, etc.).

**Phaser Export Requirements** *(from Compliance Kit)*
- **Pre-Export Validation**: 11-item checklist (dimensions, alpha, naming conventions).
- **Post-Export Validation**: JSON structure integrity, frame data, PNG integrity, frame key format.
- **TexturePacker CLI Locked Flags**: `--format phaser --trim-mode Trim --extrude 1 --shape-padding 2 --border-padding 2 --disable-rotation --alpha-handling ReduceBorderArtifacts --max-size 2048 --trim-sprite-names --prepend-folder-name`.
- **Multipack Template**: Use `{n}` placeholder for sheet numbering when atlas exceeds max-size.
- **Phaser Integration Patterns**: Loader snippets, animation generation, pivot handling code.
- **Naming Policy Validator**: JavaScript + Bash implementations with exact key format `{ACTION}/{ZERO_PAD}`.
- **Micro-Test Harness**: TEST-02 (Pivot Auto-Apply), TEST-03 (Trim Mode Jitter), TEST-04 (Suffix Convention) with exact steps and pass/fail criteria.

### FR Coverage Map

-   **Epic 1 (Foundation):** FR6 (Doctor), FR36/39 (Spike), FR48 (Schema).
-   **Epic 2 (Generation):** FR1, FR7, FR8, FR10, FR12, FR40, FR41, FR42, FR46, FR47, FR53-FR57 (Post-Processing).
-   **Epic 3 (Guardrails):** FR13, FR14, FR15, FR16, FR17 (SSIM), FR18, FR20, FR21, FR43.
-   **Epic 4 (Orchestration):** FR4, FR5, FR9, FR22, FR23, FR24, FR25, FR26, FR44.
-   **Epic 5 (Export/Validation):** FR32, FR33, FR34, FR35, FR36, FR37, FR38, FR39, FR45.
-   **Epic 6 (Visibility):** FR27, FR28, FR29, FR30, FR31, FR49, FR50.
-   **Epic 7 (Director Mode) — NEW:** FR51 (Manual Queue - partial), FR52 (Manual Import - partial), NEW: Director UI, Nudge, Patch, Visual Diff.
-   **Epic 8 (CLI Integration) — NEW:** FR1, FR6, NEW: Pipeline Orchestrator, Director Server, Interactive Mode.
-   **v1+ (Future):** FR2 (Batch), FR3 (Resume), FR11 (Multi-candidate), FR17 (DINO), FR19 (LPIPS).

### Deep Think Architecture Lock (2026-01-18)

The following architectural decisions have been locked after three rounds of deep analysis:

| Decision | Details | Epic Impact |
|----------|---------|-------------|
| **Semantic Interleaving** | Generator uses `Part[]` array with role labels | Epic 2, Story 2.3 updated |
| **Contact Patch Alignment** | Post-Processor aligns to visible bounding box root zone | New Story 2.7 added |
| **4x Resolution Strategy** | Generate at 512px, downsample to 128px | New Story 2.8 added |
| **Anchor Analysis** | Extract baselineY/rootX from anchor at run start | New Story 2.9 added |
| **Safety Valve** | max_shift_x clamp (default 32px) | Story 2.7 includes |
| **Drift Recovery** | If SF01 < 0.9, drop PrevFrame from reference stack | Story 4.3 updated |
| **MVP Metrics** | SSIM + Pixel Diff (not DINO/LPIPS) | Epic 3 adjusted |

### Deep Think Follow-Up Lock (2026-01-18)

Additional decisions locked from follow-up analysis sessions:

| Decision | Details | Epic Impact |
|----------|---------|-------------|
| **Temperature Lock** | Must be 1.0 (not 0.7), with topP: 0.95, topK: 40 | Story 2.3 updated |
| **CRC32 Seed Algorithm** | Use CRC32 with precomputed lookup table for deterministic seeds | Story 2.3 updated |
| **Thought Signature Extraction** | Extract from `candidate.content.parts` for traceability | Story 2.3 updated |
| **Orphan Pixel Detection** | >15 orphans = SF_PIXEL_NOISE soft fail | New Story 3.10 added |
| **MAPD Thresholds** | Idle >0.02, Walk >0.10, Attack/Jump BYPASS | Story 3.8 updated |
| **4-Digit Frame Padding** | Use `{n4}` for TexturePacker, `zeroPad: 4` for Phaser | Story 5.1 updated |
| **HF_IDENTITY_COLLAPSE** | Reject frame, continue run, check circuit breaker | Story 4.3 updated |
| **Multipack Validation** | Validate `textures[]` array and PNG references | Story 5.4 updated |
| **Loop Closure Pattern** | Final frame uses Anchor as motion target (85% transition) | New Story 2.10 added |
| **Phase-Based Pose Library** | Define poses as kinematic phases, not per-frame | New Story 2.11 added |
| **Director Mode** | Human-in-the-loop UI for review, nudge, patch | New Epic 7 added |
| **CLI Pipeline Integration** | `banana gen` command with Express server bridge | New Epic 8 added |

## Epic List

### Epic 1: Project Foundation & Engine Spike
Establish the CLI scaffolding and immediately prove the high-risk "Engine Truth" dependency using Puppeteer and Phaser.
**FRs covered:** FR6, FR36 (Spike), FR39 (Spike), FR48.

### Epic 2: Manifest-Driven Generation & Post-Processing
Implement the core CLI loop that takes a manifest, produces raw AI-generated frames using the Gemini adapter with Semantic Interleaving, and applies Contact Patch Alignment before auditing.
**FRs covered:** FR1, FR7, FR8, FR10, FR12, FR40, FR41, FR42, FR46, FR47, FR53, FR54, FR55, FR56, FR57.

### Epic 3: Automated Quality Guardrails
Build the Auditor that normalizes frames and enforces the "Hard Gates" and SSIM metrics.
**FRs covered:** FR13, FR14, FR15, FR16, FR17 (SSIM), FR18, FR20, FR21, FR43.

### Epic 4: Resilient Orchestration & Retry Ladder
Connect the Generator and Auditor with a stateful Orchestrator that handles failures and executes the "Retry Ladder."
**FRs covered:** FR4, FR5, FR9, FR22, FR23, FR24, FR25, FR26, FR44.

### Epic 5: Production Export & Validation
Integrate TexturePacker and the final Phaser validation suite to produce game-ready assets.
**FRs covered:** FR32, FR33, FR34, FR35, FR36, FR37, FR38, FR39, FR45.

### Epic 6: Pipeline Visibility & Documentation
Finalize the inspection tools and operator documentation for handoff.
**FRs covered:** FR27, FR28, FR29, FR30, FR31, FR49, FR50.

### Epic 7: Director Mode (Human-in-the-Loop Interface) — NEW
Implement the web-based Director Mode for human review, manual alignment override, and corrective inpainting.
**FRs covered:** FR51 (partial - manual queue), FR52 (partial - manual import), NEW: Director review, Nudge alignment, Patch inpainting.

### Epic 8: CLI Pipeline Integration — NEW
Implement the unified `banana` CLI tool that orchestrates the complete pipeline and serves the Director Mode interface.
**FRs covered:** FR1, FR6, NEW: CLI orchestration, Express server bridge, interactive mode.

---

## Epic 1: Project Foundation & Engine Spike

Establish the CLI scaffolding and immediately prove the high-risk "Engine Truth" dependency using Puppeteer and Phaser.

### Story 1.1: Initialize CLI Project with Commander.js Scaffold

**As an** operator,
**I want** a properly initialized CLI project with Commander.js structure,
**So that** I have a consistent foundation for building pipeline commands.

**Acceptance Criteria:**

**Given** a new project directory
**When** the project is initialized with Commander.js CLI structure
**Then** the project structure includes `src/commands`, `src/core`, `src/adapters`, `src/domain` directories
**And** CLI entry point exists at `src/bin.ts` with Commander.js program setup
**And** TypeScript 5+ with strict mode is configured in `tsconfig.json`
**And** `package.json` includes Commander.js 12.x, Zod, Pino, Execa 8.x, Sharp, ora, and chalk as dependencies
**And** `.env.example` exists with placeholder keys (GEMINI_API_KEY, etc.)
**And** `.gitignore` includes `.env` and `runs/` directories
**And** the `Result<T, E>` error handling pattern is scaffolded in `src/core/result.ts`

---

### Story 1.2: Implement `pipeline doctor` Dependency Check Command

**As an** operator,
**I want** to verify all system dependencies before running the pipeline,
**So that** I can identify and fix configuration issues before they cause failures.

**Acceptance Criteria:**

**Given** the CLI is installed
**When** I run `pipeline doctor`
**Then** the system checks Node.js version compatibility (LTS 20+)
**And** verifies TexturePacker CLI is installed and accessible via `TexturePacker --version`
**And** verifies Chrome/Chromium is available for Puppeteer Core
**And** checks that `.env` file exists and contains required key names (without logging values)
**And** reports PASS/FAIL status for each dependency with actionable error messages (NFR18)
**And** logs Gemini model availability and lifecycle status (NFR14)
**And** detects TexturePacker misconfiguration (NFR24)
**And** runs a minimal TexturePacker pack operation to verify license validity (not just installation)
**And** all output uses Pino structured JSON logging

---

### Story 1.3: Implement `pipeline schema` Command for Manifest Documentation

**As an** operator,
**I want** to view the manifest schema and examples via CLI,
**So that** I can understand how to configure pipeline runs without leaving the terminal.

**Acceptance Criteria:**

**Given** the CLI is installed
**When** I run `pipeline schema`
**Then** the system outputs the complete JSON schema for manifest files
**And** includes field descriptions for: `identity` (character, move, version, frame_count), `inputs` (anchor, style_refs, pose_refs, guides), `generator` (backend, model, mode, prompt_templates), `auditor` (hard_gates, soft_metrics, weights), `retry` (ladder, stop_conditions), `export` (packer_flags, atlas_format)
**And** provides at least one example manifest that passes schema validation
**And** example manifest demonstrates the 4 prompt template types (master, variation, lock, negative)

---

### Story 1.4: Engine Truth Spike - Puppeteer + Phaser Validation Harness

**As an** operator,
**I want** proof that Phaser 3 WebGL rendering works in headless Chrome,
**So that** I have confidence the export validation approach is viable before building the full pipeline.

**Acceptance Criteria:**

**Given** a sample sprite atlas (PNG + JSON Hash format) exists in `test-fixtures/`
**When** I run the engine spike test via `pipeline spike`
**Then** Puppeteer Core launches headless Chrome with WebGL enabled
**And** a minimal Phaser 3 scene loads the atlas using `this.load.atlas()`
**And** an animation plays for at least 3 frames with correct frame keys
**And** a screenshot is captured and saved to `runs/spike/screenshot.png`
**And** console logs from Phaser are captured to `runs/spike/console.log`
**And** the test reports PASS if the scene renders without JavaScript errors
**And** the test reports FAIL with captured error details if rendering fails
**And** all artifacts persist to disk before test completion (NFR7)
**And** test fixtures include variable-sized source frames (simulating AI output variability) to validate trim behavior

---

## Epic 2: Manifest-Driven Generation

Implement the core CLI loop that takes a manifest and produces raw AI-generated frames using the Gemini adapter.

### Story 2.1: Define Manifest Schema with Zod Validation

**As an** operator,
**I want** the system to validate my manifest against a strict schema before running,
**So that** configuration errors are caught early with clear messages.

**Acceptance Criteria:**

**Given** a manifest YAML/JSON file
**When** I invoke `pipeline run <manifest>`
**Then** the system validates the manifest against the Zod schema before any generation
**And** validates required fields: `identity.character`, `identity.move`, `identity.version`, `identity.frame_count`
**And** validates input paths: `inputs.anchor`, `inputs.style_refs[]`, `inputs.pose_refs[]`, `inputs.guides[]`
**And** validates generator config: `generator.backend`, `generator.model`, `generator.mode`, `generator.seed_policy`, `generator.max_attempts_per_frame`
**And** validates prompt templates exist: `generator.prompts.master`, `generator.prompts.variation`, `generator.prompts.lock`, `generator.prompts.negative`
**And** reports validation errors with field path and expected type (NFR18)
**And** resolves configuration hierarchy: manifest > defaults > env (FR47)

---

### Story 2.2: Implement Manifest Lock File Generation

**As an** operator,
**I want** the system to generate a lock file at run start,
**So that** I have a reproducible record of resolved paths and versions.

**Acceptance Criteria:**

**Given** a valid manifest file
**When** a pipeline run starts
**Then** the system generates `manifest.lock.json` in the run directory
**And** the lock file contains resolved absolute paths for all input assets
**And** the lock file records generator adapter version
**And** the lock file records model ID and version string (NFR13)
**And** the lock file records run start timestamp
**And** the lock file is written atomically using temp-then-rename pattern (NFR11)

---

### Story 2.3: Implement Gemini Generator Adapter with Semantic Interleaving

**As an** operator,
**I want** the system to generate frames using the Semantic Interleaving pattern,
**So that** character identity is preserved while maintaining temporal flow.

**Acceptance Criteria:**

**Given** a manifest with `inputs.anchor` specified
**When** generating any frame
**Then** the adapter constructs a `Part[]` array with role labels:
  - `[IMAGE 1]: MASTER ANCHOR (IDENTITY TRUTH)` followed by anchor image
  - `[IMAGE 2]: PREVIOUS FRAME (POSE REFERENCE)` followed by previous frame (if available and SF01 ≥ 0.9)
  - `HIERARCHY: If [IMAGE 2] conflicts with [IMAGE 1], [IMAGE 1] wins.`
**And** applies the appropriate prompt template (master/variation/lock)
**And** generates at `canvas.generation_size` resolution (default 512px)
**And** returns `CandidateResult` with: `image_path`, `raw_prompt`, `generator_params` (with sensitive fields redacted), `attempt_id`, `errors`
**And** persists the candidate image to `candidates/` folder immediately (NFR7)
**And** logs full prompt text, seed, and API parameters to run artifacts (FR12, NFR13)
**And** `generator_params` redacts API keys and tokens at source before storage
**And** never logs API key values (NFR27)
**And** fails fast with clear error if API is unavailable (NFR19)

**Temperature & Sampling Configuration (Deep Think Lock):**

**Given** the Gemini API configuration
**When** setting generation parameters
**Then** the system MUST use `temperature: 1.0` (NEVER 0.7 — causes mode collapse)
**And** uses `topP: 0.95` and `topK: 40` for proper variance
**And** logs a warning if manifest attempts to override temperature below 1.0

**Seed Policy Implementation (Deep Think Lock):**

**Given** a frame generation attempt
**When** calculating the seed
**Then** Attempt 1 uses CRC32 hash: `CRC32(runId + "::" + frameIndex + "::" + attemptIndex)`
**And** Attempt 2+ uses `undefined` (API randomizes) to escape failure modes
**And** the CRC32 implementation uses a precomputed lookup table for performance
**And** the calculated seed is logged to audit artifacts for reproducibility

**Thought Signature Extraction (Deep Think Lock):**

**Given** a successful API response
**When** processing the response
**Then** the system extracts `thoughtSignature` from `candidate.content.parts` if present
**And** extracts `thoughtContent` from parts where `thought === true`
**And** logs both to `audit_log.jsonl` for future v2 API compatibility
**And** handles missing signatures gracefully (stateless MVP)

**Drift Recovery Behavior:**

**Given** the previous frame's SF01 score < 0.9
**When** preparing the reference stack for the current frame
**Then** the system excludes the previous frame from the `Part[]` array
**And** logs a warning: "Frame N: Skipping PrevFrame reference due to drift"
**And** generates using Anchor-only reference to reset identity

---

### Story 2.4: Implement Prompt Template System

**As an** operator,
**I want** the system to apply the correct prompt template based on generation context,
**So that** prompts are optimized for each generation scenario.

**Acceptance Criteria:**

**Given** a manifest with 4 prompt templates defined
**When** generating frame 0, attempt 1
**Then** the system applies `generator.prompts.master` template

**Given** a manifest with 4 prompt templates defined
**When** generating frame N (N > 0), attempt 1
**Then** the system applies `generator.prompts.variation` template with `{frame_index}` and `{total_frames}` interpolated

**Given** a failed attempt due to identity drift
**When** retrying with "identity rescue" action
**Then** the system applies `generator.prompts.lock` template

**Given** any generation attempt
**When** building the final prompt
**Then** the system appends `generator.prompts.negative` as the negative prompt / avoid list
**And** logs the complete resolved prompt to run artifacts

---

### Story 2.5: Implement Run Folder Structure and Artifact Organization

**As an** operator,
**I want** run artifacts organized in a deterministic folder structure,
**So that** I can easily navigate and debug generation results.

**Acceptance Criteria:**

**Given** a pipeline run for character "BLAZE" move "idle" version "v1"
**When** the run executes
**Then** artifacts are organized as: `runs/{run_id}/candidates/`, `runs/{run_id}/approved/`, `runs/{run_id}/audit/`, `runs/{run_id}/logs/`
**And** candidate files follow naming: `frame_{index}_attempt_{attempt}.png`
**And** the `runs/{run_id}/state.json` file tracks current frame index and attempt count
**And** `state.json` is updated atomically using temp-then-rename (NFR11)
**And** all file writes complete before returning success (NFR7, NFR10)

---

### Story 2.6: Implement Single Pipeline Run Command

**As an** operator,
**I want** to invoke a single pipeline run from a manifest file via CLI,
**So that** I can generate frames for one character move.

**Acceptance Criteria:**

**Given** a valid manifest file at `manifests/blaze-idle.yaml`
**When** I run `pipeline run manifests/blaze-idle.yaml`
**Then** the system validates the manifest (Story 2.1)
**And** generates the lock file (Story 2.2)
**And** creates the run folder structure (Story 2.5)
**And** generates Frame 0 using edit-from-anchor mode (Story 2.3)
**And** saves the candidate to `candidates/frame_0_attempt_1.png`
**And** logs generation metrics (duration, prompt hash) to structured JSON
**And** reports run status to console with run ID
**And** respects rate limits and logs wait time if throttled (NFR21)

---

### Story 2.7: Implement Anchor Analysis for Target Baseline Extraction (NEW - Deep Think Lock)

**As an** operator,
**I want** the system to extract alignment targets from the anchor image at run start,
**So that** all generated frames can be aligned consistently to the anchor's spatial position.

**Acceptance Criteria:**

**Given** a valid manifest with `inputs.anchor` specified
**When** a pipeline run starts (after manifest validation)
**Then** the system analyzes the anchor image to extract:
  - `baselineY`: The Y-coordinate of the lowest opaque pixel (feet position)
  - `rootX`: The X-centroid of the bottom `root_zone_ratio` of the visible sprite
**And** stores these values in `runs/{run_id}/anchor_analysis.json`
**And** uses `alphaThreshold = 128` to filter semi-transparent pixels (shadows)
**And** throws an error if the anchor is fully transparent
**And** logs the extracted values to structured output

---

### Story 2.8: Implement 4x Resolution Generation and Downsampling (NEW - Deep Think Lock)

**As an** operator,
**I want** frames generated at 4x resolution and downsampled to target size,
**So that** pixel art has crisp edges without anti-aliasing artifacts.

**Acceptance Criteria:**

**Given** a manifest with `canvas.generation_size: 512` and `canvas.target_size: 128`
**When** the generator produces a frame
**Then** the frame is generated at 512×512 resolution
**And** after post-processing, the frame is downsampled to 128×128 using nearest-neighbor interpolation
**And** the downsampling mathematically snaps "fat" lines (4px at 512) to crisp 1px lines (at 128)
**And** Sharp is used with `kernel: 'nearest'` for all resize operations
**And** the original 512px candidate is preserved in `candidates/` for debugging

---

### Story 2.9: Implement Contact Patch Alignment (NEW - Deep Think Lock)

**As an** operator,
**I want** generated frames aligned to the anchor's root position before auditing,
**So that** baseline jitter is corrected deterministically without wasting retry attempts.

**Acceptance Criteria:**

**Given** a generated frame and the anchor analysis from Story 2.7
**When** the post-processor runs
**Then** the system calculates the frame's visible bounds (topY, bottomY)
**And** calculates `visibleHeight = bottomY - topY`
**And** calculates `rootZoneHeight = visibleHeight * root_zone_ratio` (default 0.15)
**And** finds the X-centroid of pixels in the root zone → `currentRootX`
**And** calculates `shiftX = target.rootX - currentRootX`
**And** calculates `shiftY = target.baselineY - bottomY` (if `vertical_lock` enabled)
**And** clamps `shiftX` to `±max_shift_x` (default 32px) as a safety valve
**And** applies the shift using Sharp extend/extract (no interpolation)
**And** logs the applied shift values to the audit log
**And** emits a warning if the safety valve clamp was triggered

**Configuration:**

**Given** a manifest with `canvas.alignment` section
**When** processing frames
**Then** the system respects:
  - `method: 'contact_patch' | 'center' | 'none'`
  - `vertical_lock: true | false`
  - `root_zone_ratio: 0.15` (range 0.05–0.50)
  - `max_shift_x: 32` (safety valve in pixels)

---

### Story 2.10: Implement Loop Closure Pattern for Cyclic Animations (NEW - Deep Think Follow-Up)

**As an** operator,
**I want** the final frame of a looping animation to transition smoothly back to Frame 0,
**So that** cyclic animations (Idle, Walk) don't have a visible "pop" when looping.

**Acceptance Criteria:**

**Given** a manifest with `identity.is_loop: true` and `identity.frame_count: 8`
**When** generating the final frame (Frame 7)
**Then** the system detects `isLoopClosure = (frameIndex === totalFrames - 1)`
**And** modifies the prompt to include:
  - `CRITICAL CONTEXT: This is the FINAL frame of a looping animation.`
  - `OBJECTIVE: Create the missing link that connects [IMAGE 2] back to [IMAGE 1].`
  - `CONSTRAINT: The pose must be 85% transitioned towards [IMAGE 1].`
  - `PHYSICS: Ensure momentum decelerates to match the starting state.`
**And** [IMAGE 1] (Anchor) serves dual purpose as Identity Truth AND Motion Target
**And** the loop closure logic is logged to audit artifacts
**And** the generated frame visually bridges Frame N-1 to Frame 0

**Non-Looping Animations:**

**Given** a manifest with `identity.is_loop: false` (e.g., Attack moves)
**When** generating frames
**Then** the loop closure pattern is NOT applied
**And** standard linear flow prompts are used

---

### Story 2.11: Implement Phase-Based Pose Library (NEW - Deep Think Follow-Up)

**As an** operator,
**I want** pose descriptions defined as kinematic phases rather than per-frame text,
**So that** I can efficiently define animation poses without hand-authoring 8+ descriptions.

**Acceptance Criteria:**

**Given** the file `src/domain/poses.ts` exists
**When** the generator prepares a prompt for Frame N
**Then** the system looks up the pose description via `getPoseForFrame(moveId, frameIndex)`
**And** injects the description into the prompt as `POSE ACTION: {description}`
**And** falls back to "Maintain style and consistent volume." if no specific description exists

**Pose Library Structure:**

**Given** the MOVES_LIBRARY constant
**When** defining poses
**Then** each move maps frame indices to `PosePhase` objects:
  - `description`: Natural language pose instruction (mid-level intent)
  - `tension`: "relaxed" | "tense" | "explosive" (for style modulation)
**And** Frame 0 is implicitly the Anchor pose (no description needed)
**And** phases describe biomechanical states (Contact, Recoil, Passing, High Point)

**MVP Pose Library Content:**

**Given** MVP scope
**When** implementing the pose library
**Then** the following moves are defined:
  - `idle_standard`: 8 frames (breathing sine wave)
  - `walk_forward`: 8 frames (standard locomotion cycle)
**And** each frame has a specific pose description following the Phase Map pattern
**And** the library is extensible for future moves (attack, jump, block)

---

## Epic 3: Automated Quality Guardrails

Build the Auditor that normalizes frames and enforces the "Hard Gates" and SSIM metrics.

### Story 3.1: Implement Frame Normalization Pipeline

**As an** operator,
**I want** each generated candidate normalized to target specifications,
**So that** frames are consistent before auditing and packing.

**Acceptance Criteria:**

**Given** a raw candidate image from the generator (at 512px generation size)
**When** the normalizer processes it
**Then** Contact Patch Alignment is applied first (Story 2.9)
**And** then 4x→1x downsampling is applied (Story 2.8)
**And** the image is resized to exact canvas size (128×128 or 256×256 per manifest)
**And** consistent scale is applied using pixel-safe downscale method (nearest-neighbor)
**And** the normalized image is saved to `candidates/` with `_norm` suffix
**And** normalization completes in ≤2 seconds per frame
**And** Sharp library is used for all image processing

**Processing Order:**
1. Contact Patch Alignment (at generation resolution)
2. Downsampling (512px → 128px)
3. Transparency enforcement
4. Final canvas crop/pad

---

### Story 3.2: Implement Transparency Strategy Enforcement with Dynamic Chroma Key

**As an** operator,
**I want** the system to enforce a consistent transparency strategy per run,
**So that** all frames have clean alpha channels for game rendering.

**Acceptance Criteria:**

**Given** a manifest with `transparency.strategy: "true_alpha"`
**When** processing a candidate
**Then** the system validates the image has a proper alpha channel
**And** rejects frames without alpha as Hard Fail

**Given** a manifest with `transparency.strategy: "chroma_key"` and `transparency.chroma_color: "auto"`
**When** processing a candidate
**Then** the system analyzes the anchor palette at run start
**And** if anchor contains green (#00FF00), uses magenta (#FF00FF) as chroma
**And** if anchor contains magenta, uses cyan (#00FFFF) as chroma
**And** applies deterministic background removal using the selected color
**And** logs the transparency method and selected color to run artifacts
**And** the resulting image has clean alpha edges
**And** chroma key removal is validated against sprites with near-chroma colors to prevent fringe artifacts

**Given** a manifest with explicit `transparency.chroma_color: "#FF00FF"`
**When** processing a candidate
**Then** the system uses the specified color without auto-detection

---

### Story 3.3: Implement Hard Gate Evaluators (HF01-HF05)

**As an** operator,
**I want** frames evaluated against hard gates that block on failure,
**So that** fundamentally broken frames are rejected immediately.

**Acceptance Criteria:**

**Given** a normalized candidate image
**When** the auditor evaluates hard gates
**Then** HF01 (Dimension Check) verifies exact canvas size match
**And** HF02 (Alpha Integrity) verifies no fully transparent frames
**And** HF03 (Corruption Check) verifies image is readable and not corrupted
**And** HF04 (Color Depth) verifies 32-bit RGBA format
**And** HF05 (File Size) verifies file is within reasonable bounds (10KB - 5MB)
**And** any hard gate failure returns `Result.err()` with `HFxx` error code
**And** hard gate failures are logged with specific failure reason
**And** hard gate evaluation completes in ≤1 second

---

### Story 3.4: Implement SSIM Identity Metric

**As an** operator,
**I want** frames compared against the anchor using SSIM,
**So that** character identity drift is detected and quantified.

**Acceptance Criteria:**

**Given** a normalized candidate and the anchor reference image
**When** computing identity metrics
**Then** the system calculates SSIM (Structural Similarity Index) score
**And** SSIM score is normalized to 0.0-1.0 range
**And** the score is compared against `auditor.thresholds.identity_min` from manifest
**And** scores below threshold trigger `SF_IDENTITY_DRIFT` soft fail
**And** the SSIM score is logged to audit metrics
**And** computation completes in ≤3 seconds

---

### Story 3.5: Implement Palette Fidelity Metric

**As an** operator,
**I want** frames evaluated against the character's color palette,
**So that** off-palette colors are detected before export.

**Acceptance Criteria:**

**Given** a normalized candidate and `inputs.palette` color list from manifest
**When** computing palette fidelity
**Then** the system extracts dominant colors from the candidate
**And** calculates the percentage of pixels matching palette colors (within tolerance)
**And** the score is compared against `auditor.thresholds.palette_min`
**And** scores below threshold trigger `SF_PALETTE_DRIFT` soft fail
**And** the fidelity percentage is logged to audit metrics

---

### Story 3.6: Implement Alpha Artifact Detection (Halo/Fringe)

**As an** operator,
**I want** frames checked for alpha edge artifacts,
**So that** halos and fringes are detected before they appear in-game.

**Acceptance Criteria:**

**Given** a normalized candidate with alpha channel
**When** analyzing alpha edges
**Then** the system detects semi-transparent pixels at sprite edges
**And** calculates halo severity score (0.0 = clean, 1.0 = severe)
**And** scores above `auditor.thresholds.alpha_artifact_max` trigger `SF_ALPHA_HALO` soft fail
**And** the severity score is logged to audit metrics

---

### Story 3.7: Implement Baseline Drift Measurement

**As an** operator,
**I want** frames measured for baseline position consistency,
**So that** characters don't appear to float or sink between frames.

**Acceptance Criteria:**

**Given** a normalized candidate and the anchor reference
**When** measuring baseline drift
**Then** the system detects the sprite's bottom edge (baseline) position
**And** calculates pixel offset from anchor baseline
**And** drift exceeding `auditor.thresholds.baseline_drift_max` triggers `SF_BASELINE_DRIFT` soft fail
**And** the drift value in pixels is logged to audit metrics

---

### Story 3.8: Implement Soft Metric Aggregation and Scoring

**As an** operator,
**I want** soft metrics aggregated into a weighted composite score,
**So that** I can understand overall frame quality at a glance.

**Acceptance Criteria:**

**Given** individual metric scores from Stories 3.4-3.7
**When** computing the composite quality score
**Then** the system applies scoring weights: Stability 0.35, Identity 0.30, Palette 0.20, Style 0.15
**And** the composite score is normalized to 0.0-1.0 range
**And** frames below `auditor.thresholds.composite_min` are flagged for retry
**And** the breakdown and composite score are logged to `audit/{frame}_metrics.json`
**And** all soft metrics are computed within NFR2 (≤10 seconds total)

**MAPD Temporal Coherence (Deep Think Follow-Up):**

**Given** the current frame and previous frame for temporal comparison
**When** calculating MAPD (Masked Mean Absolute Pixel Difference)
**Then** the system applies move-type-specific thresholds:
  - `idle`: > 0.02 (2%) triggers `SF04_TEMPORAL_FLICKER`
  - `walk`: > 0.10 (10%) triggers `SF04_TEMPORAL_FLICKER`
  - `block`: > 0.05 (5%) triggers `SF04_TEMPORAL_FLICKER`
  - `attack`, `jump`, `hit`: **BYPASS** (use SSIM instead — frames barely overlap)
**And** MAPD is calculated only on the intersection of non-transparent pixels
**And** the move type is read from `identity.move_type` in manifest
**And** bypassed moves log "MAPD skipped: high-motion move type"

---

### Story 3.9: Implement Auditor Threshold Configuration

**As an** operator,
**I want** to configure auditor thresholds in the manifest,
**So that** I can tune quality gates for different characters or moves.

**Acceptance Criteria:**

**Given** a manifest with `auditor.thresholds` section
**When** the auditor runs
**Then** it reads thresholds for: `identity_min`, `palette_min`, `alpha_artifact_max`, `baseline_drift_max`, `composite_min`
**And** missing thresholds fall back to sensible defaults
**And** the effective thresholds are logged at run start
**And** threshold values are validated by Zod schema (Story 2.1)

---

### Story 3.10: Implement Orphan Pixel Detection (NEW - Deep Think Follow-Up)

**As an** operator,
**I want** frames checked for isolated "orphan" pixels after downsampling,
**So that** noisy artifacts from the 512px→128px conversion are detected.

**Acceptance Criteria:**

**Given** a normalized 128px candidate image
**When** the orphan pixel detector runs
**Then** the system scans internal pixels (skipping 1px border)
**And** for each opaque pixel, checks its 4 orthogonal neighbors (Up, Down, Left, Right)
**And** counts pixels where NO neighbor shares the exact same RGBA color
**And** classifies results:
  - 0-5 orphans: **PASS** (allows for eye glints, buckles)
  - 6-15 orphans: **WARNING** (logged but not failed)
  - >15 orphans: **SF_PIXEL_NOISE** soft fail
**And** transparent pixels (alpha = 0) are excluded from the scan
**And** the orphan count is logged to audit metrics
**And** computation completes in ≤500ms

**Implementation Notes:**

**Given** Sharp library for image processing
**When** implementing the detector
**Then** use `sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true })`
**And** compare pixels using exact RGBA match (pixel art has no anti-aliasing)
**And** the algorithm handles edge cases (small sprites, solid color sprites)

---

## Epic 4: Resilient Orchestration & Retry Ladder

Connect the Generator and Auditor with a stateful Orchestrator that handles failures and executes the "Retry Ladder."

### Story 4.1: Implement Frame-to-Frame Chaining (Edit-from-Previous)

**As an** operator,
**I want** frames 2+ generated by editing from the previous approved frame,
**So that** animation sequences maintain temporal consistency.

**Acceptance Criteria:**

**Given** Frame 0 has been approved
**When** generating Frame 1
**Then** the adapter uses Frame 0's approved image as the edit base (not the anchor)
**And** applies `generator.prompts.variation` with frame index interpolation

**Given** Frame N has been approved
**When** generating Frame N+1
**Then** the adapter chains from Frame N's approved image
**And** if identity drift is detected, the system can re-anchor to the original anchor image
**And** the chaining decision is logged to run artifacts

---

### Story 4.2: Implement Attempt Tracking and Max Attempts Enforcement

**As an** operator,
**I want** the system to track attempts per frame and stop when max is reached,
**So that** the pipeline doesn't loop infinitely on problematic frames.

**Acceptance Criteria:**

**Given** a manifest with `generator.max_attempts_per_frame: 5`
**When** generating a frame
**Then** the system tracks `attempt_count` in `state.json`
**And** increments the counter after each generation attempt
**And** when `attempt_count >= max_attempts_per_frame`, the frame is marked as `failed`
**And** the pipeline moves to the next frame or triggers stop condition
**And** the attempt history is preserved in audit artifacts

---

### Story 4.3: Implement Retry Ladder with Reason-to-Action Mapping

**As an** operator,
**I want** failures mapped to specific recovery actions,
**So that** the system can intelligently attempt different strategies.

**Acceptance Criteria:**

**Given** a manifest with `retry.ladder` configuration
**When** an audit failure occurs with a specific reason code
**Then** the system looks up the corresponding recovery action:
  - `SF_IDENTITY_DRIFT` → Try "identity rescue" (re-anchor + lock prompt)
  - `SF_PALETTE_DRIFT` → Try "tighten negative" (add palette enforcement to negative)
  - `SF_BASELINE_DRIFT` → Try "pose rescue" (add baseline guide emphasis)
  - `SF_ALPHA_HALO` → Try "post-process" (apply alpha cleanup filter)
  - `SF_PIXEL_NOISE` → Try "regenerate at higher res" or apply smoothing
**And** the action is logged before execution
**And** if the action fails, the system escalates to the next ladder level

**HF_IDENTITY_COLLAPSE Handling (Deep Think Follow-Up):**

**Given** a frame that has triggered "Re-anchor" strategy twice consecutively
**When** the second re-anchor attempt also fails SF01 < 0.9
**Then** the system escalates to `HF_IDENTITY_COLLAPSE`
**And** the frame is marked as REJECTED (not retried further)
**And** the run CONTINUES to the next frame (single bad frame doesn't kill batch)
**And** logs diagnostic: "Suggestion: Anchor may lack resolution for this pose angle"
**And** immediately recalculates reject_rate after rejection
**And** if `reject_rate > 0.3` (30%), triggers STOPPED state for entire run

**Oscillation Prevention:**

**Given** a frame that alternates between pass and fail on re-anchor
**When** the same frame triggers re-anchor more than twice
**Then** the system treats this as "Dead End" and escalates to HF_IDENTITY_COLLAPSE
**And** logs warning: "Frame N: Oscillation detected, marking as identity collapse"

---

### Story 4.4: Implement Stop Conditions and Run Halting

**As an** operator,
**I want** the pipeline to halt when stop conditions are met,
**So that** I don't waste API credits on runs that are failing consistently.

**Acceptance Criteria:**

**Given** a manifest with `retry.stop_conditions`:
  - `max_retry_rate: 0.5` (50% of frames required retries)
  - `max_reject_rate: 0.3` (30% of frames rejected)
  - `max_consecutive_fails: 3`
**When** any stop condition is met during a run
**Then** the pipeline halts with status `stopped`
**And** the specific stop condition that triggered is recorded
**And** all in-progress work is persisted before halt (NFR6-7)
**And** the run can be resumed later (FR3 - v1+ placeholder)

---

### Story 4.5: Implement Run Status Reporting

**As an** operator,
**I want** to see run status with reason codes,
**So that** I understand what happened during pipeline execution.

**Acceptance Criteria:**

**Given** a pipeline run in any state
**When** querying run status
**Then** the system reports one of: `in-progress`, `completed`, `stopped`, `failed`
**And** includes reason code explaining the status
**And** includes aggregate metrics: frames_completed, frames_failed, total_attempts, retry_rate
**And** the status is persisted to `state.json` atomically

---

### Story 4.6: Implement Diagnostic Report Generation

**As an** operator,
**I want** a diagnostic report when stop conditions trigger,
**So that** I can understand root cause and plan recovery.

**Acceptance Criteria:**

**Given** a pipeline run that halted due to stop condition
**When** the halt occurs
**Then** the system generates `runs/{run_id}/diagnostic.json`
**And** the report includes:
  - Stop condition that triggered
  - Frame-by-frame failure breakdown
  - Top 3 most common failure codes
  - Suggested root cause based on failure patterns
  - Recommended recovery actions (FR26)
**And** the diagnostic report is human-readable
**And** all fields that could contain secrets (API keys, tokens) are sanitized before writing

---

### Story 4.7: Implement Idempotent Run Resumption

**As an** operator,
**I want** re-running the same manifest to skip already-approved frames,
**So that** I don't re-generate work that already succeeded.

**Acceptance Criteria:**

**Given** a previous run with frames 0-3 approved
**When** I run `pipeline run manifests/blaze-idle.yaml` again
**Then** the system detects the existing run state
**And** skips frames 0-3 (already in `approved/` folder)
**And** resumes generation from frame 4
**And** preserves all previous artifacts and logs
**And** the behavior satisfies NFR12 (MVP idempotency)
**And** if manifest content hash differs from previous run, warns operator and requires `--force` flag to skip existing frames

---

### Story 4.8: Implement Orchestrator State Machine

**As an** operator,
**I want** a robust state machine managing the generate-audit-retry loop,
**So that** the pipeline executes reliably without losing progress.

**Acceptance Criteria:**

**Given** a pipeline run
**When** the orchestrator executes
**Then** it follows the state machine:
  1. `INIT` → Validate manifest, create lock file
  2. `GENERATING` → Call generator adapter
  3. `AUDITING` → Run hard gates then soft metrics
  4. `RETRY_DECIDING` → Consult retry ladder for next action
  5. `APPROVING` → Move frame to approved folder
  6. `NEXT_FRAME` → Increment frame index
  7. `COMPLETED` or `STOPPED` → Final state
**And** state transitions are logged
**And** current state is persisted to `state.json` after each transition (NFR11)
**And** no in-memory-only state exists for completed work (NFR10)
**And** explicit transition defined for "retry ladder exhausted but attempts remaining" → re-generate with default prompt

---

## Epic 5: Production Export & Validation

Integrate TexturePacker and the final Phaser validation suite to produce game-ready assets.

### Story 5.1: Implement Deterministic Frame Naming Convention

**As an** operator,
**I want** frames named according to Phaser expectations,
**So that** animations load correctly in the game engine.

**Acceptance Criteria:**

**Given** approved frames in `runs/{run_id}/approved/`
**When** preparing for atlas export
**Then** frames are renamed to format `{ACTION}/{ZERO_PAD}` (e.g., `idle/0000`, `idle/0001`)
**And** the naming policy matches the validator specification from Compliance Kit
**And** frame numbers are zero-padded to **4 digits** (Deep Think Lock)
**And** the original-to-renamed mapping is logged for traceability

**4-Digit Padding Standard (Deep Think Follow-Up):**

**Given** the frame renaming process
**When** generating frame names
**Then** use `frameIndex.toString().padStart(4, '0')` (e.g., `0000`, `0001`, `0010`)
**And** TexturePacker uses the `{n4}` token in naming pattern
**And** Phaser animations use `zeroPad: 4` in `generateFrameNames()`
**And** this ensures correct lexicographical sorting in file explorers
**And** eliminates guessing in Phaser config (always 4)

---

### Story 5.2: Implement TexturePacker Integration with Locked Settings

**As an** operator,
**I want** TexturePacker invoked with locked CLI flags,
**So that** atlas output is deterministic and game-compatible.

**Acceptance Criteria:**

**Given** approved frames ready for packing
**When** invoking TexturePacker
**Then** the CLI is called with exact flags: `--format phaser --trim-mode Trim --extrude 1 --shape-padding 2 --border-padding 2 --disable-rotation --alpha-handling ReduceBorderArtifacts --max-size 2048 --trim-sprite-names --prepend-folder-name`
**And** the command is executed via Execa with cross-platform safety
**And** TexturePacker failure does not invalidate approved frames (NFR23)
**And** stdout/stderr is captured to run logs

---

### Story 5.3: Implement Phaser-Compatible Atlas Output

**As an** operator,
**I want** atlas exported in PNG + JSON Hash format,
**So that** it loads directly in Phaser 3.

**Acceptance Criteria:**

**Given** TexturePacker completes successfully
**When** examining output
**Then** `{character}_{move}.png` sprite sheet is created
**And** `{character}_{move}.json` JSON Hash atlas is created
**And** JSON contains `frames` object with correct frame keys
**And** JSON contains `meta` object with image dimensions
**And** output is placed in `runs/{run_id}/export/` folder

---

### Story 5.4: Implement Multipack Support for Large Atlases

**As an** operator,
**I want** automatic multipack when atlas exceeds max size,
**So that** large animation sets export correctly.

**Acceptance Criteria:**

**Given** approved frames that exceed 2048×2048 when packed
**When** TexturePacker runs
**Then** the system uses `{n}` placeholder for sheet numbering
**And** produces `{character}_{move}_0.png`, `{character}_{move}_1.png`, etc.
**And** produces corresponding JSON files for each sheet
**And** the total sheet count is logged

**Multipack Validation (Deep Think Follow-Up):**

**Given** a multipack atlas output
**When** TEST-04 validation runs
**Then** the system validates the "Master JSON" structure:
  - Root object contains `textures[]` array (Phaser MultiAtlas format)
  - Each entry in `textures[]` has valid `image` property pointing to existing PNG
  - All referenced PNG files exist on disk (e.g., `atlas_0.png`, `atlas_1.png`)
**And** collects all frame names from ALL sub-textures into a single set
**And** asserts the set contains exactly `manifest.frame_count` items
**And** asserts every key matches regex `^{move}/\d{4}$`
**And** failure returns `HF_ATLAS_FORMAT: Missing 'textures' array for MultiAtlas`

**Phaser Loading Behavior:**

**Given** a valid multipack structure
**When** Phaser loads the atlas
**Then** frame keys are global across all sub-textures
**And** `idle/0001` might be on `atlas_0.png` while `idle/0020` is on `atlas_1.png`
**And** Phaser handles this transparently via the `textures[]` array

---

### Story 5.5: Implement Pre-Export Validation Checklist

**As an** operator,
**I want** approved frames validated before packing,
**So that** export problems are caught early.

**Acceptance Criteria:**

**Given** approved frames in `approved/` folder
**When** pre-export validation runs
**Then** the 11-item checklist is evaluated:
  1. All frames present (count matches manifest)
  2. Dimensions match target canvas size
  3. Alpha channel present on all frames
  4. No corrupted images
  5. Naming convention valid
  6. No duplicate frames
  7. File sizes within bounds
  8. Color depth is 32-bit RGBA
  9. No stray files in folder
  10. Frame sequence is contiguous
  11. Total file size reasonable for packing
  12. Bounding box consistency across frames (prevents trim jitter)
**And** failures are reported with specific frame and issue
**And** export is blocked on pre-validation failure

---

### Story 5.6: Implement Post-Export Validation

**As an** operator,
**I want** exported atlas validated after packing,
**So that** I know the output is structurally correct.

**Acceptance Criteria:**

**Given** TexturePacker has completed
**When** post-export validation runs
**Then** JSON structure integrity is verified (valid JSON, correct schema)
**And** frame data is verified (all expected frames present in JSON)
**And** PNG integrity is verified (valid image, correct dimensions)
**And** frame key format matches `{ACTION}/{ZERO_PAD}` pattern
**And** validation results are logged as structured PASS/FAIL

---

### Story 5.7: Implement Phaser Micro-Test Suite (TEST-02, TEST-03, TEST-04)

**As an** operator,
**I want** exported atlas validated in actual Phaser 3,
**So that** I have "Engine Truth" confirmation before release.

**Acceptance Criteria:**

**Given** an exported atlas (PNG + JSON)
**When** running `pipeline validate <run_id>`
**Then** TEST-02 (Pivot Auto-Apply) verifies origin/pivot behavior is consistent
**And** TEST-03 (Trim Mode Jitter) verifies no visual jitter between frames
**And** TEST-04 (Suffix Convention) verifies frame key resolution works
**And** each test runs in headless Chrome via Puppeteer
**And** each test reports PASS/FAIL with specific failure details
**And** screenshots are captured for each test (FR39)
**And** test logs are saved to `runs/{run_id}/validation/`

---

### Story 5.8: Implement Release-Ready Gating

**As an** operator,
**I want** release-ready status blocked if validation fails,
**So that** broken assets don't ship to production.

**Acceptance Criteria:**

**Given** Phaser validation has completed
**When** any micro-test fails
**Then** the run is NOT marked as "release-ready"
**And** the failure reason is clearly logged
**And** assets remain in `export/` but are not promoted

**Given** all micro-tests pass
**When** validation completes
**Then** the run is marked as "release-ready"
**And** assets can be promoted to final output location

**Given** validation fails but operator needs debug build
**When** running with `--allow-validation-fail` flag
**Then** the system exports anyway with warning logged (NFR26)
**And** the run is marked as "debug-only, not release-ready"

---

### Story 5.9: Implement Export Settings Configuration

**As an** operator,
**I want** to configure export settings in the manifest,
**So that** I can customize atlas parameters per character/move.

**Acceptance Criteria:**

**Given** a manifest with `export` section
**When** the exporter runs
**Then** it reads `export.packer_flags` for any override flags (merged with locked flags)
**And** it reads `export.atlas_format` (default: "phaser")
**And** it reads `export.output_path` for custom output location
**And** locked flags cannot be overridden (safety enforcement)
**And** configuration is validated by Zod schema

---

## Epic 6: Pipeline Visibility & Documentation

Finalize the inspection tools and operator documentation for handoff.

### Story 6.1: Implement `pipeline inspect` Command

**As an** operator,
**I want** to inspect run artifacts via CLI,
**So that** I can debug and review pipeline results without navigating folders manually.

**Acceptance Criteria:**

**Given** a completed or in-progress run
**When** I run `pipeline inspect <run_id>`
**Then** the system displays run summary: status, frames completed, frames failed, retry rate
**And** lists all artifacts in the run folder with sizes
**And** shows the last 5 log entries
**And** can display specific frame audit metrics with `--frame <index>` flag
**And** can show full diagnostic report with `--diagnostic` flag

---

### Story 6.2: Implement Per-Frame Audit Metrics Output

**As an** operator,
**I want** per-frame audit metrics as structured data,
**So that** I can analyze quality patterns programmatically.

**Acceptance Criteria:**

**Given** a completed run
**When** inspecting audit artifacts
**Then** each frame has `audit/frame_{index}_metrics.json` with:
  - All soft metric scores (SSIM, palette, alpha, baseline)
  - Composite score and breakdown
  - Pass/fail status with reason codes
  - Attempt history with timestamps
**And** the JSON schema is consistent across all frames
**And** metrics can be exported in CSV format with `--csv` flag

---

### Story 6.3: Implement Run Summary Report

**As an** operator,
**I want** aggregate statistics for each run,
**So that** I can understand overall pipeline performance.

**Acceptance Criteria:**

**Given** a completed run
**When** the run finishes
**Then** `runs/{run_id}/summary.json` is generated with:
  - Total frames attempted vs completed
  - Retry rate (retries / total attempts)
  - Reject rate (rejected frames / total frames)
  - Top 3 failure codes with counts
  - Total run duration
  - Average time per frame
**And** the summary is human-readable when pretty-printed

---

### Story 6.4: Implement Artifact Folder Organization

**As an** operator,
**I want** approved, rejected, and candidate frames in distinct folders,
**So that** I can easily find and review specific frame categories.

**Acceptance Criteria:**

**Given** a pipeline run
**When** artifacts are organized
**Then** `approved/` contains only frames that passed all gates
**And** `rejected/` contains frames that failed hard gates (with reason in filename)
**And** `candidates/` contains all generation attempts (including those that were later approved)
**And** `audit/` contains all metrics files
**And** folder structure is documented in README within `runs/` directory

---

### Story 6.5: Implement Manifest Template Generator

**As an** operator,
**I want** to create manifests from templates for new characters/moves,
**So that** I can quickly configure new pipeline runs.

**Acceptance Criteria:**

**Given** I want to create a manifest for a new character
**When** I run `pipeline new-manifest --character NOVA --move attack`
**Then** a new manifest file is created at `manifests/nova-attack.yaml`
**And** the manifest includes all required sections with placeholder values
**And** includes comments explaining each field
**And** references example values from the schema
**And** the generated manifest passes schema validation

---

### Story 6.6: Implement Operator Guide Documentation

**As an** operator,
**I want** comprehensive documentation explaining quality gates and decision trees,
**So that** I can troubleshoot issues and tune the pipeline effectively.

**Acceptance Criteria:**

**Given** the CLI is installed
**When** I run `pipeline help --guide`
**Then** the system displays or outputs the operator guide including:
  - Quick start (first run in ≤45 minutes per NFR16)
  - Quality gate explanations (what each HF and SF code means)
  - Retry ladder decision tree visualization
  - Common failure patterns and solutions
  - Manifest configuration reference
  - Troubleshooting FAQ
**And** the guide is also available as `docs/operator-guide.md` in the project

---

### Story 6.7: Implement Model Version Warning System

**As an** operator,
**I want** to be warned when the generator model version changes or is deprecated,
**So that** I can prepare for potential output changes.

**Acceptance Criteria:**

**Given** a pipeline run starts
**When** the model ID/version differs from the last recorded run
**Then** the system logs a warning: "Model version changed from X to Y"
**And** notes this in the run summary

**Given** a pipeline run starts
**When** the model is marked as deprecated by the API
**Then** the system logs a warning: "Model X is deprecated, consider updating manifest"
**And** the run proceeds but flags are set for operator attention

---

### Story 6.8: Implement One-Command First Run

**As an** operator,
**I want** to complete a first run with a single command,
**So that** I can verify the pipeline works before configuring custom manifests.

**Acceptance Criteria:**

**Given** a fresh installation with dependencies configured
**When** I run `pipeline demo`
**Then** the system uses a bundled sample manifest
**And** uses bundled sample anchor and reference images
**And** generates at least 2 frames
**And** runs the audit and export pipeline
**And** produces a sample atlas in `runs/demo/export/`
**And** completes within the NFR16 ramp-up time goal
**And** outputs a success message with next steps

---

## Epic 7: Director Mode (Human-in-the-Loop Interface) — NEW

Implement the web-based Director Mode for human review, manual alignment override, and corrective inpainting. This epic provides the "Grey Box" collaborative workflow where operators can inspect, nudge, and patch frames before final export.

### Story 7.1: Implement Director Session State Management

**As an** operator,
**I want** a robust state object tracking the lifecycle of every frame in Director Mode,
**So that** I can resume reviews and maintain progress across browser sessions.

**Acceptance Criteria:**

**Given** a pipeline run entering Director Mode
**When** initializing the session
**Then** the system creates a `DirectorSession` object with:
  - `sessionId`: Unique identifier
  - `moveId`: Current move being reviewed
  - `anchorFrameId`: Reference to Frame 0
  - `frames`: Map of frame index to frame state
**And** each frame tracks:
  - `id`: Unique frame identifier
  - `status`: `PENDING | GENERATED | AUDIT_FAIL | AUDIT_WARN | APPROVED`
  - `imageBase64`: Current visual state (including AutoAlign)
  - `auditReport`: Flags and score from Auditor
  - `directorOverrides`: Human alignment deltas and patch status
**And** the session state is persisted to `runs/{run_id}/director_session.json`
**And** state survives browser refresh

---

### Story 7.2: Implement Timeline Component with Status Indicators

**As an** operator,
**I want** a visual timeline showing all frames with color-coded status,
**So that** I can quickly identify frames needing attention.

**Acceptance Criteria:**

**Given** Director Mode is active with frames loaded
**When** viewing the Timeline pane
**Then** frames display as a horizontal filmstrip at the bottom
**And** each frame thumbnail has a border color indicating status:
  - **Green**: APPROVED (Auditor passed or Human verified)
  - **Yellow**: AUDIT_WARN (Auto-aligned, needs review)
  - **Red**: AUDIT_FAIL (Failed hard or soft gates)
**And** clicking a frame loads it into the Stage
**And** the current frame is highlighted
**And** frame thumbnails are 64px for quick scanning

---

### Story 7.3: Implement Stage Component with Onion Skinning

**As an** operator,
**I want** a central workspace showing the current frame at high zoom with overlays,
**So that** I can inspect details and compare to adjacent frames.

**Acceptance Criteria:**

**Given** a frame is selected in the Timeline
**When** viewing the Stage pane
**Then** the frame is rendered at 4x zoom (512px display for 128px source)
**And** Onion Skinning can be toggled:
  - Frame[i-1] at 30% opacity behind current frame
  - Frame[0] (Anchor) at 15% opacity (toggleable)
**And** a baseline guide line is drawn at the Anchor's baselineY
**And** the canvas has a neutral checkerboard background for transparency
**And** zoom level can be adjusted (1x, 2x, 4x, 8x)

---

### Story 7.4: Implement Nudge Tool for Manual Alignment

**As an** operator,
**I want** to drag sprites to fine-tune alignment when AutoAligner is imperfect,
**So that** I can correct edge cases without regenerating.

**Acceptance Criteria:**

**Given** a frame displayed on the Stage
**When** selecting the Nudge Tool and dragging the sprite
**Then** the system tracks mouse delta (X, Y pixels)
**And** updates the visual preview in real-time
**And** on release, records a `HumanAlignmentDelta`:
  - `frameId`: Current frame
  - `userOverrideX`: Horizontal adjustment
  - `userOverrideY`: Vertical adjustment
  - `timestamp`: When adjustment was made
**And** the delta is stored in `directorOverrides.alignment`
**And** the frame status changes to APPROVED (Green border)
**And** the actual pixel data is NOT modified until export

---

### Story 7.5: Implement Mask Pen Tool for Inpainting Regions

**As an** operator,
**I want** to mark specific areas for AI correction without regenerating the whole frame,
**So that** I can fix localized issues (malformed hands, color bleed) efficiently.

**Acceptance Criteria:**

**Given** a frame displayed on the Stage
**When** selecting the Mask Pen Tool
**Then** the cursor changes to a brush indicator
**And** drawing on the canvas creates a red overlay on selected pixels
**And** the mask can be erased with right-click or eraser toggle
**And** the mask is stored as a binary image (white = inpaint region)
**And** a text input appears for the correction prompt (e.g., "Clenched fist, darker skin")

---

### Story 7.6: Implement Patch API for Corrective Inpainting

**As an** operator,
**I want** masked regions sent to the AI for targeted correction,
**So that** I can fix specific details without affecting the rest of the frame.

**Acceptance Criteria:**

**Given** a mask is drawn and a correction prompt is entered
**When** clicking the "Patch" button
**Then** the system sends to the Gemini Inpaint endpoint:
  - Original image (base64)
  - Mask image (base64 - black with white regions to inpaint)
  - Prompt: "TASK: Inpaint the masked area. Integrate seamlessly with existing pixel art style. DETAIL: {user_prompt}"
**And** the API returns a corrected image
**And** the patched image replaces the current frame in the session
**And** `directorOverrides.isPatched` is set to true
**And** the original pre-patch image is preserved in history
**And** failure shows an error message without losing the mask

---

### Story 7.7: Implement Inspector Pane with Audit Details

**As an** operator,
**I want** to see why the Auditor flagged a frame,
**So that** I can make informed decisions about fixes.

**Acceptance Criteria:**

**Given** a frame is selected
**When** viewing the Inspector pane
**Then** it displays:
  - **Audit Score**: Composite quality score (0.0-1.0)
  - **Flags**: List of triggered codes (SF01, HF03, etc.)
  - **Metrics Breakdown**: SSIM, Palette %, Baseline Drift, Orphan Count
  - **Prompt Used**: The exact prompt that generated this frame
  - **Attempt History**: Previous attempts with their scores
**And** clicking a flag shows its description from the Reason Code reference

---

### Story 7.8: Implement Visual Diff Overlays

**As an** operator,
**I want** visual feedback showing exactly what the Auditor detected,
**So that** I can see problems without interpreting numbers.

**Acceptance Criteria:**

**Given** a frame with SF01_PALETTE_MISMATCH flag
**When** toggling "Show Palette Issues"
**Then** illegal (off-palette) pixels are highlighted in blinking magenta
**And** a "Legalize" button appears to snap those pixels to nearest palette color

**Given** a frame with HF03_BASELINE_DRIFT flag
**When** toggling "Show Alignment"
**Then** a Cyan line is drawn at Anchor's baselineY
**And** a Red line is drawn at the current sprite's detected baseline
**And** the gap between lines is labeled with pixel distance

---

### Story 7.9: Implement Commit and Export Flow

**As an** operator,
**I want** to finalize my review and save all changes,
**So that** the approved frames proceed to atlas export.

**Acceptance Criteria:**

**Given** Director Mode session with reviewed frames
**When** clicking "Commit"
**Then** all Human Alignment Deltas are applied to pixel data
**And** patched frames use their corrected versions
**And** final images are written to `runs/{run_id}/approved/`
**And** `director_session.json` is marked as committed
**And** the Director Server closes
**And** the CLI continues to the export phase
**And** a success message shows count of approved frames

---

## Epic 8: CLI Pipeline Integration — NEW

Implement the unified `banana` CLI tool that orchestrates the complete pipeline and serves the Director Mode interface. This epic connects all pipeline components into a cohesive command-line experience.

### Story 8.1: Implement CLI Entry Point with Commander

**As an** operator,
**I want** a single CLI binary that provides all pipeline commands,
**So that** I can run the entire workflow from the terminal.

**Acceptance Criteria:**

**Given** the CLI is installed globally or via npx
**When** running `banana --help`
**Then** the system displays available commands:
  - `gen`: Generate sprite sequence
  - `doctor`: Check dependencies
  - `schema`: Show manifest schema
  - `inspect`: View run artifacts
  - `validate`: Run Phaser micro-tests
  - `demo`: Run sample generation
**And** version information is displayed
**And** the CLI is built with Commander.js
**And** `bin.ts` is the entry point with shebang `#!/usr/bin/env node`

---

### Story 8.2: Implement `banana gen` Command

**As an** operator,
**I want** to generate sprites with a single command,
**So that** I can kick off the full pipeline easily.

**Acceptance Criteria:**

**Given** a valid manifest exists
**When** running `banana gen --move=walk_forward`
**Then** the system:
  1. Validates the manifest
  2. Creates run folder structure
  3. Analyzes anchor image
  4. Generates frames 0 through N
  5. Audits each frame
  6. Auto-aligns drifted frames
  7. Stores approved frames
**And** progress is displayed with ora spinners:
  - "Generating Frame 2/8..."
  - "✔ Frame 2/8 Generated (Audit Score: 0.98)"
  - "⚠ Frame 3/8 Auto-Aligned (Drift: +4px)"
**And** the run completes with summary statistics
**And** logs are written to `runs/{run_id}/logs/`

---

### Story 8.3: Implement Interactive Mode Flag

**As an** operator,
**I want** to optionally launch Director Mode after generation,
**So that** I can review frames before export.

**Acceptance Criteria:**

**Given** a generation run
**When** running `banana gen --move=walk_forward --interactive`
**Then** after generation completes, the system:
  1. Logs "🚀 Launching Director Mode..."
  2. Starts an Express server on port 3000
  3. Logs "👉 Open http://localhost:3000 to review and patch sprites."
  4. Keeps the process alive until Director commits
**And** the browser can be opened manually
**And** after commit, export proceeds automatically
**And** without `--interactive`, export proceeds immediately

---

### Story 8.4: Implement Director Server Bridge

**As an** operator,
**I want** the CLI to serve the Director UI and handle API requests,
**So that** the frontend can communicate with the pipeline backend.

**Acceptance Criteria:**

**Given** `--interactive` mode is enabled
**When** the Director Server starts
**Then** it serves the static React app from `ui/build/`
**And** provides REST API endpoints:
  - `GET /api/session`: Returns current session state (frames, audit reports)
  - `POST /api/patch`: Triggers inpainting, returns patched image
  - `POST /api/commit`: Saves all changes, closes server
  - `GET /api/frame/:id`: Returns specific frame data
**And** the server runs on configurable port (default 3000)
**And** CORS is disabled (local-only usage)

---

### Story 8.5: Implement Pipeline Orchestrator

**As an** operator,
**I want** a central orchestrator managing the generate-audit-align loop,
**So that** the pipeline executes reliably with proper state management.

**Acceptance Criteria:**

**Given** a `banana gen` command is executed
**When** the PipelineOrchestrator runs
**Then** it follows the execution phases:
  1. **INIT**: Load manifest, create lock file, analyze anchor
  2. **GENERATION LOOP**: For each frame:
     - Generate via GeminiGeneratorAdapter
     - Audit via AuditorService
     - Auto-align if HF03 detected
     - Decide: Approve, Retry, or Reject
  3. **DIRECTOR MODE**: If `--interactive`, serve UI and wait
  4. **EXPORT**: TexturePacker + Phaser validation
  5. **COMPLETE**: Write summary, clean up
**And** state is persisted to `state.json` after each phase
**And** the orchestrator can be resumed from any phase

---

### Story 8.6: Implement Graceful Shutdown and Resume

**As an** operator,
**I want** the CLI to handle interruptions gracefully,
**So that** I don't lose work if I need to stop mid-run.

**Acceptance Criteria:**

**Given** a pipeline run is in progress
**When** receiving SIGINT (Ctrl+C) or SIGTERM
**Then** the system:
  1. Logs "Graceful shutdown initiated..."
  2. Completes the current frame (if possible)
  3. Persists all in-progress state
  4. Closes API connections cleanly
  5. Exits with code 0
**And** running `banana gen --move=walk_forward` again:
  1. Detects existing run state
  2. Prompts "Resume from Frame 5? (Y/n)"
  3. Skips already-approved frames
  4. Continues from last checkpoint

---

### Story 8.7: Implement Export Phase Integration

**As an** operator,
**I want** the CLI to automatically run export and validation after approval,
**So that** I get game-ready assets without additional commands.

**Acceptance Criteria:**

**Given** all frames are approved (either via Auditor or Director)
**When** the export phase runs
**Then** the system:
  1. Renames frames to 4-digit padded format
  2. Invokes TexturePacker with locked flags
  3. Runs Phaser micro-tests (TEST-02, TEST-03, TEST-04)
  4. Reports validation results
  5. Marks run as "release-ready" or "validation-failed"
**And** output is placed in `runs/{run_id}/export/`
**And** `--skip-validation` flag bypasses Phaser tests (for speed)
**And** `--allow-validation-fail` allows export despite failures

---

### Story 8.8: Implement Progress Logging and Spinners

**As an** operator,
**I want** clear visual feedback during long-running operations,
**So that** I know the pipeline is working and can estimate completion.

**Acceptance Criteria:**

**Given** a pipeline operation is running
**When** progress updates occur
**Then** the system uses ora spinners for active operations:
  - "✔ Manifest validated"
  - "⠋ Generating Frame 3/8..."
  - "✔ [GEN] Frame 3/8 Generated (Audit Score: 0.95)"
  - "⚠ [WARN] Frame 4/8 Auto-Aligned (Drift: +4px)"
  - "✖ [FAIL] Frame 5/8 Rejected (SF01_IDENTITY_DRIFT)"
**And** completion shows summary:
  - "✔ Batch Generation Complete (7/8 approved, 1 rejected)"
  - "📊 Retry Rate: 12.5%, Reject Rate: 12.5%"
**And** all logs are also written to `runs/{run_id}/logs/pipeline.log`
**And** verbose mode (`-v`) shows additional debug info
