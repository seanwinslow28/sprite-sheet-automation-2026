
import json
from datetime import datetime, timedelta

# Generate sample data for the Dashboard Workbook

# ============================================================================
# 1. CONFIG_THRESHOLDS TAB
# ============================================================================
config_thresholds_data = [
    ["HARD GATES (Opus Spec) – Auto-Reject Conditions"],
    [""],
    ["Gate_Code", "Gate_Name", "Check_Method", "Hard_Threshold", "Reason_Codes", "Retry_Knob"],
    ["HF-01", "FORMAT_DIMENSIONS_MATCH", "Programmatic", "width == anchor.width AND height == anchor.height", "HF01_FORMAT_MISMATCH|HF01_WIDTH_MISMATCH|HF01_HEIGHT_MISMATCH|HF01_NO_ALPHA", "Re-generate with locked canvas size"],
    ["HF-02", "TRANSPARENCY_BACKGROUND", "Programmatic + Vision", "alpha == 0, no BG leak > 5%", "HF02_OPAQUE_BACKGROUND|HF02_BACKGROUND_LEAK|HF02_EXCESSIVE_HALO", "Explicit transparent prompt + matte extraction"],
    ["HF-03", "BASELINE_PIVOT_STABILITY", "Programmatic", "baseline_drift <= ±1 px", "HF03_BASELINE_DRIFT", "Enforce consistent pivot in generation"],
    ["HF-04", "NAMING_METADATA_CONTRACT", "Programmatic", "Valid JSON, all frames present, no duplicates", "HF04_JSON_INVALID|HF04_MISSING_FRAMES|HF04_DUPLICATE_KEYS|HF04_NAME_MISMATCH", "Re-export with standardized folder layout"],
    ["HF-05", "GROSS_ANATOMY_BREAK", "VLM", "No extra/missing limbs, correct outfit", "HF05_EXTRA_LIMBS|HF05_MISSING_LIMBS|HF05_WRONG_OUTFIT|HF05_IDENTITY_BREAK", "Increase reference strength, face/hand inpaint"],
    [""],
    ["SOFT FAIL CHECKS (Opus Spec) – Numeric Scoring"],
    [""],
    ["Check_Code", "Check_Name", "Key_Metrics", "Hard_Floor_Threshold", "Soft_Fail_Threshold", "Pass_Threshold"],
    ["SF-01", "IDENTITY_SIMILARITY", "ssim_vs_anchor, dino_similarity", "ssim < 0.75 OR dino < 0.80", "ssim < 0.85 OR dino < 0.90", "ssim >= 0.85 AND dino >= 0.90"],
    ["SF-02", "PALETTE_DRIFT", "palette_match_pct", "< 80%", "< 90%", ">= 90%"],
    ["SF-03", "LINE_WEIGHT_DRIFT", "line_weight_drift", "> 20%", "> 15%", "<= 15%"],
    ["SF-04", "FRAME_COHERENCE", "frame_ssim_min, lpips_max", "frame_ssim < 0.70 OR lpips > 0.25", "frame_ssim < 0.85 OR lpips > 0.15", "frame_ssim >= 0.85 AND lpips <= 0.15"],
    ["SF-05", "ALPHA_EDGE_ARTIFACTS", "halo_pixel_count, fringe_severity", "fringe_severity > 0.3", "fringe_severity > 0.1", "<= 0.1"],
    [""],
    ["GEMINI V2.0 SCORING WEIGHTS (Opus-Aligned)"],
    [""],
    ["Component", "Weight", "Normalization_Formula", "Perfect_Score", "1px_Jitter_Score", "2px_Jitter_Score"],
    ["Stability (S_St)", "0.35", "e^(-1.5 * baseline_error_px)", "1.0", "0.22", "0.05"],
    ["Identity (S_Id)", "0.30", "(dino_sim - 0.60) / 0.40, clamped [0,1]", "1.0", "0.88", "0.75"],
    ["Palette (S_Pal)", "0.20", "1.0 - (palette_delta * 3.0)", "1.0", "0.97", "0.93"],
    ["Style/Texture (S_Tex)", "0.15", "1.0 - clamp(LPIPS / 0.3, 0, 1)", "1.0", "0.97", "0.93"],
    [""],
    ["FINAL_SCORE = 100 * (0.35*S_St + 0.30*S_Id + 0.20*S_Pal + 0.15*S_Tex)"],
    [""],
    ["RANK BANDS & GATING LOGIC"],
    [""],
    ["Rank", "Score_Range", "LPIPS_Check", "Status", "Action"],
    ["Diamond", "92-100", "> 0.90", "PASS", "Auto-Commit. Pixel-perfect stability (0px) and high fidelity."],
    ["Gold", "80-91", "> 0.85", "PASS", "Acceptable. Likely 1px jitter or minor color noise (fixable)."],
    ["Silver", "65-79", "< 0.85", "SOFT_FAIL", "Conditional Retry. If attempts < 3, RETRY. Else, FLAG for Manual Batch B."],
    ["Bronze", "0-64", "Any", "REJECT", "Hard Fail. Discard and trigger Retry Mapping."],
    [""],
    ["SOFT FAIL THRESHOLDS (Tunable)"],
    [""],
    ["Threshold_Name", "Current_Value", "Min_Safe_Value", "Max_Safe_Value", "Calibration_Notes"],
    ["SSIM_vs_anchor_pass", "0.85", "0.80", "0.90", "Identity drift detection; balances strictness with pose variation"],
    ["DINO_pass", "0.90", "0.85", "0.95", "Feature-level identity; more robust to pose changes"],
    ["Frame_SSIM_pass", "0.85", "0.80", "0.90", "Adjacent frame coherence; allows pose motion"],
    ["LPIPS_pass", "0.15", "0.10", "0.20", "Perceptual flicker detection"],
    ["Palette_match_pass", "0.90", "0.85", "0.95", "Top-10 colors within 10 RGB tolerance"],
    ["Line_weight_pass", "0.15", "0.10", "0.20", "Edge thickness consistency"],
    ["Baseline_drift_pass", "1", "0", "2", "Vertical alignment stability (pixels)"],
]

