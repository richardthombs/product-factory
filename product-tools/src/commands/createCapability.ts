import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { DEFAULT_MODEL_ROOT, projectModel } from "../projection/projectModel.js";
import { nextEntityId, nextEventId } from "../util/ids.js";
import { slugify } from "../util/slug.js";
import { DEFAULT_EVENTS_ROOT, validateEvents } from "../validation/validateEvents.js";
import type { ProductEvent } from "../schemas/events.js";

export type CreateCapabilityOptions = {
  name: string;
  description: string;
  actorId?: string;
  actorType?: "agent" | "human" | "system";
  changeProposalId?: string;
  conversationId?: string;
  eventsRoot?: string;
  modelRoot?: string;
  occurredAt?: string;
};

export type CreateCapabilityResult = {
  capabilityId: string;
  eventId: string;
  file: string;
};

export async function createCapability(options: CreateCapabilityOptions): Promise<CreateCapabilityResult> {
  const eventsRoot = options.eventsRoot ?? DEFAULT_EVENTS_ROOT;
  const modelRoot = options.modelRoot ?? DEFAULT_MODEL_ROOT;
  const actorType = options.actorType ?? "agent";
  const actorId = options.actorId ?? "capability_modeller";
  const validation = await validateEvents(eventsRoot);

  if (validation.errors.length > 0) {
    const details = validation.errors.map((error) => `- ${error.path}: ${error.message}`).join("\n");
    throw new Error(`Cannot create capability because the current event stream is invalid:\n${details}`);
  }

  const occurredAt = options.occurredAt ?? new Date().toISOString();
  const capabilityId = nextEntityId(
    "CAP",
    validation.events
      .filter(({ event }) => event.type === "CapabilityAdded")
      .map(({ event }) => event.payload.capability_id),
  );
  const eventId = nextEventId(validation.events, occurredAt);
  const source = buildSource(options.changeProposalId, options.conversationId);

  const event: ProductEvent = {
    id: eventId,
    type: "CapabilityAdded",
    occurred_at: occurredAt,
    actor: { type: actorType, id: actorId },
    ...(source ? { source } : {}),
    payload: {
      capability_id: capabilityId,
      name: options.name,
      description: options.description,
    },
  };

  const file = buildEventFilePath(eventsRoot, event);

  try {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, YAML.stringify(event), { encoding: "utf8", flag: "wx" });
    await projectModel(eventsRoot, modelRoot);

    return {
      capabilityId,
      eventId,
      file,
    };
  } catch (error) {
    await rm(file, { force: true });
    await projectModel(eventsRoot, modelRoot).catch(() => undefined);
    throw error;
  }
}

function buildSource(changeProposalId?: string, conversationId?: string) {
  const source = {
    ...(changeProposalId ? { change_proposal_id: changeProposalId } : {}),
    ...(conversationId ? { conversation_id: conversationId } : {}),
  };

  return Object.keys(source).length > 0 ? source : undefined;
}

function buildEventFilePath(eventsRoot: string, event: ProductEvent): string {
  const [year, month, day] = event.occurred_at.slice(0, 10).split("-");
  const typeSlug = slugify(event.type.replace(/([a-z0-9])([A-Z])/g, "$1-$2"));
  return path.join(eventsRoot, year, month, day, `${event.id}-${typeSlug}.yaml`);
}
