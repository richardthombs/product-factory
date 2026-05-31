# Branch Delta Output Schema

## Purpose

This document proposes the output schema for the dedicated `branch-delta` tool.

The schema is designed to be:

- machine-readable
- Git-reviewable
- useful to humans
- suitable as input to later impacted-graph and work-package tools

---

## Top-Level Structure

Recommended top-level shape:

```yaml
base_branch: main
current_branch: feature/example
product_id: PROD-001
events_root: product-events
summary: {}
branch_only_events: []
changed_entities: {}
impacted_entities: {}
change_categories: []
```

---

## Proposed YAML Schema

```yaml
base_branch: string
current_branch: string
product_id: string
base_event_count: number
current_event_count: number
branch_only_event_count: number
events_root: string

summary:
  capabilities_added: number
  capabilities_changed: number
  capabilities_status_changed: number
  features_added: number
  features_changed: number
  features_moved: number
  features_deprecated: number
  features_status_changed: number
  requirements_added: number
  requirements_changed: number
  acceptance_criteria_added: number
  acceptance_criteria_changed: number
  tests_added: number

change_categories:
  - extend
  - refine
  - reshape
  - deprecate
  - verify
  - readiness

branch_only_events:
  - event_id: string
    event_type: string
    file_path: string
    occurred_at: string
    entity_refs:
      capability_ids: [string]
      feature_ids: [string]
      requirement_ids: [string]
      acceptance_criterion_ids: [string]
      test_ids: [string]

changed_entities:
  capabilities:
    added:
      - capability_id: string
    status_changed:
      - capability_id: string
        status: string
  features:
    added:
      - feature_id: string
    changed: []
    moved:
      - feature_id: string
        from_capability_id: string
        to_capability_id: string
    deprecated:
      - feature_id: string
        reason: string
    status_changed:
      - feature_id: string
        status: string
  requirements:
    added:
      - requirement_id: string
    changed:
      - requirement_id: string
  acceptance_criteria:
    added:
      - acceptance_criterion_id: string
    changed:
      - acceptance_criterion_id: string
  tests:
    added:
      - test_id: string

impacted_entities:
  capability_ids: [string]
  feature_ids: [string]
  requirement_ids: [string]
  acceptance_criterion_ids: [string]
  test_ids: [string]
```

---

## Field Notes

## `base_branch`
The branch used as the accepted baseline, usually `main`.

## `current_branch`
The branch or HEAD context being analysed.

## `product_id`
The product id after replaying the current branch state.

## `base_event_count` / `current_event_count`
Useful sanity check counts.

## `branch_only_event_count`
The size of the proposed product delta.

---

## `summary`

This should provide quick counts for both humans and automation.

Example:

```yaml
summary:
  capabilities_added: 0
  capabilities_changed: 0
  capabilities_status_changed: 1
  features_added: 2
  features_changed: 0
  features_moved: 1
  features_deprecated: 1
  features_status_changed: 2
  requirements_added: 2
  requirements_changed: 1
  acceptance_criteria_added: 4
  acceptance_criteria_changed: 1
  tests_added: 3
```

---

## `change_categories`

This should contain a deduplicated list inferred from branch-only events.

Examples:

- `extend`
- `refine`
- `reshape`
- `deprecate`
- `verify`
- `readiness`

Suggested mapping:

- `CapabilityAdded`, `FeatureAdded`, `RequirementAdded`, `AcceptanceCriterionAdded`, `TestCreated` -> `extend` or `verify`
- `RequirementChanged`, `AcceptanceCriterionChanged` -> `refine`
- `FeatureMovedToCapability` -> `reshape`
- `FeatureDeprecated` -> `deprecate`
- `FeatureStatusChanged`, `CapabilityStatusChanged` -> `readiness`

---

## `branch_only_events`

This is the canonical event-level delta.

Each entry should include:

- id
- type
- file path
- occurred_at
- quick entity refs

This lets downstream tools avoid re-parsing event payloads repeatedly.

---

## `changed_entities`

This is the most important section for planning and implementation.

It should be grouped by entity type and change kind.

### Example

```yaml
changed_entities:
  features:
    added:
      - feature_id: FEAT-011
    moved:
      - feature_id: FEAT-004
        from_capability_id: CAP-002
        to_capability_id: CAP-001
    deprecated:
      - feature_id: FEAT-003
        reason: Replaced by FEAT-011.
    status_changed:
      - feature_id: FEAT-011
        status: implementation_ready
```

This section is what an implementation planner will primarily consume.

---

## `impacted_entities`

This is optional in the first version, but recommended.

Purpose:

- collect both directly changed and indirectly related entities
- make it easier to derive work packages later

At minimum, it may just be a deduplicated set of ids.

Later it could become a richer graph structure.

---

## Minimal First-Version Schema

If the full schema feels too large for v1, start with this smaller version:

```yaml
base_branch: main
current_branch: feature/example
product_id: PROD-001
branch_only_event_count: 4
change_categories:
  - extend
  - refine
branch_only_events:
  - event_id: EVT-...
    event_type: RequirementChanged
    file_path: product-events/...
changed_entities:
  capabilities:
    added: []
    status_changed: []
  features:
    added: []
    moved: []
    deprecated: []
    status_changed: []
  requirements:
    added: []
    changed:
      - requirement_id: REQ-010
  acceptance_criteria:
    added: []
    changed:
      - acceptance_criterion_id: AC-022
  tests:
    added: []
```

This would still be enough to drive a first useful branch-delta report.

---

## Recommended Future Extension Points

Later the schema could grow to include:

- work package suggestions
- dependency ordering
- implementation evidence links
- direct PR metadata
- status transition details with before/after values
- base-vs-current entity snapshots

But the first version should stay focused on event and entity delta reporting.
