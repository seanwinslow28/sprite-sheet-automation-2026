# Terminal Agents + BMAD Method Strategic Guide
## Research-Based Analysis for Sean's Coding Projects

---

## Executive Summary

After extensive research on Claude Code, Codex CLI, Gemini CLI, and Cursor, combined with understanding the BMAD Method workflow, here's your strategic playbook for future projects.

**Key Finding**: Each agent excels at different phases. Use them in combination rather than picking just one.

---

## 1. Terminal Agents: Capabilities Matrix

### Claude Code
**Philosophy**: Thoughtful, comprehensive, repo-level architect  
**Model**: Sonnet 4.5 (77.2% SWE-bench)

**Strengths**:
- Best-in-class reasoning and planning (Plan Mode)
- Excellent at multi-file refactoring and architecture decisions
- Superior context understanding (200K-1M tokens)
- Great for complex, ambiguous tasks requiring judgment
- Skills system for extensibility
- Strong safety and code review capabilities

**Weaknesses**:
- Can be slower for simple tasks (asks many clarifying questions)
- More expensive ($200/month max plan)
- Requires separate subscription (not included with other services)
- Can be overly verbose

**Best For**: Architecture, complex refactoring, code review, comprehensive planning

---

### Codex CLI
**Philosophy**: Long-horizon executor, hands-off automation  
**Model**: GPT-5.2-Codex (76.2% SWE-bench Verified)

**Strengths**:
- Exceptional at long-running, autonomous tasks (20+ minutes)
- Best for complete feature implementations from spec
- Strong cybersecurity capabilities (vulnerability research)
- Integrated with ChatGPT ecosystem
- Cloud + CLI + IDE workflow continuity
- Open source (Rust-based, fast)
- Task automation and scripting support

**Weaknesses**:
- Less interactive (fewer checkpoints during execution)
- Can drift on very long sessions without good specs
- Requires ChatGPT Plus/Pro/Business ($20-60/month)

**Best For**: Feature builds, long coding sessions, security work, task automation

---

### Gemini CLI
**Philosophy**: Fast executor with massive context  
**Model**: Gemini 2.5 Pro/Gemini 3 Pro (76.2% SWE-bench)

**Strengths**:
- Largest context window (1M tokens)
- FREE tier with generous limits (best for learning/experimentation)
- Fastest execution for straightforward tasks
- Strong multimodal capabilities (PDFs, images, video, audio)
- Excellent Google Cloud integration
- Web search grounding for current best practices
- Pre-installed in Google Cloud Shell

**Weaknesses**:
- Less polished/refined outputs (needs iteration)
- Weaker at complex business logic
- Agent mode still maturing
- Better for speed than precision

**Best For**: Large codebases, quick prototypes, multimodal tasks, budget-conscious work

---

### Cursor
**Philosophy**: Real-time IDE collaborator  
**Model**: Multiple (Claude 3.5 Sonnet, GPT-4, etc.)

**Strengths**:
- Best real-time coding experience (VS Code fork)
- Excellent for UI/frontend work
- Multi-model flexibility (switch between Claude, GPT, etc.)
- Project-wide context awareness
- Fast iteration cycles
- Great for pair-programming workflow
- Auto-fix errors, code preview before applying

**Weaknesses**:
- Not a CLI tool (IDE-based)
- Can produce over-engineered solutions
- UI clutter, shortcut conflicts
- Performance issues with very large projects
- Inconsistent AI quality
- $20/month (features behind paywall)

**Best For**: Active coding sessions, UI work, rapid prototyping, frontend development

---

## 2. BMAD Method Overview

The BMAD Method is an **agile AI-driven development framework** with specialized AI agents (PM, Architect, Developer, UX, Scrum Master, QA, etc.) organized into workflows:

**Core Workflow Phases**:
1. **Ideation & Planning** (Web-based: Orchestrator, Analyst, PM)
2. **Architecture & Design** (Web-based: Architect, UX Designer)
3. **Documentation** (Creating PRD, Architecture docs, Briefs)
4. **Implementation** (IDE-based: Scrum Master, Developer, QA in story workflow)
5. **Testing & Review** (QA agent, code review)
6. **Deployment** (DevOps workflows)

