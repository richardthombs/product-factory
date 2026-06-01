import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { replayEvents } from "../projection/replay.js";
import { buildConcurrencyMetadata, currentEntityPrecondition, revisionPrecondition } from "./concurrency.js";
import { DEFAULT_MODEL_ROOT, projectModel } from "../projection/projectModel.js";
import { nextEntityId, nextEventId } from "../util/ids.js";
import { slugify } from "../util/slug.js";
import { DEFAULT_EVENTS_ROOT, validateEvents } from "../validation/validateEvents.js";
import type { ProductEvent } from "../schemas/events.js";
import type { LoadedEvent } from "../validation/types.js";

export type CreateRequirementOptions = {
  featureId: string;
  description: string;
  acceptanceCriterionTexts: string[];
  actorId?: string;
  actorType?: "agent" | "human" | "system";
  changeProposalId?: string;
  conversationId?: string;
  eventsRoot?: string;
  modelRoot?: string;
  occurredAt?: string;
};

export type CreateRequirementResult = {
  requirementId: string;
  acceptanceCriterionIds: string[];
  eventIds: string[];
  files: string[];
};

export async function createRequirement(options: CreateRequirementOptions): Promise<CreateRequirementResult> {
  const eventsRoot = options.eventsRoot ?? DEFAULT_EVENTS_ROOT;
  const modelRoot = options.modelRoot ?? DEFAULT_MODEL_ROOT;
  const actorType = options.actorType ?? "agent";
  const actorId = options.actorId ?? "requirement_analyst";
  const validation = await validateEvents(eventsRoot);

  if (validation.errors.length > 0) {
    const details = validation.errors.map((error) => `- ${error.path}: ${error.message}`).join("\n");
    throw new Error(`Cannot create requirement because the current event stream is invalid:\n${details}`);
  }

  const state = replayEvents(validation.events);
  const feature = state.features.get(options.featureId);
  if (!feature) {
    throw new Error(`Feature '${options.featureId}' does not exist`);
  }

  if (options.acceptanceCriterionTexts.length === 0) {
    throw new Error("At least one acceptance criterion text is required");
  }

  const requirementId = nextEntityId(
    "REQ",
    validation.events
      .filter((loaded): loaded is LoadedEvent & { event: Extract<ProductEvent, { type: "RequirementAdded" }> } => loaded.event.type === "RequirementAdded")
      .map(({ event }) => event.payload.requirement_id),
  );

  const existingAcceptanceCriterionIds = validation.events
    .filter((loaded): loaded is LoadedEvent & { event: Extract<ProductEvent, { type: "AcceptanceCriterionAdded" }> } => loaded.event.type === "AcceptanceCriterionAdded")
    .map(({ event }) => event.payload.acceptance_criterion_id);

  const acceptanceCriterionIds: string[] = [];
  let reservedAcceptanceIds = [...existingAcceptanceCriterionIds];
  for (let index = 0; index < options.acceptanceCriterionTexts.length; index += 1) {
    const nextId = nextEntityId("AC", reservedAcceptanceIds);
    acceptanceCriterionIds.push(nextId);
    reservedAcceptanceIds = [...reservedAcceptanceIds, nextId];
  }

  const baseOccurredAt = options.occurredAt ?? new Date().toISOString();
  const occurredAts = buildOccurredAtSequence(baseOccurredAt, 1 + acceptanceCriterionIds.length);
  const source = buildSource(options.changeProposalId, options.conversationId);
  const reservedEventIds: string[] = [];
  const requirementAddedMetadata = buildConcurrencyMetadata([
    currentEntityPrecondition(state, "feature", feature.id),
  ]);

  const events: ProductEvent[] = [
    {
      id: reserveEventId(validation.events, occurredAts[0], reservedEventIds),
      type: "RequirementAdded",
      occurred_at: occurredAts[0],
      actor: { type: actorType, id: actorId },
      ...(source ? { source } : {}),
      ...(requirementAddedMetadata ? { metadata: requirementAddedMetadata } : {}),
      payload: {
        requirement_id: requirementId,
        feature_id: feature.id,
        description: options.description,
      },
    },
    ...acceptanceCriterionIds.map((acceptanceCriterionId, index) => {
      const metadata = buildConcurrencyMetadata([
        revisionPrecondition("requirement", requirementId, index + 1),
      ]);

      return {
        id: reserveEventId(validation.events, occurredAts[index + 1], reservedEventIds),
        type: "AcceptanceCriterionAdded" as const,
        occurred_at: occurredAts[index + 1],
        actor: { type: actorType, id: actorId },
        ...(source ? { source } : {}),
        ...(metadata ? { metadata } : {}),
        payload: {
          acceptance_criterion_id: acceptanceCriterionId,
          requirement_id: requirementId,
          text: options.acceptanceCriterionTexts[index],
        },
      };
    }),
  ];

  const files = buildEventFilePaths(eventsRoot, events);
  const writtenFiles: string[] = [];

  try {
    for (let index = 0; index < events.length; index += 1) {
      const filePath = files[index];
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, YAML.stringify(events[index]), { encoding: "utf8", flag: "wx" });
      writtenFiles.push(filePath);
    }

    await projectModel(eventsRoot, modelRoot);

    return {
      requirementId,
      acceptanceCriterionIds,
      eventIds: events.map((event) => event.id),
      files,
    };
  } catch (error) {
    await Promise.all(writtenFiles.map((filePath) => rm(filePath, { force: true })));
    await projectModel(eventsRoot, modelRoot).catch(() => undefined);
    throw error;
  }
}

function buildOccurredAtSequence(baseOccurredAt: string, count: number): string[] {
  const base = new Date(baseOccurredAt);
  if (Number.isNaN(base.getTime())) {
    throw new Error(`Invalid occurred_at value '${baseOccurredAt}'`);
  }

  return Array.from({ length: count }, (_, index) => new Date(base.getTime() + index * 1000).toISOString());
}

function reserveEventId(existingEvents: LoadedEvent[], occurredAt: string, reservedEventIds: string[]): string {
  const nextId = nextEventId(existingEvents, occurredAt, reservedEventIds);
  reservedEventIds.push(nextId);
  return nextId;
}

function buildSource(changeProposalId?: string, conversationId?: string) {
  const source = {
    ...(changeProposalId ? { change_proposal_id: changeProposalId } : {}),
    ...(conversationId ? { conversation_id: conversationId } : {}),
  };

  return Object.keys(source).length > 0 ? source : undefined;
}

function buildEventFilePaths(eventsRoot: string, events: ProductEvent[]): string[] {
  return events.map((event) => {
    const date = event.occurred_at.slice(0, 10).split("-");
    const typeSlug = slugify(event.type.replace(/([a-z0-9])([A-Z])/g, "$1-$2"));
    return path.join(eventsRoot, date[0], date[1], date[2], `${event.id}-${typeSlug}.yaml`);
  });
}
