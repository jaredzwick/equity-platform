import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  availabilityKey,
  getChartAvailability,
  getManyChartAvailabilities,
} from "@/lib/helm-repo";

const originalFetch = globalThis.fetch;

function mockFetch(impl: (url: string) => Promise<Response> | Response) {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    return impl(url);
  }) as unknown as typeof fetch;
}

function yamlResponse(body: string, opts: { status?: number } = {}): Response {
  return new Response(body, {
    status: opts.status ?? 200,
    headers: { "content-type": "text/yaml" },
  });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

const INDEX = `
apiVersion: v1
entries:
  postgresql:
    - version: "16.0.6"
    - version: "16.0.5"
    - version: "15.2.0"
  redis:
    - version: "20.6.2"
`;

describe("getChartAvailability", () => {
  it("returns 'available' when the pinned version is present", async () => {
    mockFetch(() => yamlResponse(INDEX));
    const result = await getChartAvailability(
      "https://charts.example.com",
      "postgresql",
      "16.0.6",
    );
    expect(result.status).toBe("available");
    if (result.status === "available") {
      expect(result.latestVersion).toBe("16.0.6");
      expect(result.availableVersions).toEqual(["16.0.6", "16.0.5", "15.2.0"]);
    }
  });

  it("returns 'yanked' when the pinned version is missing but chart exists", async () => {
    mockFetch(() => yamlResponse(INDEX));
    const result = await getChartAvailability(
      "https://charts.example.com",
      "postgresql",
      "16.0.4",
    );
    expect(result.status).toBe("yanked");
    if (result.status === "yanked") {
      expect(result.latestVersion).toBe("16.0.6");
    }
  });

  it("returns 'unknown' when the chart is missing from the index", async () => {
    mockFetch(() => yamlResponse(INDEX));
    const result = await getChartAvailability(
      "https://charts.example.com",
      "does-not-exist",
      "1.0.0",
    );
    expect(result.status).toBe("unknown");
    if (result.status === "unknown") {
      expect(result.reason).toContain("not listed");
    }
  });

  it("returns 'unknown' on a non-2xx response (fail-open)", async () => {
    mockFetch(() => yamlResponse("", { status: 404 }));
    const result = await getChartAvailability(
      "https://charts.example.com",
      "postgresql",
      "16.0.6",
    );
    expect(result.status).toBe("unknown");
    if (result.status === "unknown") {
      expect(result.reason).toContain("404");
    }
  });

  it("returns 'unknown' when the network throws (fail-open)", async () => {
    mockFetch(() => {
      throw new Error("ECONNREFUSED");
    });
    const result = await getChartAvailability(
      "https://charts.example.com",
      "postgresql",
      "16.0.6",
    );
    expect(result.status).toBe("unknown");
    if (result.status === "unknown") {
      expect(result.reason).toContain("ECONNREFUSED");
    }
  });

  it("returns 'unknown' on unparseable YAML", async () => {
    mockFetch(() => yamlResponse("{ this is not: valid: yaml: at all"));
    const result = await getChartAvailability(
      "https://charts.example.com",
      "postgresql",
      "16.0.6",
    );
    expect(result.status).toBe("unknown");
    if (result.status === "unknown") {
      expect(result.reason).toContain("parse");
    }
  });

  it("appends /index.yaml to the repo URL (strips trailing slashes)", async () => {
    let requestedUrl = "";
    mockFetch((url) => {
      requestedUrl = url;
      return yamlResponse(INDEX);
    });
    await getChartAvailability(
      "https://charts.example.com/",
      "postgresql",
      "16.0.6",
    );
    expect(requestedUrl).toBe("https://charts.example.com/index.yaml");
  });

  it("sorts versions newest-first by semver", async () => {
    const shuffled = `
apiVersion: v1
entries:
  redis:
    - version: "1.2.3"
    - version: "20.6.2"
    - version: "5.0.0"
    - version: "20.5.10"
`;
    mockFetch(() => yamlResponse(shuffled));
    const result = await getChartAvailability(
      "https://charts.example.com",
      "redis",
      "20.6.2",
    );
    expect(result.status).toBe("available");
    if (result.status === "available") {
      expect(result.availableVersions).toEqual([
        "20.6.2",
        "20.5.10",
        "5.0.0",
        "1.2.3",
      ]);
    }
  });
});

describe("getManyChartAvailabilities", () => {
  it("resolves availability in parallel and keys by repo|chart|version", async () => {
    mockFetch(() => yamlResponse(INDEX));
    const templates = [
      {
        chartRepo: "https://charts.example.com",
        chartName: "postgresql",
        chartVersion: "16.0.6",
      },
      {
        chartRepo: "https://charts.example.com",
        chartName: "redis",
        chartVersion: "20.6.2",
      },
      {
        chartRepo: "https://charts.example.com",
        chartName: "postgresql",
        chartVersion: "15.0.0",
      },
    ];
    const map = await getManyChartAvailabilities(templates);
    expect(map.get(availabilityKey(templates[0]))?.status).toBe("available");
    expect(map.get(availabilityKey(templates[1]))?.status).toBe("available");
    expect(map.get(availabilityKey(templates[2]))?.status).toBe("yanked");
  });
});
