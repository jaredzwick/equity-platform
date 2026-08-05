// Subject grammar: events.<tenant>.<domain>.<entity>.<action>.v<n>
//
//   <tenant>: k8s-namespace-style slug — [a-z0-9-], no leading/trailing dash.
//   <domain>: business area — "billing", "email", "listing", "agent".
//   <entity>: what the event is about — "invoice", "message", "deal".
//   <action>: past-tense verb — "created", "delivered", "flagged".
//   v<n>:     schema version, v1, v2, ... Version in the SUBJECT (not just
//             the envelope) so consumers can subscribe to one version and
//             ignore others during migrations.
//
// Example: events.pypes.billing.invoice.created.v1
//
// Wildcards for consumer filter subjects follow standard JetStream rules:
//   events.pypes.>                    (all events for pypes)
//   events.*.billing.invoice.created.v1  (cross-tenant, one entity)
//   events.pypes.listing.deal.*.v1    (all deal actions for pypes)
//
// This module handles concrete subjects (build/parse). Wildcard patterns
// are opaque strings passed through to JetStream — we don't try to parse
// them.

const SEGMENT = /^[a-z]([a-z0-9-]*[a-z0-9])?$/;
const VERSION_SUFFIX = /^v[1-9][0-9]*$/;

export type SubjectParts = {
  tenant: string;
  domain: string;
  entity: string;
  action: string;
  version: number;
};

export function buildSubject(p: SubjectParts): string {
  validateSubjectParts(p);
  return `events.${p.tenant}.${p.domain}.${p.entity}.${p.action}.v${p.version}`;
}

// Returns null (rather than throwing) so callers can distinguish
// "not one of our subjects" from "corrupt input" without try/catch.
export function parseSubject(subject: string): SubjectParts | null {
  const parts = subject.split(".");
  if (parts.length !== 6 || parts[0] !== "events") return null;
  const [, tenant, domain, entity, action, versionSeg] = parts;
  if (!VERSION_SUFFIX.test(versionSeg)) return null;
  const p: SubjectParts = {
    tenant,
    domain,
    entity,
    action,
    version: Number(versionSeg.slice(1)),
  };
  try {
    validateSubjectParts(p);
    return p;
  } catch {
    return null;
  }
}

function validateSubjectParts(p: SubjectParts): void {
  const segs: Array<[string, string]> = [
    ["tenant", p.tenant],
    ["domain", p.domain],
    ["entity", p.entity],
    ["action", p.action],
  ];
  for (const [k, v] of segs) {
    if (!SEGMENT.test(v)) {
      throw new Error(`invalid ${k} segment: "${v}" (must match ${SEGMENT})`);
    }
  }
  if (!Number.isInteger(p.version) || p.version < 1) {
    throw new Error(`invalid version: ${p.version} (must be positive integer)`);
  }
}
