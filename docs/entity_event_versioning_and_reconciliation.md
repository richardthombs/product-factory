# Entity Event Versioning and Branch Reconciliation

## Purpose

This document proposes a versioning and reconciliation model for product events when multiple feature branches may be in flight at the same time.

The goal is to ensure that changes to the same entity can be detected, reviewed, and reconciled against the latest `main` before merge.

This process should be mandatory for accepting branch changes onto `main`.

Related documents:

- `docs/branch_delta_workflow.md`
- `docs/product_change_and_delivery_workflow.md`
- `docs/product_evolution_event_model.md`

---

## Problem

The current event model is append-only on `main`, but branches may independently create events that affect the same entity.

Example:

- branch A changes `REQ-014`
- branch B also changes `REQ-014`
- both branches are valid relative to the `main` they were cut from
- after branch A merges, branch B may now be stale relative to the latest accepted state

Without explicit versioning or concurrency metadata, the repository cannot reliably distinguish between:

- a clean additive branch
- a branch based on stale entity state
- a branch that needs semantic conflict resolution before merge

---

## Desired Outcome

At any point in time, it should be possible to:

1. compare a branch's proposed events against the latest `main`
2. detect whether any branch-only events are based on stale entity state
3. identify exactly which entities conflict
4. force explicit reconciliation before merge
5. re-run the check in CI against the latest target branch head

In short:

```text
latest main entity versions
  + branch-only events with concurrency expectations
  -> clean replay or explicit reconciliation conflicts
```

---

## Core Principle

Accepted history on `main` is immutable.

Proposed history on a branch is still draft and may be revised during reconciliation.

Recommended rule:

```text
Accepted events are append-only.
Proposed branch-only events may be rewritten or replaced during reconciliation before merge.
```

This preserves auditability for accepted history while still allowing practical conflict resolution in proposal space.

---

## Versioning Model

## 1. Entity revision

Each projected entity should have a monotonically increasing revision number.

Examples:

- capability revision
- feature revision
- requirement revision
- acceptance criterion revision
- test revision

Revision numbers are derived deterministically by replay.

### Suggested semantics

- first accepted creation of an entity -> revision `1`
- each accepted event that changes that entity's projected state -> revision increments by `1`

---

## 2. What counts as changing an entity

A useful rule is:

```text
An entity revision changes whenever the accepted projection of that entity changes.
```

This includes both direct field changes and structurally relevant child-link changes.

### Examples

#### Feature entity

A feature revision should increment when:

- `FeatureAdded`
- `FeatureChanged`
- `FeatureMovedToCapability`
- `FeatureDeprecated`
- `FeatureStatusChanged`
- `RequirementAdded` under that feature

Rationale:

The feature projection changes when its description, parent, status, or requirement list changes.

#### Requirement entity

A requirement revision should increment when:

- `RequirementAdded`
- `RequirementChanged`
- `AcceptanceCriterionAdded` under that requirement

#### Acceptance criterion entity

An acceptance-criterion revision should increment when:

- `AcceptanceCriterionAdded`
- `AcceptanceCriterionChanged`
- `TestCreated` linked to that acceptance criterion

#### Capability entity

A capability revision should increment when:

- `CapabilityAdded`
- `CapabilityStatusChanged`
- `FeatureAdded` under that capability
- `FeatureMovedToCapability` into or out of that capability

This is intentionally based on projected state, not only on direct scalar fields.

---

## Event Concurrency Metadata

Rather than introducing bespoke `expected_version` fields into every payload, use a generic event-level metadata block.

### Proposed shape

```yaml
metadata:
  concurrency:
    preconditions:
      - entity_type: feature
        entity_id: FEAT-012
        expected_revision: 3
        expected_last_entity_event_id: EVT-20260601-0010
```

This allows an event to declare the entity state it expects to be true before the event can be accepted.

### Meaning of `expected_last_entity_event_id`

This field means:

```text
the most recent accepted event that affected the referenced entity
```

It does **not** mean:

```text
the most recent event anywhere in the entire product event stream
```

Example:

- if the precondition references `REQ-014`
- then `expected_last_entity_event_id` should be the last accepted event that modified `REQ-014`
- unrelated accepted events for other capabilities, features, or requirements should not change this value

Recommended interpretation:

```text
expected_revision = primary concurrency check
expected_last_entity_event_id = entity-specific provenance and clearer diagnostics
```

---

## Why event-level metadata is preferable

Benefits:

- works for all event types
- supports events affecting more than one entity
- avoids repeated schema shape per payload
- easier to extend later
- keeps business payload separate from concurrency checks

---

## Examples

### 1. Refining an existing feature

```yaml
id: EVT-...
type: FeatureChanged
payload:
  feature_id: FEAT-012
  description: Reports the net product delta between a working branch and a base branch.
metadata:
  concurrency:
    preconditions:
      - entity_type: feature
        entity_id: FEAT-012
        expected_revision: 2
        expected_last_entity_event_id: EVT-20260531-0061
```

### 2. Adding a requirement under an existing feature

```yaml
id: EVT-...
type: RequirementAdded
payload:
  requirement_id: REQ-099
  feature_id: FEAT-012
  description: The system shall ...
metadata:
  concurrency:
    preconditions:
      - entity_type: feature
        entity_id: FEAT-012
        expected_revision: 4
```

This ensures the addition was proposed against the expected parent feature state.

### 3. Moving a feature between capabilities

```yaml
id: EVT-...
type: FeatureMovedToCapability
payload:
  feature_id: FEAT-012
  capability_id: CAP-003
metadata:
  concurrency:
    preconditions:
      - entity_type: feature
        entity_id: FEAT-012
        expected_revision: 5
      - entity_type: capability
        entity_id: CAP-001
        expected_revision: 7
      - entity_type: capability
        entity_id: CAP-003
        expected_revision: 2
```

