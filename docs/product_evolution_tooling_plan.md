# Product Evolution Tooling Plan

## Purpose

This document proposes concrete schema, validation, projection, and CLI changes needed to support iterative product evolution in this repository.

It is intended as the practical follow-on to the current vertical slice.

For the next workflow-enablement step focused on first-class branch comparison, see:

- `docs/branch_delta_tool_spec.md`
- `docs/branch_delta_output_schema.md`
- `docs/branch_delta_tool_implementation_plan.md`

---

## Current Baseline

The repository currently supports these event types:

- `ProductCreated`
- `CapabilityAdded`
- `FeatureAdded`
- `RequirementAdded`
- `AcceptanceCriterionAdded`
- `TestCreated`

Current projection depth:

```text
Product -> Capability -> Feature -> Requirement -> Acceptance Criterion -> Test
```

This is enough for the initial slice, but not enough for realistic iterative change workflows.

---

## Goal of the Next Tooling Step

Support branch-delta-driven change workflows where agents can:

- refine existing requirements and acceptance criteria
- move or deprecate existing features
- express readiness for implementation
- derive implementation scope from changed product entities

The first expansion should stay intentionally narrow and deterministic.

---

## Recommended First Event Additions

Add these event types first:

- `RequirementChanged`
- `AcceptanceCriterionChanged`
- `FeatureMovedToCapability`
- `FeatureDeprecated`
- `FeatureStatusChanged`
- `CapabilityStatusChanged`

These unlock the most useful workflow improvements with relatively low complexity.

---

## Proposed Event Shapes

## 1. RequirementChanged

### Purpose

Update the current description of an existing requirement.

### Example payload

```yaml
payload:
  requirement_id: REQ-010
  description: The system shall preserve user notification preferences across sessions.
```

### Validation rules

- `requirement_id` must already exist at replay time
- description must be non-empty

### Projection effect

- overwrite the current description on the requirement
- update all projected views that include the requirement description

---

## 2. AcceptanceCriterionChanged

### Purpose

Update the current text of an existing acceptance criterion.

### Example payload

```yaml
payload:
  acceptance_criterion_id: AC-020
  text: Given a signed-in user with saved notification preferences, when the user returns, then the saved preferences are restored.
```

### Validation rules

- `acceptance_criterion_id` must already exist at replay time
- text must be non-empty

### Projection effect

- overwrite the current acceptance-criterion text
- preserve linked tests unless other events change them

---

## 3. FeatureMovedToCapability

### Purpose

Move an existing feature under a different capability.

### Example payload

```yaml
payload:
  feature_id: FEAT-007
  capability_id: CAP-003
```

### Validation rules

- feature must already exist
- target capability must already exist
- move must not be a no-op to the same capability

### Projection effect

- remove feature id from old capability
- add feature id to new capability
- update feature projection and indexes accordingly

---

## 4. FeatureDeprecated

### Purpose

Mark a feature as deprecated without erasing it from history.

### Example payload

```yaml
payload:
  feature_id: FEAT-007
  reason: Replaced by FEAT-011 and FEAT-012.
```

### Validation rules

- feature must already exist
- reason must be non-empty

### Projection effect

- set feature status to `deprecated`
- optionally store deprecation reason
- continue to project the feature explicitly

---

## 5. FeatureStatusChanged

### Purpose

Represent readiness and delivery progression for features.

### Example payload

```yaml
payload:
  feature_id: FEAT-010
  status: implementation_ready
  reason: Acceptance criteria are complete and dependencies are understood.
```

### Recommended initial status vocabulary

```text
proposed
defining
implementation_ready
in_delivery
implemented
verified
evolving
deprecated
```

### Validation rules

- feature must already exist
- status must be one of the supported values
- optional: disallow invalid transitions later

### Projection effect

- project feature status in feature YAML and markdown views
- make implementation-ready features discoverable in indexes later

---

## 6. CapabilityStatusChanged

### Purpose