**Key BMAD Agents**:
- **bmad-orchestrator**: Meta-agent coordinating all others
- **analyst**: Gathers requirements, analyzes problems
- **pm**: Creates Product Requirements Document (PRD)
- **architect**: Technical architecture and system design
- **sm** (Scrum Master): Creates/manages story files
- **dev**: Implements code based on stories
- **qa**: Reviews code, runs tests
- **quick-dev**: Streamlined workflow for small features

**BMAD Tracks**:
- **Full Method**: Complete PRD → Architecture → Sprint-based dev (greenfield)
- **Quick Flow**: Tech spec → Implementation → Review (small features)
- **Solo Dev**: Single developer rapid iteration

---

## 3. Strategic Agent-to-Phase Mapping

### Phase 1: Ideation & Requirements Gathering
**Use**: Web-based chat interfaces (Claude.ai, ChatGPT, Gemini)  
**BMAD Agents**: bmad-orchestrator, analyst, pm

**Why Not Terminal**: This phase is conversational and exploratory. Web interfaces with memory and artifacts work better.

**Recommendation**:
- Use Claude.ai web for deep reasoning and PRD creation
- Use ChatGPT web for quick brainstorming
- Generate initial PRD artifact in web interface

---

### Phase 2: Architecture & Technical Design
**Primary**: **Claude Code** (60%) + **Gemini CLI** (40%)  
**BMAD Agents**: architect, ux-designer

**Why**:
- Claude Code excels at architectural thinking and complex decision-making
- Gemini CLI can quickly search massive codebases and provide current best practices via web search
- Both have strong multimodal support for reviewing design diagrams

**Workflow**:
```bash
# Step 1: Use Claude Code for architecture planning
claude 
# Load BMAD architect agent
@architect "Design the system architecture for [project]"
# Review and iterate on architecture decisions

# Step 2: Use Gemini CLI for validation against current standards
gemini chat
> "Review this architecture for [framework] best practices in 2025"
> [paste architecture]
```

**Reason**: Claude's thoughtful approach catches edge cases; Gemini validates against current practices.

---

### Phase 3: Setup & Scaffolding
**Primary**: **Cursor** (70%) + **Codex CLI** (30%)  
**BMAD Agents**: dev (initial setup)

**Why**:
- Cursor is fastest for generating initial project structure, boilerplate, config files
- Real-time IDE feedback makes debugging setup issues easier
- Codex CLI handles automated scripts and complex initialization

**Workflow**:
```
# In Cursor IDE:
Cmd+K: "Set up a Next.js 14 project with TypeScript, Tailwind, and Shadcn/UI"
# Review file structure
Cmd+L: "Configure ESLint and Prettier according to our .cursorrules"

# For complex initialization:
# Switch to Codex CLI
codex
> "Create Docker development environment with hot reload, configure CI/CD pipeline"
```

**Reason**: Cursor's visual feedback is perfect for setup; Codex handles automation.

---

### Phase 4: Feature Implementation (Stories)
**Primary**: **Codex CLI** (60%) + **Claude Code** (30%) + **Cursor** (10%)  
**BMAD Agents**: sm (story management), dev (implementation)

**Why**:
- Codex excels at long-horizon feature builds from well-defined specs
- Claude Code for complex features requiring architectural judgment
- Cursor for quick UI adjustments and visual feedback

**Decision Tree**:

**Simple Feature (< 2 hours)**:
- Use: **Cursor** in IDE
- BMAD: `quick-dev` workflow
- Example: Add a new button component, update styling

**Medium Feature (2-8 hours)**:
- Use: **Codex CLI**
- BMAD: Standard `sm → dev → qa` story workflow
- Example: Implement authentication flow, add API endpoint

**Complex Feature (8+ hours)**:
- Use: **Claude Code** with Plan Mode
- BMAD: Full story workflow with architecture review
- Example: Build recommendation engine, implement payment system