# ============================================================================
# 2. REASON_CODES TAB
# ============================================================================
reason_codes_data = [
    ["HARD FAIL REASON CODES (Auto-Reject)"],
    [""],
    ["Reason_Code", "Check_ID", "Description", "Typical_Retry_Step", "Knob_Adjustment"],
    ["HF01_FORMAT_MISMATCH", "HF-01", "PNG format or channel mismatch", "Step 1: Reroll", "Lock canvas size"],
    ["HF01_WIDTH_MISMATCH", "HF-01", "Frame width != anchor width", "Step 1: Reroll", "Lock canvas width"],
    ["HF01_HEIGHT_MISMATCH", "HF-01", "Frame height != anchor height", "Step 1: Reroll", "Lock canvas height"],
    ["HF01_NO_ALPHA", "HF-01", "No RGBA channels (missing alpha)", "Step 1: Reroll", "Enable RGBA output"],
    ["HF02_OPAQUE_BACKGROUND", "HF-02", "Background is not transparent (alpha > 0)", "Step 2: Negative Prompt", "Add 'transparent background' to prompt"],
    ["HF02_BACKGROUND_LEAK", "HF-02", "Non-transparent pixels > 5% outside silhouette", "Step 2: Negative Prompt", "Add 'no background' to negative prompt"],
    ["HF02_EXCESSIVE_HALO", "HF-02", "Semi-transparent halo > 5% of edge pixels", "Step 6: Post-Process", "Cleanup halo with alpha threshold"],
    ["HF03_BASELINE_DRIFT", "HF-03", "Baseline variance > ±1px across frames", "Step 4: Pose Rescue", "Enforce consistent pivot; verify Phaser test"],
    ["HF04_JSON_INVALID", "HF-04", "Atlas JSON is malformed or unparseable", "Step 1: Reroll", "Re-export with valid JSON"],
    ["HF04_MISSING_FRAMES", "HF-04", "Frame count in JSON != expected manifest count", "Step 1: Reroll", "Re-export with all frames"],
    ["HF04_DUPLICATE_KEYS", "HF-04", "Duplicate frame keys in JSON", "Step 1: Reroll", "Ensure unique frame names"],
    ["HF04_NAME_MISMATCH", "HF-04", "Frame names don't match pattern (e.g., contain .png)", "Step 1: Reroll", "Use standardized naming convention"],
    ["HF05_EXTRA_LIMBS", "HF-05", "Candidate has extra limbs vs anchor", "Step 5: Inpainting", "Face/hand inpaint pass"],
    ["HF05_MISSING_LIMBS", "HF-05", "Candidate missing limbs vs anchor", "Step 5: Inpainting", "Increase reference strength"],
    ["HF05_WRONG_OUTFIT", "HF-05", "Outfit/hair/face wrong vs anchor", "Step 3: Identity Rescue", "Raise reference/ID conditioning weight"],
    ["HF05_IDENTITY_BREAK", "HF-05", "Major silhouette deviation from anchor", "Step 5: Inpainting", "Increase reference strength, lower denoise"],
    [""],
    ["SOFT FAIL REASON CODES (Retry if score < threshold)"],
    [""],
    ["Reason_Code", "Check_ID", "Description", "Typical_Retry_Step", "Knob_Adjustment"],
    ["SF01_IDENTITY_DRIFT", "SF-01", "SSIM < 0.85 OR DINO < 0.90", "Step 3: Identity Rescue", "Lower denoise (0.7→0.5), raise reference weight"],
    ["SF02_PALETTE_DRIFT", "SF-02", "Palette match % < 90%", "Step 6: Post-Process", "Lock palette explicitly; quantize in post"],
    ["SF03_LINE_DRIFT", "SF-03", "Line weight drift > 15%", "Step 2: Negative Prompt", "Add 'crisp pixel edges, no blur' to prompt"],
    ["SF03_BLUR_DETECTED", "SF-03", "Blur detected via edge map", "Step 2: Negative Prompt", "Add anti-aliasing negatives; use NN downscale"],
    ["SF04_TEMPORAL_FLICKER", "SF-04", "Frame-to-frame SSIM < 0.85 OR LPIPS > 0.15", "Step 1: Seed Reroll", "Anchor-to-anchor chaining (use prev frame ref)"],
    ["SF05_HALO_DETECTED", "SF-05", "Semi-transparent halo around silhouette", "Step 6: Post-Process", "Ensure TexturePacker ReduceBorderArtifacts"],
    ["SF05_FRINGE_DETECTED", "SF-05", "Fringe severity > 0.1", "Step 6: Post-Process", "Adjust BG removal; re-export with extrude/padding"],
]

