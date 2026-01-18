Based on the **Deep Think Architecture Lock (2026-01-18)** and the **Project Context**, here are the definitive implementation decisions for your pipeline.

The core architectural shift is that we are adopting a **Stateless "Reference Sandwich"** pattern for the MVP. We rely on the *visual data* of the previous frame (Image 2\) to maintain flow, rather than the model's internal hidden state (Thought Signatures). This maximizes deterministic behavior and simpler resume-from-crash capabilities.

---

### **Category 1: Generator Adapter & Gemini API Integration**

#### **Q1.1: Thought Signature Persistence (CRITICAL)**

**Decision:** **Persist for Traceability, but operate Statelessly for MVP.**

* **Mechanism:** You will **not** pass the thoughtSignature from Frame $N-1$ into the request for Frame $N$. Instead, you will pass the **image binary** of Frame $N-1$ as a reference.  
* **Gap Resolution:** The "Edit-from-previous-frame" chaining described in Story 2.3 is implemented via **Visual Reference Chaining** (uploading the image), not **Latent State Chaining** (passing the token).  
* **Traceability (NFR13):** You **must still extract and log** the thoughtSignature (or thought\_signature) from the API response metadata into your audit\_log.jsonl. This is required to future-proof the data for a potential v2 migration to the Direct Edit API, which requires these tokens.  
* **Error Handling:** Since the requests are stateless, a lost signature is irrelevant to the immediate generation. If the API returns a 400, it is due to prompt/image safety validation, not missing history.

#### **Q1.2: Part**

Array Structure (Semantic Interleaving)

**Decision:** **Option A (Text Labels Precede Images).**

The "Reference Sandwich" pattern works by establishing the *semantic role* of an image before the model processes the pixels.

**Exact Part\[\] JSON Structure:**

JSON  
\[  
  { "text": "SYSTEM: You are a professional pixel artist. Maintain exact consistency." },  
    
  { "text": "\[IMAGE 1\]: MASTER ANCHOR (IDENTITY TRUTH). You must maintain the character identity, proportions, and palette from this image exactly." },  
  { "inlineData": { "mimeType": "image/png", "data": "\<ANCHOR\_BASE64\>" } },  
    
  { "text": "\[IMAGE 2\]: PREVIOUS FRAME (POSE REFERENCE). Use this image for the starting pose and temporal flow only. Ignore details if they conflict with \[IMAGE 1\]." },  
  { "inlineData": { "mimeType": "image/png", "data": "\<PREV\_FRAME\_BASE64\>" } },  
    
  { "text": "HIERARCHY: If \[IMAGE 2\] conflicts with \[IMAGE 1\], \[IMAGE 1\] wins.\\nCOMMAND: Generate the next animation frame where..." }  
\]

*Note: If SF01 (Identity Score) drops below 0.9, the \[IMAGE 2\] block is omitted entirely to "reset" the chain.*

#### **Q1.3: Reference Image Limit Discrepancy**

**Decision:** **Strict Limit: 2 Images (\[Anchor, PrevFrame\]).**

* **Rationale:** Adding images 3-14 ("Reference Soup") dilutes the model's attention, leading to "identity hallucination."  
* **Use Cases for Images 3-14 (Future/Retry Only):**  
  * **Slot 3:** guide\_overlay.png (Grid/Baseline) — Only used in **Retry Level 3 (Pose Rescue)**.  
  * **Slot 4:** style\_palette.png — Reserved for v1+ if palette drift persists.

#### **Q1.4: Temperature Parameter Enforcement**

**Decision:** **Lock to 1.0.**

The Zod manifest schema must **strictly enforce** temperature: 1.0 (or null to use default). Lowering temperature (e.g., 0.7) on "Thinking" image models causes mode collapse, resulting in "fried" pixels or identical frames.

#### **Q1.5: Seed Policy Implementation**

**Decision:** **Fixed-then-Random Strategy.**

Implement this logic in the Adapter construction:

* **Attempt 1:** seed \= CRC32(RunID \+ FrameIndex). This ensures that re-running the manifest produces the exact same initial draft.  
* **Attempt \>1 (Retry):** seed \= Random Integer. We need entropy to escape the failure mode (e.g., to fix an artifact).  
* **Logging:** Log the *sent* seed in audit\_log.jsonl for traceability.

#### **Q1.6: API Error Handling**

**Decision:** **Map HTTP Codes to Pipeline Actions.**

| HTTP Code | Error Type | Pipeline Action | Backoff |
| :---- | :---- | :---- | :---- |
| **429** | Rate Limit | **Wait & Retry** | Exponential (1s, 2s, 4s...) Max 5\. |
| **503** | Overloaded | **Wait & Retry** | Exponential (Start 5s). |
| **400** | Invalid | **Fail Fast** | Stop Frame. (Config/Prompt/Image issue). |
| **Blocked** | Safety | **Fail Frame** | Treat as Hard Fail (HF). Do not retry prompt. |

---

### **Category 6: Prompting Techniques**

#### **Q6.1: Master Prompt Template (Identity Locking)**

**Strategy:** Front-load Identity and explicit hierarchy.

**Template:**

"IDENTITY: {character\_description}. Match \[IMAGE 1\] exactly.

STYLE: Street Fighter II arcade style, 16-bit, no anti-aliasing, transparent background.

POSE: {pose\_description}.

CONSTRAINT: Strictly adhere to the proportions and palette of \[IMAGE 1\]. Do not change head size."

#### **Q6.2: Variation Prompt Template (Temporal Flow)**

**Strategy:** Focus on **Delta** (Movement).

**Template:**

"CONTEXT: This frame follows \[IMAGE 2\].

ACTION: Generate the next logical frame where {delta\_description} (e.g., 'the right leg extends fully').

LOCK: Keep the head and torso identical to \[IMAGE 1\]. Only move the active limbs.

FLOW: Maintain the baseline of \[IMAGE 2\]."

#### **Q6.3: Lock/Recovery Prompt Template (Drift Rescue)**

Trigger: SF01\_Identity \< 0.9.

Strategy: Re-Anchor (Hard Reset). Explicitly discard the previous frame context.

**Template:**

"RECOVERY MODE: Previous generation drifted.

INSTRUCTION: IGNORE previous frame context. RESET strictly to \[IMAGE 1\] (Anchor).

POSE: {pose\_description} from scratch.

EMPHASIS: Ensure exact match of face shape to \[IMAGE 1\]."

#### **Q6.4: Negative Prompt**

**Strategy:** Focus on **Technical Artifacts**.

**Content:**

"anti-aliasing, blur, fuzzy edges, gradient, realistic shading, 3d render, vector art, noise, compression artifacts, cropped, cut off, partial body, extra limbs, distorted face, text, watermark."

#### **Q6.5: Pose Description Granularity**

Decision: Mid-Level (Natural Language).

Gemini 3 is a "Thinking" model; it understands biomechanics better than pixels.1

* **Good:** "Athletic wide stance, weight on back leg, fists raised to chin level."  
* **Bad (Too Low):** "Left hand at pixel 45,90."  
* **Bad (Too High):** "Fighting."

#### **Q6.6: Guide Overlay Injection**

**Decision:** **Code-First Alignment.**

The **Deep Think Architecture Lock** mandates **Contact Patch Alignment (Post-Processing)** over Guide Injection for the main loop.

1. **Primary:** Generate → Detect Feet → Shift Image Y to match Anchor Baseline (Code).  
2. **Fallback (Retry Level 3):** If code alignment fails 3 times, inject guide\_128.png as **\[IMAGE 3\]** with prompt "Align feet to RED BASELINE."

