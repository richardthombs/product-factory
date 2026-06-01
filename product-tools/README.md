# Product Tools

Initial tooling for the event-sourced product model vertical slice.

Related references:

- `docs/product_change_and_delivery_workflow.md`
- `docs/product_evolution_tooling_plan.md`
- `product-tools/IMPLEMENTATION_CHECKLIST.md`

## Commands

From the repository root:

```bash
npm install
npm run validate-events
npm run project-model
npm run reconcile-events -- --base main
npm run rebuild
```

You can also validate or project a different event folder:

```bash
npm run validate-events -- ./product-events
npm run project-model -- ./product-events ./product-model
```

To run the full local workflow:

```bash
npm run rebuild
```

To report the product events unique to the current branch relative to a base branch:

```bash
npm run branch-delta -- --base main
```

To reconcile branch-only events against the latest accepted entity revisions on a base branch:

```bash
npm run reconcile-events -- --base main
```

What the helper does in its current version:

- loads product events from the current working tree
- loads product events from the base branch using Git
- validates both event streams
- derives entity-specific revisions and last accepted entity event ids by deterministic replay
- replays branch-only events against the latest base state
- fails when any branch event precondition no longer matches the relevant entity state on the base branch
- writes gitignored reconciliation artifacts under `branch-delta/` by default

Important concurrency semantics:

- `expected_last_entity_event_id` means the most recent accepted event that affected that specific entity
- it does not mean the most recent event anywhere in the full event stream

To derive deterministic implementation work packages from the current branch delta:

```bash
npm run derive-work-packages -- --base main
```

What the helper does in its current version:

- loads product events from the current working tree
- loads product events from the base branch using Git
- validates both event streams
- reports branch-only product events in YAML by default
- summarizes changed entities by type and change kind
- infers high-level change categories such as `extend`, `refine`, `reshape`, `deprecate`, `verify`, and `readiness`

To create the initial product in an empty event store:

```bash
npm run create-product -- \
  --name "Product Factory" \
  --description "Event-sourced product knowledge system for agent-driven software delivery."
```

To propose a new capability:

```bash
npm run create-capability -- \
  --name "Specify product behaviour" \
  --description "Enables users to define expected product behaviour clearly and testably."
```

To propose a new feature under an existing capability:

```bash
npm run create-feature -- \
  --capability CAP-001 \
  --name "Export requirements to Markdown" \
  --description "Exports structured requirements as Markdown." \
  --requirement-description "The system shall export generated requirements as Markdown." \
  --acceptance-criterion-text "Given a generated requirement set, when the user exports to Markdown, then a Markdown document is returned." \
  --acceptance-criterion-text "Given exported Markdown, when it is opened in a Markdown viewer, then headings and requirement content are preserved."
```

These commands determine the next `PROD-*`, `CAP-*`, `FEAT-*`, `REQ-*`, `AC-*`, and `EVT-*` ids automatically and then rebuild `product-model/`.

To add a requirement with one or more acceptance criteria to an existing feature:

```bash
npm run create-requirement -- \
  --feature FEAT-001 \
  --description "The system shall preserve heading structure when exporting requirements as Markdown." \
  --acceptance-criterion-text "Given an exported Markdown document, when it is opened in a Markdown viewer, then headings are preserved." \
  --acceptance-criterion-text "Given requirement content with lists, when it is exported to Markdown, then list structure is preserved."
```

What the helper does:

- verifies the feature exists
- allocates the next `REQ-*` id
- allocates one new `AC-*` id per `--acceptance-criterion-text`
- writes one `RequirementAdded` event and one `AcceptanceCriterionAdded` event per acceptance criterion
- rebuilds `product-model/`

To change an existing feature description:

```bash
npm run change-feature -- \
  --feature FEAT-001 \
  --description "Reports the net product delta between a working branch and a base branch."
```

What the helper does:

- verifies the feature exists
- allocates the next `EVT-*` id
- writes a `FeatureChanged` event
- rebuilds `product-model/`

To change an existing requirement description:

```bash
npm run change-requirement -- \
  --requirement REQ-001 \
  --description "The system shall preserve heading structure when exporting generated requirements as Markdown."
```

What the helper does:

- verifies the requirement exists
- allocates the next `EVT-*` id
- writes a `RequirementChanged` event
- rebuilds `product-model/`

To change an existing acceptance criterion text:

```bash
npm run change-acceptance-criterion -- \
  --acceptance-criterion AC-001 \
  --text "Given exported Markdown with headings, when it is opened in a Markdown viewer, then the heading structure is preserved."
```

