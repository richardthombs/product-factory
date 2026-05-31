# Product Evolution Implementation Checklist

This checklist turns `docs/product_evolution_tooling_plan.md` into concrete implementation work for `product-tools`.

## Milestone 1: Requirement and acceptance-criterion refinement

### Schema

- [x] Add `RequirementChanged` payload schema
- [x] Add `AcceptanceCriterionChanged` payload schema
- [x] Extend the event type union to include both events

### Validation

- [x] Validate that `RequirementChanged` references an existing requirement
- [x] Validate that `AcceptanceCriterionChanged` references an existing acceptance criterion
- [x] Extend event summaries to include both new event types

### Replay / projection

- [x] Replay `RequirementChanged` by updating the current requirement description
- [x] Replay `AcceptanceCriterionChanged` by updating the current acceptance-criterion text
- [x] Ensure existing YAML and markdown projections pick up changed values deterministically

### Commands / CLI

- [x] Add `changeRequirement` command
- [x] Add `changeAcceptanceCriterion` command
- [x] Add `npm run change-requirement`
- [x] Add `npm run change-acceptance-criterion`

### Tests

- [x] Add a command test for requirement changes
- [x] Add a command test for acceptance-criterion changes
- [x] Add validation coverage for missing references

## Milestone 2: Structural reshaping

### Schema

- [x] Add `FeatureMovedToCapability`
- [x] Add `FeatureDeprecated`

### Validation

- [x] Validate moved features reference an existing target capability
- [x] Validate deprecated features reference an existing feature

### Replay / projection

- [x] Update feature parent capability during replay
- [x] Project deprecated feature state without deleting history

### Commands / CLI

- [x] Add `moveFeature` command and CLI
- [x] Add `deprecateFeature` command and CLI

### Tests

- [x] Add replay/projection coverage for feature moves
- [x] Add replay/projection coverage for deprecation

## Milestone 3: Readiness workflow

### Schema

- [x] Add `FeatureStatusChanged`
- [x] Add `CapabilityStatusChanged`
- [x] Add shared status enums/constants

### Validation

- [x] Validate status values
- [ ] Optionally add allowed-transition checks

### Replay / projection

- [x] Store current capability and feature status in projected state
- [x] Render status in generated YAML and markdown
- [x] Consider adding planning-oriented indexes for implementation-ready features

### Commands / CLI

- [x] Add `setFeatureStatus` command and CLI
- [x] Add `setCapabilityStatus` command and CLI

### Tests

- [x] Add command coverage for status changes
- [x] Add projection coverage for readiness states

## Documentation and product-model follow-through

- [x] Add consolidated workflow documentation under `docs/`
- [x] Add tooling-plan documentation under `docs/`
- [x] Link workflow docs from `product-tools/README.md`
- [x] Extend the self-described product model as more workflow capabilities are implemented
