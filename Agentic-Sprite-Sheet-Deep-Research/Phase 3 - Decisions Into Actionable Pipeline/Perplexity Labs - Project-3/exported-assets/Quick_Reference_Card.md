# Sprite Export Compliance Quick Reference Card
## One-Page Diagnostic & Execution Checklist

**Print this. Laminate it. Keep it at your desk.**

---

## EXPORT EXECUTION WORKFLOW

### STEP 1: Pre-Export (Before Running TexturePacker/Aseprite)

```
☐ Source Frame Check
  ☐ All frames 64×64px consistent sourceSize (or document variance)
  ☐ Alpha channel: 0 (transparent) or 255 (opaque), no semi-transparency
  ☐ Folder structure: {CHAR}/moves/{ACTION}/approved/frame_*.png
  ☐ Frame names: frame_0001.png, frame_0002.png, ... (zero-padded)
  ☐ No special characters in file/folder names

☐ Define Expected Frames
  ☐ Walk: 8 frames
  ☐ Punch: 6 frames
  ☐ Kick: 7 frames
  ☐ [Add your animations] ☐ ___ : ___ frames
  ☐ [Add your animations] ☐ ___ : ___ frames

☐ Confirm Character ID
  ☐ CHAR_ID = [_____] (e.g., "sean", "ryu")
  ☐ Output dir: ./exports/phaser/{CHAR_ID}/
```

### STEP 2: Run Export Command

**Using TexturePacker (Single Atlas):**
```bash
TexturePacker \
  --format phaser \
  --sheet ./exports/phaser/{CHAR_ID}/atlas.png \
  --data ./exports/phaser/{CHAR_ID}/atlas.json \
  --trim-mode Trim \
  --extrude 1 \
  --shape-padding 2 \
  --border-padding 2 \
  --disable-rotation \
  --alpha-handling ReduceBorderArtifacts \
  --max-size 2048 \
  --trim-sprite-names \
  --prepend-folder-name \
  ./assets_src/characters/{CHAR_ID}/moves/*/approved/
```

**Using Aseprite (Per-Tag):**
```bash
aseprite -b {CHAR_ID}.aseprite \
  --tag {ACTION} \
  --sheet ./exports/{CHAR_ID}_{ACTION}.png \
  --data ./exports/{CHAR_ID}_{ACTION}.json \
  --format json-hash \
  --sheet-pack \
  --trim \
  --extrude \
  --shape-padding 2 \
  --border-padding 2
```

### STEP 3: Validate Output Files

```
☐ File Integrity Check
  ☐ Files created:
    ☐ atlas.png exists (readable PNG)
    ☐ atlas.json exists (valid JSON)
  ☐ PNG format correct:
    ☐ file atlas.png → shows "PNG image data"
    ☐ identify -verbose atlas.png | grep "Colorspace:" → not "Gray"

☐ JSON Validity
  ☐ jq . atlas.json > /dev/null (no syntax errors)
  ☐ Meta fields present:
    ☐ .meta.image = "atlas.png"
    ☐ .meta.size.w = [PNG width]
    ☐ .meta.size.h = [PNG height]
  ☐ Frames count > 0:
    ☐ jq '.frames | length' atlas.json = [_____]

☐ Frame Key Format Validation
  ☐ List keys: jq '.frames | keys[] | .[0:5]' atlas.json
  ☐ Expected pattern: walk/0001, walk/0002, ... (no .png)
  ☐ NO .png extension in keys? ☐ YES (correct) ☐ NO (re-check --trim-sprite-names)
  ☐ Duplicates? ☐ NO (good) ☐ YES (ERROR - re-export)

☐ Frame Data Integrity
  ☐ Sample frame check:
    ☐ jq '.frames["walk/0001"]' atlas.json | verify:
      ☐ frame: {x, y, w, h} all integers ≥ 0
      ☐ sourceSize: {w, h} present
      ☐ spriteSourceSize: {x, y, w, h} present
      ☐ pivot: {x, y} values in [0, 1] (e.g., 0.5, 1.0)
      ☐ rotated: false
      ☐ trimmed: true or false (consistent with --trim-mode Trim)

☐ Visual Inspection (PNG)
  ☐ Open atlas.png in image viewer, zoom to 200%
  ☐ Check sprite edges:
    ☐ NO dark halos or fringing (✓ looks clean)
    ☐ NO color bleeding from adjacent sprites
    ☐ Transparent areas look correct
```

