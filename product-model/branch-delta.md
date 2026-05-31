<!-- Generated from /product-events. -->
<!-- Do not edit directly. -->
<!-- To change this file, add or modify product events. -->
# feature/branch-delta-entity-reporting — Branch Delta

Proposed product delta relative to `main`.

# Summary

- Product ID: PROD-001
- Base branch: main
- Current branch: feature/branch-delta-entity-reporting
- Base events: 60
- Current events: 80
- Branch-only events: 20
- Change categories: additions, refinements, verification coverage

# Proposed Changes

## CAP-002 — Validate and project product model

Enables users to validate product events and regenerate the current-state product model.

### FEAT-012 — Report branch delta (added)

Reports product events unique to a working branch relative to a base branch.

Requirements:

- **REQ-012** *(added)*: The system shall compare the current branch against a base branch and report the product events unique to the current branch.
  - Acceptance criteria:
    - **AC-018** *(added)*: Given a working branch with product events not contained in the base branch, when the branch-delta helper is run, then it reports the branch-only product events relative to the base branch. `TEST-019`.
    - **AC-019** *(added)*: Given a base branch that cannot be resolved, when the branch-delta helper is run, then it fails instead of emitting a trusted branch-delta report. `TEST-020`.

- **REQ-013** *(added)*: The system shall summarize changed product entities and inferred change categories in the branch-delta report.
  - Acceptance criteria:
    - **AC-020** *(added)*: Given branch-only product events affecting capabilities, features, requirements, acceptance criteria, or tests, when the branch-delta helper is run, then it reports the changed entities grouped by entity type and change kind. `TEST-021`.
    - **AC-021** *(added)*: Given branch-only product events spanning additive, refinement, reshaping, deprecation, verification, or readiness changes, when the branch-delta helper is run, then it reports the inferred change categories present in the branch delta. `TEST-022`.

- **REQ-014** *(added; changed)*: The system shall report impacted product entities and write standard branch-delta artifacts for the current branch in machine-readable YAML and human-readable contextual Markdown.
  - Acceptance criteria:
    - **AC-022** *(added)*: Given changed entities in the branch delta, when the branch-delta helper is run, then it reports the impacted capabilities, features, requirements, acceptance criteria, and tests related to those changes. `TEST-023`, `TEST-024`.
    - **AC-023** *(added; changed)*: Given a working branch and base branch, when the branch-delta helper is run without a custom output path, then it writes product-model/indexes/branch-delta.yaml and product-model/branch-delta.md as generated artifacts, and the markdown presents changed entities in parent context with explicit change labels. `TEST-025`, `TEST-026`.