**Workflow Example (Medium Feature)**:
```bash
# Codex CLI approach
codex
> "Implement the user profile editing feature from story-profile-edit.md"
# Let it run for 20 minutes, do other work
# Review when complete, iterate if needed

# Claude Code approach (if complex)
claude
/plan  # Enter plan mode
> "Build the notification system described in the architecture doc"
# Review plan
# Approve
# It executes step-by-step with checkpoints
```

---

### Phase 5: UI/Frontend Work
**Primary**: **Cursor** (80%) + **Claude Code** (20%)  
**BMAD Agents**: ux-designer, dev

**Why**:
- Cursor dominates in UI work (can paste design mockups)
- Real-time visual feedback
- Fast iteration on styling
- Claude Code for complex component logic

**Workflow**:
```
# In Cursor:
1. Paste Figma screenshot
2. Cmd+K: "Implement this design using Tailwind and Radix UI"
3. See preview
4. Iterate with Cmd+L chat: "Make the spacing more generous", "Use our design tokens"

# For complex interactive components:
# Switch to Claude Code
claude
> "Build a reusable data table component with sorting, filtering, pagination"
# Claude's reasoning creates more maintainable code
```

---

### Phase 6: Testing & QA
**Primary**: **Claude Code** (70%) + **Codex CLI** (30%)  
**BMAD Agents**: qa, code-review

**Why**:
- Claude Code has superior code review capabilities
- Best at finding edge cases and security issues
- Codex for automated test generation

**Workflow**:
```bash
# Claude Code review
claude
/review  # Built-in review command
# Select branch to review
# Get comprehensive security and quality analysis

# BMAD QA agent
@qa "Review the implementation in story-auth-flow.md"

# Codex for test coverage
codex
> "Generate comprehensive unit tests for the authentication module"
```

---

### Phase 7: Refactoring & Optimization
**Primary**: **Claude Code** (90%) + **Gemini CLI** (10%)  
**BMAD Agents**: architect (for major refactors), dev

**Why**:
- Claude Code is best at multi-file refactoring with architectural awareness
- Gemini CLI for quick performance analysis across large codebases

**Workflow**:
```bash
# Claude Code
claude
> "Refactor the data layer to use React Query instead of Redux"
# Plan Mode creates comprehensive refactoring plan
# Execute with human checkpoints

# Gemini for analysis
gemini chat
> "Analyze performance bottlenecks in this 50,000 line codebase"
# 1M token context can see entire project
```

---

### Phase 8: Documentation
**Primary**: **Claude Code** (60%) + **Gemini CLI** (40%)  
**BMAD Agents**: None specific (use general agents)

**Why**:
- Claude writes highest quality, most natural documentation
- Gemini can quickly generate docs from massive codebases

**Workflow**:
```bash
# Claude Code
claude
> "Generate comprehensive API documentation for all endpoints"
> "Create developer onboarding guide"

# Gemini CLI for bulk documentation
gemini chat
> "Generate JSDoc comments for all functions in /src/utils"
```

---

### Phase 9: Debugging & Troubleshooting
**Primary**: **Gemini CLI** (50%) + **Cursor** (30%) + **Claude Code** (20%)  
**BMAD Agents**: dev, qa

**Why**:
- Gemini fastest for identifying issues in large codebases
- Cursor best for real-time debugging with visual feedback
- Claude Code for complex logical bugs

**Decision Tree**:

**UI Bug**: → **Cursor** (visual inspection)  
**Performance Issue**: → **Gemini CLI** (massive context analysis)  
**Logic Bug**: → **Claude Code** (deep reasoning)  
**Quick Fix**: → **Gemini CLI** (speed)

---

### Phase 10: Deployment & DevOps
**Primary**: **Codex CLI** (70%) + **Gemini CLI** (30%)  
**BMAD Agents**: None in core BMAD (could use expansion modules)

**Why**:
- Codex has best DevOps and automation capabilities
- Strong at generating deployment configs, CI/CD pipelines
- Gemini for Google Cloud integration

