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

const eventIdSchema = z.string().regex(/^EVT-[A-Z0-9-]+$/);
const productIdSchema = z.string().regex(/^PROD-[A-Z0-9-]+$/);
const capabilityIdSchema = z.string().regex(/^CAP-[A-Z0-9-]+$/);
const featureIdSchema = z.string().regex(/^FEAT-[A-Z0-9-]+$/);
const requirementIdSchema = z.string().regex(/^REQ-[A-Z0-9-]+$/);
const acceptanceCriterionIdSchema = z.string().regex(/^AC-[A-Z0-9-]+$/);
const testIdSchema = z.string().regex(/^TEST-[A-Z0-9-]+$/);

export const ENTITY_TYPES = [
  "product",
  "capability",
  "feature",
  "requirement",
  "acceptance_criterion",
  "test",
] as const;

export const entityTypeSchema = z.enum(ENTITY_TYPES);

export const concurrencyPreconditionSchema = z
  .object({
    entity_type: entityTypeSchema,
    entity_id: z.string().min(1),
    expected_revision: z.number().int().positive(),
    expected_last_entity_event_id: eventIdSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const entityIdSchema = entityIdSchemaForType(value.entity_type);
    if (!entityIdSchema.safeParse(value.entity_id).success) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["entity_id"],
        message: `entity_id '${value.entity_id}' is not valid for entity_type '${value.entity_type}'`,
      });
    }
  });

export const concurrencyMetadataSchema = z
  .object({
    preconditions: z.array(concurrencyPreconditionSchema).min(1),
  })
  .strict();

export const metadataSchema = z
  .object({
    concurrency: concurrencyMetadataSchema.optional(),
  })
  .catchall(z.unknown());

export const productCreatedPayloadSchema = z
  .object({
    product_id: productIdSchema,
    name: z.string().min(1),
    description: z.string().min(1),
  })
  .strict();

export const capabilityAddedPayloadSchema = z
  .object({
    capability_id: capabilityIdSchema,
    name: z.string().min(1),
    description: z.string().min(1),
  })
  .strict();

export const featureAddedPayloadSchema = z
  .object({
    feature_id: featureIdSchema,
    capability_id: capabilityIdSchema,
    name: z.string().min(1),
    description: z.string().min(1),
  })
  .strict();

export const requirementAddedPayloadSchema = z
  .object({
    requirement_id: requirementIdSchema,
    feature_id: featureIdSchema,
    description: z.string().min(1),
  })
  .strict();

export const acceptanceCriterionAddedPayloadSchema = z
  .object({
    acceptance_criterion_id: acceptanceCriterionIdSchema,
    requirement_id: requirementIdSchema,
    text: z.string().min(1),
  })
  .strict();

export const featureChangedPayloadSchema = z
  .object({
    feature_id: featureIdSchema,
    description: z.string().min(1),
  })
  .strict();

export const requirementChangedPayloadSchema = z
  .object({
    requirement_id: requirementIdSchema,
    description: z.string().min(1),
  })
  .strict();

export const acceptanceCriterionChangedPayloadSchema = z
  .object({
    acceptance_criterion_id: acceptanceCriterionIdSchema,
    text: z.string().min(1),
  })
  .strict();

export const featureMovedToCapabilityPayloadSchema = z
  .object({
    feature_id: featureIdSchema,
    capability_id: capabilityIdSchema,
  })
  .strict();

export const featureDeprecatedPayloadSchema = z
  .object({
    feature_id: featureIdSchema,
    reason: z.string().min(1),
  })
  .strict();

export const featureStatusChangedPayloadSchema = z
  .object({
    feature_id: featureIdSchema,
    status: z.enum(FEATURE_STATUSES),
    reason: z.string().min(1).optional(),
  })
  .strict();

export const capabilityStatusChangedPayloadSchema = z
  .object({
    capability_id: capabilityIdSchema,
    status: z.enum(CAPABILITY_STATUSES),
    reason: z.string().min(1).optional(),
  })
  .strict();

export const testCreatedPayloadSchema = z
  .object({
    test_id: testIdSchema,
    acceptance_criterion_id: acceptanceCriterionIdSchema,
    file_path: z.string().min(1),
    test_name: z.string().min(1),
  })
  .strict();

const baseEventSchema = z
  .object({
    id: eventIdSchema,
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

function entityIdSchemaForType(entityType: EntityType) {
  switch (entityType) {
    case "product":
      return productIdSchema;
    case "capability":
      return capabilityIdSchema;
    case "feature":
      return featureIdSchema;
    case "requirement":
      return requirementIdSchema;
    case "acceptance_criterion":
      return acceptanceCriterionIdSchema;
    case "test":
      return testIdSchema;
    default:
      return assertNever(entityType);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unexpected entity type: ${JSON.stringify(value)}`);
}

export type EntityType = z.infer<typeof entityTypeSchema>;
export type ConcurrencyPrecondition = z.infer<typeof concurrencyPreconditionSchema>;
export type EventMetadata = z.infer<typeof metadataSchema>;
export type ProductCreatedEvent = z.infer<typeof eventSchema> & {
  type: "ProductCreated";
};
export type ProductEvent = z.infer<typeof eventSchema>;
export type EventType = ProductEvent["type"];
