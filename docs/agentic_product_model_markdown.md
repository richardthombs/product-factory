# Agentic Product Model

## Purpose

This document captures a holistic product model for a suite of agents that help specify, build, test, release, operate, and evolve software products.

The product should not be treated as a one-time workflow for producing a v1 release. It should be treated as a **living product knowledge system** that maintains a coherent definition of the product over time.

```text
Build process → Product knowledge system
```

The agents should help produce an initial product version, but more importantly, they should help maintain and evolve the product as requirements change, implementation evidence accumulates, tests are added, and operational feedback emerges.

---

## Core Product Concept

The product is a set of capabilities and features that must remain clearly defined as the product evolves.

A useful hierarchy is:

```text
Product
  Capability
    Feature
      Behaviour
        Requirement
          Acceptance Criterion
```

In this model, **capability is above feature**.

Capabilities describe enduring areas of product value. Features are more specific expressions of those capabilities and are more likely to change over time.

---

## Capability vs Feature

## Capability

A **capability** is something the product enables a user, team, or system to do.

Examples:

```text
Manage incidents
Define product requirements
Run automated tests
Monitor production health
Generate release notes
Maintain product knowledge
Detect requirement drift
```

Capabilities are relatively stable. They describe areas of value that may survive multiple iterations, redesigns, or implementation changes.

### Capability Example

```yaml
id: CAP-001
name: Specify product behaviour
description: Enables users to define expected product behaviour clearly and testably.
status: active
parent_capability: null
features:
  - FEAT-001
  - FEAT-002
success_measures:
  - Requirements are testable
  - Acceptance criteria are generated consistently
  - Behaviour gaps are detected before implementation
```

---

## Feature

A **feature** is a specific implementation or user-facing slice of a capability.

Examples under the capability `Manage incidents`:

```text
Create incident
Assign incident owner
Post incident updates to Slack
Generate post-incident review
Track remediation actions
```

Features are more volatile than capabilities. They may be added, removed, split, merged, redesigned, or replaced while the underlying capability remains valid.

### Feature Example

```yaml
id: FEAT-001
capability_id: CAP-001
name: Generate requirements from product idea
description: Converts a raw product idea into structured requirements.
status: active
version: 1.2
requirements:
  - REQ-001
  - REQ-002
dependencies:
  - CAP-002
```

---

## Behaviour

A **behaviour** describes what a feature actually does under specific conditions.

Example:

```text
When an incident is marked as SEV-1, the system posts an alert to the configured Slack channel and creates a timeline entry.
```

Behaviours are useful because they bridge the gap between product intent and testable implementation.

---

## Requirement

A **requirement** is a formal statement of expected behaviour, constraint, or quality.

Example:

```text
The system shall create a timeline entry whenever the incident severity changes.
```

### Requirement Example

```yaml
id: REQ-001
feature_id: FEAT-001
type: functional
description: The system shall produce functional requirements from a raw product idea.
acceptance_criteria:
  - AC-001
  - AC-002
status: approved
traceability:
  tests:
    - TEST-001
  implementation:
    - src/ProductSpec/RequirementGenerator.cs
```

---

## Acceptance Criterion

An **acceptance criterion** defines how to determine whether a requirement has been satisfied.

Example:

```gherkin
Given an incident with severity SEV-2
When the severity is changed to SEV-1
Then a timeline entry is created showing the previous severity, new severity, actor, and timestamp
```

Acceptance criteria should be clear, testable, and traceable to requirements and tests.

---

## Why Capability Should Sit Above Feature

Capabilities are better anchors because they survive product evolution.

A feature may change significantly while the underlying capability remains stable.

Example:

```text
Capability: Understand product scope

Feature v1:
  Generate product brief from free text

Feature v2:
  Maintain versioned product capability map

Feature v3:
  Detect requirement drift across iterations

Feature v4:
  Compare implemented behaviour against intended capability
```

The features evolve, but the capability remains coherent.

---

## Product Knowledge Hierarchy

A fuller hierarchy for the product knowledge system could look like this:

```text
Product
  ├─ Vision
  ├─ Goals
  ├─ Principles
  ├─ Personas
  ├─ Capabilities
  │   ├─ Features
  │   │   ├─ Behaviours
  │   │   ├─ Requirements
  │   │   ├─ Acceptance Criteria
  │   │   ├─ UX Notes
  │   │   ├─ Domain Rules
  │   │   ├─ Dependencies
  │   │   ├─ Telemetry
  │   │   └─ Operational Concerns
  │   └─ Capability Health
  ├─ Architecture
  ├─ Backlog
  ├─ Tests
  ├─ Releases
  ├─ Incidents
  └─ Decisions
```