---

## PHASER INTEGRATION CHECKLIST

### STEP 4: Load Texture in Preload

```javascript
preload() {
    ☐ this.load.atlas(
        'sean',                    // texture key
        'assets/sean/atlas.png',   // PNG file
        'assets/sean/atlas.json'   // JSON file
    );
}
```

### STEP 5: Set Filtering & Pivot in Create

```javascript
create() {
    ☐ Set pixel-perfect filtering:
      this.textures.get('sean').setFilterMode(
          Phaser.Textures.FilterMode.NEAREST
      );
    
    ☐ Option A - Set pivot per-frame (IF needed):
      const texture = this.textures.get('sean');
      texture.getFrameNames().forEach(name => {
          const frame = texture.get(name);
          frame.customPivot = true;
          frame.pivotX = 0.5;   // Horizontal center
          frame.pivotY = 1.0;   // Bottom (feet for standing character)
      });
    
    ☐ Option B - Set origin per-sprite:
      const sean = this.add.sprite(100, 100, 'sean', 'walk/0001');
      sean.setOrigin(0.5, 1);  // Same as pivot above
}
```

### STEP 6: Create Animations

```javascript
create() {
    // For EACH action (walk, punch, kick, ...):
    
    ☐ Generate frame names:
      const walkFrames = this.anims.generateFrameNames('sean', {
          start: 1,
          end: 8,
          zeroPad: 4,
          prefix: 'walk/',
          suffix: ''      // Empty if using --trim-sprite-names
      });
    
    ☐ Create animation:
      this.anims.create({
          key: 'walk',
          frames: walkFrames,
          frameRate: 10,
          repeat: -1
      });
    
    ☐ Repeat for: punch, kick, etc.
}
```

### STEP 7: Play Animation

```javascript
update() {
    ☐ Create sprite:
      const sean = this.add.sprite(100, 100, 'sean', 'walk/0001');
    
    ☐ Play animation:
      sean.play('walk');
    
    ☐ Verify playback (no jitter, smooth movement)
}
```

---

## DIAGNOSTICS & TROUBLESHOOTING

### Symptom: "Frame not found" Error

```
☐ Step 1: Get actual frame keys
  jq '.frames | keys[0:3]' atlas.json
  Expected output: ["walk/0001", "walk/0002", "walk/0003"]

☐ Step 2: Check generateFrameNames parameters
  suffix: '' should match actual keys (NO .png in names)
  
☐ Step 3: Test one frame directly
  this.add.sprite(100, 100, 'sean', 'walk/0001')
  If this fails → naming policy mismatch
  
☐ Action: Re-run validator (see Section D in main kit)
```

### Symptom: Animation Jitters (Vertical Bounce)

```
☐ Step 1: Check pivot consistency
  jq '.frames | map(.pivot) | unique' atlas.json
  Should show only ONE pivot value per action (or very close)
  
☐ Step 2: Check sourceSize consistency
  jq '.frames | map(.sourceSize) | unique' atlas.json
  Should be identical across all frames in animation
  
☐ Step 3: Check spriteSourceSize variance
  jq '.frames | map(.spriteSourceSize.y) | max - min' atlas.json
  Should be ≤ 1px (trim offset variance)
  
☐ Step 4: If jitter visible
  ☐ Try --trim-mode None instead of Trim
  ☐ Or run TEST-03 (Trim Jitter Test) to validate settings
  
☐ Action: Re-export with corrected settings
```

### Symptom: Dark Halos/Fringing Around Sprites

```
☐ Step 1: Verify export flags used
  ☐ --alpha-handling ReduceBorderArtifacts (required)
  ☐ --extrude 1 (required)
  ☐ --shape-padding 2 (required)
  ☐ --border-padding 2 (required)
  
☐ Step 2: Check source PNG for pre-existing halos
  Open original frame PNGs at 200% zoom
  ☐ NO halos (export settings to blame)
  ☐ YES halos (pre-process the frames)
  
☐ Step 3: Verify Phaser filtering
  this.textures.get('sean').setFilterMode(FilterMode.NEAREST)
  Must be called; don't rely on pixelArt: true alone
  
☐ Action: Re-export if flags wrong; pre-process frames if source issue
```