**Workflow**:
```bash
# Codex
codex
> "Create production-ready Docker compose, GitHub Actions CI/CD, and deployment docs"

# For Google Cloud deployments
gemini cli
> "Deploy this app to Cloud Run with auto-scaling configuration"
```

---

## 4. BMAD Quick Flow Mapping

For the **BMAD Quick Flow** (faster path for experienced devs):

1. **Tech Spec Creation** (quick-dev → create-tech-spec)
   - **Claude Code** (comprehensive specs) OR **Codex** (faster specs)

2. **Implementation** (quick-dev)
   - **Codex CLI** (autonomous execution) OR **Cursor** (hands-on approach)

3. **Code Review** (code-review)
   - **Claude Code** (superior review quality)

---

## 5. Practical Decision Framework

### When You Have Clear Spec/Requirements:
→ **Codex CLI** (most efficient)

### When Problem is Ambiguous/Complex:
→ **Claude Code** (best reasoning)

### When Budget is Tight:
→ **Gemini CLI** (free tier)

### When Working on UI/Frontend:
→ **Cursor** (best visual feedback)

### When Codebase is Massive (50K+ LOC):
→ **Gemini CLI** (1M token context)

### When Security is Critical:
→ **Claude Code** (best code review) OR **Codex** (cybersecurity features)

### When Learning/Experimenting:
→ **Gemini CLI** (free) + **Cursor** (visual)

---

## 6. Cost Optimization Strategy

**For Your Budget**:

**Free/Minimal Cost**:
- **Gemini CLI**: Free tier (6000 code requests/day)
- **Cursor**: Free tier (100 requests/day)

**Best Value** (~$20/month):
- **ChatGPT Plus** ($20) → Includes Codex CLI
- **Cursor Pro** ($20)
- Total: $40/month
- Skip: Claude Code if budget constrained

**Maximum Power** (~$220/month):
- **Claude Pro** ($20) + **Claude Max** ($200) → Claude Code
- **ChatGPT Pro** ($60) → Codex CLI  
- **Cursor Pro** ($20)
- **Gemini** (free tier)
- Total: $300/month

**Recommended for Beginners** ($20/month):
- **ChatGPT Plus** → Get Codex CLI
- **Gemini CLI** (free)
- **Cursor** (free tier initially, upgrade to Pro $20 when needed)

---

## 7. Learning Path Recommendations

**Week 1-2: Foundation**
- Start with **Gemini CLI** (free, forgiving)
- Learn basic terminal workflow
- Practice with small scripts and utilities

**Week 3-4: IDE Integration**
- Add **Cursor** (free tier)
- Learn to integrate AI into active coding
- Build a small UI project

**Month 2: Advanced Terminal Work**
- Get **ChatGPT Plus** ($20)
- Learn **Codex CLI**
- Practice long-horizon feature builds
- Experiment with BMAD Quick Flow

**Month 3+: Full Stack**
- Add **Claude Code** when budget allows
- Master Plan Mode and code review
- Use full BMAD Method on larger project
- Develop instinct for which tool to use when

---

## 8. Your 16BitFit Project Strategy

Given your **16BitFit** (React Native + Phaser 3 gamified fitness app):

### Project Phases:

**1. Cleanup & Organization** (Current Need)
- **Primary**: Claude Code
- **Why**: Best at understanding existing messy codebase, creating organization plan
- **BMAD**: `architect` agent to design folder structure
```bash
claude
@architect "Analyze this React Native + Phaser project and propose a clean architecture"
@dev "Archive deprecated files according to this structure"
```

**2. Core App Architecture**
- **Primary**: Claude Code
- **Why**: Complex multi-framework integration (RN + Phaser)
- **BMAD**: Full method with PRD → Architecture → Implementation

**3. UI Components** (Retro Game Boy aesthetic)
- **Primary**: Cursor
- **Why**: Visual feedback crucial for pixel-perfect retro UI
- **BMAD**: `ux-designer` for design → `quick-dev` for implementation

