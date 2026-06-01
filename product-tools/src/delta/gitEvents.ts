import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import YAML from "yaml";
import { ZodError } from "zod";
import { eventSchema } from "../schemas/events.js";
import type { LoadedEvent, ValidationError } from "../validation/types.js";

const execFileAsync = promisify(execFile);

export async function loadGitBranchEvents(baseBranch: string, eventsRoot: string, cwd: string): Promise<LoadedEvent[]> {
  const repoRoot = await getRepoRoot(cwd);
  const eventsRootRelative = normalizeGitPath(path.relative(repoRoot, eventsRoot));
  if (eventsRootRelative.startsWith("..")) {
    throw new Error(`Events root '${eventsRoot}' must be inside the Git repository '${repoRoot}'`);
  }

  const filePaths = await listGitBranchEventFiles(baseBranch, eventsRootRelative, repoRoot);
  const loaded: LoadedEvent[] = [];
  const errors: ValidationError[] = [];

  for (const filePath of filePaths) {
    try {
      const content = await readGitFile(baseBranch, filePath, repoRoot);
      const raw = YAML.parse(content);
      const event = eventSchema.parse(raw);
      loaded.push({
        path: path.resolve(repoRoot, filePath),
        event,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        errors.push(...error.issues.map((issue) => ({
          path: path.resolve(repoRoot, filePath),
          message: `${issue.path.join(".") || "root"}: ${issue.message}`,
        })));
        continue;
      }

      const message = error instanceof Error ? error.message : String(error);
      errors.push({
        path: path.resolve(repoRoot, filePath),
        message,
      });
    }
  }

  if (errors.length > 0) {
    const details = errors.map((error) => `- ${error.path}: ${error.message}`).join("\n");
    throw new Error(`Could not load valid events from branch '${baseBranch}':\n${details}`);
  }

  return loaded;
}

export async function getCurrentBranchName(cwd: string): Promise<string> {
  const { stdout } = await execGit(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
  return stdout.trim();
}

export async function resolveGitRevision(ref: string, cwd: string): Promise<string> {
  const { stdout } = await execGit(["rev-parse", ref], cwd);
  return stdout.trim();
}

async function getRepoRoot(cwd: string): Promise<string> {
  const { stdout } = await execGit(["rev-parse", "--show-toplevel"], cwd);
  return path.resolve(stdout.trim());
}

async function listGitBranchEventFiles(baseBranch: string, eventsRootRelative: string, cwd: string): Promise<string[]> {
  const { stdout } = await execGit(["ls-tree", "-r", "--name-only", baseBranch, "--", eventsRootRelative], cwd);
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.endsWith(".yaml") || line.endsWith(".yml"))
    .sort();
}

async function readGitFile(baseBranch: string, filePath: string, cwd: string): Promise<string> {
  const gitPath = normalizeGitPath(filePath);
  const { stdout } = await execGit(["show", `${baseBranch}:${gitPath}`], cwd, { maxBuffer: 1024 * 1024 * 10 });
  return stdout;
}

async function execGit(
  args: string[],
  cwd: string,
  options: { maxBuffer?: number } = {},
): Promise<{ stdout: string; stderr: string }> {
  try {
    return await execFileAsync("git", args, { cwd, maxBuffer: options.maxBuffer });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`git ${args.join(" ")} failed: ${message}`);
  }
}

function normalizeGitPath(value: string): string {
  return value.replaceAll("\\", "/");
}
