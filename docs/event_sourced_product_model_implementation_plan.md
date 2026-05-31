# Event-Sourced Product Model Implementation Plan

## Goal

Implement a first vertical slice of the proposed event-sourced product model so the repository can:

1. store product changes as immutable event files
2. deterministically replay those events into generated YAML documentation
3. validate product integrity in CI
4. provide a foundation for later extension into behaviours, tests, deployment, releases, and operational evidence

---

## Guiding Principle

Start narrow and end-to-end.

The first slice should prove the architecture, not model the entire product domain.

Initial scope:

```text
Product -> Capability -> Feature -> Requirement -> Acceptance Criterion
```

This is the minimum chain that demonstrates:

- event sourcing
- deterministic projection
- reference validation
- traceability generation
- Git-friendly reviewable diffs

---

## Phase 0: Repository Scaffolding

Create the initial structure:

```text
/product-events
/product-model
/product-tools
  /src
  /schemas
  /tests
/docs
```

Suggested generated layout:

```text
/product-model
  product.yaml
  /capabilities
  /features
  /requirements
  /acceptance-criteria
  /indexes
```

Suggested authored event layout:

```text
/product-events
  /YYYY
    /MM
      /DD
        EVT-...-product-created.yaml
        EVT-...-capability-added.yaml
        EVT-...-feature-added.yaml
        EVT-...-requirement-added.yaml
        EVT-...-acceptance-criterion-added.yaml
```

Deliverables:

- directory structure in place
- README or command notes for local development
- initial package/tooling setup

---

## Phase 1: Define the Event Model

### 1.1 Event envelope

Define a common event structure for all event files.

Example shape:

```yaml
id: EVT-01...
type: CapabilityAdded
occurred_at: 2026-05-31T12:00:00Z
actor:
  type: agent
  id: feature_specifier
source:
  change_proposal_id: CHG-001
  conversation_id: CONV-123
payload: {}
metadata: {}
```

Required fields:

- `id`
- `type`
- `occurred_at`
- `actor`
- `payload`

Optional but recommended:

- `source`
- `metadata`

### 1.2 Initial event types

Define only these event types for v1:

- `ProductCreated`
- `CapabilityAdded`
- `FeatureAdded`
- `RequirementAdded`
- `AcceptanceCriterionAdded`

### 1.3 Event payload contracts

Define a schema for each payload.

Examples:

#### ProductCreated

```yaml
payload:
  product_id: PROD-001
  name: Product Factory
  description: Product knowledge system for agent-driven software delivery.
```

#### CapabilityAdded

```yaml
payload:
  capability_id: CAP-001
  name: Specify product behaviour
  description: Enables users to define expected product behaviour clearly and testably.
```

#### FeatureAdded

```yaml
payload:
  feature_id: FEAT-001
  capability_id: CAP-001
  name: Generate requirements from product idea
  description: Converts a raw product idea into structured requirements.
```

#### RequirementAdded

```yaml
payload:
  requirement_id: REQ-001
  feature_id: FEAT-001
  description: The system shall produce functional requirements from a raw product idea.
```

#### AcceptanceCriterionAdded

```yaml
payload:
  acceptance_criterion_id: AC-001
  requirement_id: REQ-001
  text: Given a raw product idea, when the feature is used, then structured requirements are produced.
```

Deliverables:

- event envelope schema
- per-event payload schemas
- schema validation tests

---

## Phase 2: Build Event Validation

Implement a validation pipeline that:

1. finds all event files under `/product-events`
2. parses YAML
3. validates against the envelope schema
4. validates the payload against the schema for its `type`
5. performs repository-level consistency checks

Repository-level checks for v1:

- event IDs are unique
- entity IDs are unique within their type
- `ProductCreated` exists
- `ProductCreated` occurs before dependent events
- referenced capability exists for each feature
- referenced feature exists for each requirement
- referenced requirement exists for each acceptance criterion
- timestamps are valid ISO timestamps

Command:

```text
validate-events
```

Deliverables:

- validation CLI command
- readable error messages
- test fixtures for valid and invalid event sets

---

## Phase 3: Implement Deterministic Replay

Implement a projector that:

1. loads validated events
2. sorts them by `occurred_at`, then `id`
3. reduces them into in-memory product state
4. writes generated YAML output

### Determinism rules

The same event stream must always produce identical output.

Enforce:

- stable event ordering
- stable map/object key ordering
- stable file naming
- stable collection ordering
- no non-derived timestamps in output
- no manual edits preserved in generated files

### In-memory state for v1

The state only needs to model:

- product
- capabilities
- features
- requirements
- acceptance criteria
- parent/child references

Deliverables:

- replay engine
- in-memory state model
- deterministic projection tests

---

## Phase 4: Generate Product YAML

Generate these files:

### 4.1 `product-model/product.yaml`

Include:

- product id
- name
- description
- capability ids
- summary counts

