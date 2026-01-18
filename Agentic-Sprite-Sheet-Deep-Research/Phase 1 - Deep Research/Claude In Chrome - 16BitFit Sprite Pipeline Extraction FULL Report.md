# **16BitFit Sprite Pipeline Extraction Report**

## **1\) Executive Decisions**

### **Atlas vs Spritesheet for Phaser?**

**DECISION: Use Atlases (not spritesheets)**

**Why:**

* Per Phaser docs: "A spritesheet has uniform cells in rows/columns and an atlas has frames in any size and position"  
* Atlases support **trimming** (removes transparent pixels, tighter packing)  
* Atlases support **variable bounding boxes** per frame  
* Atlases support **pivot points** stored in JSON  
* Fighting game frames have variable sizes per animation—atlases are essential  
* TexturePacker's "Phaser" format supports pivot editing, multipack, and normal maps

### **Which JSON Format(s)?**

**DECISION: JSON Hash (primary) or Phaser multiatlas format**

**Why:**

* `addAtlasJSONHash`: frame data stored in an **Object** (keyed by frame name)  
* `addAtlasJSONArray`: frame data stored in an **Array**  
* TexturePacker "Phaser" format exports JSON Hash by default with pivot support  
* `this.load.multiatlas()` handles multi-sheet exports from single JSON  
* Aseprite exports both `json-hash` and `json-array` via `--format` flag

### **Default Pack Settings**

| Setting | Value | Justification |
| ----- | ----- | ----- |
| `--format` | `phaser` | Only format with pivot \+ multipack \+ 9-slice support |
| `--trim-mode` | `Trim` | Removes transparency but **preserves anchor point** |
| `--extrude` | `1` | Prevents texture bleeding at edges |
| `--shape-padding` | `2` | Prevents bleeding from neighbors during WebGL filtering |
| `--border-padding` | `2` | Prevents edge bleeding |
| `--disable-rotation` | `yes` | Avoids flipped frame expectations |
| `--alpha-handling` | `ReduceBorderArtifacts` | Removes dark halos at transparent borders |
| `--max-size` | `2048` (mobile) / `4096` (desktop) | Safe texture limits per Phaser docs |

---

## **2\) Copy-Ready Command Recipes**

### **2.1 Aseprite CLI Recipes**

**Single Sheet Export (all frames):**

bash  
aseprite \-b mysprite.aseprite \\\\  
  \--sheet mysprite\_sheet.png \\\\  
  \--data mysprite\_sheet.json \\\\  
  \--format json-hash \\\\  
  \--list-tags \\\\  
  \--list-layers \\\\  
  \--sheet-type packed \\\\  
  \--sheet-pack \\\\  
  \--trim \\\\  
  \--extrude \\\\  
  \--shape-padding 2 \\\\

  \--border-padding 2

**Per-Tag Export (LIMITATION: \--split-tags only works with \--save-as, NOT \--sheet):**

bash  
*\# This creates ONE sheet per tag using \--save-as with {tag} placeholder:*  
aseprite \-b mysprite.aseprite \\\\  
  \--split-tags \\\\  
  \--save-as "{tag}.gif"

*\# For sheets per tag, you need separate commands per tag:*  
aseprite \-b mysprite.aseprite \\\\  
  \--tag "idle" \\\\  
  \--sheet idle\_sheet.png \\\\  
  \--data idle\_sheet.json \\\\  
  \--format json-hash

aseprite \-b mysprite.aseprite \\\\  
  \--tag "walk" \\\\  
  \--sheet walk\_sheet.png \\\\  
  \--data walk\_sheet.json \\\\

  \--format json-hash

**With Scaling:**

bash  
aseprite \-b mysprite.aseprite \\\\  
  \--scale 2 \\\\  
  \--sheet mysprite\_sheet\_2x.png \\\\  
  \--data mysprite\_sheet\_2x.json \\\\  
  \--format json-hash  
