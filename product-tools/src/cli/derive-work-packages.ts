#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { writeWorkPackageArtifacts } from "../work-packages/writeWorkPackageArtifacts.js";

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const result = await writeWorkPackageArtifacts({
    baseBranch: requiredArg(args, "base"),
    eventsRoot: singleArg(args, "events-root"),
    outputRoot: singleArg(args, "output-root") ?? singleArg(args, "model-root"),
  });

  console.log(`Wrote work-package YAML to ${result.yamlPath}`);
  console.log(`Wrote work-package markdown to ${result.markdownPath}`);

  const format = singleArg(args, "format");
  if (!format) {
    return;
  }

  const output = singleArg(args, "output");
  const rendered = renderReport(result.report, format);

  if (output) {
    const outputPath = path.resolve(process.cwd(), output);
    await writeFile(outputPath, rendered, "utf8");
    console.log(`Wrote work-package report to ${outputPath}`);
    return;
  }

  process.stdout.write(rendered);
  if (!rendered.endsWith("\n")) {
    process.stdout.write("\n");
  }
}

function renderReport(report: Awaited<ReturnType<typeof writeWorkPackageArtifacts>>["report"], format: string): string {
  switch (format) {
    case "yaml":
      return YAML.stringify(report);
    case "json":
      return `${JSON.stringify(report, null, 2)}\n`;
    case "text":
      return [
        `Base branch: ${report.base_branch}`,
        `Current branch: ${report.current_branch}`,
        `Product: ${report.product_id}`,
        `Branch-only events: ${report.source_branch_delta.branch_only_event_count}`,
        `Change categories: ${report.source_branch_delta.change_categories.join(", ") || "none"}`,
        `Work packages: ${report.work_packages.length}`,
        ...report.work_packages.map((workPackage) => `- ${workPackage.work_package_id} ${workPackage.title}`),
        "",
      ].join("\n");
    default:
      throw new Error(`Unsupported format '${format}'. Expected yaml, json, or text.`);
  }
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
