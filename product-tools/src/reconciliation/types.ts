import type { EventType, EntityType } from "../schemas/events.js";

export type ReconciliationStatus = "clean" | "conflicts";
export type ReconciliationResolution = "manual_reconcile_required";

export type ReconciliationConflict = {
  event_id: string;
  event_type: EventType;
  file_path: string;
  entity_type: EntityType;
  entity_id: string;
  expected_revision: number;
  actual_revision: number;
  expected_last_entity_event_id?: string;
  actual_last_entity_event_id?: string;
  resolution: ReconciliationResolution;
};

export type ReconciliationReport = {
  base_branch: string;
  current_branch: string;
  base_commit: string;
  product_id: string;
  events_root: string;
  base_event_count: number;
  current_event_count: number;
  branch_only_event_count: number;
  checked_event_count: number;
  clean_event_count: number;
  conflicting_event_count: number;
  status: ReconciliationStatus;
  clean_event_ids: string[];
  conflicts: ReconciliationConflict[];
  next_action: "none" | ReconciliationResolution;
};

export type ReconcileEventsOptions = {
  baseBranch: string;
  eventsRoot?: string;
  cwd?: string;
};