Represent maturity of a capability as a whole.

### Example payload

```yaml
payload:
  capability_id: CAP-003
  status: scoped
  reason: Initial feature set and boundaries have been defined.
```

### Recommended initial status vocabulary

```text
proposed
shaping
scoped
partially_delivered
delivered
evolving
deprecated
```

### Validation rules

- capability must already exist
- status must be valid

### Projection effect

- project capability status in capability YAML and markdown views
- make partially-delivered vs fully-delivered capabilities visible

---

## Required Schema Changes

## `product-tools/src/schemas/events.ts`

Add Zod payload schemas for:

- `RequirementChanged`
- `AcceptanceCriterionChanged`
- `FeatureMovedToCapability`
- `FeatureDeprecated`
- `FeatureStatusChanged`
- `CapabilityStatusChanged`

Also add status enums for feature and capability statuses.

### Recommendation

Use shared enums/constants so validation, replay, and projection use the same vocabulary.

Possible additions:

```ts
export const FEATURE_STATUSES = [
  "proposed",
  "defining",
  "implementation_ready",
  "in_delivery",
  "implemented",
  "verified",
  "evolving",
  "deprecated",
] as const;

export const CAPABILITY_STATUSES = [
  "proposed",
  "shaping",
  "scoped",
  "partially_delivered",
  "delivered",
  "evolving",
  "deprecated",
] as const;
```

---

## Required Type Changes

## `product-tools/src/projection/types.ts`

Extend projected entity types.

### Capability model additions

Add fields such as:

- `status`
- optional `statusReason`

### Feature model additions

Add fields such as:

- `status`
- optional `statusReason`
- optional `deprecatedReason`

### Initial defaults

To avoid forcing immediate status events for all existing entities:

- new capabilities default to `proposed` or `active`
- new features default to `defining` or `active`

Recommended approach:

- capabilities default to `proposed`
- features default to `defining`
- deprecation is represented by explicit events overriding prior state

---

## Required Replay Changes

## `product-tools/src/projection/replay.ts`

Add reducers for the new event types.

### RequirementChanged

- locate requirement
- replace description

### AcceptanceCriterionChanged

- locate acceptance criterion
- replace text

### FeatureMovedToCapability

- locate feature
- remove from old capability's feature set
- add to new capability's feature set
- update feature parent reference

### FeatureDeprecated

- set feature status to `deprecated`
- store deprecation reason

### FeatureStatusChanged

- set feature status and status reason

### CapabilityStatusChanged

- set capability status and status reason

### Determinism rule

All reducers must remain simple state transitions with deterministic ordering based on existing replay rules.

---

## Required Validation Changes

## `product-tools/src/validation/validateEvents.ts`

Add repository-level validation for new references.

### New checks

- `RequirementChanged` references an existing requirement
- `AcceptanceCriterionChanged` references an existing acceptance criterion
- `FeatureMovedToCapability` references both an existing feature and an existing capability
- `FeatureDeprecated` references an existing feature
- `FeatureStatusChanged` references an existing feature
- `CapabilityStatusChanged` references an existing capability

### Suggested phased approach

#### Phase 1

Only validate existence and allowed status values.

#### Phase 2

Add lifecycle transition validation, for example:

- `implementation_ready -> proposed` invalid
- `deprecated -> implementation_ready` invalid without a dedicated reactivation event

Keep phase 1 simple.

---

## Required Projection Changes

## `product-tools/src/projection/projectModel.ts`

Update generated YAML files to include status where appropriate.

### Capability YAML

Add fields such as:

- `status`
- optional `status_reason`

### Feature YAML

Add fields such as:

- `status`
- optional `status_reason`
- optional `deprecated_reason`

### Markdown projection

Update `project.md` to render status where helpful.

Possible examples:

```text
## CAP-003 — Notifications (scoped)
### FEAT-010 — Manage notification preferences (implementation_ready)
```

Or use separate metadata lines if that reads better.

### Indexes

Extend indexes later if useful.

