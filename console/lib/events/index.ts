// Public surface of the events primitive. Import from "@/lib/events" —
// individual modules stay internal so we can move things around without
// breaking callers.

export { newEnvelope } from "./envelope";
export type { Actor, Envelope, NewEnvelopeOpts } from "./envelope";

export { buildSubject, parseSubject } from "./subject";
export type { SubjectParts } from "./subject";

export { publishEvent } from "./publish";
export type { PublishOpts, PublishResult } from "./publish";

export { consume, durableNameFor } from "./consumer";
export type { ConsumeOpts } from "./consumer";

export { registerEnrich } from "./reactions";
export type { EnrichOpts, EnrichResult } from "./reactions";

export { getBudgetMeter } from "./budget";
export type {
  BudgetKey,
  BudgetLimit,
  BudgetMeter,
  BudgetSnapshot,
  Currency,
} from "./budget";
