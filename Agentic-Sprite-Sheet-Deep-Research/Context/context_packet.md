\# 16BitFit Battle Mode Sprite Sheet Research Context Packet (v1)

\#\# Project  
16BitFit — Phaser 3 fighting game in a WebView. Goal: generate game-ready sprite sheets that match existing anchor sprites exactly.

\#\# Style (non-negotiable)  
\- Full-color 2D fighting game aesthetic (SF2/Capcom arcade fighter feel)  
\- Landscape battle mode  
\- Crisp sprite readability; consistent pixel density; no style drift

\#\# Characters  
We have 6 cosmetic-only champions: Sean, Mary, Marcus, Aria, Kenji, Zara.  
Each has defined skin tone \+ hair \+ outfit colors. (I will provide the spec doc.)

\#\# Inputs I already have  
\- Anchor sprites: 1–N base images per character that represent the “locked” look.  
\- These anchors already look correct in-game.

\#\# Output requirements  
\- Transparent background in final frames  
\- Frame size must match anchor sprite dimensions exactly  
\- Consistent baseline/pivot across frames  
\- Sprite sheet export: PNG \+ JSON (Phaser-friendly)  
\- Padding between frames: 4px (unless tool recommends otherwise)

\#\# Animations to generate (MVP set)  
Ask you to recommend a Street Fighter–like minimal set \+ typical frame counts for: idle, walk fwd/back, jump, block, LP/MP/HP, LK/MK/HK, hurt, KO, victory.  
If you propose counts, justify them.

\#\# Key problem to solve  
We need an autonomous workflow that:  
1\) Generates new frames from anchors (pose edits, not redesigns)  
2\) Automatically audits for identity \+ style drift (PASS/REJECT)  
3\) Iterates until PASS  
4\) Packs sheets \+ exports metadata

\#\# What I want from you  
\- Find how other devs do AI-assisted sprite/sprite-sheet generation and consistency control  
\- Recommend image models/services and why  
\- Provide an implementation-ready workflow with audit gates  
\- Cite sources and include links  
