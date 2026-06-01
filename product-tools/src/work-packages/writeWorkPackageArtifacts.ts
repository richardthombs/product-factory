import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { toGeneratedMarkdown } from "../util/markdown.js";
import { toGeneratedYaml } from "../util/yaml.js";
import { renderWorkPackagesDocument } from "./renderWorkPackages.js";
import { deriveWorkPackages } from "./deriveWorkPackages.js";
import type { DeriveWorkPackagesOptions, WorkPackageReport } from "./types.js";

export const DEFAULT_WORK_PACKAGES_OUTPUT_ROOT = "branch-delta";
export const DEFAULT_WORK_PACKAGES_MARKDOWN_PATH = "work-packages.md";
export const DEFAULT_WORK_PACKAGES_YAML_PATH = "work-packages.yaml";

export type WriteWorkPackageArtifactsOptions = DeriveWorkPackagesOptions & {
  outputRoot?: string;
  modelRoot?: string;
};

export type WriteWorkPackageArtifactsResult = {
  report: WorkPackageReport;
  markdownPath: string;
  yamlPath: string;
};

export async function writeWorkPackageArtifacts(
  options: WriteWorkPackageArtifactsOptions,
): Promise<WriteWorkPackageArtifactsResult> {
  const cwd = options.cwd ?? process.cwd();
  const outputRoot = path.resolve(cwd, options.outputRoot ?? options.modelRoot ?? DEFAULT_WORK_PACKAGES_OUTPUT_ROOT);
  const report = await deriveWorkPackages(options);
  const markdownPath = path.join(outputRoot, DEFAULT_WORK_PACKAGES_MARKDOWN_PATH);
  const yamlPath = path.join(outputRoot, DEFAULT_WORK_PACKAGES_YAML_PATH);

  await mkdir(path.dirname(markdownPath), { recursive: true });
  await mkdir(path.dirname(yamlPath), { recursive: true });
  await writeFile(markdownPath, toGeneratedMarkdown(renderWorkPackagesDocument(report)), "utf8");
  await writeFile(yamlPath, toGeneratedYaml(report), "utf8");

  return {
    report,
    markdownPath,
    yamlPath,
  };
}
