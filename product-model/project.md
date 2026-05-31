<!-- Generated from /product-events. -->
<!-- Do not edit directly. -->
<!-- To change this file, add or modify product events. -->
# Product Factory

Event-sourced product knowledge system for agent-driven software delivery.

# Summary

- Product ID: PROD-001
- Capabilities: 2
- Features: 7
- Requirements: 7
- Acceptance Criteria: 9
- Tests: 9
- Projected from events: 35
- Last event: EVT-20260531-0035 @ 2026-05-31T09:56:00.000Z

# Capabilities

## CAP-001 — Manage product model structure

Enables users to define and extend the core structure of the product model.

### FEAT-001 — Create initial product

Creates the first product record in an empty event store.

Requirements:

- **REQ-001**: The system shall create an initial product record when the event store is empty.
  - Acceptance criteria:
    - **AC-001**: Given an empty event store, when the create-product command is run, then a ProductCreated event is written and the product model is rebuilt.
      - Tests:
        - TEST-001: product-tools/tests/createProduct.test.ts:16 — creates the initial product in an empty event store and rebuilds the model

### FEAT-002 — Create capability

Adds a new capability to an existing product model.

Requirements:

- **REQ-002**: The system shall create a capability under an existing product model.
  - Acceptance criteria:
    - **AC-002**: Given an existing product model, when the create-capability command is run, then a CapabilityAdded event is written and the product model is rebuilt.
      - Tests:
        - TEST-002: product-tools/tests/createCapability.test.ts:17 — allocates the next capability id and rebuilds the model

### FEAT-003 — Create feature with requirements and acceptance criteria

Adds a feature, requirement, and one or more acceptance criteria under an existing capability.

Requirements:

- **REQ-003**: The system shall create a feature, a linked requirement, and one or more linked acceptance criteria for an existing capability.
  - Acceptance criteria:
    - **AC-003**: Given an existing capability, when the create-feature command is run with one acceptance criterion, then the system writes FeatureAdded, RequirementAdded, and AcceptanceCriterionAdded events and rebuilds the model.
      - Tests:
        - TEST-003: product-tools/tests/createFeature.test.ts:18 — allocates ids automatically and creates multiple acceptance criteria
    - **AC-004**: Given an existing capability, when the create-feature command is run with multiple acceptance criterion texts, then the system creates one acceptance criterion event for each text.
      - Tests:
        - TEST-004: product-tools/tests/createFeature.test.ts:18 — allocates ids automatically and creates multiple acceptance criteria

## CAP-002 — Validate and project product model

Enables users to validate product events and regenerate the current-state product model.

### FEAT-004 — Validate product events

Validates the product event stream against schemas and repository rules.

Requirements:

- **REQ-004**: The system shall validate product event files against schemas and repository-level consistency rules.
  - Acceptance criteria:
    - **AC-005**: Given a set of product event files, when validate-events is run, then the system reports schema or reference errors and succeeds only when the event stream is valid.
      - Tests:
        - TEST-005: product-tools/tests/validateEvents.test.ts:7 — validates the current self-described event stream

### FEAT-005 — Project current-state product model

Projects accepted product events into generated YAML that represents the current product state.

Requirements:

- **REQ-005**: The system shall deterministically project accepted product events into generated YAML documentation of current state.
  - Acceptance criteria:
    - **AC-006**: Given a valid event stream, when project-model is run, then the system generates deterministic YAML files for the product, capabilities, features, requirements, acceptance criteria, and indexes.
      - Tests:
        - TEST-006: product-tools/tests/projectModel.test.ts:15 — projects the current self-described event stream into deterministic YAML files
        - TEST-008: product-tools/tests/projectModel.test.ts:88 — produces identical output across repeated rebuilds

### FEAT-006 — Rebuild product model

Validates events and regenerates the product model in one command.

Requirements:

- **REQ-006**: The system shall provide a rebuild command that validates events and regenerates the product model.
  - Acceptance criteria:
    - **AC-007**: Given a valid event stream, when rebuild is run, then the system validates events and regenerates the product model successfully.

### FEAT-007 — Create tests for acceptance criteria

Creates test artifacts for acceptance criteria using filename, line number, and test name, and annotates tests with AC ids.

Requirements:

- **REQ-007**: The system shall provide a create-test helper that annotates tests with acceptance criterion ids and records test artifacts with test id, file path, line number, and test name.
  - Acceptance criteria:
    - **AC-008**: Given one or more acceptance criterion ids, a test file, and a test name, when the create-test helper is run, then the test is annotated with the acceptance criterion ids and one TestCreated event is recorded for each id.
      - Tests:
        - TEST-009: product-tools/tests/createTest.test.ts:19 — annotates a test and records created test artifacts
    - **AC-009**: Given created tests and acceptance criteria, when project-model is run, then the generated model includes test ids under the relevant acceptance criteria and projects each test artifact with file path, line number, and test name.
      - Tests:
        - TEST-007: product-tools/tests/projectModel.test.ts:15 — projects the current self-described event stream into deterministic YAML files