This gives the agents a durable model to maintain, rather than a loose set of disconnected artefacts.

---

## Product State

The agent suite should maintain product state, not just execute workflows.

Each iteration should update the canonical model:

```text
Current product definition
  + proposed change
  + implementation evidence
  + test evidence
  + operational evidence
  = revised product definition
```

Without persistent product state, each agent run becomes isolated and the suite loses product coherence over time.

---

## Core Artefacts

The following artefacts should be first-class objects in the product knowledge system.

| Artefact | Purpose |
|---|---|
| **Product Model** | The current canonical definition of the product |
| **Capability Map** | Stable map of what the product enables |
| **Feature Catalogue** | Specific features grouped by capability |
| **Requirement Set** | Formal expected behaviours and constraints |
| **Behaviour Catalogue** | Given/when/then-style behavioural definitions |
| **Decision Log** | Why product and technical choices were made |
| **Change Proposal** | Any proposed product evolution |
| **Impact Analysis** | What a change affects |
| **Implementation Record** | What was actually built |
| **Verification Record** | What was tested and proven |
| **Operational Record** | What happened in production |
| **Product Delta** | The difference between two product states |

---

## Iteration Model

The lifecycle should not be:

```text
Specify → Build → Test → Operate → Done
```

It should be:

```text
Specify → Build → Test → Operate → Learn → Respecify
```

More explicitly:

```text
Current Product Model
  → Change Proposal
  → Impact Analysis
  → Updated Specification
  → Design Delta
  → Implementation
  → Verification
  → Release
  → Operational Learning
  → Product Model Update
```

This creates a closed loop.

---

## Product Model Steward

The central agent should probably be a **Product Model Steward**.

Its role is not to create a single deliverable. Its role is to protect product coherence over time.

### Purpose

```text
Maintain the canonical product definition across iterations.
```

### Responsibilities

```text
- Maintain the capability hierarchy
- Track feature definitions
- Detect duplicated or overlapping capabilities
- Detect stale requirements
- Track requirement-to-test coverage
- Track feature-to-implementation coverage
- Track operational feedback against product intent
- Manage product deltas between versions
- Ensure agents update the product model, not just produce isolated artefacts
```

The Product Model Steward acts as the product-memory governor for the agent suite.

---

## Revised Agent Suite

| Agent | Role |
|---|---|
| **Product Model Steward** | Owns and maintains the canonical product model |
| **Capability Modeller** | Defines and refines capabilities |
| **Feature Specifier** | Defines features within capabilities |
| **Requirement Analyst** | Converts features into requirements |
| **Behaviour Specifier** | Defines executable behaviours and scenarios |
| **Impact Analyst** | Assesses effects of proposed changes |
| **Backlog Planner** | Converts accepted changes into work items |
| **Architect** | Maps product intent to system design |
| **Implementation Agent** | Builds the change |
| **Code Reviewer** | Reviews implementation against product, architecture, and quality expectations |
| **Test Agent** | Verifies the change against behaviours and requirements |
| **Security Reviewer** | Threat-models the product and reviews security-sensitive changes |
| **Release Agent** | Packages and explains the change |
| **Operations Agent** | Captures runtime evidence and production issues |
| **Learning Agent** | Feeds incidents, metrics, and feedback back into product evolution |
| **Documentation Agent** | Maintains internal and external documentation |
| **Governance Agent** | Tracks decisions, standards, technical debt, and architectural compliance |

---

## Agent Contracts

An agent contract is not a legal contract. It is an **agent interface contract**: a structured agreement about how an agent behaves inside the system.

It defines:

| Contract part | Meaning |
|---|---|
| **Purpose** | What the agent is responsible for |
| **Inputs** | What information it requires |
| **Outputs** | What artefacts it must produce |
| **Quality bar** | What “good enough” means |
| **Constraints** | What it must not do |
| **Handoff targets** | Which agents can consume its output |
| **Failure modes** | What it should do when inputs are missing or ambiguous |

### Who the Contract Is Between

Primarily:

```text
Agent Orchestrator ↔ Individual Agent
```

Secondarily:

```text
Upstream Agent ↔ Current Agent ↔ Downstream Agent
```

Also:

```text
Human/User ↔ Agent Suite
```

---

## Example Agent Contract

