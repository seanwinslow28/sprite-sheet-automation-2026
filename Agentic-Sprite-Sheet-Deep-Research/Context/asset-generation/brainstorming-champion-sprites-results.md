# Brainstorming Session Results: Champion Sprites

**Session Date:** 2026-01-07
**Facilitator:** BMad Master
**Participant:** Sean

## Executive Summary

**Topic:** Full-color 16-bit arcade fighter style sprites for 6 champions (Sean MMA, Mary Kickboxing, Marcus Boxing, Aria Capoeira, Kenji Aikido, Zara Powerlifting)

**Session Goals:** Generate AI image generation prompts for Nano Banana Pro and ChatGPT that will create consistent, high-quality 128x128 pixel sprites with 15 animation states each.

**Techniques Used:** Role Playing, Morphological Analysis, SCAMPER Method

**Total Ideas Generated:** 47+

### Key Themes Identified:

1. **Character Authenticity** - Each champion's fighting style dictates their visual vocabulary
2. **Consistency Through Reference** - Generate idle poses first, use as references for all subsequent animations
3. **Technical Precision** - Strict pixel art rules (no gradients, no AA, no blur)
4. **Personality Expression** - Visual personality should be evident even in static frames

---

## Technique Sessions

### Technique 1: Role Playing - Champion Embodiment

**Purpose:** Think from each champion's perspective to discover authentic visual cues.

#### Champion Personality Profiles

| Champion | Core Trait | Idle Energy | Victory Style | Signature Move | Expression Default |
|----------|------------|-------------|---------------|----------------|-------------------|
| Sean | Adaptable | Grounded alert | Respectful fist pump | Takedown combo | Focused |
| Mary | Confident | Bouncy footwork | Hand on hip | Spinning heel kick | Confident smirk |
| Marcus | Disciplined | Tight peek-a-boo | Gold gloves raised | Devastating uppercut | Calm professional |
| Aria | Graceful | Rhythmic ginga | Cartwheel pose | Au batido kick | Serene playful |
| Kenji | Patient | Centered stillness | Zen bow | Circular throw | Meditative calm |
| Zara | Powerful | Wide dominant | Muscle flex | Shoulder charge | Fierce |

#### Detailed Character Notes

**Sean (MMA Fighter)**
- "I train all disciplines - I'm adaptable, not flashy"
- Orthodox stance, hands protecting chin
- Respectful winner, not arrogant
- Colors: Skin #F5D6C6, Hair #C2A769, Eyes #4682B4, Tank #F2F0EF, Pants #2323FF

**Mary (Kickboxing)**
- "My kicks are my signature - high, fast, devastating"
- Thai stance, rear hand high, bouncing footwork
- Confident hand-on-hip victory pose
- Colors: Skin #F5D6C6, Hair #6D4C41, Eyes #654321, Top #FF7BAC, Shorts #7E57C2

**Marcus (Boxing)**
- "Boxing is the sweet science - economy of motion"
- Peek-a-boo stance, gold gloves prominent
- Stoic victory, raises both gloves overhead
- Colors: Skin #8D5524, Hair #212121, Eyes #4A4A4A, Tank #545454, Gloves #FFD700

**Aria (Capoeira)**
- "Fighting is art, movement is expression"
- Ginga stance (rhythmic side-to-side sway)
- Graceful cartwheel into triumphant pose
- Colors: Skin #C68642, Hair #4B3621, Eyes #06402B, Top #9A2257, Pants #5577AA

**Kenji (Aikido/Tai Chi)**
- "I do not attack - I respond. Their aggression defeats them."
- Centered stance, hands open, palms ready
- Serene bow with hands pressed together
- Colors: Skin #FFDBAC, Hair #212121, Eyes #4A4A4A, Top #B0BEC5, Pants #424242

