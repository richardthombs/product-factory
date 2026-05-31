# Product Change and Delivery Workflow

## Purpose

This document consolidates the recommended workflow for defining, proposing, planning, and implementing product changes in this repository.

It brings together three ideas:

1. branch-only product events define the proposed product delta
2. implementation work packages are derived from that delta
3. iterative product evolution should be expressed through deterministic, reviewable product events

This document is intended as the primary workflow reference for change-oriented work.

Related branch-delta tool documents:

- `docs/branch_delta_tool_spec.md`
- `docs/branch_delta_output_schema.md`
- `docs/branch_delta_tool_implementation_plan.md`

---

## Core Model

The repository has three important views of product state.

### 1. Accepted product history

Stored under `product-events/` on `main`.

This is the canonical accepted history.

### 2. Accepted current product definition

Projected under `product-model/` on `main`.

This is the canonical accepted current-state view.

### 3. Proposed product delta

Stored as product events that exist on a working branch but not on `main`.

This is the canonical definition of the change being proposed.

---

## Branch Delta Definition

For a working branch:

```text
branch delta = branch-only product events relative to the chosen base branch
```

Usually the base branch is `main`.

Therefore:

```text
accepted product history + branch-only events = proposed next product state
```

The projected `product-model/` on the branch is the readable view of that proposed future state.

---

## Operating Rule

Use this as the main workflow rule:

```text
Implementation agents implement the product delta defined by branch-only product events.
```

This means implementation should be grounded in explicit product intent captured as events, not only in conversational instructions or code diffs.

---

## Workflow Stages

## Stage 1: Explore

The user and product-definition agents clarify the idea.

Typical questions:

- Is this a new capability, a new feature, or a refinement of an existing feature?
- Does it overlap with existing product structure?
- What requirements and acceptance criteria are needed?
- What are the dependencies, constraints, and risks?
- What part of the change is actually ready for implementation?

At this stage, iteration is expected.

### Important rule

Exploration may be conversational and messy.

It does not need to immediately create accepted or even proposed product events.

---

## Stage 2: Propose the Product Delta

Once the change is coherent enough, agents express it as product events on a branch.

Examples:

- add a capability
- add a feature
- change a requirement
- change an acceptance criterion
- move a feature to another capability
- mark a feature implementation-ready
- deprecate a feature

At this point, the branch delta becomes the canonical definition of the proposed product change.

---

## Stage 3: Project the Proposed Future State

Run the projector so the proposed product state is visible under `product-model/`.

This allows the user and agents to review:

- the resulting capability/feature hierarchy
- changed requirements
- changed acceptance criteria
- traceability changes
- readiness status changes

At this stage:

```text
branch-only events = canonical proposed change
product-model projection = readable proposed future state
```

---

## Stage 4: Derive Implementation Scope

The branch delta is the source of truth, but it is not always a single implementation task.

Instead:

```text
branch-only events
  -> changed entities
  -> impacted entity graph
  -> implementation scope
```

Implementation scope may include:

- code changes
- tests
- docs
- deployment work
- migration work
- integration changes to existing features

---

## Stage 5: Collate Work Packages

Planner/orchestrator agents derive one or more work packages from the branch delta.

A work package is a bounded delivery slice that is:

- traceable to product entities
- coherent enough to implement as one unit
- verifiable
- reviewable

### Recommended derivation flow

```text
branch-only events
  -> identify changed entities
  -> identify impacted existing entities
  -> group into coherent slices
  -> sequence by dependency and risk
  -> attach expected evidence
```

---

## Stage 6: Implement

Implementation-oriented agents work against the branch delta or one selected work package.

Typical agents:

- Architect
- Backlog Planner
- Implementation Agent
- Test Agent
- Code Reviewer
- Security Reviewer
- Documentation Agent

Implementation should trace back to:

- capability ids
- feature ids
- requirement ids
- acceptance criterion ids
- relevant status transitions

