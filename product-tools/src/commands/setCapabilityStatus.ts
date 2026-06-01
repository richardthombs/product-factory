import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { CAPABILITY_STATUSES, type CapabilityStatus } from "../domain/status.js";
import { replayEvents } from "../projection/replay.js";
import { DEFAULT_MODEL_ROOT, projectModel } from "../projection/projectModel.js";
import { nextEventId } from "../util/ids.js";
import { slugify } from "../util/slug.js";
import { DEFAULT_EVENTS_ROOT, validateEvents } from "../validation/validateEvents.js";
import type { ProductEvent } from "../schemas/events.js";
import { buildConcurrencyMetadata, currentEntityPrecondition } from "./concurrency.js";

export type SetCapabilityStatusOptions = {
  capabilityId: string;
  status: CapabilityStatus;
  reason?: string;
  actorId?: string;
  actorType?: "agent" | "human" | "system";
  changeProposalId?: string;
  conversationId?: string;
  eventsRoot?: string;
  modelRoot?: string;
  occurredAt?: string;
};

export type SetCapabilityStatusResult = {
  capabilityId: string;
  status: CapabilityStatus;
  eventId: string;
  file: string;
};

export async function setCapabilityStatus(options: SetCapabilityStatusOptions): Promise<SetCapabilityStatusResult> {
  const eventsRoot = options.eventsRoot ?? DEFAULT_EVENTS_ROOT;
  const modelRoot = options.modelRoot ?? DEFAULT_MODEL_ROOT;
  const actorType = options.actorType ?? "agent";
  const actorId = options.actorId ?? "product_model_steward";
  const validation = await validateEvents(eventsRoot);

  if (validation.errors.length > 0) {
    const details = validation.errors.map((error) => `- ${error.path}: ${error.message}`).join("\n");
    throw new Error(`Cannot set capability status because the current event stream is invalid:\n${details}`);
  }

  const state = replayEvents(validation.events);
  const capability = state.capabilities.get(options.capabilityId);
  if (!capability) {
    throw new Error(`Capability '${options.capabilityId}' does not exist`);
  }

  if (!CAPABILITY_STATUSES.includes(options.status)) {
    throw new Error(`Invalid capability status '${options.status}'. Expected one of: ${CAPABILITY_STATUSES.join(", ")}`);
  }

  if (capability.status === options.status && (options.reason ?? "") === (capability.statusReason ?? "")) {
    throw new Error(`Capability '${capability.id}' already has status '${options.status}'`);
  }

  const occurredAt = options.occurredAt ?? new Date().toISOString();
  if (Number.isNaN(new Date(occurredAt).getTime())) {
    throw new Error(`Invalid occurred_at value '${occurredAt}'`);
  }

  const source = buildSource(options.changeProposalId, options.conversationId);
  const metadata = buildConcurrencyMetadata([
    currentEntityPrecondition(state, "capability", capability.id),
  ]);
  const event: ProductEvent = {
    id: nextEventId(validation.events, occurredAt),
    type: "CapabilityStatusChanged",
    occurred_at: occurredAt,
    actor: { type: actorType, id: actorId },
    ...(source ? { source } : {}),
    ...(metadata ? { metadata } : {}),
    payload: {
      capability_id: capability.id,
      status: options.status,
      ...(options.reason ? { reason: options.reason } : {}),
    },
  };

  const file = buildEventFilePath(eventsRoot, event);

  try {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, YAML.stringify(event), { encoding: "utf8", flag: "wx" });
    await projectModel(eventsRoot, modelRoot);

    return {
      capabilityId: capability.id,
      status: options.status,
      eventId: event.id,
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
