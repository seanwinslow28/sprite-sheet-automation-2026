# CLI Flag Verification & Risk Register
## Companion to Phaser 3 Export Compliance Kit

**Document Purpose:** Track which CLI flags have been verified from official docs and which require testing before production use.

---

## PART 1: VERIFIED FLAGS (From Official Documentation)

### TexturePacker CLI (Verified from codeandweb.com/texturepacker/documentation)

| Flag | Value | Verified | Usage |
|------|-------|----------|-------|
| `--format phaser` | String: "phaser" | ✅ YES | Only format with pivot + multipack + 9-slice support |
| `--trim-mode` | String: "None", "Trim", "CropKeepPos", "Crop", "Polygon" | ✅ YES | Use "Trim" for pixel art (preserves anchor) |
| `--extrude` | Integer: pixels to duplicate (e.g., 1, 2) | ✅ YES | 1 prevents edge bleeding |
| `--shape-padding` | Integer: pixels | ✅ YES | Use 2 to prevent neighbor bleed |
| `--border-padding` | Integer: pixels | ✅ YES | Use 2 for edge safety |
| `--disable-rotation` | Flag (no value) | ✅ YES | Don't auto-rotate frames |
| `--alpha-handling` | String: "KeepTransparentPixels", "ClearTransparentPixels", "ReduceBorderArtifacts", "PremultiplyAlpha" | ✅ YES | Use "ReduceBorderArtifacts" for halo removal |
| `--max-size` | Integer: pixels (e.g., 2048, 4096) | ✅ YES | Safe limits per Phaser docs |
| `--trim-sprite-names` | Flag (no value) | ✅ YES | Removes .png extension from JSON keys |
| `--prepend-folder-name` | Flag (no value) | ✅ YES | Adds folder name to frame keys |
| `--multipack` | Flag (no value) | ✅ YES | Auto-splits atlas across multiple PNGs |
| `--sheet` | Path with {n} placeholder (e.g., "atlas{n}.png") | ✅ YES | Output PNG name (use {n} for multipack) |
| `--data` | File path (e.g., "atlas.json") | ✅ YES | Output JSON path |

### Aseprite CLI (Verified from aseprite.org/docs/cli)

| Flag | Value | Verified | Usage |
|------|-------|----------|-------|
| `--format` | String: "json-hash", "json-array" | ✅ YES | json-hash is default, recommended |
| `--sheet` | File path (e.g., "sheet.png") | ✅ YES | Output sprite sheet PNG |
| `--data` | File path (e.g., "sheet.json") | ✅ YES | Output frame data JSON |
| `--extrude` | Flag only (NO VALUE) | ✅ YES | Duplicates edges by 1px automatically |
| `--shape-padding` | Integer: pixels | ✅ YES | Use 2 |
| `--border-padding` | Integer: pixels | ✅ YES | Use 2 |
| `--sheet-pack` | Flag (no value) | ✅ YES | Same as `--sheet-type packed` |
| `--trim` | Flag (no value) | ✅ YES | Remove transparent pixels |
| `--tag` | String: tag name (e.g., "idle", "walk") | ✅ YES | Export specific animation tag |
| `--split-tags` | Flag, works ONLY with `--save-as` | ✅ YES | For GIF export; NOT for `--sheet` |
| `--scale` | Integer: scale factor (e.g., 2, 3) | ✅ YES | Resize output |
| `--list-tags` | Flag (no value) | ✅ YES | Output tag definitions to stdout |
| `--list-layers` | Flag (no value) | ✅ YES | Output layer list |
| `--list-slices` | Flag (no value) | ✅ YES | Output slice definitions with pivot |

### Phaser 3 (Verified from docs.phaser.io)

| Method/Property | Verified | Usage |
|-----------------|----------|-------|
| `this.load.atlas(key, textureURL, atlasURL)` | ✅ YES | Load single atlas |
| `this.load.multiatlas(key, atlasURL, path)` | ✅ YES | Load multipack atlas (multiple PNGs, one JSON) |
| `frame.customPivot = true` | ✅ YES | MUST set true before using pivotX/pivotY |
| `frame.pivotX`, `frame.pivotY` | ✅ YES | Normalized coordinates (0-1) |
| `texture.setFilterMode(Phaser.Textures.FilterMode.NEAREST)` | ✅ YES | For pixel art crisp rendering |
| `this.anims.generateFrameNames()` | ✅ YES | Generate frame name array from pattern |
| `this.anims.create({key, frames, frameRate, repeat})` | ✅ YES | Create animation from frame names |

---

## PART 2: PARTIALLY VERIFIED (Requires Testing Before Production)

### Phaser Pivot Auto-Loading from JSON

**Flag:** Not a CLI flag; a Phaser behavior question

**Current Status:** ❌ UNVERIFIED

**What the docs say:**
- Phaser docs show `pivot: {x, y}` in atlas JSON schema (frame data)
- Manual setting via `customPivot = true; pivotX/pivotY = ...` is documented as reliable
- Automatic pivot application from JSON is **NOT explicitly documented**

