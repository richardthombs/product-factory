import type { WorkPackage, WorkPackageReport } from "./types.js";

export function renderWorkPackagesDocument(report: WorkPackageReport): string {
  const lines: string[] = [
    `# ${report.current_branch} — Work Packages`,
    "",
    `Derived implementation work packages relative to \`${report.base_branch}\`.`,
    "",
    "# Summary",
    "",
    `- Product ID: ${report.product_id}`,
    `- Base branch: ${report.base_branch}`,
    `- Current branch: ${report.current_branch}`,
    `- Branch-only events: ${report.source_branch_delta.branch_only_event_count}`,
    `- Change categories: ${formatList(report.source_branch_delta.change_categories)}`,
    `- Work packages: ${report.work_packages.length}`,
    "",
    "# Work Packages",
    "",
  ];

  if (report.work_packages.length === 0) {
    lines.push("- No work packages derived from the current branch delta.");
    return `${lines.join("\n")}\n`;
  }

  for (const workPackage of report.work_packages) {
    lines.push(...renderWorkPackage(workPackage));
  }

  return `${lines.join("\n")}\n`;
}

function renderWorkPackage(workPackage: WorkPackage): string[] {
  return [
    `## ${workPackage.work_package_id} — ${workPackage.title}`,
    "",
    `- Change summary: ${formatList(workPackage.change_summary)}`,
    `- Capabilities: ${formatIds(workPackage.capability_ids)}`,
    `- Features: ${formatIds(workPackage.feature_ids)}`,
    `- Requirements: ${formatIds(workPackage.requirement_ids)}`,
    `- Acceptance criteria: ${formatIds(workPackage.acceptance_criterion_ids)}`,
    `- Tests: ${formatIds(workPackage.test_ids)}`,
    `- Depends on: ${formatIds(workPackage.depends_on)}`,
    `- Rationale: ${workPackage.rationale}`,
    "",
  ];
}

function formatList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "none";
}

function formatIds(values: string[]): string {
  return values.length > 0 ? values.map((value) => `\`${value}\``).join(", ") : "none";
}
