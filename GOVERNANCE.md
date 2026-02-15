# Governance

This document defines the development process for projects built through **asynchronous, multi-session collaboration with a stateless partner** (AI or otherwise). Every rule here serves one governing constraint: **minimize wasted work when each session starts cold.**

---

## Documentation

Documentation must provide enough context of intent, constraints, and decisions for a collaborator/model to start cold each session.

- Docs are the source of truth — do not rely on prior conversations
- If something is ambiguous, **ask** (don't guess)
- Prioritize clarity over speed

### Per-Module Structure

Every module maintains two files:

| File | Purpose | Stability |
|------|---------|-----------|
| **DEVPLAN.md** | Cold start context, roadmap, phase breakdown, test specs | Updated before each iteration |
| **DEVLOG.md** | What actually happened — changes, issues, lessons | Appended after each iteration |

Architecture documents (ARCH_*.md) live separately when the module's contracts need to be consumed by other modules.

### Cold Start Summary

DEVPLAN opens with:

**Cold Start Summary** (stable, update on major shifts):
- **What this is** (e.g., "Personal Android widget for habit tracking")
- **Key constraints** (e.g., "Android 12+ requires manual alarm permission")
- **Gotchas** (e.g., "Never call X inside Y - causes deadlock")

**Current Status** (volatile — update after each step):
- **Phase** — e.g., "3b — Hit-test math"
- **Focus** — what's being built right now
- **Blocked/Broken** — anything preventing progress

### Decision Template

When a decision is needed, present options following this template:

```
D-#: [Title]
Date: YYYY-MM-DD
Status: Open | Closed
Priority: Critical | Important | Nice-to-have
Decision:
Rationale:
Trade-offs:
Revisit if:
```

**Rule:** Once marked **Closed**, don't reopen unless new evidence appears.

---

## Work Modes

Each session operates in one mode at a time:

### 1. Discuss (no code changes)

- Every iteration **starts** here
- Determine scope, identify changes, specify tests
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
- More complexity is acceptable only for demonstrated performance gains
- Confirm architecture alignment (no drift from spec)
- Documentation pass: remove redundancies, fix staleness

---

## Workflow

### New Projects

1. Define the goal, target user, and use cases
2. Make architecture and technology choices (document as decisions)
3. Define MVP features; put everything else in "Future"
4. Decompose into modules with explicit dependency ordering
5. For each module, identify interface contracts consumed by other modules
6. Set up documentation (DEVPLAN, DEVLOG per module; ARCH docs for shared contracts)

### Module Dependency Ordering

Before implementation begins, draw the dependency graph. Implement leaf-first (modules with no dependencies on other unfinished modules). A module may begin implementation once its upstream dependencies have **stable interface contracts** — full implementation is not required, only frozen API signatures.

### Phase Structure

One phase per feature or capability, following a general pattern:

| Position | Phase Type | Content |
|----------|-----------|---------|
| First | Foundation | Types, primitives, coordinate systems, constants |
| Middle | Domain-specific | The module's core algorithms and logic |
| Middle | Input processing | Parsing, validation, external data handling |
| Middle | Composition | Combining primitives into higher-level workflows |
| Second-to-last | API assembly | Barrel exports, cross-module integration tests |
| Last | Review | Optimization, simplification, disambiguation |

The first and last phases are invariant. Middle phases vary by module. Their granularity should match **risk and uncertainty**, not be uniform — fine-grained for foundational work where errors propagate, coarser for independent lower-risk components.

### Phase Planning (Discuss Mode)

1. Determine scope and specific outcomes
2. Break into smallest useful steps (each independently testable and commitable)
3. Create test specs at two levels:
   - **Phase-level:** observable outcomes (what the user can verify)
   - **Step-level:** implementation verification (what the code must satisfy)
4. Update DEVPLAN

### Step Execution

1. **Discuss:** specific changes, files affected, decisions needed, step-level tests
2. **Code/Debug**
3. **Run tests** defined in step discussion
4. **Update DEVLOG** only after tests pass
5. **Commit**

### Phase Completion

1. Run phase-level tests
2. Review (simplify, remove dead code)
3. Update DEVLOG
4. Documentation pass (remove redundancies, fix drift)
5. Commit

---

## Cross-Module Integration

Before integrating modules A and B:

1. **Type compatibility** — verify A's output types match B's input types
2. **Boundary tests** — feed A's actual outputs into B's actual functions
3. **Bridge logic** — document any adapter/conversion needed between modules

Maintain a cross-module compatibility table (✅ implemented / 🔲 pending) in the spec or architecture doc. This is the integration checklist.

No module should import from the integration/orchestration layer. Subsystems should not import from each other except for shared types from upstream dependencies.

---

## What Not to Systematize

- **Decision granularity** — don't gate which decisions "deserve" the template. Log all of them.
- **Step size** — break at natural test/commit boundaries, not at fixed time intervals.
- **Discussion length** — a bug fix may need 2 minutes of discussion; a new interaction model may need an entire session. The rule is qualitative: discuss until scope, approach, and tests are agreed.
- **Documentation volume** — during active development, thorough logs are load-bearing. Once a module stabilizes, the detail becomes archival. Don't prune it, but don't mandate exact fields for every entry either.

---

## Applicability

This process is designed for:
- Modular systems developed over multiple sessions
- Collaboration with stateless partners (AI or rotating contributors)
- Projects where integration across modules is a distinct concern

It adds justified overhead for these contexts. For a single-file script, a weekend prototype, or continuous same-day work on a familiar codebase, apply the principles (separate thinking from doing, document decisions, test at two levels) without the full formalism.
