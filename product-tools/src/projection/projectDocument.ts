import type { ProductModelState, ProjectionSummary } from "./types.js";

export function renderProjectDocument(state: ProductModelState, summary: ProjectionSummary): string {
  const capabilities = [...state.capabilities.values()].sort((a, b) => a.id.localeCompare(b.id));

  const sections = [
    `# ${state.product.name}`,
    "",
    state.product.description,
    "",
    "# Summary",
    "",
    `- Product ID: ${state.product.id}`,
    `- Capabilities: ${summary.capabilityCount}`,
    `- Features: ${summary.featureCount}`,
    `- Requirements: ${summary.requirementCount}`,
    `- Acceptance Criteria: ${summary.acceptanceCriterionCount}`,
    `- Tests: ${summary.testCount}`,
    `- Projected from events: ${summary.eventCount}`,
    `- Last event: ${summary.lastEventId} @ ${summary.lastOccurredAt}`,
    "",
    "# Capabilities",
    "",
    ...capabilities.flatMap((capability) => renderCapabilitySection(state, capability.id)),
  ];

  return sections.join("\n");
}

function renderCapabilitySection(state: ProductModelState, capabilityId: string): string[] {
  const capability = state.capabilities.get(capabilityId);
  if (!capability) {
    throw new Error(`Missing capability '${capabilityId}' while rendering project document`);
  }

  const lines = [
    `## ${capability.id} — ${capability.name}`,
    "",
    capability.description,
    "",
  ];

  const featureIds = [...capability.featureIds].sort();
  if (featureIds.length === 0) {
    lines.push("- No features defined.", "");
    return lines;
  }

  for (const featureId of featureIds) {
    lines.push(...renderFeatureSection(state, featureId));
  }

  return lines;
}

function renderFeatureSection(state: ProductModelState, featureId: string): string[] {
  const feature = state.features.get(featureId);
  if (!feature) {
    throw new Error(`Missing feature '${featureId}' while rendering project document`);
  }

  const lines = [
    `### ${feature.id} — ${feature.name}`,
    "",
    feature.description,
    "",
  ];

  const requirementIds = [...feature.requirementIds].sort();
  if (requirementIds.length === 0) {
    lines.push("- No requirements defined.", "");
    return lines;
  }

  lines.push("Requirements:", "");
  for (const requirementId of requirementIds) {
    lines.push(...renderRequirementSection(state, requirementId));
  }

  return lines;
}

function renderRequirementSection(state: ProductModelState, requirementId: string): string[] {
  const requirement = state.requirements.get(requirementId);
  if (!requirement) {
    throw new Error(`Missing requirement '${requirementId}' while rendering project document`);
  }

  const lines = [
    `- **${requirement.id}**: ${requirement.description}`,
  ];

  const acceptanceCriterionIds = [...requirement.acceptanceCriterionIds].sort();
  if (acceptanceCriterionIds.length === 0) {
    lines.push("  - No acceptance criteria defined.", "");
    return lines;
  }

  lines.push("  - Acceptance criteria:");
  for (const acceptanceCriterionId of acceptanceCriterionIds) {
    lines.push(...renderAcceptanceCriterionSection(state, acceptanceCriterionId));
  }
  lines.push("");

  return lines;
}

function renderAcceptanceCriterionSection(state: ProductModelState, acceptanceCriterionId: string): string[] {
  const acceptanceCriterion = state.acceptanceCriteria.get(acceptanceCriterionId);
  if (!acceptanceCriterion) {
    throw new Error(`Missing acceptance criterion '${acceptanceCriterionId}' while rendering project document`);
  }

  const lines = [`    - **${acceptanceCriterion.id}**: ${acceptanceCriterion.text}`];
  const tests = [...state.tests.values()]
    .filter((test) => test.acceptanceCriterionId === acceptanceCriterionId)
    .sort((a, b) => a.id.localeCompare(b.id));

  if (tests.length > 0) {
    lines.push("      - Tests:");
    for (const test of tests) {
      lines.push(`        - ${test.id}: ${test.filePath}:${test.lineNumber} — ${test.testName}`);
    }
  }

  return lines;
}
