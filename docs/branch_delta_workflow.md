# Branch Delta Workflow

## Purpose

This document defines the recommended workflow for treating branch-only product events as the canonical definition of a proposed product change.

It builds on the event-sourced product model described in:

- `docs/agentic_product_model_markdown.md`
- `docs/event_sourced_product_model_implementation_plan.md`

---

## Core Idea

For any working branch:

```text
branch delta = product events reachable on the branch but not contained in main
```

More practically:

```text
proposed product delta = branch-only events relative to the chosen base branch
```

Those branch-only events define the proposed change in product intent.

The projected `product-model/` on that branch is the readable view of the future product state if those events are accepted.

---

## Canonical Sources

### On `main`

`main` contains:

- accepted product events
- accepted current product definition
- accepted traceability state

### On a feature branch

A feature branch contains:

- all accepted events from `main`
- additional proposed events unique to the branch
- a projected product model representing the proposed next state

Therefore:

```text
accepted state + branch-only events = proposed next state
```

---

## Recommended Rule

Use this as the operating rule:

```text
Implementation agents implement the product delta defined by branch-only product events.
```

This means implementation should be grounded in:

- proposed capabilities
- proposed features
- proposed requirements
- proposed acceptance criteria
- proposed status transitions
- proposed deprecations, splits, merges, or refinements

not just in ad hoc conversation history.

---

## Why This Model Is Useful

This model gives the repository one clear source of truth for proposed change.

Benefits:

- proposed product change is reviewable in Git
- proposed product state is mechanically projected
- implementation can be scoped from explicit product intent
- semantic review can happen before or during implementation
- merge to `main` becomes the acceptance point for the product transition
- no separate change-definition database is required for v1

---

## Branch Delta vs Implementation Scope

The branch delta is not identical to a single implementation task.

Instead:

```text
branch-only events
  -> proposed product delta
  -> impacted entity graph
  -> one or more implementation slices
```

So the branch delta is the canonical definition of the change, while implementation scope is derived from the entities and relationships affected by that delta.

Examples of derived implementation scope:

- code changes
- test changes
- documentation changes
- deployment changes
- migration steps
- rollout sequencing

---

## Example

Assume `main` contains:

```text
CAP-001
  FEAT-001
```

A branch adds these events:

- `CapabilityAdded(CAP-002)`
- `FeatureAdded(FEAT-002 under CAP-002)`
- `RequirementAdded(REQ-010 under FEAT-002)`
- `AcceptanceCriterionAdded(AC-020 under REQ-010)`
- `AcceptanceCriterionAdded(AC-021 under REQ-010)`

Those branch-only events define the proposed product delta.

The branch projection then describes the future product state:

```text
CAP-001
  FEAT-001

CAP-002
  FEAT-002
    REQ-010
      AC-020
      AC-021
```

Implementation agents should treat that projected delta as the thing to realize in code, tests, and supporting artefacts.

---

## Workflow Stages

### 1. Explore

The user and agents explore the idea conversationally.

At this stage:

- the shape may still be unclear
- it may be uncertain whether the change is a new capability, a new feature, or a refinement of an existing feature
- draft notes may exist outside the event stream

### 2. Propose

Once the change is coherent enough, the agents create branch-only product events.

At this stage:

- the proposal becomes explicit
- the projector can show the proposed future state
- reviewers can inspect the semantic delta

### 3. Collate

Planner/orchestrator agents derive impacted entities and implementation slices from the branch delta.

### 4. Implement

Implementation agents work against the proposed product delta on the branch.

### 5. Validate

Tests, traceability, and projection are updated.

### 6. Accept

Merge to `main` accepts the product transition.

---

## Relationship to Pull Requests

A pull request should be understood as:

```text
proposed product transition
```

A good product-oriented PR may include:

- branch-only event files under `product-events/`
- regenerated `product-model/`
- implementation changes under source folders
- tests proving relevant acceptance criteria
- documentation updates where needed

In this model:

```text
PR diff = proposed product delta + realization evidence
```

---

## Change Categories

Branch-only events may represent different kinds of change.

Recommended categories:

- `extend` - add new capabilities, features, requirements, tests, or deployment support
- `refine` - clarify or tighten existing definitions
- `reshape` - split, merge, or move entities
- `deprecate` - mark entities or behaviours as being retired
- `verify` - improve traceability, tests, or implementation evidence

The category may be inferred from event types or later represented explicitly.

---

## Draft vs Accepted State

The workflow should distinguish between:

### Draft change shaping

Flexible, iterative, and conversational.

### Proposed product delta

Explicit branch-only events that are coherent enough to project and review.

### Accepted product history

Events merged to `main`, which are immutable and append-only.

A useful operating rule is:

```text
drafts may change freely; accepted events do not
```

---

## Recommended Constraints

1. Do not treat direct edits to `product-model/` as the source of proposed change.
2. Do not treat code changes alone as sufficient definition of product change.
3. Do not start implementation without identifying the relevant branch-only product delta.
4. Do not assume every branch-only event implies application code; some imply tests, docs, deployment, or planning changes.
5. Do not merge product-changing code without the corresponding product-event proposal when the change affects product intent.

---

## Practical Summary

The recommended model is:

```text
main = accepted product history
branch-only events = proposed product delta
branch projection = readable proposed future state
implementation scope = derived from the branch delta
merge = accepted product transition
```

This keeps product definition, planning, implementation, and acceptance aligned around the same event-sourced source of truth.
