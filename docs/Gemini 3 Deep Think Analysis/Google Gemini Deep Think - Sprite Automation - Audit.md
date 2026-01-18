# **Architecture Audit & Risk Analysis Report**

Project: Sprite-Sheet-Automation-Project\_2026

Role: Principal Software Architect

Date: January 17, 2026

## **1\. Executive Summary**

The proposed architecture is **structurally sound regarding the separation of concerns**, utilizing a Hexagonal Architecture that correctly isolates the volatile AI generation layer from the core orchestration logic. The decision to establish "Engine Truth" (Phaser validation) as the final arbiter of quality is a high-value differentiator that elevates this pipeline above standard image generation scripts.

However, the project faces **two implementation blockers** that threaten the MVP: a technology stack mismatch regarding Python-native metrics (DINO/LPIPS) and the lack of a deterministic **Post-Processing Layer** to handle pixel-perfect alignment. Relying solely on Generative AI to achieve $\\le$1px baseline drift is architecturally optimistic and likely to result in excessive retry loops. Additionally, the linear workflow lacks a feedback mechanism to trigger regeneration upon Phaser validation failure. The MVP is achievable, but only if the scope is adjusted to prioritize deterministic image processing (centering, quantization) over purely generative retry logic.

## **2\. Critical Findings (Top 5\)**

1. 🔴 BLOCKER: Metric Stack Mismatch (Node.js vs. Python)  
   The PRD mandates DINO (SF01) and LPIPS (SF04) metrics. These are deep learning models typically implemented in PyTorch/Python. The Architecture restricts the stack to Node.js/TypeScript. Implementing these in pure Node.js is effectively impossible without heavy bindings or an ONNX runtime, which complicates the "solo dev" constraint.  
   * **Fix:** Downgrade MVP metrics to Node-native equivalents: **Registered SSIM** (Identity) and **Pixelmatch** (Temporal Coherence) via sharp. Defer DINO/LPIPS to v1.  
2. 🔴 CRITICAL: Missing "Post-Processor" Component  
   The Architecture defines Generator \-\> Auditor, assuming the AI will produce perfect baselines via prompting. This is a risk. A 1px vertical shift causes HF03 (Baseline Drift) failure.  
   * **Fix:** Introduce a PostProcessor adapter *between* Generation and Auditing to perform deterministic **Auto-Alignment** (shifting image to baseline) and **Palette Quantization** (snapping pixels to exact hex codes). This turns potential failures into passes without wasting API credits.  
3. 🔴 CRITICAL: Broken Feedback Loop (Validation → Generation)  
   The Architecture places the ValidatorAdapter (Phaser) after the Export step. If TEST-03 (Trim Jitter) fails, the pipeline halts. There is no logic to map a "Jitter Failure" back to "Frame 3 needs regeneration." This turns the automated pipeline into a manual "Run \-\> Fail \-\> Human Fix \-\> Run" loop for the most common failure mode.  
   * **Fix:** For MVP, accept this breakage but implement a diagnostic report that explicitly names the frame causing jitter. For v1, the Validator must run on *unpacked* frames.  
4. 🟡 RISK: "Nano Banana" vs. Gemini API Ambiguity  
   "Nano Banana Pro" is referenced as the backend, but likely represents a consumer feature or extension name. The actual developer implementation must rely on the Vertex AI or Google AI Studio SDKs (@google/generative-ai).  
   * **Fix:** The GeneratorAdapter must be built against the standard Google AI SDKs, treating "Nano Banana" as the conceptual model config, not the package name.  
5. 🟡 RISK: TexturePacker License in CI/Headless  
   The pipeline relies on Pro-only CLI features: \--trim-mode Trim and specifically \--alpha-handling ReduceBorderArtifacts. Without a valid, activated license in the environment, the CLI will output watermarked images or disable alpha algorithms.  
   * **Fix:** pipeline doctor must run a dummy pack operation to verify license activation status.

## **3\. Detailed Analysis**

