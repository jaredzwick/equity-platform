// Server-only wrapper for OpenAI image generation. Uses gpt-image-1 — the
// current best model for logos + graphic design. Returns base64 PNG so the
// caller can preview immediately and (on save) commit the bytes to git.

import "server-only";

const OPENAI_API = "https://api.openai.com/v1";

export type LogoSize = "1024x1024" | "1024x1536" | "1536x1024" | "auto";
export type LogoQuality = "low" | "medium" | "high" | "auto";

export async function generateLogo(args: {
  prompt: string;
  size?: LogoSize;
  quality?: LogoQuality;
}): Promise<{ b64: string }> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not set in console/.env.local");

  const res = await fetch(`${OPENAI_API}/images/generations`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt: args.prompt,
      size: args.size ?? "1024x1024",
      quality: args.quality ?? "high",
      n: 1,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI images ${res.status}: ${body.slice(0, 400)}`);
  }
  const data = (await res.json()) as { data?: Array<{ b64_json?: string }> };
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI returned no image data");
  return { b64 };
}

// Build the model-facing prompt from business profile + user directive.
// The business context is prepended so every regenerate stays on-brand.
export function buildLogoPrompt(args: {
  displayName: string;
  legalName?: string;
  tagline?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  voice?: string;
  offer?: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  directive: string;
}): string {
  const brandLines: string[] = [];
  brandLines.push(`Business: ${args.displayName}${args.legalName ? ` (${args.legalName})` : ""}`);
  if (args.tagline) brandLines.push(`Tagline: ${args.tagline}`);
  if (args.offer) brandLines.push(`What they sell: ${args.offer}`);
  if (args.voice) brandLines.push(`Voice / tone: ${args.voice}`);

  // Drop the palette entirely if every color is a degenerate default
  // (all-black or all-white). Those are placeholder values and cause
  // black-on-black / white-on-white logos.
  const hexes = [args.primaryColor, args.secondaryColor, args.accentColor].filter(
    (c): c is string => typeof c === "string" && c.length > 0,
  );
  const degenerate = hexes.length > 0
    && hexes.every((h) => /^#0{3,6}$/i.test(h) || /^#f{3,6}$/i.test(h));
  if (hexes.length > 0 && !degenerate) {
    const labels = [
      args.primaryColor && `primary ${args.primaryColor}`,
      args.secondaryColor && `secondary ${args.secondaryColor}`,
      args.accentColor && `accent ${args.accentColor}`,
    ].filter(Boolean);
    brandLines.push(`Palette (use for the MARK only, NOT the background): ${labels.join(", ")}`);
  } else {
    brandLines.push(
      "Palette: pick colors that fit the offer, voice, and industry. Prefer a distinctive, memorable palette (not all-black, not all-gray).",
    );
  }

  const priorPrompts = args.history
    .filter((m) => m.role === "user")
    .map((m, i) => `  ${i + 1}. ${m.content}`)
    .join("\n");

  return [
    "Design a logo for the following business.",
    "",
    ...brandLines,
    "",
    "Hard constraints (do not violate):",
    "- Render the mark centered on a SOLID WHITE (#ffffff) background. The background must be pure white unless the current directive explicitly asks for a colored or transparent background.",
    "- Ensure strong visual contrast between the mark and the white background. Do NOT produce an all-black mark against a black background, or a white mark against a white background.",
    "- Single, iconic mark — no photorealism, no stock-photo textures.",
    "- Legible at 32px favicon size AND at 1024px poster size.",
    "- No text or letterforms unless the directive explicitly asks for a wordmark.",
    "",
    "Style guidance:",
    "- Modern, distinctive, professional — avoid AI clichés (concentric circles, generic swooshes, glowing orbs).",
    "- Prefer flat vector-style shapes with clean edges; no gradients unless the directive asks.",
    "",
    priorPrompts ? `Previous iteration directives (for continuity, treat as accumulated context):\n${priorPrompts}` : "",
    `Current directive: ${args.directive}`,
  ]
    .filter(Boolean)
    .join("\n");
}
