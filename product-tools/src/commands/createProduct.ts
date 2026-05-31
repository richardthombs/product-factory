import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { DEFAULT_MODEL_ROOT, projectModel } from "../projection/projectModel.js";
import { nextEntityId, nextEventId } from "../util/ids.js";
import { slugify } from "../util/slug.js";
import { DEFAULT_EVENTS_ROOT, validateEvents } from "../validation/validateEvents.js";
import type { ProductEvent } from "../schemas/events.js";
import type { LoadedEvent } from "../validation/types.js";

export type CreateProductOptions = {
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

export type CreateProductResult = {
  productId: string;
  eventId: string;
  file: string;
};

export async function createProduct(options: CreateProductOptions): Promise<CreateProductResult> {
  const eventsRoot = options.eventsRoot ?? DEFAULT_EVENTS_ROOT;
  const modelRoot = options.modelRoot ?? DEFAULT_MODEL_ROOT;
  const actorType = options.actorType ?? "agent";
  const actorId = options.actorId ?? "product_model_steward";
  const existingEvents = await loadExistingEvents(eventsRoot);

  if (existingEvents.length > 0) {
    throw new Error("Cannot create a product because product events already exist");
  }

  const occurredAt = options.occurredAt ?? new Date().toISOString();
  const productId = nextEntityId("PROD", []);
  const eventId = nextEventId(existingEvents, occurredAt);
  const source = buildSource(options.changeProposalId, options.conversationId);

  const event: ProductEvent = {
    id: eventId,
    type: "ProductCreated",
    occurred_at: occurredAt,
    actor: { type: actorType, id: actorId },
    ...(source ? { source } : {}),
    payload: {
      product_id: productId,
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
      productId,
      eventId,
      file,
    };
  } catch (error) {
    await rm(file, { force: true });
    await projectModel(eventsRoot, modelRoot).catch(() => undefined);
    throw error;
  }
}

async function loadExistingEvents(eventsRoot: string): Promise<LoadedEvent[]> {
  try {
    const validation = await validateEvents(eventsRoot);
    if (
      validation.events.length === 0
      && validation.errors.length === 1
      && validation.errors[0].path === eventsRoot
      && validation.errors[0].message === "A ProductCreated event is required"
    ) {
      return [];
    }

    if (validation.errors.length > 0) {
      const details = validation.errors.map((error) => `- ${error.path}: ${error.message}`).join("\n");
      throw new Error(`Cannot create product because the current event stream is invalid:\n${details}`);
    }
    return validation.events;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Could not read event directory")) {
      return [];
    }
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