**4. Game Logic** (Phaser 3)
- **Primary**: Codex CLI
- **Why**: Game logic is well-specified, can run autonomously
- **BMAD**: Standard story workflow

**5. AI-Powered Features** (Avatar generation, etc.)
- **Primary**: Claude Code
- **Why**: Complex integration requiring reasoning
- **BMAD**: Full planning workflow

**6. Mobile Testing**
- **Primary**: Gemini CLI
- **Why**: Can test across massive codebase, fast iteration
- **BMAD**: `qa` agent

---

## 9. Tool Combinations to Avoid

**Don't**:
- Use Cursor + Codex simultaneously on same codebase (context conflicts)
- Start with Claude Code for simple tasks (overkill)
- Use Gemini CLI for high-stakes security work (less mature)
- Rely solely on Cursor for complex architecture (lacks depth)

---

## 10. BMAD Integration Tips

### Calling BMAD Agents in Each Tool:

**Claude Code**:
```bash
# BMAD agents live in .bmad-core folder
# Use @ to invoke
@pm "Create a PRD for the onboarding flow"
@architect "Design the database schema"
@dev "Implement story-user-auth.md"
```

**Codex CLI**:
```bash
# Install BMAD via npx bmad-method install
# Then use slash commands or direct prompts
codex
> "Act as the BMAD dev agent and implement story-checkout.md"
```

**Gemini CLI**:
```bash
# Similar approach
gemini chat
> "Following BMAD method, act as the architect agent and design..."
```

**Cursor**:
```
# Load BMAD context via .cursorrules or direct prompt
Cmd+L: "Using BMAD Method story workflow, implement story-nav.md"
```

---

## 11. Final Recommendations

### For You Specifically (Sean):

**Start Here** (Month 1):
1. Install **Gemini CLI** (free) → Practice BMAD Quick Flow
2. Install **Cursor** (free tier) → Learn IDE integration
3. Use **Claude.ai web** (you have Pro) → PRD and planning

**Add When Ready** (Month 2):
4. Get **ChatGPT Plus** ($20) → Unlock Codex CLI
5. Practice feature builds with Codex
6. Compare Codex vs Claude for different tasks

**Level Up** (Month 3+):
7. Subscribe to **Claude Code** ($200 for max) OR start with base Pro
8. Master complex architecture and refactoring
9. Develop intuition for tool selection

### Your Workflow Should Be:
```
Ideation → Claude.ai web (with memory)
     ↓
Planning & PRD → Claude.ai web (artifacts)
     ↓
Architecture → Claude Code (60%) + Gemini CLI (40%)
     ↓
Setup → Cursor (quick) OR Codex (automated)
     ↓
Implementation → Codex CLI (most features) + Cursor (UI) + Claude Code (complex)
     ↓
Testing → Claude Code (review) + Gemini CLI (quick tests)
     ↓
Debugging → Gemini CLI (fast) + Cursor (visual) + Claude Code (complex)
     ↓
Documentation → Claude Code (quality) + Gemini CLI (bulk)
     ↓
Deployment → Codex CLI (automation)
```

---

## Why These Choices

**Claude Code = Architect**: Best reasoning, planning, complex problems  
**Codex CLI = Builder**: Best execution, automation, feature implementation  
**Gemini CLI = Scout**: Fast, broad context, current practices, free  
**Cursor = Craftsperson**: Visual work, UI, real-time iteration

Think of it like a team:
- Claude is your **senior architect/tech lead**
- Codex is your **reliable senior engineer**  
- Gemini is your **fast junior dev + researcher**
- Cursor is your **pair programmer**

Use them together, play to their strengths, and you'll ship faster and better.

---

## Questions to Revisit Quarterly

1. Have pricing/models changed? (AI moves fast)
2. Have you outgrown free tiers?
3. Are you using the right tool for each phase?
4. Is BMAD method evolving with new agents?
5. Have new tools entered the market?

---

**Last Updated**: January 2026  
**For**: Sean @ The Block  
**Context**: Transitioning to AI PM, 16BitFit development

