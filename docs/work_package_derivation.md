# Work Package Derivation from Product Events

## Purpose

This document defines how to derive implementation work packages from a proposed product delta.

The goal is to ensure that work packaging is grounded in product intent rather than arbitrary task decomposition.

---

## Core Principle

Use the product event delta to define what changed.

Then derive work packages from:

- affected entities in the projected product model
- dependencies between those entities
- required implementation, verification, and documentation evidence

In short:

```text
branch-only events
  -> product delta
  -> impacted entity graph
  -> work packages
```

---

## What a Work Package Is

A work package is a bounded delivery slice that is:

- traceable to one or more product entities
- small enough to implement coherently
- large enough to produce meaningful progress
- testable
- reviewable in a PR
- suitable for one implementation-oriented agent swarm or one focused human work session

A work package is not just a loose task list.

---

## Inputs to Work Package Derivation

Work packages should be derived from the following inputs.

### 1. Branch-only product events

These define the proposed product delta.

### 2. Projected product model on the branch

This provides the readable future-state view.

### 3. Traceability indexes

These reveal the relationships among:

- capability
- feature
- requirement
- acceptance criterion
- test

### 4. Dependency analysis

This identifies sequencing, architectural prerequisites, and affected existing entities.

### 5. Delivery constraints

Examples:

- schema migration ordering
- deployment safety requirements
- feature-flag strategy
- external dependency availability
- rollout constraints

---

## Work Package Derivation Steps

### Step 1: Identify changed entities

From the branch delta, identify all entities that are:

- added
- changed
- deprecated
- moved
- split
- merged
- indirectly impacted

Typical result:

```text
changed capabilities
changed features
changed requirements
changed acceptance criteria
changed tests
```

### Step 2: Build the impacted entity graph

For each changed entity, walk the relevant relationships.

Examples:

- feature -> requirements -> acceptance criteria
- requirement -> linked tests
- feature -> dependent or integrating features
- capability -> child features

This graph is the basis for understanding what needs to be realized.

### Step 3: Identify implementation seams

Look for natural packaging boundaries such as:

- vertical user-facing slices
- domain sub-areas
- integration seams
- infrastructure prerequisites
- risk isolation boundaries
- rollout boundaries

### Step 4: Group changes into coherent slices

Each work package should answer:

```text
What can be built, tested, and reviewed together as one meaningful increment?
```

### Step 5: Sequence the packages

Sequence by:

- dependency order
- technical prerequisite order
- risk reduction
- earliest feedback value
- safe incremental mergeability

### Step 6: Attach expected evidence

Each work package should define what completion evidence is expected.

Examples:

- source changes
- automated tests
- traceability updates
- generated product projection updates
- documentation updates
- deployment or migration notes

---

## Preferred Packaging Heuristics

Use these heuristics to shape better work packages.

### 1. Prefer feature-level or requirement-level vertical slices

Prefer:

```text
requirement + code + tests + docs
```

over:

```text
database-only
api-only
ui-only
```

unless a platform prerequisite genuinely needs separate treatment.

### 2. Keep acceptance criteria visible

A work package should map clearly to the acceptance criteria it advances.

If that mapping is unclear, the package is probably too vague.

### 3. Separate risky transitions

Isolate packages for high-risk work such as:

- destructive migrations
- authentication changes
- billing or permissions logic
- operational topology changes

### 4. Prefer incrementally mergeable packages

A package should ideally leave the system in a valid, supportable state after merge.

### 5. Avoid mixing unrelated product intent

Do not combine unrelated features or capabilities just because they affect similar code files.

---

## Types of Work Packages

The following kinds of packages are likely to emerge.

### Product slice package

Implements one feature or requirement end-to-end.

### Integration package

Connects a new slice to an existing slice.

### Platform prerequisite package

Adds enabling infrastructure needed by later feature packages.

### Verification package

Adds or updates tests, traceability, and proof of correctness.

### Hardening package

Improves resilience, operability, security, or rollout safety.

### Documentation package

Updates user-facing or internal explanatory material where it is part of the delivery bar.

---

## Example

Assume a branch delta introduces:

- `CAP-002`
- `FEAT-002`
- `REQ-010`
- `AC-020`
- `AC-021`
- a refinement to existing `FEAT-001`

A naive approach might create one large implementation effort.

A better derivation might be:

### WP-001: Enable core model for FEAT-002

Scope:

- product entities: `FEAT-002`, `REQ-010`
- objective: establish the core domain and persistence shape needed for the new feature

### WP-002: Implement FEAT-002 end-to-end

Scope:

- product entities: `FEAT-002`, `REQ-010`, `AC-020`, `AC-021`
- objective: realize the new feature with tests proving the acceptance criteria

### WP-003: Integrate FEAT-001 with FEAT-002

Scope:

- product entities: existing `FEAT-001` plus the new feature
- objective: adjust the previously implemented feature to interoperate with the new one

This gives a sequence of coherent implementation slices derived from the product delta.

---

## Suggested Work Package Shape

A work package may be represented like this:

```yaml
work_package_id: WP-003
base_branch: main
source_branch: feature/add-capability-2

scope:
  capability_ids:
    - CAP-002
  feature_ids:
    - FEAT-002
  requirement_ids:
    - REQ-010
  acceptance_criterion_ids:
    - AC-020
    - AC-021

type: product-slice
title: Implement FEAT-002 first end-to-end slice

dependencies:
  - WP-001

out_of_scope:
  - advanced reporting
  - operational dashboards

expected_evidence:
  - source_changes
  - automated_tests
  - traceability_updates
  - regenerated_product_model
```

This does not need to be part of the initial event model, but it is a good target shape for an internal planning projection.

---

## Which Agents Should Collate Work Packages

Recommended participants:

- **Product Model Steward** - preserves product coherence and traceability
- **Impact Analyst** - identifies affected existing entities and side effects
- **Backlog Planner** - shapes implementable slices
- **Architect** - identifies technical seams and sequencing constraints

Implementation agents should consume work packages, not invent them from scratch.

---

## Recommended Output of the Derivation Step

The derivation step should produce:

1. a list of changed product entities
2. a list of impacted existing entities
3. one or more work packages
4. a dependency order across packages
5. expected implementation and verification evidence per package

---

## Practical Summary

Recommended flow:

```text
branch-only events
  -> identify changed entities
  -> build impacted entity graph
  -> group into coherent implementation slices
  -> sequence slices
  -> launch implementation work per package
```

This keeps planning anchored to the event-sourced product definition while still allowing practical incremental delivery.

See also:

- `docs/work_package_tool_spec.md`
- `docs/work_package_output_schema.md`
- `docs/work_package_tool_implementation_plan.md`
