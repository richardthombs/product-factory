# Branch Delta Tool Specification

## Purpose

This document specifies a dedicated `branch-delta` tool for comparing the current branch against a base branch such as `main` and reporting the proposed product delta.

The tool should make the branch-delta workflow explicit and queryable.

---

## Primary Goal

Given a base branch and the current working branch, the tool should identify:

- product events unique to the working branch
- entities directly changed by those events
- entities indirectly impacted by those changes
- a summary of the proposed product delta

In short:

```text
base branch product history
  vs
current branch product history
  => explicit branch delta report
```

---

## Command Shape

Recommended command:

```bash
npm run branch-delta -- --base main
```

Recommended expanded form:

```bash
npm run branch-delta -- \
  --base main \
  --events-root ./product-events \
  --format yaml \
  --output ./branch-delta/branch-delta.yaml
```

---

## Inputs

### Required

- `--base <branch>`
  - usually `main`

### Optional

- `--events-root <path>`
  - default: `./product-events`
- `--format <yaml|json|text>`
  - default: `yaml`
- `--output <path>`
  - if omitted, print to stdout
- `--include-impacted`
  - include indirect impact graph
- `--include-diff-summary`
  - include summary of changed entity counts
- `--include-tests`
  - include linked tests in impacted graph

---

## Core Behaviour

The tool should:

1. resolve the base branch
2. read product events from the base branch
3. read product events from the current branch / working tree
4. identify branch-only events
5. replay both event sets
6. compute changed entities
7. optionally compute impacted entities
8. emit a structured delta report

---

## Definition of Branch Delta

The branch delta should be defined as:

```text
product events present in the current branch but not present in the base branch
```

Comparison should be based on event identity, primarily event id.

This means:

- events on `main` are accepted baseline
- events only on the current branch are proposed product changes

---

## Minimum Output Requirements

At minimum the tool should report:

### Branch metadata

- base branch
- current branch
- events root
- generated timestamp or command context if desired

### Event delta

- branch-only event count
- branch-only event ids
- branch-only event file paths
- branch-only event types

### Changed entities

Grouped by type:

- capabilities
- features
- requirements
- acceptance criteria
- tests

Each group should distinguish:

- added
- changed
- moved
- deprecated
- status_changed

Not every group needs every category initially, but the structure should anticipate them.

### Summary counts

Examples:

- added features: 2
- changed requirements: 1
- moved features: 1
- deprecated features: 1
- changed acceptance criteria: 3

---

## Recommended Extended Behaviour

A stronger version of the tool should also report:

### Impact graph

For each changed entity, list related entities such as:

- feature -> parent capability
- feature -> requirements
- requirement -> acceptance criteria
- acceptance criterion -> tests

### Readiness information

Show whether changed features are currently:

- active
- defining
- implementation_ready
- in_delivery
- implemented
- verified
- deprecated

### Change categories

Summarise whether the delta includes:

- additive change
- refinement
- reshaping
- deprecation
- readiness/status transitions
- verification changes

---

## Example Use Cases

### Use case 1: additive feature branch

The branch adds:

- one feature
- one requirement
- two acceptance criteria

The tool should show a clean additive delta.

### Use case 2: refinement branch

The branch changes:

- one requirement description
- one acceptance criterion text

The tool should show no new entities, but changed existing entities.

### Use case 3: reshaping branch

The branch:

- moves one feature to another capability
- deprecates another feature

The tool should show reshaping explicitly, not just as generic feature changes.

### Use case 4: readiness branch

The branch:

- marks two features implementation-ready
- marks one capability scoped

The tool should highlight these as status transitions.

---

## Recommended Output Modes

### YAML

Primary machine-readable and reviewable format.

Best for:

- checked-in reports
- PR inspection
- agent consumption

### JSON

Best for:

- automation
- scripting
- downstream tools

### Text

Best for:

- quick terminal summaries
- local developer use

---

## Error Handling Expectations

The tool should fail clearly when:

- the base branch cannot be resolved
- the base branch has invalid product events
- the current branch has invalid product events
- replay fails for either side
- event files cannot be read

Recommended rule:

```text
Do not emit a trusted branch-delta report if either side is invalid.
```

---

## Non-Goals for the First Version

The first version does not need to:

- derive work packages
- infer code-level implementation changes
- infer semantic equivalence of rewritten entities
- compare arbitrary product-model YAML by text diff alone
- perform Git merge analysis beyond base-vs-current event comparison

These can come later.

---

## Practical Success Criteria

The first version is successful if it can reliably answer:

- which product events are unique to this branch?
- which product entities do those events change?
- what kind of change is this: add, refine, reshape, deprecate, or status change?
- what should implementation agents treat as the proposed product delta?

That is enough to make the branch-delta workflow first-class.