### Symptom: Animation Looks Blurry

```
☐ Step 1: Check filtering mode
  texture.setFilterMode(FilterMode.NEAREST) — REQUIRED
  
☐ Step 2: Check game config
  const config = {
      pixelArt: true,    // Should be true
      ...
  };
  
☐ Step 3: Check PNG format
  identify atlas.png | grep -i "class:"
  Should NOT be "Grayscale" or "Indexed"
  
☐ Action: Set FilterMode.NEAREST and pixelArt: true
```

---

## PRE-COMMIT CHECKLIST (Before Merging Export to Version Control)

```
☐ All expected animations present
  ☐ walk: 8 frames
  ☐ punch: 6 frames
  ☐ kick: 7 frames
  [Add your animations]

☐ Naming policy validated
  ☐ Validator returned PASS
  ☐ No missing keys
  ☐ No extra keys (or documented)

☐ Visual QA
  ☐ Zoom to 200%, check sprite edges (no halos)
  ☐ Load in game, play animation (no jitter, smooth)
  ☐ Test 3+ characters if multi-character export

☐ File size reasonable
  ☐ atlas.png ≤ 2 MB (single atlas mobile)
  ☐ atlas1.png + atlas2.png ≤ 3 MB (multipack)

☐ Git commit message
  ☐ "Sprite Export: {CHAR_ID} - {ACTION1}, {ACTION2} - VALIDATED"

☐ Document any deviations
  ☐ If using --trim-mode None instead of Trim → document why
  ☐ If using .png suffix instead of no suffix → document why
  ☐ If pivot differs from default (0.5, 1.0) → document per-action
```

---

## QUICK REFERENCE: Standard Policy

```
NAMING POLICY (Official)
─────────────────────────
Prefix:   {ACTION}/        (e.g., "walk/")
ZeroPad:  4                (e.g., 0001, 0002, 0008)
Suffix:   "" (empty)       (no .png extension)

Full Example: walk/0001, walk/0002, ..., walk/0008

EXPORT FLAGS (Standard TexturePacker)
──────────────────────────────────────
--format phaser
--trim-mode Trim
--extrude 1
--shape-padding 2
--border-padding 2
--disable-rotation
--alpha-handling ReduceBorderArtifacts
--max-size 2048
--trim-sprite-names
--prepend-folder-name

PHASER CODE (Standard)
──────────────────────
// Load
this.load.atlas('sean', 'assets/sean/atlas.png', 'assets/sean/atlas.json');

// Set filtering
this.textures.get('sean').setFilterMode(FilterMode.NEAREST);

// Generate frames
const frames = this.anims.generateFrameNames('sean', {
    start: 1, end: 8, zeroPad: 4,
    prefix: 'walk/', suffix: ''
});

// Create animation
this.anims.create({ key: 'walk', frames, frameRate: 10, repeat: -1 });

// Play
sprite.play('walk');
```

---

## CONTACT / ESCALATION

```
If you encounter an error NOT in the troubleshooting guide:

1. Check the main Compliance Kit (Phaser3_Export_Compliance_Kit.md)
   ☐ Section A: Preflight Checklist
   ☐ Section D: Naming Policy Validator
   ☐ Section E: Micro-test Harness

2. Check the Risk Register (CLI_Verification_RiskRegister.md)
   ☐ Part 3: Known Gotchas
   ☐ Part 6: Troubleshooting Guide

3. Run the relevant test
   ☐ TEST-02: Pivot Auto-Apply (if alignment wrong)
   ☐ TEST-03: Trim Mode (if jitter detected)
   ☐ TEST-04: Suffix Convention (if "frame not found")

4. Document the error & escalate
   ☐ File: atlas.json (share sample)
   ☐ Error message: [_____]
   ☐ Steps to reproduce: [_____]
   ☐ Phaser version: [_____]
   ☐ TexturePacker version: [_____]
```

---

**Version:** 1.0 | **Laminate Date:** __________ | **Owner:** __________