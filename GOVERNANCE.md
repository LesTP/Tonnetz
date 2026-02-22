# Governance

Development process for asynchronous, multi-session collaboration with a stateless partner (AI or otherwise). Governing constraint: **minimize wasted work when each session starts cold.**

---

## Documentation

Documentation is the source of truth — do not rely on prior conversations. If something is ambiguous, **ask** (don't guess). Prioritize clarity over speed.

### Per-Module Structure

Every module maintains two files:

| File | Purpose | Update Timing |
|------|---------|---------------|
| **DEVPLAN.md** | Cold start context, roadmap, phase breakdown, test specs | Before each iteration |
| **DEVLOG.md** | What actually happened — changes, issues, lessons | After each iteration |

Architecture documents (ARCH_*.md) live separately when contracts are consumed by other modules.

### DEVPLAN Post-Completion Cleanup

As phases complete, DEVPLAN sections accumulate implementation detail (rationale, rejected alternatives, narrative) that duplicates the DEVLOG. This creates a stale-read risk: a cold-start session may encounter the *planned* version of a decision rather than the *actual* version.

**Rule:** When a phase is completed and logged in DEVLOG, reduce its DEVPLAN section to a one-line summary with a DEVLOG entry reference. Retain only material that serves as a **forward reference** for future work — grammar tables, open issues, constraints still in effect. Rationale, rejected alternatives, and implementation narrative belong exclusively in DEVLOG.

The DEVPLAN should get *shorter* as work progresses. A cold-start session reads the DEVPLAN for "where are we and what's next" and the DEVLOG for "what happened and why."

### Cold Start Summary

DEVPLAN opens with:

**Cold Start Summary** (stable — update on major shifts):
- **What this is** — one-sentence scope
- **Key constraints** — non-obvious technical limits
- **Gotchas** — things that cause silent failures

**Current Status** (volatile — update after each step):
- **Phase** — e.g., "3b — Hit-test math"
- **Focus** — what's being built right now
- **Blocked/Broken** — anything preventing progress

### Decision Log

```
D-#: [Title]
Date: YYYY-MM-DD | Status: Open | Closed | Priority: Critical | Important | Nice-to-have
Decision:
Rationale:
Revisit if:
```

Once **Closed**, don't reopen unless new evidence appears. For reactive decisions during Refine work (see §Work Regimes), a one-line "changed X because Y" in the DEVLOG is sufficient. Use the full template only for genuine design forks with trade-offs.

---

## Work Regimes

Work falls along a spectrum based on **evaluability** — who can assess whether the output is correct.

### Build (AI-evaluable)

Correctness verifiable by tests, type checks, or objective criteria.

- Tests and acceptance criteria specified **before** implementation
- Large autonomous work chunks (full phases)
- Human reviews asynchronously after completion
- Decisions are architectural and durable

Examples: data models, algorithms, parsers, API contracts, integration wiring, build config.

### Refine (human-evaluable)

Correctness requires human perception or subjective judgment.

- Goals and constraints specified upfront; steps emerge iteratively
- Small increments shown to human frequently
- Human evaluates each increment synchronously
- Decisions are reactive and may reverse

**Feedback Loop:**
1. **Show** — present current state (running app, screenshot, audio)
2. **React** — human lists observations (order = priority)
3. **Triage** — classify: fix now / fix later / needs decision
4. **Adjust** — implement "fix now" items
5. **Repeat** until human declares acceptable or remaining items are deferred

Log each iteration in DEVLOG as a numbered item list with resolutions.

Examples: visual design, interaction feel, audio quality, layout, naming, copy.

### Explore (decision-evaluable)

Goal is to make a decision, not produce shipping code.

- Output: a closed decision (using the decision template)
- Method: prototype alternatives, compare, evaluate
- Time-boxed (one session or explicit limit)
- Log what was tried and why accepted/rejected

Examples: technology selection, A/B comparisons, architecture alternatives.

### Identifying the Regime

Ask: **"Can the implementer verify this is correct without showing it to someone?"**

- **Yes → Build.** Specify deeply: functions, test cases, step-by-step plan.
- **No → Refine.** Specify goals and constraints only. Do NOT pre-specify values that depend on perception (colors, sizes, timing) — these emerge from the feedback loop.
- **Need to decide first → Explore.** Time-box it, produce a decision, then Build or Refine.

Most features pass through multiple regimes: Explore the approach → Build the mechanism → Refine the experience. Plan for the transitions.

**Signals you're entering Refine:**
- Feature runs but you can't tell if it's "right" without showing someone
- Feedback contradicts or refines the original spec
- Decision velocity increases (multiple per session, some reversals)

---

## Work Modes

Each session operates in one mode at a time:

### 1. Discuss (no code changes)

- Every iteration **starts** here
- Determine scope, identify the work regime, specify accordingly
- Prioritize simplest solutions; check if existing code can be reused/extended
- Preserve existing architecture unless there's a clear reason to change it
- If context is missing, ask before proceeding
- **Ends with** a DEVPLAN update

### 2. Code / Debug

- **Code:** implement the plan from the discuss session
- **Debug:** propose a testable hypothesis first, then make changes
- Switching between code and debug within a session is expected

### 3. Review

- Goal: improve existing code, not write new features
- **Priority #1:** preserve existing functionality
- **Priority #2:** simplify and reduce code
- Confirm architecture alignment (no drift from spec)
- Documentation pass: remove redundancies, fix staleness

---

## Workflow

### New Projects

1. Define goal, target user, use cases
2. Architecture and technology decisions (document as decisions)
3. Define MVP features; everything else in "Future"
4. Decompose into modules with dependency ordering
5. Identify interface contracts consumed by other modules
6. Set up documentation (DEVPLAN, DEVLOG per module; ARCH docs for shared contracts)

### Module Dependency Ordering

Draw the dependency graph. Implement leaf-first. A module may begin once upstream dependencies have **stable interface contracts** — full implementation not required, only frozen API signatures.

### Phase Structure

**Build Regime** — one phase per feature:

| Position | Phase Type | Content |
|----------|-----------|---------|
| First | Foundation | Types, primitives, coordinate systems, constants |
| Middle | Domain-specific | Core algorithms and logic |
| Second-to-last | API assembly | Barrel exports, cross-module integration tests |
| Last | Review | Optimization, simplification, disambiguation |

Middle phase granularity should match **risk and uncertainty** — fine-grained for foundational work where errors propagate, coarser for independent lower-risk components.

**Refine Regime** — phases organized differently:

| Position | Phase Type | Content |
|----------|-----------|---------|
| First | Goals & constraints | What "good" looks like, hard limits |
| Middle | Feedback loops | Iterative show→adjust cycles (count unknown upfront) |
| Last | Stabilization | Lock decisions, write tests for final state, document |

For Refine phases, plan a **time budget**, not a step count.

### Phase Planning (Discuss Mode)

1. Determine scope and specific outcomes
2. Identify work regime (Build / Refine / Explore)
3. **Build:** break into smallest testable steps; create test specs at phase and step level
4. **Refine:** define goals, constraints, and first item to show; skip detailed step plans
5. **Explore:** define the decision to be made and time box
6. Update DEVPLAN

### Step Execution

1. **Discuss:** specific changes, files affected, decisions needed
2. **Code/Debug**
3. **Verify:** run tests (Build) or show to human (Refine)
4. **Confirm:** human explicitly approves the step before proceeding. For Build work with passing tests and straightforward changes, confirmation may be a brief acknowledgment. For Refine, documentation, and cross-cutting work, **do not proceed until the human signals approval.** "Tests pass" is necessary but not sufficient.
5. **Update DEVLOG** after confirmation
6. **Commit**

### Phase Completion

1. Run phase-level tests (Build) or human sign-off (Refine)
2. Review (simplify, remove dead code)
3. Update DEVLOG, documentation pass
4. **Propagate contract changes** to upstream documents (see §Contract Change Propagation)
5. **DEVPLAN cleanup** — reduce completed phase to summary + DEVLOG reference (see §DEVPLAN Post-Completion Cleanup)
6. **Human confirms** phase closure
7. Commit

---

## Cross-Module Integration

Before integrating modules A and B:

1. **Type compatibility** — verify A's output types match B's input types
2. **Boundary tests** — feed A's actual outputs into B's actual functions
3. **Bridge logic** — document any adapter/conversion needed

No module imports from the integration/orchestration layer. Subsystems do not import from each other except for shared types from upstream dependencies.

---

## Contract Change Propagation

During module Build, information flows forward: SPEC → ARCH docs → code. During cross-cutting work (integration, polish, refactoring), information flows backward: code changes produce decisions that modify upstream contracts (ARCH docs, SPEC, UX_SPEC). Without an explicit propagation rule, upstream documents silently drift.

### Contract-Change Markers

When a DEVLOG entry modifies a shared contract (any ARCH_*.md, SPEC.md, or UX_SPEC.md), include a **`### Contract Changes`** section listing the affected documents and the specific contract modified:

```
### Contract Changes
- ARCH_AUDIO_ENGINE.md §6.1: +setPadMode/getPadMode on AudioTransport
- UX_SPEC.md §4: sidebar content order updated (Clear absorbs Reset View)
- SPEC.md §Integration: test counts updated
```

If no shared contracts were modified, omit the section.

### Propagation Rules

**Immediate** (same session): Changes that modify a cross-module API signature or type. Test: *"Would a cold-start session on another module produce incorrect code by reading the current ARCH doc?"* If yes, propagate now.

**Phase boundary** (batched): All other contract changes. At phase completion, scan the DEVLOG's Contract Changes markers since the last sync and update all listed documents.

### Cross-Cutting Track Scope Declaration

Cross-cutting work tracks (integration, polish, refactoring) should declare their upstream document scope in the DEVPLAN Cold Start Summary:

```
**Documents in scope:**
- SPEC.md, UX_SPEC.md
- ARCH_AUDIO_ENGINE.md, ARCH_HARMONY_CORE.md, ARCH_RENDERING_UI.md
```

This primes cold-start sessions to know which documents may need sync relative to this track.
