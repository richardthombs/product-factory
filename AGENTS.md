# AGENTS.md

## Purpose

This repository implements an event-sourced product model.

Agents working in this repo should treat:

- `/product-events` as the canonical historical and write-side source of truth
- `/product-model` as the canonical current-state and read-side view of the product, generated from events
- `/product-tools` as the supported way to validate, project, and propose changes

For understanding the current state of the product, read `product-model/` first.
For changing the product, use the supported CLI commands.

---

## Core Rules

1. **Never manually edit `product-model/` files to express a product change.**
   - They are generated from events.
   - Read them to understand the current product state.
   - If you need to change the model, add event files or use the supported CLI commands.

2. **Prefer the CLI commands over hand-authoring event files when possible.**
   - The commands allocate IDs correctly.
   - The commands rebuild the generated model.
   - The commands reduce formatting and ordering mistakes.

3. **Validate before considering a change complete.**
   - Run `npm run rebuild` after changes.
   - Run `npm test` if you changed tooling.

4. **Keep changes event-sourced and reviewable.**
   - Propose changes by creating new event files.
   - Do not rewrite accepted history.

5. **Use existing capabilities where appropriate.**
   - Before creating a new capability or feature, inspect the current model for overlap or duplication.

---

## Repository Structure

```text
/product-events   Accepted and proposed product events; canonical history and write-side truth
/product-model    Generated YAML projection; canonical current-state read model
/product-tools    Validation, projection, and proposal tooling
/docs             Design and implementation docs
```

Important files:

- `docs/agentic_product_model_markdown.md`
- `docs/event_sourced_product_model_implementation_plan.md`
- `product-tools/README.md`

---

## Supported Commands

Run all commands from the repository root.

### Install

```bash
npm install
```

### Validate current event stream

```bash
npm run validate-events
```

### Project generated YAML from events

```bash
npm run project-model
```

### Validate and regenerate everything

```bash
npm run rebuild
```

This is the default command to run after proposing a change.

### Run tests

```bash
npm test
```

Run this if you changed code under `product-tools/`.

---

## Preferred Change Workflows

## 1. Create the initial product

Use only when the event store is empty.

```bash
npm run create-product -- \
  --name "Product Factory" \
  --description "Event-sourced product knowledge system for agent-driven software delivery."
```

What it does:

- allocates the next `PROD-*` id
- allocates the next `EVT-*` id
- writes a `ProductCreated` event
- rebuilds `product-model/`

Do not use this if product events already exist.

---

## 2. Create a capability

```bash
npm run create-capability -- \
  --name "Specify product behaviour" \
  --description "Enables users to define expected product behaviour clearly and testably."
```

What it does:

- allocates the next `CAP-*` id
- allocates the next `EVT-*` id
- writes a `CapabilityAdded` event
- rebuilds `product-model/`

Before using it:

- inspect existing capabilities in `product-model/capabilities/`
- avoid creating duplicate or overlapping capabilities

---

## 3. Create a feature under an existing capability

```bash
npm run create-feature -- \
  --capability CAP-001 \
  --name "Export requirements to Markdown" \
  --description "Exports structured requirements as Markdown." \
  --requirement-description "The system shall export generated requirements as Markdown." \
  --acceptance-criterion-text "Given a generated requirement set, when the user exports to Markdown, then a Markdown document is returned." \
  --acceptance-criterion-text "Given exported Markdown, when it is opened in a Markdown viewer, then headings and requirement content are preserved."
```

What it does:

- allocates the next `FEAT-*` id
- allocates the next `REQ-*` id
- allocates one new `AC-*` id per `--acceptance-criterion-text`
- allocates the necessary `EVT-*` ids
- writes:
  - `FeatureAdded`
  - `RequirementAdded`
  - one `AcceptanceCriterionAdded` per acceptance criterion text
- rebuilds `product-model/`

Requirements:

- `--capability` must reference an existing capability
- at least one `--acceptance-criterion-text` must be provided

---

## 4. Create a requirement under an existing feature

```bash
npm run create-requirement -- \
  --feature FEAT-001 \
  --description "The system shall preserve heading structure when exporting requirements as Markdown." \
  --acceptance-criterion-text "Given an exported Markdown document, when it is opened in a Markdown viewer, then headings are preserved." \
  --acceptance-criterion-text "Given requirement content with lists, when it is exported to Markdown, then list structure is preserved."
```

What it does:

