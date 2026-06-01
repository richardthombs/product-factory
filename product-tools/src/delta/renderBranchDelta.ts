import type {
  BranchDeltaAcceptanceCriterionContext,
  BranchDeltaCapabilityContext,
  BranchDeltaFeatureContext,
  BranchDeltaReport,
  BranchDeltaRequirementContext,
} from "./types.js";

export function renderBranchDeltaDocument(report: BranchDeltaReport): string {
  const lines: string[] = [
    `# ${report.current_branch} — Branch Delta`,
    "",
    `Proposed product delta relative to \`${report.base_branch}\`.`,
    "",
    "# Summary",
    "",
    `- Product ID: ${report.product_id}`,
    `- Base branch: ${report.base_branch}`,
    `- Current branch: ${report.current_branch}`,
    `- Base events: ${report.base_event_count}`,
    `- Current events: ${report.current_event_count}`,
    `- Branch-only events: ${report.branch_only_event_count}`,
    `- Change categories: ${formatCategorySummary(report.change_categories)}`,
    "",
    "# Proposed Changes",
    "",
  ];

  if (report.contextual_changes.capabilities.length === 0) {
    lines.push("- No changed product entities.");
    return `${lines.join("\n")}\n`;
  }

  for (const capability of report.contextual_changes.capabilities) {
    lines.push(...renderCapability(capability));
  }

  return `${lines.join("\n")}\n`;
}

function renderCapability(capability: BranchDeltaCapabilityContext): string[] {
  const capabilityNotes = normalizeChangeNotes(capability.change_notes);
  const lines = [
    `## ${capability.capability_id} — ${capability.capability_name}${formatNotes(capabilityNotes.labels)}`,
    "",
    capability.description,
    ...(capabilityNotes.details.length > 0 ? [`Change details: ${capabilityNotes.details.join("; ")}`, ""] : []),
    "",
  ];

  if (capability.features.length === 0) {
    lines.push("- No directly changed child features.", "");
    return lines;
  }

  for (const feature of capability.features) {
    lines.push(...renderFeature(feature));
  }

  return lines;
}

function renderFeature(feature: BranchDeltaFeatureContext): string[] {
  const featureNotes = normalizeChangeNotes(feature.change_notes);
  const lines = [
    `### ${feature.feature_id} — ${feature.feature_name}${formatNotes(featureNotes.labels)}`,
    "",
    feature.description,
    ...(featureNotes.details.length > 0 ? [`Change details: ${featureNotes.details.join("; ")}`, ""] : []),
    "",
  ];

  if (feature.requirements.length === 0) {
    lines.push("- No directly changed requirements.", "");
    return lines;
  }

  lines.push("Requirements:", "");
  for (const requirement of feature.requirements) {
    lines.push(...renderRequirement(requirement));
  }
  return lines;
}

function renderRequirement(requirement: BranchDeltaRequirementContext): string[] {
  const notes = normalizeChangeNotes(requirement.change_notes);
  const lines = [`- **${requirement.requirement_id}**${formatInlineNotes(notes.labels)}: ${requirement.description}`];

  if (requirement.acceptance_criteria.length === 0) {
    lines.push("");
    return lines;
  }

  lines.push("  - Acceptance criteria:");
  for (const acceptanceCriterion of requirement.acceptance_criteria) {
    lines.push(...renderAcceptanceCriterion(acceptanceCriterion));
  }
  lines.push("");

  return lines;
}

function renderAcceptanceCriterion(acceptanceCriterion: BranchDeltaAcceptanceCriterionContext): string[] {
  const notes = normalizeChangeNotes(acceptanceCriterion.change_notes);
  const testsSuffix = acceptanceCriterion.tests.length > 0
    ? ` ${acceptanceCriterion.tests.map((test) => `\`${test.test_id}\``).join(", ")}.`
    : "";

  return [
    `    - **${acceptanceCriterion.acceptance_criterion_id}**${formatInlineNotes(notes.labels)}: ${acceptanceCriterion.text}${testsSuffix}`,
  ];
}

function normalizeChangeNotes(notes: string[]): { labels: string[]; details: string[] } {
  const labels: string[] = [];
  const details: string[] = [];

  for (const note of notes) {
    if (note === "added" || note === "changed") {
      labels.push(note);
      continue;
    }

    if (note.startsWith("moved from ")) {
      labels.push("moved");
      details.push(note);
      continue;
    }

    if (note.startsWith("deprecated:")) {
      labels.push("deprecated");
      details.push(note);
      continue;
    }

    if (note.startsWith("status -> ")) {
      const status = note.slice("status -> ".length).trim();
      labels.push(`status: ${status}`);
      details.push(`status changed to ${status}`);
      continue;
    }

    labels.push(note);
  }

  const uniqueLabels = [...new Set(labels)].filter((label) => !(labels.includes("added") && label === "changed"));

  return {
    labels: uniqueLabels,
    details,
  };
}

function formatNotes(notes: string[]): string {
  return notes.length > 0 ? ` (${notes.join("; ")})` : "";
}

function formatInlineNotes(notes: string[]): string {
  return notes.length > 0 ? ` *(${notes.join("; ")})*` : "";
}

function formatCategorySummary(categories: BranchDeltaReport["change_categories"]): string {
  if (categories.length === 0) {
    return "none";
  }

  const labels = categories.map((category) => {
    switch (category) {
      case "extend":
        return "additions";
      case "refine":
        return "refinements";
      case "reshape":
        return "structural reshaping";
      case "deprecate":
        return "deprecations";
      case "verify":
        return "verification coverage";
      case "readiness":
        return "readiness transitions";
      default:
        return category;
    }
  });

  return labels.join(", ");
}
