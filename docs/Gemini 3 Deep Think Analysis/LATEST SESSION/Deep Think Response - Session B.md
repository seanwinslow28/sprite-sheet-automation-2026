Here are the definitive answers, algorithms, and code strategies for **Session B** of the Deep Think analysis. These decisions align with the "Deep Think" architecture locks (Contact Patch Alignment, 15% Root Zone, Safety Valves) and the project's TypeScript/Node.js stack.

---

## **Category 2: Post-Processor Pipeline**

### **Q2.1: Alignment Recalculation After Contact Patch**

**Answer: No. The Anchor’s `baselineY` is the immutable "Ground Truth."**

We never update the target to match the generated frame. We physically shift the generated frame to match the target.

* **Logic:** The `AnchorAnalyzer` runs once at the start of the process to establish the contract (e.g., "Feet must be at Y=120").  
* **The Shift:** If the candidate's feet are at Y=115, we shift the pixel data `+5px`.  
* **Bounding Box:** The visible bounding box *relative to the canvas* changes, but the logic remains: "Does the aligned sprite's contact point match the Anchor's contact point?"  
* **Outcome:** If the aligned frame's feet end up at a different Y than expected (e.g., due to the Safety Valve clamping the shift), this is an **Alignment Failure**. The Post-Processor applies the clamp, and the **Auditor** catches the error via `SF_BASELINE_DRIFT`.

### **Q2.2: Root Zone Calculation Edge Cases**

**Answer: Use "Visible Height" Logic \+ Manifest Overrides.**

The algorithm relies on `visibleHeight = bottomY - topY`. We rely on **Manifest Configuration** to handle archetypal edge cases rather than brittle heuristics.

* **Jumping (Feet not at bottom):**  
  * **Strategy:** **Disable Alignment.** We must trust the AI's spatial placement for aerial moves, or rely on "Chain from Previous Frame".  
  * **Config:** `alignment.method: 'none'` (or `vertical_lock: false`).  
* **Trailing Cape/Tail:**  
  * **Problem:** The lowest pixel is a tail tip, not a foot.  
  * **Strategy:** **Increase Root Zone Ratio.** By expanding the scan zone from 15% to 25-30%, we include the "pixel mass" of the legs, pulling the calculated centroid upwards toward the true body position.  
  * **Config:** `alignment.root_zone_ratio: 0.30`.  
* **Crouching:**  
  * **Strategy:** **Standard Logic Works.** A crouched character has a smaller `visibleHeight`. The 15% calculation scales down automatically (e.g., 15% of 60px is 9px), keeping the scan tight on the feet.  
* **Alpha Fringe:**  
  * **Strategy:** **Hard Threshold.** The `AutoAligner` uses `alphaThreshold = 128`. Faint shadows or anti-aliasing are ignored.

### **Q2.3: Safety Valve Triggered — What Next?**

**Answer: Log Warning → Residual Drift → Soft Fail.**

The Safety Valve (clamping `shiftX` to ±32px) is a crash preventer, not a quality fixer. It ensures we don't push a sprite off-canvas due to a generation hallucination.

1. **Action:** The Post-Processor clamps the shift to 32px and logs `WARN: Safety valve triggered`.  
2. **State:** The sprite is likely still misaligned (e.g., required 50px, got 32px; residual error is 18px).  
3. **Audit:** The frame proceeds to the Auditor.  
4. **Result:** `SF_BASELINE_DRIFT` measures the *residual* distance (18px). Since 18px \> 1px threshold, it triggers **SF03 (Soft Fail)**.  
5. **Outcome:** Enter Retry Ladder (likely `RE_ANCHOR` or `POSE_RESCUE`).

### **Q2.4: Downsampling Artifact Validation**

**Answer: Validate via "Grid Integrity" or "Orphan Pixel" check.**

Since we use Nearest-Neighbor (NN) to force the 4:1 ratio, the risk is not "blur" but "noise" (orphan pixels) where the NN algorithm snapped to a bad source pixel.

* **Metric:** **Orphan Pixel Count**.  
* **Algorithm:** Scan the 128px output. Count pixels that have **zero** orthogonal neighbors of the same color.  
* **Logic:** In clean pixel art, single-pixel noise is rare. High orphan counts imply the 512px source was dithered or noisy.  
* **Implementation:** Run this as part of `SF03` (Line Weight/Pixel Density).

### **Q2.5: Dynamic Chroma Key Selection**

**Answer: "Furthest Neighbor" Algorithm (CIELAB/RGB).**

We select the background color that is perceptually furthest from *every* color in the anchor sprite.

**TypeScript Algorithm:**

TypeScript  
import { DeltaE } from './utils/color'; // Hypothetical utils

