This "Deep Think" response analyzes the open questions from **Session C**, resolving ambiguities by cross-referencing your **Architecture**, **PRD**, **Epics**, and **Compliance Kit**.

---

# **Category 4: Retry Ladder & Orchestration**

### **Q4.1: Engine Validation Failure — Retry or Terminal?**

**Decision: Terminal Hard Block (Manual Intervention Required)**

If a frame passes audit (visual metrics) but fails engine validation (Phaser micro-tests), relying on the retry ladder is inefficient. Engine failures (e.g., pivot misalignment, suffix errors) are typically **deterministic configuration errors**, not stochastic generation noise. Rerolling the seed won't fix a bad pivot setting.

* **Status:** **Terminal Hard Fail** for the current batch.  
* **Reason Code:** `HF_ENGINE_FAIL` (New code).  
* **Action:**  
  1. **Halt Export:** Do not promote to "Release-Ready".  
  2. **Diagnostic:** Log the specific Phaser error (e.g., "TEST-03 Failed: Jitter \> 1px").  
  3. **Recovery:** Operator must adjust `manifest.yaml` (e.g., stricter alpha threshold or explicit pivot offsets) and re-run `pipeline export`.  
* **Exception:** **TEST-03 (Trim Jitter)**. If jitter is caused by "pixel noise" at the feet (stray pixels changing the bounding box), this *is* a generation artifact. In this specific case, trigger **Strategy: Post-Process** (Alpha Cleanup) once. If it fails again → Terminal.

### **Q4.2: Retry Ladder Exhausted — What Reason Code?**

**Decision: `HF_MAX_ATTEMPTS` (Counts as Rejection)**

When the ladder is exhausted, the system must definitively classify the frame to calculate the `reject_rate` stop condition.

* **Formal Code:** `HF_MAX_ATTEMPTS`  
* **Rejection Logic:** This frame is moved to `runs/{id}/rejected/`.  
* **Metric Impact:** Increments `frames_failed` count. Used immediately to calculate `reject_rate` (See Q4.5).  
* **Diagnostic Report:** The report should list the *chain* of failures that led here (e.g., "3x SF01 Identity Drift → 1x HF03 Baseline Drift → Exhausted").

### **Q4.3: Drift Recovery — Anchor-Only Regeneration**

**Decision: Increment Attempt Count, Use Lock Template**

Recovering from drift is an active "repair" attempt, consuming API resources and time.

* **Attempt Logic:** Yes, this is a new attempt. Increment `attempt_count` (e.g., Attempt 3).  
* **Template:** Use **Lock/Recovery Prompt** (`generator.prompts.lock`). This template specifically reinforces identity traits.  
* **Oscillation Prevention:**  
  * **Rule:** If a frame triggers "Re-anchor" strategy twice (e.g., Frame N drifts, we re-anchor, Frame N drifts again), immediately escalate to `HF_IDENTITY_COLLAPSE`.  
  * **Logic:** A frame that cannot sustain identity even when re-anchored is likely fundamentally flawed (bad pose spec or model limitation).

### **Q4.4: State Machine Transition Gaps**

**Decision: Explicit `ERROR_SYSTEM` and `PAUSED` States**

The state machine needs definitive "catch-all" buckets for infrastructure failures versus domain failures.

* **`VALIDATING_PENDING`:** New state. Used when Audit passes, but async Engine Validation (Phaser) is running (if we parallelize later). For MVP, this is part of `EXPORTING`.  
* **`ERROR_SYSTEM`:** Handles crashes, disk full, or API outages (distinct from `FAILED` which is a quality failure). Recoverable via `pipeline resume`.  
* **`STOPPED`:** Explicit state for "Stop Condition Met" (e.g., reject rate too high). Distinct from `COMPLETED` (success) or `FAILED` (crash).  
* **Transition Logic:**  
  * `RETRY_DECIDING` → (ladder exhausted) → `REJECTING` → `NEXT_FRAME`  
  * `APPROVING` → (disk write fail) → `ERROR_SYSTEM`

### **Q4.5: Stop Condition Calculation Timing**

**Decision: Evaluate After Every Finalized Frame**

Waiting for the end of a run defeats the purpose of a "circuit breaker."

* **Timing:** Calculate immediately after a frame transitions to `APPROVED` or `REJECTED`.  
* **Denominator:** `Total Frames Attempted So Far` (not total in manifest).  
  * *Example:* If Frame 1 fails (1 reject) and Frame 2 passes (1 approve), Reject Rate \= 50%.  
  * *Threshold:* `max_reject_rate: 0.3` triggers immediately.  
* **Context:** This prevents burning API credits on a 100-frame run if the first 10 frames are garbage.

---

# **Category 5: Export & Phaser Validation**

### **Q5.1: Pivot/Origin Behavior**

**Decision: Bottom-Center Default \+ Companion Config Override**

Phaser's auto-loading of pivots from JSON Hash is reliable *if* the data exists, but "magical." Explicit control is better for production pipelines.

* **Primary Strategy:** Default all sprites to **Bottom-Center (0.5, 1.0)** via `manifest.yaml` global config.  
* **Override:** Generate `pivots.json` companion file only if specific frames need offset pivots (rare for standard fighting moves).  
* **Validation:** TEST-02 will confirm the sprite's *visual feet position* matches the expected coordinate (128, 128).

### **Q5.2: TEST-02 Pivot Auto-Apply — Exact Validation Logic**

**Decision: Visual Bounding Box Check**

Don't just check the `sprite.pivot` property (which tests the loader, not the visual result). Test the *rendering*.

