
import json
import pandas as pd
from datetime import datetime

# Extract all the spec details into structured formats for reference

# OPUS HARD GATES
opus_hard_gates = {
    "HF-01": {"name": "FORMAT_DIMENSIONS_MATCH", "check": "Programmatic", "codes": ["HF01_FORMAT_MISMATCH", "HF01_WIDTH_MISMATCH", "HF01_HEIGHT_MISMATCH", "HF01_NO_ALPHA"]},
    "HF-02": {"name": "TRANSPARENCY_BACKGROUND", "check": "Programmatic + Vision", "codes": ["HF02_OPAQUE_BACKGROUND", "HF02_BACKGROUND_LEAK", "HF02_EXCESSIVE_HALO"]},
    "HF-03": {"name": "BASELINE_PIVOT_STABILITY", "check": "Programmatic", "codes": ["HF03_BASELINE_DRIFT"]},
    "HF-04": {"name": "NAMING_METADATA_CONTRACT", "check": "Programmatic", "codes": ["HF04_JSON_INVALID", "HF04_MISSING_FRAMES", "HF04_DUPLICATE_KEYS", "HF04_NAME_MISMATCH"]},
    "HF-05": {"name": "GROSS_ANATOMY_BREAK", "check": "VLM", "codes": ["HF05_EXTRA_LIMBS", "HF05_MISSING_LIMBS", "HF05_WRONG_OUTFIT", "HF05_IDENTITY_BREAK"]}
}

# OPUS SOFT FAIL CHECKS
opus_soft_fails = {
    "SF-01": {"name": "IDENTITY_SIMILARITY_SCORE", "metrics": ["ssim_vs_anchor", "dino_similarity"], "hardfloor": "ssim < 0.75 OR dino < 0.80", "softfail": "ssim < 0.85 OR dino < 0.90", "codes": ["SF01_IDENTITY_DRIFT"]},
    "SF-02": {"name": "PALETTE_DRIFT_SCORE", "metrics": ["palette_match_pct"], "hardfloor": "< 80%", "softfail": "< 90%", "codes": ["SF02_PALETTE_DRIFT"]},
    "SF-03": {"name": "OUTLINE_PIXEL_DENSITY", "metrics": ["line_weight_drift"], "hardfloor": "> 20%", "softfail": "> 15%", "codes": ["SF03_LINE_DRIFT", "SF03_BLUR_DETECTED"]},
    "SF-04": {"name": "FRAME_COHERENCE", "metrics": ["frame_ssim_min", "lpips_max"], "hardfloor": "frame_ssim < 0.70 OR lpips > 0.25", "softfail": "frame_ssim < 0.85 OR lpips > 0.15", "codes": ["SF04_TEMPORAL_FLICKER"]},
    "SF-05": {"name": "ALPHA_EDGE_ARTIFACTS", "metrics": ["halo_pixel_count", "fringe_severity"], "hardfloor": "fringe_severity > 0.3", "softfail": "fringe_severity > 0.1", "codes": ["SF05_HALO_DETECTED", "SF05_FRINGE_DETECTED"]}
}

# OPUS THRESHOLD TABLE
opus_thresholds = pd.DataFrame({
    "Metric": [
        "SSIM (vs anchor)",
        "DINO similarity",
        "Frame-to-frame SSIM",
        "LPIPS (frame-to-frame)",
        "Palette match %",
        "Line weight drift",
        "Baseline drift (px)",
        "Fringe severity"
    ],
    "Hard_Fail": ["< 0.75", "< 0.80", "< 0.70", "> 0.25", "< 80%", "> 20%", "> 2", "> 0.3"],
    "Soft_Fail_Warn": ["0.75–0.84", "0.80–0.89", "0.70–0.84", "0.15–0.25", "80–89%", "15–20%", "2", "0.1–0.3"],
    "Pass": ["≥ 0.85", "≥ 0.90", "≥ 0.85", "< 0.15", "≥ 90%", "< 15%", "≤ 1", "≤ 0.1"]
})