# ============================================================================
# 3. RUNS TAB (Sample Data)
# ============================================================================
run_ids = ["run_001", "run_002", "run_003", "run_004", "run_005"]
pipeline_ids = ["pipe_v1", "pipe_v1", "pipe_v2", "pipe_v2", "pipe_v1"]
character_ids = ["sean", "sean", "ryu", "ryu", "ken"]
move_ids = ["idle_stance", "walk_forward", "punch_heavy", "kick_high", "hadoken"]
dates = [(datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d %H:%M:%S") for i in range(5)]

runs_data = [["run_id", "date", "pipeline_id", "character_id", "move_id", "total_frames", "pass_count", "reject_count", "softfail_count", "retry_rate", "pass_rate", "stop_reason", "notes"]]
for i, (rid, d, pid, cid, mid) in enumerate(zip(run_ids, dates, pipeline_ids, character_ids, move_ids)):
    total = 12
    passed = 10
    rejected = 1
    softfailed = 1
    retry_rate = 0.33  # Some frames retried
    pass_rate = passed / total
    stop_reason = ""
    notes = "Normal completion" if i < 4 else "Minor palette drift detected"
    runs_data.append([rid, d, pid, cid, mid, total, passed, rejected, softfailed, retry_rate, pass_rate, stop_reason, notes])

# ============================================================================
# 4. FRAMES TAB (Sample Data)
# ============================================================================
frames_data = [["run_id", "character_id", "move_id", "frame_index", "attempt", "seed_hash", "score", "result", "primary_reason_code", "all_reason_codes", "ssim_vs_anchor", "dino_similarity", "frame_ssim_prev", "lpips_prev", "palette_match_pct", "line_weight_drift", "baseline_row", "halo_pixel_count", "fringe_severity", "file_path"]]

# Sample 10 frame records
sample_frame_records = [
    ["run_001", "sean", "idle_stance", 1, 1, "0x3a7f2b1e", 92.5, "PASS", "", "", 0.88, 0.93, None, None, 0.94, 0.08, 256, 2, 0.02, "/gen/run_001/sean_idle_01.png"],
    ["run_001", "sean", "idle_stance", 2, 1, "0x5c9e1d4f", 85.2, "PASS", "", "", 0.82, 0.88, 0.86, 0.12, 0.91, 0.12, 256, 5, 0.05, "/gen/run_001/sean_idle_02.png"],
    ["run_001", "sean", "idle_stance", 3, 2, "0x1b2e9d7c", 78.1, "SOFT_FAIL", "SF01_IDENTITY_DRIFT", "SF01_IDENTITY_DRIFT", 0.79, 0.86, 0.84, 0.14, 0.89, 0.10, 255, 3, 0.03, "/gen/run_001/sean_idle_03_retry.png"],
    ["run_002", "sean", "walk_forward", 1, 1, "0x7a3c5e9f", 95.8, "PASS", "", "", 0.91, 0.95, None, None, 0.96, 0.05, 260, 1, 0.01, "/gen/run_002/sean_walk_01.png"],
    ["run_002", "sean", "walk_forward", 2, 3, "0x8b4d2f6a", 68.3, "SOFT_FAIL", "REJ_JITTER", "REJ_JITTER,REJ_BLUR", 0.75, 0.82, 0.68, 0.22, 0.87, 0.18, 262, 8, 0.08, "/gen/run_002/sean_walk_02_retry.png"],
    ["run_003", "ryu", "punch_heavy", 1, 1, "0x4f6e8c2a", 91.2, "PASS", "", "", 0.87, 0.92, None, None, 0.92, 0.09, 248, 2, 0.02, "/gen/run_003/ryu_punch_01.png"],
    ["run_003", "ryu", "punch_heavy", 2, 1, "0x9d5a1c7e", 82.5, "PASS", "", "", 0.81, 0.87, 0.79, 0.16, 0.88, 0.13, 249, 6, 0.06, "/gen/run_003/ryu_punch_02.png"],
    ["run_003", "ryu", "punch_heavy", 3, 1, "0x2c8f5a3b", 0, "REJECT", "HF05_IDENTITY_BREAK", "HF05_IDENTITY_BREAK,HF05_EXTRA_LIMBS", 0.68, 0.72, 0.72, 0.28, 0.75, 0.22, 250, 12, 0.15, "/gen/run_003/ryu_punch_03_REJECT.png"],
    ["run_004", "ryu", "kick_high", 1, 2, "0x6b3e9f2c", 77.9, "SOFT_FAIL", "SF02_PALETTE_DRIFT", "SF02_PALETTE_DRIFT", 0.84, 0.89, 0.83, 0.14, 0.85, 0.11, 252, 4, 0.04, "/gen/run_004/ryu_kick_01_retry.png"],
    ["run_005", "ken", "hadoken", 1, 1, "0x5f7c4a9d", 94.1, "PASS", "", "", 0.89, 0.94, None, None, 0.95, 0.06, 258, 1, 0.01, "/gen/run_005/ken_hadoken_01.png"],
]
frames_data.extend(sample_frame_records)

# ============================================================================
# 5. CHARTS TAB (Summary metrics for visualization)
# ============================================================================
charts_data = [
    ["SUMMARY METRICS (Auto-Updated)"],
    [""],
    ["Metric", "Value", "Target", "Status"],
    ["Overall Pass Rate (%)", "80.0", ">= 90%", "⚠ Below Target"],
    ["Overall Reject Rate (%)", "10.0", "<= 5%", "⚠ Above Target"],
    ["Overall Soft Fail Rate (%)", "10.0", "<= 10%", "✓ On Target"],
    ["Avg Retry Rate per Frame", "0.27", "<= 0.20", "⚠ Above Target"],
    ["Avg Attempts per Frame", "1.27", "<= 1.20", "⚠ Slightly High"],
    ["Most Common Reject Code", "REJ_JITTER", "N/A", "Monitor"],
    ["Most Common Soft Fail Code", "SF01_IDENTITY_DRIFT", "N/A", "Monitor"],
    [""],
    ["PASS RATE TREND (Last 5 Runs)"],
    [""],
    ["Run_ID", "Character", "Move", "Pass_Rate_Pct"],
    ["run_001", "sean", "idle_stance", "83.3"],
    ["run_002", "sean", "walk_forward", "83.3"],
    ["run_003", "ryu", "punch_heavy", "66.7"],
    ["run_004", "ryu", "kick_high", "100.0"],
    ["run_005", "ken", "hadoken", "100.0"],
    [""],
    ["REJECT REASON DISTRIBUTION (Last 10 Runs)"],
    [""],
    ["Reason_Code", "Count", "Percentage"],
    ["REJ_JITTER", "4", "40%"],
    ["REJ_ID", "2", "20%"],
    ["REJ_PAL", "1", "10%"],
    ["REJ_BLUR", "2", "20%"],
    ["REJ_HALO", "1", "10%"],
]

# ============================================================================
# 6. V0_V1_DIFF TAB
# ============================================================================
v0_v1_diff_data = [
    ["COMPARISON: Original Gemini (v0) vs Opus-Aligned Gemini (v1)"],
    [""],
    ["Component", "Gemini_v0_Original", "Gemini_v1_Opus_Aligned", "Change_Rationale"],
    [""],
    ["SCORING WEIGHTS"],
    ["Stability (S_St) weight", "0.30", "0.35", "Increased 50% – Baseline consistency is King (Opus decision)"],
    ["Identity (S_Id) weight", "0.35", "0.30", "Decreased slightly – Still critical but Stability now primary"],
    ["Style (S_Sy) weight", "0.20", "0.15", "Decreased – Lower importance for animation flexibility"],
    ["Technical (S_Te) weight", "0.15", "0.20 → Palette", "Separated into Palette (0.20) for explicit control"],
    [""],
    ["STABILITY FORMULA"],
    ["S_St formula", "e^(-baseline_error_px)", "e^(-1.5 * baseline_error_px)", "Increased exponent to 1.5 for harsher penalty at 1px"],
    ["S_St @ 0px", "1.0", "1.0", "No change"],
    ["S_St @ 1px", "0.37", "0.22", "Much harsher penalty (63% reduction vs 37%)"],
    ["S_St @ 2px", "0.13", "0.05", "Nearly unusable (95% penalty)"],
    [""],
    ["IDENTITY METRICS"],
    ["v0 used", "vision_identity_drift_score (1-5 scale)", "dinov2_similarity (cosine, 0-1 scale)", "Switched to computable, pose-robust metric"],
    ["v0 gate", "vision_id_score >= 4", "dinov2_sim < 0.60", "Converted to cosine similarity gate"],
    ["v0 normalization", "1.0 - (score-1)/4.0", "clamp((dino_sim - 0.60) / 0.40, 0, 1)", "Effective range 1-3 → 0.60-1.0 (pose-robust)"],
    [""],
    ["TECHNICAL METRICS (NEW SEPARATION)"],
    ["v0 Technical", "0.6*(1-palette_delta) + 0.4*(ssim)", "SPLIT: Palette (0.20) + Style (0.15)", "Explicit palette control vs v0 bundling"],
    ["Palette weight", "0.15 (embedded)", "0.20 (standalone)", "Increased 33% – Palette is critical for indexed color games"],
    ["Palette formula", "(1.0 - palette_delta)", "1.0 - (palette_delta * 3.0)", "Amplified penalty (3x multiplier)"],
    ["Style metric change", "edge_map_similarity", "LPIPS (AlexNet, perceptual)", "Switched to industry-standard LPIPS for blur detection"],
    ["Style formula", "0.6*(edge_map) + 0.4*(ssim)", "1.0 - clamp(LPIPS / 0.3, 0, 1)", "Simplified; LPIPS detects AI artifacts better"],
    [""],
    ["HARD GATES (NEW)"],
    ["v0 gates", "Baseline > 3px, Identity score >= 4, Palette > 0.15, Canvas safety", "HG_DIM, HG_BASE (>2px), HG_ID (DINOv2 < 0.60), HG_ALPHA, HG_SAFE", "Opus gates formalized; baseline tightened 3px→2px"],
    [""],
    ["RANK BANDS"],
    ["Diamond (PASS)", "90-100 (SSIM > 0.90)", "92-100 (LPIPS > 0.90)", "Score floor raised 2 points; LPIPS now primary"],
    ["Gold (PASS)", "75-89 (SSIM > 0.85)", "80-91 (LPIPS > 0.85)", "Floor raised 5 points; stricter acceptance"],
    ["Silver (SOFT_FAIL)", "60-74 (SSIM < 0.85)", "65-79 (LPIPS < 0.85)", "Floor raised 5 points; narrow soft fail band"],
    ["Bronze (REJECT)", "0-59 (any)", "0-64 (any)", "Floor raised 5 points; wider hard fail band"],
    [""],
    ["REJECT CODE MAPPING"],
    ["v0 codes", "6 reason codes (generic)", "6+ reason codes (specific to Opus checks)", "More granular, action-mapped codes"],
    ["NEW v1 codes", "N/A", "REJ_JITTER, REJ_ID, REJ_BLUR, REJ_PAL, REJ_HALO, REJ_BROKEN", "Directly tied to Opus hard gates (HF-01 to HF-05, SF-01 to SF-05)"],
    [""],
    ["RETRY MAPPING PRECISION"],
    ["v0 retry guidance", "Generic 'increase weight', 'adjust CFG'", "Specific ladder steps (1-7) with exact knob adjustments", "Opus retry ladder formalized with max attempts"],
    ["Step 1 (Reroll)", "Standard reroll", "Seed reroll (max 3) – targets random noise", "Unchanged"],
    ["Step 2 (Negative)", "Add generic negatives", "Negative tighten (max 2) – specific to failure type", "Now issue-specific"],
    ["Step 3 (Identity)", "Increase reference weight", "Identity Rescue (max 2) – lower denoise, raise ref weight", "Formalized & capped"],
    ["Step 4 (Pose)", "Increase ControlNet", "Pose Rescue (max 2) – increase ControlNet weight +0.15", "Explicit delta value"],
    ["Step 5 (Inpainting)", "Not in v0", "Targeted Inpainting (max 2) – two-stage face/hand/outfit fix", "NEW – escalation before post-process"],
    ["Step 6 (Post-Process)", "Not in v0", "Post-Process Corrections (max 1) – palette quantize, outline reinforce", "NEW – final pixel-safe adjustments"],
    ["Step 7 (Manual)", "N/A", "Escalate to Manual Review (∞ cost) – last resort", "NEW – clear escalation path"],
    [""],
    ["SUMMARY"],
    ["v0 Philosophy", "Balanced scoring with subjective vision scores", "v0 was flexible but not actionable"],
    ["v1 Philosophy", "Stability-first, identity-locked, palette-enforced scoring with objective metrics", "v1 is aligned to Opus spec, computable, and action-mapped"],
    ["Best Use", "Exploratory / development phase", "Production pipeline with autonomous retry"],
]

print("✓ All data structures prepared")
print(f"  - CONFIG_THRESHOLDS: {len(config_thresholds_data)} rows")
print(f"  - REASON_CODES: {len(reason_codes_data)} rows")
print(f"  - RUNS: {len(runs_data)} rows (header + {len(runs_data)-1} sample)")
print(f"  - FRAMES: {len(frames_data)} rows (header + {len(frames_data)-1} sample)")
print(f"  - CHARTS: {len(charts_data)} rows")
print(f"  - V0_V1_DIFF: {len(v0_v1_diff_data)} rows")
