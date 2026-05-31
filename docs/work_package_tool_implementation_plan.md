# Work Package Derivation Tool Implementation Plan

## Purpose

This document provides a step-by-step implementation plan for deriving work packages from the branch delta.

---

## Goal

Implement a tool that consumes the branch-delta model and outputs deterministic implementation slices.

---

## Milestone 1: Derive a minimal feature-grouped report

### Objective

Produce a first useful work-package report by grouping changed scope by feature.

### Work

1. Reuse the existing branch-delta tool as input.
2. Read:
   - changed entities
   - impacted entities
   - contextual changes
3. Group work by feature.
4. For each feature, include:
   - parent capability id
   - requirement ids
   - acceptance criterion ids
   - test ids
5. Emit a structured report.

### Deliverable

A deterministic work-package report where each changed feature becomes one work package.

---

## Milestone 2: Add rationale and change summaries

### Objective

Make work packages more human-readable and reviewable.

### Work

For each work package, infer:

- short title
- change summary list
- rationale text

Examples:

- `add feature`
- `refine requirement`
- `move feature`
- `deprecate feature`
- `status transition`

### Deliverable

A report that can be read directly in a PR or consumed by agents.

---

## Milestone 3: Add simple dependencies

### Objective

Express basic ordering where one work package should precede another.

### First-version heuristics

- if a package is feature-level and another is a pure readiness/status package for the same feature, the readiness package may depend on the feature package
- if a moved/deprecated feature affects another changed feature, derive a simple dependency
- otherwise default to no dependencies in v1

### Deliverable

Basic `depends_on` support.

---

## Recommended Code Structure

```text
product-tools/src/work-packages/deriveWorkPackages.ts
product-tools/src/work-packages/types.ts
product-tools/src/work-packages/renderWorkPackages.ts
product-tools/src/cli/derive-work-packages.ts
```

---

## Suggested CLI

```bash
npm run derive-work-packages -- --base main
```

Optional standard generated artifact path:

```text
product-model/indexes/work-packages.yaml
product-model/work-packages.md
```

---

## Testing Strategy

### Unit tests

- grouping by feature
- title generation
- change-summary generation

### Integration tests

- branch delta with one changed feature -> one work package
- branch delta with multiple changed features -> multiple work packages
- branch delta with readiness-only changes -> separate or annotated package

---

## Definition of Done

The first version is complete enough when it can:

1. derive deterministic work packages from the branch delta
2. group by feature and linked child entities
3. emit a stable YAML report
4. optionally emit a readable markdown summary
