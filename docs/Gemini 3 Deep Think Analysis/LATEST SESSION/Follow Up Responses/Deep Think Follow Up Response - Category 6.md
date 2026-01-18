**This is a "Deep Think" architectural response to the follow-up questions regarding the Nano Banana Pro Integration and Category 6: Prompting Techniques.**

**Based on the "Semantic Interleaving" paradigm established in the previous session, we must treat the model as a state machine where the context window defines the physics of the current moment.**

**Below is the detailed analysis and implementation strategy for Cycle Completion (FQ9) and Pose Workflow (FQ10).**

### **FQ9: Cycle Completion for Looping Animations**

**Analysis:**

**You correctly identified a critical gap. The standard "Variation Prompt" (Previous Frame $\\rightarrow$ Current Frame) pushes the animation forward linearly. Without a "gravity well" pulling the last frame back to the start, the animation will "drift" past the loop point, creating a visible "pop" or "jump" when the game engine resets to Frame 0\.**

**Verdict:**

**Your proposed strategy is Correct but requires specific Semantic Tagging. We do not need to upload Frame 0 a second time (as it is already present as \[IMAGE 1\]: MASTER ANCHOR). Instead, we must semantically re-label \[IMAGE 1\] in the text prompt for the final frame, transforming it from just "Identity Truth" to "Motion Target."**

#### **Strategy: The "Loop Closure" Pattern**

**For the final frame of a cycle (e.g., Frame 7 of 8), the prompt structure changes. We introduce a triangulation constraint:**

1. **Origin: \[IMAGE 2\] (Frame 6\)**  
2. **Destination: \[IMAGE 1\] (Frame 0\)**  
3. **Task: Generate the bridge (Frame 7).**

**The Template Construction (Updated Logic):**

**We modify the buildMasterPrompt logic to detect isLoopClosure.**

**TypeScript**

**// src/adapters/generator/promptBuilder.ts**

