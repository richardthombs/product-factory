# Product Tools

Initial tooling for the event-sourced product model vertical slice.

## Commands

From the repository root:

```bash
npm install
npm run validate-events
npm run project-model
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
- `TestCreated`

Implemented checks:

- YAML parses successfully
- schema matches event type
- event IDs are unique
- exactly one `ProductCreated` exists
- references resolve in replay order
- entity IDs are unique within their type
- linked acceptance criteria exist before tests are created
- linked test files resolve
- linked test names resolve uniquely in source
- linked tests are annotated with nearby `// AC: ...` comments
- test ids are unique

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
