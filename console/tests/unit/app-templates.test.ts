import { describe, expect, it } from "vitest";
import {
  CATEGORIES,
  TEMPLATES,
  getTemplate,
  templatesByCategory,
} from "@/lib/app-templates";

const KEBAB = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
const SEMVER = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/;
const HTTPS_URL = /^https:\/\/[^\s]+$/;

describe("app-templates registry", () => {
  it("has at least one template", () => {
    expect(TEMPLATES.length).toBeGreaterThan(0);
  });

  it("all ids are unique", () => {
    const ids = TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all chart names are unique (needed for duplicate-install guard on the picker)", () => {
    const names = TEMPLATES.map((t) => t.chartName);
    expect(new Set(names).size).toBe(names.length);
  });

  it.each(TEMPLATES.map((t) => [t.id, t]))(
    "template %s has valid shape",
    (_id, t) => {
      expect(t.id, "id must be kebab-case").toMatch(KEBAB);
      expect(t.name, "name must be non-empty").toBeTruthy();
      expect(t.icon, "icon must be non-empty").toBeTruthy();
      expect(CATEGORIES).toContain(t.category);
      expect(t.summary, "summary must be non-empty").toBeTruthy();
      expect(t.chartRepo, "chartRepo must be https URL").toMatch(HTTPS_URL);
      expect(t.chartName, "chartName must be non-empty").toBeTruthy();
      expect(t.chartVersion, "chartVersion must be pinned semver").toMatch(
        SEMVER,
      );
      expect(t.valuesYaml, "valuesYaml must be non-empty").toBeTruthy();
      expect(
        t.valuesYaml.endsWith("\n"),
        "valuesYaml must end with newline (YAML convention)",
      ).toBe(true);
      if (t.defaultNamespace !== undefined) {
        expect(t.defaultNamespace).toMatch(KEBAB);
      }
    },
  );

  it("summaries are short enough for a card (< 100 chars)", () => {
    for (const t of TEMPLATES) {
      expect(t.summary.length, `${t.id} summary too long`).toBeLessThan(100);
    }
  });
});

describe("getTemplate", () => {
  it("returns the matching template", () => {
    const first = TEMPLATES[0];
    expect(getTemplate(first.id)).toBe(first);
  });

  it("returns undefined for unknown id", () => {
    expect(getTemplate("this-template-does-not-exist")).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(getTemplate("")).toBeUndefined();
  });
});

describe("templatesByCategory", () => {
  it("groups every template into exactly one category", () => {
    const grouped = templatesByCategory();
    const flatCount = Object.values(grouped).reduce(
      (sum, list) => sum + list.length,
      0,
    );
    expect(flatCount).toBe(TEMPLATES.length);
  });

  it("has an entry for every category (even empty ones)", () => {
    const grouped = templatesByCategory();
    for (const cat of CATEGORIES) {
      expect(grouped[cat]).toBeDefined();
      expect(Array.isArray(grouped[cat])).toBe(true);
    }
  });
});
