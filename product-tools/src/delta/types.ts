import type { EventType } from "../schemas/events.js";

export type BranchDeltaChangeCategory =
  | "extend"
  | "refine"
  | "reshape"
  | "deprecate"
  | "verify"
  | "readiness";

export type BranchDeltaEntityRefs = {
  capability_ids: string[];
  feature_ids: string[];
  requirement_ids: string[];
  acceptance_criterion_ids: string[];
  test_ids: string[];
};

export type BranchDeltaEventReport = {
  event_id: string;
  event_type: EventType;
  file_path: string;
  occurred_at: string;
  entity_refs: BranchDeltaEntityRefs;
};

export type BranchDeltaSummary = {
  capabilities_added: number;
  capabilities_changed: number;
  capabilities_status_changed: number;
  features_added: number;
  features_changed: number;
  features_moved: number;
  features_deprecated: number;
  features_status_changed: number;
  requirements_added: number;
  requirements_changed: number;
  acceptance_criteria_added: number;
  acceptance_criteria_changed: number;
  tests_added: number;
};

export type BranchDeltaChangedEntities = {
  capabilities: {
    added: Array<{ capability_id: string }>;
    changed: Array<{ capability_id: string }>;
    status_changed: Array<{ capability_id: string; status: string }>;
  };
  features: {
    added: Array<{ feature_id: string }>;
    changed: Array<{ feature_id: string }>;
    moved: Array<{ feature_id: string; from_capability_id: string | null; to_capability_id: string }>;
    deprecated: Array<{ feature_id: string; reason: string }>;
    status_changed: Array<{ feature_id: string; status: string }>;
  };
  requirements: {
    added: Array<{ requirement_id: string }>;
    changed: Array<{ requirement_id: string }>;
  };
  acceptance_criteria: {
    added: Array<{ acceptance_criterion_id: string }>;
    changed: Array<{ acceptance_criterion_id: string }>;
  };
  tests: {
    added: Array<{ test_id: string }>;
  };
};

export type BranchDeltaImpactedEntities = {
  capability_ids: string[];
  feature_ids: string[];
  requirement_ids: string[];
  acceptance_criterion_ids: string[];
  test_ids: string[];
};

export type BranchDeltaTestContext = {
  test_id: string;
};

export type BranchDeltaAcceptanceCriterionContext = {
  acceptance_criterion_id: string;
  text: string;
  change_notes: string[];
  tests: BranchDeltaTestContext[];
};

export type BranchDeltaRequirementContext = {
  requirement_id: string;
  description: string;
  change_notes: string[];
  acceptance_criteria: BranchDeltaAcceptanceCriterionContext[];
};

export type BranchDeltaFeatureContext = {
  feature_id: string;
  feature_name: string;
  description: string;
  change_notes: string[];
  requirements: BranchDeltaRequirementContext[];
};

export type BranchDeltaCapabilityContext = {
  capability_id: string;
  capability_name: string;
  description: string;
  change_notes: string[];
  features: BranchDeltaFeatureContext[];
};

export type BranchDeltaContext = {
  capabilities: BranchDeltaCapabilityContext[];
};

export type BranchDeltaReport = {
  base_branch: string;
  current_branch: string;
  product_id: string;
  events_root: string;
  base_event_count: number;
  current_event_count: number;
  branch_only_event_count: number;
  summary: BranchDeltaSummary;
  change_categories: BranchDeltaChangeCategory[];
  branch_only_events: BranchDeltaEventReport[];
  changed_entities: BranchDeltaChangedEntities;
  impacted_entities: BranchDeltaImpactedEntities;
  contextual_changes: BranchDeltaContext;
};

export type BranchDeltaOptions = {
  baseBranch: string;
  eventsRoot?: string;
  cwd?: string;
};
