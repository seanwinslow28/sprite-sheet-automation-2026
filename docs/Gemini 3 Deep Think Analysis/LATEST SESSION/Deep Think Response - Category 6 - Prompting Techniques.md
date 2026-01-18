Based on the **Deep Think Architecture Lock (2026-01-18)** and the **Nano Banana Pro Integration Spec**, here is the deep analysis and operational strategy for **Category 6: Prompting Techniques**.

The core architectural paradigm shift is **Semantic Interleaving**. We do not treat the model as a black box; we treat it as a multimodal reasoning engine where images are explicitly labeled variables in a "Hierarchy of Truth."

---

### **Q6.1: Master Prompt Template — Identity Locking**

**Strategy: Semantic Interleaving** Do not rely on the model to "guess" the role of the input image. You must explicitly label the anchor in the API payload (`Part[]` array) to establish it as the immutable **"Identity Truth."**

* **Structure:**  
  1. **Role Definition:** "You are a professional pixel artist..."  
  2. **Visual Context (Labeled):** `[IMAGE 1]: MASTER ANCHOR (IDENTITY TRUTH)`.  
  3. **Command:** Dense natural language instruction focusing on **Identity \> Style \> Pose**.  
* **Optimal Length:** **40–60 words**. Nano Banana Pro (Gemini 3\) is a "Thinking" model; it performs better with "Director's Commentary" (intent \+ physics) than comma-separated tags.

**Template Construction (TypeScript):**