**Risk Level:** HIGH (affects baseline alignment in all animations)

**Required Test:** TEST-02 (see Micro-test Harness section in main kit)

**Impact if wrong:**
- If Phaser DOES auto-apply: Manual pivot code is redundant
- If Phaser DOES NOT auto-apply: Missing pivot code causes misalignment

**Production Recommendation:** Don't use before TEST-02 passes

---

### Alpha Artifact Removal Effectiveness

**Flag:** `--alpha-handling ReduceBorderArtifacts`

**Current Status:** ⚠️  PARTIALLY VERIFIED

**What the docs say:**
- TexturePacker docs confirm the flag exists and applies "Reduce Border Artifacts" method
- Technical effect: "Removes dark halos at transparent borders"

**What we DON'T know:**
- Exact algorithm (is it dilation? feathering?)
- Does it work with all alpha values or only clean edges?
- Performance cost?

**Risk Level:** MEDIUM (cosmetic, but affects final visual quality)

**Required Test:** Run sample export, zoom into transparent edges in-game, visually compare to version without flag

**Production Recommendation:** Safe to use; enable for all exports

---

### Aseprite Per-Tag Export Limitation

**Flag:** `--split-tags`

**Current Status:** ✅ VERIFIED WITH CAVEAT

**What we know:**
- `--split-tags` ONLY works with `--save-as`, NOT with `--sheet`
- Workaround: Use `--tag {NAME}` in separate loop for per-tag sheets

**Risk Level:** LOW (workaround is straightforward)

**Production Recommendation:** Always loop over tags explicitly; don't rely on `--split-tags`

---

## PART 3: KNOWN GOTCHAS

### 1. Aseprite `--extrude` vs TexturePacker `--extrude`

| Tool | Value Type | Behavior |
|------|-----------|----------|
| Aseprite | Flag only | Always adds 1px |
| TexturePacker | Integer parameter | Configurable: 0, 1, 2, ... |

**Risk:** If you copy template and use `--extrude 1` in Aseprite, it FAILS (Aseprite expects flag)

**Mitigation:** Keep separate command templates for each tool (done in main kit)

---

### 2. Frame Key Suffix Consistency

**Gotcha:** If you use `--trim-sprite-names` in TexturePacker but forget to use `suffix: ''` in Phaser's `generateFrameNames()`, animation creation fails.

**Example of WRONG:**
```javascript
// TexturePacker exported with --trim-sprite-names (no .png in keys)
// But Phaser code uses suffix: '.png' (looking for .png)
const frames = this.anims.generateFrameNames('atlas', {
    prefix: 'walk/',
    suffix: '.png'  // ❌ WRONG - TexturePacker removed .png
});
// Result: Frame not found error
```

**Mitigation:** TEST-04 validates this; added validator in main kit

---

### 3. Multipack Determinism

**Gotcha:** TexturePacker's multipack feature may split frames across sheets unpredictably if frame order changes.

**Risk:** If you update sprite art and re-export, frame distribution might change, breaking hardcoded sheet assumptions.

**Mitigation:** Always use frame name keys (not sheet indices); let Phaser resolve across sheets

---

### 4. Aseprite Pivot Only in Slices

**Gotcha:** Aseprite's JSON export **DOES NOT** include `pivot` at the frame level; pivot is ONLY in `meta.slices[]`.

```json
// Aseprite export structure:
{
  "frames": {
    "frame_0": { /* NO pivot field */ }
  },
  "meta": {
    "slices": [
      {
        "name": "character",
        "keys": [
          { "frame": 0, "pivot": { "x": 16, "y": 32 } }  // Pivot here only
        ]
      }
    ]
  }
}
```

**Risk:** If you assume `frame.pivot` exists in Aseprite export, manual parsing fails.

**Mitigation:** If using Aseprite, extract pivot from `meta.slices` and manually set in Phaser

---

## PART 4: PRODUCTION READINESS CHECKLIST

### Pre-Production (Before Using Templates)

- [ ] Run TEST-04 (suffix convention) — MUST PASS
- [ ] Run TEST-02 (pivot auto-apply) — MUST PASS
- [ ] Run TEST-03 (trim jitter) — MUST PASS
- [ ] Visually inspect one exported atlas at 200% zoom (check no halos)
- [ ] Create test animation in Phaser, verify playback
- [ ] Document team's naming convention (policy) in writing

### Post-Production (After Using in Game)

- [ ] Monitor for animation jitter bugs (TEST-03 indicator)
- [ ] Monitor for "Frame not found" errors (TEST-04 indicator)
- [ ] Log any new gotchas discovered in practice
- [ ] Update CLI templates if new best practices emerge

---

## PART 5: Flag Confidence Matrix

### High Confidence (Use Immediately)

| Flag | Tool | Why |
|------|------|-----|
| `--format phaser` | TexturePacker | Only format with required features |
| `--trim-mode Trim` | TexturePacker | Industry standard for pixel art |
| `--disable-rotation` | TexturePacker | Prevents unexpected frame flips |
| `--tag {NAME}` | Aseprite | Well-documented, reliable |
| `this.load.atlas()` | Phaser | Official API |

