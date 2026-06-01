import { z } from "zod";
import { CAPABILITY_STATUSES, FEATURE_STATUSES } from "../domain/status.js";

const isoTimestamp = z
  .string()
  .datetime({ offset: true })
  .or(z.string().datetime({ local: true }));

const actorSchema = z.object({
  type: z.enum(["agent", "human", "system"]),
  id: z.string().min(1),
});

const sourceSchema = z
  .object({
    change_proposal_id: z.string().min(1).optional(),
    conversation_id: z.string().min(1).optional(),
  })
  .strict();

const metadataSchema = z.record(z.string(), z.unknown());

export const productCreatedPayloadSchema = z
  .object({
    product_id: z.string().regex(/^PROD-[A-Z0-9-]+$/),
    name: z.string().min(1),
    description: z.string().min(1),
  })
  .strict();

export const capabilityAddedPayloadSchema = z
  .object({
    capability_id: z.string().regex(/^CAP-[A-Z0-9-]+$/),
    name: z.string().min(1),
    description: z.string().min(1),
  })
  .strict();

export const featureAddedPayloadSchema = z
  .object({
    feature_id: z.string().regex(/^FEAT-[A-Z0-9-]+$/),
    capability_id: z.string().regex(/^CAP-[A-Z0-9-]+$/),
    name: z.string().min(1),
    description: z.string().min(1),
  })
  .strict();

export const requirementAddedPayloadSchema = z
  .object({
    requirement_id: z.string().regex(/^REQ-[A-Z0-9-]+$/),
    feature_id: z.string().regex(/^FEAT-[A-Z0-9-]+$/),
    description: z.string().min(1),
  })
  .strict();

export const acceptanceCriterionAddedPayloadSchema = z
  .object({
    acceptance_criterion_id: z.string().regex(/^AC-[A-Z0-9-]+$/),
    requirement_id: z.string().regex(/^REQ-[A-Z0-9-]+$/),
    text: z.string().min(1),
  })
  .strict();

export const featureChangedPayloadSchema = z
  .object({
    feature_id: z.string().regex(/^FEAT-[A-Z0-9-]+$/),
    description: z.string().min(1),
  })
  .strict();

export const requirementChangedPayloadSchema = z
  .object({
    requirement_id: z.string().regex(/^REQ-[A-Z0-9-]+$/),
    description: z.string().min(1),
  })
  .strict();

export const acceptanceCriterionChangedPayloadSchema = z
  .object({
    acceptance_criterion_id: z.string().regex(/^AC-[A-Z0-9-]+$/),
    text: z.string().min(1),
  })
  .strict();

export const featureMovedToCapabilityPayloadSchema = z
  .object({
    feature_id: z.string().regex(/^FEAT-[A-Z0-9-]+$/),
    capability_id: z.string().regex(/^CAP-[A-Z0-9-]+$/),
  })
  .strict();

export const featureDeprecatedPayloadSchema = z
  .object({
    feature_id: z.string().regex(/^FEAT-[A-Z0-9-]+$/),
    reason: z.string().min(1),
  })
  .strict();

export const featureStatusChangedPayloadSchema = z
  .object({
    feature_id: z.string().regex(/^FEAT-[A-Z0-9-]+$/),
    status: z.enum(FEATURE_STATUSES),
    reason: z.string().min(1).optional(),
  })
  .strict();

export const capabilityStatusChangedPayloadSchema = z
  .object({
    capability_id: z.string().regex(/^CAP-[A-Z0-9-]+$/),
    status: z.enum(CAPABILITY_STATUSES),
    reason: z.string().min(1).optional(),
  })
  .strict();

export const testCreatedPayloadSchema = z
  .object({
    test_id: z.string().regex(/^TEST-[A-Z0-9-]+$/),
    acceptance_criterion_id: z.string().regex(/^AC-[A-Z0-9-]+$/),
    file_path: z.string().min(1),
    test_name: z.string().min(1),
  })
  .strict();

const baseEventSchema = z
  .object({
    id: z.string().regex(/^EVT-[A-Z0-9-]+$/),
    type: z.enum([
      "ProductCreated",
      "CapabilityAdded",
      "FeatureAdded",
      "RequirementAdded",
      "AcceptanceCriterionAdded",
      "FeatureChanged",
      "RequirementChanged",
      "AcceptanceCriterionChanged",
      "FeatureMovedToCapability",
      "FeatureDeprecated",
      "FeatureStatusChanged",
      "CapabilityStatusChanged",
      "TestCreated",
    ]),
    occurred_at: isoTimestamp,
    actor: actorSchema,
    source: sourceSchema.optional(),
    payload: z.unknown(),
    metadata: metadataSchema.optional(),
  })
  .strict();

export const eventSchema = z.discriminatedUnion("type", [
  baseEventSchema.extend({
    type: z.literal("ProductCreated"),
    payload: productCreatedPayloadSchema,
  }),
  baseEventSchema.extend({
    type: z.literal("CapabilityAdded"),
    payload: capabilityAddedPayloadSchema,
  }),
  baseEventSchema.extend({
    type: z.literal("FeatureAdded"),
    payload: featureAddedPayloadSchema,
  }),
  baseEventSchema.extend({
    type: z.literal("RequirementAdded"),
    payload: requirementAddedPayloadSchema,
  }),
  baseEventSchema.extend({
    type: z.literal("AcceptanceCriterionAdded"),
    payload: acceptanceCriterionAddedPayloadSchema,
  }),
  baseEventSchema.extend({
    type: z.literal("FeatureChanged"),
    payload: featureChangedPayloadSchema,
  }),
  baseEventSchema.extend({
    type: z.literal("RequirementChanged"),
    payload: requirementChangedPayloadSchema,
  }),
  baseEventSchema.extend({
    type: z.literal("AcceptanceCriterionChanged"),
    payload: acceptanceCriterionChangedPayloadSchema,
  }),
  baseEventSchema.extend({
    type: z.literal("FeatureMovedToCapability"),
    payload: featureMovedToCapabilityPayloadSchema,
  }),
  baseEventSchema.extend({
    type: z.literal("FeatureDeprecated"),
    payload: featureDeprecatedPayloadSchema,
  }),
  baseEventSchema.extend({
    type: z.literal("FeatureStatusChanged"),
    payload: featureStatusChangedPayloadSchema,
  }),
  baseEventSchema.extend({
    type: z.literal("CapabilityStatusChanged"),
    payload: capabilityStatusChangedPayloadSchema,
  }),
  baseEventSchema.extend({
    type: z.literal("TestCreated"),
    payload: testCreatedPayloadSchema,
  }),
]);

export type ProductCreatedEvent = z.infer<typeof eventSchema> & {
  type: "ProductCreated";
};

export type ProductEvent = z.infer<typeof eventSchema>;
export type EventType = ProductEvent["type"];
