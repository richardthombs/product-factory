import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { toGeneratedMarkdown } from "../util/markdown.js";
import { toGeneratedYaml } from "../util/yaml.js";
import { branchDelta } from "./branchDelta.js";
import { renderBranchDeltaDocument } from "./renderBranchDelta.js";
import type { BranchDeltaOptions, BranchDeltaReport } from "./types.js";

export const DEFAULT_BRANCH_DELTA_OUTPUT_ROOT = "branch-delta";
export const DEFAULT_BRANCH_DELTA_MARKDOWN_PATH = "branch-delta.md";
export const DEFAULT_BRANCH_DELTA_YAML_PATH = "branch-delta.yaml";

export type WriteBranchDeltaArtifactsOptions = BranchDeltaOptions & {
  outputRoot?: string;
  modelRoot?: string;
};

export type WriteBranchDeltaArtifactsResult = {
  report: BranchDeltaReport;
  markdownPath: string;
  yamlPath: string;
};

export async function writeBranchDeltaArtifacts(options: WriteBranchDeltaArtifactsOptions): Promise<WriteBranchDeltaArtifactsResult> {
  const cwd = options.cwd ?? process.cwd();
  const outputRoot = path.resolve(cwd, options.outputRoot ?? options.modelRoot ?? DEFAULT_BRANCH_DELTA_OUTPUT_ROOT);
  const report = await branchDelta(options);
  const markdownPath = path.join(outputRoot, DEFAULT_BRANCH_DELTA_MARKDOWN_PATH);
  const yamlPath = path.join(outputRoot, DEFAULT_BRANCH_DELTA_YAML_PATH);

  await mkdir(path.dirname(markdownPath), { recursive: true });
  await mkdir(path.dirname(yamlPath), { recursive: true });
  await writeFile(markdownPath, toGeneratedMarkdown(renderBranchDeltaDocument(report)), "utf8");
  await writeFile(yamlPath, toGeneratedYaml(report), "utf8");

  return {
    report,
    markdownPath,
    yamlPath,
  };
}