### Medium Confidence (Use with Caution, Test First)

| Flag | Tool | Why | Blocker |
|------|------|-----|---------|
| `--alpha-handling ReduceBorderArtifacts` | TexturePacker | Works but algorithm not transparent | TEST-03 |
| `frame.pivotX/Y` | Phaser | Manual setting works; auto-apply unknown | TEST-02 |
| `--multipack` | TexturePacker | Works but determinism unclear | TEST-05 (TBD) |

### Low Confidence (Avoid or Document Heavily)

| Flag | Tool | Why |
|------|------|-----|
| `--split-tags` | Aseprite | Only works with `--save-as`, not `--sheet` |
| Aseprite `pivot` in JSON | Aseprite | Only in slices, not frames |
| PNG-8 output | Both | Untested for color banding risk |

---

## PART 6: Quick Troubleshooting Guide

### Symptom: "Frame not found" error in Phaser

**Checklist:**
1. Run naming policy validator (Section D.4 in main kit)
2. Check `suffix` in `generateFrameNames()` matches actual keys
3. Verify `--trim-sprite-names` flag usage matches suffix value
4. List actual keys: `jq '.frames | keys[]' atlas.json | head -3`
5. Compare to expected pattern

**Common Cause:** Mismatch between TexturePacker `--trim-sprite-names` flag and Phaser `suffix` parameter

---

### Symptom: Animation jitters vertically (baseline bounces)

**Checklist:**
1. Verify pivot consistency: `jq '.frames | .[] | .pivot' atlas.json | sort -u`
2. Check sourceSize consistency: `jq '.frames | .[] | .sourceSize' atlas.json | sort -u`
3. If using Trim mode, check spriteSourceSize variance (should be ≤1px offset)
4. Run TEST-03 (Trim Mode Jitter) to validate your export settings

**Common Cause:** Inconsistent pivot or sourceSize due to `--trim-mode Crop` instead of `Trim`

---

### Symptom: Dark halos/fringing around sprite edges

**Checklist:**
1. Verify `--alpha-handling ReduceBorderArtifacts` is set
2. Verify `--extrude 1` is set
3. Verify `--shape-padding 2` and `--border-padding 2` are set
4. In Phaser, verify `setFilterMode(FilterMode.NEAREST)` is called
5. Check source PNG for pre-existing dark edges (pre-process issue)

**Common Cause:** Alpha handling not enabled or filtering mode is LINEAR instead of NEAREST

---

### Symptom: Animation looks pixelated/blurry (not crisp)

**Checklist:**
1. Verify `texture.setFilterMode(FilterMode.NEAREST)` is set (not LINEAR)
2. Verify game config `pixelArt: true` is set (if using global setting)
3. Check PNG format is RGB or RGBA (not indexed/PNG-8)

**Common Cause:** Filtering mode is LINEAR instead of NEAREST

---

## PART 7: Test Execution Log Template

Use this template to record test results:

```markdown
# Test Execution Log

**Date:** [DATE]
**Executor:** [NAME]
**Environment:** Phaser [VERSION], TexturePacker [VERSION], Aseprite [VERSION]

## TEST-04: Frame Key Suffix Convention
**Status:** [ ] PASS  [ ] FAIL  [ ] SKIPPED
**Duration:** [TIME]
**Notes:** [FINDINGS]
**Evidence:** [SCREENSHOTS/LOGS]
**Decision:** [ACTION]

## TEST-02: Phaser Pivot Auto-Apply
**Status:** [ ] PASS  [ ] FAIL  [ ] SKIPPED
**Duration:** [TIME]
**Notes:** [FINDINGS]
**Evidence:** [SCREENSHOTS/LOGS]
**Decision:** [ACTION]

## TEST-03: Trim Mode Jitter
**Status:** [ ] PASS  [ ] FAIL  [ ] SKIPPED
**Duration:** [TIME]
**Notes:** [FINDINGS]
**Evidence:** [VIDEOS/SCREENSHOTS]
**Decision:** [ACTION]

## Summary
- [X] All critical tests passed
- [ ] Action items for next sprint
- [ ] Updated templates and docs
```

---

## APPENDIX: References

### TexturePacker Documentation
- Format Options: https://www.codeandweb.com/texturepacker/documentation/texture-settings
- Output Data Formats: https://www.codeandweb.com/texturepacker/documentation/data-formats
- Command Line: https://www.codeandweb.com/texturepacker/documentation/command-line

### Aseprite Documentation
- CLI Reference: https://aseprite.org/docs/cli/
- JSON Export Format: https://aseprite.org/docs/json-export-file/

### Phaser Documentation
- Loader: https://docs.phaser.io/latest/Phaser.Loader.LoaderPlugin
- Textures: https://docs.phaser.io/latest/Phaser.Textures
- Animations: https://docs.phaser.io/latest/Phaser.Animations

---

**Document Version:** 1.0 | **Last Updated:** January 2026 | **Status:** Ready for Team Review