### **1\. ARCHITECTURE COHERENCE AUDIT**

**Rating: 7/10**

* **Requirements Coverage:** Strong coverage of the generation loop. **Major Gap:** The PRD mentions "Manual Touchup" (FR51, FR52), but the Architecture lacks a PAUSED state or re-ingestion mechanism for modified files in the Orchestrator.  
* **Tech Stack Fit:** Node.js is excellent for CLI/IO, but a poor fit for the Advanced Metrics (DINO/LPIPS) required by the PRD.  
* **Separation of Concerns:** The Hexagonal architecture is perfectly applied. Swapping the Generator backend later is trivial.  
* **Data Flow:** Atomic writes and manifest locking are excellent patterns.

**Identified Gaps:**

* **Orchestrator State:** Lacks an AWAITING\_MANUAL\_FIX state.  
* **Validator Logic:** PRD asks for "Visual Inspection" of jitter. Architecture implies this can be automated but doesn't specify the algorithm (e.g., Variance of Bounding Box Bottom).

### **2\. TECHNICAL RISK ANALYSIS**

| Risk Area | Severity | Likelihood | Mitigation Strategy |
| :---- | :---- | :---- | :---- |
| **A) Gemini API Integration** | High | High | **Anchor-Tethering:** "Edit-from-previous" creates drift accumulation ("telephone game"). Every 3rd frame should be generated via "Edit-from-Anchor" using the target pose to reset identity. |
| **B) Phaser Validation** | Medium | 50% | **Shim Config:** Running Headless Chrome (puppeteer-core) defaults to software rendering (SwiftShader). Validation must check gl.getParameter to ensure it's not a false positive/negative due to rendering differences. |
| **C) Quality Gates** | Critical | 100% | **Auto-Centering:** SSIM is pixel-strict. A 1px offset \= failure. The Auditor must crop and center the sprite on a transparent canvas *before* running SSIM against the anchor. |
| **D) State Management** | Low | Low | **Atomic Writes:** Use write-file-atomic to prevent state.json corruption on Windows during rapid retries. |
| **E) TexturePacker Integration** | High | 20% | **Doctor Check:** Verify TexturePacker \--version output for "Pro" status. Fail fast if features are unavailable. |

### **3\. IMPLEMENTATION BLOCKERS**

**Requirement FR17 & FR19:** "Compute DINO (Identity) and LPIPS (Temporal) metrics."

* **Blocker:** These libraries do not exist natively in Node.js.  
* **Solution:** **Strict Scope Cut.** Downgrade MVP metrics to:  
  1. **Identity:** Registered SSIM (align images by centroid before comparison).  
  2. **Coherence:** Pixel Difference (Delta) between Frame N and Frame N-1.

**Requirement Story 5.7:** "TEST-03: Trim/baseline jitter passes visual inspection."

* **Blocker:** "Visual inspection" cannot be automated in CI.  
* **Solution:** Implement **Bounding Box Variance** metric. In the Phaser Validator, record the sprite.getBounds().bottom for every frame in the animation. If the Standard Deviation \> 0.5px, Fail.

### **4\. MISSING REQUIREMENTS DISCOVERY**

1. **Post-Processing Pipeline:**  
   * *Gap:* Need for deterministic modification (Auto-Center, Quantize Palette) *before* Audit.  
   * *Requirement:* FR\_NEW\_01: System applies deterministic post-processing chain defined in manifest.  
2. **Manual Re-ingestion:**  
   * *Gap:* No command to resume after manual fixes.  
   * *Requirement:* pipeline import \<run\_id\> \--frame \<n\> \--path \<file\> command.  
3. **Cost Circuit Breaker:**  
   * *Gap:* No limit on API spend.  
   * *Requirement:* max\_api\_spend or max\_total\_attempts in Manifest.

### **5\. DEPENDENCY & TOOLING VALIDATION**

