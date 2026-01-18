
import pandas as pd
import io

# Create comprehensive Decision Matrix
matrix_data = {
    'Pipeline Name': [
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
    
    'Required Components': [
        'SD1.5/SDXL + Character LoRA + DWPose + ComfyUI',
        'SDXL + IP-Adapter Plus + DWPose + Rembg',
        'TripoAI + Blender + Mixamo + ControlNet (Depth/Line)',
        'Animate Anyone (2-stage fine-tune) + DWPose + L40S GPU',
        'Flux Dev + Pixel Art LoRA + DWPose + 40GB VRAM',
        'SDXL + IP-Adapter + DWPose + HED/Depth ControlNet',
        'AnimateDiff Module + ControlNet (OpenPose/HED) + LCM LoRA',
        'Ludo.ai subscription + web interface (no local setup)',
        'IP-Adapter Plus + DWPose + Face inpainting workflow',
        'IP-Adapter + DWPose (gen dataset) → LoRA training',
        'SDXL + Character Sheet prompt + LoRA training (2 rounds)',
        'PuLID/ACE face encoder + DWPose + ControlNet'
    ],
    
    'Best At': [
        'Anchor-locked fidelity, proven workflows, full control',
        'Zero-shot speed, no training, batch NPC generation',
        'Pose precision, deterministic output, 100+ animations',
        'Temporal coherence, research-grade quality, spatial detail',
        'High-res pixel art, instruction-following, constraint adherence',
        'Flexibility, widely documented, easy prototyping',
        'Smooth temporal transitions, walkrun cycles, video output',
        'Minutes-to-sheet, integrated sound, no ML knowledge',
        'Fast iteration, no LoRA, rapid prototyping',
        'Cold-start solution, best of both worlds (IP + LoRA)',
        'Flexible LoRAs, cross-style, iterative refinement',
        'Near-perfect face ID, better than IP-Adapter for faces'
    ],
    
    'Drift Risks': [
        'Low (LoRA locks identity); pose skeleton errors possible',
        'Medium (fine details fluctuate); CLIP embeddings spatial imprecision',
        'Low drift (3D guarantees pose); stylization can introduce artifacts',
        'Very Low (fine-tuned on anchors); Stage 2 overfitting → detail loss',
        'Low (LoRA + prompt constraints); over-constraining reduces flexibility',
        'Medium-High (no identity lock without LoRA); SDXL style richness conflicts pixel art',
        'Medium (temporal module helps); limited 16-32 frame context',
        'Medium (black-box model); loops not always perfect',
        'Medium (IP-Adapter ~90% consistency); face/body seam risk',
        'Low (LoRA trained on IP output); dataset quality critical',
        'Low (iterative LoRA refinement); labor-intensive curation',
        'Low-Medium (face excellent); mirrors reference pose too closely'
    ],
    
    'Automation Viability': [
        'Yes (ComfyUI API, Python, headless execution)',
        'Yes (ComfyUI API, no training step, batch-friendly)',
        'Partial (Blender Python scripting, Mixamo manual export)',
        'Partial (inference scriptable, training manual curation)',
        'Yes (ComfyUI API, but LoRA training per-character)',
        'Yes (ComfyUI API, Diffusers library, widely supported)',
        'Partial (complex VRAM management, 16-32 frame batches)',
        'No (web UI only, no public API, subscription)',
        'Yes (ComfyUI dual-pass workflow, scriptable)',
        'Yes (automated IP→LoRA pipeline, one-time per character)',
        'Partial (requires multiple training runs, manual cropping)',
        'Yes (ComfyUI nodes, scriptable, face detection automated)'
    ],
    
    'Evidence Links (Count)': [
        '8+ (ChatGPT, Perplexity, Gemini reports)',
        '6+ (Stable Diffusion Art, Hugging Face)',
        '5+ (Reddit r/aigamedev, YouTube tutorials)',
        '2+ (arXiv paper, ChatPaper analysis)',
        '3+ (LinkedIn, YouTube)',
        '5+ (ComfyUI docs, Stable Diffusion Art)',
        '4+ (AiTuts, Sandner.art, Reddit)',
        '2+ (Ludo.ai blog, user reports)',
        '4+ (Reddit, YouTube, Stable Diffusion Art)',
        '5+ (ChatGPT report, Perplexity synthesis)',
        '4+ (Everly Heights, Cobalt Explorer)',
        '5+ (YouTube, Reddit r/comfyui, MyAIForce)'
    ]
}

df_matrix = pd.DataFrame(matrix_data)

# Save to CSV
df_matrix.to_csv('pipeline_candidates.csv', index=False)
print("Pipeline Candidates Table created (12 rows)")
print(f"Shape: {df_matrix.shape}")
print("\nFirst 3 rows preview:")
print(df_matrix.head(3).to_string())