---

## Stage 7: Verify and Reconcile

Once implementation exists, verify that the proposed product delta has been realized.

Evidence may include:

- automated tests
- test links in the product model
- implementation links
- updated docs
- rebuilt projection
- review evidence

This stage asks:

```text
Does reality now match the branch-defined product delta?
```

---

## Stage 8: Accept

Merge to `main` accepts the product transition.

After merge:

- the branch-only events become accepted history
- the projected product model becomes accepted current state
- traceability becomes part of the canonical product memory

---

## Change Categories

Every proposed change after initial product creation should be treated as product evolution.

Suggested categories:

- `extend` - add new capabilities, features, requirements, or tests
- `refine` - improve or clarify an existing definition
- `reshape` - split, merge, or move entities
- `deprecate` - retire entities or behaviours
- `verify` - improve traceability or delivery evidence

A new capability is therefore still a change. It is usually an `extend` change.

---

## Iteration During Change Processing

The change process should support iteration across both new and existing entities.

Examples:

- a proposed new capability may become a feature under an existing capability
- a feature may be split into two features during analysis
- a new feature may require changes to an existing feature
- acceptance criteria may reveal missing requirements
- implementation constraints may trigger product-definition refinement

### Key distinction

```text
draft/proposal space is iterative
accepted event history is append-only
```

This is essential to preserve both collaboration and auditability.

---

## Work Package Heuristics

Use these heuristics when collating work packages.

### Prefer vertical slices

Prefer packages that combine:

```text
requirement + acceptance criteria + implementation + tests
```

rather than arbitrary technical sub-tasks, unless technical prerequisites genuinely require separation.

### Keep acceptance criteria visible

Every work package should clearly advance one or more acceptance criteria.

### Isolate risky transitions

Separate high-risk work such as:

- destructive migrations
- authentication changes
- deployment topology changes
- billing or permissions changes

### Prefer incrementally mergeable slices

A package should ideally leave the system in a valid state after merge.

---

## Pull Request Interpretation

A pull request should be understood as:

```text
proposed product transition
```

A strong change-oriented PR may contain:

- branch-only event files
- regenerated `product-model/`
- code changes
- tests
- docs
- traceability updates

So:

```text
PR diff = proposed product delta + realization evidence
```

---

## Recommended Workflow for Agents

### Definition swarm

Used during exploration and proposal.

Typical members:

- Product Model Steward
- Capability Modeller
- Feature Specifier
- Requirement Analyst
- Behaviour Specifier
- Impact Analyst

### Delivery swarm

Used once the branch delta or a work package is ready for implementation.

Typical members:

- Architect
- Backlog Planner
- Implementation Agent
- Test Agent
- Code Reviewer
- Security Reviewer
- Documentation Agent

### Evolution swarm

Used when changing already-implemented product areas.

Typical members:

- Product Model Steward
- Impact Analyst
- Feature/Requirement agents
- Architect
- Implementation/Test/Review agents

---

## Practical Rules

1. Do not manually edit `product-model/` to define a product change.
2. Do not treat code diffs alone as the definition of product intent.
3. Do not start implementation without identifying the relevant branch delta.
4. Do not assume one change proposal equals one work package.
5. Do not assume one work package equals one feature if the dependency graph says otherwise.
6. Prefer feature-level implementation readiness over capability-level readiness for actual delivery.
7. Merge product intent and realization together where practical for stronger traceability.

---

## Compact Lifecycle

A compact view of the workflow is:

```text
Explore
  -> Propose branch-only product events
  -> Project proposed future state
  -> Derive implementation scope
  -> Collate work packages
  -> Implement
  -> Verify
  -> Merge to accept
```

---

## Recommended Summary Rule

Use this as the summary rule for the repository:

```text
The events unique to a branch define the proposed product delta.
Implementation planning derives work packages from that delta.
Merging the branch accepts the product transition.
```
