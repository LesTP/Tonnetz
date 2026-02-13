# Governance

This document defines the high-level rules and expectations for development work in this repository.

---

## Documentation

Documentation must provide enough context of intent, constraints, and decisions for a collaborator/model to start cold each session.

- The docs are the source of truth, do not rely on previous conversations.
- If something is ambiguous, ASK (don't guess).
- Prioritize clarity over speed.

### Two-File Structure

Every project has the following documentation structure:

| File | Purpose | When to Update |
|------|---------|----------------|
| **DEVPLAN.md** | Cold start context, product vision, roadmap, requirements, design specs, decisions | Before each dev iteration |
| **DEVLOG.md** | Implementation history, issues encountered, lessons learned | After each dev iteration |

### Cold Start Summary

DEVPLAN opens with two sections before the main plan content:

**Cold Start Summary** (stable, update on major shifts):
- **What this is** (e.g., "Personal Android widget for habit tracking")
- **Key constraints** (e.g., "Android 12+ requires manual alarm permission")
- **Gotchas** (e.g., "Never call X inside Y - causes deadlock")

**Current Status** (volatile, update after each phase):
- **Phase** (e.g., "5d - Calendar UI Basic")
- **Focus** (e.g., "Build scrollable calendar view")
- **Blocked/Broken** (e.g., "Multi-day testing incomplete")

### Decision Template

When a decision is needed, present options following this template:

```
D-#: [Decision Title]
Date: YYYY-MM-DD
Status: [Open / Closed]
Priority: [Critical / Important / Nice-to-have]
Decision:
Rationale:
Trade-offs:
Revisit if:
```

**Rule:** Once marked **Closed**, don't reopen unless new evidence appears.

---

## Work Modes

The session operates in one of three modes:

### 1. Discuss

- Involves documentation updates but **NO code changes at all**
- Every iteration starts with a discuss session
- In making plans, prioritize the simplest solutions possible
- Always check existing architecture to see if elements can be used/extended
- Preserve existing architecture unless there's a clear reason to change it; if changing, document using decision template
- Reuse existing structures/functions/names whenever possible
- Do not invent variable names, APIs, schemas, or file structures
- If context is missing, ask before proceeding
- Consider and discuss edge cases, document decisions
- Every discuss session ends with a DEVPLAN update (including cold start sections if context has shifted)

### 2. Code/Debug

These are distinct but the model will switch between them as needed:

- **Code:** Implement the plan made in the discuss session for this iteration
- **Debug:** Propose specific testable hypothesis, only make code changes after testing

### 3. Review

- The goal is to improve existing code, not to write anything new
- **Priority #1:** Preserve existing functionality
- **Priority #2:** Optimize and simplify the code
- For trade-offs between performance and simplicity, clarify explicitly using the decision template
- The outcome should ideally be less and simpler code than what we started with; more complexity is only okay if it results in notable performance improvement
- Confirm architecture alignment (we didn't drift)
- Doc sync: ensure docs are up to date, make a pass to remove redundancies

---

## Workflow

### Greenfield Projects (Initial Setup)

1. Discuss the overall goal/purpose
2. Define use cases
3. Make architecture and tool choices
4. Define specific MVP features and put everything else into "Future plans"
5. Break into distinct individual features that can be worked on in separate sequential iterations called **Phases**
6. Set up documentation and document everything in the README and DEVPLAN

### Development Phases

One phase per feature, each phase consisting of one or more steps.

#### Phase Planning (Discuss Mode Only)

*Example: "Phase 5, add item to favorites"*

1. Determine the scope of this phase and specific outcomes
2. Break into smallest possible steps, to be implemented and tested individually
   - e.g., Phase 5a: create a favorites page
   - e.g., Phase 5b: add "fav_bool" field to the item table
3. Create a checkbox list of tests which:
   - Correspond to the items in scope for this phase
   - Could be manually executed and visually observed
4. Update DEVPLAN with the above

#### Step Implementation

*Example: "Phase 5b, add fav_bool field"*

1. **Discuss:**
   - Determine specific changes, tech specs, files to be changed/added
   - Identify and document choices, discuss with user and document decisions using template
   - Create a checkbox list of tests for this step
   - Update DEVPLAN with the above
2. **Code/Debug**
3. **Run tests** defined in step discussion
4. **Update DEVLOG** only upon confirmation that all tests pass
5. **Commit**

#### Phase Completion

When all steps in a phase are completed:

1. Run tests defined in phase discussion
2. Review
3. Update DEVLOG with any changes
4. Make one more pass to clean up documentation (remove redundancies, fix drift)
5. Commit