What the helper does:

- verifies the acceptance criterion exists
- allocates the next `EVT-*` id
- writes an `AcceptanceCriterionChanged` event
- rebuilds `product-model/`

To move an existing feature to another capability:

```bash
npm run move-feature -- \
  --feature FEAT-001 \
  --capability CAP-002
```

What the helper does:

- verifies the feature exists
- verifies the target capability exists
- allocates the next `EVT-*` id
- writes a `FeatureMovedToCapability` event
- rebuilds `product-model/`

To deprecate an existing feature:

```bash
npm run deprecate-feature -- \
  --feature FEAT-001 \
  --reason "Replaced by a new workflow."
```

What the helper does:

- verifies the feature exists
- allocates the next `EVT-*` id
- writes a `FeatureDeprecated` event
- rebuilds `product-model/`

To update feature readiness state:

```bash
npm run set-feature-status -- \
  --feature FEAT-001 \
  --status implementation_ready \
  --reason "Specification is complete and ready for delivery."
```

What the helper does:

- verifies the feature exists
- allocates the next `EVT-*` id
- writes a `FeatureStatusChanged` event
- rebuilds `product-model/`

To update capability readiness state:

```bash
npm run set-capability-status -- \
  --capability CAP-001 \
  --status scoped \
  --reason "Capability boundaries and first feature slices are defined."
```

What the helper does:

- verifies the capability exists
- allocates the next `EVT-*` id
- writes a `CapabilityStatusChanged` event
- rebuilds `product-model/`

To create one or more test artifacts for acceptance criteria and annotate the test source:

```bash
npm run create-test -- \
  --acceptance-criterion AC-008 \
  --acceptance-criterion AC-009 \
  --file product-tools/tests/projectModel.test.ts \
  --test-name "projects the current self-described event stream into deterministic YAML files"
```

What the helper does:

- finds the unique test line matching `--test-name`
- inserts or updates a nearby annotation comment in the form `// AC: AC-008, AC-009`
- records one `TestCreated` event per acceptance criterion
- allocates one `TEST-*` id per created test artifact
- stores the simple test model as:
  - `test_id`
  - `acceptance_criterion_id`
  - `file_path`
  - `test_name`
- rebuilds `product-model/`

## Current scope

Implemented event types:

- `ProductCreated`
- `CapabilityAdded`
- `FeatureAdded`
- `RequirementAdded`
- `AcceptanceCriterionAdded`
- `FeatureChanged`
- `RequirementChanged`
- `AcceptanceCriterionChanged`
- `FeatureMovedToCapability`
- `FeatureDeprecated`
- `FeatureStatusChanged`
- `CapabilityStatusChanged`
- `TestCreated`

Implemented checks:

- YAML parses successfully
- schema matches event type
- event IDs are unique
- exactly one `ProductCreated` exists
- references resolve in replay order
- entity IDs are unique within their type
- changed features must already exist
- changed requirements must already exist
- changed acceptance criteria must already exist
- moved features must already exist and reference an existing target capability
- deprecated features must already exist
- feature status changes must reference existing features and valid statuses
- capability status changes must reference existing capabilities and valid statuses
- linked acceptance criteria exist before tests are created
- linked test files resolve
- linked test names resolve uniquely in source
- linked tests are annotated with nearby `// AC: ...` comments
- test ids are unique
- concurrency preconditions reference existing entities in replay order
- `expected_last_entity_event_id`, when present, references a prior event that affected that same entity

Implemented projection output:

- `product-model/product.yaml`
- `product-model/project.md`
- `product-model/capabilities/*.yaml`
- `product-model/features/*.yaml`
- `product-model/requirements/*.yaml`
- `product-model/acceptance-criteria/*.yaml`
- `product-model/tests/*.yaml`
- `product-model/indexes/capability-map.yaml`
- `product-model/indexes/traceability-matrix.yaml`
- `product-model/indexes/tests.yaml`
- `product-model/indexes/readiness.yaml`

Additional reporting commands:

- `npm run branch-delta -- --base main` prints a first-class branch-delta report for the current branch and writes gitignored artifacts under `branch-delta/`
- `npm run reconcile-events -- --base main` checks branch-only events against latest accepted entity revisions on the base branch and writes gitignored artifacts under `branch-delta/`
- `npm run derive-work-packages -- --base main` derives feature-grouped work-package proposals and writes gitignored artifacts under `branch-delta/`
