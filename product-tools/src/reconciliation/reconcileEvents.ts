import path from "node:path";
import { getCurrentBranchName, loadGitBranchEvents, resolveGitRevision } from "../delta/gitEvents.js";
import { getEntityRevision, replayEvents } from "../projection/replay.js";
import { compareLoadedEvents, validateEvents, validateLoadedEvents } from "../validation/validateEvents.js";
import type { LoadedEvent } from "../validation/types.js";
import type { ProductModelState } from "../projection/types.js";
import type { ConcurrencyPrecondition } from "../schemas/events.js";
import type { ReconcileEventsOptions, ReconciliationConflict, ReconciliationReport } from "./types.js";

export async function reconcileEvents(options: ReconcileEventsOptions): Promise<ReconciliationReport> {
  const cwd = options.cwd ?? process.cwd();
  const eventsRoot = path.resolve(cwd, options.eventsRoot ?? "product-events");
  const currentValidation = await validateEvents(eventsRoot);
  if (currentValidation.errors.length > 0) {
    const details = currentValidation.errors.map((error) => `- ${error.path}: ${error.message}`).join("\n");
    throw new Error(`Current branch events are invalid:\n${details}`);
  }

  const baseLoadedEvents = await loadGitBranchEvents(options.baseBranch, eventsRoot, cwd);
  const baseValidation = await validateLoadedEvents(baseLoadedEvents, `${options.baseBranch}:${eventsRoot}`);
  if (baseValidation.errors.length > 0) {
    const details = baseValidation.errors.map((error) => `- ${error.path}: ${error.message}`).join("\n");
    throw new Error(`Base branch events are invalid:\n${details}`);
  }

  const currentState = replayEvents(currentValidation.events);
  const baseState = baseValidation.events.length > 0 ? replayEvents(baseValidation.events) : null;
  const baseEventIds = new Set(baseValidation.events.map(({ event }) => event.id));
  const branchOnlyEvents = currentValidation.events
    .filter(({ event }) => !baseEventIds.has(event.id))
    .sort(compareLoadedEvents);

  const appliedEvents = [...baseValidation.events];
  let replayState: ProductModelState | null = baseState;
  const cleanEventIds: string[] = [];
  const conflicts: ReconciliationConflict[] = [];
  let checkedEventCount = 0;

  for (const loaded of branchOnlyEvents) {
    checkedEventCount += 1;
    const eventConflicts = reconcilePreconditions(loaded, replayState, baseState, cwd);
    if (eventConflicts.length > 0) {
      conflicts.push(...eventConflicts);
      break;
    }

    appliedEvents.push(loaded);
    replayState = replayEvents(appliedEvents);
    cleanEventIds.push(loaded.event.id);
  }

  return {
    base_branch: options.baseBranch,
    current_branch: await getCurrentBranchName(cwd),
    base_commit: await resolveGitRevision(options.baseBranch, cwd),
    product_id: currentState.product.id,
    events_root: path.relative(cwd, eventsRoot).replaceAll("\\", "/") || "product-events",
    base_event_count: baseValidation.events.length,
    current_event_count: currentValidation.events.length,
    branch_only_event_count: branchOnlyEvents.length,
    checked_event_count: checkedEventCount,
    clean_event_count: cleanEventIds.length,
    conflicting_event_count: conflicts.length,
    status: conflicts.length > 0 ? "conflicts" : "clean",
    clean_event_ids: cleanEventIds,
    conflicts,
    next_action: conflicts.length > 0 ? "manual_reconcile_required" : "none",
  };
}

function reconcilePreconditions(
  loaded: LoadedEvent,
  replayState: ProductModelState | null,
  baseState: ProductModelState | null,
  cwd: string,
): ReconciliationConflict[] {
  const preconditions = loaded.event.metadata?.concurrency?.preconditions ?? [];

  return preconditions
    .map((precondition) => buildConflict(loaded, precondition, replayState, baseState, cwd))
    .filter((conflict): conflict is ReconciliationConflict => conflict !== null);
}

function buildConflict(
  loaded: LoadedEvent,
  precondition: ConcurrencyPrecondition,
  replayState: ProductModelState | null,
  baseState: ProductModelState | null,
  cwd: string,
): ReconciliationConflict | null {
  const currentRevision = replayState
    ? getEntityRevision(replayState, precondition.entity_type, precondition.entity_id)
    : undefined;
  const acceptedRevision = baseState
    ? getEntityRevision(baseState, precondition.entity_type, precondition.entity_id)
    : undefined;

  const actualRevision = currentRevision?.revision ?? 0;
  const actualLastAcceptedEntityEventId = acceptedRevision?.lastEventId;
  const revisionMatches = actualRevision === precondition.expected_revision;
  const lastAcceptedEventMatches = precondition.expected_last_entity_event_id === undefined
    || precondition.expected_last_entity_event_id === actualLastAcceptedEntityEventId;

  if (revisionMatches && lastAcceptedEventMatches) {
    return null;
  }

  return {
    event_id: loaded.event.id,
    event_type: loaded.event.type,
    file_path: path.relative(cwd, loaded.path).replaceAll("\\", "/"),
    entity_type: precondition.entity_type,
    entity_id: precondition.entity_id,
    expected_revision: precondition.expected_revision,
    actual_revision: actualRevision,
    ...(precondition.expected_last_entity_event_id
      ? { expected_last_entity_event_id: precondition.expected_last_entity_event_id }
      : {}),
    ...(actualLastAcceptedEntityEventId
      ? { actual_last_entity_event_id: actualLastAcceptedEntityEventId }
      : {}),
    resolution: "manual_reconcile_required",
  };
}
