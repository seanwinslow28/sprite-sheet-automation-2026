---
project_name: 'Sprite-Sheet-Automation-Project_2026'
user_name: 'Sean'
date: '2026-01-17'
sections_completed:
  - technology_stack
  - critical_rules
  - naming_conventions
  - code_organization
  - architecture_patterns
  - config_artifacts
  - subprocess_rules
  - determinism_guardrails
  - testing_quality
status: 'complete'
rule_count: 42
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

- **Runtime:** Node.js (LTS)
- **Language:** TypeScript 5+ (Strict Mode)
- **CLI Framework:** Oclif 4.x
- **Validation:** Zod
- **Logging:** Pino (JSON-first, structured)
- **Subprocess Execution:** Execa
- **Testing:** Mocha/Chai (Oclif standard)
- **External Tools:** `@google/generative-ai` SDK (Gemini), TexturePacker CLI, Phaser (Headless via Puppeteer)

## Critical Implementation Rules

### Naming Conventions

- **CLI Commands:** `pipeline:run`, `pipeline:doctor` (Oclif convention).
- **Files:** `kebab-case.ts`.
- **Internal TypeScript:** `camelCase` for code, variables, types.
- **External Artifacts (Manifests/Logs):** `snake_case` (Zod schemas handle transformation at boundaries).
- **Reason Codes:** Strictly `HFxx` (Hard Fail) / `SFxx` (Soft Fail).
- **System Errors:** `SYS_xx` / `DEP_xx`.

### Code Organization

- **Source Root:** `src/`
- **Commands:** `src/commands/` (CLI entry points only; minimal logic).
- **Core Logic:** `src/core/` (Orchestrator, RetryManager, StateManager).
- **Adapters:** `src/adapters/` (External tool wrappers).
- **Domain:** `src/domain/` (Interfaces, Types, Schemas, Reason Codes).
- **Utils:** `src/utils/` (Logger, FS helpers).
- **Tests:** `test/` (Mirrors `src/` structure).
- **Prompts:** `assets/prompts/` (Versioned files; never inline in code).

### Architecture Patterns

- **Adapter Pattern:** All external tools are wrapped in `src/adapters/` implementing strictly typed interfaces from `src/domain/interfaces.ts`. Methods accept a single `Context` object.
- **Atomic State:** `StateManager` writes `state.json` via `writeJsonAtomic` (temp-then-rename) after **every** task completion. Never use `fs.writeFileSync` for state.
- **Result Type:** All adapters return `Promise<Result<T, SystemError>>` (typed wrapper). Use `Result.ok(value)` or `Result.err(error)`.
- **Task Queue:** `Orchestrator` uses a single-threaded FIFO queue for MVP determinism.

### Post-Processor Patterns (Deep Think Lock 2026-01-18)

- **Semantic Interleaving:** Generator constructs `Part[]` array with text labels before each image:
  - `[IMAGE 1]: MASTER ANCHOR (IDENTITY TRUTH)` + anchor image
  - `[IMAGE 2]: PREVIOUS FRAME (POSE REFERENCE)` + prevFrame (if SF01 ≥ 0.9)
  - `HIERARCHY: If [IMAGE 2] conflicts with [IMAGE 1], [IMAGE 1] wins.`
- **Contact Patch Alignment:** Align to feet centroid, NOT geometric center. Calculate root zone as bottom 15% of **visible bounding box height** (not canvas).
- **4x Resolution Strategy:** Generate at 512px, downsample to 128px with nearest-neighbor. This de-noises anti-aliasing.
- **Safety Valve:** Clamp `shiftX` to ±32px. Log warning if triggered—indicates corrupted frame.
- **Drift Recovery:** If previous frame's SF01 < 0.9, exclude it from reference stack. Regenerate from Anchor-only.

### Configuration & Artifacts

- **Config Precedence:** Manifest > Defaults > .env (Secrets/Paths only).
- **Resolved Manifest:** Always write `runs/<run_id>/manifest.lock.json` (snake_case) at run start containing the fully resolved configuration.
- **Artifact Contract:**
  - `runs/<run_id>/manifest.lock.json`
  - `runs/<run_id>/state.json` (snake_case properties)
  - `runs/<run_id>/anchor_analysis.json` (baselineY, rootX extracted from anchor)
  - `runs/<run_id>/audit/audit_log.jsonl`
  - `runs/<run_id>/audit/run_summary.json`
  - `runs/<run_id>/artifacts/frame_###/candidates/attempt_##/*`
  - `runs/<run_id>/export/atlas.png` + `atlas.json`
  - `runs/<run_id>/validation/results.json`

### Canvas Configuration Schema (Deep Think Lock)

```yaml
canvas:
  generation_size: 512      # AI generates at this resolution
  target_size: 128          # Final output resolution (128 for champions, 256 for bosses)
  downsample_method: nearest
  alignment:
    method: contact_patch   # contact_patch | center | none
    vertical_lock: true     # Snap to anchor baseline
    root_zone_ratio: 0.15   # 15% of visible height for root detection
    max_shift_x: 32         # Safety valve clamp in pixels
```

### Component Logic & Schemas

#### RetryManager Logic
**Responsibility:** Stateful execution of the PRD Retry Ladder.
**Logic Flow:**
1.  **Input:** `AuditResult` (contains `HFxx`/`SFxx` codes).
2.  **State Check:** specific `frame_index` attempt history from `state.json`.
3.  **Decision Tree:**
    *   IF `HFxx` (Hard Fail) -> Immediate REJECT (unless generic error, then retry 1x).
    *   IF `SFxx` (Soft Fail):
        *   Attempt 1 -> Strategy: `EDIT_FROM_ANCHOR` (default)
        *   Attempt 2 -> Strategy: `RE_ANCHOR` (use original anchor)
        *   Attempt 3 -> Strategy: `TIGHTEN_PROMPT` (append strict guidelines)
        *   Attempt 4 -> STOP (Reason: "Ladder Exhausted")
