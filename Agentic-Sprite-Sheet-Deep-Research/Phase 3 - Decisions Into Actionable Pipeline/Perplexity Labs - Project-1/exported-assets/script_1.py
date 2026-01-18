
import pandas as pd

# Create Decision Matrix scoring (1-5 scale with detailed notes)
scoring_data = {
    'Pipeline': [
        'LoRA + DWPose + ComfyUI',
        'IP-Adapter Plus + DWPose',
        '3D-Assisted (Mixamo + Blender)',
        'Animate Anyone (Fine-tuned)',
        'Flux Dev + LoRA + DWPose',
        'SDXL + IP-Adapter + Multi-ControlNet',
        'AnimateDiff + ControlNet',
        'Ludo.ai Pose Editor (SaaS)',
        'Zero-Shot Dual-Pass (IP + Face Fix)',
        'Hybrid Anchor-First (IP→LoRA)',
        'Character Sheet + LoRA Retrain',
        'PuLID + ACE + DWPose'
    ],
    
    'Anchor Identity Fidelity (1-5)': [5, 4, 4, 5, 5, 2, 3, 3, 4, 5, 5, 5],
    'Identity Notes': [
        'LoRA baked identity; even extreme poses stay on-model',
        'IP-Adapter ~90% consistency; fine details (logos, accessories) fluctuate',
        '3D rig guarantees structure; stylization pass can lose 2D nuances',
        'ReferenceNet spatial detail > CLIP; fine-tuned on anchors = perfect lock',
        'LoRA + constraint prompts = pixel-perfect; Flux follows instructions',
        'SDXL prompt-only = identity drift; needs LoRA/IP-Adapter augmentation',
        'Temporal module helps but no inherent ID lock; needs IP-Adapter/LoRA',
        'Same source image for all poses; black-box model variability',
        'IP-Adapter Plus decouples pose from identity; dual-pass fixes faces',
        'LoRA trained on IP-generated dataset from anchor; best cold-start',
        'Iterative LoRA refinement from anchor sheets; extremely flexible',
        'Face embeddings (InsightFace) + CLIP; near-perfect face replication'
    ],
    
    'Pose Control / Frame Coherence (1-5)': [5, 5, 5, 5, 5, 5, 4, 4, 5, 5, 4, 5],
    'Pose Notes': [
        'DWPose dense keypoints including hands/face; multi-ControlNet for depth',
        'DWPose skeletal blueprint = exact poses; no pose mechanism in IP alone',
        '3D rig = mathematically perfect poses; orthographic camera = no jitter',
        'Pose Guider 4-layer encoder aligns pose to latent; temporal smoothness',
        'DWPose + Flux instruction-following = precise; constraint prompts enforce',
        'DWPose + HED/Depth multi-ControlNet = structural fidelity; manual setup',
        'Temporal consistency 16-32 frames; Motion Module limited to 5s clips',
        'Built-in pose presets; auto-animate between keyframes; loops not perfect',
        'DWPose guides pose; dual-pass locks face while preserving body pose',
        'DWPose used in both IP generation and LoRA inference; proven hybrid',
        'ControlNet OpenPose/DWPose with manually created skeletons per action',
        'DWPose for pose + PuLID for face; ControlNet modifies conditioning'
    ],
    
    'Style / Pixel Stability (1-5)': [4, 3, 3, 4, 5, 2, 2, 3, 3, 4, 4, 3],
    'Style Notes': [
        'LoRA trained on style/pixel-art dataset; K-means palette quantization',
        'IP preserves color scheme but artifacts appear; needs cell-shading LoRA',
        '3D render = consistent density; stylization img2img can drift if denoise high',
        'ReferenceNet captures spatial detail; struggles with fine details (hair, props)',
        'Flux high-res 512x512; pixel-art LoRA + constraint prompts = crisp',
        'SDXL high-fidelity detail conflicts with pixel art; needs LoRA constraint',
        'AnimateDiff smooth interpolation = motion blur; counterproductive for pixel-art',
        'Integrated pixel art filter; black-box quality varies; touchup needed',
        'IP-Adapter style biases apply; post-process quantization enforces palette',
        'LoRA trained on anchor style; palette quantization in Assembler agent',
        'LoRA trained on consistent pixel art dataset; iterative refinement',
        'PuLID mirrors reference style; not pixel-art focused; needs post-process'
    ],
    
    'Determinism / Reproducibility (1-5)': [5, 4, 5, 5, 5, 4, 3, 2, 4, 5, 4, 4],
    'Determinism Notes': [
        'Fixed seed + LoRA + DWPose = same output every time; deterministic diffusion',
        'Fixed seed + IP reference = repeatable; but slight variance in fine details',
        '3D rig + same camera = pixel-identical frames; img2img adds variance',
        'Fine-tuned model + fixed seed = deterministic; training is one-time per dataset',
        'Flux + LoRA + fixed seed = deterministic; prompt constraints lock output',
        'SDXL seeded diffusion repeatable; but multi-ControlNet weight balancing tricky',
        'Temporal module adds variance; limited context batch; Motion Module stochastic',
        'Web SaaS; model updates break consistency; no seed control exposed',
        'Dual-pass workflow repeatable with fixed seeds; face inpaint adds variance',
        'Automated pipeline deterministic once LoRA trained; IP dataset gen varies',
        'LoRA training deterministic; but requires manual curation per iteration',
        'PuLID embeddings deterministic; face detection automated; pose mirrors reference'
    ],
    
    'Batchability / Automation (1-5)': [5, 5, 3, 3, 4, 5, 3, 1, 5, 5, 3, 5],
    'Automation Notes': [
        'ComfyUI API + Python; headless execution; batch queue; parallel GPU instances',
        'No training step = high throughput; batch 100s characters sequentially',
        'Blender Python batch render; Mixamo manual; TexturePacker scriptable',
        'Inference scriptable; training requires manual curation; 40GB VRAM bottleneck',
        'ComfyUI API; Flux Schnell fast inference; LoRA training per-character overhead',
        'ComfyUI API widely documented; Diffusers library; batch-friendly workflows',
        'Complex VRAM management (24GB for 16 frames); 16-32 frame limit per batch',
        'Web UI only; no API; subscription model; manual one-by-one usage',
        'ComfyUI dual-pass workflow scriptable; automated face detection',
        'Automated IP→LoRA pipeline; one-time training per character; batch inference',
        'Multiple LoRA training cycles; manual cropping; labor-intensive',
        'ComfyUI nodes; scriptable; face detection automated; batch processing supported'
    ],
    
    'Cost / Throughput (1-5)': [4, 5, 4, 2, 3, 4, 2, 2, 5, 4, 3, 4],
    'Cost Notes': [
        'LoRA training 2-60min/character (RTX 4090); inference fast; scales linearly',
        'Minimal overhead (image encoder pass); no training; high throughput',
        'Mixamo free; Blender free; TripoAI usage costs; GPU for stylization',
        'L40S/A100 40GB rental $2-3/hr; 10hr training per character; expensive',
        'Flux slower than SD1.5; requires RTX 4090+; 40GB VRAM for training',
        'SDXL 2x slower than SD1.5; heavier VRAM; but fewer steps compensate',
        'AnimateDiff 24GB VRAM for 16 frames; not suited for high-volume batches',
        'Subscription $20-50/month; generation credits; not scalable for 100s frames',
        'No training cost; two-pass adds 40-60% time; still fast on RTX 3090',
        'LoRA training one-time per character; inference fast; best ROI',
        'Multiple training cycles = cumulative GPU time; manual labor cost',
        'PuLID slower than standard SD; face embeddings add overhead; still viable'
    ],
    
    'Phaser Export Compatibility (1-5)': [5, 5, 5, 4, 5, 5, 3, 4, 5, 5, 5, 5],
    'Export Notes': [
        'Assembler agent handles pivot/JSON; Aseprite CLI/TexturePacker integration',
        'Standard PNG+JSON output; DWPose provides ankle pivot data; rembg for alpha',
        'Blender orthographic render = consistent baseline; TexturePacker for atlas',
        'Post-process to Aseprite/TexturePacker; DWPose pivot data extractable',
        'Flux PNG output; post-process to sprite sheet; standard tools compatible',
        'Standard diffusion output; Aseprite/TexturePacker integration straightforward',
        'Video output requires frame extraction; manual pivot alignment tricky',
        'Downloadable sprite sheet PNG+JSON; Phaser-compatible claimed; manual verify',
        'Standard PNG output; Assembler agent workflow applies; pivot from DWPose',
        'Assembler agent in agentic pipeline; automated Phaser JSON generation',
        'Standard PNG output; Aseprite CLI scripted export; manual alignment if varied sizes',
        'Standard PNG output; DWPose pivot extraction; Aseprite/TexturePacker compatible'
    ],
    
    'Failure Mode Severity (1-5)': [2, 3, 2, 4, 2, 4, 4, 3, 3, 2, 3, 3],
    'Failure Notes': [
        'LoRA overfitting on small data; pose skeleton errors; audit loop catches early',
        'Fine details drift (accessories); ControlNet-IP conflict on face; rejectable',
        '3D conversion loses 2D nuances; stylization artifacts; iteratable',
        'Stage 2 overfitting loses props/details; catastrophic if undetected; manual review',
        'Over-constraining makes rigid; Flux slower = long feedback loop',
        'Identity drift catastrophic without LoRA; high rejection rate in audit',
        'Context limit causes jumps; VRAM limits halt generation; memory errors',
        'Black-box failures undebuggable; loops not perfect; subscription lock-in',
        'Face/body seam if divergent; rejectable with SSIM/LPIPS audit',
        'Dataset quality determines LoRA quality; IP failures propagate; curation critical',
        'Second-gen images amplify flaws if not curated; cumulative drift risk',
        'Mirrors reference pose = less dynamic; extreme angles fail; rejectable'
    ],
    
    'Effort to Productionize (1-5)': [3, 2, 4, 5, 3, 2, 4, 1, 2, 3, 4, 3],
    'Productionize Notes': [
        'Moderate: LoRA training setup + ComfyUI API + audit gates; proven workflow',
        'Low: ComfyUI + IP-Adapter install; no training; batch scripts straightforward',
        'High: Blender Python expertise; TripoAI integration; Mixamo manual export',
        'Very High: ML engineering; 2-stage fine-tuning; L40S GPU access; data curation',
        'Moderate: Flux setup + 40GB VRAM; LoRA training per-character; constraint prompts',
        'Low: ComfyUI setup; widely documented; large community; easy prototyping',
        'High: VRAM management; AnimateDiff config; temporal consistency tuning',
        'Very Low: Sign up + subscribe; web UI; no setup; but no control',
        'Low: ComfyUI dual-pass workflow; face detection setup; standard nodes',
        'Moderate: Automate IP→LoRA pipeline; one-time per character; proven hybrid',
        'High: Multiple training cycles; manual cropping; dataset curation labor-intensive',
        'Moderate: PuLID/ACE nodes setup; face detection; ControlNet integration'
    ]
}

df_scoring = pd.DataFrame(scoring_data)

# Calculate average scores for ranking
score_cols = [
    'Anchor Identity Fidelity (1-5)', 
    'Pose Control / Frame Coherence (1-5)',
    'Style / Pixel Stability (1-5)',
    'Determinism / Reproducibility (1-5)',
    'Batchability / Automation (1-5)',
    'Cost / Throughput (1-5)',
    'Phaser Export Compatibility (1-5)'
]

df_scoring['Avg Score (excl. Failure/Effort)'] = df_scoring[score_cols].mean(axis=1).round(2)

# Save to CSV
df_scoring.to_csv('decision_matrix_scoring.csv', index=False)
print("Decision Matrix Scoring created")
print(f"Shape: {df_scoring.shape}")
print(f"\nColumns: {list(df_scoring.columns)}")
print("\nTop 3 pipelines by average score:")
print(df_scoring[['Pipeline', 'Avg Score (excl. Failure/Effort)']].sort_values('Avg Score (excl. Failure/Effort)', ascending=False).head(3).to_string(index=False))
