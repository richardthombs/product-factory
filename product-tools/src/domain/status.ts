export const FEATURE_STATUSES = [
  "active",
  "proposed",
  "defining",
  "implementation_ready",
  "in_delivery",
  "implemented",
  "verified",
  "evolving",
  "deprecated",
] as const;

export const CAPABILITY_STATUSES = [
  "active",
  "proposed",
  "shaping",
  "scoped",
  "partially_delivered",
  "delivered",
  "evolving",
  "deprecated",
] as const;

export type FeatureStatus = typeof FEATURE_STATUSES[number];
export type CapabilityStatus = typeof CAPABILITY_STATUSES[number];

export const DEFAULT_FEATURE_STATUS: FeatureStatus = "active";
export const DEFAULT_CAPABILITY_STATUS: CapabilityStatus = "active";