* **Oclif 4.x:** 🟢 Valid.  
* **Zod:** 🟢 Essential.  
* **Sharp:** 🟢 **Critical.** Ensure kernel: 'nearest' is used for all resizes to preserve pixel art.  
* **Puppeteer:** 🟡 Use puppeteer (full) over puppeteer-core for MVP to ensure a deterministic, matching Chromium version is available on all dev machines.  
* **Nano Banana Pro:** ❌ **Invalid Name.** Replace with @google/generative-ai SDK.

### **6\. MVP FEASIBILITY ASSESSMENT**

**Verdict:** **Achievable with Scope Cuts.**

* **Critical Path:**  
  * **Spike:** Engine Truth (Phaser+Puppeteer) \- *Must prove pivots work.*  
  * **Core:** Generator Loop \+ Post-Processor (Auto-Aligner).  
  * **Guard:** Hard Gates \+ SSIM.  
  * **Export:** TexturePacker Adapter.  
* **Scope Cuts:**  
  * Drop DINO/LPIPS.  
  * Drop "Multipack" export (unlikely needed for MVP).  
  * Drop complex "Rescue Prompts" in favor of "Auto-Aligner".

### **7\. QUALITY GATE CALIBRATION**

* **SSIM:** $\\ge$ 0.85 is too strict for raw output. **Recommend:** $\\ge$ 0.90 *after* Auto-Centering normalization.  
* **Baseline Drift:** $\\le$ 1px is unrealistic for GenAI. **Recommend:** Relax generation to $\\le$ 3px, then use **Auto-Aligner** to force it to 0px before Audit.  
* **Palette:** $\\ge$ 90%. **Recommend:** 100% via **Quantization**. Don't audit it; enforce it.

### **8\. PROMPT ENGINEERING GAPS**

* **Pixel Grid Alignment:** Prompts typically fail to align to pixel grids.  
  * *Fix:* Generate at **4x resolution** (512x512) and downsample using Nearest Neighbor. This forces crisp lines.  
* **Anatomy Rescue:**  
  * *Fix:* Add explicit "Hands/Feet" check in the prompt if previous attempt failed HF05.

### **9\. OPEN QUESTIONS RESOLUTION**

| Question | Resolution | Tradeoff |
| :---- | :---- | :---- |
| **Pivot Auto-Apply?** | **No / Manual Force.** | Assume Phaser *won't* do it. Inject customPivot logic in the loader. Safer/Deterministic. |
| **Trim vs Full?** | **Trim.** | Saves massive texture space. Solve alignment via the Auto-Aligner (Post-Processor). |
| **Hex Typo?** | **Sample Anchor.** | Do not trust the document hex codes. Build a pipeline analyze-anchor tool to extract the *actual* palette from the Anchor PNG. |

### **10\. IMPLEMENTATION SEQUENCE OPTIMIZATION**

**Sprint 1: The Foundation (Days 1-7)**

1. **Epic 1 (Setup):** CLI Scaffold \+ pipeline doctor (Check TP License\!).  
2. **Epic 1 (Spike):** **Story 1.4 is Priority \#1.** Build the Puppeteer/Phaser harness. Validate pivots.  
3. **Epic 5 (Export):** TexturePacker Adapter.

**Sprint 2: The Loop (Days 8-14)**

1. **Epic 2 (Gen):** Generator Adapter (Google SDK).  
2. **Core:** **Post-Processor** (Auto-Align/Quantize). *New Requirement.*  
3. **Epic 3 (Audit):** SSIM \+ Hard Gates.  
4. **Epic 4 (Orchestrator):** Connect the loop.

---

## **Appendix A: Code Snippets**

### **1\. Auto-Aligner (Post-Processor)**

*Solves the "1px Drift" risk by mathematically forcing alignment.*

TypeScript  
// src/core/processing/AutoAligner.ts  
import sharp from 'sharp';