### 4.2 Capability files

Path:

```text
product-model/capabilities/CAP-001-specify-product-behaviour.yaml
```

Include:

- id
- name
- description
- feature ids

### 4.3 Feature files

Path:

```text
product-model/features/FEAT-001-generate-requirements-from-product-idea.yaml
```

Include:

- id
- capability_id
- name
- description
- requirement ids

### 4.4 Requirement files

Include:

- id
- feature_id
- description
- acceptance criterion ids

### 4.5 Acceptance criterion files

Include:

- id
- requirement_id
- text

### 4.6 Index files

Generate at least:

- `product-model/indexes/capability-map.yaml`
- `product-model/indexes/traceability-matrix.yaml`

These should allow tracing:

```text
Capability -> Feature -> Requirement -> Acceptance Criterion
```

### Generated file header

All generated files should include a warning header similar to:

```yaml
# Generated from /product-events.
# Do not edit directly.
# To change this file, add or modify product events.
```

Command:

```text
project-model
```

Deliverables:

- YAML writer
- slug/file path utility
- generated output snapshot tests

---

## Phase 5: Add a Rebuild Command

Provide a single command that performs the full local workflow:

```text
rebuild
```

It should:

1. validate events
2. clear generated output as needed
3. project the model
4. fail on any validation or projection error

Deliverables:

- simple local developer workflow
- one-command regeneration of `/product-model`

---

## Phase 6: Seed Example Data

Create one small but real example event stream containing:

- 1 product
- 1 capability
- 1 feature
- 1 requirement
- 1 acceptance criterion

This should serve as:

- a demo dataset
- a regression fixture
- a template for future events

Deliverables:

- initial event files under `/product-events`
- generated `/product-model` output checked in

---

## Phase 7: Add CI Guardrails

CI should validate both the source events and generated projection.

Checks:

- schemas pass
- references resolve
- replay succeeds from empty state
- generated YAML exactly matches projector output
- no direct manual edits to generated files

Recommended CI flow:

```text
install deps
-> validate-events
-> project-model
-> git diff --exit-code product-model
```

Deliverables:

- CI workflow
- failing build on projection drift

---

## Phase 8: Testing Strategy

### Unit tests

Test:

- schema validation
- event ordering
- slug generation
- reference resolution
- deterministic YAML generation

### Integration tests

Test:

- full replay from event files
- projection from empty output directory
- exact generated output for sample event set

### Failure-path tests

Test invalid cases such as:

- missing referenced capability
- duplicate IDs
- missing `ProductCreated`
- malformed timestamp
- unknown event type

---

## Suggested Technology Choices

Recommended stack for v1:

- TypeScript
- Node.js
- `zod` for runtime schema validation
- `yaml` for parsing and writing YAML
- `vitest` for tests

Rationale:

- fast to implement
- easy file-system tooling
- strong runtime validation support
- portable in local and CI environments

---

## Minimal Domain Rules for v1

Keep business rules intentionally small.

Rules:

1. exactly one product must be created
2. product must exist before any capability is added
3. capability must exist before a feature references it
4. feature must exist before a requirement references it
5. requirement must exist before an acceptance criterion references it
6. entity IDs must be unique within their type
7. event IDs must be globally unique

Do not add yet:

- deprecation rules
- rename/move events
- lifecycle state machines
- approval workflows
- deployment models
- tests/releases/incidents

---

## Definition of Done for the Vertical Slice

The first slice is complete when the repository can:

1. accept event files for the five initial event types
2. validate them locally and in CI
3. deterministically rebuild `/product-model`
4. regenerate output after deleting `/product-model`
5. fail CI if generated files drift from projector output
6. trace a capability down to acceptance criteria using generated indexes

---

## Recommended Next Extensions

After the first slice is stable, extend in this order:

### Extension 1: Product evolution events

Add:

- `CapabilityRenamed`
- `FeatureDeprecated`
- `RequirementChanged`

### Extension 2: Behaviour and verification

Add:

- `BehaviourDefined`
- `TestLinkedToRequirement`

### Extension 3: Deployment modelling

Add:

- `DeploymentModelIntroduced`
- `DeploymentConstraintChanged`

### Extension 4: Operational evidence

Add:

- `ReleaseDeployed`
- `IncidentLinkedToFeature`
- `OperationalLearningCaptured`

---

## Proposed Delivery Sequence

### Milestone 1

- scaffold repo structure
- define schemas
- validate event files

### Milestone 2

- implement replay engine
- project generated YAML
- check in sample event stream

### Milestone 3

- add rebuild command
- add CI drift detection
- add tests and snapshots

### Milestone 4

- extend event vocabulary
- add lifecycle events
- expand traceability depth

---

## Practical Recommendation

Do not try to make the first version complete.

Make it:

- deterministic
- testable
- reviewable
- replayable
- easy to extend

That will give the repository a solid architectural base for the larger product knowledge system.
