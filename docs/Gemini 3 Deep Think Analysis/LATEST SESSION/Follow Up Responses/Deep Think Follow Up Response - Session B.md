Here are the definitive follow-up decisions and implementation logic for **Session B**, ensuring strict alignment with the "Deep Think" architecture and your TypeScript/Node.js stack.

---

## **Category 2: Post-Processor Pipeline (Follow-Up)**

### **FQ4: Orphan Pixel Threshold & Algorithm**

**Answer: Absolute Count \> 15 Pixels (Soft Fail).**

For 128×128 pixel art in the Street Fighter II style, noise is strictly controlled. "Dithering" (checkerboard patterns) is rare in this aesthetic; colors should be solid clusters. Any isolated pixel that does not match its orthogonal neighbors is considered an artifact of the 512px → 128px downsampling process.

* **Metric Unit:** Absolute Pixel Count per Frame.  
* **Thresholds:**  
  * **Pass:** 0–5 orphans (Allowing for eye glints/buckles).  
  * **Soft Fail (SF\_PIXEL\_NOISE):** \> 15 orphans.  
  * **Hard Fail:** N/A (Noise is never fatal, just ugly).

Implementation Logic:

We perform a 3x3 grid scan on the 128px downsampled buffer. A pixel is an "Orphan" if it differs in color/alpha from all 4 orthogonal neighbors (Up, Down, Left, Right).

#### **TypeScript Implementation (Sharp)**

TypeScript  
import sharp from 'sharp';

interface OrphanResult {  
  count: number;  
  isSoftFail: boolean;  
}

export async function detectOrphanPixels(  
  buffer: Buffer,   
  width: number \= 128,   
  threshold: number \= 15  
): Promise\<OrphanResult\> {  
    
  const { data, info } \= await sharp(buffer)  
    .ensureAlpha()  
    .raw()  
    .toBuffer({ resolveWithObject: true });

  const pixels \= new Uint8Array(data);  
  let orphanCount \= 0;

  // Helper to get pixel index  
  const getIdx \= (x: number, y: number) \=\> (y \* width \+ x) \* 4;

  // Helper to compare two pixels (Exact match required for pixel art)  
  const isSameColor \= (idx1: number, idx2: number) \=\> {  
    return (  
      pixels\[idx1\] \=== pixels\[idx2\] &&         // R  
      pixels\[idx1 \+ 1\] \=== pixels\[idx2 \+ 1\] && // G  
      pixels\[idx1 \+ 2\] \=== pixels\[idx2 \+ 2\] && // B  
      pixels\[idx1 \+ 3\] \=== pixels\[idx2 \+ 3\]    // A  
    );  
  };

  // Scan internal pixels (skipping 1px border to simplify logic)  
  for (let y \= 1; y \< info.height \- 1; y++) {  
    for (let x \= 1; x \< width \- 1; x++) {  
      const currentIdx \= getIdx(x, y);

      // Skip transparent pixels (orphans are visible noise)  
      if (pixels\[currentIdx \+ 3\] \=== 0\) continue;

      const top \= getIdx(x, y \- 1);  
      const bottom \= getIdx(x, y \+ 1);  
      const left \= getIdx(x \- 1, y);  
      const right \= getIdx(x \+ 1, y);

      // Definition: Pixel is orphan if NO orthogonal neighbor shares its color  
      const hasSupport \=   
        isSameColor(currentIdx, top) ||  
        isSameColor(currentIdx, bottom) ||  
        isSameColor(currentIdx, left) ||  
        isSameColor(currentIdx, right);

      if (\!hasSupport) {  
        orphanCount++;  
      }  
    }  
  }

  return {  
    count: orphanCount,  
    isSoftFail: orphanCount \> threshold  
  };  
}

---

## **Category 3: Quality Auditing (Follow-Up)**

### **FQ5: MAPD Thresholds by Move Type**

**Answer: Normalized Scale (0.0–1.0) with "Identity Bypass" for High Motion.**

MAPD (Masked Mean Absolute Pixel Difference) is effective *only* when frames overlap significantly. For high-velocity moves (Attack, Jump), temporal coherence is physically impossible to measure via simple pixel differences.

* **Metric Unit:** Normalized Delta (0.0 \= Identical, 1.0 \= Max Difference).  
* **Method:**  
  1. **Mask:** Create a binary mask of the *intersection* of non-transparent pixels in Frame N and Frame N-1.  
  2. **Diff:** Calculate average RGB delta only within that mask.  
  3. **Normalization:** Divide raw RGB difference by 255\.

#### **Threshold Lookup Table**

| Move Type | Motion Logic | MAPD Threshold (SF04) | Rationale |
| :---- | :---- | :---- | :---- |
| **Idle** | Breathing/Bobbing | **\> 0.02** (2%) | Sub-pixel movements only; internal texture must be stable. |
| **Walk** | Cyclic Locomotion | **\> 0.10** (10%) | Limbs move, but torso/head texture should remain consistent. |
| **Block** | Low movement | **\> 0.05** (5%) | Similar to Idle; minimal texture shift allowed. |
| **Attack** | High Velocity | **BYPASS (Ignore)** | Frames barely overlap. Use SSIM (Identity) instead. |
| **Jump** | Aerial Displacement | **BYPASS (Ignore)** | Use SSIM (Identity) instead. |
| **Hit** | Distortion | **BYPASS (Ignore)** | Distortion is expected. |

#### **TypeScript Logic Strategy**

TypeScript  
import sharp from 'sharp';

interface TemporalConfig {  
  moveType: 'idle' | 'walk' | 'attack' | 'jump' | 'other';  
}

export async function calculateMAPD(  
  currBuffer: Buffer,  
  prevBuffer: Buffer,  
  config: TemporalConfig  
): Promise\<number | null\> {  
    
  // 1\. Bypass logic for high-motion states  
  const bypassModes \= \['attack', 'jump', 'hit', 'special'\];  
  if (bypassModes.includes(config.moveType)) {  
    return null; // Return null to indicate "Skipped"  
  }

  // 2\. Load buffers  
  const curr \= await sharp(currBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });  
  const prev \= await sharp(prevBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const currPixels \= new Uint8Array(curr.data);  
  const prevPixels \= new Uint8Array(prev.data);  
    
  let totalDiff \= 0;  
  let pixelCount \= 0;

  for (let i \= 0; i \< currPixels.length; i \+= 4\) {  
    // 3\. Intersection Mask: Both pixels must be opaque (alpha \> 10\)  
    if (currPixels\[i+3\] \> 10 && prevPixels\[i+3\] \> 10\) {  
        
      const rDiff \= Math.abs(currPixels\[i\] \- prevPixels\[i\]);  
      const gDiff \= Math.abs(currPixels\[i+1\] \- prevPixels\[i+1\]);  
      const bDiff \= Math.abs(currPixels\[i+2\] \- prevPixels\[i+2\]);

      // Average diff for this pixel  
      totalDiff \+= (rDiff \+ gDiff \+ bDiff) / 3;  
      pixelCount++;  
    }  
  }

  if (pixelCount \=== 0\) return 0; // No overlap

  // 4\. Normalize to 0-1 range (Total Diff / Count / Max RGB)  
  return (totalDiff / pixelCount) / 255;  
}

### **Summary of Thresholds**

* **Orphan Pixels:** \> **15** (Soft Fail).  
* **MAPD (Idle):** \> **0.02** (Soft Fail).  
* **MAPD (Walk):** \> **0.10** (Soft Fail).  
* **MAPD (Attack):** **N/A** (Use SSIM).