\`\`\`

\*\*Recommended Naming Convention:\*\*  
\`\`\`  
{character}\_{action}\_sheet.png  
{character}\_{action}\_sheet.json

*\# e.g.: ryu\_idle\_sheet.png, ryu\_walk\_sheet.png*

### **2.2 TexturePacker CLI Recipes**

**Single Atlas Export:**

bash  
TexturePacker \\\\  
  \--format phaser \\\\  
  \--sheet atlas.png \\\\  
  \--data atlas.json \\\\  
  \--trim-mode Trim \\\\  
  \--extrude 1 \\\\  
  \--shape-padding 2 \\\\  
  \--border-padding 2 \\\\  
  \--disable-rotation \\\\  
  \--alpha-handling ReduceBorderArtifacts \\\\  
  \--max-size 2048 \\\\

  sprites/

**Multipack/Multiatlas Export:**

bash  
TexturePacker \\\\  
  \--format phaser \\\\  
  \--sheet atlas{n}.png \\\\  
  \--data atlas.json \\\\  
  \--multipack \\\\  
  \--trim-mode Trim \\\\  
  \--extrude 1 \\\\  
  \--shape-padding 2 \\\\  
  \--border-padding 2 \\\\  
  \--disable-rotation \\\\

  sprites/

**From .tps Project File:**

bash  
TexturePacker myproject.tps  
*\# Or override settings:*

TexturePacker myproject.tps \--sheet output.png \--data output.json

**Force Rebuild:**

bash

TexturePacker \--force-publish myproject.tps

---

## **3\) Phaser Integration Stubs**

### **Preload Examples**

**Atlas (single sheet):**

javascript  
preload() {  
  this.load.atlas('fighter', 'assets/fighter.png', 'assets/fighter.json');

}

**Multiatlas (multiple sheets, one JSON):**

javascript  
preload() {  
  this.load.multiatlas('cityscene', 'assets/spritesheets/cityscene.json', 'assets/spritesheets');

}

**Spritesheet (uniform grid, no JSON):**

javascript  
preload() {  
  this.load.spritesheet('explosion', 'assets/explosion.png', {  
    frameWidth: 64,  
    frameHeight: 64,  
    startFrame: 0,  
    endFrame: 15,  
    margin: 0,  
    spacing: 0  
  });

}

### **Reference Frames by Name/Index**

**By name (atlas):**

javascript  
this.add.sprite(100, 100, 'fighter', 'idle/0001.png');  
*// Or with texture manager:*  
var atlasTexture \= this.textures.get('fighter');

var frames \= atlasTexture.getFrameNames();

**By index (spritesheet):**

javascript

this.add.sprite(100, 100, 'explosion', 5); *// Frame index 5*

### **Animation from Atlas**

javascript  
const frameNames \= this.anims.generateFrameNames('fighter', {  
  start: 1, end: 8, zeroPad: 4,  
  prefix: 'walk/', suffix: '.png'  
});  
*// Results in: 'walk/0001.png', 'walk/0002.png', etc.*

this.anims.create({  
  key: 'walk',  
  frames: frameNames,  
  frameRate: 10,  
  repeat: \-1  
});

this.fighter.anims.play('walk');

### **Pivot/Origin Handling**

**Setting pivot per frame in Phaser (manually):**

javascript  
for (const frame of Object.values(this.textures.get('sprites').frames)) {  
  if (frame.name \=== '\_\_BASE') continue;  
  frame.customPivot \= true;  
  frame.pivotX \= 0.5;  *// 0-1 normalized*  
  frame.pivotY \= 1;    *// bottom-center anchor*

}

**Reading pivot from atlas JSON:**

* TexturePacker's "Phaser" format exports `pivot: {x, y}` in frame data  
* Phaser reads these automatically if present

---

## **4\) JSON Contracts We Must Support**

### **Minimal Required Fields (JSON Hash format)**

json  
{  
  "frames": {  
    "framename.png": {  
      "frame": {"x": 0, "y": 0, "w": 64, "h": 64}  
    }  
  },  
  "meta": {  
    "image": "atlas.png",  
    "size": {"w": 512, "h": 512}  
  }

}

### **Full Frame Object (with optional fields we care about)**

json  
{  
  "frames": {  
    "walk/0001.png": {  
      "frame": {"x": 0, "y": 0, "w": 48, "h": 64},  
      "rotated": false,  
      "trimmed": true,  
      "spriteSourceSize": {"x": 8, "y": 0, "w": 48, "h": 64},  
      "sourceSize": {"w": 64, "h": 64},  
      "pivot": {"x": 0.5, "y": 1.0}  
    }  
  },  
  "meta": {  
    "image": "atlas.png",  
    "size": {"w": 512, "h": 512},  
    "scale": "1",  
    "frameTags": \[  
      {"name": "walk", "from": 0, "to": 7}  
    \],  
    "layers": \[  
      {"name": "Background"},  
      {"name": "Character"}  
    \],  
    "slices": \[  
      {  
        "name": "hitbox",  
        "keys": \[{"frame": 0, "bounds": {"x": 10, "y": 10, "w": 44, "h": 54}}\]  
      }  
    \]  
  }

}

### **Field Definitions**

| Field | Required | Purpose |
| ----- | ----- | ----- |
| `frame` | YES | Position & size on atlas |
| `trimmed` | Optional | Whether transparency was removed |
| `spriteSourceSize` | Optional | Offset within original frame (for trimmed sprites) |
| `sourceSize` | Optional | Original frame dimensions before trim |
| `pivot` | Optional | Anchor point (0-1 normalized), **critical for baseline** |
| `rotated` | Optional | 90° rotation flag |
| `customData` | NOT FOUND | Phaser doesn't expose per-frame custom metadata |

### **Which Tool Outputs Which Schema**

| Tool | Format Flag | Output |
| ----- | ----- | ----- |
| Aseprite | `--format json-hash` | Hash with meta.frameTags, meta.layers, meta.slices |
| Aseprite | `--format json-array` | Array (no slices.pivot in older versions) |
| TexturePacker | `--format phaser` | Hash with pivot, 9-slice, multipack support |

---

## **5\) Risk Register**

| Risk | Symptom in Game | Root Cause | Mitigation |
| ----- | ----- | ----- | ----- |
| **Animation jitter** | Characters "bounce" between frames | Inconsistent pivot/baseline across frames | Set consistent pivot in TexturePacker per sprite. Use `pivotY: 1` for ground-standing characters. |
| **Trimming baseline drift** | Characters shift position when animating | Trim removes different amounts per frame, offsets vary | Use `Trim` mode (not `Crop`) which preserves anchor. Or set fixed sourceSize. |
| **Rotation breaking frames** | Sprites appear sideways/flipped | Atlas rotation enabled, framework not handling | Use `--disable-rotation` in TexturePacker |
| **Texture bleeding** | Color fringes at sprite edges | Adjacent pixels sampled during filtering | Use `--extrude 1` AND `--shape-padding 2` |
| **Inconsistent naming** | Frames not found, animations break | Folder structure changes, extension included/excluded | Use `--trim-sprite-names` and `--prepend-folder-name` consistently |
| **Alpha halos/dark borders** | Dark outline around sprites | Premultiplied alpha mismatch | Use `--alpha-handling ReduceBorderArtifacts` in TexturePacker |
| **Multiatlas complexity** | Loading errors, wrong frames | Multiple PNGs with shared JSON | Use `this.load.multiatlas()` with correct path parameter |
| **\--split-tags limitation** | Can't export per-tag sheets in one command | Aseprite CLI limitation | Export tags separately with `--tag <name>` per command |

---

## **6\) Interesting Tidbits**

### **Unexpected Findings**

1. **Aseprite \--split-tags doesn't work with \--sheet**: The flag only works with `--save-as` to create GIFs/sequences, not sprite sheets. For per-tag sheets, loop over tags with separate commands.  
2. **TexturePacker's "Phaser" format is distinct**: Don't use "Phaser 3 (hash)" or "Phaser 3 (array)"—use "Phaser" which supports pivot editing, multipack single JSON, and normal maps.  
3. **Pivot in JSON-Array is problematic**: Per Phaser discourse, pivot data is better supported in JSON Hash. The Starling format was mentioned as an alternative with better pivot support.  
4. **Phaser's frame.customPivot flag**: Must be set to `true` before `pivotX`/`pivotY` values are used—otherwise Phaser ignores them.  
5. **Maximum texture sizes**: Phaser docs say "2048px for mobile and 4096px for desktop should be safe" but `renderer.getMaxTextureSize()` can check the actual device limit.  
6. **Aseprite slices have pivot**: The `--list-slices` output includes per-slice pivot data in the JSON, potentially useful for hitbox/hurtbox metadata.  
7. **TexturePacker smart rebuild**: It detects file changes via timestamps and a "smart update hash"—safe to run in build scripts without significant slowdown.

### **Potential Contradictions**

* TexturePacker docs show `--padding` as combined border+shape padding, but explicit `--shape-padding` and `--border-padding` flags exist for granular control.

### **Features for Audit Loop**

* **Aseprite `--list-tags`**: Outputs `meta.frameTags` array with `{name, from, to}` ranges—useful for validating animation coverage  
* **Aseprite `--list-slices`**: Outputs slice definitions with pivot points—can embed hitbox/baseline data  
* **TexturePacker `--shape-debug`**: Draws colored boxes around sprites for debugging alignment

---

## **7\) Open Questions (Actionable)**

| \# | Question | What to Test | How to Test | Pass/Fail Criteria |
| ----- | ----- | ----- | ----- | ----- |
| 1 | Does Aseprite's pivot in slices transfer to Phaser correctly? | Export with `--list-slices`, load in Phaser | Create test sprite with slice pivot, verify anchor in game | Sprite renders at expected anchor point |
| 2 | Can we embed custom baseline offset in JSON? | Try adding custom field to Aseprite JSON | Hand-edit JSON, check if Phaser preserves it on frame object | `frame.data` or similar accessible in Phaser |
| 3 | What's the performance cost of polygon trim vs rect trim? | Export same assets both ways | Profile load time \+ render FPS in WebGL | \<5% difference \= use rect for simplicity |
| 4 | Does TexturePacker's multipack preserve frame order? | Export 100+ frames as multipack | Load and verify `getFrameNames()` order | Frames in expected sequence |
| 5 | Optimal extrude \+ padding combo to prevent bleeding? | Test extrude=0/1/2 with padding=1/2/3 | Scale sprites up/down in game, check edges | No visible artifacts at 2x/0.5x scale |
| 6 | Can we automate per-tag export from Aseprite? | Write shell loop over `--list-tags` output | Parse JSON, generate commands | All tags export with correct frame ranges |
| 7 | Is PNG-8 (indexed) sufficient for our sprites? | Export at `--png-opt-level 1` | Visual comparison, file size delta | No visible banding, \>50% size reduction |

---

## **Animyth Pipeline Insights (for Agentic Reference)**

### **Workflow Summary:**

1. **Text Processing**: Natural language → GPT-4 → tag-based prompt  
2. **Template Selection**: Pre-made sprite sheet templates from Mixamo (OpenPose skeletons)  
3. **Generation**: Stable Diffusion \+ ControlNet (OpenPose model) maintains pose consistency  
4. **Post-Processing**: Python scripts for background removal, sheet alignment

### **Applicable to 16BitFit:**

* **Template-driven generation**: Define action words → map to skeleton templates → consistent frame layout  
* **ControlNet for pose control**: OpenPose v1.1 model enforces skeleton consistency across frames  
* **Negative prompts matter**: Their extensive negative prompt prevents common artifacts  
* **Folder structure**: `/sprites-folder/` with character subfolders → clean naming for atlas packing

### **Gotcha from Animyth:**

* "Character Consistency Across Frames" scored 4.5/5—still needs manual editing  
* Background removal is a post-processing step, not built into generation  
* No explicit game engine export step documented—sheets are raw PNG output

# **CORRECTIONS \+ MISSING PIECES ADDENDUM**

## **1\) Confirmations (Verified from Docs)**

### **Aseprite CLI (aseprite.org/docs/cli)**

| Item | Verified | Section |
| ----- | ----- | ----- |
| `--extrude` | ✅ EXISTS but **NO VALUE** \- just a flag (duplicates edges 1px) | "Extrude" section |
| `--shape-padding <value>` | ✅ EXISTS | "Shape padding" section |
| `--border-padding <value>` | ✅ EXISTS | "Border padding" section |
| `--inner-padding <value>` | ✅ EXISTS | "Inner padding" section |
| `--format json-hash` | ✅ DEFAULT format | "--format" section |
| `--format json-array` | ✅ ALTERNATE format | "--format" section |
| `--sheet-type packed` | ✅ EXISTS, values: `horizontal`, `vertical`, `rows`, `columns`, `packed` | "--sheet-type" section |
| `--sheet-pack` | ✅ EXISTS (same as `--sheet-type packed`) | "--sheet-pack" section |
| `--split-tags` only affects `--save-as` | ✅ CONFIRMED: "It affects the \--save-as option" | "--split-tags" section |
| `--tag <name>` works with `--sheet` | ✅ CONFIRMED | "--tag" section |

### **Aseprite API (aseprite.org/api)**

| Item | Verified | Section |
| ----- | ----- | ----- |
| `SpriteSheetDataFormat.JSON_HASH` | ✅ | SpriteSheetDataFormat page |
| `SpriteSheetDataFormat.JSON_ARRAY` | ✅ | SpriteSheetDataFormat page |
| Slices include `pivot` in JSON output | ✅ Slices have `keys[].pivot: {x, y}` | "--list-slices" section |

### **TexturePacker Settings (codeandweb.com/texturepacker/documentation/texture-settings)**

| Item | Verified | Section |
| ----- | ----- | ----- |
| `--format phaser` | ✅ "Phaser" format listed | "Data Format" section |
| `--alpha-handling ReduceBorderArtifacts` | ✅ EXACT VALUE | "Transparency Handling" section |
| `--alpha-handling` values: `KeepTransparentPixels`, `ClearTransparentPixels`, `ReduceBorderArtifacts`, `PremultiplyAlpha` | ✅ ALL VERIFIED | "Transparency Handling" table |
| `--trim-mode <value>` | ✅ values: `None`, `Trim`, `CropKeepPos`, `Crop`, `Polygon` | "Trim mode" table |
| `--extrude <number>` | ✅ TAKES A NUMBER (not just flag) | "Extrude" section |
| `--border-padding <number>` | ✅ | "Border padding" section |
| `--shape-padding <number>` | ✅ | "Shape padding" section |
| `--enable-rotation / --disable-rotation` | ✅ | "Allow rotation" section |
| `--multipack` | ✅ | "Automatic Multipack" section |

### **Phaser Docs (docs.phaser.io)**

| Item | Verified | Section |
| ----- | ----- | ----- |
| `this.load.atlas(key, textureURL, atlasURL)` | ✅ | Loader concepts page |
| `this.load.multiatlas(key, atlasURL, path)` | ✅ | Loader concepts page |
| `this.load.spritesheet(key, url, frameConfig)` | ✅ | Loader concepts page |
| `frame.customPivot = true; frame.pivotX; frame.pivotY` | ✅ Must set `customPivot = true` first | "Setting custom pivot points" |
| Atlas JSON supports `pivot: {x, y}` | ✅ In JSON schema under "Add atlas" | Textures concepts page |
| `setFilterMode(Phaser.Textures.FilterMode.NEAREST)` | ✅ For pixel art | "Set a texture's filter mode" |

---

## **2\) Corrections**

### **CRITICAL: Aseprite `--extrude` is NOT the same as TexturePacker**

| Original Report | Correction |
| ----- | ----- |
| `--extrude 1` in Aseprite command | **WRONG** \- Aseprite's `--extrude` takes NO value; it's just `--extrude` (duplicates edges by 1px automatically) |
| TexturePacker `--extrude 1` | **CORRECT** \- TexturePacker's `--extrude <number>` takes a pixel count |

### **TexturePacker Format Flag**

| Original Report | Correction |
| ----- | ----- |
| `--format phaser` | **CORRECT** but note there are THREE Phaser-related formats in TexturePacker: "Phaser" (recommended), "Phaser 3 (hash)", "Phaser 3 (array)". Use **"phaser"** for CLI which is the main format with pivot/multipack/9-slice support |

### **Pivot Auto-Loading in Phaser**

| Original Report | Correction |
| ----- | ----- |
| "Phaser reads pivot from JSON automatically if present" | **NEEDS VERIFICATION** \- The Phaser docs show manual setting of `customPivot`, `pivotX`, `pivotY`. The JSON schema shows `pivot: {x,y}` is supported in atlas data, but whether Phaser *automatically* applies it to frames requires testing |

### **Aseprite JSON pivot location**

| Original Report | Correction |
| ----- | ----- |
| "pivot" in frame data | **NOT FOUND** \- Aseprite's frame-level JSON does NOT include per-frame pivot. Pivot is ONLY in `meta.slices[].keys[].pivot`. Frames themselves don't have pivot in Aseprite export |

---

## **3\) Missing but Important (Production Gotchas)**

### **Pixel Rounding / Subpixel Jitter**

* **NOT FOUND IN DOCS** \- Need to test: `game.config.roundPixels = true` or sprite-level `setPixelPerfect()`  
* TexturePacker's `--force-identical-layout` ensures integer coordinates across scale variants

### **Texture Filtering Mode**

* **VERIFIED**: `texture.setFilterMode(Phaser.Textures.FilterMode.NEAREST)` for pixel art  
* Must be set per-texture AFTER loading  
* NOT set automatically by loader

### **Premultiplied Alpha / Halo Issues**

* **VERIFIED**: TexturePacker `--alpha-handling ReduceBorderArtifacts` is the fix (also called "Alpha bleeding")  
* Aseprite has NO equivalent CLI flag  
* If using Aseprite directly → must post-process OR use TexturePacker as second stage

### **Naming Conventions for Deterministic Animations**

* Aseprite `--filename-format` supports: `{title}`, `{layer}`, `{tag}`, `{frame}`, `{frame01}`, `{tagframe}`  
* TexturePacker: sub-folder names automatically become part of sprite names  
* **Recommendation**: `{character}/{action}/{frame0000}.png` → e.g., `ryu/walk/0001.png`

### **Atlas Frames: Path-based vs Flat Names**

* **NOT EXPLICITLY DOCUMENTED** \- Must standardize  
* TexturePacker `--prepend-folder-name` adds folder names to sprite names  
* TexturePacker `--trim-sprite-names` removes `.png` extension  
* **Recommendation**: Use both flags for clean paths: `walk/0001` instead of `walk/0001.png`

### **Phaser Spritesheet frameConfig**

* **VERIFIED** from Textures page:

javascript

{ frameWidth, frameHeight, startFrame: 0, endFrame: \-1, margin: 0, spacing: 0 }

---

## **4\) Command Templates v2 (VERIFIED FLAGS ONLY)**

### **4.1 Aseprite CLI (Verified)**

**Single Sheet Export:**

bash  
aseprite \-b mysprite.aseprite \\\\  
  \--sheet mysprite\_sheet.png \\\\  
  \--data mysprite\_sheet.json \\\\  
  \--format json-hash \\\\  
  \--list-tags \\\\  
  \--list-layers \\\\  
  \--list-slices \\\\  
  \--sheet-pack \\\\  
  \--trim \\\\  
  \--extrude \\\\  
  \--shape-padding 2 \\\\

  \--border-padding 2

**Per-Tag Export (workaround \- must loop):**

bash  
*\# Get tag list first:*  
aseprite \-b mysprite.aseprite \--list-tags  
*\# Then for each tag:*  
aseprite \-b mysprite.aseprite \\\\  
  \--tag "idle" \\\\  
  \--sheet idle\_sheet.png \\\\  
  \--data idle\_sheet.json \\\\  
  \--format json-hash \\\\  
  \--sheet-pack \\\\  
  \--trim \\\\

  \--extrude

**With Scaling (before \--sheet):**

bash  
aseprite \-b mysprite.aseprite \\\\  
  \--scale 2 \\\\  
  \--sheet mysprite\_2x.png \\\\  
  \--data mysprite\_2x.json \\\\

  \--format json-hash

### **4.2 TexturePacker CLI (Verified)**

**Single Atlas Export:**

bash  
TexturePacker \\\\  
  \--format phaser \\\\  
  \--sheet atlas.png \\\\  
  \--data atlas.json \\\\  
  \--trim-mode Trim \\\\  
  \--extrude 1 \\\\  
  \--shape-padding 2 \\\\  
  \--border-padding 2 \\\\  
  \--disable-rotation \\\\  
  \--alpha-handling ReduceBorderArtifacts \\\\  
  \--max-size 2048 \\\\  
  \--trim-sprite-names \\\\  
  \--prepend-folder-name \\\\

  sprites/

**Multipack Export:**

bash  
TexturePacker \\\\  
  \--format phaser \\\\  
  \--sheet atlas{n}.png \\\\  
  \--data atlas.json \\\\  
  \--multipack \\\\  
  \--trim-mode Trim \\\\  
  \--extrude 1 \\\\  
  \--shape-padding 2 \\\\  
  \--border-padding 2 \\\\  
  \--disable-rotation \\\\  
  \--alpha-handling ReduceBorderArtifacts \\\\

  sprites/

---

## **5\) Phaser Usage v2 (Verified)**

### **Loader Methods**

**Atlas (JSON Hash from TexturePacker):**

javascript  
*// In preload():*  
this.load.atlas('fighter', 'assets/fighter.png', 'assets/fighter.json');

*// Usage:*

this.add.sprite(100, 100, 'fighter', 'walk/0001');

**Multiatlas (multiple PNGs, one JSON):**

javascript  
*// In preload():*  
this.load.multiatlas('cityscene', 'assets/cityscene.json', 'assets/');  
*// Third param is the PATH to where PNG files are located*

*// Usage:*

this.add.sprite(0, 0, 'cityscene', 'background');

**Spritesheet (uniform grid, no JSON):**

javascript  
*// In preload():*  
this.load.spritesheet('explosion', 'assets/explosion.png', {  
  frameWidth: 64,  
  frameHeight: 64,  
  startFrame: 0,  
  endFrame: 15,  
  margin: 0,  
  spacing: 0  
});

*// Usage (frames are 0-indexed integers):*

this.add.sprite(100, 100, 'explosion', 5);

### **Animation from Atlas (Verified)**

javascript  
const frameNames \= this.anims.generateFrameNames('fighter', {  
  start: 1,  
  end: 8,  
  zeroPad: 4,  
  prefix: 'walk/',  
  suffix: ''  *// No .png if using \--trim-sprite-names*  
});

this.anims.create({  
  key: 'walk',  
  frames: frameNames,  
  frameRate: 10,  
  repeat: \-1  
});

this.fighter.anims.play('walk');

### **Pivot/Origin Handling (VERIFIED \- Must Be Manual)**

**Option 1: Set on frame objects after load**

javascript  
*// In create() after textures are loaded:*  
for (const frame of Object.values(this.textures.get('fighter').frames)) {  
  if (frame.name \=== '\_\_BASE') continue;  
  frame.customPivot \= true;  
  frame.pivotX \= 0.5;   *// 0-1 normalized*  
  frame.pivotY \= 1.0;   *// Bottom-center for ground characters*

}

**Option 2: Set origin on Game Object**

javascript  
const sprite \= this.add.sprite(100, 100, 'fighter', 'walk/0001');

sprite.setOrigin(0.5, 1);  *// Bottom-center*

### **Filter Mode for Pixel Art (Verified)**

javascript  
*// After loading, before using:*  
this.textures.get('fighter').setFilterMode(Phaser.Textures.FilterMode.NEAREST);

*// Or in game config:*  
const config \= {  
  pixelArt: true,  *// Sets NEAREST filtering globally*  
  *// ...*

};

---

## **6\) Gaps & Next Tests**

| \# | Test | How | Pass Criteria |
| ----- | ----- | ----- | ----- |
| 1 | Does Phaser auto-apply `pivot` from TexturePacker JSON? | Export atlas with pivot in TP, load in Phaser, check `frame.pivotX/Y` | Values match JSON |
| 2 | Does Aseprite `--extrude` add only 1px or configurable? | Test with `--extrude --shape-padding 0` | Inspect output PNG |
| 3 | Can we use Aseprite slice pivot as baseline? | Export with slices, parse JSON in loader callback | `meta.slices[].keys[].pivot` accessible |
| 4 | `roundPixels` effect on animation smoothness | Toggle `game.config.roundPixels`, compare visual | No subpixel shimmer |
| 5 | TexturePacker "phaser" vs "phaser-3" format output | Export same sprites with each, diff JSON | Document schema differences |
| 6 | Trim mode effect on baseline | Export same char with `Trim` vs `None`, animate | No vertical drift with `Trim` |
| 7 | Multipack frame resolution order | Export 100+ frames as multipack, verify `getFrameNames()` | Deterministic order |
| 8 | Alpha bleeding with/without `ReduceBorderArtifacts` | Export, zoom in on edges in-game | No dark halo |
| 9 | Performance: PNG-8 vs PNG-32 | Compare load time \+ FPS | Document tradeoff |
| 10 | Aseprite tags → Phaser animations automation | Write script parsing `meta.frameTags` | Animations created from JSON |

---

## **7\) Final Schema Comparison**

### **Aseprite JSON Hash Output**

json  
{  
  "frames": {  
    "framename 0.aseprite": {  
      "frame": {"x": 0, "y": 0, "w": 32, "h": 32},  
      "rotated": false,  
      "trimmed": false,  
      "spriteSourceSize": {"x": 0, "y": 0, "w": 32, "h": 32},  
      "sourceSize": {"w": 32, "h": 32},  
      "duration": 100  
    }  
  },  
  "meta": {  
    "app": "...",  
    "image": "sheet.png",  
    "size": {"w": 128, "h": 128},  
    "frameTags": \[{"name": "walk", "from": 0, "to": 7, "direction": "forward"}\],  
    "layers": \[{"name": "Layer 1"}\],  
    "slices": \[{"name": "hitbox", "keys": \[{"frame": 0, "bounds": {...}, "pivot": {"x": 16, "y": 32}}\]}\]  
  }

}

**NOTE: No `pivot` at frame level. Only in slices.**

### **TexturePacker Phaser Format Output**

json  
{  
  "frames": {  
    "walk/0001": {  
      "frame": {"x": 0, "y": 0, "w": 48, "h": 64},  
      "rotated": false,  
      "trimmed": true,  
      "spriteSourceSize": {"x": 8, "y": 0, "w": 48, "h": 64},  
      "sourceSize": {"w": 64, "h": 64},  
      "pivot": {"x": 0.5, "y": 1.0}  
    }  
  },  
  "meta": {  
    "image": "atlas.png",  
    "size": {"w": 512, "h": 512},  
    "scale": "1"  
  }

}

**NOTE: Has `pivot` at frame level. No `frameTags`.**

---

## **Summary of Key Corrections**

1. **Aseprite `--extrude`** \- No value parameter; just a flag  
2. **Aseprite pivot** \- NOT in frame data; only in slices  
3. **Phaser pivot from JSON** \- Needs testing; manual setting is documented  
4. **Alpha bleeding** \- TexturePacker-only; Aseprite needs post-processing  
5. **Per-tag sheets** \- Aseprite requires loop, not single command