```yaml
agent: Product Spec Agent
purpose: Convert a product idea into a buildable product specification.

inputs:
  - raw_product_idea
  - known_constraints
  - target_users
  - business_goals

outputs:
  - product_brief
  - functional_requirements
  - non_functional_requirements
  - assumptions
  - open_questions
  - acceptance_criteria

quality_bar:
  - requirements are testable
  - assumptions are explicit
  - scope boundaries are clear
  - open questions are prioritised
  - no implementation details unless required

constraints:
  - do not invent business goals without marking them as assumptions
  - do not silently resolve major ambiguity
  - do not start writing implementation code
  - do not skip acceptance criteria

handoff_to:
  - Domain Modeller
  - Solution Architect
  - Backlog Planner

failure_behaviour:
  missing_required_input:
    action: produce_partial_spec
    include:
      - assumptions
      - open_questions
      - blocked_sections
```

---

## How Agent Contracts Manifest to an LLM

An LLM does not intrinsically enforce a contract. The contract is compiled into the agent runtime through prompt context, schemas, tool permissions, validation, and orchestration.

The contract usually manifests as:

```text
1. Prompt instructions
2. Input schema
3. Output schema
4. Validation and evaluation rules
```

A stronger version adds:

```text
5. Tool permissions
6. Handoff protocol
7. Retry and repair behaviour
8. Audit logging
```

---

## Prompt Instructions

The contract becomes part of the agent’s instruction stack.

Example:

```text
You are the Product Spec Agent.

Purpose:
Convert raw product ideas into buildable product specifications.

You must produce:
- product brief
- functional requirements
- non-functional requirements
- assumptions
- open questions
- acceptance criteria

You must not:
- write implementation code
- invent business goals without marking them as assumptions
- skip acceptance criteria
- silently resolve major ambiguity
```

---

## Input Envelope

Instead of passing arbitrary prose, the orchestrator gives the LLM a structured input payload.

```json
{
  "agent": "product_spec_agent",
  "task": "create_product_spec",
  "inputs": {
    "raw_product_idea": "A lightweight incident tracking tool for small engineering teams",
    "target_users": ["engineering managers", "on-call engineers"],
    "business_goals": ["reduce incident follow-up time"],
    "known_constraints": ["must integrate with Slack"]
  },
  "available_artifacts": {
    "previous_specs": [],
    "domain_glossary": null
  }
}
```

---

## Output Schema

The strongest practical manifestation is a required output schema.

```json
{
  "product_brief": {
    "summary": "string",
    "goals": ["string"],
    "non_goals": ["string"]
  },
  "functional_requirements": [
    {
      "id": "REQ-001",
      "description": "string",
      "acceptance_criteria": ["string"],
      "priority": "must | should | could"
    }
  ],
  "non_functional_requirements": [
    {
      "id": "NFR-001",
      "category": "performance | security | usability | reliability | operability",
      "description": "string",
      "acceptance_criteria": ["string"]
    }
  ],
  "assumptions": ["string"],
  "open_questions": [
    {
      "question": "string",
      "impact": "low | medium | high",
      "blocks_progress": true
    }
  ]
}
```

---

## Runtime Validation

After the LLM responds, the orchestrator validates the output.

Example checks:

```text
Is valid JSON?
Does it match schema?
Are required fields present?
Are requirement IDs unique?
Does every requirement have acceptance criteria?
Did the agent produce implementation code when it was forbidden?
Are open questions marked with impact?
```

If validation fails, the orchestrator can call the same agent again with a repair prompt:

```text
Your previous output failed validation.

Errors:
- functional_requirements[2].acceptance_criteria is missing
- open_questions[0].impact must be one of low, medium, high

Return a corrected response using the required schema only.
```

---

## Handoff Payloads

The output from one agent becomes the input to the next.

```text
Product Spec Agent
  produces RequirementSet

Architecture Agent
  consumes RequirementSet
  produces ArchitecturePlan
```

Example handoff:

```json
{
  "from_agent": "product_spec_agent",
  "to_agent": "architecture_agent",
  "artifact_type": "RequirementSet",
  "artifact_version": "1.0",
  "artifact": {
    "functional_requirements": [],
    "non_functional_requirements": [],
    "assumptions": [],
    "open_questions": []
  }
}
```

The contract exists as the formal shape and expectations of these payloads.

---

## Tool Access and Permissions

The contract also manifests as the tools an agent is allowed to use.

| Agent | Allowed tools |
|---|---|
| Product Spec Agent | Document search, requirements templates |
| Architecture Agent | Repository read access, diagram generator |
| Implementation Agent | Repository read/write, test runner |
| Review Agent | Repository diff, static analysis, dependency scanner |
| Ops Agent | Logs, metrics, runbook store |

A Product Spec Agent should not have write access to the repository. An Implementation Agent should not be able to approve its own work.

---

## Evaluation Rules

The contract can also be encoded as automated checks.

