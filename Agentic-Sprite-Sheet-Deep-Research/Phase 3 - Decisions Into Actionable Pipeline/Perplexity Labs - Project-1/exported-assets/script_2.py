
import pandas as pd

# Create Commercial/Black-box tools appendix
commercial_data = {
    'Tool/Service': [
        'Leonardo.ai',
        'Midjourney',
        'Ludo.ai Pose Editor',
        'Scenario.gg',
        'PixelVibe / PixelLab',
        'Adobe Firefly',
        'Replicate / Stability API',
        'AnimeFusion / Animyth'
    ],
    
    'Image-to-Image Anchor': [
        'Yes (Character Reference feature)',
        'No (--cref is loose inspiration only)',
        'Yes (First Frame acts as anchor)',
        'Yes (via model training, LoRA-like)',
        'Maybe (PixelLab mentions ref upload)',
        'No (generative fill, no user model)',
        'Yes (if ControlNet model available)',
        'No (template-based, not anchor-locked)'
    ],
    
    'Automation Hooks': [
        'Yes (API, batch generation)',
        'No (Discord bot, unofficial workarounds)',
        'No (web UI only, no public API)',
        'Yes (API for generation)',
        'No (web UI, no API documented)',
        'Yes (API exists)',
        'Yes (API by design)',
        'No (GPT-4 prompt + manual templates)'
    ],
    
    'Reproducibility': [
        'Moderate (seeds, custom models; service updates)',
        'Low (variance even with seed; version updates)',
        'Moderate (AI-based, guided pipeline)',
        'High (seeded, custom model)',
        'Low (unknown model versioning)',
        'Low (no fine control, content restrictions)',
        'High (seeded diffusion, user models)',
        'Low (GPT-4 API variance, template quality)'
    ],
    
    'Pose Control': [
        'Medium (upload pose image or prompt)',
        'Low (text-based pose prompts)',
        'High (presets + custom pose input)',
        'Low (prompt-based, no ControlNet)',
        'Unknown (likely prompt-based)',
        'Low (text-based)',
        'Yes (if ControlNet models exposed)',
        'High (OpenPose template mapping)'
    ],
    
    'Scriptable for 100+ Frames': [
        'Partial (API, but cost scales)',
        'No (manual Discord usage)',
        'No (one-by-one web UI)',
        'No (static asset focus)',
        'No (web UI)',
        'No (SaaS limits)',
        'Yes (API, cost per image)',
        'No (manual template selection)'
    ],
    
    'Viability Assessment': [
        'Viable with caveats',
        'Not viable',
        'Not viable',
        'Not viable (no pose control)',
        'Not viable (no API evidence)',
        'Not viable',
        'Viable (alternative deployment)',
        'Not viable (not autonomous)'
    ],
    
    'Key Issues': [
        'Cost per image; service updates can break consistency; lacks ControlNet UI',
        'No anchor control; no API; no repeatability; Discord workflow not scalable',
        'No API; black-box; subscription lock-in; loops not guaranteed',
        'No pose control in UI; static asset generation focus; not sprite workflow',
        'No API; no proven anchor consistency; one-off asset creation focus',
        'Content restrictions; no character lock; no pixel art orientation',
        'Cost scales with usage; same models as local (just hosted); economically viable?',
        'GPT-4 API costs; template reliance; anime-style bias; not autonomous'
    ],
    
    'Use Case (if any)': [
        'Rapid prototyping; cloud inference if no GPU; character concept art',
        'Concept art inspiration; marketing visuals; not production sprites',
        'Solo dev rapid prototyping; non-critical sprite sheets; quick demos',
        'Character concept generation; static key frames; branding assets',
        'Quick asset generation; non-game applications; exploration',
        'Marketing content; generative fill for existing assets; not sprite generation',
        'No local GPU alternative; same pipeline as local; cost vs ownership tradeoff',
        'Educational demo; rapid multi-character prototyping with LLM reasoning'
    ]
}

df_commercial = pd.DataFrame(commercial_data)
df_commercial.to_csv('commercial_tools_appendix.csv', index=False)

print("Commercial/Black-box Tools Appendix created")
print(f"Shape: {df_commercial.shape}")
print(f"\nViability breakdown:")
print(df_commercial['Viability Assessment'].value_counts().to_string())
print("\nNon-viable tools:")
print(df_commercial[df_commercial['Viability Assessment'].str.contains('Not viable')]['Tool/Service'].to_list())
