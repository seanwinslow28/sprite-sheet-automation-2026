/**
 * Tests for guide command
 * Per Story 6.6: Operator guide documentation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import {
    loadGuide,
    extractSection,
    getSectionNames,
    formatMarkdownForTerminal,
    getGuidePath,
} from '../../src/commands/guide.js';

describe('Guide Command', () => {
    describe('loadGuide', () => {
        it('should load the operator guide', async () => {
            const content = await loadGuide();
            expect(content).toContain('# Sprite Pipeline Operator Guide');
        });

        it('should contain Table of Contents', async () => {
            const content = await loadGuide();
            expect(content).toContain('## Table of Contents');
        });

        it('should contain all main sections', async () => {
            const content = await loadGuide();
            expect(content).toContain('## 1. Quick Start');
            expect(content).toContain('## 2. Understanding Quality Gates');
            expect(content).toContain('## 3. The Retry Ladder');
            expect(content).toContain('## 4. Common Failure Patterns');
            expect(content).toContain('## 5. Manifest Configuration Reference');
            expect(content).toContain('## 6. Troubleshooting FAQ');
            expect(content).toContain('## 7. Advanced Topics');
        });
    });

    describe('getSectionNames', () => {
        it('should extract all section names', async () => {
            const content = await loadGuide();
            const sections = getSectionNames(content);

            expect(sections).toContain('Quick Start');
            expect(sections).toContain('Understanding Quality Gates');
            expect(sections).toContain('The Retry Ladder');
            expect(sections).toContain('Common Failure Patterns');
            expect(sections).toContain('Manifest Configuration Reference');
            expect(sections).toContain('Troubleshooting FAQ');
            expect(sections).toContain('Advanced Topics');
        });

        it('should return sections in order', async () => {
            const content = await loadGuide();
            const sections = getSectionNames(content);

            expect(sections[0]).toBe('Quick Start');
            expect(sections[1]).toBe('Understanding Quality Gates');
        });
    });

    describe('extractSection', () => {
        it('should extract Quick Start section', async () => {
            const content = await loadGuide();
            const section = extractSection(content, 'Quick Start');

            expect(section).not.toBeNull();
            expect(section).toContain('## 1. Quick Start');
            expect(section).toContain('Prerequisites');
            expect(section).toContain('Installation');
        });

        it('should extract Understanding Quality Gates section', async () => {
            const content = await loadGuide();
            const section = extractSection(content, 'Understanding Quality Gates');

            expect(section).not.toBeNull();
            expect(section).toContain('Hard Failures (HFxx)');
            expect(section).toContain('Soft Failures (SFxx)');
        });

        it('should return null for non-existent section', async () => {
            const content = await loadGuide();
            const section = extractSection(content, 'Non Existent Section');

            expect(section).toBeNull();
        });

        it('should extract section with partial name match', async () => {
            const content = await loadGuide();
            // Using case-insensitive match
            const section = extractSection(content, 'Troubleshooting FAQ');

            expect(section).not.toBeNull();
            expect(section).toContain('My frames keep failing');
        });
    });

    describe('formatMarkdownForTerminal', () => {
        it('should preserve content', () => {
            const input = 'Simple text content';
            const output = formatMarkdownForTerminal(input);
            expect(output).toContain('Simple text content');
        });

        it('should handle code blocks', () => {
            const input = '```bash\nnpm install\n```';
            const output = formatMarkdownForTerminal(input);
            expect(output).toContain('npm install');
        });

        it('should handle inline code', () => {
            const input = 'Run `banana doctor` to check';
            const output = formatMarkdownForTerminal(input);
            // The output contains ANSI codes, so just verify structure
            expect(output).toContain('banana doctor');
        });

        it('should handle bold text', () => {
            const input = 'This is **bold** text';
            const output = formatMarkdownForTerminal(input);
            expect(output).toContain('bold');
        });

        it('should handle links', () => {
            const input = 'Visit [the docs](https://example.com)';
            const output = formatMarkdownForTerminal(input);
            expect(output).toContain('the docs');
        });
    });

    describe('getGuidePath', () => {
        it('should return a path', () => {
            const guidePath = getGuidePath();
            expect(guidePath).toContain('operator-guide.md');
        });

        it('should return path ending with docs/operator-guide.md', () => {
            const guidePath = getGuidePath();
            expect(guidePath).toMatch(/docs[/\\]operator-guide\.md$/);
        });
    });
});

describe('Operator Guide Content Verification', () => {
    let content: string;

    beforeEach(async () => {
        content = await loadGuide();
    });

    describe('Quality Gate Documentation', () => {
        it('should document all hard failure codes', () => {
            expect(content).toContain('HF01');
            expect(content).toContain('Dimension Mismatch');
            expect(content).toContain('HF02');
            expect(content).toContain('Fully Transparent');
            expect(content).toContain('HF03');
            expect(content).toContain('Image Corrupted');
            expect(content).toContain('HF04');
            expect(content).toContain('Wrong Color Depth');
            expect(content).toContain('HF05');
            expect(content).toContain('File Size');
        });

        it('should document all soft failure codes', () => {
            expect(content).toContain('SF01');
            expect(content).toContain('Identity Drift');
            expect(content).toContain('SF02');
            expect(content).toContain('Palette Drift');
            expect(content).toContain('SF03');
            expect(content).toContain('Alpha Halo');
            expect(content).toContain('SF04');
            expect(content).toContain('Baseline Drift');
            expect(content).toContain('SF05');
            expect(content).toContain('Pixel Noise');
        });

        it('should document dependency error codes', () => {
            expect(content).toContain('DEP_NODE_VERSION');
            expect(content).toContain('DEP_TEXTUREPACKER_NOT_FOUND');
            expect(content).toContain('DEP_CHROME_NOT_FOUND');
            expect(content).toContain('DEP_GEMINI_UNAVAILABLE');
        });
    });

    describe('Retry Ladder Documentation', () => {
        it('should document all retry levels', () => {
            // Check that all 8 levels are documented (either "Level X" or "| X |" table format)
            expect(content).toMatch(/Level 1|[|]\s*1\s*[|]/);
            expect(content).toContain('REROLL_SEED');
            expect(content).toMatch(/Level 2|[|]\s*2\s*[|]/);
            expect(content).toContain('TIGHTEN_NEGATIVE');
            expect(content).toMatch(/Level 3|[|]\s*3\s*[|]/);
            expect(content).toContain('IDENTITY_RESCUE');
            expect(content).toMatch(/Level 4|[|]\s*4\s*[|]/);
            expect(content).toContain('POSE_RESCUE');
            expect(content).toMatch(/Level 5|[|]\s*5\s*[|]/);
            expect(content).toContain('TWO_STAGE_INPAINT');
            expect(content).toMatch(/Level 6|[|]\s*6\s*[|]/);
            expect(content).toContain('POST_PROCESS');
            expect(content).toMatch(/Level 7|[|]\s*7\s*[|]/);
            expect(content).toContain('RE_ANCHOR');
            expect(content).toMatch(/Level 8|[|]\s*8\s*[|]/);
            expect(content).toContain('STOP');
        });

        it('should document HF_IDENTITY_COLLAPSE', () => {
            expect(content).toContain('HF_IDENTITY_COLLAPSE');
            expect(content).toContain('Identity Collapse');
        });

        it('should include retry ladder visualization', () => {
            expect(content).toContain('FRAME GENERATION');
            expect(content).toContain('AUDIT');
            expect(content).toContain('APPROVE');
            expect(content).toContain('RETRY LADDER');
        });
    });

    describe('Manifest Reference Documentation', () => {
        it('should document identity section', () => {
            expect(content).toContain('identity:');
            expect(content).toContain('character');
            expect(content).toContain('move');
            expect(content).toContain('frame_count');
            expect(content).toContain('is_loop');
        });

        it('should document inputs section', () => {
            expect(content).toContain('inputs:');
            expect(content).toContain('anchor');
            expect(content).toContain('style_refs');
            expect(content).toContain('pose_refs');
        });

        it('should document canvas section', () => {
            expect(content).toContain('canvas:');
            expect(content).toContain('generation_size');
            expect(content).toContain('target_size');
            expect(content).toContain('downsample_method');
            expect(content).toContain('alignment');
        });

        it('should document auditor section', () => {
            expect(content).toContain('auditor:');
            expect(content).toContain('hard_gates');
            expect(content).toContain('soft_metrics');
            expect(content).toContain('weights');
        });

        it('should document retry section', () => {
            expect(content).toContain('retry:');
            expect(content).toContain('ladder');
            expect(content).toContain('stop_conditions');
        });

        it('should document export section', () => {
            expect(content).toContain('export:');
            expect(content).toContain('atlas_format');
            expect(content).toContain('packer_flags');
        });
    });

    describe('Troubleshooting FAQ', () => {
        it('should have at least 10 FAQ entries', () => {
            const faqMatches = content.match(/### Q:/g);
            expect(faqMatches).not.toBeNull();
            expect(faqMatches!.length).toBeGreaterThanOrEqual(10);
        });

        it('should document identity check issues', () => {
            expect(content).toContain('frames keep failing identity check');
        });

        it('should document TexturePacker issues', () => {
            expect(content).toContain('TexturePacker');
            expect(content).toContain('license');
        });

        it('should document Phaser test issues', () => {
            expect(content).toContain('Phaser tests fail');
        });

        it('should document run resumption', () => {
            expect(content).toContain('resume');
            expect(content).toContain('stopped run');
        });
    });

    describe('Quick Start Section', () => {
        it('should include prerequisites', () => {
            expect(content).toContain('Prerequisites');
            expect(content).toContain('Node.js');
            expect(content).toContain('TexturePacker');
            expect(content).toContain('Chrome');
            expect(content).toContain('Gemini API Key');
        });

        it('should include installation steps', () => {
            expect(content).toContain('npm install');
            expect(content).toContain('npm run build');
        });

        it('should include environment setup', () => {
            expect(content).toContain('.env');
            expect(content).toContain('GEMINI_API_KEY');
        });

        it('should include doctor command', () => {
            expect(content).toContain('banana doctor');
        });

        it('should include first run instructions', () => {
            expect(content).toContain('banana demo');
            expect(content).toContain('banana run');
        });
    });

    describe('CLI Command Reference', () => {
        it('should document all main commands', () => {
            expect(content).toContain('banana doctor');
            expect(content).toContain('banana schema');
            expect(content).toContain('banana new-manifest');
            expect(content).toContain('banana run');
            expect(content).toContain('banana inspect');
            expect(content).toContain('banana validate');
            expect(content).toContain('banana promote');
            expect(content).toContain('banana clean');
            expect(content).toContain('banana guide');
        });
    });
});

describe('Operator Guide File Location', () => {
    it('should exist at docs/operator-guide.md', async () => {
        const guidePath = path.join(process.cwd(), 'docs/operator-guide.md');
        const exists = await fs.access(guidePath).then(() => true).catch(() => false);
        expect(exists).toBe(true);
    });
});
