// Parses the AI-generated deal thesis (a paragraph blob with predictable
// "Label:" section headers) into structured cards. Falls back to rendering
// the raw text as a single card when no known headers are present, so
// nothing goes missing if the ingestion prompt changes.

type SectionKey = "overview" | "financials" | "fit" | "questions" | "other";

type Section = {
  key: SectionKey;
  label: string;
  icon: string;
  accent: string; // Tailwind classes for border/bg/icon tint
  body: string;
};

// Header patterns → section metadata. Case-insensitive prefix match at the
// start of a sentence. Order matters — first match wins.
const HEADER_PATTERNS: Array<{
  regex: RegExp;
  key: SectionKey;
  label: string;
  icon: string;
  accent: string;
}> = [
  {
    regex: /^(what you'?re looking at|overview|the business|about this listing)\s*:/i,
    key: "overview",
    label: "Overview",
    icon: "🔎",
    accent: "border-white/10 bg-white/[0.02] text-white/50",
  },
  {
    regex: /^(financial(?: snapshot)?|financials|the numbers|by the numbers)\s*:/i,
    key: "financials",
    label: "Financials",
    icon: "💰",
    accent: "border-yellow-400/25 bg-yellow-400/[0.04] text-yellow-300",
  },
  {
    regex: /^(fit(?: and next steps)?|assessment|our take|verdict)\s*:/i,
    key: "fit",
    label: "Fit assessment",
    icon: "🎯",
    accent: "border-orange-400/25 bg-orange-400/[0.04] text-orange-300",
  },
  {
    regex: /^(if interested|questions to ask|what to ask|next steps|due diligence)\s*[,:]/i,
    key: "questions",
    label: "What to ask next",
    icon: "✉️",
    accent: "border-emerald-400/25 bg-emerald-400/[0.04] text-emerald-300",
  },
];

// Split the thesis on sentence-start "Label:" boundaries. We look for two
// newlines OR a period+space before a known header (the model tends to
// emit either format).
function parseThesis(text: string): Section[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // Build a combined regex that matches ANY known header, anywhere. Split
  // on those matches while capturing them, then reassemble as
  // [header, body, header, body, ...].
  const combined = HEADER_PATTERNS.map((p) => p.regex.source.replace(/^\^/, ""))
    .map((s) => `(?:${s})`)
    .join("|");
  const splitRegex = new RegExp(`(?:^|(?:\\n{1,2}|\\.\\s+))(?=${combined})`, "i");

  const parts = trimmed.split(splitRegex).map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return [];

  const sections: Section[] = [];
  for (const part of parts) {
    const match = HEADER_PATTERNS.find((p) => p.regex.test(part));
    if (match) {
      // Strip the "Label:" prefix from the body so we don't render it twice.
      const body = part.replace(match.regex, "").replace(/^[\s:,]+/, "").trim();
      sections.push({ ...match, body });
    } else {
      sections.push({
        key: "other",
        label: "Note",
        icon: "📝",
        accent: "border-white/10 bg-white/[0.02] text-white/50",
        body: part,
      });
    }
  }
  return sections;
}

export default function DealThesis({ thesis }: { thesis: string }) {
  const sections = parseThesis(thesis);

  // Fallback: no recognizable headers → render the raw thesis as one card
  // with the existing visual language. Never drop content silently.
  if (sections.length === 0 || (sections.length === 1 && sections[0].key === "other")) {
    return (
      <section className="mt-12 rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
        <div className="mb-3 text-xs font-mono uppercase tracking-widest text-yellow-400">
          The thesis
        </div>
        <p className="text-lg leading-relaxed text-white/90">{thesis}</p>
      </section>
    );
  }

  return (
    <section className="mt-12">
      <div className="mb-4 flex items-baseline justify-between">
        <div className="text-xs font-mono uppercase tracking-widest text-yellow-400">
          The thesis
        </div>
        <div className="text-[11px] text-white/30">
          AI-generated · {sections.length} section{sections.length === 1 ? "" : "s"}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((s, i) => (
          <article
            key={`${s.key}-${i}`}
            className={
              "rounded-2xl border p-5 md:p-6 transition-colors " +
              (s.key === "fit"
                ? "md:col-span-2 " + s.accent
                : s.accent)
            }
          >
            <div className="mb-3 flex items-center gap-2.5">
              <span
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-base"
                aria-hidden
              >
                {s.icon}
              </span>
              <div className="text-[11px] font-mono uppercase tracking-widest">
                {s.label}
              </div>
            </div>
            <p className="text-[15px] leading-relaxed text-white/85">{s.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
