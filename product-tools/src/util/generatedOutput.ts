import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";

const GENERATED_DIRECTORIES = [
  "capabilities",
  "features",
  "requirements",
  "acceptance-criteria",
  "tests",
  "indexes",
] as const;

const PRESERVED_ROOT_FILES = new Set([
  "branch-delta.md",
]);

const PRESERVED_INDEX_FILES = new Set([
  "branch-delta.yaml",
  "branch-delta.yml",
]);

export async function prepareModelOutput(modelRoot: string): Promise<void> {
  await mkdir(modelRoot, { recursive: true });

  await Promise.all(
    GENERATED_DIRECTORIES.map(async (directory) => {
      const fullPath = path.join(modelRoot, directory);
      await mkdir(fullPath, { recursive: true });
      await clearDirectory(fullPath);
    }),
  );

  const rootEntries = await readdir(modelRoot, { withFileTypes: true });
  await Promise.all(
    rootEntries
      .filter(
        (entry) => entry.isFile() && (
          entry.name.endsWith(".yaml")
          || entry.name.endsWith(".yml")
          || entry.name.endsWith(".md")
          || entry.name.endsWith(".markdown")
        ),
      )
      .filter((entry) => !PRESERVED_ROOT_FILES.has(entry.name))
      .map((entry) => rm(path.join(modelRoot, entry.name), { force: true })),
  );
}

async function clearDirectory(directory: string): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true });
  const preservedFiles = path.basename(directory) === "indexes" ? PRESERVED_INDEX_FILES : new Set<string>();

  await Promise.all(
    entries
      .filter((entry) => !entry.name.startsWith("."))
      .filter((entry) => !(entry.isFile() && preservedFiles.has(entry.name)))
      .map((entry) => rm(path.join(directory, entry.name), { recursive: true, force: true })),
  );
}
