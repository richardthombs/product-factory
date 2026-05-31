# Work Package Derivation Tool Specification

## Purpose

This document specifies a dedicated tool for deriving implementation work packages from the branch delta.

The tool should convert a proposed product delta into one or more coherent implementation slices that agents or humans can act on.

---

## Primary Goal

Given a branch-delta report, the tool should propose:

- work-package candidates
- scope per work package
- dependency ordering
- rationale for the grouping

In short:

```text
branch delta
  -> changed entities
  -> impacted entities
  -> work packages
```

---

## Recommended Command

```bash
npm run derive-work-packages -- --base main
```

Recommended expanded form:

```bash
npm run derive-work-packages -- \
  --base main \
  --events-root ./product-events \
  --model-root ./product-model
```

---

## Inputs

### Required

- `--base <branch>`

### Optional

- `--events-root <path>`
- `--model-root <path>`
- `--format <yaml|json|text>`
- `--output <path>`

---

## Core Behaviour

The tool should:

1. obtain the branch delta
2. inspect changed entities and impacted entities
3. group those changes into coherent implementation slices
4. assign stable work-package ids within the report
5. emit a structured work-package proposal

---

## Work Package Definition

A work package is a bounded implementation slice that is:

- traceable to product entities
- small enough to implement coherently
- large enough to represent meaningful progress
- reviewable in a PR
- verifiable with tests and other evidence

---

## First-Version Heuristics

The first version should use simple deterministic heuristics.

### Preferred grouping order

1. group by changed feature
2. within a feature, include changed and impacted requirements
3. include changed and impacted acceptance criteria under those requirements
4. include changed and impacted tests linked to those acceptance criteria

### Additional rules

- one added or changed feature generally becomes one work package
- a feature move or deprecation may form its own work package
- pure status transitions may form a separate workflow/readiness package
- if multiple changed requirements belong to the same feature, keep them together initially

### Non-goals for v1

- no AI-based planning
- no effort estimation
- no automatic ownership assignment
- no code-level dependency scanning

---

## Expected Output

At minimum, each derived work package should include:

- work package id
- title
- change kind summary
- capability ids
- feature ids
- requirement ids
- acceptance criterion ids
- test ids
- dependency ids
- rationale

---

## Example

If the branch delta adds:

- FEAT-012
- REQ-012
- REQ-013
- REQ-014
- AC-018..AC-023
- TEST-019..TEST-025

then a first version may derive a single work package:

```yaml
work_packages:
  - work_package_id: WP-001
    title: Implement FEAT-012 branch delta reporting
    capability_ids:
      - CAP-002
    feature_ids:
      - FEAT-012
    requirement_ids:
      - REQ-012
      - REQ-013
      - REQ-014
    acceptance_criterion_ids:
      - AC-018
      - AC-019
      - AC-020
      - AC-021
      - AC-022
      - AC-023
    test_ids:
      - TEST-019
      - TEST-020
      - TEST-021
      - TEST-022
      - TEST-023
      - TEST-024
      - TEST-025
    depends_on: []
    rationale: All changed entities belong to the same feature and form one coherent implementation slice.
```

---

## Error Handling Expectations

The tool should fail if:

- branch delta cannot be computed
- branch delta is invalid
- product events are invalid
- required projections are missing and cannot be regenerated

---

## Definition of Done

The first version is complete enough when it can:

1. derive at least one deterministic work-package proposal from the branch delta
2. group scope by feature and child entities
3. emit stable, reviewable output
4. support later extension into richer dependency and planning logic
