# Product Evolution Event Model

## Purpose

This document proposes the next set of event types needed to support iterative product evolution beyond the current vertical slice.

Current supported scope is intentionally narrow:

```text
Product -> Capability -> Feature -> Requirement -> Acceptance Criterion -> Test
```

To support branch-delta-driven change workflows and incremental implementation, the event model should expand in carefully chosen steps.

---

## Design Goals

New event types should support:

- refining existing product definitions
- representing readiness for implementation
- handling additive and incremental change
- capturing restructuring of existing entities
- improving traceability between product intent and delivery evidence

They should remain:

- deterministic to project
- reviewable in Git
- schema-validatable
- append-only once accepted

---

## Recommended Expansion Strategy

Add new event types in three layers.

### Layer 1: Product evolution events

These let the model evolve without forcing destructive rewrites.

### Layer 2: Workflow and readiness events

These let the model express when a feature or capability is ready for delivery.

### Layer 3: Delivery and evidence events

These improve traceability from product delta to implementation and verification.

---

## Layer 1: Product Evolution Events

These are the most important next additions.

### CapabilityRenamed

Use when the meaning stays substantially the same but the name improves.

Example payload:

```yaml
payload:
  capability_id: CAP-001
  new_name: Manage product definition lifecycle
```

### FeatureRenamed

Use when the feature remains conceptually the same but needs clearer naming.

### FeatureMovedToCapability

Use when a feature belongs under a different capability after clarification.

Example payload:

```yaml
payload:
  feature_id: FEAT-007
  new_capability_id: CAP-003
```

### RequirementChanged

Use when the expected behaviour of an existing requirement changes.

Example payload:

```yaml
payload:
  requirement_id: REQ-010
  new_description: The system shall ...
```

### AcceptanceCriterionChanged

Use when the verification condition for a requirement changes.

### FeatureDeprecated

Use when a feature remains historically relevant but should no longer be extended.

### CapabilityDeprecated

Use when an entire area of value is being retired.

### FeatureSplit

Use when one feature is overloaded and should be replaced by multiple new features.

Suggested behaviour:

- old feature remains in history
- new features are introduced separately
- projection can mark the source feature as split/replaced

### FeaturesMerged

Use when overlapping features are consolidated.

---

## Layer 2: Workflow and Readiness Events

These events support the handoff from product definition to implementation.

### FeatureStatusChanged

This is the most useful general readiness event.

Example payload:

```yaml
payload:
  feature_id: FEAT-010
  from_status: defining
  to_status: implementation_ready
  reason: acceptance criteria are complete and dependencies are understood
```

Suggested initial statuses:

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

### CapabilityStatusChanged

This can be used to represent capability maturity.

Suggested initial statuses:

```text
proposed
shaping
scoped
partially_delivered
delivered
evolving
deprecated
```

### RequirementStatusChanged

Optional, but useful later if requirement-level approval or readiness becomes important.

---

## Layer 3: Delivery and Evidence Events

These are useful once the team wants stronger traceability from product definition to implementation and proof.

### ImplementationLinked

Use to link product entities to concrete implementation locations.

Possible payload:

```yaml
payload:
  entity_type: feature
  entity_id: FEAT-010
  implementation_ref: src/features/notifications
  kind: code
```

### TestLinked

A more general future replacement or extension of the current test model.

For now, the existing `TestCreated` event may remain sufficient.

### VerificationRecorded

Use when a requirement, feature, or work package has been verified by a specific mechanism.

### DocumentationLinked

Use when documentation is a first-class delivery artefact that should be traced.

### ReleaseLinked

Useful later when releases become part of the product model.

---

## Minimal Recommended Next Step

If the repository wants the smallest useful extension, start with only these events:

- `RequirementChanged`
- `AcceptanceCriterionChanged`
- `FeatureStatusChanged`
- `CapabilityStatusChanged`
- `FeatureDeprecated`
- `FeatureMovedToCapability`

These six event types unlock a large amount of practical workflow without adding too much projection complexity.

---

## Why Status Events Matter

Status events provide the bridge between:

- product-definition work
- implementation planning
- implementation execution
- verification

Without status transitions, the system knows what exists, but not whether it is ready to build, being built, or verified.

With status transitions, the system can answer questions such as:

- which features are implementation-ready?
- which capabilities are only partially delivered?
- which accepted changes still need realization?
- which features are evolving vs deprecated?

---

## Recommended Projection Effects

These new event types should be projected deterministically.

Examples:

- `RequirementChanged` updates the requirement projection
- `AcceptanceCriterionChanged` updates acceptance-criterion text and traceability views
- `FeatureStatusChanged` updates feature status in YAML and markdown projections
- `FeatureDeprecated` marks a feature as deprecated instead of silently removing it
- `FeatureMovedToCapability` updates parent-child relationships and indexes

Projection should never erase history; it should represent current state while preserving the reviewable event history.

---

## Relationship to Branch Delta Workflow

These events are especially useful because branch-only events can then express not just additive structure, but also iterative evolution.

Examples:

- a branch introduces a new feature and marks it `implementation_ready`
- a branch refines an existing requirement and updates its acceptance criteria
- a branch moves a feature to a more appropriate capability after analysis
- a branch deprecates an outdated feature while introducing a replacement

This makes the branch delta a richer and more realistic representation of proposed change.

---

## Suggested Order of Implementation

### Milestone A: enable refinement

Add:

- `RequirementChanged`
- `AcceptanceCriterionChanged`
- `FeatureDeprecated`
- `FeatureMovedToCapability`

### Milestone B: enable readiness workflow

Add:

- `FeatureStatusChanged`
- `CapabilityStatusChanged`

### Milestone C: strengthen evidence

Add:

- `ImplementationLinked`
- `VerificationRecorded`
- optional generalisation of test-linking events

---

## Practical Summary

Recommended next event-model direction:

```text
Current model:
ProductCreated
CapabilityAdded
FeatureAdded
RequirementAdded
AcceptanceCriterionAdded
TestCreated

Next additions:
RequirementChanged
AcceptanceCriterionChanged
FeatureStatusChanged
CapabilityStatusChanged
FeatureDeprecated
FeatureMovedToCapability
```

These additions are enough to support iterative product evolution, branch-delta-driven implementation planning, and a clearer handoff from definition to delivery.
