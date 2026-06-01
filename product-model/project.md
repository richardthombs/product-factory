<!-- Generated from /product-events. -->
<!-- Do not edit directly. -->
<!-- To change this file, add or modify product events. -->
# Product Factory

Event-sourced product knowledge system for agent-driven software delivery.

# Summary

- Product ID: PROD-001
- Capabilities: 2
- Features: 14
- Requirements: 16
- Acceptance Criteria: 26
- Tests: 29
- Projected from events: 101
- Last event: EVT-20260601-0015 @ 2026-06-01T07:12:03.000Z

# Capabilities

## CAP-001 — Manage product model structure

Enables users to define and extend the core structure of the product model.

### FEAT-001 — Create initial product

Creates the first product record in an empty event store.

Requirements:

- **REQ-001**: The system shall create an initial product record when the event store is empty.
  - Acceptance criteria:
    - **AC-001**: Given an empty event store, when the create-product command is run, then a ProductCreated event is written and the product model is rebuilt. `TEST-001`.

### FEAT-002 — Create capability

Adds a new capability to an existing product model.

Requirements:

- **REQ-002**: The system shall create a capability under an existing product model.
  - Acceptance criteria:
    - **AC-002**: Given an existing product model, when the create-capability command is run, then a CapabilityAdded event is written and the product model is rebuilt. `TEST-002`.

### FEAT-003 — Create feature with requirements and acceptance criteria

Adds a feature, requirement, and one or more acceptance criteria under an existing capability.

Requirements:

- **REQ-003**: The system shall create a feature, a linked requirement, and one or more linked acceptance criteria for an existing capability.
  - Acceptance criteria:
    - **AC-003**: Given an existing capability, when the create-feature command is run with one acceptance criterion, then the system writes FeatureAdded, RequirementAdded, and AcceptanceCriterionAdded events and rebuilds the model. `TEST-003`.
    - **AC-004**: Given an existing capability, when the create-feature command is run with multiple acceptance criterion texts, then the system creates one acceptance criterion event for each text. `TEST-004`.

### FEAT-008 — Create requirement

Adds a requirement and one or more acceptance criteria to an existing feature.

Requirements:

- **REQ-008**: The system shall create a requirement under an existing feature and attach one or more acceptance criteria to it.
  - Acceptance criteria:
    - **AC-010**: Given an existing feature, when the create-requirement helper is run, then the system writes a RequirementAdded event and one AcceptanceCriterionAdded event per acceptance criterion and rebuilds the model. `TEST-010`.
    - **AC-011**: Given an existing feature, when the create-requirement helper is run with multiple acceptance criteria, then the new requirement is projected under the feature with all created acceptance criteria. `TEST-011`.

### FEAT-009 — Change existing requirements and acceptance criteria

Updates existing requirement and acceptance criterion definitions incrementally as the product evolves.

Requirements:

- **REQ-009**: The system shall provide helpers to change existing requirements and acceptance criteria without rewriting accepted history.
  - Acceptance criteria:
    - **AC-012**: Given an existing requirement, when the change-requirement helper is run with a new description, then the system records a RequirementChanged event and projects the updated requirement description. `TEST-013`.
    - **AC-013**: Given an existing acceptance criterion, when the change-acceptance-criterion helper is run with new text, then the system records an AcceptanceCriterionChanged event and projects the updated acceptance criterion text. `TEST-014`.

### FEAT-010 — Reshape feature structure

Moves and deprecates existing features while preserving append-only product history.

Requirements:

- **REQ-010**: The system shall support moving an existing feature to another capability and deprecating an existing feature without deleting its history.
  - Acceptance criteria:
    - **AC-014**: Given an existing feature and a target capability, when the move-feature helper is run, then the system records a FeatureMovedToCapability event and projects the feature under the target capability. `TEST-015`.
    - **AC-015**: Given an existing feature, when the deprecate-feature helper is run with a reason, then the system records a FeatureDeprecated event and projects the feature as deprecated with its deprecation reason. `TEST-016`.

### FEAT-011 — Track capability and feature readiness

Represents capability and feature status transitions for planning and delivery workflow.

Requirements:

- **REQ-011**: The system shall record capability and feature status changes and project the resulting readiness metadata.
  - Acceptance criteria:
    - **AC-016**: Given an existing feature, when the set-feature-status helper is run with a new status, then the system records a FeatureStatusChanged event and projects the updated feature readiness state. `TEST-017`.
    - **AC-017**: Given an existing capability, when the set-capability-status helper is run with a new status, then the system records a CapabilityStatusChanged event and projects the updated capability readiness state. `TEST-018`.

### FEAT-014 — Change existing feature descriptions

Updates existing feature descriptions incrementally as the product evolves.

Requirements:

- **REQ-016**: The system shall provide a helper to change an existing feature description without rewriting accepted history.
  - Acceptance criteria:
    - **AC-026**: Given an existing feature, when the change-feature helper is run with a new description, then the system records a FeatureChanged event and projects the updated feature description. `TEST-029`.

## CAP-002 — Validate and project product model

Enables users to validate product events and regenerate the current-state product model.

### FEAT-004 — Validate product events

Validates the product event stream against schemas and repository rules.

Requirements:

- **REQ-004**: The system shall validate product event files against schemas and repository-level consistency rules.
  - Acceptance criteria:
    - **AC-005**: Given a set of product event files, when validate-events is run, then the system reports schema or reference errors and succeeds only when the event stream is valid. `TEST-005`.

### FEAT-005 — Project current-state product model

Projects accepted product events into generated YAML that represents the current product state.

Requirements:

- **REQ-005**: The system shall deterministically project accepted product events into generated YAML documentation of current state.
  - Acceptance criteria:
    - **AC-006**: Given a valid event stream, when project-model is run, then the system generates deterministic YAML files for the product, capabilities, features, requirements, acceptance criteria, and indexes. `TEST-006`, `TEST-008`.

### FEAT-006 — Rebuild product model

Validates events and regenerates the product model in one command.

Requirements:

- **REQ-006**: The system shall provide a rebuild command that validates events and regenerates the product model.
  - Acceptance criteria:
    - **AC-007**: Given a valid event stream, when rebuild is run, then the system validates events and regenerates the product model successfully. `TEST-012`.

### FEAT-007 — Create tests for acceptance criteria

Creates test artifacts for acceptance criteria using filename and test name, and annotates tests with AC ids.

Requirements:

- **REQ-007**: The system shall provide a create-test helper that annotates tests with acceptance criterion ids and records test artifacts with test id, file path, and test name.
  - Acceptance criteria:
    - **AC-008**: Given one or more acceptance criterion ids, a test file, and a test name, when the create-test helper is run, then the test is annotated with the acceptance criterion ids and one TestCreated event is recorded for each id. `TEST-009`.
    - **AC-009**: Given created tests and acceptance criteria, when project-model is run, then the generated model includes test ids under the relevant acceptance criteria and projects each test artifact with file path and test name. `TEST-007`.

### FEAT-012 — Report branch delta

Reports the net product delta between a working branch and a base branch.

Requirements:

- **REQ-012**: The system shall compare the current branch against a base branch and report the product events unique to the current branch.
  - Acceptance criteria:
    - **AC-018**: Given a working branch with product events not contained in the base branch, when the branch-delta helper is run, then it reports the branch-only product events relative to the base branch. `TEST-019`.
    - **AC-019**: Given a base branch that cannot be resolved, when the branch-delta helper is run, then it fails instead of emitting a trusted branch-delta report. `TEST-020`.

- **REQ-013**: The system shall summarize net changed product entities and inferred change categories in the branch-delta report relative to the base branch.
  - Acceptance criteria:
    - **AC-020**: Given branch-only product events affecting capabilities, features, requirements, acceptance criteria, or tests, when the branch-delta helper is run, then it reports changed entities grouped by entity type and change kind based on their net difference from the base branch. `TEST-021`.
    - **AC-021**: Given entities that are added and then further refined only on the working branch, when the branch-delta helper is run, then it reports them as added and infers change categories from the net branch delta rather than intermediate branch-only churn. `TEST-022`.

- **REQ-014**: The system shall report impacted product entities and write standard branch-delta artifacts for the current branch based on the net branch delta.
  - Acceptance criteria:
    - **AC-022**: Given net changed entities in the branch delta, when the branch-delta helper is run, then it reports the impacted capabilities, features, requirements, acceptance criteria, and tests related to those changes. `TEST-023`, `TEST-024`.
    - **AC-023**: Given a working branch and base branch, when the branch-delta helper is run without a custom output path, then it writes branch-delta/branch-delta.yaml and branch-delta/branch-delta.md as gitignored branch-local artifacts, and the markdown presents changed entities in parent context with explicit change labels. `TEST-025`, `TEST-026`.

### FEAT-013 — Derive work packages from branch delta

Derives deterministic implementation work packages from the net branch-delta report.

Requirements:

- **REQ-015**: The system shall derive deterministic work-package proposals from the net branch delta by grouping net changed scope into coherent implementation slices.
  - Acceptance criteria:
    - **AC-024**: Given a net branch delta with changed entities under one feature, when the derive-work-packages helper is run, then it emits a work-package proposal that groups that net changed scope under that feature. `TEST-027`.
    - **AC-025**: Given a net branch delta with changed entities, when the derive-work-packages helper is run, then each derived work package includes its scoped capability, feature, requirement, acceptance-criterion, and test ids together with rationale and dependency information for that net changed scope. `TEST-028`.
