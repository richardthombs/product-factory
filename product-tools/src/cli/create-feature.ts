#!/usr/bin/env node
import path from "node:path";
import { createFeature } from "../commands/createFeature.js";

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const result = await createFeature({
    capabilityId: requiredArg(args, "capability"),
    name: requiredArg(args, "name"),
    description: requiredArg(args, "description"),
    requirementDescription: requiredArg(args, "requirement-description"),
    acceptanceCriterionTexts: args["acceptance-criterion-text"] ?? [],
    actorId: singleArg(args, "actor-id"),
    actorType: singleArg(args, "actor-type") as "agent" | "human" | "system" | undefined,
    changeProposalId: singleArg(args, "change-proposal-id"),
    conversationId: singleArg(args, "conversation-id"),
    occurredAt: singleArg(args, "occurred-at"),
    eventsRoot: resolveOptionalPath(singleArg(args, "events-root")),
    modelRoot: resolveOptionalPath(singleArg(args, "model-root")),
  });

  console.log("Created proposed feature change.");
  console.log(`- feature: ${result.featureId}`);
  console.log(`- requirement: ${result.requirementId}`);
  console.log(`- acceptance criteria: ${result.acceptanceCriterionIds.join(", ")}`);
  console.log(`- events: ${result.eventIds.join(", ")}`);
  for (const file of result.files) {
    console.log(`- wrote: ${file}`);
  }
}

function parseArgs(argv: string[]): Record<string, string[]> {
  const parsed: Record<string, string[]> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument '${token}'. Expected flags like --name value`);
    }

    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }

    parsed[key] ??= [];
    parsed[key].push(value);
    index += 1;
  }

  return parsed;
}

function requiredArg(args: Record<string, string[]>, key: string): string {
  const value = singleArg(args, key);
  if (!value) {
    throw new Error(`Missing required argument --${key}`);
  }
  return value;
}

function singleArg(args: Record<string, string[]>, key: string): string | undefined {
  const values = args[key];
  if (!values || values.length === 0) {
    return undefined;
  }
  if (values.length > 1) {
    throw new Error(`Argument --${key} may only be provided once`);
  }
  return values[0];
}

function resolveOptionalPath(value: string | undefined): string | undefined {
  return value ? path.resolve(process.cwd(), value) : undefined;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
