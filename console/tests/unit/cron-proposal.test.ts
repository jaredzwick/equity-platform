import { describe, expect, it } from "vitest";
import { extractCronProposal } from "@/lib/cron-proposal";

describe("extractCronProposal", () => {
  it("returns null when there's no yaml code block", () => {
    expect(extractCronProposal("just some text")).toBeNull();
    expect(extractCronProposal("```json\n{}\n```")).toBeNull();
    expect(extractCronProposal("no code blocks here at all")).toBeNull();
  });

  it("returns null when the yaml block is missing minimum fields", () => {
    const msg = "```yaml\nname: foo\n```"; // no schedule → not a proposal
    expect(extractCronProposal(msg)).toBeNull();
  });

  it("parses a full runner-mode proposal (the CRON_PRIMER canonical shape)", () => {
    const msg = "Here's the proposal:\n\n```yaml\nname: weekly-gsc-audit\ntenant: pypes\nnamespace: pypes-prod\nschedule: \"0 0 * * 0\"\nimage: equity/claude-runner:latest\nconcurrency: Forbid\nprompt: |\n  You are an SEO analyst.\n  Fetch pypes.dev and audit it.\n\n  Output a markdown report.\n```\n\nCommit + apply?";
    const p = extractCronProposal(msg);
    expect(p).not.toBeNull();
    expect(p!.mode).toBe("runner");
    expect(p!.name).toBe("weekly-gsc-audit");
    expect(p!.namespace).toBe("pypes-prod");
    expect(p!.schedule).toBe("0 0 * * 0");
    expect(p!.concurrencyPolicy).toBe("Forbid");
    expect(p!.prompt).toContain("You are an SEO analyst.");
    expect(p!.prompt).toContain("Output a markdown report.");
    // Multi-line prompt preserved
    expect(p!.prompt!.split("\n").length).toBeGreaterThanOrEqual(3);
  });

  it("parses a shell-mode proposal (image + command)", () => {
    const msg = "```yaml\nname: nightly-backup\nschedule: \"0 3 * * *\"\nnamespace: acme-prod\nimage: busybox:1.36\ncommand: \"tar -czf /backup/x.tgz /data\"\n```";
    const p = extractCronProposal(msg);
    expect(p).not.toBeNull();
    expect(p!.mode).toBe("shell");
    expect(p!.image).toBe("busybox:1.36");
    expect(p!.command).toBe("tar -czf /backup/x.tgz /data");
    expect(p!.prompt).toBeUndefined();
  });

  it("prefers the FIRST yaml block when multiple are present", () => {
    const msg = "First proposal:\n```yaml\nname: first\nschedule: \"0 * * * *\"\nprompt: |\n  hello\n```\n\nExample of a bad one:\n```yaml\nname: bad\nschedule: nonsense\n```";
    const p = extractCronProposal(msg);
    expect(p!.name).toBe("first");
  });

  it("strips quotes from quoted scalars", () => {
    const msg = "```yaml\nname: 'quoted-name'\nschedule: \"5 * * * *\"\nprompt: |\n  x\n```";
    const p = extractCronProposal(msg);
    expect(p!.name).toBe("quoted-name");
    expect(p!.schedule).toBe("5 * * * *");
  });

  it("handles |- (strip trailing newline) prompt indicator", () => {
    const msg = "```yaml\nname: x\nschedule: \"* * * * *\"\nprompt: |-\n  single line prompt\n```";
    const p = extractCronProposal(msg);
    expect(p!.prompt).toBe("single line prompt");
  });

  it("preserves internal blank lines within a multi-line prompt", () => {
    const msg = "```yaml\nname: x\nschedule: \"* * * * *\"\nprompt: |\n  line one\n\n  line three\n```";
    const p = extractCronProposal(msg);
    expect(p!.prompt).toBe("line one\n\nline three");
  });

  it("returns the raw yamlBlock so callers can round-trip to the server", () => {
    const msg = "```yaml\nname: x\nschedule: \"* * * * *\"\nprompt: |\n  hi\n```";
    const p = extractCronProposal(msg);
    expect(p!.yamlBlock).toContain("name: x");
    expect(p!.yamlBlock).toContain("prompt: |");
  });

  it("accepts the yml alias for the fence language tag", () => {
    const msg = "```yml\nname: x\nschedule: \"* * * * *\"\nprompt: |\n  x\n```";
    const p = extractCronProposal(msg);
    expect(p).not.toBeNull();
  });

  it("recognizes concurrencyPolicy (full name) alongside the shorter concurrency alias", () => {
    const msg = "```yaml\nname: x\nschedule: \"* * * * *\"\nconcurrencyPolicy: Replace\nprompt: |\n  x\n```";
    const p = extractCronProposal(msg);
    expect(p!.concurrencyPolicy).toBe("Replace");
  });
});