Example Product Spec Agent checks:

```yaml
checks:
  - every_functional_requirement_has_acceptance_criteria
  - every_assumption_is_explicit
  - no_code_blocks_in_output
  - at_least_one_non_goal_present
  - open_questions_prioritised
```

These checks make the contract enforceable outside the LLM.

---

## Change Proposal

Every meaningful product evolution should start as a change proposal.

```yaml
id: CHG-001
title: Add support for non-functional requirement generation
source: user_request
affected_capabilities:
  - CAP-001
affected_features:
  - FEAT-001
rationale: Users need operability, security, and performance requirements captured earlier.
decision_status: proposed
impact_analysis: pending
```

A change proposal should not immediately mutate the product model. It should first be assessed for impact.

---

## Product Deltas

Product state should be versioned. Each iteration should produce a new product model version.

```text
Product Model v0.1
Product Model v0.2
Product Model v1.0
Product Model v1.1
```

Each version should have a delta:

```yaml
from_version: 1.0
to_version: 1.1
added_capabilities: []
changed_capabilities: []
added_features:
  - FEAT-014
changed_features:
  - FEAT-003
deprecated_features: []
removed_features: []
changed_requirements:
  - REQ-044
new_risks:
  - RISK-008
```

---

## Traceability

For iteration to work, every feature and capability needs traceability.

```text
Capability
  → Feature
    → Requirement
      → Acceptance Criterion
        → Test
          → Implementation
            → Release
              → Telemetry / Incident / Feedback
```

Traceability allows the agents to answer questions such as:

```text
What changed between v1 and v2?
Which features are under-specified?
Which requirements have no tests?
Which capabilities are implemented but not documented?
Which production incidents indicate a product gap?
Which behaviours are no longer true?
```

---

## Product Evolution Modes

The product is never truly done. The agent system should support multiple evolution modes.

| Mode | Purpose |
|---|---|
| **Create** | Define a new product or capability |
| **Extend** | Add a new capability or feature |
| **Refine** | Improve an existing definition |
| **Split** | Break an overloaded feature or capability apart |
| **Merge** | Consolidate duplicates |
| **Deprecate** | Retire a feature or behaviour |
| **Verify** | Check implemented behaviour against definition |
| **Audit** | Find drift, gaps, stale assumptions, and weak traceability |
| **Operate** | Monitor and learn from real usage |

---

## Deployment Model

The deployment model should be considered part of the product definition because it directly affects architecture, testing, release strategy, operations, security, cost, and user experience.

Deployment should not be treated as an implementation detail discovered late in the lifecycle. It should be modelled alongside capabilities, features, behaviours, and requirements.

```text
Product Capability
  → Feature
    → Behaviour
      → Requirement
        → Deployment Concern
          → Operational Evidence
```

A feature is not fully specified until its deployment and operational implications are understood.

---

## Deployment as a First-Class Product Concern

The deployment model answers questions such as:

```text
Where does this product run?
Who owns the runtime?
How is it updated?
How is it configured?
How is it monitored?
How are failures isolated?
How are tenants separated?
How is data stored, moved, backed up, and deleted?
How does the deployment model affect cost, security, compliance, and support?
```

The deployment model should influence requirements and architecture early, rather than being bolted on during release.

---

## Deployment Model Options

A product may support one or more deployment models.

| Deployment Model | Description | Implications |
|---|---|---|
| **Single-tenant SaaS** | Each customer has an isolated deployment | Strong isolation, higher operational cost, easier customisation |
| **Multi-tenant SaaS** | Multiple customers share the same runtime | Lower cost, harder isolation, stronger need for tenancy controls |
| **Self-hosted** | Customer deploys into their own environment | More customer control, harder support and upgrade management |
| **Private cloud** | Dedicated deployment in a managed cloud account or environment | Useful for enterprise customers with stronger compliance needs |
| **On-premise** | Runs inside customer infrastructure | Highest operational complexity, often required for regulated environments |
| **Hybrid** | Some services are SaaS, others run near customer systems | Useful where data locality, latency, or integration constraints matter |
| **Edge deployment** | Components run close to devices, users, or data sources | Useful for latency, resilience, and offline operation |
| **Local developer/runtime mode** | Product can run locally for development, testing, or evaluation | Important for adoption, debugging, and agent-driven development loops |

The product model should record which deployment models are supported, planned, deprecated, or explicitly out of scope.

---

## Deployment Model Artefact

The deployment model should be represented as a first-class artefact.