Recommended early additions:

- implementation-ready features index
- feature status summary

These do not need to be part of the first code change unless the team wants better planning support immediately.

---

## Required CLI Changes

The current helpers are creation-oriented. Evolution workflows need narrow mutation helpers.

## New recommended CLI commands

### `create-capability`

Keep as-is for additive work.

### `create-feature`

Keep as-is for additive work.

### `create-requirement`

Keep as-is for additive work.

### `create-test`

Keep as-is for verification linkage.

### Add `change-requirement`

Purpose:

- create a `RequirementChanged` event for an existing requirement

Suggested usage:

```bash
npm run change-requirement -- \
  --requirement REQ-010 \
  --description "The system shall preserve user notification preferences across sessions."
```

### Add `change-acceptance-criterion`

Purpose:

- create an `AcceptanceCriterionChanged` event

Suggested usage:

```bash
npm run change-acceptance-criterion -- \
  --acceptance-criterion AC-020 \
  --text "Given ... then ..."
```

### Add `move-feature`

Purpose:

- create a `FeatureMovedToCapability` event

### Add `deprecate-feature`

Purpose:

- create a `FeatureDeprecated` event

### Add `set-feature-status`

Purpose:

- create a `FeatureStatusChanged` event

Suggested usage:

```bash
npm run set-feature-status -- \
  --feature FEAT-010 \
  --status implementation_ready \
  --reason "Acceptance criteria are complete and dependencies are understood."
```

### Add `set-capability-status`

Purpose:

- create a `CapabilityStatusChanged` event

---

## Recommended File/Module Additions

Likely new or changed modules under `product-tools/src/commands/`:

- `changeRequirement.ts`
- `changeAcceptanceCriterion.ts`
- `moveFeature.ts`
- `deprecateFeature.ts`
- `setFeatureStatus.ts`
- `setCapabilityStatus.ts`

Potential shared utility additions:

- status enum module
- event payload builders for mutation commands
- common helpers for validating entity existence before event creation

---

## Recommended Testing Changes

## Unit/integration tests to add

### Validation tests

- changing a missing requirement fails
- changing a missing acceptance criterion fails
- moving a feature to a missing capability fails
- invalid statuses fail validation

### Replay/projection tests

- requirement description updates in all projections
- acceptance criterion text updates in all projections
- moved feature appears under the new capability and disappears from the old one
- deprecated feature remains projected with deprecated status
- feature and capability statuses project correctly

### Command tests

Add one focused CLI test per new command, following the current pattern.

---

## Suggested Delivery Sequence

## Milestone 1: refinement support

Implement:

- `RequirementChanged`
- `AcceptanceCriterionChanged`
- CLI commands for both
- replay, validation, and projection support
- tests

This unlocks incremental refinement of existing definitions.

## Milestone 2: structural reshaping support

Implement:

- `FeatureMovedToCapability`
- `FeatureDeprecated`
- CLI commands for both
- tests

This unlocks better handling of model evolution.

## Milestone 3: readiness workflow support

Implement:

- `FeatureStatusChanged`
- `CapabilityStatusChanged`
- CLI commands for both
- projection of status into YAML/markdown
- tests

This creates the bridge from product definition to implementation planning.

---

## Recommended Non-Goals for This Step

Do not add yet unless clearly needed:

- full work-package events
- release events
- incident events
- implementation-link evidence model
- lifecycle transition engine with complex policies
- inferred event generation from YAML edits

Keep the next step narrow and end-to-end.

---

## Practical Summary

Concrete next tooling scope:

```text
Schema:
  add 6 event types

Replay:
  support refinement, move, deprecate, and status transitions

Projection:
  show changed text and statuses in YAML/markdown

Validation:
  enforce reference existence and valid status values

CLI:
  add mutation-oriented commands for existing entities

Tests:
  add validation, replay, projection, and command coverage
```

This is the smallest useful next step for turning the current vertical slice into an iterative product-evolution workflow.