function selectChromaKey(anchorBuffer: Buffer): string {  
  const candidates \= \[  
    { hex: '\#FF00FF', rgb: \[255, 0, 255\] }, // Magenta  
    { hex: '\#00FF00', rgb: \[0, 255, 0\] },   // Green  
    { hex: '\#00FFFF', rgb: \[0, 255, 255\] }, // Cyan  
    { hex: '\#0000FF', rgb: \[0, 0, 255\] }    // Blue  
  \];

  // 1\. Extract Unique Anchor Colors  
  const anchorColors \= extractUniqueColors(anchorBuffer); // Set of \[r,g,b\]  
    
  let bestKey \= candidates\[0\];  
  let maxMinDistance \= \-1;

  // 2\. Furthest Neighbor Search  
  for (const key of candidates) {  
    let minDistance \= Infinity;  
      
    // Find the distance to the \*closest\* anchor color (the "danger zone")  
    for (const color of anchorColors) {  
      const dist \= euclideanDistance(key.rgb, color);  
      if (dist \< minDistance) minDistance \= dist;  
    }

    // We want the candidate with the \*largest\* minimum distance  
    if (minDistance \> maxMinDistance) {  
      maxMinDistance \= minDistance;  
      bestKey \= key;  
    }  
  }

  // 3\. Fallback Safety  
  if (maxMinDistance \< 15\) { // RGB Euclidean threshold  
    console.warn(\`WARN: Chroma conflict risk. Safest key ${bestKey.hex} is only ${maxMinDistance} units away.\`);  
  }

  return bestKey.hex;  
}

---

## **Category 3: Quality Auditing & Metrics**

### **Q3.1: SSIM Calculation on Aligned vs. Unaligned**

**Answer: Post-Alignment (Aligned Frame vs. Anchor).**

* **Logic:** SSIM (Structural Similarity) penalizes spatial mismatches heavily. If the AI generates a perfect "Sean" but places him 10px to the left, **Unaligned SSIM** will fail (\~0.5 score). We want SSIM to verify **Identity** and **Structure**, not Position.  
* **Separation of Concerns:**  
  * **AutoAligner** \+ **SF\_BASELINE\_DRIFT**: Handles *Position*.  
  * **SSIM**: Handles *Identity*.

### **Q3.2: Baseline Drift vs. Contact Patch Alignment Conflict**

**Answer: `SF_BASELINE_DRIFT` measures "Residual Drift" (Post-Alignment Error).**

It acts as a Quality Assurance check on the Alignment Post-Processor.

* **Scenario A (Healthy):** Aligner shifts frame \+5px. Feet land on baseline. Drift \= 0\. **PASS.**  
* **Scenario B (Safety Valve):** Aligner wants \+50px, clamps to \+32px. Feet land 18px off. Drift \= 18px. **FAIL.**  
* **Scenario C (Detection Fail):** Aligner detects a shadow as "feet" and moves the shadow to the baseline. Real feet are floating. Auditor (using stricter alpha threshold) sees feet off baseline. **FAIL.**

### **Q3.3: Alpha Artifact Detection Algorithm**

**Answer: Perimeter Band Scan.**

We scan the "Edge Band" (pixels adjacent to transparency) for values that are neither fully transparent nor fully opaque.

**Algorithm:**

TypeScript  
function detectHalo(image: Buffer): number {  
  // 1\. Identify Edge Pixels (Opaque pixels touching Transparent ones)  
  // 2\. Count "Semi-Transparent" pixels in that set (0 \< A \< 255\)  
  // 3\. Calculate Ratio  
    
  let edgePixels \= 0;  
  let haloPixels \= 0;  
    
  for (let i \= 0; i \< pixels.length; i \+= 4\) {  
    const alpha \= pixels\[i \+ 3\];  
    if (alpha \> 0 && isEdgePixel(i)) {  
      edgePixels++;  
      // Strict pixel art should be 255\. Allow tiny buffer if needed (e.g. \> 250\)  
      if (alpha \< 254\) haloPixels++;   
    }  
  }  
    
  return edgePixels \> 0 ? (haloPixels / edgePixels) : 0;  
}

### **Q3.4: Palette Fidelity — Exact Colors vs. Perceptual**

**Answer: Delta-E (LAB) with Tolerance.**

Generative models introduce compression noise. Exact hex matching is too brittle.

* **Metric:** `% of Pixels Matching Palette`.  
* **Method:** **CIELAB Delta-E**.  
* **Tolerance:** **Delta-E \<= 2.3** (JND \- Just Noticeable Difference).  
* **Logic:**  
  * Iterate every non-transparent pixel.  
  * Find the closest color in the `Manifest Palette`.  
  * If `Distance > 2.3`, mark as **Miss**.  
  * **Threshold:** If Match % \< 90%, trigger `SF_PALETTE_DRIFT`.

### **Q3.5: Temporal Coherence Without LPIPS (MVP)**

**Answer: Masked Mean Absolute Pixel Difference (MAPD).**

For MVP, we use pixel math on **Aligned** frames, but we **Mask** the comparison to ignore edge jitter (which is expected in pixel art).

**Algorithm:**

1. **Align:** Frame N and Frame N-1.  
2. **Mask:** Erode the silhouette by 1-2px. We only care about *internal* texture flicker (e.g., face morphing, clothes changing color).  
3. **Diff:** Calculate average RGB difference of the masked area.  
4. **Threshold:** Configurable per move type (Walk/Idle \= Low tolerance; Attack \= High tolerance/Ignored).