**function buildPromptParts(ctx: GenerationContext): Part\[\] {**

  **const parts: Part\[\] \= \[\];**


  **// 1\. IDENTITY TRUTH (Always Frame 0/Anchor)**

  **parts.push({** 

    **text: \`\[IMAGE 1\]: MASTER ANCHOR (IDENTITY TRUTH)\\nStrictly adhere to this character's design.\`** 

  **});**

  **parts.push({ inlineData: { mimeType: "image/png", data: ctx.anchorBase64 } });**

  **// 2\. TEMPORAL FLOW (Previous Frame)**

  **if (ctx.prevFrameBase64) {**

    **parts.push({** 

      **text: \`\[IMAGE 2\]: PREVIOUS FRAME (START OF MOTION)\\nAction flows from this image.\`** 

    **});**

    **parts.push({ inlineData: { mimeType: "image/png", data: ctx.prevFrameBase64 } });**

  **}**

  **// 3\. COMMAND LOGIC (The "Loop Closure" Logic)**

  **let commandText \= \`COMMAND: ${ctx.prompt}\`;**


  **// Detect if this is the final frame of a loop**

  **if (ctx.isLoopClosure) {**

    **commandText \+= \`**

    **\\nCRITICAL CONTEXT: This is the FINAL frame of a looping animation.**

    **OBJECTIVE: Create the missing link that connects \[IMAGE 2\] back to \[IMAGE 1\].**

    **CONSTRAINT: The pose must be 85% transitioned towards the pose visible in \[IMAGE 1\].**

    **PHYSICS: Ensure momentum decelerates to match the starting state of \[IMAGE 1\].\`;**

  **} else {**

    **// Standard linear flow**

    **commandText \+= \`\\nPHYSICS: Continue the motion vector established in \[IMAGE 2\].\`;**

  **}**

  **parts.push({ text: commandText });**


  **return parts;**

**}**

**Why this works:**

* **It utilizes the existing \[IMAGE 1\] context, saving tokens and bandwidth.**  
* **It explicitly tells the model to treat \[IMAGE 1\] not just as a "character sheet" but as the "destination pose."**

### **FQ10: Pose Description Authoring Workflow**

**Analysis:**

**Hand-authoring descriptions for every frame (Option A) is unscalable and prone to human error. "Auto-generated" (Option D) is too risky for an MVP because LLMs struggle with the precise biomechanics of a walk cycle without guidance.**

**Verdict:**

**Option B (Manifest per-move \+ Index) is the correct architectural choice.**

**We will use "Phase-Based Parametric Templates."**

**You do not write descriptions for Frame 0, 1, 2... You write descriptions for Phases (Contact, Recoil, Passing, High Point) and map frames to those phases.**

#### **Strategy: The "Kinematic Phase Map"**

**We create a MoveManifest that defines the "Key Phases" of a move. The system then selects the description based on the frame index.**

**Operational Workflow:**

1. **Define the Move: (e.g., "Standard Walk", 8 Frames).**  
2. **Define the Phases: Map indices to biomechanical states.**  
3. **Runtime Injection: The Generator Adapter looks up moves\['walk'\].phases\[frameIndex\].**

#### **Implementation: The Pose Library (src/domain/poses.ts)**

**Here is the exact data structure you should use for your MVP (Idle & Walk).**

**TypeScript**

**// src/domain/poses.ts**

**export type PosePhase \= {**

  **description: string;**

  **tension: "relaxed" | "tense" | "explosive";**

**};**

**export const MOVES\_LIBRARY: Record\<string, Record\<number, PosePhase\>\> \= {**


  **// \--- IDLE CYCLE (8 Frames \- Breathing Sine Wave) \---**

  **// Frame 0 is Anchor. Frame 7 leads back to 0\.**

  **"idle\_standard": {**

    **1: { description: "Chest slightly expanding, shoulders rising 1px. Knees bent deeply.", tension: "relaxed" },**

    **2: { description: "Chest fully expanded, maximum inhale. Shoulders at peak height. Fists bob slightly up.", tension: "relaxed" },**

    **3: { description: "Hold breath moment. Static high point of the breathing cycle.", tension: "relaxed" },**

    **4: { description: "Exhale begins. Chest compressing, shoulders dropping 1px.", tension: "relaxed" },**

    **5: { description: "Mid-exhale. Weight settling lower into the stance.", tension: "relaxed" },**

    **6: { description: "Bottom of exhale. Shoulders at lowest point. Knees bent maximum.", tension: "relaxed" },**

    **7: { description: "Transition to inhale. Slight upward momentum to return to start.", tension: "relaxed" }**

  **},**

  **// \--- WALK CYCLE (8 Frames \- Standard Locomotion) \---**

  **// Assuming Frame 0 \= Left Foot Contact**

  **"walk\_forward": {**

    **// Phase: Recoil (Weight absorbs onto Left leg)**

    **1: { description: "Left leg bears full weight, knee bends (Recoil). Right foot lifts off ground slightly behind body.", tension: "tense" },**

    

    **// Phase: Passing (Right leg swings past Left)**

    **2: { description: "Left leg straightens. Right leg passes the left knee, mid-air. Body rises (High Point).", tension: "tense" },**

    

    **// Phase: Contact (Right heel strikes ground)**

    **3: { description: "Right leg extends forward, heel touches ground. Left leg pushes off back with toes.", tension: "tense" },**

    

    **// Phase: Recoil (Weight absorbs onto Right leg)**

    **4: { description: "Right leg bears full weight, knee bends (Recoil). Left foot lifts off ground behind body.", tension: "tense" },**

    

    **// Phase: Passing (Left leg swings past Right)**

    **5: { description: "Right leg straightens. Left leg passes the right knee, mid-air. Body rises (High Point).", tension: "tense" },**

    

    **// Phase: Contact (Left heel strikes ground \- Loop Close Setup)**

    **6: { description: "Left leg extends forward, heel touches ground. Right leg pushes off back with toes.", tension: "tense" },**

    

    **// Phase: Return (Transition to Frame 0\)**

    **7: { description: "Weight shifts forward onto Left leg. Right foot prepares to lift. Return to initial stance.", tension: "tense" }**

  **}**

**};**

**export function getPoseForFrame(moveId: string, frameIndex: number): string {**

  **const move \= MOVES\_LIBRARY\[moveId\];**

  **if (\!move || \!move\[frameIndex\]) {**

    **// Fallback if specific frame not defined**

    **return "Maintain style and consistent volume.";** 

  **}**

  **return move\[frameIndex\].description;**

**}**

#### **Integration into Generator Adapter**

**You now update the generate function to pull from this library dynamically.**

**TypeScript**

**// Inside GeminiGeneratorAdapter.ts**

**// ... inside generate() method ...**

**// 1\. Determine if this is the last frame (for FQ9 Logic)**

**const isLastFrame \= ctx.frameIndex \=== ctx.totalFrames \- 1;**

**// 2\. Fetch the Mid-Level Intent Pose Description (FQ10 Logic)**

**// We assume Frame 0 is handled by the Anchor, so we only fetch for index \> 0**

**let poseInstruction \= getPoseForFrame(ctx.moveId, ctx.frameIndex);**

**// 3\. Construct the prompt**

**const finalPrompt \= \`**

**TASK: Generate Frame ${ctx.frameIndex} of '${ctx.moveId}'.**

**POSE ACTION: ${poseInstruction}**

**${isLastFrame ? "CONNECTION: This frame must transition smoothly back to the Anchor pose." : ""}**

**\`;**

**// Pass finalPrompt to buildPromptParts...**

### **Summary of Operational Changes**

| Feature | Change Required | Implementation Location |
| :---- | :---- | :---- |
| **Cycle Completion** | **Add logic to detect isLastFrame and inject "Target: \[IMAGE 1\]" instruction.** | **buildPromptParts (Prompt Builder)** |
| **Pose Workflow** | **Create src/domain/poses.ts containing the Phase Map.** | **New File** |
| **Data Flow** | **Generator Adapter must look up the pose description by (moveId, frameIndex) before calling API.** | **GeminiGeneratorAdapter.ts** |

**Next Step Recommendation:**

**With the Prompting (Cat 6\) and Posing strategies locked, the next logical step is defining the Auditor Logic (Category 4). We need to define how the system mechanically detects if "Walk Frame 3" actually matches the "Right leg extends" description we just defined.**

**Would you like me to generate the Auditor Validation Logic (checking pixel mass/centroid shifts) to verify these poses are actually being generated correctly?**

**User: Yes Please**

**This is the Deep Think Architecture Lock for Category 4: Auditor & Validation Logic.**

**You have now established *how* to ask the model for sprites (Category 6). The Auditor is the system that decides if the model actually listened.**

**In the Nano Banana Pro pipeline, we do not blindly trust the generator. We employ a "Trust but Verify" protocol. The Auditor is a dual-engine system:**

1. **Mechanical Engine: Checks strict physics (palette, alignment, dimensions).**  
2. **Semantic Engine: Checks visual intent (Does it look like Sean? Is the leg actually lifted?).**

---

### **Auditor Metric Definitions**

**We will implement three specific failure codes (SF/HF) that trigger the Circuit Breaker discussed in the previous session.**

#### **1\. HF03: Baseline Drift (Mechanical Audit)**

* **Definition: In pixel art fighting games, characters must share a common "floor" (Y-axis). Models often "float" characters up or down.**  
* **Detection: Scanline Analysis. We scan the image from bottom to top. The first row with significant pixel density (\>10 pixels) is the "Contact Patch."**  
* **Threshold: If the Contact Patch deviates $\>\\pm 3px$ from the Anchor's baseline, trigger AutoAligner.**

#### **2\. SF01: Identity Integrity (Palette Audit)**

* **Definition: The model might hallucinate new colors (e.g., adding blue shading to a red shirt).**  
* **Detection: Histogram Intersection. We compare the color palette of the Generated Frame against the Anchor Frame.**  
* **Threshold: If $\>15\\%$ of pixels use colors not present in the Anchor's palette (ignoring anti-aliasing drift), trigger Retire/Regenerate.**

#### **3\. SF02: Kinematic Flow (Centroid Audit)**

* **Definition: Did the character actually move?**  
* **Detection: Center of Mass (Centroid) Tracking. We calculate the visual center of the sprite.**  
  * **Equation: $C\_x \= \\frac{\\sum x \\cdot \\alpha\_x}{\\sum \\alpha\_x}$ where $\\alpha$ is pixel alpha.**  
* **Logic:**  
  * **If prompt says "Lunging forward" and $C\_x$ (Current) $\\approx$ $C\_x$ (Previous), the model failed to generate motion.**

---

### **Component 1: The AutoAligner (Mechanical Fix)**

**Before we reject an image, we try to fix it. The AutoAligner resolves HF03 (Drift) without costing money for a regeneration.**

**Implementation: src/core/processing/AutoAligner.ts**

**TypeScript**

**import { Canvas, Image } from 'canvas'; // or distinct image library**

**export class AutoAligner {**


  **/\*\***

   **\* Mechanically forces the sprite to touch the floor.**

   **\* Solves HF03: Baseline Drift.**

   **\*/**

  **public alignToBaseline(**

    **imgBuffer: Buffer,** 

    **anchorBaselineY: number**

  **): Buffer {**

    

    **const { minX, minY, maxX, maxY } \= this.getBoundingBox(imgBuffer);**

    **const currentBaseline \= maxY;**

    

    **// Calculate the Delta (Drift)**

    **const driftY \= anchorBaselineY \- currentBaseline;**

    

    **if (Math.abs(driftY) \=== 0) return imgBuffer; // No drift**

    **// Mechanically shift pixels**

    **return this.shiftPixels(imgBuffer, 0, driftY);**

  **}**

  **/\*\***

   **\* Returns the bounding box of non-transparent pixels.**

   **\* Used for Centroid and Baseline detection.**

   **\*/**

  **private getBoundingBox(buffer: Buffer) {**

    **// Scan pixel buffer for alpha \> 0**

    **// Returns { minX, minY, maxX, maxY }**

    **// ... implementation ...**

  **}**

**}**

---

### **Component 2: The Auditor Service (The Gatekeeper)**

**This service runs immediately after Generation and before AutoAligner. It assigns a Quality Score (0.0 \- 1.0).**

**Implementation: src/core/processing/AuditorService.ts**

**TypeScript**

**import { GeneratedFrame, GenerationContext } from '../../domain/interfaces';**

**import { PaletteExtractor } from '../utils/palette';**

**export type AuditResult \= {**

  **score: number;**

  **passed: boolean;**

  **flags: string\[\]; // e.g., \["SF01\_PALETTE\_MISMATCH", "HF03\_BASELINE\_DRIFT"\]**

  **correction?: 'ALIGN' | 'REGENERATE';**

**};**

**export class AuditorService {**


  **constructor(private paletteExtractor: PaletteExtractor) {}**

  **public async audit(**

    **frame: GeneratedFrame,** 

    **ctx: GenerationContext**

  **): Promise\<AuditResult\> {**

    

    **const flags: string\[\] \= \[\];**

    **let score \= 1.0;**

    **// \--- CHECK 1: SF01 IDENTITY (PALETTE) \---**

    **// Does the new frame use the Anchor's colors?**

    **const anchorPalette \= await this.paletteExtractor.extract(ctx.anchorBase64);**

    **const framePalette \= await this.paletteExtractor.extract(frame.data);**

    

    **const rogueColorCount \= framePalette.filter(c \=\> \!anchorPalette.includes(c)).length;**

    

    **// Allow slight variance for anti-aliasing (e.g., \< 5 rogue colors is okay)**

    **if (rogueColorCount \> 5) {**

      **flags.push('SF01\_PALETTE\_MISMATCH');**

      **score \-= 0.4; // Heavy penalty**

    **}**

    **// \--- CHECK 2: HF03 BASELINE DRIFT \---**

    **// Did the character float up?**

    **const baseline \= this.getBaseline(frame.data);**

    **const drift \= Math.abs(baseline \- ctx.anchorMetadata.baselineY);**

    

    **if (drift \> 3) {**

      **flags.push('HF03\_BASELINE\_DRIFT');**

      **score \-= 0.1; // Minor penalty, fixable**

    **}**

    **// \--- CHECK 3: SF02 KINEMATICS (Motion Check) \---**

    **// Only applies if we expected movement**

    **if (ctx.expectedMotion) {**

      **const movement \= this.calculateCentroidShift(frame.data, ctx.prevFrameBase64);**

      **if (movement \< 2.0) { // Moved less than 2 pixels**

        **flags.push('SF02\_STAGNATION');**

        **score \-= 0.3;**

      **}**

    **}**

    **// \--- DECISION LOGIC \---**

    **let correction: 'ALIGN' | 'REGENERATE' | undefined;**

    **if (flags.includes('SF01\_PALETTE\_MISMATCH') || flags.includes('SF02\_STAGNATION')) {**

      **// Identity or Motion failure \= Trash it.**

      **return { score, passed: false, flags, correction: 'REGENERATE' };**

    **}**

    **if (flags.includes('HF03\_BASELINE\_DRIFT')) {**

      **// Just drift? Keep it, but align it.**

      **return { score, passed: true, flags, correction: 'ALIGN' };**

    **}**

    **return { score, passed: true, flags };**

  **}**

**}**

---

### **Visualizing the Loop**

**The architecture now creates a self-healing loop:**

1. **Generate (Gemini 3\)**  
2. **Audit (AuditorService)**  
3. **Branch:**  
   * **Fail (SF01/SF02): Discard. Increment attemptIndex. Retry with higher Temperature.**  
   * **Warn (HF03): Pass to AutoAligner. Shift Y-axis. Save.**  
   * **Pass: Save directly.**

### **Next Operational Step**

**With the Generator (Cat 6\) and Auditor (Cat 4\) defined, you have a functional "backend."**

**The missing piece is the Frontend Feedback Loop. When the user (you) sees the "Auto-Aligned" result, you might still hate it. We need to define the "Director Mode" Interface (Category 8).**

**Would you like me to spec out the "Director Mode" UI?**

**This would cover how you manually override the Auditor, dragging the sprite into place if the AutoAligner fails, and how to "Paint" corrections (Inpainting) for the next iteration.**

**User: Yes, please. Provide examples**

**This is the Deep Think Architecture Lock for Category 8: Director Mode (Human-in-the-Loop Interface).**

**You have the Generator (the artist) and the Auditor (the critic). Now you need the Director (you).**

**Director Mode is the frontend interaction layer where the "Human-in-the-Loop" (HITL) resolves the edge cases that the Auditor flagged but couldn't fix. It transforms a "Black Box" AI process into a "Grey Box" collaborative workflow.**

**The core philosophy here is Non-Destructive Correction. We rarely want to "Regenerate All" (which is expensive and random). We want to Nudge (Alignment) or Patch (Inpainting).**

---

### **UX Architecture: The "Timeline-Stage-Inspector" Layout**

**We will implement a dense, 3-pane layout similar to professional animation software (Aseprite, Adobe Animate), optimized for high-velocity review.**

#### **Pane 1: The Timeline (The Sequence)**

* **Visual: Horizontal filmstrip at the bottom.**  
* **State Indication:**  
  * **Green Border: APPROVED (Auditor passed or Human verified).**  
  * **Yellow Border: WARNING (HF03 Drift detected, AutoAligned).**  
  * **Red Border: FAILED (SF01/SF02 triggered).**  
* **Interaction: Click to load frame into the Stage. Drag to reorder (though rarely needed for generated sequences).**

#### **Pane 2: The Stage (The Workspace)**

* **Visual: Central canvas rendering the current frame at 4x zoom.**  
* **Key Feature: Onion Skinning.**  
  * **Render Frame\[i-1\] at 30% opacity *behind* Frame\[i\].**  
  * **Render Frame\[0\] (Anchor) at 15% opacity (toggleable) to check volume consistency.**  
* **Tools:**  
  * **Nudge Tool (Move): Drag the sprite. Updates deltaX/Y.**  
  * **Mask Pen (Inpaint): Draw red overlay on specific pixels (e.g., a malformed hand).**

#### **Pane 3: The Inspector (The Data)**

* **Metadata Display: Shows the Auditor Score, Palette Usage, and the exact Prompt used.**  
* **Action Panel:**  
  * **Approve: Locks the frame to disk.**  
  * **Reject & Retry: Triggers regeneration with higher Temperature.**  
  * **Patch: Sends the Mask \+ Instruction to the Inpainting Endpoint.**

---

### **Feature 1: The "Nudge" (Manual Alignment Override)**

**The AutoAligner is mechanical. Sometimes it's wrong because it detects a sword tip as the "floor."**

**Director Workflow:**

1. **User sees the sprite floating.**  
2. **User drags the sprite down 2 pixels.**  
3. **System Action: We do *not* edit the pixels immediately. We record a Human Delta.**

**Implementation: src/domain/director.ts**

**TypeScript**

**// The "Human Delta" prevents destructive editing until export.**

**export interface HumanAlignmentDelta {**

  **frameId: string;**

  **userOverrideX: number; // e.g., \+2**

  **userOverrideY: number; // e.g., \-4**

  **timestamp: string;**

**}**

**// React Hook logic for the Stage Component**

**const handleDragEnd \= (finalPos: Vector2) \=\> {**

  **const deltaX \= finalPos.x \- originalPos.x;**

  **const deltaY \= finalPos.y \- originalPos.y;**


  **// Dispatch to store**

  **updateFrameMetadata(currentFrame.id, {**

    **alignmentOverride: { x: deltaX, y: deltaY }**

  **});**


  **// Visual feedback: Update the border from Yellow to Green immediately**

  **setValidationStatus('APPROVED\_BY\_DIRECTOR');**

**};**

---

### **Feature 2: The "Patch" (Corrective Inpainting)**

**This is the most critical cost-saving feature. If the head and body are perfect but the *hand* is a blob, you do not want to regenerate the whole image (risking the body morphing). You want to fix *only* the hand.**

**Director Workflow:**

1. **Select Mask Pen.**  
2. **Draw over the malformed hand.**  
3. **Type Prompt: *"Clenched fist, darker skin tone."***  
4. **Click Patch.**

**Backend Logic (The Inpainting Payload):**

**We use a specialized Gemini call that respects the mask.**

**TypeScript**

**// src/adapters/generator/InpaintAdapter.ts**

**export async function patchFrame(**

  **originalImageBase64: string,**

  **maskImageBase64: string, // Black image with White pixels where we want change**

  **prompt: string**

**): Promise\<Buffer\> {**


  **// We treat the unmasked area as the "Anchor" strictly.**

  **const parts \= \[**

    **{ text: "TASK: Inpaint the masked area. Integrate seamlessley with existing pixel art style." },**

    **{ text: \`DETAIL INSTRUCTION: ${prompt}\` },**

    **{ inlineData: { mimeType: "image/png", data: originalImageBase64 } },**

    **{ inlineData: { mimeType: "image/png", data: maskImageBase64 } } // Gemini supports mask inputs**

  **\];**


  **// ... execute generation ...**

**}**

---

### **Feature 3: Visual Diffing (Auditor Feedback)**

**The Director needs to know *why* the Auditor complained.**

* **If SF01 (Palette) Failed:**  
  * **The UI highlights the "illegal" pixels in blinking magenta.**  
  * ***Action:*** **User can click "Legalize" to force-snap those pixels to the nearest Anchor color (using a Euclidean color distance algorithm).**  
* **If HF03 (Baseline) Warned:**  
  * **Draw a bright Cyan line at y=120 (The Anchor's floor).**  
  * **Draw a Red line at the current sprite's floor.**  
  * ***Action:*** **User instantly sees the gap and drags to match Red to Cyan.**

---

### **Operational Data Structure: The Session State**

**To manage this session, the frontend needs a robust state object that tracks the lifecycle of every frame.**

**TypeScript**

**export type FrameLifecycleStatus \=** 

  **| 'PENDING'       // Waiting for generation**

  **| 'GENERATED'     // Raw output from API**

  **| 'AUDIT\_FAIL'    // Blocked by Auditor**

  **| 'AUDIT\_WARN'    // Needs Director review (AutoAligned)**

  **| 'APPROVED';     // Locked**

**export interface DirectorSession {**

  **sessionId: string;**

  **moveId: string;**

  **anchorFrameId: string;**


  **// The Timeline**

  **frames: {**

    **\[index: number\]: {**

      **id: string;**

      **status: FrameLifecycleStatus;**

      **imageBase64: string; // The current visual state (including AutoAlign)**

      

      **// The Audit Log**

      **auditReport?: {**

        **flags: string\[\]; // \["HF03", "SF01"\]**

        **score: number;**

      **};**

      

      **// The Human Touch**

      **directorOverrides?: {**

        **alignment?: { x: number, y: number };**

        **isPatched: boolean;**

      **};**

    **}**

  **};**

**}**

### **Summary of the Full Pipeline**

1. **Prompting (Cat 6): Semantic Interleaving generates the raw frame.**  
2. **Auditor (Cat 4): Checks physics and palette. Auto-aligns if drift is minor.**  
3. **Director (Cat 8):**  
   * **Displays the Timeline with "Traffic Light" status borders.**  
   * **Allows Nudge (Alignment) for precision.**  
   * **Allows Patch (Inpainting) for detail fixes.**  
   * **Final Export: Bakes all Human Deltas into the final sprite sheet.**

**Next Step:**

**You now have the complete loop: Creation (Cat 6\) $\\rightarrow$ Validation (Cat 4\) $\\rightarrow$ Correction (Cat 8).**

**Would you like to move to Category 9: Pipeline Integration, specifically how to bundle this entire TypeScript logic into the Nano Banana Pro CLI tool so you can run banana gen \--move=walk \--interactive?**

**User: Yes please. Provide examples**

**This is the Deep Think Architecture Lock for Category 9: Pipeline Integration (CLI & Orchestration).**

**You now have the organs (Generator, Auditor, Director). Category 9 is the Nervous System that connects them. We will implement this as a CLI tool called banana, built on Node.js/TypeScript, which orchestrates the flow and spins up a local web server for the Director Mode interface.**

---

### **Architecture Overview: The "Hollow Shell" Pattern**

**The CLI is a "Hollow Shell." It does not contain business logic; it acts as a traffic controller.**

1. **Reads Manifests: Loads your Move definitions (from Category 6/FQ10).**  
2. **Invokes Services: Calls Generator (Cat 6\) $\\rightarrow$ Auditor (Cat 4).**  
3. **Serves UI: Launches a localhost server for Director Mode (Cat 8).**  
4. **Writes Disk: Commits the final sprite sheet.**

---

### **Component 1: The CLI Entry Point**

**We use commander for argument parsing and ora for terminal spinners.**

**File: src/cli/bin.ts**

**TypeScript**

**\#\!/usr/bin/env node**

**import { Command } from 'commander';**

**import { generateCommand } from './commands/generate';**

**const program \= new Command();**

**program**

  **.name('banana')**

  **.description('Nano Banana Pro \- AI Sprite Pipeline')**

  **.version('1.0.0');**

**// Register the core command**

**program.addCommand(generateCommand);**

**program.parse(process.argv);**

---

### **Component 2: The Command Logic (banana gen)**

**This is where the user intent (\--move=walk) is translated into architectural action.**

**File: src/cli/commands/generate.ts**

**TypeScript**

**import { Command } from 'commander';**

**import { PipelineOrchestrator } from '../../core/PipelineOrchestrator';**

**import { loadManifest } from '../../domain/manifest';**

**import { logger } from '../../utils/logger';**

**export const generateCommand \= new Command('gen')**

  **.description('Generate a sprite sequence')**

  **.requiredOption('-m, \--move \<id\>', 'The move ID (e.g., "walk\_forward")')**

  **.option('-i, \--interactive', 'Launch Director Mode for manual review', false)**

  **.action(async (options) \=\> {**

    

    **logger.info(\`Initializing Pipeline for move: ${options.move}\`);**

    

    **// 1\. Load the Definition (Category 6/FQ10)**

    **const moveDef \= loadManifest(options.move);**

    

    **// 2\. Initialize the Orchestrator**

    **const orchestrator \= new PipelineOrchestrator({**

      **interactive: options.interactive,**

      **outputDir: \`./output/${options.move}\`**

    **});**

    **try {**

      **// 3\. Run the Pipeline**

      **await orchestrator.execute(moveDef);**

      **process.exit(0);**

    **} catch (error) {**

      **logger.error('Pipeline failed:', error);**

      **process.exit(1);**

    **}**

  **});**

---

### **Component 3: The Orchestrator (The Brain)**

**This class implements the "Loop" defined in previous sessions: Generate $\\rightarrow$ Audit $\\rightarrow$ AutoAlign $\\rightarrow$ Review.**

**File: src/core/PipelineOrchestrator.ts**

**TypeScript**

**import { GeminiGeneratorAdapter } from '../adapters/generator/GeminiGeneratorAdapter'; // Cat 6**

**import { AuditorService } from '../processing/AuditorService'; // Cat 4**

**import { AutoAligner } from '../processing/AutoAligner'; // Cat 4**

**import { DirectorServer } from '../bridge/DirectorServer'; // Cat 8 Bridge**

**import { MoveDefinition, GeneratedFrame } from '../domain/interfaces';**

**import ora from 'ora';**

**export class PipelineOrchestrator {**

  **private generator: GeminiGeneratorAdapter;**

  **private auditor: AuditorService;**

  **private aligner: AutoAligner;**

  **private server: DirectorServer;**

  **constructor(private config: { interactive: boolean; outputDir: string }) {**

    **// Initialize services**

    **this.generator \= new GeminiGeneratorAdapter(process.env.GEMINI\_API\_KEY\!);**

    **this.auditor \= new AuditorService();**

    **this.aligner \= new AutoAligner();**

    **this.server \= new DirectorServer();**

  **}**

  **public async execute(moveDef: MoveDefinition) {**

    **const sessionFrames: GeneratedFrame\[\] \= \[\];**

    **const spinner \= ora('Starting Generation Loop...').start();**

    **// \--- PHASE 1: GENERATION LOOP \---**

    **for (let i \= 0; i \< moveDef.totalFrames; i++) {**

      **spinner.text \= \`Generating Frame ${i}/${moveDef.totalFrames}\`;**

      

      **// 1\. Generate (Cat 6 Logic)**

      **const ctx \= {**

        **frameIndex: i,**

        **moveId: moveDef.id,**

        **// ... build context from previous frames ...**

      **};**

      **const result \= await this.generator.generate(ctx);**

      

      **if (result.isErr()) {**

        **spinner.fail(\`Frame ${i} Failed: ${result.error.message}\`);**

        **continue; // or break based on policy**

      **}**

      **let frame \= result.value;**

      **// 2\. Audit (Cat 4 Logic)**

      **const audit \= await this.auditor.audit(frame, ctx);**

      

      **// 3\. Auto-Align (Mechanical Fix)**

      **if (audit.correction \=== 'ALIGN') {**

        **frame.data \= this.aligner.alignToBaseline(frame.data, moveDef.baselineY);**

        **audit.status \= 'WARNING'; // Mark as "Needs Review"**

      **}**

      **sessionFrames.push({ ...frame, auditReport: audit });**

    **}**

    **spinner.succeed('Batch Generation Complete.');**

    **// \--- PHASE 2: DIRECTOR MODE (Cat 8\) \---**

    **if (this.config.interactive) {**

      **console.log('🚀 Launching Director Mode...');**

      

      **// Spin up the local web server to host the React UI**

      **await this.server.start({**

        **port: 3000,**

        **initialState: sessionFrames,**

        **onCommit: async (finalFrames) \=\> {**

          **await this.saveToDisk(finalFrames);**

          **this.server.stop();**

        **}**

      **});**

      

      **console.log('👉 Open http://localhost:3000 to review and patch sprites.');**

      

      **// Keep process alive until server closes**

      **await this.server.waitForClose();**

    **} else {**

      **// Auto-save if not interactive**

      **await this.saveToDisk(sessionFrames);**

    **}**

  **}**

  **private async saveToDisk(frames: GeneratedFrame\[\]) {**

    **// ... write PNGs to config.outputDir ...**

  **}**

**}**

---

### **Component 4: The Director Bridge (Local Server)**

**Since the terminal cannot support the drag-and-drop "Nudge" or "Inpainting" tools described in Category 8, the CLI must act as a web server.**

**File: src/bridge/DirectorServer.ts**

**TypeScript**

**import express from 'express';**

**import { Server } from 'http';**

**import { WebSocketServer } from 'ws';**

**export class DirectorServer {**

  **private app \= express();**

  **private server: Server | null \= null;**

  **private resolveClose\!: () \=\> void;**

  **public async start(config: { port: number, initialState: any, onCommit: Function }) {**

    

    **// 1\. Serve the Static React App (The Director UI)**

    **this.app.use(express.static(\_\_dirname \+ '/../../ui/build'));**

    **// 2\. API to fetch the current session state**

    **this.app.get('/api/session', (req, res) \=\> res.json(config.initialState));**

    **// 3\. API to handle "Patch" requests (Inpainting)**

    **this.app.post('/api/patch', async (req, res) \=\> {**

      **// Calls Gemini Inpaint Adapter (Cat 8 Feature)**

      **// Returns new image buffer**

    **});**

    **// 4\. API to Commit (Save & Quit)**

    **this.app.post('/api/commit', async (req, res) \=\> {**

      **await config.onCommit(req.body.frames);**

      **res.sendStatus(200);**

      **this.close();**

    **});**

    **return new Promise\<void\>((resolve) \=\> {**

      **this.server \= this.app.listen(config.port, () \=\> resolve());**

    **});**

  **}**

  **public waitForClose() {**

    **return new Promise\<void\>(resolve \=\> { this.resolveClose \= resolve; });**

  **}**

  **private close() {**

    **this.server?.close();**

    **this.resolveClose();**

  **}**

**}**

---

### **Operational Workflow**

**Now, when you run the command, the entire architecture comes to life.**

**User Input:**

**Bash**

**$ banana gen \--move=walk\_forward \--interactive**

**System Output:**

**Plaintext**

**ℹ Initializing Pipeline for move: walk\_forward**

**✔ Loaded Manifest (8 Frames, 8 Phases)**

**✔ \[GEN\] Frame 0/8 Generated (Anchor)**

**✔ \[GEN\] Frame 1/8 Generated (Audit Score: 0.98)**

**⚠ \[GEN\] Frame 2/8 Auto-Aligned (Drift detected: \+4px)**

**...**

**✔ Batch Generation Complete.**

**🚀 Launching Director Mode...**

**👉 Open http://localhost:3000 to review and patch sprites.**

**Browser Interaction (Director Mode):**

1. **You open localhost:3000.**  
2. **You see Frame 2 has a yellow border (Auto-Aligned).**  
3. **You toggle Onion Skinning. It looks slightly off.**  
4. **You Nudge it down 1 more pixel using the UI.**  
5. **You click Commit.**

**System Output:**

**Plaintext**

**✔ Session Committed.**

**✔ Files saved to ./output/walk\_forward/**

**✨ Pipeline Finished.**

### **Final Architectural Check**

* **Category 6 (Prompting): Encapsulated inside GeminiGeneratorAdapter.**  
* **Category 4 (Auditor): Encapsulated inside AuditorService.**  
* **Category 8 (Director): Served via DirectorServer and accessed via browser.**  
* **Category 9 (Pipeline): The banana CLI that binds them.**

**Next Step:**

**This concludes the backend and pipeline architecture. You have a fully specified system from Prompt to CLI.**

**Would you like me to generate the package.json and project structure (folder tree) so you can scaffold this repository immediately?**