# GEMINI ALIGNED SCORING WEIGHTS (v2.0 Opus-aligned)
gemini_v2_weights = {
    "Stability_w": 0.35,
    "Identity_w": 0.30,
    "Palette_w": 0.20,
    "Style_w": 0.15
}

# GEMINI SCORING RANK BANDS
score_ranks = pd.DataFrame({
    "Rank": ["Diamond", "Gold", "Silver", "Bronze"],
    "Score_Min": [92, 80, 65, 0],
    "Score_Max": [100, 91, 79, 64],
    "LPIPS_Check": ["> 0.90", "> 0.85", "< 0.85", "Any"],
    "Status": ["PASS", "PASS", "SOFT_FAIL", "REJECT"],
    "Action": [
        "Auto-Commit. Pixel-perfect stability.",
        "Acceptable. 1px jitter or minor noise.",
        "Conditional Retry (attempts < 3) or Manual Review.",
        "Hard Fail. Trigger retry mapping."
    ]
})

# GEMINI REJECT CODES
reject_codes = pd.DataFrame({
    "Code": ["REJ_JITTER", "REJ_ID", "REJ_BLUR", "REJ_PAL", "REJ_HALO", "REJ_BROKEN"],
    "Trigger": ["baseline > 1.0", "dino < 0.75", "lpips > 0.25", "pal_delta > 0.1", "alpha_fringe > 5%", "ssim < 0.6"],
    "Description": [
        "Stability. Feet misaligned, ice skating risk.",
        "Identity. Character unrecognizable.",
        "Style. Image mushy/painterly/lacks pixel definition.",
        "Palette. Hallucinated colors or gradients.",
        "Alpha. Dirty edges/halos.",
        "Pose. Missing limbs or major anatomical failure."
    ],
    "Ladder_Step": [
        "Step 4: Pose Rescue",
        "Step 3: Identity Rescue",
        "Step 2: Negative Prompt",
        "Step 6: Post-Process",
        "Step 6: Cleanup",
        "Step 1: Reroll"
    ]
})

# RETRY LADDER STEPS
retry_ladder = pd.DataFrame({
    "Step": [1, 2, 3, 4, 5, 6, 7],
    "Name": [
        "Seed Reroll",
        "Negative Prompt Tighten",
        "Identity Rescue",
        "Pose Rescue",
        "Targeted Inpainting",
        "Post-Process Corrections",
        "Manual Review"
    ],
    "Max_Attempts": [3, 2, 2, 2, 2, 1, "∞"],
    "Cumulative_Max": [3, 5, 7, 9, 11, 12, "Manual"],
    "Target_Issues": [
        "Random artifacts, minor deformities",
        "Extra limbs, BG leak, blur, painterly",
        "Face/hair/outfit drift, silhouette changes",
        "Pose mismatch, limb placement errors",
        "Localized drift in critical regions",
        "Palette drift, pixel density, edge artifacts",
        "Complex/ambiguous failures"
    ]
})

# STOP CONDITIONS
stop_conditions = pd.DataFrame({
    "Condition": [
        "Single frame max retries",
        "Move retry rate threshold",
        "Move reject rate threshold",
        "Character reject rate threshold",
        "Consecutive failures"
    ],
    "Threshold": ["12 attempts", ">20% frames", ">50% final rejects", ">30% across all moves", "5 frames in a row"],
    "Action": [
        "Escalate to manual review",
        "STOP move generation",
        "STOP move generation",
        "STOP character generation",
        "STOP move generation"
    ]
})

print("✓ Opus Specifications Extracted")
print("✓ Gemini v2.0 (Opus-aligned) Scoring System Extracted")
print("✓ Retry Ladder & Stop Conditions Defined")
print("\nReady to generate dashboard workbook...")
