# Phaser 3 Sprite Atlas Export Compliance Kit
## Complete Toolset for Preventing Broken Exports

**Version:** 1.0 | **Date:** January 2026 | **Status:** Production-Ready

---

## TABLE OF CONTENTS

1. [A) Export Preflight Checklist](#a-export-preflight-checklist)
2. [B) Command Templates](#b-command-templates)
3. [C) Phaser Integration Snippets](#c-phaser-integration-snippets)
4. [D) Naming Policy Validator Spec](#d-naming-policy-validator-spec)
5. [E) Micro-test Harness](#e-micro-test-harness)

---

# A) EXPORT PREFLIGHT CHECKLIST

## A.1 Pre-Export Validation (Source Assets)

### Frame Dimensions
- [ ] All frames in animation have consistent **sourceSize** (before trimming)
  - e.g., all "walk" frames are 64×64px in source
  - *Why:* Phaser's trimmed offsets depend on consistent source dimensions
- [ ] No frame exceeds **max-size** limit (2048px for mobile, 4096px for desktop)
- [ ] All frames use **opaque/transparent** consistently (no partial alpha)
  - *Why:* Trim mode behaves differently with partial alpha

### Alpha Channel
- [ ] Transparent pixels are completely transparent (alpha = 0)
  - Not semi-transparent halos or gradual fadeouts
  - *Why:* `--alpha-handling ReduceBorderArtifacts` expects clean edges
- [ ] Background color (if keyed) is distinct from sprite colors
  - e.g., pure green (#00FF00) if using chroma key
  - *Why:* Matte extraction must cleanly separate BG from sprite

### Naming Conventions (Source Folder Structure)
- [ ] Folder structure follows pattern: `{CHAR_ID}/moves/{MOVE_NAME}/approved/`
  - *Example:* `sean/moves/walk/approved/frame_0001.png`
- [ ] File names are numberable: `frame_XXXX.png` where X is zero-padded
  - *Why:* TexturePacker `--trim-sprite-names` relies on consistent numbering
- [ ] No special characters in file/folder names
  - No spaces, unicode, forward slashes in individual names
  - *Why:* JSON key generation may fail with special characters

---

## A.2 Pre-Export Export Settings Checklist

### TexturePacker Settings
- [ ] **Format:** `--format phaser` (not "phaser-3-hash" or "phaser-3-array")
  - *Reason:* Only "phaser" supports pivot, multipack, and 9-slice
- [ ] **Trim Mode:** `--trim-mode Trim` (not Crop or None)
  - *Reason:* Preserves anchor point; removes just transparency
- [ ] **Extrude:** `--extrude 1`
  - *Reason:* Prevents texture bleeding at atlas edges
- [ ] **Shape Padding:** `--shape-padding 2`
  - *Reason:* Prevents neighbor-pixel bleed during WebGL filtering
- [ ] **Border Padding:** `--border-padding 2`
  - *Reason:* Prevents edge-of-atlas bleeding
- [ ] **Rotation:** `--disable-rotation`
  - *Reason:* Framework doesn't expect rotated frames
- [ ] **Alpha Handling:** `--alpha-handling ReduceBorderArtifacts`
  - *Reason:* Removes dark halos at transparent borders (critical for pixel art)
- [ ] **Max Size:** `--max-size 2048` (mobile) or `4096` (desktop)
  - *Reason:* Safe WebGL texture limits per Phaser docs
- [ ] **Sprite Name Trimming:** `--trim-sprite-names`
  - *Reason:* Removes `.png` extension from JSON keys
- [ ] **Folder Prepend:** `--prepend-folder-name`
  - *Reason:* Preserves action name in frame key (e.g., "walk/0001" not just "0001")

### Aseprite Settings (if used)
- [ ] **Format:** `--format json-hash`
- [ ] **Extrude:** `--extrude` (flag only, no value)
- [ ] **Shape Padding:** `--shape-padding 2`
- [ ] **Border Padding:** `--border-padding 2`
- [ ] **Trim:** `--trim` (flag)
  - *Why:* Removes transparent pixels
- [ ] **Sheet Type:** `--sheet-pack` (equivalent to `--sheet-type packed`)
  - *Reason:* Automatic optimal packing

---

## A.3 Post-Export Validation (Atlas JSON & PNG)

### JSON Structure
- [ ] **meta.image** field present and correct
  - Must match actual PNG file name (e.g., "atlas.png" or "atlas1.png")
- [ ] **meta.size** matches actual PNG dimensions
  - Verify: `file.width === meta.size.w` and `file.height === meta.size.h`
- [ ] **frames** object is not empty
  - Minimum 1 frame per animation
- [ ] All frame keys match **naming policy**
  - See Section D for exact validator

### Frame Data Integrity
- [ ] No duplicate frame keys in `frames` object
  ```bash
  # Quick check:
  jq '.frames | keys | sort | .[].[] | select(. == prev) | .' atlas.json
  ```
- [ ] Each frame has required fields:
  - `frame.x`, `frame.y`, `frame.w`, `frame.h` (integers, ≥0)
  - `sourceSize.w`, `sourceSize.h` (original dimensions before trim)
  - `spriteSourceSize` (offset within sourceSize)
  - `trimmed` (boolean, true if trim removed pixels)
  - `rotated` (boolean, should be false if `--disable-rotation` used)
  - `pivot` (object with x, y ∈ [0, 1]) — **optional but recommended**
- [ ] Pivot values in range [0, 1] (normalized coordinates)
  - x=0.5, y=1.0 = bottom-center (standard for standing characters)

### PNG Integrity
- [ ] PNG file is valid and readable
  ```bash
  file atlas.png  # Should show "PNG image data"
  ```
- [ ] PNG dimensions match JSON meta.size
- [ ] PNG is RGB or RGBA (not indexed)
  ```bash
  identify -verbose atlas.png | grep "Colorspace:"
  ```
- [ ] Visual inspection: no visible halos or fringing
  - Zoom into sprite edges in image viewer
  - No dark artifacts at transparent borders

### Frame Key Format (Naming Policy)
- [ ] All keys match pattern: `{PREFIX}{ZERO_PAD}{SUFFIX}`
  - Typical pattern: `walk/0001` (no ".png" if `--trim-sprite-names` used)
  - See Section D for exact policy specification
- [ ] No frame keys include file extension (if `--trim-sprite-names` used)
- [ ] Suffix consistency: all keys either have `.png` or none have it

### Multipack-Specific Checks
- [ ] If multipack export, JSON contains references to multiple images
  - e.g., meta lists "atlas1.png", "atlas2.png", etc.
- [ ] All referenced PNG files exist and are readable
- [ ] Frame distribution is reasonable (no missing sheets)
  - Verify all frames are present across all sheets

---

## A.4 Post-Export Animation Coverage Checks

### Frame Count Validation
- [ ] Expected frame count matches actual frame count
  - Formula: `start + (end - start + 1) = total`
  - Example: walk animation frames 1-8 = 8 frames expected
- [ ] No skipped frame numbers (e.g., walk has 0001, 0002, 0003...0008, not 0001, 0002, 0004)
- [ ] Frame order is deterministic in `meta.frameTags` (if present from Aseprite)

### Aseprite-Specific (if source is Aseprite)
- [ ] `meta.frameTags` array present if tags were used
- [ ] Each frameTags entry has: `name`, `from`, `to`, `direction`
  - Example: `{name: "walk", from: 0, to: 7, direction: "forward"}`
- [ ] `meta.layers` array lists all layers exported
- [ ] `meta.slices` array contains pivot data if slices were defined
  - Each slice.keys[].pivot should have {x, y} in pixel coordinates

---

# B) COMMAND TEMPLATES

## B.1 TexturePacker CLI Template (Single Atlas)

```bash
# ============================================================================
# SINGLE ATLAS EXPORT (all frames in one PNG + one JSON)
# ============================================================================
# Usage: Replace {PLACEHOLDERS} with actual values, then run

TexturePacker \
  --format phaser \
  --sheet {EXPORT_DIR}/{CHAR_ID}/atlas.png \
  --data {EXPORT_DIR}/{CHAR_ID}/atlas.json \
  --trim-mode Trim \
  --extrude 1 \
  --shape-padding 2 \
  --border-padding 2 \
  --disable-rotation \
  --alpha-handling ReduceBorderArtifacts \
  --max-size 2048 \
  --trim-sprite-names \
  --prepend-folder-name \
  {ASSETS_SRC}/characters/{CHAR_ID}/moves/*/approved/

# ============================================================================
# EXAMPLE (Sean character, walk + punch animations)
# ============================================================================
# TexturePacker \
#   --format phaser \
#   --sheet ./exports/phaser/sean/atlas.png \
#   --data ./exports/phaser/sean/atlas.json \
#   --trim-mode Trim \
#   --extrude 1 \
#   --shape-padding 2 \
#   --border-padding 2 \
#   --disable-rotation \
#   --alpha-handling ReduceBorderArtifacts \
#   --max-size 2048 \
#   --trim-sprite-names \
#   --prepend-folder-name \
#   ./assets_src/characters/sean/moves/*/approved/

# ============================================================================
# PLACEHOLDER DEFINITIONS
# ============================================================================
# {CHAR_ID}         = Character identifier (e.g., "sean", "ryu")
# {EXPORT_DIR}      = Output directory (e.g., "./exports/phaser")
# {ASSETS_SRC}      = Source assets directory (e.g., "./assets_src")
# {MAX_SIZE}        = Max texture dimension: 2048 (mobile) or 4096 (desktop)
```

### Notes
- The glob `moves/*/approved/` automatically picks up all action subdirectories
- PNG file name becomes the texture key in Phaser: `this.load.atlas('sean', ...)`
- Frame names will be: `walk/0001`, `walk/0002`, etc. (due to `--prepend-folder-name`)

---

## B.2 TexturePacker CLI Template (Multipack/Multiatlas)

```bash
# ============================================================================
# MULTIPACK EXPORT (frames split across multiple PNGs, one JSON)
# ============================================================================
# Usage: Use this if atlas exceeds 2048×2048 and needs auto-splitting

TexturePacker \
  --format phaser \
  --sheet {EXPORT_DIR}/{CHAR_ID}/atlas{n}.png \
  --data {EXPORT_DIR}/{CHAR_ID}/atlas.json \
  --multipack \
  --trim-mode Trim \
  --extrude 1 \
  --shape-padding 2 \
  --border-padding 2 \
  --disable-rotation \
  --alpha-handling ReduceBorderArtifacts \
  --max-size 2048 \
  --trim-sprite-names \
  --prepend-folder-name \
  {ASSETS_SRC}/characters/{CHAR_ID}/moves/*/approved/

# ============================================================================
# EXAMPLE OUTPUT (Sean character, large sprite set)
# ============================================================================
# Files created:
#   - ./exports/phaser/sean/atlas.json       (single JSON references all PNGs)
#   - ./exports/phaser/sean/atlas1.png       (sheet 1)
#   - ./exports/phaser/sean/atlas2.png       (sheet 2)
#   - ./exports/phaser/sean/atlas3.png       (if needed)

# Phaser loading:
#   this.load.multiatlas('sean', 'assets/sean/atlas.json', 'assets/sean/');

# ============================================================================
# KEY DIFFERENCES FROM SINGLE ATLAS
# ============================================================================
# 1. --sheet uses {n} placeholder → atlas1.png, atlas2.png, etc.
# 2. --multipack flag tells TexturePacker to auto-split
# 3. Single JSON (atlas.json) references all frame data across sheets
# 4. Phaser loader changes to multiatlas() instead of atlas()
# 5. Frame names are IDENTICAL (walk/0001 still points to frame, just different sheet)
```

### Multipack Validation Checklist
- [ ] All `atlas{n}.png` files exist (atlas1.png, atlas2.png, etc.)
- [ ] No gaps in numbering (atlas1, atlas2, atlas4 = ERROR, should be atlas1, atlas2, atlas3)
- [ ] JSON meta contains references to all sheet files
- [ ] Frame lookup still deterministic: `getFrameNames()` returns all frames in order

---

## B.3 Aseprite CLI Template (Per-Tag Export)

```bash
# ============================================================================
# ASEPRITE: SINGLE SHEET (all frames)
# ============================================================================

aseprite -b {SOURCE_FILE}.aseprite \
  --sheet {OUTPUT_DIR}/{CHAR_ID}_sheet.png \
  --data {OUTPUT_DIR}/{CHAR_ID}_sheet.json \
  --format json-hash \
  --list-tags \
  --list-layers \
  --list-slices \
  --sheet-pack \
  --trim \
  --extrude \
  --shape-padding 2 \
  --border-padding 2

# EXAMPLE:
# aseprite -b ./ryu.aseprite \
#   --sheet ./exports/ryu_sheet.png \
#   --data ./exports/ryu_sheet.json \
#   --format json-hash \
#   --list-tags \
#   --sheet-pack \
#   --trim \
#   --extrude \
#   --shape-padding 2 \
#   --border-padding 2

# ============================================================================
# ASEPRITE: PER-TAG EXPORT (workaround for --split-tags limitation)
# ============================================================================
# NOTE: Aseprite's --split-tags ONLY works with --save-as, not --sheet
# For per-tag sheets, must loop over tags with separate commands

# 1. First, get tag list:
# aseprite -b {SOURCE_FILE}.aseprite --list-tags > tags.txt

# 2. Then, for each tag, run separate export:
aseprite -b {SOURCE_FILE}.aseprite \
  --tag {TAG_NAME} \
  --sheet {OUTPUT_DIR}/{CHAR_ID}_{TAG_NAME}_sheet.png \
  --data {OUTPUT_DIR}/{CHAR_ID}_{TAG_NAME}_sheet.json \
  --format json-hash \
  --sheet-pack \
  --trim \
  --extrude \
  --shape-padding 2 \
  --border-padding 2

# EXAMPLE (iterate over tags: idle, walk, punch):
# aseprite -b ryu.aseprite --tag idle --sheet exports/ryu_idle_sheet.png ...
# aseprite -b ryu.aseprite --tag walk --sheet exports/ryu_walk_sheet.png ...
# aseprite -b ryu.aseprite --tag punch --sheet exports/ryu_punch_sheet.png ...

# ============================================================================
# ASEPRITE: WITH SCALING
# ============================================================================

aseprite -b {SOURCE_FILE}.aseprite \
  --scale {SCALE_FACTOR} \
  --sheet {OUTPUT_DIR}/{CHAR_ID}_sheet_{SCALE_FACTOR}x.png \
  --data {OUTPUT_DIR}/{CHAR_ID}_sheet_{SCALE_FACTOR}x.json \
  --format json-hash \
  --sheet-pack \
  --trim \
  --extrude \
  --shape-padding 2 \
  --border-padding 2

# EXAMPLE (2x scale for HD output):
# aseprite -b ryu.aseprite \
#   --scale 2 \
#   --sheet exports/ryu_sheet_2x.png \
#   --data exports/ryu_sheet_2x.json \
#   --format json-hash \
#   --sheet-pack \
#   --trim \
#   --extrude \
#   --shape-padding 2 \
#   --border-padding 2

# ============================================================================
# PLACEHOLDER DEFINITIONS
# ============================================================================
# {SOURCE_FILE}      = Aseprite project file (e.g., "ryu.aseprite")
# {OUTPUT_DIR}       = Export directory (e.g., "./exports")
# {CHAR_ID}          = Character ID (e.g., "ryu", "sean")
# {TAG_NAME}         = Aseprite animation tag (e.g., "idle", "walk")
# {SCALE_FACTOR}     = Integer scale (e.g., 2, 3)
```

### Important Notes (Aseprite-Specific)

1. **--extrude is a flag (no value)**
   - `--extrude` adds 1px duplication automatically
   - Different from TexturePacker's `--extrude 1` (which is configurable)

2. **Per-tag export requires looping**
   - `--split-tags` ONLY works with `--save-as`, not `--sheet`
   - Recommended: write shell script or Python loop to generate commands

3. **JSON output differences from TexturePacker**
   - Aseprite includes `meta.frameTags[]` array (tag definitions)
   - Aseprite includes `meta.layers[]` array (layer info)
   - Aseprite includes `meta.slices[]` array (with pivot data per slice)
   - **NO per-frame pivot in Aseprite** (pivot only in slices)

---

## B.4 Bash Script Template (Full Pipeline)

```bash
#!/bin/bash
# ============================================================================
# SPRITE ATLAS EXPORT PIPELINE
# Automated multi-character, multi-animation export
# ============================================================================

set -e  # Exit on error

# ============================================================================
# CONFIGURATION
# ============================================================================
ASSETS_SRC="./assets_src/characters"
EXPORT_DIR="./exports/phaser"
CHAR_IDS=("sean" "ryu" "cammy")  # Add your character IDs here
MAX_SIZE=2048
TEXTURE_PACKER_BIN="/Applications/TexturePacker.app/Contents/MacOS/TexturePacker"  # Path to TP binary

# ============================================================================
# FUNCTIONS
# ============================================================================

export_character() {
    local char_id=$1
    local source_dir="${ASSETS_SRC}/${char_id}/moves"
    local out_dir="${EXPORT_DIR}/${char_id}"
    
    echo "=========================================="
    echo "Exporting: ${char_id}"
    echo "=========================================="
    
    # Create output directory
    mkdir -p "${out_dir}"
    
    # Run TexturePacker
    ${TEXTURE_PACKER_BIN} \
        --format phaser \
        --sheet "${out_dir}/atlas.png" \
        --data "${out_dir}/atlas.json" \
        --trim-mode Trim \
        --extrude 1 \
        --shape-padding 2 \
        --border-padding 2 \
        --disable-rotation \
        --alpha-handling ReduceBorderArtifacts \
        --max-size ${MAX_SIZE} \
        --trim-sprite-names \
        --prepend-folder-name \
        "${source_dir}/*/approved/"
    
    echo "✓ Exported: ${out_dir}/atlas.png + atlas.json"
    
    # Run validation
    validate_atlas "${out_dir}/atlas.json"
}

validate_atlas() {
    local json_file=$1
    
    echo "  Validating JSON..."
    
    # Check JSON is valid
    if ! jq . "${json_file}" > /dev/null 2>&1; then
        echo "  ✗ ERROR: Invalid JSON in ${json_file}"
        exit 1
    fi
    
    # Count frames
    local frame_count=$(jq '.frames | length' "${json_file}")
    echo "  ✓ Found ${frame_count} frames"
    
    # Check meta.image matches file location
    local image_name=$(jq -r '.meta.image' "${json_file}")
    local expected_image="atlas.png"
    if [ "${image_name}" != "${expected_image}" ]; then
        echo "  ⚠ WARNING: meta.image is '${image_name}', expected '${expected_image}'"
    fi
}

# ============================================================================
# MAIN
# ============================================================================

echo "Starting sprite atlas export pipeline..."
echo "Source: ${ASSETS_SRC}"
echo "Output: ${EXPORT_DIR}"
echo ""

for char_id in "${CHAR_IDS[@]}"; do
    export_character "${char_id}"
    echo ""
done

echo "=========================================="
echo "✓ All exports completed!"
echo "=========================================="
```

### Usage
```bash
chmod +x export_pipeline.sh
./export_pipeline.sh
```

---

# C) PHASER INTEGRATION SNIPPETS

## C.1 Preload Examples

### Single Atlas (Most Common)
```javascript
preload() {
    // Load single atlas: one PNG + one JSON
    this.load.atlas(
        'sean',                      // texture key (used later to reference)
        'assets/sean/atlas.png',     // sprite sheet PNG
        'assets/sean/atlas.json'     // frame data JSON
    );
}
```

### Multiatlas (Multiple PNGs, Single JSON)
```javascript
preload() {
    // Load multiatlas: multiple PNGs (atlas1.png, atlas2.png, ...) + one JSON
    // Third parameter is the DIRECTORY where PNGs are located
    this.load.multiatlas(
        'sean',                       // texture key
        'assets/sean/atlas.json',     // single JSON that references all sheets
        'assets/sean/'                // directory containing atlas1.png, atlas2.png, etc.
    );
}
```

### Post-Load: Set Pixel-Perfect Filtering
```javascript
create() {
    // After textures are loaded, set NEAREST filtering for crisp pixel art
    this.textures.get('sean').setFilterMode(
        Phaser.Textures.FilterMode.NEAREST
    );
    
    // Optional: Alternative is to set globally in game config
    // const config = { pixelArt: true, ... };
}
```

---

## C.2 Creating Sprites from Atlas

### By Frame Name
```javascript
create() {
    const sprite = this.add.sprite(100, 100, 'sean', 'walk/0001');
    // Frame name format depends on naming policy
    // If using TexturePacker with --prepend-folder-name + --trim-sprite-names:
    //   'walk/0001' (no .png suffix)
}
```

### List All Available Frames
```javascript
create() {
    const texture = this.textures.get('sean');
    const frameNames = texture.getFrameNames();
    console.log('Available frames:', frameNames);
    // Output: ['walk/0001', 'walk/0002', ..., 'punch/0001', ...]
}
```

---

## C.3 Animation Generation from Atlas

### Basic Animation (Using generateFrameNames)
```javascript
create() {
    // Generate frame names for a specific animation
    const walkFrames = this.anims.generateFrameNames('sean', {
        start: 1,              // First frame number
        end: 8,                // Last frame number
        zeroPad: 4,            // Pad to 4 digits: 0001, 0002, ..., 0008
        prefix: 'walk/',       // Folder/prefix in atlas
        suffix: ''             // No suffix (if using --trim-sprite-names)
                               // If TexturePacker kept .png: suffix: '.png'
    });
    // Result: ['walk/0001', 'walk/0002', ..., 'walk/0008']
    
    // Create animation from generated frame names
    this.anims.create({
        key: 'walk',           // Animation key (use later: sprite.play('walk'))
        frames: walkFrames,
        frameRate: 10,         // FPS
        repeat: -1             // Loop forever (-1) or specify count
    });
    
    // Play animation on a sprite
    const sean = this.add.sprite(100, 100, 'sean', 'walk/0001');
    sean.play('walk');
}
```

### From Meta Tags (Aseprite Only)
```javascript
// If using Aseprite export with --list-tags, meta.frameTags contains animation definitions
create() {
    const texture = this.textures.get('sean');
    // Note: Phaser doesn't expose meta.frameTags directly
    // You must either:
    // 1. Manually define animations (recommended)
    // 2. Load JSON separately and parse tags yourself
    
    // Recommended approach (manual, explicit):
    const idleFrames = this.anims.generateFrameNames('sean', {
        start: 1, end: 4, zeroPad: 4, prefix: 'idle/', suffix: ''
    });
    this.anims.create({
        key: 'idle',
        frames: idleFrames,
        frameRate: 8,
        repeat: -1
    });
}
```

### Multiple Animations in Sequence
```javascript
create() {
    const animations = [
        { key: 'idle', start: 1, end: 4, frameRate: 8 },
        { key: 'walk', start: 1, end: 8, frameRate: 10 },
        { key: 'punch', start: 1, end: 6, frameRate: 12 },
        { key: 'kick', start: 1, end: 7, frameRate: 12 }
    ];
    
    animations.forEach(anim => {
        const frames = this.anims.generateFrameNames('sean', {
            start: anim.start,
            end: anim.end,
            zeroPad: 4,
            prefix: anim.key + '/',
            suffix: ''
        });
        
        this.anims.create({
            key: anim.key,
            frames,
            frameRate: anim.frameRate,
            repeat: -1
        });
    });
}
```

---

## C.4 Pivot / Origin Handling

### Option A: Set Per-Sprite (Recommended for Simple Cases)
```javascript
create() {
    const sprite = this.add.sprite(100, 100, 'sean', 'walk/0001');
    
    // Set origin for this sprite instance
    // (0.5, 1) = bottom-center (typical for standing characters)
    sprite.setOrigin(0.5, 1);
    
    // sprite.x = 100, sprite.y = 100 now refers to bottom-center
}
```

### Option B: Set Per-Frame (If Pivot Varies Between Frames)
```javascript
preload() {
    // Normally in create(), but shown here for context
}

create() {
    // After texture is loaded, set pivot on all frames
    const texture = this.textures.get('sean');
    
    texture.getFrameNames().forEach(frameName => {
        const frame = texture.get(frameName);
        
        // CRITICAL: Must set customPivot = true before setting pivot values
        frame.customPivot = true;
        frame.pivotX = 0.5;   // 0-1 normalized (0.5 = horizontal center)
        frame.pivotY = 1.0;   // 0-1 normalized (1.0 = bottom)
    });
    
    // Now all sprites using 'sean' texture will use these pivot points
    const sprite = this.add.sprite(100, 100, 'sean', 'walk/0001');
    // sprite is already bottom-center aligned
}
```

### Option C: Read Pivot from TexturePacker JSON (If Available)
```javascript
create() {
    // If TexturePacker exported with pivot data in JSON, try:
    const texture = this.textures.get('sean');
    
    texture.getFrameNames().forEach(frameName => {
        const frame = texture.get(frameName);
        
        // Check if frame data includes pivot (TexturePacker format)
        if (frame.customData && frame.customData.pivot) {
            frame.customPivot = true;
            frame.pivotX = frame.customData.pivot.x;
            frame.pivotY = frame.customData.pivot.y;
        } else {
            // Fallback: set default bottom-center
            frame.customPivot = true;
            frame.pivotX = 0.5;
            frame.pivotY = 1.0;
        }
    });
}
```

**NOTE:** As of Phaser 3.54, automatic pivot loading from JSON is **not guaranteed**. Manual setting via `customPivot` is the reliable approach.

---

## C.5 Animation Playback & Control

### Play Animation
```javascript
create() {
    const sean = this.add.sprite(100, 100, 'sean', 'walk/0001');
    sean.play('walk');  // Play animation with key 'walk'
}
```

### Control Animation Playback
```javascript
// Pause animation
sean.anims.pause();

// Resume animation
sean.anims.resume();

// Stop animation (keep current frame)
sean.anims.stop();

// Stop and return to first frame
sean.anims.stop(true);  // true = skipMissedFrames = false, stopFrame = true

// Play with options
sean.play({
    key: 'walk',
    startFrame: 2,      // Start at frame index 2
    repeat: 3,          // Repeat 3 times (4 total plays)
    delay: 100          // Delay 100ms before starting
});

// Listen to animation events
sean.on('animationcomplete', () => {
    console.log('Animation finished!');
    sean.play('idle');  // Play idle when walk completes
});

sean.on('animationrepeat', () => {
    console.log('Animation looped');
});

sean.on('animationupdate', (anim, progress) => {
    console.log('Progress:', progress);  // 0-1
});
```

---

# D) NAMING POLICY VALIDATOR SPEC

## D.1 Policy Definition

### Official Naming Policy
```javascript
const NAMING_POLICY = {
    prefix: '{ACTION}/',           // e.g., "walk/", "punch_heavy/"
    zeroPad: 4,                    // Frame numbers padded to 4 digits
    suffix: '',                    // Empty string (no .png extension)
    // Full example: "walk/0001"
};
```

### Examples by Action
| Action | Frame 1 | Frame 2 | Frame 8 |
|--------|---------|---------|---------|
| walk | `walk/0001` | `walk/0002` | `walk/0008` |
| punch_heavy | `punch_heavy/0001` | `punch_heavy/0002` | `punch_heavy/0008` |
| kick | `kick/0001` | `kick/0002` | `kick/0008` |

---

## D.2 Validator Implementation

### JavaScript Validator Function
```javascript
/**
 * Validates that actual atlas JSON keys match expected naming policy
 * @param {Object} atlasJSON - Parsed JSON from atlas.json
 * @param {Object} expectedFrames - {action: frameCount} (e.g., {walk: 8, punch: 6})
 * @param {Object} policy - Naming policy (prefix, zeroPad, suffix)
 * @returns {Object} { pass: boolean, missingKeys: string[], extraKeys: string[], errors: string[] }
 */
function validateNamingPolicy(atlasJSON, expectedFrames, policy = NAMING_POLICY) {
    const result = {
        pass: true,
        missingKeys: [],
        extraKeys: [],
        errors: [],
        summary: {}
    };
    
    const actualKeys = new Set(Object.keys(atlasJSON.frames));
    const expectedKeys = new Set();
    
    // Generate all expected keys based on policy
    for (const [action, count] of Object.entries(expectedFrames)) {
        for (let i = 1; i <= count; i++) {
            const paddedNum = String(i).padStart(policy.zeroPad, '0');
            const expectedKey = `${policy.prefix.replace('{ACTION}', action)}${paddedNum}${policy.suffix}`;
            expectedKeys.add(expectedKey);
        }
    }
    
    // Find missing keys
    for (const key of expectedKeys) {
        if (!actualKeys.has(key)) {
            result.missingKeys.push(key);
            result.pass = false;
        }
    }
    
    // Find extra/unexpected keys
    for (const key of actualKeys) {
        if (!expectedKeys.has(key)) {
            result.extraKeys.push(key);
            // Extra keys don't necessarily fail, but flag them
        }
    }
    
    // Validate key format
    for (const key of actualKeys) {
        if (!isValidKeyFormat(key, policy)) {
            result.errors.push(`Invalid key format: "${key}"`);
            result.pass = false;
        }
    }
    
    // Summarize by action
    for (const action of Object.keys(expectedFrames)) {
        const actionPattern = new RegExp(`^${policy.prefix.replace('{ACTION}', action)}\\d{${policy.zeroPad}}${policy.suffix}$`);
        const count = Array.from(actualKeys).filter(k => actionPattern.test(k)).length;
        result.summary[action] = {
            expected: expectedFrames[action],
            actual: count,
            match: count === expectedFrames[action]
        };
    }
    
    return result;
}

/**
 * Validates a single key matches policy format
 */
function isValidKeyFormat(key, policy) {
    // Pattern: {ACTION}/{ZERO_PAD_NUMBER}{SUFFIX}
    // Example with default policy: walk/0001
    const actionPattern = '[a-z0-9_]+';
    const numPattern = `\\d{${policy.zeroPad}}`;
    const suffixPattern = policy.suffix ? policy.suffix.replace(/\./g, '\\.') : '';
    const regex = new RegExp(`^${actionPattern}/${numPattern}${suffixPattern}$`);
    return regex.test(key);
}
```

### Usage Example
```javascript
// Load atlas JSON
const atlasJSON = await fetch('assets/sean/atlas.json').then(r => r.json());

// Define expected frames
const expectedFrames = {
    walk: 8,
    punch: 6,
    punch_heavy: 8,
    kick: 7
};

// Validate
const result = validateNamingPolicy(atlasJSON, expectedFrames);

console.log('Validation Result:', result);
// Output:
// {
//   pass: true/false,
//   missingKeys: [...],    // Keys that should exist but don't
//   extraKeys: [...],      // Keys that exist but aren't expected
//   errors: [...],         // Format errors
//   summary: {
//     walk: { expected: 8, actual: 8, match: true },
//     punch: { expected: 6, actual: 6, match: true },
//     ...
//   }
// }

if (!result.pass) {
    console.error('VALIDATION FAILED');
    console.error('Missing:', result.missingKeys);
    console.error('Errors:', result.errors);
} else {
    console.log('✓ All keys valid');
}
```

### CLI Validator (Bash + jq)
```bash
#!/bin/bash
# Quick CLI validation of atlas JSON naming policy

ATLAS_JSON=$1
CHAR_ID=$2

echo "Validating: $ATLAS_JSON for character $CHAR_ID"
echo ""

# Extract all frame keys
jq '.frames | keys[]' "$ATLAS_JSON" | sort > /tmp/actual_keys.txt

echo "Frame Key Patterns Found:"
jq '.frames | keys[] | split("/")[0] // . ' "$ATLAS_JSON" | sort -u | uniq -c

echo ""
echo "Sample Keys:"
head -5 /tmp/actual_keys.txt

echo ""
echo "Expected Pattern: {ACTION}/XXXX (no .png if --trim-sprite-names used)"
echo ""

# Check for .png suffix (should NOT be present if trim-sprite-names used)
png_count=$(grep -c '\.png' /tmp/actual_keys.txt || true)
if [ $png_count -gt 0 ]; then
    echo "⚠ WARNING: Found $png_count keys with .png suffix"
    echo "  If using --trim-sprite-names, these should NOT have extensions"
    echo "  Sample: $(grep '\.png' /tmp/actual_keys.txt | head -1)"
fi

# Check for duplicate keys
echo ""
echo "Checking for duplicate keys..."
total=$(wc -l < /tmp/actual_keys.txt)
unique=$(sort -u /tmp/actual_keys.txt | wc -l)
if [ $total -eq $unique ]; then
    echo "✓ No duplicates (total: $total keys)"
else
    echo "✗ ERROR: Duplicates found! Total: $total, Unique: $unique"
    echo "  Duplicates:"
    sort /tmp/actual_keys.txt | uniq -d
fi

# Check frame count per action
echo ""
echo "Frame Count by Action:"
jq '.frames | keys[] | split("/")[0]' "$ATLAS_JSON" | sort | uniq -c

rm /tmp/actual_keys.txt
```

---

## D.3 Validation Checklist

### Pre-Export (Confirm Policy)
- [ ] Policy is written down and shared with team
  - Example: `prefix: "{action}/", zeroPad: 4, suffix: ""`
- [ ] CLI flags used match policy
  - `--trim-sprite-names` removes `.png` extension
  - `--prepend-folder-name` adds action folder to key
- [ ] Source folder structure follows pattern: `{ACTION}/frame_XXXX.png`

### Post-Export (Validate Atlas)
- [ ] Run validator on atlas.json with expected frame counts
- [ ] All missingKeys list is empty (or expected if some animations omitted)
- [ ] All extraKeys are documented/expected
- [ ] Format errors list is empty
- [ ] Summary shows all actions with correct frame counts

---

# E) MICRO-TEST HARNESS

## E.1 TEST-02: Phaser Pivot Auto-Apply

### Objective
Determine if Phaser automatically reads and applies pivot values from TexturePacker JSON, or if manual setting is required.

### Hypothesis
- **Null Hypothesis**: Phaser reads pivot from JSON frame data automatically
- **Alternative**: Manual `customPivot` setting is required

### Exact Steps

#### Step 1: Create Test Atlas with Different Pivots
```bash
# Using TexturePacker, export 2 frames:
#  - Frame 1: standing pose with pivot at (0.5, 1.0) [bottom-center]
#  - Frame 2: same standing pose with pivot at (0.5, 0.5) [center]

# CLI:
TexturePacker \
  --format phaser \
  --sheet test_pivot.png \
  --data test_pivot.json \
  --trim-mode Trim \
  test_frames/

# Inspect JSON:
jq '.frames | to_entries[] | {key: .key, pivot: .value.pivot}' test_pivot.json
# Expected output:
# {
#   "key": "frame1",
#   "pivot": { "x": 0.5, "y": 1.0 }
# }
# {
#   "key": "frame2",
#   "pivot": { "x": 0.5, "y": 0.5 }
# }
```

#### Step 2: Load in Phaser WITHOUT Manual Pivot Code
```javascript
// In a test scene (no manual pivot setting):
preload() {
    this.load.atlas('test', 'test_pivot.png', 'test_pivot.json');
}

create() {
    // Inspect frame pivot values BEFORE any manual modification
    const texture = this.textures.get('test');
    const frame1 = texture.get('frame1');
    const frame2 = texture.get('frame2');
    
    console.log('Frame1 pivot:', frame1.pivotX, frame1.pivotY);
    // PASS if: 0.5, 1.0
    // FAIL if: 0, 0 (default)
    
    console.log('Frame2 pivot:', frame2.pivotX, frame2.pivotY);
    // PASS if: 0.5, 0.5
    // FAIL if: 0, 0 (default)
}
```

#### Step 3: Render at Same Position, Observe Alignment
```javascript
create() {
    // Render both frames at the same world position
    const pos = { x: 100, y: 100 };
    
    const sprite1 = this.add.sprite(pos.x, pos.y, 'test', 'frame1');
    const sprite2 = this.add.sprite(pos.x + 50, pos.y, 'test', 'frame2');
    
    // If pivot is applied correctly:
    // - sprite1 should align at bottom-center (y=100 is the feet)
    // - sprite2 should align at center (y=100 is the middle)
    // - Horizontal alignment differs too because of offset
}
```

#### Step 4: Screenshot Comparison
- Capture image of both sprites
- Visually compare alignment
- If pivot values don't match JSON, pivot is NOT auto-applied

### Data to Collect
```javascript
{
    "test_name": "TEST-02: Phaser Pivot Auto-Apply",
    "frame1": {
        "expected_pivot": { "x": 0.5, "y": 1.0 },
        "actual_pivot": { "x": ?, "y": ? },
        "customPivot_value": ?  // true/false after load
    },
    "frame2": {
        "expected_pivot": { "x": 0.5, "y": 0.5 },
        "actual_pivot": { "x": ?, "y": ? },
        "customPivot_value": ?
    },
    "rendering": {
        "alignment_matches_json": true/false,
        "notes": "Description of visual difference"
    }
}
```

### Pass/Fail Criteria
| Criterion | PASS | FAIL |
|-----------|------|------|
| `frame1.pivotX` equals 0.5 | ✓ | ✗ Equals 0 or other |
| `frame1.pivotY` equals 1.0 | ✓ | ✗ Equals 0 or other |
| `frame2.pivotX` equals 0.5 | ✓ | ✗ Equals 0 or other |
| `frame2.pivotY` equals 0.5 | ✓ | ✗ Equals 0 or other |
| Rendered sprites align per JSON | ✓ | ✗ Sprites misaligned |

### Decision After Test
- **If PASS**: 
  - Remove manual pivot-setting code from production
  - Document: "Phaser auto-applies pivot from TexturePacker JSON"
  - Update Phaser Integration Snippets section (C.4) to remove Option B/C
  
- **If FAIL**: 
  - Keep manual `customPivot = true; pivotX/Y = ...` code mandatory
  - Document: "Phaser requires manual pivot setting despite JSON data"
  - Add CI check to verify manual setting is always applied

---

## E.2 TEST-03: Trim Mode vs Frame Size Constraint

### Objective
Verify that `--trim-mode Trim` does NOT cause baseline jitter despite removing transparency, and that sprite baseline remains stable across animation frames.

### Hypothesis
- **Null Hypothesis**: Trim mode causes vertical jitter due to inconsistent offsets
- **Alternative**: Trim mode preserves baseline correctly via `spriteSourceSize`

### Exact Steps

#### Step 1: Create Test Animation (8-Frame Walk Cycle)
```
Create or obtain 8 walk frames:
- All frames are 64×64 px in source
- Character feet should align at Y=60 (consistent baseline)
- Some frames may have different body heights (e.g., mid-stride vs standing)
```

#### Step 2: Pack with Trim Mode
```bash
# Export with --trim-mode Trim
TexturePacker \
  --format phaser \
  --sheet walk_trim.png \
  --data walk_trim.json \
  --trim-mode Trim \
  --extrude 1 \
  --shape-padding 2 \
  --border-padding 2 \
  walk_frames/

# Inspect trimmed offsets:
jq '.frames | to_entries[] | {frame: .key, sourceSize: .value.sourceSize, spriteSourceSize: .value.spriteSourceSize}' walk_trim.json
```

#### Step 3: Pack with No Trim (Control)
```bash
# Export with --trim-mode None for comparison
TexturePacker \
  --format phaser \
  --sheet walk_notrim.png \
  --data walk_notrim.json \
  --trim-mode None \
  --extrude 1 \
  --shape-padding 2 \
  --border-padding 2 \
  walk_frames/
```

#### Step 4: Animate Both in Phaser
```javascript
// Test Scene
preload() {
    this.load.atlas('trim', 'walk_trim.png', 'walk_trim.json');
    this.load.atlas('notrim', 'walk_notrim.png', 'walk_notrim.json');
}

create() {
    // Set up baseline tracking
    this.baselinePositions = { trim: [], notrim: [] };
    
    // Create trim version sprite
    this.spriteTrim = this.add.sprite(100, 100, 'trim', 'walk/0001');
    this.spriteTrim.setOrigin(0.5, 1);  // Bottom-center
    
    // Create no-trim version sprite
    this.spriteNoTrim = this.add.sprite(200, 100, 'notrim', 'walk/0001');
    this.spriteNoTrim.setOrigin(0.5, 1);
    
    // Create animations
    const trimFrames = this.anims.generateFrameNames('trim', {
        start: 1, end: 8, zeroPad: 4, prefix: 'walk/', suffix: ''
    });
    const notrimFrames = this.anims.generateFrameNames('notrim', {
        start: 1, end: 8, zeroPad: 4, prefix: 'walk/', suffix: ''
    });
    
    this.anims.create({
        key: 'trim-walk',
        frames: trimFrames,
        frameRate: 10,
        repeat: -1
    });
    
    this.anims.create({
        key: 'notrim-walk',
        frames: notrimFrames,
        frameRate: 10,
        repeat: -1
    });
    
    this.spriteTrim.play('trim-walk');
    this.spriteNoTrim.play('notrim-walk');
    
    // Record baseline positions each update
    this.frameCount = 0;
}

update() {
    if (this.frameCount < 80) {  // Capture 10 frames of animation
        this.baselinePositions.trim.push(this.spriteTrim.y);
        this.baselinePositions.notrim.push(this.spriteNoTrim.y);
        this.frameCount++;
    } else {
        // Analysis done
        this.analyzeBaseline();
    }
}

analyzeBaseline() {
    const trimVariance = Math.max(...this.baselinePositions.trim) - Math.min(...this.baselinePositions.trim);
    const notrimVariance = Math.max(...this.baselinePositions.notrim) - Math.min(...this.baselinePositions.notrim);
    
    console.log('Trim mode Y variance:', trimVariance, 'px');
    console.log('No-trim mode Y variance:', notrimVariance, 'px');
}
```

#### Step 5: Record Animation & Visual Inspection
```javascript
// Optional: Record as GIF/video
// Use tool like OBS or browser DevTools screen capture
// Play side-by-side comparison
```

### Data to Collect
```javascript
{
    "test_name": "TEST-03: Trim Mode vs Frame Size Constraint",
    "source_frames": {
        "dimensions": "64×64 px",
        "baseline_y": 60,
        "count": 8
    },
    "trim_mode_results": {
        "frame_1": { "sourceSize": {}, "spriteSourceSize": {}, "y_offset": ? },
        "frame_8": { "sourceSize": {}, "spriteSourceSize": {}, "y_offset": ? },
        "baseline_y_min": ?,
        "baseline_y_max": ?,
        "variance_pixels": ?
    },
    "notrim_mode_results": {
        "baseline_y_min": ?,
        "baseline_y_max": ?,
        "variance_pixels": ?
    },
    "visual_inspection": {
        "trim_jitter_visible": true/false,
        "notrim_jitter_visible": true/false,
        "notes": ""
    }
}
```

### Pass/Fail Criteria
| Criterion | PASS | FAIL |
|-----------|------|------|
| Trim baseline variance ≤ 1px | ✓ | ✗ > 1px |
| No visible jitter in trim animation | ✓ | ✗ Visual wobble |
| Trim efficiency (file size) better | ✓ | ✗ Same or worse |
| Baseline stable across 8 frames | ✓ | ✗ Drifts >2px |

### Decision After Test
- **If PASS**: 
  - Keep `--trim-mode Trim` in standard export template
  - Note: `spriteSourceSize` fields maintain correct positioning
  - Document: "Trimming is safe for pixel art with consistent baselines"
  
- **If FAIL**: 
  - Switch to `--trim-mode None` in template
  - OR: Add CI check to verify sourceSize consistency
  - Document: "Trimming requires manual baseline correction code"

---

## E.3 TEST-04: Frame Key Suffix Convention

### Objective
Confirm behavior of `--trim-sprite-names` CLI flag and validate that frame keys are generated consistently.

### Exact Steps

#### Step 1: Export Atlas WITH `--trim-sprite-names`
```bash
TexturePacker \
  --format phaser \
  --sheet atlas_trim.png \
  --data atlas_trim.json \
  --trim-sprite-names \
  --prepend-folder-name \
  frames/

# Inspect keys:
jq '.frames | keys[]' atlas_trim.json | head -5
# Expected: walk/0001 (no .png)
```

#### Step 2: Export Atlas WITHOUT `--trim-sprite-names`
```bash
TexturePacker \
  --format phaser \
  --sheet atlas_notrim.png \
  --data atlas_notrim.json \
  --prepend-folder-name \
  frames/

# Inspect keys:
jq '.frames | keys[]' atlas_notrim.json | head -5
# Expected: walk/0001.png (WITH .png)
```

#### Step 3: Test Both in Phaser Animation
```javascript
// Test with trim-sprite-names (no suffix)
preload() {
    this.load.atlas('trim', 'atlas_trim.png', 'atlas_trim.json');
    this.load.atlas('notrim', 'atlas_notrim.png', 'atlas_notrim.json');
}

create() {
    // Test 1: Trim version (should use empty suffix)
    const trimFrames = this.anims.generateFrameNames('trim', {
        start: 1, end: 8, zeroPad: 4, prefix: 'walk/', suffix: ''
    });
    
    try {
        this.anims.create({
            key: 'trim-walk',
            frames: trimFrames,
            frameRate: 10,
            repeat: -1
        });
        console.log('✓ Trim version (no suffix) works');
    } catch (e) {
        console.error('✗ Trim version failed:', e.message);
    }
    
    // Test 2: Not-trim version (should use .png suffix)
    const notrimFrames = this.anims.generateFrameNames('notrim', {
        start: 1, end: 8, zeroPad: 4, prefix: 'walk/', suffix: '.png'
    });
    
    try {
        this.anims.create({
            key: 'notrim-walk',
            frames: notrimFrames,
            frameRate: 10,
            repeat: -1
        });
        console.log('✓ Not-trim version (.png suffix) works');
    } catch (e) {
        console.error('✗ Not-trim version failed:', e.message);
    }
}
```

### Data to Collect
```javascript
{
    "test_name": "TEST-04: Frame Key Suffix Convention",
    "trim_version": {
        "flag_used": "--trim-sprite-names",
        "sample_keys": ["walk/0001", "walk/0002"],
        "generateFrameNames_suffix": "",
        "animation_created": true/false
    },
    "notrim_version": {
        "flag_used": "NONE",
        "sample_keys": ["walk/0001.png", "walk/0002.png"],
        "generateFrameNames_suffix": ".png",
        "animation_created": true/false
    }
}
```

### Pass/Fail Criteria
| Criterion | PASS | FAIL |
|-----------|------|------|
| Trim-version keys lack `.png` | ✓ | ✗ Keys have `.png` |
| Not-trim-version keys have `.png` | ✓ | ✗ Keys lack `.png` |
| Trim animation loads successfully | ✓ | ✗ Frame not found error |
| Not-trim animation loads successfully | ✓ | ✗ Frame not found error |

### Decision After Test
- **If PASS**: 
  - Standardize on `--trim-sprite-names` in templates (cleaner keys)
  - Always use `suffix: ''` in `generateFrameNames()` calls
  - Document this as the standard convention
  
- **If FAIL** (e.g., keys still have .png even with flag): 
  - Verify TexturePacker version (may be old)
  - Use explicit `suffix: '.png'` in generateFrameNames() if flag fails
  - Add CI check to validate keys before animation creation

---

## E.4 Test Execution Matrix

| Test | Priority | Blocking | Est. Time | Dependencies |
|------|----------|----------|-----------|--------------|
| TEST-02 (Pivot Auto-Apply) | P0 | YES | 30 min | None |
| TEST-03 (Trim Mode) | P0 | YES | 30 min | None |
| TEST-04 (Suffix Convention) | P1 | YES | 15 min | None |

### Recommended Execution Order
1. **TEST-04 first** (quickest, validates naming)
2. **TEST-02** (pivot: critical for alignment)
3. **TEST-03** (trim: affects all exports)

### Report Template

```markdown
# Micro-Test Execution Report
**Date:** [DATE]
**Executor:** [NAME]
**Phaser Version:** [VERSION]
**TexturePacker Version:** [VERSION]

## TEST-04: Suffix Convention
**Status:** ✓ PASS / ✗ FAIL
**Findings:**
- Trim-version keys: [SAMPLE]
- Not-trim-version keys: [SAMPLE]
**Decision:** Use --trim-sprite-names going forward

## TEST-02: Pivot Auto-Apply
**Status:** ✓ PASS / ✗ FAIL
**Findings:**
- frame.pivotX after load: [VALUE]
- frame.pivotY after load: [VALUE]
- customPivot auto-set: [true/false]
**Decision:** Manual pivot setting [required/NOT required]

## TEST-03: Trim Mode Jitter
**Status:** ✓ PASS / ✗ FAIL
**Findings:**
- Trim baseline variance: [Xpx]
- No-trim baseline variance: [Xpx]
- Visual jitter: [yes/no]
**Decision:** Use --trim-mode [Trim/None]

## Next Steps
- [ ] Update export templates per decisions
- [ ] Add CI checks for naming policy
- [ ] Document team procedures
```

---

# APPENDIX: Quick Reference

## CLI Flag Verification Matrix

| Flag | Tool | Value? | Verified? | Source |
|------|------|--------|-----------|--------|
| `--format phaser` | TexturePacker | — | ✅ | TP docs |
| `--trim-mode Trim` | TexturePacker | Required | ✅ | TP docs |
| `--extrude` | Aseprite | None (flag) | ✅ | Aseprite CLI docs |
| `--extrude 1` | TexturePacker | Required | ✅ | TP docs |
| `--shape-padding` | Both | Required | ✅ | Both docs |
| `--border-padding` | Both | Required | ✅ | Both docs |
| `--disable-rotation` | TexturePacker | — | ✅ | TP docs |
| `--alpha-handling ReduceBorderArtifacts` | TexturePacker | Exact value | ✅ | TP docs |
| `--trim-sprite-names` | TexturePacker | — | ✅ | TP docs |
| `--prepend-folder-name` | TexturePacker | — | ✅ | TP docs |
| `--multipack` | TexturePacker | — | ✅ | TP docs |
| `--tag {NAME}` | Aseprite | Required | ✅ | Aseprite CLI docs |
| `--split-tags` | Aseprite | With `--save-as` only | ✅ | Aseprite CLI docs |

## Frame Name Examples by Policy

Given policy: `prefix: "{action}/", zeroPad: 4, suffix: ""`

```
walk/0001, walk/0002, walk/0003, walk/0004, walk/0005, walk/0006, walk/0007, walk/0008
punch/0001, punch/0002, punch/0003, punch/0004, punch/0005, punch/0006
kick/0001, kick/0002, kick/0003, kick/0004, kick/0005, kick/0006, kick/0007
idle/0001, idle/0002, idle/0003, idle/0004
```

## File Size & Performance Notes

| Export Type | Typical Size | Notes |
|-------------|--------------|-------|
| Single Atlas (2048×2048, trimmed) | 400-800 KB | Use for <50 frames per character |
| Multipack Atlas (split to max 2048px) | 800-1.5 MB | Use for >50 frames or multiple characters |
| PNG-32 (full alpha) | 1.5-2x larger | Use when alpha quality critical |
| PNG-8 (indexed) | 0.3-0.5x smaller | Use for sprite-only (no gradients) |

---

**END OF DOCUMENT**