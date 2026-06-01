import type { BranchDeltaChangeCategory, BranchDeltaOptions } from "../delta/types.js";

export type WorkPackage = {
  work_package_id: string;
  title: string;
  change_summary: string[];
  capability_ids: string[];
  feature_ids: string[];
  requirement_ids: string[];
  acceptance_criterion_ids: string[];
  test_ids: string[];
  depends_on: string[];
  rationale: string;
};

export type WorkPackageReport = {
  base_branch: string;
  current_branch: string;
  product_id: string;
  source_branch_delta: {
    branch_only_event_count: number;
    change_categories: BranchDeltaChangeCategory[];
  };
  work_packages: WorkPackage[];
};

export type DeriveWorkPackagesOptions = BranchDeltaOptions;
