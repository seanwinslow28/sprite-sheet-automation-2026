The following technical directive addresses the follow-up questions from **Session C**. These decisions are now **locked** for the Sprite-Sheet-Automation-Project\_2026 pipeline implementation.

---

### **Category 5: Export & Phaser Validation**

#### **FQ6: Frame Key Zero-Padding Standard**

**Decision: Strict 4-Digit Padding (0000)**

We will standardize on **Option A (4 Digits)**. While the PRD mentioned a "2-digit minimum," 4 digits is the robust engineering standard for asset pipelines.

**Rationale:**

1. **Lexicographical Sorting:** Operating systems and simple scripts often sort 1, 10, 11... 2 incorrectly. 0001, 0002... 0010 guarantees correct order in file explorers and raw lists.  
2. **TexturePacker Compatibility:** TexturePacker uses the {n4} token efficiently.  
3. **Phaser Consistency:** Eliminates "guessing" the zeroPad value in generateFrameNames. It is always 4.

**Implementation Directive:**

* **Manifest Config:** Implicitly enforced. No user config needed.  
* **TexturePacker CLI:** Use the token {n4} in the file naming pattern.

**Pipeline Renamer:**  
TypeScript  
// Enforce this pattern during the "Approve & Rename" stage  
const frameName \= \`${move}/${frameIndex.toString().padStart(4, '0')}\`;  
// Result: idle/0000, idle/0001, idle/0002...

* 

**Phaser Consumption:**  
JavaScript  
// Standard Phaser Config for this pipeline  
this.anims.create({  
    key: 'sean-idle',  
    frames: this.anims.generateFrameNames('sean\_atlas', {  
        prefix: 'idle/',  
        start: 0,  
        end: 3,  
        zeroPad: 4, // LOCKED STANDARD  
        suffix: ''  
    }),  
    frameRate: 8,  
    repeat: \-1  
});

* 

---

### **Category 4: Retry Ladder & Orchestration**

#### **FQ7: HF\_IDENTITY\_COLLAPSE Recovery Path**

**Decision: Stop the Frame (Reject), Continue the Run**

We select **Option A (Stop the Frame)**. HF\_IDENTITY\_COLLAPSE indicates that specific frame cannot be saved by the current model/anchor/prompt combination. It is a "Dead End."

**Rationale:**

* **Batch Resilience:** A single bad frame (e.g., a complex grappling pose) should not kill the entire run. We want to harvest the 14 good frames.  
* **Rate Limiting:** The "Circuit Breaker" pattern (Stop Condition) handles the aggregate health. If Identity Collapse happens 5 times, the reject\_rate \> 30% stop condition will trigger and halt the run anyway.

**Implementation Directive:**

1. **Orchestrator Action:**  
   * Mark frame as REJECTED.  
   * Log Reason: HF\_IDENTITY\_COLLAPSE.  
   * **Do not** enter the Retry Ladder (it is already exhausted).  
   * Proceed to NEXT\_FRAME.  
2. **Stop Condition Check:**  
   * *Immediately* after rejecting, recalculate Reject Rate.  
   * If (Total Rejects / Total Attempts) \> 0.3, **then** trigger STOPPED state for the run.  
3. **Diagnostic Report:**  
   * Must output: *"Suggestion: Anchor image may lack resolution for this pose angle, or the prompt description conflicts with the anchor's anatomy."*

---

#### **FQ8: Multipack TEST-04 Validation**

**Decision: Validate the Master JSON textures Array**

Phaser 3 handles multipacks via the **MultiAtlas** loader. It reads a single "Master JSON" which references multiple PNGs. TEST-04 must validate this relationship.

**Validation Logic (TEST-04 Update):**

1. **Structure Check:**  
   * Load the atlas.json.  
   * **Assert:** Root object contains a textures array (Phaser MultiAtlas format), NOT just a frames object (Single Atlas format).  
   * **Assert:** Each entry in textures has a valid image property pointing to a file that exists (e.g., atlas\_0.png).  
2. **Frame Key Reachability:**  
   * Iterate through *all* objects in the textures array.  
   * Collect all frame names from all sub-textures into a single set.  
   * **Assert:** The set contains exactly manifest.frame\_count items.  
   * **Assert:** Every key matches the regex ^{move}/\\d{4}$.

**Code Example (Validator Adapter):**

TypeScript  
// src/adapters/validator/PhaserValidator.ts (Pseudo-code)

function validateMultipack(jsonContent: any, expectedFrameCount: number): ValidationResult {  
  if (\!Array.isArray(jsonContent.textures)) {  
    return Result.fail("HF\_ATLAS\_FORMAT: Missing 'textures' array for MultiAtlas");  
  }

  const allKeys \= new Set\<string\>();  
    
  jsonContent.textures.forEach((texture: any) \=\> {  
    // 1\. Verify PNG reference  
    if (\!fs.existsSync(path.join(exportDir, texture.image))) {  
       throw new Error(\`Missing referenced texture: ${texture.image}\`);  
    }

    // 2\. Collect Keys  
    texture.frames.forEach((frame: any) \=\> {  
      allKeys.add(frame.filename);  
    });  
  });

  // 3\. Validate Global Count  
  if (allKeys.size \!== expectedFrameCount) {  
    return Result.fail(\`Frame count mismatch. Found ${allKeys.size}, expected ${expectedFrameCount}\`);  
  }

  return Result.ok();  
}

**Risk Note:** TexturePacker automatically handles key collisions (it will warn you), so we rely on TexturePacker for *collision* safety, and our validator for *structure* safety.

---

### **Summary of Locked Decisions**

| Question | Decision | Impact |
| :---- | :---- | :---- |
| **FQ6** | **4-Digit Padding (0000)** | TexturePacker setting {n4}, Phaser zeroPad: 4. |
| **FQ7** | **Reject Frame & Continue** | Count as reject; let reject\_rate stop condition handle run termination. |
| **FQ8** | **Validate Master JSON** | Ensure textures\[\] array exists and sums to correct frame count. |