```yaml
id: DEPLOY-001
name: Multi-tenant SaaS deployment
status: proposed
supported_environments:
  - development
  - test
  - staging
  - production
runtime_ownership: product_team
tenancy_model: multi_tenant
release_strategy:
  - continuous_delivery
  - progressive_rollout
  - feature_flags
operational_requirements:
  - centralised_logging
  - metrics
  - distributed_tracing
  - alerting
  - backup_and_restore
security_requirements:
  - tenant_isolation
  - secrets_management
  - least_privilege_access
  - audit_logging
data_requirements:
  - data_residency_policy
  - retention_policy
  - deletion_policy
  - migration_strategy
constraints:
  - must support zero-downtime deployment
  - must support rollback of application changes
  - database migrations must be backward compatible
```

---

## Deployment Traceability

Deployment choices should be traceable back to product intent.

```text
Capability
  → Feature
    → Requirement
      → Architecture Decision
        → Deployment Model
          → Release Strategy
            → Operational Control
              → Runtime Evidence
```

This allows the agent suite to answer questions such as:

```text
Which capabilities require tenant isolation?
Which features require feature flags?
Which behaviours depend on background workers?
Which requirements are affected by regional deployment?
Which releases changed infrastructure?
Which production incidents were caused by deployment assumptions?
Which features are unavailable in self-hosted mode?
```

---

## Deployment-Aware Requirements

Some requirements should explicitly capture deployment implications.

Examples:

```yaml
id: NFR-DEPLOY-001
type: deployability
description: The system shall support zero-downtime deployment for production application changes.
acceptance_criteria:
  - Existing user sessions remain valid during deployment
  - In-flight requests are allowed to complete
  - New instances pass health checks before receiving traffic
  - Failed deployments are automatically removed from service
```

```yaml
id: NFR-DEPLOY-002
type: operability
description: The system shall expose deployment version metadata at runtime.
acceptance_criteria:
  - Each running service exposes build version, commit hash, deployment timestamp, and environment
  - Version metadata is visible in logs, metrics, and diagnostic endpoints
  - Incident reports can identify the deployed version active during the incident
```

---

## Deployment and Agent Responsibilities

Deployment concerns should be distributed across the agent suite, not isolated in the Release Agent.

| Agent | Deployment Responsibility |
|---|---|
| **Product Model Steward** | Ensures deployment assumptions are represented in the product model |
| **Capability Modeller** | Identifies capabilities that imply deployment constraints |
| **Feature Specifier** | Defines feature availability across deployment modes |
| **Requirement Analyst** | Captures deployability, operability, scalability, and resilience requirements |
| **Impact Analyst** | Assesses how proposed changes affect runtime environments |
| **Architect** | Designs topology, integration points, data flows, and environment boundaries |
| **Implementation Agent** | Implements configuration, health checks, migrations, and deployment hooks |
| **Test Agent** | Verifies deployment behaviours, rollback, migration safety, and environment parity |
| **Security Reviewer** | Reviews tenancy, secrets, network boundaries, runtime permissions, and auditability |
| **Release Agent** | Defines rollout, rollback, migration, and communication plans |
| **Operations Agent** | Monitors deployed systems and captures operational evidence |
| **Learning Agent** | Feeds deployment incidents and runtime learnings back into the product model |
| **Governance Agent** | Tracks deployment standards, exceptions, risks, and compliance obligations |

---

## Deployment Evolution Modes

Deployment itself should evolve over time.

| Mode | Purpose |
|---|---|
| **Introduce** | Add a new deployment model or environment |
| **Extend** | Add support for a new region, tenant type, customer segment, or runtime mode |
| **Harden** | Improve resilience, observability, security, or rollback capability |
| **Simplify** | Remove unnecessary deployment variation or operational complexity |
| **Migrate** | Move from one hosting, tenancy, or infrastructure model to another |
| **Deprecate** | Retire an old environment, platform, or deployment mode |
| **Audit** | Check deployment model against product, security, and operational expectations |

---

## Deployment in the Iteration Loop

The product iteration loop should explicitly include deployment impact.

```text
Current Product Model
  → Change Proposal
  → Impact Analysis
  → Updated Specification
  → Design Delta
  → Deployment Impact
  → Implementation
  → Verification
  → Release
  → Operational Learning
  → Product Model Update
```

This ensures that deployment is considered before implementation is complete and before release planning begins.

---

## Deployment Evidence

Each release should produce deployment evidence that can be linked back into the product model.

Examples:

```text
- Deployed version
- Environment
- Infrastructure changes
- Configuration changes
- Database migrations
- Feature flag changes
- Rollout timeline
- Health check results
- Smoke test results
- Rollback decision points
- Post-release incidents
- Runtime metrics
```