**Zara (Power Lifter)**
- "I lift cars. I don't need fancy techniques."
- Wide stable stance, arms crossed showing muscle
- Flexing bicep pose, triumphant roar
- Colors: Skin #CBB59D, Hair #3B2F2F, Eyes #654321, Tank #545454, Pants #212121

---

### Technique 2: Morphological Analysis - Parameter Matrix

**Purpose:** Systematically map all parameters needed for 90 sprite combinations.

#### Animation States (15 total)

1. Idle (4 frames)
2. Walk Forward (4 frames)
3. Walk Backward (4 frames)
4. Crouch (4 frames)
5. Jump (4 frames)
6. Light Punch (6 frames)
7. Medium Punch (8 frames)
8. Heavy Punch (8 frames)
9. Light Kick (6 frames)
10. Heavy Kick (8 frames)
11. Special Move (12 frames)
12. Block (6 frames)
13. Take Hit (6 frames)
14. Victory Pose (8 frames)
15. Continue Training Pose (8 frames)

#### Style-Specific Animation Variations

| Champion | Walk Style | Jump Style | Block Style | Hit Reaction |
|----------|------------|------------|-------------|--------------|
| Sean | Athletic shuffle | Straight vertical | High guard forearms | Stagger back |
| Mary | Bouncy Thai | Knee-up jump | Thai check position | Spin stagger |
| Marcus | Boxing bounce | Tight tuck | Tight shell guard | Roll with punch |
| Aria | Ginga sway | Acrobatic flip | Dodge-weave | Tumble roll |
| Kenji | Gliding step | Controlled hop | Open palm redirect | Centered absorb |
| Zara | Heavy stomp | Power leap | Shoulder brace | Barely moves |

#### Technical Constants

