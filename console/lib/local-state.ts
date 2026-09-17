// Host-filesystem persistence for console state that used to live in git.
//
// Motivation: the git write path depends on a valid GitHub App session or a
// long-lived PAT. When either is missing or expired the console gets 401s
// and every save silently loses the operator's data. Local state removes
// that failure mode — writes hit a file on the host, which survives cluster
// teardown and doesn't need any OAuth. Git backup remains opt-in and best-
// effort on top.
//
// Path resolution:
//   EQUITY_STATE_DIR env wins (set explicitly by ./local/up.sh).
//   Fallback: <console-cwd>/../local/.state, which matches the layout on a
//   default clone. This falls back further to $HOME/.equity-console-state
//   so tests running outside the repo don't blow up on the missing parent.

import "server-only";
import { mkdir, readFile, writeFile, readdir, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

let _stateDir: string | null = null;

export function stateDir(): string {
  if (_stateDir) return _stateDir;
  const fromEnv = process.env.EQUITY_STATE_DIR;
  if (fromEnv) {
    _stateDir = resolve(fromEnv);
  } else {
    const guess = resolve(process.cwd(), "..", "local", ".state");
    _stateDir = existsSync(dirname(guess))
      ? guess
      : join(homedir(), ".equity-console-state");
  }
  return _stateDir;
}

export function stateFilePath(rel: string): string {
  return join(stateDir(), rel);
}

export async function readStateFile(rel: string): Promise<string | null> {
  const path = stateFilePath(rel);
  try {
    return await readFile(path, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

export async function writeStateFile(rel: string, content: string): Promise<void> {
  const path = stateFilePath(rel);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
}

export async function deleteStateFile(rel: string): Promise<void> {
  const path = stateFilePath(rel);
  try {
    await unlink(path);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
}

export async function listStateFiles(relDir: string): Promise<string[]> {
  const dir = stateFilePath(relDir);
  try {
    return await readdir(dir);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}