export async function alignToBaseline(  
  buffer: Buffer,   
  targetBaselineY: number  
): Promise\<Buffer\> {  
  const image \= sharp(buffer);  
  const { data, info } \= await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });  
    
  // Find lowest opaque pixel  
  let bottomY \= \-1;  
  // Scan from bottom up  
  for (let y \= info.height \- 1; y \>= 0; y--) {  
    for (let x \= 0; x \< info.width; x++) {  
      if (data\[(y \* info.width \+ x) \* 4 \+ 3\] \> 0\) { // Alpha \> 0  
        bottomY \= y;  
        break;  
      }  
    }  
    if (bottomY \> \-1) break;  
  }

  const shift \= targetBaselineY \- bottomY;  
  if (shift \=== 0\) return buffer;

  return image  
    .extend({  
      top: shift \> 0 ? shift : 0,  
      bottom: shift \< 0 ? \-shift : 0,  
      background: { r:0, g:0, b:0, alpha:0 }  
    })  
    .extract({ left: 0, top: shift \< 0 ? \-shift : 0, width: info.width, height: info.height })  
    .toBuffer();  
}

### **2\. Robust Engine Truth Validator (Puppeteer \+ Phaser)**

*Avoids log scraping; extracts data directly from the engine runtime to validate Jitter.*

TypeScript  
// src/adapters/phaser/PhaserValidator.ts  
import puppeteer from 'puppeteer';

export async function measureBaselineJitter(atlasPath: string, animKey: string): Promise\<number\> {  
  const browser \= await puppeteer.launch({   
    headless: "new",   
    args: \['--use-gl=swiftshader', '--no-sandbox'\] // Ensure deterministic rendering  
  });  
  const page \= await browser.newPage();  
    
  // Inject Atlas and measure variance of the bounding box bottom  
  const jitter \= await page.evaluate(async (path, key) \=\> {  
    return new Promise\<number\>((resolve) \=\> {  
      // @ts-ignore  
      const game \= new Phaser.Game({  
        type: Phaser.WEBGL,  
        scene: {  
          preload() { this.load.atlas('char', path \+ '.png', path \+ '.json'); },  
          create() {  
            const sprite \= this.add.sprite(0, 0, 'char');  
            const frames \= this.anims.generateFrameNames('char', { prefix: key \+ '/' });  
              
            const bottoms: number\[\] \= \[\];  
            // Step through every frame to find bottom bound  
            frames.forEach(f \=\> {  
              sprite.setFrame(f.frame);  
              // getBounds() accounts for trim and pivot  
              bottoms.push(sprite.getBounds().bottom);  
            });  
              
            // Calculate Standard Deviation  
            const mean \= bottoms.reduce((a,b)=\>a+b)/bottoms.length;  
            const variance \= bottoms.reduce((a,b)=\>a+Math.pow(b-mean, 2), 0)/bottoms.length;  
            resolve(Math.sqrt(variance));  
          }  
        }  
      });  
    });  
  }, atlasPath, animKey);

  await browser.close();  
  return jitter;  
}

## **Appendix B: Recommended Experiments**

1. **The "Pro License" Check:**  
   * Command: TexturePacker \--version  
   * Action: Verify if output indicates "Pro" or "Unregistered". Essential for pipeline doctor.  
2. **The "SwiftShader" Validation:**  
   * Action: In the Puppeteer spike, return gl.getParameter(gl.RENDERER).  
   * Success: If it returns "SwiftShader", verify visually that it matches GPU rendering for TEST-02.  
3. **The "Edit" Capability Spike:**  
   * Action: Create a simple script using @google/generative-ai to upload an image and request an edit. Confirm the model supports this mode; otherwise, the pipeline must rely on "Image-to-Image" (Variation) generation.

## **Appendix C: Resource Links**

* **Puppeteer Hardware Acceleration: [https://pptr.dev/troubleshooting](https://pptr.dev/troubleshooting)**  (Essential for WebGL consistency)  
* **Sharp Documentation:** [https://sharp.pixelplumbing.com/](https://sharp.pixelplumbing.com/) (For trim() and composite() logic)  
* **Google Generative AI SDK:** [https://github.com/googleapis/js-genai.git](https://github.com/googleapis/js-genai.git) (The actual library to use)