- Canvas: 128×128 pixels
- Character height: 100-110 pixels
- Outline color: #272929 (bold dark)
- Shading: 3-4 tones per color
- Light source: Upper-front, slight left
- Background: Transparent or white (#FFFFFF)

---

### Technique 3: SCAMPER - Prompt Enhancement

**Purpose:** Refine base prompts into production-ready specifications.

#### SCAMPER Insights Applied

| Letter | Question | Insight | Application |
|--------|----------|---------|-------------|
| S | Substitute viewing angle? | Some moves benefit from 3/4 view | Add "slight 3/4 angle" to special move prompts |
| C | Combine with effects? | Impact effects enhance action frames | Add "motion blur lines on striking limb" |
| A | Adapt from other games? | SF uses "squash and stretch" | Add "slight exaggeration at impact peak" |
| M | Modify for emphasis? | Magnify personality in idle/victory | "expressive pose showing character personality" |
| P | Put to other uses? | Sprites used in character select | "ensure idle frames work as standalone portraits" |
| E | Eliminate distractions? | Remove unnecessary details | "Clean silhouette readable at 50% scale" |
| R | Reverse typical approach? | Describe what NOT to do | Add "NO gradients, NO anti-aliasing, NO blur" |

---

## Production Prompts

### Master Prompt Template

```
16-bit pixel art fighting game sprite of [CHARACTER_NAME], a [FIGHTING_STYLE] fighter.

POSE: [ANIMATION_STATE] - [SPECIFIC_FRAME_DESCRIPTION]

SPECIFICATIONS:
- Canvas: 128×128 pixels
- Character height: 100-110 pixels
- Style: Street Fighter II / Capcom arcade aesthetic
- Proportions: Realistic martial artist (NOT chibi)
- Outlines: Bold #272929 dark outlines, 2-3 pixel width
- Shading: 3-4 tones per color, solid pixel clusters
- Light source: Upper-front, slight left
- Background: Transparent or solid white (#FFFFFF)

CHARACTER PALETTE:
[SKIN_HEX] - Skin tones
[HAIR_HEX] - Hair
[EYES_HEX] - Eyes
[OUTFIT_PRIMARY_HEX] - Main outfit
[OUTFIT_SECONDARY_HEX] - Secondary outfit elements

PERSONALITY: [PERSONALITY_NOTE]

TECHNICAL REQUIREMENTS:
- NO gradients
- NO anti-aliasing
- NO blur effects
- NO glow effects
- Clean silhouette readable at 50% scale
- Frame suitable for 2D game engine sprite sheet
```

### Example Prompts

#### Sean - Idle Animation
```
16-bit pixel art fighting game sprite of Sean, an MMA fighter.

POSE: Idle stance - Orthodox fighting position, weight evenly distributed,
hands raised protecting chin, knees slightly bent, eyes forward and alert.
Subtle breathing animation implied through slight shoulder position.

SPECIFICATIONS:
- Canvas: 128×128 pixels
- Character height: 105 pixels
- Style: Street Fighter II / Capcom arcade aesthetic
- Proportions: Athletic male martial artist
- Outlines: Bold #272929 dark outlines
- Shading: 3-4 tones per color, solid pixel clusters
- Light source: Upper-front

CHARACTER PALETTE:
#F5D6C6 - Skin (with #E8C4B0 shadow, #FFE4D6 highlight)
#C2A769 - Short cropped hair
#4682B4 - Steel blue eyes
#F2F0EF - White sleeveless compression tank
#2323FF - Blue MMA shorts with subtle side stripe

PERSONALITY: Focused intensity, adaptable "everyman" energy,
respectful but ready. Not flashy, not arrogant.

TECHNICAL: NO gradients, NO anti-aliasing, Clean silhouette.
```

#### Mary - Heavy Kick Animation
```
16-bit pixel art fighting game sprite of Mary, a Muay Thai kickboxer.

POSE: Heavy Kick - Peak impact frame of spinning roundhouse kick.
Rear leg extended at head height, supporting leg pivoted, arms
counterbalancing, ponytail swinging with momentum. Motion lines
on kicking leg to emphasize speed and power.

SPECIFICATIONS:
- Canvas: 128×128 pixels
- Character height: 108 pixels (extended with kick)
- Style: Street Fighter II / Capcom arcade aesthetic
- Proportions: Athletic female fighter, long legs
- Outlines: Bold #272929 dark outlines
- Shading: 3-4 tones per color
- Light source: Upper-front

CHARACTER PALETTE:
#F5D6C6 - Skin
#6D4C41 - Brown hair in high ponytail
#654321 - Brown eyes with confident intensity
#FF7BAC - Pink sports bra top
#7E57C2 - Purple Muay Thai shorts

PERSONALITY: Confident and powerful. This kick says "I've worked
for this." Slight smirk visible on face.

TECHNICAL: Add 3-4 pixel motion lines behind kicking leg.
Impact star at foot position. NO gradients, NO anti-aliasing.
```

#### Aria - Special Move (Au Batido)
```
16-bit pixel art fighting game sprite of Aria, a Capoeira dancer-fighter.

POSE: Special Move (Au Batido) - Mid-cartwheel kick frame.
Hands on ground, body inverted, one leg sweeping through air
in devastating arc. Flowing pants creating dynamic fabric movement.
Graceful yet powerful attack. Slight 3/4 angle for depth.

SPECIFICATIONS:
- Canvas: 128×128 pixels
- Character height: 110 pixels (full extension)
- Style: Street Fighter II / Capcom arcade aesthetic
- Proportions: Graceful female acrobat
- Outlines: Bold #272929 dark outlines
- Shading: 3-4 tones per color
- Light source: Upper-front

CHARACTER PALETTE:
#C68642 - Warm brown skin
#4B3621 - Dark braided hair, beads visible
#06402B - Deep green eyes, serene expression
#9A2257 - Burgundy crop top
#5577AA - Flowing blue pants (showing movement)

PERSONALITY: Graceful power, dance and combat united.
Expression is serene even in attack - she's in the flow.

TECHNICAL: Add fabric flow lines on pants. Slight arc motion trail.
NO gradients. 3/4 viewing angle for acrobatic depth.
```

---

## Idea Categorization

### Immediate Opportunities

_Ideas ready to implement now_

1. **Generate all 6 idle sprites first** - Establishes reference for consistency
2. **Use idle as input reference** for all subsequent animations
3. **Batch similar animations** - Generate all idle, then all victory, then all special moves
4. **Create master color palette file** - Extract exact hex codes for each champion

### Future Innovations

_Ideas requiring development/research_

1. **Sprite sheet automation** - Script to arrange generated frames into proper sheet format
2. **Color consistency checker** - Tool to verify generated sprites match palette exactly
3. **Animation preview tool** - Quickly cycle through frames to check flow
4. **Style transfer refinement** - If consistency issues, explore ControlNet or IP-Adapter

### Moonshots

_Ambitious, transformative concepts_

1. **AI animation interpolation** - Generate key frames, AI fills in-betweens
2. **Dynamic pose generation** - Input skeleton, AI generates clothed sprite
3. **Real-time style consistency** - Train LoRA on first champion, apply to others

---

## Action Planning

### Top 3 Priority Ideas

#### #1 Priority: Generate All 6 Champion Idle Sprites

- **Rationale:** Idle sprites serve as the reference foundation for all other animations. Consistency must be established here first.
- **Next steps:**
  1. Use Sean prompt template to generate Sean idle
  2. Refine until satisfactory
  3. Repeat for Mary, Marcus, Aria, Kenji, Zara
  4. Establish "approved reference" folder
- **Resources needed:** Nano Banana Pro or ChatGPT-4o access, image review time
- **Timeline:** First action item

#### #2 Priority: Create Complete Prompt Library

- **Rationale:** 90 unique sprite prompts (6 characters × 15 states) need documentation for consistent generation across sessions.
- **Next steps:**
  1. Use master template to generate all 90 prompts
  2. Organize by character, then by animation state
  3. Add fighting-style-specific notes from morphological analysis
- **Resources needed:** Template from this session, fighting style variations table
- **Timeline:** After idle sprites approved

#### #3 Priority: Establish Quality Gate Checklist

- **Rationale:** Every generated sprite must pass validation before acceptance.
- **Next steps:**
  1. Create checklist: palette adherence, silhouette clarity, personality expression
  2. Document pass/fail criteria
  3. Create feedback loop for AI prompt refinement
- **Resources needed:** Sample sprites to test against
- **Timeline:** Before bulk generation

---

## Reflection and Follow-up

### What Worked Well

- Role Playing technique effectively surfaced personality distinctions between champions
- Morphological Analysis created comprehensive framework for 90 sprite combinations
- SCAMPER enhanced base prompts with practical improvements (motion lines, negative prompts)

### Areas for Further Exploration

- Animation frame timing/spacing (how many frames between key poses?)
- Sprite sheet arrangement standards (rows vs columns, padding)
- Hit box alignment with sprite frames

### Recommended Follow-up Techniques

- **First Principles Thinking** - For Boss characters (different scale, different personality archetypes)
- **Analogical Thinking** - Study actual SF2 sprite sheets for technical reference
- **Time Shifting** - How would these characters look at different "evolution stages"?

### Questions That Emerged

1. Should special moves have more than 12 frames for dramatic impact?
2. How do we handle fabric physics (Aria's pants, Kenji's gi) across frames?
3. What's the exact arrangement of the sprite sheet (animation per row or per column)?
4. Do we need separate "shadow" sprites for floor projection?

---

## Next Session Planning

- **Suggested topics:** Boss Characters (6 bosses × 9 animation states), Battle Backgrounds (5 stages × 4 parallax layers)
- **Recommended timeframe:** Immediately following champion sprite approval
- **Preparation needed:** Review Boss character descriptions, gather Street Fighter background references

---

_Session facilitated using the BMAD brainstorming framework_
_Total session duration: ~50 minutes_
