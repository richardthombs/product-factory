import { requireEntityRevision } from "../projection/replay.js";
import type { ProductModelState } from "../projection/types.js";
import type { ConcurrencyPrecondition, EntityType, EventMetadata } from "../schemas/events.js";

export function buildConcurrencyMetadata(preconditions: ConcurrencyPrecondition[]): EventMetadata | undefined {
  if (preconditions.length === 0) {
    return undefined;
  }

  return {
    concurrency: {
      preconditions,
    },
  };
}

export function currentEntityPrecondition(
  state: ProductModelState,
  entityType: EntityType,
  entityId: string,
): ConcurrencyPrecondition {
  const revision = requireEntityRevision(state, entityType, entityId);
  return {
    entity_type: entityType,
    entity_id: entityId,
    expected_revision: revision.revision,
  };
}

export function revisionPrecondition(
  entityType: EntityType,
  entityId: string,
  expectedRevision: number,
): ConcurrencyPrecondition {
  return {
    entity_type: entityType,
    entity_id: entityId,
    expected_revision: expectedRevision,
  };
}
