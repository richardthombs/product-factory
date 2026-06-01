import type { ReconciliationConflict, ReconciliationReport } from "./types.js";

export function renderReconciliationDocument(report: ReconciliationReport): string {
  const lines: string[] = [
    `# ${report.current_branch} — Event Reconciliation`,
    "",
    `Branch-only event reconciliation relative to \`${report.base_branch}\`.`,
    "",
    "# Summary",
    "",
    `- Status: ${report.status}`,
    `- Product ID: ${report.product_id}`,
    `- Base branch: ${report.base_branch}`,
    `- Current branch: ${report.current_branch}`,
    `- Base commit: ${report.base_commit}`,
    `- Base events: ${report.base_event_count}`,
    `- Current events: ${report.current_event_count}`,
    `- Branch-only events: ${report.branch_only_event_count}`,
    `- Checked events: ${report.checked_event_count}`,
    `- Clean events: ${report.clean_event_count}`,
    `- Conflicts: ${report.conflicting_event_count}`,
    `- Next action: ${report.next_action}`,
    "",
    "# Result",
    "",
  ];

  if (report.conflicts.length === 0) {
    lines.push("Reconciliation is clean.");
    if (report.clean_event_ids.length > 0) {
      lines.push("", `Clean events: ${report.clean_event_ids.join(", ")}`);
    }
    return `${lines.join("\n")}\n`;
  }

  lines.push("Manual reconciliation is required before merge.", "", "# Conflicts", "");
  for (const conflict of report.conflicts) {
    lines.push(...renderConflict(conflict));
  }

  return `${lines.join("\n")}\n`;
}

function renderConflict(conflict: ReconciliationConflict): string[] {
  const lines = [
    `## ${conflict.event_id} — ${conflict.event_type}`,
    "",
    `- File: ${conflict.file_path}`,
    `- Entity: ${conflict.entity_type} ${conflict.entity_id}`,
    `- Expected revision: ${conflict.expected_revision}`,
    `- Actual revision: ${conflict.actual_revision}`,
  ];

  if (conflict.expected_last_entity_event_id || conflict.actual_last_entity_event_id) {
    lines.push(
      `- Expected last accepted entity event: ${conflict.expected_last_entity_event_id ?? "<unspecified>"}`,
      `- Actual last accepted entity event: ${conflict.actual_last_entity_event_id ?? "<none>"}`,
    );
  }

  lines.push(`- Resolution: ${conflict.resolution}`, "");
  return lines;
}
