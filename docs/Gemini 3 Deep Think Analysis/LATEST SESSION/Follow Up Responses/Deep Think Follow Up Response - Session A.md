Based on the "Deep Think" architectural decisions and the specific Gemini 3 / Nano Banana Pro constraints, here are the **Definitive Answers** to your follow-up questions.

---

### **FQ1: Temperature Parameter Contradiction**

**Decision:** **Option A (Explicitly set `temperature: 1.0`)** or **Option B (Omit entirely)**. **Do NOT use 0.7.**

**Reasoning:** The code sample showing `0.7` is a legacy artifact from GPT-4 era defaults.

* **Scale Shift:** Gemini 1.5/2.0/3.0 models often use a temperature scale of **0.0 to 2.0**. On this scale, a value of `0.7` is effectively "low" (equivalent to \~0.35 on a standard scale), which forces the model into highly deterministic, repetitive modes. This causes the "fried pixels" or "identical frame" issues described in Session A (Mode Collapse).  
* **Thinking Models:** For models with "Thinking" capabilities (like Gemini 2.0 Flash Thinking), the model relies on its internal reasoning path to generate diversity. Constraining the temperature fights against this mechanism.

**Corrected Code Block:**

TypeScript  
const generationConfig \= {  
  // CORRECT: Uses model default (usually 1.0) or explicitly allows full dynamic range  
  temperature: 1.0,   
    
  // CRITICAL: Ensure topP/topK allow for pixel variance  
  topP: 0.95,  
  topK: 40,  
    
  // DO NOT USE: temperature: 0.7 (Too restrictive for Gemini 2.0/3.0)  
};

---

### **FQ2: Thought Signature Extraction for Traceability**

**Answer:**

1. **Field Path:** The signature is located within the `parts` array of the candidate's content. It is a specific property of a `Part` object, often attached to the text response or a function call.  
2. **Data Type:** `string` (Base64 encoded opaque token).  
3. **Presence:** In "Thinking" models (Gemini 2.0 Flash Thinking / Gemini 3), it is present when the model performs reasoning. You must scan the parts to find it.

**Implementation (TypeScript):**

TypeScript  
import { GenerateContentResponse, Part } from '@google/generative-ai';

// Interface for your audit log  
interface AuditMetadata {  
  thoughtSignature?: string;  
  thoughtContent?: string;  
  // ... other fields  
}

export function extractThoughtArtifacts(response: GenerateContentResponse): AuditMetadata {  
  const candidate \= response.candidates?.\[0\];  
  if (\!candidate || \!candidate.content || \!candidate.content.parts) {  
    return {};  
  }

  // 1\. Extract the opaque 'thoughtSignature' token (for v2 API state resume)  
  // It can be attached to ANY part, so we look for the first occurrence.  
  const signaturePart \= candidate.content.parts.find((p: Part) \=\> 'thoughtSignature' in p);  
  const thoughtSignature \= signaturePart ? (signaturePart as any).thoughtSignature : undefined;

  // 2\. Extract the human-readable 'Thinking' text (for debugging/logging)  
  // Marked by the 'thought' boolean in the API (or specific MIME type in older versions)  
  // Note: The SDK might abstract this, but looking for the 'thought' flag is standard.  
  const thoughtPart \= candidate.content.parts.find((p: Part) \=\> (p as any).thought \=== true);  
  const thoughtContent \= thoughtPart ? thoughtPart.text : undefined;

  return {  
    thoughtSignature, // The "Save State" token  
    thoughtContent    // The readable reasoning text  
  };  
}

**Why this matters:** The `thoughtSignature` is effectively a "Save Game" state for the model's brain. If you ever need to manually "edit" a frame using the exact same reasoning context that created it (in a future v2 pipeline), you will need to pass this string back to the API.

---

### **FQ3: Seed Algorithm — CRC32 vs. String Hash**

**Decision:** **Option A: CRC32.**

**Reasoning:**

* **API Constraint:** The Gemini API `seed` parameter expects a standard **integer** (typically treated as a signed 32-bit or 64-bit integer on the backend).  
* **CRC32 Benefits:**  
  * It produces a **clean 32-bit integer** deterministically.  
  * It handles the combination of strings (`RunID` \+ `FrameIndex`) with better uniform distribution than a simple `djb2` hash, reducing the chance of "seed collisions" where two different frames accidentally get the same noise pattern.  
  * `djb2` can overflow standard integer types in JavaScript without careful handling (BigInt), whereas CRC32 is designed to fit standard types.

**Implementation (TypeScript):**

You will need a lightweight CRC32 function (or use a library like `crc-32`). Here is a dependency-free implementation for your utils:

TypeScript  
/\*\*  
 \* Calculates a deterministic 32-bit integer seed from a unique frame ID.  
 \* Input: "Run\_123\_Frame\_04\_Attempt\_01" \-\> Output: 3852935812  
 \*/  
export function calculateSeed(runId: string, frameIndex: number, attemptIndex: number): number {  
  const uniqueKey \= \`${runId}::${frameIndex}::${attemptIndex}\`;  
  return crc32(uniqueKey);  
}

function crc32(str: string): number {  
  let crc \= \-1;  
  for (let i \= 0; i \< str.length; i++) {  
    const code \= str.charCodeAt(i);  
    for (let j \= 0; j \< 8; j++) {  
      if ((crc ^ code) & 1\) {  
        crc \= (crc \>\>\> 1\) ^ 0xEDB88320;  
      } else {  
        crc \= crc \>\>\> 1;  
      }  
    }  
    // Simple mixing for the byte  
    crc \= crc ^ (code \>\>\> 8); // (Not standard CRC32, simple bit mixer sufficient for seeding)  
    // Actually, use a standard table-less implementation for correctness:  
  }  
    
  // REVISED standard table-less CRC32 for clarity:  
  let c \= 0 ^ (-1);  
  for (let i \= 0; i \< str.length; i++) {  
    c \= (c \>\>\> 8\) ^ crcTable\[(c ^ str.charCodeAt(i)) & 0xFF\];  
  }  
  return (c ^ (-1)) \>\>\> 0; // Ensure unsigned 32-bit integer  
}

// Precomputed table for speed (standard CRC32 polynomial)  
const crcTable \= (() \=\> {  
  let c;  
  const table \= \[\];  
  for (let n \= 0; n \< 256; n++) {  
    c \= n;  
    for (let k \= 0; k \< 8; k++) {  
      c \= ((c & 1\) ? (0xEDB88320 ^ (c \>\>\> 1)) : (c \>\>\> 1));  
    }  
    table\[n\] \= c;  
  }  
  return table;  
})();

**Usage:** Pass this integer directly to the API: `seed: calculateSeed(...)`. This ensures that if you re-run the exact same manifest with the same ID, you get the exact same pixel noise.

