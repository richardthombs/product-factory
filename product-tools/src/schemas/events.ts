import { z } from "zod";

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
    type: z.literal("TestCreated"),
    payload: testCreatedPayloadSchema,
  }),
]);

export type ProductCreatedEvent = z.infer<typeof eventSchema> & {
  type: "ProductCreated";
};

export type ProductEvent = z.infer<typeof eventSchema>;
export type EventType = ProductEvent["type"];
