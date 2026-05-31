# Work Package Output Schema

## Purpose

This document proposes the output schema for derived work packages.

It is designed to sit on top of the branch-delta report and remain deterministic, reviewable, and machine-readable.

---

## Top-Level Shape

```yaml
base_branch: main
current_branch: feature/example
product_id: PROD-001
source_branch_delta:
  branch_only_event_count: 4
  change_categories:
    - extend
work_packages: []
```

---

## Proposed YAML Schema

```yaml
base_branch: string
current_branch: string
product_id: string
source_branch_delta:
  branch_only_event_count: number
  change_categories: [string]

work_packages:
  - work_package_id: string
    title: string
    change_summary: [string]
    capability_ids: [string]
    feature_ids: [string]
    requirement_ids: [string]
    acceptance_criterion_ids: [string]
    test_ids: [string]
    depends_on: [string]
    rationale: string
```

---

## Field Notes

### `source_branch_delta`
Provides a small provenance summary so the work-package file can be interpreted without reopening the full delta report.

### `work_package_id`
A report-local stable id such as:

- `WP-001`
- `WP-002`

These do not need to be canonical product ids in the first version.

### `title`
A concise description of the work package, usually centered on the dominant feature or change type.

### `change_summary`
A short list of the main kinds of work involved.

Examples:

- `add feature`
- `refine requirement`
- `move feature`
- `deprecate feature`
- `status transition`

### `depends_on`
References other work-package ids in the same report.

---

## Example

```yaml
base_branch: main
current_branch: feature/branch-delta-entity-reporting
product_id: PROD-001
source_branch_delta:
  branch_only_event_count: 17
  change_categories:
    - extend
    - verify

work_packages:
  - work_package_id: WP-001
    title: Implement FEAT-012 branch delta reporting
    change_summary:
      - add feature
      - add requirements
      - add tests
    capability_ids:
      - CAP-002
    feature_ids:
      - FEAT-012
    requirement_ids:
      - REQ-012
      - REQ-013
      - REQ-014
    acceptance_criterion_ids:
      - AC-018
      - AC-019
      - AC-020
      - AC-021
      - AC-022
      - AC-023
    test_ids:
      - TEST-019
      - TEST-020
      - TEST-021
      - TEST-022
      - TEST-023
      - TEST-024
      - TEST-025
    depends_on: []
    rationale: All changed entities belong to FEAT-012 and form one coherent implementation slice.
```

---

## Extension Points

Later the schema could grow with:

- priority
- risk level
- rollout notes
- expected evidence
- owner suggestions
- readiness status

The first version should remain small and deterministic.
