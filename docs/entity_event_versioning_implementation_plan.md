# Entity Event Versioning Implementation Plan

## Purpose

This document turns the proposed entity-versioning and reconciliation model into an implementation plan for `product-tools`.

Related document:

- `docs/entity_event_versioning_and_reconciliation.md`

---

## Goal

Add deterministic conflict detection for branch-only events so that merge to `main` is blocked when a branch is stale relative to the latest accepted entity state.

---

## Milestone 1: Model entity revisions in replay

### Objective

Teach replay to compute a current revision per entity.

### Work

1. Extend replay state to track, per entity:
   - entity type
   - entity id
   - current revision
   - last event id affecting that entity

2. Define revision increment rules for existing event types.

Suggested v1 mapping:

- `CapabilityAdded` -> capability +1
- `CapabilityStatusChanged` -> capability +1
- `FeatureAdded` -> feature +1, capability +1
- `FeatureChanged` -> feature +1
- `FeatureMovedToCapability` -> feature +1, old capability +1, new capability +1
- `FeatureDeprecated` -> feature +1
- `FeatureStatusChanged` -> feature +1
- `RequirementAdded` -> requirement +1, feature +1
- `RequirementChanged` -> requirement +1
- `AcceptanceCriterionAdded` -> acceptance criterion +1, requirement +1
- `AcceptanceCriterionChanged` -> acceptance criterion +1
- `TestCreated` -> test +1, acceptance criterion +1

### Deliverable

A replay utility that can answer:

- current revision for any entity
- last event affecting that entity

---

## Milestone 2: Add concurrency metadata to schemas

### Objective

Allow events to declare what entity revisions they expect.

### Work

1. Extend the base event schema with optional metadata such as:

```yaml
metadata:
  concurrency:
    preconditions:
      - entity_type: feature
        entity_id: FEAT-012
        expected_revision: 3
        expected_last_entity_event_id: EVT-...
```

Here `expected_last_entity_event_id` means the most recent accepted event that affected the referenced entity, not the most recent event in the full event stream.

2. Add shared schema/types for:
   - entity type enum
   - concurrency precondition entries
   - concurrency metadata block

### Deliverable

All event types can optionally carry structured concurrency expectations.

---

## Milestone 3: Teach commands to populate preconditions

### Objective

Creation and mutation helpers should record expected revisions automatically.

### Work

For commands that affect existing entities, compute the current revision at command time and write it into event metadata.

Examples:

- `change-feature`
- `change-requirement`
- `change-acceptance-criterion`
- `move-feature`
- `deprecate-feature`
- `set-feature-status`
- `set-capability-status`
- `create-requirement`
- `create-feature`
- `create-test`

For additive child events, include parent-entity preconditions.

### Deliverable

Newly proposed events are stamped with the revision assumptions they were created against.

---

## Milestone 4: Build reconciliation engine

### Objective

Compare branch-only events against latest `main` entity revisions.

### Work

Add modules such as:

```text
product-tools/src/reconciliation/reconcileEvents.ts
product-tools/src/reconciliation/types.ts
product-tools/src/reconciliation/renderReconciliation.ts
product-tools/src/cli/reconcile-events.ts
```

Responsibilities:

1. load latest base events from target branch
2. replay base to compute accepted revisions
3. load current branch events
4. identify branch-only events
5. replay branch-only events against accepted revisions
6. fail when any precondition does not match
7. emit reconciliation report

### Deliverable

A deterministic reconciliation command.

---

## Milestone 5: Add mandatory merge enforcement

### Objective

Require reconciliation success before merge to `main`.

### Work

In CI or merge queue:

1. fetch latest target branch
2. run:

```bash
npm run reconcile-events -- --base origin/main
```

3. fail the build if reconciliation status is not clean

### Deliverable

Merge is blocked unless branch-only events reconcile cleanly against latest `main`.

---

## Milestone 6: Improve conflict reporting

### Objective

Make conflicts actionable for users and agents.

### Work

For each failed event, report:

- event id
- event type
- entity id(s)
- expected vs actual revision
- expected vs actual last entity event id
- likely conflicting accepted event(s)
- recommended next step

### Deliverable

A report usable in CLI, CI, and PR review.

---

## Recommended CLI

### Local check

```bash
npm run reconcile-events -- --base main
```

### CI / remote check

```bash
npm run reconcile-events -- --base origin/main
```

### Optional output

```bash
npm run reconcile-events -- --base origin/main --format yaml --output ./branch-delta/reconciliation.yaml
```

---

## Validation Rules

The reconciliation command should fail when:

- target branch cannot be resolved
- base events are invalid
- branch events are invalid
- any event precondition does not match latest accepted revisions
- replay cannot determine required entity revisions

---

## Testing Strategy

### Unit tests

- revision increment rules per event type
- precondition comparison logic
- conflict rendering

### Integration tests

- two branches change same requirement -> stale branch fails reconciliation
- branch adds requirement under feature changed on main -> reconciliation conflict
- clean additive branch -> reconciliation succeeds
- branch reconciled against new main -> merge gate succeeds

### Failure-path tests

- missing base branch
- malformed concurrency metadata
- missing referenced entity in preconditions

---

## Recommended Delivery Order

### Phase A

- add revision tracking in replay
- add concurrency metadata schema/types

### Phase B

- stamp mutation commands with preconditions
- implement reconciliation command

### Phase C

- integrate reconciliation into CI
- improve reports and ergonomics

---

## Non-Goals for v1

Do not add yet unless clearly needed:

- automatic semantic merge of conflicting events
- hidden auto-rewrite of branch event files
- complex lock or lease systems
- external coordination service
- entity version history beyond deterministic replay

Keep v1 explicit, conservative, and reviewable.

---

## Definition of Done

The first version is complete enough when:

1. events can declare expected entity revisions
2. replay can compute accepted revisions deterministically
3. branch-only events can be reconciled against latest `main`
4. reconciliation conflicts are clearly reported
5. merge to `main` fails when reconciliation is stale or conflicting

That is the minimum needed to make concurrent branch evolution safe in the event-sourced workflow.