This evidence allows the product model to distinguish between:

```text
Intended behaviour
Implemented behaviour
Released behaviour
Observed behaviour
```

That distinction is critical for agent-driven product evolution.

---

## Event-Sourced Product Model

The preferred storage model is an **event-sourced product knowledge graph**.

In this model, the canonical history of the product is not a set of mutable YAML files. The canonical history is a stream of product events stored in Git.

The current product model is a deterministic projection of all accepted product events.

```text
Product events
  → deterministic projector
  → generated YAML product model
  → validation
  → Git commit / pull request
```

For v1, the process should stay Git-native and simple:

```text
Agent creates branch
  → agent proposes event files
  → deterministic projector regenerates YAML
  → CI validates replay and projection
  → Product Model Steward reviews product coherence
  → PR merge accepts the events
```

In this model:

```text
PR = proposed product change
event files in PR = proposed events
generated YAML = deterministic projection
merge to main = accepted product transition
```

---

## Repository as the Coordination Mechanism

The event store, generated product YAML, and source code can live in the same repository.

```text
/repo
  /src
  /product-events
  /product-model
  /product-tools
```

The repository provides the coordination boundary:

```text
Branches isolate concurrent agent work.
Pull requests represent proposed changes.
CI validates correctness.
Merge serialises accepted changes onto main.
Git history provides auditability.
```

This avoids introducing a separate command queue, command-result mechanism, append coordinator, or event allocation service in v1.

---

## Event Store as the Source of Truth

The event store records every accepted change to the product model.

Examples:

```text
ProductCreated
CapabilityAdded
CapabilityRenamed
CapabilityDeprecated
FeatureAdded
FeatureMovedToCapability
FeatureDeprecated
BehaviourDefined
RequirementAdded
RequirementChanged
AcceptanceCriterionAdded
DeploymentModelIntroduced
DeploymentConstraintChanged
ArchitectureDecisionRecorded
TestLinkedToRequirement
ReleaseDeployed
IncidentLinkedToFeature
OperationalLearningCaptured
ProductModelVersionPublished
```

Each event should be immutable, append-only, and attributable.

Example event:

```yaml
id: EVT-01JZ8ZP7W4A6K89F2RMQ9V3HDA
type: FeatureAdded
occurred_at: 2026-05-31T12:00:00Z
actor:
  type: agent
  id: feature_specifier
source:
  change_proposal_id: CHG-001
  conversation_id: CONV-123
payload:
  feature_id: FEAT-001
  capability_id: CAP-001
  name: Generate requirements from product idea
  description: Converts a raw product idea into structured requirements.
metadata:
  correlation_id: CHG-001
```

An event file on a branch is proposed. An event file on `main` is accepted.

```text
event file on branch = proposed event
event file on main = accepted event
```

---

## File Layout for Events

Avoid a single append-only file such as `events.yaml` because concurrent appends will create unnecessary merge conflicts.

Prefer one event file per event.

```text
/product-events
  2026/
    05/
      31/
        EVT-01JZ8ZP7W4A6K89F2RMQ9V3HDA-feature-added.yaml
        EVT-01JZ8ZQ5RF8PP6K0M2FXK49F30-requirement-added.yaml
```

Each event file is immutable once merged.

For v1, avoid globally sequential event numbers. They create unnecessary coordination overhead. Use sortable unique IDs instead, such as ULIDs or timestamp-plus-random IDs.

Replay order can be determined by:

```text
occurred_at, then event id
```

If stricter ordering is needed later, the merge order on `main` can be treated as authoritative, or a deterministic index can be generated during projection.

---

## Deterministic YAML Projection

The generated YAML product model should be created by a deterministic program, not by an LLM.

The LLM should help create, critique, and review proposed events. The projector should mechanically apply events to produce product documentation.

```text
LLM / Agent
  → proposes product event files

Deterministic projector
  → replays events
  → builds product model state
  → writes YAML documentation
  → writes indexes and traceability matrices
  → validates output
```

The projector is essentially a reducer:

```text
events[] → product_model_state → YAML files
```

Example projection behaviour:

```text
CapabilityAdded → create capability YAML
FeatureAdded → create feature YAML
RequirementChanged → update requirement YAML
TestLinkedToRequirement → update traceability index
FeatureDeprecated → mark feature status as deprecated
```

This should be code, not inference.

---

## Why Projection Should Be Deterministic

Deterministic projection gives the system important properties:

