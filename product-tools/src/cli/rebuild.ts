#!/usr/bin/env node
import path from "node:path";
import { rebuildModel } from "../commands/rebuildModel.js";
import { DEFAULT_EVENTS_ROOT } from "../validation/validateEvents.js";
import { DEFAULT_MODEL_ROOT } from "../projection/projectModel.js";

async function main(): Promise<void> {
  const [eventsArg, modelArg] = process.argv.slice(2);
  const eventsRoot = eventsArg ? path.resolve(process.cwd(), eventsArg) : DEFAULT_EVENTS_ROOT;
  const modelRoot = modelArg ? path.resolve(process.cwd(), modelArg) : DEFAULT_MODEL_ROOT;
  const summary = await rebuildModel(eventsRoot, modelRoot);

  console.log("Rebuild completed successfully.");
  console.log(`- events: ${summary.eventCount}`);
  console.log(`- capabilities: ${summary.capabilityCount}`);
  console.log(`- features: ${summary.featureCount}`);
  console.log(`- requirements: ${summary.requirementCount}`);
  console.log(`- acceptance criteria: ${summary.acceptanceCriterionCount}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
