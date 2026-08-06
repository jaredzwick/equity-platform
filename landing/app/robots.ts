import type { MetadataRoute } from "next";

const SITE_URL = "https://www.lamboapp.com";

// Robots posture per 2026 AI-crawler research:
//   - Allow the SEARCH/USER bots (they route today's answers).
//   - Block the TRAINING bots (they train future models on our
//     aggregated data, which is our moat).
// Sources:
//   - OpenAI: platform.openai.com/docs/bots — OAI-SearchBot = search,
//     ChatGPT-User = user-initiated fetch, GPTBot = training.
//   - Perplexity: docs.perplexity.ai/guides/bots — PerplexityBot =
//     indexing, Perplexity-User = user-initiated (ignores robots.txt
//     but include for hygiene).
//   - Anthropic: support.anthropic.com/en/articles/8896518 —
//     Claude-SearchBot = search index, Claude-User = user fetches for
//     Claude answers, ClaudeBot = training.
//   - Google-Extended: blog.google/technology/ai/an-update-on-web-
//     publisher-controls/ — training-only opt-out, does NOT affect
//     Google Search ranking.
//   - Applebot-Extended: support.apple.com/119829 — same story for
//     Apple Intelligence.
//
// Blocked: /api/ (internal), /onboarding/ (auth-gated flow), /signup
// (transactional form, no SEO value).

export default function robots(): MetadataRoute.Robots {
  const disallow = ["/api/", "/onboarding/", "/signup"];

  return {
    rules: [
      // Baseline for all conventional web crawlers.
      { userAgent: "*", allow: "/", disallow },

      // AI search/user bots — explicitly allowed so we appear in
      // ChatGPT / Perplexity / Claude answers.
      { userAgent: "OAI-SearchBot", allow: "/", disallow },
      { userAgent: "ChatGPT-User", allow: "/", disallow },
      { userAgent: "PerplexityBot", allow: "/", disallow },
      { userAgent: "Perplexity-User", allow: "/", disallow },
      { userAgent: "Claude-SearchBot", allow: "/", disallow },
      { userAgent: "Claude-User", allow: "/", disallow },
      { userAgent: "Applebot", allow: "/", disallow },

      // AI training bots — blocked. This is the "protect the moat"
      // side of the tradeoff. Flip these to Allow if you decide the
      // reach benefit outweighs the training-data leak.
      { userAgent: "GPTBot", disallow: "/" },
      { userAgent: "ClaudeBot", disallow: "/" },
      { userAgent: "CCBot", disallow: "/" },
      { userAgent: "Google-Extended", disallow: "/" },
      { userAgent: "Applebot-Extended", disallow: "/" },
      { userAgent: "anthropic-ai", disallow: "/" },
      { userAgent: "Bytespider", disallow: "/" },
      { userAgent: "ImagesiftBot", disallow: "/" },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