| Property | Reason |
|---|---|
| **Replayable** | The same events always produce the same YAML |
| **Testable** | Projection rules can have unit tests |
| **Reviewable** | YAML diffs become predictable |
| **Recoverable** | The YAML folder can be deleted and regenerated from events |
| **Auditable** | No hidden LLM interpretation is involved during projection |
| **Fast** | No model call is needed for rebuilds |
| **Cheap** | Projection does not consume tokens |
| **Safe** | Reduces hallucinated or accidental documentation edits |

The YAML folder should therefore be treated as generated output.

```text
/product-events   ← authored by agents or humans
/product-model    ← generated by deterministic projector
```

Generated YAML files should include a warning header:

```yaml
# Generated from /product-events.
# Do not edit directly.
# To change this file, add or modify product events.
```

---

## Git-Backed YAML Documentation

The generated YAML documentation should be backed by Git, but should not be manually edited.

Example folder structure:

```text
/product-model
  product.yaml
  capabilities/
    CAP-001-specify-product-behaviour.yaml
  features/
    FEAT-001-generate-requirements-from-product-idea.yaml
  behaviours/
    BEH-001.yaml
  requirements/
    REQ-001.yaml
  acceptance-criteria/
    AC-001.yaml
  deployment-models/
    DEPLOY-001-multi-tenant-saas.yaml
  decisions/
    ADR-001-use-event-sourced-product-model.md
  releases/
    REL-001.yaml
  incidents/
    INC-001.yaml
  indexes/
    capability-map.yaml
    traceability-matrix.yaml
    product-model-version.yaml
```

The generated files should be deterministic. Given the same event stream, the projector should produce the same YAML output.

---

## Projection Rules

The documentation projector should be deliberately simple and deterministic.

```text
Input: ordered stream of accepted product events
Output: regenerated product-model folder
```

Projection rules:

```text
- Events are applied in deterministic order
- IDs are stable
- File paths are derived from IDs and slugs
- Existing generated files are overwritten
- Deleted or deprecated entities are represented explicitly, not silently removed
- Index files are regenerated
- Traceability matrices are regenerated
- Projection errors fail the build
- The generated YAML must match exactly what the projector would produce from the event stream
```

The YAML projection should not contain manual edits.

---

## Product Model Steward in the PR Flow

The Product Model Steward does not need to be a runtime gatekeeper in v1.

It can act as a review and validation agent in the pull request process.

```text
Agent proposes product event PR
  → deterministic projector regenerates YAML
  → CI validates event replay and projection
  → Product Model Steward reviews semantic coherence
  → human or policy-controlled merge accepts the event
```

The Product Model Steward should check:

```text
- whether the proposed change duplicates an existing concept
- whether the change belongs under an existing capability
- whether a new capability is justified
- whether affected features, requirements, tests, deployments, and docs are identified
- whether required relationships are present
- whether lifecycle transitions are valid
- whether naming and ID conventions are followed
- whether the change should be split into multiple events
- whether the change requires human approval
```

The Steward protects product coherence, but Git and CI provide the core acceptance mechanism.

---

## Concurrency Model

Multiple agents can work concurrently because they work on branches.

```text
agent-a/add-feature-x
agent-b/add-capability-y
agent-c/update-requirement-z
```

They only conflict when changes are merged.

The concurrency model is:

```text
Parallel work happens on branches.
Serial acceptance happens through PR merge to main.
CI revalidates after rebase or merge.
```

This keeps concurrency reliable without requiring a separate append coordinator.

Conflict types still exist, but they are handled through Git, CI, and review.

| Conflict Type | Example | Handling |
|---|---|---|
| **Git conflict** | Two agents update the same generated file | Rebase and regenerate projection |
| **Semantic conflict** | Two agents add similar features | Steward review merges, renames, or rejects one proposal |
| **Lifecycle conflict** | One PR changes a feature while another deprecates it | Revalidate after rebase |
| **Reference conflict** | Event references an entity removed by another PR | CI validation fails |
| **Projection conflict** | Generated YAML does not match event replay | CI validation fails |

---

## CI Validation

CI should validate both the event stream and the generated projection.

Checks should include:

```text
- event files match their schemas
- event IDs are unique
- event timestamps are valid
- event payload references existing entities where required
- lifecycle transitions are valid
- replay succeeds from an empty model
- generated YAML exactly matches projector output
- no manual changes exist in generated YAML
- traceability indexes are complete
- requirements have acceptance criteria where required
- deprecated or removed entities are handled explicitly
```

CI is the hard guardrail. The Product Model Steward is the semantic reviewer.

---

## Atomic Pull Requests

Each accepted product change should be represented by an atomic pull request where possible.

A product-model PR should include:

```text
- new or changed event file(s)
- regenerated YAML projection
- regenerated indexes
- updated traceability matrix
- validation output, if stored
```

