#!/usr/bin/env node
import { reconcileEvents } from "../reconciliation/reconcileEvents.js";
import { writeReconciliationArtifactsForReport } from "../reconciliation/writeReconciliationArtifacts.js";

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();
  const report = await reconcileEvents({
    baseBranch: requiredArg(args, "base"),
    eventsRoot: singleArg(args, "events-root"),
    cwd,
  });

  if (report.status === "clean") {
    return;
  }

  const result = await writeReconciliationArtifactsForReport(report, {
    cwd,
    outputRoot: singleArg(args, "output-root") ?? singleArg(args, "model-root"),
  });

  process.stdout.write(
    `Reconciliation failed with ${report.conflicting_event_count} conflict(s). Artifacts written to ${result.yamlPath} and ${result.markdownPath}.\n`,
  );
  process.exitCode = 1;
}

function parseArgs(argv: string[]): Record<string, string[]> {
  const parsed: Record<string, string[]> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument '${token}'. Expected flags like --base main`);
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

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
