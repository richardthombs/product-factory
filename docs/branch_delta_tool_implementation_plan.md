# Branch Delta Tool Implementation Plan

## Purpose

This document provides a step-by-step implementation plan for the dedicated `branch-delta` tool.

The intent is to add a first-class repo-native way to inspect the proposed product delta between `main` and a feature branch.

---

## Goal

Implement a command that compares:

- product events on a base branch, usually `main`
- product events in the current working branch

and emits a structured delta report.

---

## Milestone 1: Produce a basic event-level delta report

### Objective

Identify branch-only events and report them in a structured way.

### Work

1. Add a CLI command such as:

```bash
npm run branch-delta -- --base main
```

2. Implement base-branch event loading.

This likely requires using Git to read `product-events/` from another branch.

Possible approaches:

- `git ls-tree` + `git show`
- `git archive`
- temporary checkout/extract

Preferred approach for v1:

- read branch file list and file contents directly from Git without changing the working tree

3. Reuse existing parsing and validation logic where possible.

You will likely want shared helpers so events can be loaded from:

- filesystem paths
- Git blob contents

4. Compare event ids between:

- base branch event set
- current branch event set

5. Emit:

- branch metadata
- branch-only event count
- branch-only event ids
- branch-only event file paths
- branch-only event types

### Deliverable

A first useful report that explicitly lists the product events unique to the current branch.

---

## Milestone 2: Add changed-entity extraction

### Objective

Turn branch-only events into a changed-entity summary.

### Work

1. Add event-to-entity mapping logic.

For each event type, identify which entities it affects.

Examples:

- `FeatureAdded` -> feature
- `RequirementChanged` -> requirement
- `FeatureMovedToCapability` -> feature plus related capabilities
- `FeatureStatusChanged` -> feature

2. Group changed entities by type and change kind.

Examples:

- features.added
- features.moved
- features.deprecated
- features.status_changed
- requirements.changed

3. Add summary counts.

### Deliverable

A report that tells users and agents not just which events changed, but which product entities changed.

---

## Milestone 3: Add change-category inference

### Objective

Provide a compact semantic summary of the branch delta.

### Work

Infer categories from the event set.

Suggested mapping:

- additive events -> `extend`
- requirement/acceptance-criterion changes -> `refine`
- move events -> `reshape`
- deprecations -> `deprecate`
- test additions -> `verify`
- status changes -> `readiness`

### Deliverable

A high-level list of change categories for the branch.

---

## Milestone 4: Add impacted-entity graph

### Objective

Show the related entities touched by the branch delta.

### Work

1. Replay base branch state.
2. Replay current branch state.
3. For directly changed entities, walk relationships such as:

- capability -> features
- feature -> requirements
- requirement -> acceptance criteria
- acceptance criterion -> tests

4. Emit a deduplicated impacted-entity section.

### Deliverable

A report that helps planners and implementation agents understand scope and blast radius.

---

## Milestone 5: Add output modes and file generation

### Objective

Make the tool usable both interactively and in automation.

### Work

Support:

- stdout text summary
- YAML output
- JSON output
- optional `--output <path>`

Recommended generated path for checked-in or temporary artefacts:

```text
product-model/indexes/branch-delta.yaml
```

Only do this if it fits the repo’s generated-output policy.

### Deliverable

A flexible reporting tool usable by humans, CI, and agents.

---

## Recommended Code Structure

Possible modules:

```text
product-tools/src/cli/branch-delta.ts
product-tools/src/delta/branchDelta.ts
product-tools/src/delta/gitEvents.ts
product-tools/src/delta/report.ts
product-tools/src/delta/types.ts
```

Suggested responsibilities:

- `gitEvents.ts` -> read event files from a base branch using Git
- `branchDelta.ts` -> compute event delta and changed entities
- `report.ts` -> render YAML/JSON/text output
- `types.ts` -> delta report types

---

## Key Design Choice: Base Branch Loading

This is the hardest part technically.

### Recommendation

Do not try to compare generated YAML folders.

Instead compare the canonical source of truth:

```text
product-events on base branch
vs
product-events in current branch
```

This keeps the tool aligned with the event-sourced architecture.

---

## Validation Strategy

The tool should validate both sides before emitting a trusted report.

### Base branch validation

- parse base events
- validate base event stream
- fail if invalid

### Current branch validation

- parse current events
- validate current event stream
- fail if invalid

Only after both sides validate should the tool produce a branch delta.

---

## Testing Strategy

### Unit tests

- event-id delta detection
- event-to-entity mapping
- category inference

### Integration tests

Use temp repos or fixtures to simulate:

- base branch with accepted events
- working branch with extra events

Verify:

- branch-only events are identified correctly
- changed entities are grouped correctly
- categories are inferred correctly

### Failure-path tests

- base branch missing
- invalid event stream on base branch
- invalid event stream on current branch

---

## Suggested Delivery Order

### Phase A

Implement:

- base-branch event loading
- branch-only event detection
- YAML output report

### Phase B

Implement:

- changed-entity extraction
- summary counts
- change-category inference

### Phase C

Implement:

- impacted-entity graph
- text/json output
- optional output file generation

---

## Definition of Done

The branch-delta tool is complete enough for first adoption when it can:

1. compare the current branch to `main`
2. identify branch-only product events
3. identify changed product entities
4. classify the delta by change category
5. emit a structured report that agents can consume

That is the minimum needed to make branch delta a first-class operational workflow.
