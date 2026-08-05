import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock fs to avoid touching the real repo's local/.config.json during tests.
// Uses an in-memory store keyed by path so multiple reads/writes in a test
// behave like a real disk.
const { store, readFile, writeFile, mkdir } = vi.hoisted(() => {
  const store = new Map<string, string>();
  return {
    store,
    readFile: vi.fn(async (path: string) => {
      const v = store.get(path);
      if (v === undefined) {
        const e = new Error("ENOENT") as NodeJS.ErrnoException;
        e.code = "ENOENT";
        throw e;
      }
      return v;
    }),
    writeFile: vi.fn(async (path: string, content: string) => {
      store.set(path, content);
    }),
    mkdir: vi.fn(async () => undefined),
  };
});

vi.mock("node:fs/promises", () => ({ readFile, writeFile, mkdir }));

import {
  readBackupConfig,
  writeBackupConfig,
  repoSlugFrom,
} from "@/lib/backup-config";

beforeEach(() => {
  store.clear();
  readFile.mockClear();
  writeFile.mockClear();
  mkdir.mockClear();
});

afterEach(() => vi.clearAllMocks());

describe("readBackupConfig", () => {
  it("returns disabled default when the file is missing", async () => {
    const cfg = await readBackupConfig();
    expect(cfg).toEqual({ githubBackup: { enabled: false, branch: "main" } });
  });

  it("parses a valid config file", async () => {
    // Seed the mock filesystem at the path readBackupConfig() will look up.
    // Since backup-config resolves relative to process.cwd() + "..", we just
    // capture whatever path the readFile mock was called with in a test write
    // first.
    await writeBackupConfig({
      githubBackup: {
        enabled: true,
        repoUrl: "https://github.com/pypesdev/equity-platform.git",
      },
    });
    const cfg = await readBackupConfig();
    expect(cfg.githubBackup.enabled).toBe(true);
    expect(cfg.githubBackup.repoUrl).toBe(
      "https://github.com/pypesdev/equity-platform.git",
    );
    expect(cfg.githubBackup.branch).toBe("main");
  });

  it("throws on malformed JSON (fails loud, not silent)", async () => {
    // Seed one bad file at the path readBackupConfig will use.
    await writeBackupConfig({ githubBackup: { enabled: false } }); // captures path
    const path = Array.from(store.keys())[0];
    store.set(path, "{not json");
    await expect(readBackupConfig()).rejects.toThrow();
  });
});

describe("writeBackupConfig", () => {
  it("rejects enabled=true without a repoUrl", async () => {
    await expect(
      writeBackupConfig({ githubBackup: { enabled: true } }),
    ).rejects.toThrow(/repoUrl required/);
  });

  it("rejects non-GitHub URLs", async () => {
    await expect(
      writeBackupConfig({
        githubBackup: {
          enabled: true,
          repoUrl: "https://gitlab.com/x/y.git",
        },
      }),
    ).rejects.toThrow(/GitHub HTTPS URL/);
  });

  it("accepts URLs without .git suffix", async () => {
    await expect(
      writeBackupConfig({
        githubBackup: {
          enabled: true,
          repoUrl: "https://github.com/pypesdev/equity-platform",
        },
      }),
    ).resolves.toBeUndefined();
  });

  it("persists disabled without requiring a repoUrl", async () => {
    await writeBackupConfig({ githubBackup: { enabled: false } });
    const cfg = await readBackupConfig();
    expect(cfg.githubBackup.enabled).toBe(false);
  });

  it("normalizes empty branch to 'main'", async () => {
    await writeBackupConfig({
      githubBackup: {
        enabled: true,
        repoUrl: "https://github.com/o/r.git",
        branch: "",
      },
    });
    const cfg = await readBackupConfig();
    expect(cfg.githubBackup.branch).toBe("main");
  });
});

describe("repoSlugFrom", () => {
  it("extracts owner/name from an https URL with .git", () => {
    expect(
      repoSlugFrom({
        githubBackup: {
          enabled: true,
          repoUrl: "https://github.com/pypesdev/equity-platform.git",
        },
      }),
    ).toBe("pypesdev/equity-platform");
  });

  it("extracts owner/name from an https URL without .git", () => {
    expect(
      repoSlugFrom({
        githubBackup: {
          enabled: true,
          repoUrl: "https://github.com/pypesdev/equity-platform",
        },
      }),
    ).toBe("pypesdev/equity-platform");
  });

  it("returns null when backup is disabled", () => {
    expect(
      repoSlugFrom({
        githubBackup: {
          enabled: false,
          repoUrl: "https://github.com/pypesdev/equity-platform",
        },
      }),
    ).toBeNull();
  });
});