TypeScript  
function buildMasterPrompt(ctx: GenerationContext): Part\[\] {  
  return \[  
    { text: "ROLE: You are a lead pixel artist for a high-fidelity 16-bit fighting game." },  
      
    // 1\. The Anchor is the immutable source of truth  
    { text: "\[IMAGE 1\]: MASTER ANCHOR (IDENTITY TRUTH)\\nStrictly adhere to this character's facial features, palette, muscle definition, and outfit details." },  
    { inlineData: { mimeType: "image/png", data: ctx.anchorBase64 } },  
      
    // 2\. Command  
    { text: \`  
      TASK: Generate Frame 0 of '${ctx.moveId}'.  
      STYLE: Street Fighter II arcade style. Bold \#272929 outlines. No anti-aliasing. No gradients.  
      POSE: ${ctx.poseDescription}  
    \`}  
  \];  
}

---

### **Q6.2: Variation Prompt Template — Temporal Flow**

**Strategy: The "Reference Sandwich"** To prevent "frame drift" (telephone game effect), use a sandwich pattern: `[Identity Truth]` \+ `[Pose Reference]` \+ `[Command]`.

* **Temporal Flow:** Pass the previous frame as `[IMAGE 2]: PREVIOUS FRAME (POSE REFERENCE)`.  
* **Hierarchy Rule:** You must explicitly state: **"HIERARCHY: If \[IMAGE 2\] conflicts with \[IMAGE 1\] regarding identity, \[IMAGE 1\] takes priority."**  
* **Delta Description:** Describe the *change* (delta) rather than the static state. "Leg extends fully" gives the model a motion vector.

**Operational Logic:**

* **Input:** Anchor \+ Previous Frame.  
* **Condition:** Only include Previous Frame if its audit score (`SF01`) was ≥ 0.9.

---

### **Q6.3: Lock/Recovery Prompt Template — Drift Rescue**

**Strategy: Circuit Breaker (Poison Control)** When the Auditor triggers `SF01_IDENTITY_DRIFT` (\< 0.9), the previous frame is considered "poisoned."

* **Action:** **Drop \[IMAGE 2\] entirely.** Do not show the model the drifted frame.  
* **Structure:** Revert to the **Master Template** structure (Anchor Only).  
* **Instruction:** Add a "RESET" command: *"CRITICAL: Previous output drifted. RESET identity to match \[IMAGE 1\] pixel-perfectly."*  
* **Risk:** This causes a temporal "pop," but the **Contact Patch Alignment** post-processor (defined in Architecture) mechanically fixes the position, making the pop acceptable compared to identity morphing.

---

### **Q6.4: Negative Prompt — What to Avoid**

**Strategy: Technical Exclusion** Since the architecture mandates generating at **512px (4x)** and downsampling to 128px, the negative prompt must target "modern" rendering artifacts that ruin the downsample.

**Universal Negative Block (Append to all prompts):**

**AVOID:** Anti-aliasing, semi-transparent pixels, soft gradients, blur, bokeh, 3D render, vector art, text, UI elements, cropped limbs, cut-off head, dithering, noise, photographic texture.

* **Character-Specific:** Inject these from the manifest (e.g., "Avoid: long hair" for Sean).

---

### **Q6.5: Pose Description Granularity**

**Strategy: Mid-Level Intent** Nano Banana Pro fails with low-level coordinates ("hand at x:45") because it doesn't "see" the pixel grid. It excels at **intent-based physics**.

* **Optimal:** "Athletic crouching guard. Weight on back leg, ready to spring forward. Fists protecting the chin." (Model solves the anatomy).  
* **Avoid:** "Left foot 2px behind left." (Model ignores this).

---

### **Q6.6: Guide Overlay Injection**

**Strategy: Deprioritize for MVP** **Do not** composite grid lines onto the anchor.

* **Reasoning:** Models often "hallucinate" grid lines into the clothing patterns.  
* **Solution:** Rely on the **AutoAligner** (Contact Patch Alignment) component defined in `src/core/processing/`. It mechanically centers the sprite based on the "root zone" (feet centroid), which is more deterministic than prompt-based aiming.  
* **Fallback:** Only inject `guide_128.png` as `[IMAGE 3]` if `HF03` (Baseline Drift) persists after mechanical alignment.

---

### **Operational Implementation**

Below is the production-ready code for `src/adapters/generator/GeminiGeneratorAdapter.ts`, implementing the **Semantic Interleaving** pattern.

TypeScript  
import { GoogleGenerativeAI, Part } from '@google/generative-ai';  
import { GeneratorAdapter, GenerationContext, GeneratedFrame } from '../../domain/interfaces';  
import { Result } from '../../core/result';  
import { SystemError } from '../../core/errors';  
import { logger } from '../../utils/logger';

export class GeminiGeneratorAdapter implements GeneratorAdapter {  
  private static readonly MODEL\_ID \= 'gemini-3-pro-image-preview';

  constructor(private apiKey: string) {}

  async generate(ctx: GenerationContext): Promise\<Result\<GeneratedFrame, SystemError\>\> {  
    try {  
      const genAI \= new GoogleGenerativeAI(this.apiKey);  
      const model \= genAI.getGenerativeModel({  
        model: GeminiGeneratorAdapter.MODEL\_ID,  
        // System instruction sets global technical constraints  
        systemInstruction: \`You are a professional pixel art generator.   
        Output strictly at ${ctx.generationSize}x${ctx.generationSize}px resolution.   
        Style: Street Fighter II arcade aesthetic. Bold \#272929 outlines. No anti-aliasing.\`,  
      });

      // \--- SEMANTIC INTERLEAVING CONSTRUCTION \---  
      const parts: Part\[\] \= \[\];

      // 1\. IDENTITY TRUTH (Always present)  
      parts.push({ text: \`\[IMAGE 1\]: MASTER ANCHOR (IDENTITY TRUTH)\\nStrictly adhere to this character's facial features, palette, and proportions.\` });  
      parts.push({  
        inlineData: { mimeType: 'image/png', data: ctx.anchorBase64 }  
      });

      // 2\. TEMPORAL FLOW (Optional \- skipped if SF01 \< 0.9 or First Frame)  
      if (ctx.strategy \=== 'VARIATION' && ctx.prevFrameBase64) {  
        parts.push({ text: \`\[IMAGE 2\]: PREVIOUS FRAME (POSE REFERENCE)\\nUse this image to determine the starting position and motion flow.\` });  
        parts.push({  
          inlineData: { mimeType: 'image/png', data: ctx.prevFrameBase64 }  
        });  
          
        // HIERARCHY RULE: Critical for preventing drift  
        parts.push({ text: \`HIERARCHY: If \[IMAGE 2\] conflicts with \[IMAGE 1\] regarding identity details, \[IMAGE 1\] takes priority. Use \[IMAGE 2\] only for pose continuity.\` });  
      }

      // 3\. STRUCTURAL GUIDE (Optional \- Fallback only)  
      if (ctx.guideBase64) {  
        parts.push({ text: \`\[IMAGE 3\]: LAYOUT GUIDE\\nAlign the character's feet to the baseline shown in this image.\` });  
        parts.push({  
          inlineData: { mimeType: 'image/png', data: ctx.guideBase64 }  
        });  
      }

      // 4\. COMMAND & NEGATIVE PROMPT  
      const negativeBlock \= \`AVOID: Anti-aliasing, semi-transparent pixels, blur, bokeh, 3D render, vector art, gradient mesh, noise, text, watermark, cropped limbs.\`;  
      parts.push({ text: \`COMMAND: ${ctx.prompt}\\n${negativeBlock}\` });

      // \--- EXECUTION \---  
      logger.info({ msg: 'Generating Frame', runId: ctx.runId, strategy: ctx.strategy, parts: parts.length });

      const response \= await model.generateContent({  
        contents: \[{ role: 'user', parts }\],  
        generationConfig: {  
          temperature: 0.7,   
          seed: this.calculateSeed(ctx), // Determinism hook  
          maxOutputTokens: 2048,  
        }  
      });

      // \--- OUTPUT HANDLING \---  
      const candidate \= response.response.candidates?.\[0\];  
      if (\!candidate) return Result.err(new SystemError('DEP\_API\_EMPTY', 'No candidates returned'));

      const imagePart \= candidate.content.parts.find(p \=\> p.inlineData);  
        
      if (\!imagePart || \!imagePart.inlineData) {  
        const text \= candidate.content.parts.map(p \=\> p.text).join('');  
        return Result.err(new SystemError('DEP\_API\_REFUSAL', \`Model refused to generate image: ${text.slice(0, 100)}\`));  
      }

      return Result.ok({  
        data: Buffer.from(imagePart.inlineData.data, 'base64'),  
        mimeType: 'image/png',  
        metadata: {  
          model: GeminiGeneratorAdapter.MODEL\_ID,  
          timestamp: new Date().toISOString(),  
          seedUsed: this.calculateSeed(ctx)  
        }  
      });

    } catch (err: any) {  
      return Result.err(new SystemError('DEP\_GEMINI\_FAIL', err.message));  
    }  
  }

  private calculateSeed(ctx: GenerationContext): number | undefined {  
    // Deterministic seed for Attempt 1, Random for Retries  
    if (ctx.attemptIndex \=== 1\) {  
      let hash \= 0;  
      const str \= \`${ctx.runId}-${ctx.frameIndex}\`;  
      for (let i \= 0; i \< str.length; i++) {  
        hash \= ((hash \<\< 5\) \- hash) \+ str.charCodeAt(i);  
        hash |= 0;  
      }  
      return Math.abs(hash);  
    }  
    return undefined;  
  }  
}  
