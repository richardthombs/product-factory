#!/usr/bin/env node
import path from "node:path";
import { summarizeEvents, validateEvents } from "../validation/validateEvents.js";

async function main(): Promise<void> {
  const inputPath = process.argv[2];
  const eventsRoot = inputPath ? path.resolve(process.cwd(), inputPath) : undefined;
  const { events, errors } = await validateEvents(eventsRoot);

  if (errors.length > 0) {
    console.error(`Event validation failed with ${errors.length} error(s):`);
    for (const error of errors) {
      console.error(`- ${error.path}: ${error.message}`);
    }
    process.exitCode = 1;
    return;
  }

  const summary = summarizeEvents(events);
  console.log(`Validated ${events.length} event file(s) successfully.`);
  for (const [eventType, count] of Object.entries(summary)) {
    console.log(`- ${eventType}: ${count}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
