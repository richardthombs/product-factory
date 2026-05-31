#!/usr/bin/env node
import path from "node:path";
import { DEFAULT_EVENTS_ROOT } from "../validation/validateEvents.js";
import { DEFAULT_MODEL_ROOT, projectModel } from "../projection/projectModel.js";

async function main(): Promise<void> {
  const [eventsArg, modelArg] = process.argv.slice(2);
  const eventsRoot = eventsArg ? path.resolve(process.cwd(), eventsArg) : DEFAULT_EVENTS_ROOT;
  const modelRoot = modelArg ? path.resolve(process.cwd(), modelArg) : DEFAULT_MODEL_ROOT;
  const summary = await projectModel(eventsRoot, modelRoot);

  console.log(`Projected ${summary.eventCount} event(s) into ${modelRoot}.`);
  console.log(`- capabilities: ${summary.capabilityCount}`);
  console.log(`- features: ${summary.featureCount}`);
  console.log(`- requirements: ${summary.requirementCount}`);
  console.log(`- acceptance criteria: ${summary.acceptanceCriterionCount}`);
  console.log(`- last event: ${summary.lastEventId} @ ${summary.lastOccurredAt}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