* **Logic:**  
  1. Place Anchor Sprite at `(x:100, y:100)`.  
  2. Place Exported Frame at `(x:100, y:100)`.  
  3. **Assertion:** The bottom-most opaque pixel of the Exported Frame must match the Y-coordinate of the Anchor's bottom-most pixel (within 1px tolerance).  
  4. *Why:* This validates that `Contact Patch Alignment` (Story 2.9) \+ `TexturePacker Trim` \+ `Phaser Pivot` all worked together to keep the feet planted.

### **Q5.3: TEST-03 Trim Mode Jitter — Detection Method**

**Decision: Headless Bounds Comparison**

Screen capture analysis is slow and flaky. Use Phaser's internal geometry.

* **Method:**  
  1. Load all frames of the animation.  
  2. For each frame, read `sprite.getBottomCenter()`.  
  3. **Assertion:** The Y value of `getBottomCenter()` must be constant across *all* frames in a "grounded" sequence (Idle, Walk).  
  4. **Tolerance:** `<= 1px`. Any variance \> 1px is a fail.

### **Q5.4: TEST-04 Suffix Convention — Frame Key Resolution**

**Decision: Validate `texture.getFrameNames()`**

* **Validation:**  
  1. Load Atlas.  
  2. Call `this.textures.get('char_move').getFrameNames()`.  
  3. **Assertion:**  
     * Keys MUST match regex: `^{move}/\d{4}$` (e.g., `idle/0001`).  
     * Keys MUST NOT end in `.png`.  
     * Count must match manifest `frame_count`.

### **Q5.5: Multipack Frame Key Continuity**

**Decision: Unified JSON / Transparent Loading**

* **Format:** Phaser 3 `multiatlas`.  
* **File Structure:**  
  * `atlas.json` (The entry point)  
  * `atlas1.png`, `atlas2.png`, ... (Textures)  
* **Behavior:** Phaser loads `atlas.json` and automatically fetches the required PNGs.  
* **Frame Keys:** Keys are global. `idle/0001` might be on `atlas1.png` and `idle/0020` on `atlas2.png`. Phaser handles this transparently.  
* **Pipeline Action:** Ensure `TexturePacker` is set to `--multipack` and the output JSON is verified to contain the `related_multi_packs` or `textures` array.

---

# **Category 7: Infrastructure & Tooling**

### **Q7.1: Puppeteer \+ Phaser Headless — WebGL Context**

**Decision: SwiftShader (Software Rasterizer)**

Relying on hardware GPU in CI/Headless environments is flaky.

* **Flag:** `--use-gl=swiftshader`  
* **Rationale:** Provides a deterministic, fully compliant WebGL context via CPU. Slower than GPU, but consistent and crash-resistant for 2D sprite validation.  
* **Backup:** `--use-gl=egl` if performance is unacceptably slow (unlikely for micro-tests).

### **Q7.2: TexturePacker License Validation**

**Decision: Trial Watermark Detection**

CLI flags alone often don't fail for license issues; they just add watermarks or restricted features.

* **Detection:** Run a small "doctor" export.  
* **Check:**  
  1. `stderr` for strings like "trial", "expired", "activate".  
  2. **Crucial:** Check the *output PNG* (using Sharp) for "TexturePacker" text watermark pixels (or hashing the output against a known clean output).  
  3. *Simplest MVP:* `grep` the stderr/stdout for "Trial".

### **Q7.3: Sharp Performance Optimization**

**Decision: Sequential Processing (No Parallelism inside Frame Loop)**

* **Strategy:** Do *not* use heavy parallelism for the core loop. The bottleneck is the Gemini API (seconds), not Sharp (milliseconds).  
* **Optimization:** Use `sharp.cache(false)` to prevent memory leaks during batch runs.  
* **Memory:** At 512px, Sharp uses negligible RAM. No pre-allocation needed.

### **Q7.4: Atomic File Writes — Windows Compatibility**

**Decision: `write-file-atomic` Package**

Do not reinvent the wheel. Windows file locking is notoriously difficult to handle with raw `fs`.

* **Library:** Use `write-file-atomic` (standard Node ecosystem tool).  
* **Pattern:** It handles the `temp file -> flush -> rename` dance and retry logic for Windows EPERM errors automatically.

---

# **Category 8: Sprint Planning & Story Dependencies**

### **Q8.1: Epic 2 Story Reordering**

**Decision: CONFIRMED**

The proposed order is correct. You cannot generate aligned frames (Story 2.9) without knowing the Anchor's baseline (Story 2.7).

1. **Story 2.7 (Anchor Analysis):** *Critical Prerequisite.*  
2. **Story 2.8 (4x Strategy):** Define the canvas buffer logic.  
3. **Story 2.3 (Generator Adapter):** Now can use the data from 2.7 and 2.8.

### **Q8.2: Parallel Work Streams**

**Decision: Epic 5 (Validation) is Decoupled**

* **Parallel Track:** Epic 5 (TexturePacker \+ Phaser) can be built completely in parallel with Epic 2 (Generation).  
* **How:** Create "dummy" approved frames (placeholders) in the `approved/` folder. The Packer/Validator adapters don't care *how* the frames were generated, only that files exist.  
* **Critical Path:** Epic 2 \-\> Epic 3 \-\> Epic 4 is the sequential core.

### **Q8.3: Spike vs. Story Distinction**

**Decision: Prototype Adapter Pattern**

* **Strategy:** Write the "Spike" code (Story 1.4) inside `src/adapters/validator/spike.ts`.  
* **Conversion:** If it works, refactor it into `PhaserValidator.ts`. Do not write "throwaway script files" in the root. Keep it inside the architecture structure so it evolves into production code.

---

