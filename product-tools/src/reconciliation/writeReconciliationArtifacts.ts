import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { toGeneratedMarkdown } from "../util/markdown.js";
import { toGeneratedYaml } from "../util/yaml.js";
import { reconcileEvents } from "./reconcileEvents.js";
import { renderReconciliationDocument } from "./renderReconciliation.js";
import type { ReconcileEventsOptions, ReconciliationReport } from "./types.js";

export const DEFAULT_RECONCILIATION_OUTPUT_ROOT = "branch-delta";
export const DEFAULT_RECONCILIATION_MARKDOWN_PATH = "reconciliation.md";
export const DEFAULT_RECONCILIATION_YAML_PATH = "reconciliation.yaml";

export type WriteReconciliationArtifactsOptions = ReconcileEventsOptions & {
  outputRoot?: string;
  modelRoot?: string;
};

export type WriteReconciliationArtifactsResult = {
  report: ReconciliationReport;
  markdownPath: string;
  yamlPath: string;
};

export async function writeReconciliationArtifacts(
  options: WriteReconciliationArtifactsOptions,
): Promise<WriteReconciliationArtifactsResult> {
  const report = await reconcileEvents(options);
  return writeReconciliationArtifactsForReport(report, options);
}

export async function writeReconciliationArtifactsForReport(
  report: ReconciliationReport,
  options: Pick<WriteReconciliationArtifactsOptions, "cwd" | "outputRoot" | "modelRoot"> = {},
): Promise<WriteReconciliationArtifactsResult> {
  const cwd = options.cwd ?? process.cwd();
  const outputRoot = path.resolve(cwd, options.outputRoot ?? options.modelRoot ?? DEFAULT_RECONCILIATION_OUTPUT_ROOT);
  const markdownPath = path.join(outputRoot, DEFAULT_RECONCILIATION_MARKDOWN_PATH);
  const yamlPath = path.join(outputRoot, DEFAULT_RECONCILIATION_YAML_PATH);

  await mkdir(path.dirname(markdownPath), { recursive: true });
  await mkdir(path.dirname(yamlPath), { recursive: true });
  await writeFile(markdownPath, toGeneratedMarkdown(renderReconciliationDocument(report)), "utf8");
  await writeFile(yamlPath, toGeneratedYaml(report), "utf8");

  return {
    report,
    markdownPath,
    yamlPath,
  };
}