```text
Merged PR = accepted product model transition
```

If code changes and product model changes are part of the same unit of work, there are two viable options:

```text
Option 1: Product event PR first, then code PR references product event IDs
Option 2: Single PR contains code changes, product events, and regenerated product YAML
```

For stronger traceability, the code commit or pull request should reference relevant event IDs, change proposal IDs, feature IDs, and requirement IDs.

---

## Handling Manual Edits

For v1, generated YAML should be read-only.

```text
Events → deterministic projector → YAML
```

Humans and agents should not directly edit `/product-model`. They should edit or add event files under `/product-events`.

Benefits:

```text
- Single source of truth
- No reverse-engineering of documentation edits
- Easier validation
- Easier replay
- Lower risk of drift
- Simpler concurrency model
```

A later version could support YAML edits becoming inferred events:

```text
YAML diff → event inference → Steward validation → events → regenerated YAML
```

But this adds significant complexity and should not be part of v1.

---

## Projections Beyond YAML

The event stream can support multiple projections.

```text
Event Store
  ├─ YAML documentation projection
  ├─ Graph database projection
  ├─ Relational workflow projection
  ├─ Search index projection
  ├─ Vector retrieval index
  └─ Published documentation site
```

Recommended responsibilities:

| Projection | Purpose |
|---|---|
| **YAML/Git projection** | Human-readable canonical documentation view |
| **Graph projection** | Traceability, impact analysis, relationship traversal |
| **Relational projection** | Workflow state, dashboards, review queues |
| **Search index** | Keyword search across product artefacts |
| **Vector index** | Semantic retrieval for agents |
| **Documentation site** | Published product knowledge portal |

The event stream remains the authoritative history.

---

## Rebuild and Replay

Because the model is event-sourced, projections should be rebuildable from scratch.

```text
Delete projections
  → replay all product events
  → rebuild YAML
  → rebuild graph projection
  → rebuild search indexes
  → verify consistency
```

This gives the system strong recovery and audit properties.

It also allows new projections to be added later without changing the historical event stream.

---

## Event-Sourced Architecture

```text
Agents / Users
  → product event files on branches
  → deterministic projector
  → generated YAML
  → CI validation
  → Product Model Steward review
  → PR merge to main
  → accepted product history
```

The key architectural rule is:

```text
Only events merged to main mutate accepted product state.
```

Agents may propose events, analyse changes, or review product coherence, but accepted product state is defined by the event stream on `main`.

---

## Event Design Guidelines

Events should be:

```text
- Past tense
- Immutable once merged
- Specific enough to support deterministic projection
- Stable across implementation changes
- Attributable to a user, agent, or system process
- Validatable against an event schema
- Reviewable in a pull request
```

Good event names:

```text
CapabilityAdded
FeatureDeprecated
RequirementAcceptanceCriteriaChanged
DeploymentModelIntroduced
TestLinkedToRequirement
IncidentLinkedToCapability
```

Poor event names:

```text
UpdateProduct
ModifyThing
ChangeData
ProcessRequest
```

---

## Practical Conclusion for Storage

The preferred storage model is:

```text
Git repository is the coordination and audit mechanism.
Product events are the source of truth.
Generated YAML is a deterministic projection.
Graph database is an optional query projection.
Vector index is an agent retrieval aid.
```

For v1, avoid a command queue, result files, append coordinator, external lock service, or globally sequential event numbers.

Use:

```text
Git branches + PRs + CI validation + deterministic projection
```

This gives the product knowledge system:

```text
- auditability
- repeatability
- traceability
- reviewability
- recoverability
- human-readable documentation
- reliable concurrency through Git workflows
- low operational complexity
```

## Recommended Core Loop

The most important product loop is:

```text
Define → Deliver → Observe → Reconcile → Evolve
```

This means:

| Stage | Meaning |
|---|---|
| **Define** | Establish intended capability, feature, behaviour, and requirements |
| **Deliver** | Build, test, and release the product change |
| **Observe** | Capture usage, telemetry, incidents, feedback, and support signals |
| **Reconcile** | Compare real-world behaviour with intended product definition |
| **Evolve** | Update the product model, backlog, tests, docs, and architecture |

---

## Practical Conclusion

The product should be modelled as:

```text
A versioned product knowledge graph
```

The core hierarchy should be:

```text
Capability > Feature > Behaviour > Requirement > Acceptance Criterion
```

The agent suite should operate against this knowledge graph rather than producing isolated deliverables.

The most important agent may not be the builder agent. It may be the agent that maintains the integrity of the product model over time.

That agent is the **Product Model Steward**.