4.  **Persistence:** specific strategy used must be logged to `state.json` to resume correctly.

#### Artifact: manifest.lock.json
**Purpose:** Deterministic record of the run configuration.
**Schema:**
```json
{
  "run_id": "timestamp_uuid",
  "environment": {
    "node_version": "v22.x",
    "os": "win32",
    "gemini_cli_version": "1.2.0"
  },
  "resolved_config": {
    // All paths resolved to absolute
    // All defaults expanded
    // Secrets REDACTED
  }
}
```

#### Phaser Integration
**Decision:** Use Puppeteer Core to launch a headless Chrome instance serving a local static page. This page loads Phaser and the generated Atlas, runs the TEST-02 pivot logic in actual WebGL context, and communicates results back to CLI via `console.log` JSON parsing.

### Subprocess Execution Rules

- **Library:** Use `execa` (cross-platform safety).
- **Arguments:** Always pass args as an array, never as a shell string (e.g., `['build', '--flag']` not `'build --flag'`).
- **IO Handling:** Capture stdout/stderr to files under the run folder for debugging.
- **Error Mapping:** Map process failures/timeouts to specific `DEP_xx` or `SYS_xx` codes; never expose raw exceptions to the user.
- **Path Handling:** Always use `path.join()`. Never assume forward/backward slashes.

### Determinism Guardrails

- **Sorting:** Always `sort()` filesystem lists (frames, manifests) before iterating. Never rely on OS directory order.
- **Traceability:** Record tool versions (Node, Gemini CLI, TP) at run start in `manifest.lock.json`.
- **Expectations:** Do not assert pixel equality (stochastic). Assert traceability (logs/seeds) and outcome consistency (passing gates).

### Testing & Quality

- **Unit Tests:** Mock adapters using dependency injection.
- **Strict Types:** No `any`. Zod schemas in `src/domain/schemas/` are the ONLY source of truth for external data shapes.
- **Linting:** Follow ESLint/Prettier configuration strictly. No unused vars. Prefer `async/await`. No sync FS operations in the core pipeline.

### Anti-Patterns (NEVER DO)

- **Swallowing Errors:** Never catch an error without mapping it to a `SystemError` code and returning it via `Result.err`.
- **Direct FS Writes:** Never write to `state.json` or `manifest.lock.json` without the atomic-write utility.
- **Positional Params:** Never use more than 2 positional parameters for adapter methods; use a `Context` object.
- **Free-form Codes:** Never invent new reason codes outside the `HFxx/SFxx` taxonomy.
- **Geometric Centering for Animation:** Never align sprites by bounding box center—causes "moonwalking" on attacks. Use Contact Patch (feet) alignment.
- **Fixed Canvas Percentage:** Never calculate root zone as percentage of canvas height. Use percentage of **visible bounding box height**.
- **Poisoning Reference Stack:** Never include a drifted frame (SF01 < 0.9) in the reference stack for the next frame.
- **Cubic Interpolation:** Never use cubic/bilinear for pixel art downsampling. Always use nearest-neighbor.

---

## Usage Guidelines

**For AI Agents:**

- Read this file before implementing any code
- Follow ALL rules exactly as documented
- When in doubt, prefer the more restrictive option
- Update this file if new patterns emerge

**For Humans:**

- Keep this file lean and focused on agent needs
- Update when technology stack changes
- Review quarterly for outdated rules
- Remove rules that become obvious over time

Last Updated: 2026-01-18

---

## Deep Think Architecture Lock Summary

The following decisions were locked after three rounds of Gemini 3 Deep Think analysis (2026-01-18):

| Component | Decision | Rationale |
|-----------|----------|-----------|
| **Generator SDK** | `@google/generative-ai` | Confirmed SDK name (not "Nano Banana Pro" package) |
| **Prompt Pattern** | Semantic Interleaving | No explicit image weights in SDK; use text role labels |
| **Reference Stack** | `[Anchor, PrevFrame]` | Identity + Flow; drop PrevFrame if SF01 < 0.9 |
| **Resolution** | 4x generation (512→128) | Nearest-neighbor downsample de-noises anti-aliasing |
| **Alignment** | Contact Patch (feet centroid) | Prevents "moonwalking" on attack animations |
| **Root Zone** | 15% of visible height | Scales with character, not canvas |
| **Safety Valve** | max_shift_x: 32px | Prevents alignment glitches from pushing off-screen |
| **Seed Policy** | Fixed then random | `baseSeed + frameIndex` for attempt 1; random for retries |
| **Circuit Breaker** | 50 attempts max | ~$0.20 risk per run |
| **Chroma Key** | Dynamic auto-detection | Analyze anchor palette → pick non-conflicting color |
| **MVP Metrics** | SSIM + Pixel Diff | DINO/LPIPS deferred to v1+ (require Python) |

**Source Documents:**
- `docs/Gemini 3 Deep Think Analysis/Google Gemini Deep Think - Sprite Automation - Audit.md`
- `docs/Gemini 3 Deep Think Analysis/Gemini 3 Pro Deep Think — Follow-Up Analysis Report.md`
- `docs/Gemini 3 Deep Think Analysis/Gemini 3 Pro Deep Think — Final Follow-Up Analysis Report (Round 3).md`