# Retrospective - Epic 3: Automated Quality Guardrails
**Date:** 2026-01-19
**Facilitator:** Bob (Scrum Master)
**Project Lead:** Sean

---

## 📊 Epic Summary

| Metric | Value |
|--------|-------|
| Stories Completed | 10/10 |
| Agent: Codex-CLI | 8 |
| Agent: Claude-Code | 2 |
| Total Tests | 39+ (9 normalizer, 18 transparency, 12 hard-gates, 16 metrics) |
| Completion Date | 2026-01-18 |

---

## ✅ What Went Well

### 1. Robust Quality Gates
- **HF01-HF05** provide immediate protection against fundamentally broken frames (corrupted, empty, wrong size).
- **Hard Gate evaluation** is extremely fast (≤1s).

### 2. High-Quality Normalization
- Integrated 4-step pipeline: Contact Patch -> Downsample -> Transparency -> Canvas Sizing.
- **Auto-Chroma Detection (3.2)** successfully selects green/magenta/cyan based on anchor palette to prevent transparency bleeding.

### 3. Comprehensive Metric suite
- SSIM, Palette Fidelity, Alpha Artifacts, Baseline Drift, MAPD, and Orphan Pixel detection all implemented and passing tests.
- **MAPD Move-Type Context** (Story 3.8) allows bypassing temporal checks for high-motion animations, reducing false positives.

---

## 📋 Action Item Verification (from Epic 1-2)

| ID | Action Item | Status | Notes |
|----|-------------|--------|-------|
| A1 | Include tests in initial story completion | ⏳ **Partial** | Stories 3.1-3.3 had tests. Metrics stories (3.4-3.10) initially lacked tests and were added in code review. |
| A2 | Run adversarial review before marking "done" | ✅ **Done** | Found 17 issues across Epic 3, all addressed or documented. |
| A3 | Add `return` after `process.exit()` | ✅ **Done** | Pattern followed in all CLI-exposed logic. |

---

## ❌ Challenges & Remediation

### 1. Missing Initial Benchmarks for Metrics
- **Issue:** 7 metrics modules were implemented without corresponding unit tests in the initial turn.
- **Impact:** Required complex code review fixes to ensure algorithm correctness.
- **Fix:** Created `test/core/metrics/metrics.test.ts` with 16 test cases.
- **Lesson:** For algorithmic modules, tests are MANDATORY in the first implementation turn.

### 2. Transparency Integration Gap
- **Issue:** `frame-normalizer.ts` was originally using a placeholder alpha check instead of the full `transparency-enforcer.ts` logic.
- **Fix:** Integrated `enforceTransparency()` during remediation.

---

## 🎯 Lessons Learned

### 1. Algorithmic Verifiability
Complex metrics like SSIM and Orphan Pixel detection require edge-case testing (fully transparent frames, solid color frames, etc.) to be reliable. These must be proven before integration.

### 2. Intentional Deviations must be Documented
The mismatch between the 10KB spec and the 100B implementation for HF05 (file size) was a valid engineering choice for compressed pixel art, but identifying it during review highlighted the need for better spec-to-code alignment.

---

## 📋 Action Items for Epic 5

| ID | Action | Owner | Priority |
|----|--------|-------|----------|
| A4 | Carry forward A1: No story in Epic 5 marked "done" without tests | Dev Team | CRITICAL |
| A5 | Verify run folder structure before Story 5.3 | Architect | HIGH |
| A6 | Integrate real Auditor pipeline into Orchestrator (Carryover from Epic 4) | Dev Team | Medium |

---

## 🏆 Celebration Points
- **Adversarial Review caught 17 issues** - The process is proving its worth.
- **39+ automated tests** protecting our core quality guardrails.
- **Completed Epic 3 and Epic 4 in rapid succession.**

---

## Signatures

- **Scrum Master:** Bob ✓
- **Product Owner:** Alice ✓
- **Senior Dev:** Charlie ✓
- **QA Engineer:** Dana ✓
- **Project Lead:** Sean ✓ (Accepted via Chat)
