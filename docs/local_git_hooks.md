# Local Git Hooks for Gating Merges to `main`

## Purpose

This repository can be locally configured to gate pushes or local merge commits targeting `main`.

These hooks are intended to catch stale product-event proposals before they are pushed or merged locally.

They are helpful for local discipline, but they do **not** replace CI.

CI should still be treated as the authoritative merge gate.

---

## Hooks Provided

The repository includes two local hook scripts under `.githooks/`:

- `.githooks/pre-push`
- `.githooks/pre-merge-commit`

---

## Install

From the repository root, configure Git to use the committed hooks directory:

```bash
git config core.hooksPath .githooks
```

This is a local Git setting for your clone.

You can verify it with:

```bash
git config --get core.hooksPath
```

Expected output:

```text
.githooks
```

---

## `pre-push`

### When it runs

Git runs `pre-push` before refs are pushed to a remote.

### What this hook does

This hook only gates pushes that target:

```text
refs/heads/main
```

For pushes to `main`, it runs:

```bash
git fetch <remote> main --quiet
npm test
npm run rebuild
npm run reconcile-events -- --base <remote>/main
```

If any step fails, the push is blocked.

### Intended use

Use this to stop local pushes to `main` when:

- tests fail
- generated product-model output is stale
- reconciliation against the latest remote `main` is not clean

---

## `pre-merge-commit`

### When it runs

Git runs `pre-merge-commit` before creating a merge commit.

### What this hook does

This hook only gates merge commits created while `HEAD` is on:

```text
main
```

When merging into local `main`, it runs:

```bash
git fetch origin main --quiet
npm test
npm run rebuild
npm run reconcile-events -- --base origin/main
```

If any step fails, the merge commit is blocked.

### Intended use

Use this to stop local merges into `main` when:

- tests fail
- product-model regeneration is stale or broken
- reconciliation against the latest accepted `origin/main` is not clean

---

## Configuration

Both hooks support simple environment overrides.

### Target branch

Default:

```text
main
```

Override with:

```bash
GIT_MAIN_GATE_BRANCH=<branch>
```

### Remote used by `pre-merge-commit`

Default:

```text
origin
```

Override with:

```bash
GIT_MAIN_GATE_REMOTE=<remote>
```

`pre-push` uses the remote Git passes to the hook.

---

## Important Notes

1. These hooks are local-only.
2. They are not automatically active until `core.hooksPath` is configured.
3. They can be bypassed locally, so CI must still enforce:

```bash
npm run reconcile-events -- --base origin/main
```

4. The reconciliation command currently behaves as follows:
   - clean reconciliation: exits successfully and produces no stdout/stderr or artifacts
   - non-clean reconciliation: exits non-zero, writes a stdout message, and writes reconciliation artifacts under `branch-delta/`

---

## Recommended Policy

Use these hooks for local discipline, but treat CI as the real merge gate.

Recommended CI command:

```bash
npm test
npm run rebuild
npm run reconcile-events -- --base origin/main
```