- verifies the feature exists
- allocates the next `REQ-*` id
- allocates one new `AC-*` id per `--acceptance-criterion-text`
- writes one `RequirementAdded` event and one `AcceptanceCriterionAdded` event per acceptance criterion
- rebuilds `product-model/`

Use this when an existing feature needs more requirements without creating a new feature.

---

## 5. Create a test for one or more acceptance criteria

```bash
npm run create-test -- \
  --acceptance-criterion AC-008 \
  --acceptance-criterion AC-009 \
  --file product-tools/tests/projectModel.test.ts \
  --test-name "projects the current self-described event stream into deterministic YAML files"
```

What it does:

- finds the unique test line matching `--test-name`
- inserts or updates a nearby annotation comment such as `// AC: AC-008, AC-009`
- writes one `TestCreated` event per acceptance criterion
- allocates one `TEST-*` id per created test artifact
- records the test using:
  - `test_id`
  - `acceptance_criterion_id`
  - `file_path`
  - `test_name`
- rebuilds `product-model/`

Use this command instead of manually editing test annotations or hand-authoring test events.

---

## Agent Workflow Expectations

When asked to create or change product structure, follow this sequence.

### Step 1: Inspect current state

Read the generated model first:

- `product-model/project.md`
- `product-model/product.yaml`
- `product-model/indexes/capability-map.yaml`
- `product-model/indexes/traceability-matrix.yaml`
- relevant files under:
  - `product-model/capabilities/`
  - `product-model/features/`
  - `product-model/requirements/`

Goal:

- understand existing structure
- avoid duplicates
- choose the correct parent capability

### Step 2: Prefer a supported command

Use:

- `create-product`
- `create-capability`
- `create-feature`
- `create-requirement`
- `create-test`

Prefer these over manual event authoring.

### Step 3: Rebuild

After any change:

```bash
npm run rebuild
```

### Step 4: Verify result

Inspect:

- `product-model/product.yaml`
- changed generated entity files
- `product-model/indexes/traceability-matrix.yaml`

Make sure the projected model matches the intended change.

### Step 5: If tooling changed, run tests

```bash
npm test
```

---

## When Manual Event Authoring Is Acceptable

Manual event file creation is acceptable only when:

- no CLI command exists for the required event type
- you are extending the event model itself
- you are adding test fixtures

If you manually author event files:

1. follow the existing event envelope shape
2. keep one event per file
3. place files under `/product-events/YYYY/MM/DD/`
4. use deterministic, reviewable names
5. run `npm run rebuild`
6. run `npm test` if tooling changed

Do **not** manually edit generated YAML to reflect the change.

---

## What an Agent Should Not Do

Do not:

- edit `/product-model` directly to express a product change
- invent IDs when a command can allocate them
- create a new capability without checking for an existing suitable one
- leave the repo in a state where `npm run rebuild` fails
- change tooling without running tests
- treat a proposed branch change as accepted product state

---

## Current Event Types in Scope

The current vertical slice supports:

- `ProductCreated`
- `CapabilityAdded`
- `FeatureAdded`
- `RequirementAdded`
- `AcceptanceCriterionAdded`
- `TestCreated`

The current model depth is:

```text
Product -> Capability -> Feature -> Requirement -> Acceptance Criterion -> Test
```

Tests are first-class product artifacts with a simple locator model:

- `test_id`
- `acceptance_criterion_id`
- `file_path`
- `test_name`

When creating tests for acceptance criteria, use `create-test` so the source file is also annotated with a nearby comment like:

```ts
// AC: AC-008, AC-009
it("example test", async () => {
  // ...
});
```

Do not assume rename, deprecation, deployment, release, or incident events exist unless you add them explicitly.

---

## Quick Decision Guide

### If asked to create the first product in an empty repo
Use `create-product`.

### If asked to add a new stable area of value
Inspect existing capabilities, then use `create-capability` if needed.

### If asked to add a new user-facing or implementation slice under a capability
Use `create-feature`.

### If asked to add more requirements to an existing feature
Use `create-requirement`.

### If asked to create test coverage for an acceptance criterion
Use `create-test` so the test file is annotated and the test artifact event is recorded consistently.

### If asked to update generated YAML directly
Do not do that. Add or modify events instead.

### If asked to make a change and no command exists yet
Add the event(s) manually or extend `product-tools`, then rebuild and test.

---

## Minimum Definition of Done for Agent Changes

A product-model change is not done until:

1. the event files exist
2. `npm run rebuild` passes
3. generated output reflects the intended change
4. `npm test` passes if tooling was modified
5. the agent can explain what changed and why