This models the event as depending on all affected existing entities being at known revisions.

---

## Reconciliation Algorithm

Given:

- latest accepted events on `main`
- branch-only events on the current branch

perform:

### Step 1: Replay latest `main`

Build projected state and current revisions for all entities.

### Step 2: Replay branch-only events against latest `main`

For each branch-only event in deterministic order:

1. read its concurrency preconditions
2. compare expected revisions against current replay state
3. if all match, apply the event and update derived revisions
4. if any mismatch, stop and record a reconciliation conflict

The event-id comparison here is also entity-specific:

- compare the branch event's `expected_last_entity_event_id`
- against the actual last accepted event affecting that same entity on latest `main`
- do not compare against the last event in the entire repository

### Step 3: Report conflicts

Each conflict should include:

- branch event id
- event type
- affected entity id(s)
- expected revision
- actual revision on latest `main`
- expected last entity event id if present
- actual last entity event id on latest `main`

---

## Conflict Definition

A reconciliation conflict exists when:

```text
a branch-only event assumes an entity revision that is no longer true on latest main
```

This is stronger and more useful than raw Git conflict detection.

---

## Example Conflict

### Initial state

`main`:

- `REQ-014` at revision 2

### Branch A

- `RequirementChanged(REQ-014)` expecting revision 2

### Branch B

- `RequirementChanged(REQ-014)` also expecting revision 2

### After A merges

`main` now has:

- `REQ-014` at revision 3

### Reconcile branch B

Branch B event says:

- expected revision: 2

Latest `main` says:

- actual revision: 3

Result:

```text
conflict: REQ-014 changed on main since this branch event was proposed
```

Branch B must now reconcile.

---

## Reconciliation Options

Recommended options for a stale branch event:

### Option 1: Rewrite the proposed event

Edit or replace the branch-only event so that it is based on the latest accepted revision.

Best when:

- the old proposed event was never accepted
- the branch is still in draft/proposal state

### Option 2: Replace with a new superseding event and drop the stale one

This is still effectively branch-history rewriting before acceptance.

### Option 3: Manually reshape the proposal

For example:

- keep latest `main` wording
- add a narrower follow-on change
- drop the branch change if it is no longer needed
- split the proposal into a different entity or feature

---

## Recommended Rule for Proposal Space

Before merge, branch-only events should be treated as editable proposal material.

Recommended rule:

```text
A stale branch-only event should not be merged unchanged.
It must be reconciled against latest main first.
```

---

## Mandatory Merge Gate

This reconciliation must be mandatory for merging to `main`.

### Local workflow

Developers or agents should be able to run something like:

```bash
npm run reconcile-events -- --base main
```

or against remote state:

```bash
npm run reconcile-events -- --base origin/main
```

### CI workflow

CI should run reconciliation against the latest merge target state.

Recommended rule:

```text
No branch may merge to main if reconciliation against latest target main fails.
```

This should be enforced in CI or merge queue validation, not left as a social convention.

---

## Merge-Time Requirements

A merge to `main` should require all of the following:

1. branch event stream validates
2. branch replay succeeds
3. branch delta can be computed
4. reconciliation against latest `main` succeeds
5. tests pass
6. generated projection is up to date

---

## Relationship to Branch Delta

Branch delta answers:

```text
What does this branch propose relative to main?
```

Reconciliation answers:

```text
Is this proposal still based on valid latest entity state?
```

These are related but different workflows.

Recommended sequence:

```text
branch-only events
  -> branch delta
  -> implementation / planning
  -> reconcile against latest main
  -> merge if clean
```

---

## Suggested Output of Reconciliation

A reconciliation report should include:

- base branch
- current branch
- latest base commit
- branch-only event count
- checked event count
- clean events
- conflicting events
- conflicts by entity
- suggested next action

Example shape:

```yaml
base_branch: origin/main
current_branch: feature/example
base_commit: abc123
checked_events: 4
status: conflicts
conflicts:
  - event_id: EVT-...
    event_type: RequirementChanged
    entity_type: requirement
    entity_id: REQ-014
    expected_revision: 2
    actual_revision: 3
    expected_last_entity_event_id: EVT-...
    actual_last_entity_event_id: EVT-...
    resolution: manual_reconcile_required
```

---

## Recommended Tooling Additions

Introduce a dedicated reconciliation command.

### Proposed command

```bash
npm run reconcile-events -- --base origin/main
```

### Responsibilities

- load latest base events
- build current accepted entity revisions
- load branch-only events
- validate concurrency preconditions
- report conflicts
- optionally emit a machine-readable reconciliation report

---

## Future Extensions

Later this model could support:

- auto-refresh proposals where no semantic conflict is inferred
- explicit conflict-resolution helper commands
- merge queue integration
- PR comment summaries
- entity snapshots in reconciliation output
- richer structural conflict policies

But the first version should stay deterministic and conservative.

---

## Recommended Conservative Policy

For v1:

- any failed precondition is a reconciliation conflict
- conflicts block merge
- users or agents must reconcile manually
- CI re-runs reconciliation against the latest target branch head

This is safer than trying to guess semantic equivalence automatically.

---

## Practical Summary

Recommended model:

```text
Each accepted entity has a derived revision.
Each branch event declares the entity revisions it expects.
Reconciliation replays branch events against latest main.
Mismatched expectations are conflicts.
Conflicts must be resolved before merge.
```

That gives the repository a first-class, event-native way to handle concurrent branch evolution of the same product entities.
