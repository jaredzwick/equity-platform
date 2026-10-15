import { permanentRedirect } from "next/navigation";

// /signup was the legacy name+phone lead-capture surface. It has been
// consolidated into /join (the 90-day acquisition playbook lead magnet)
// so the site presents a single funnel: home meme-funnel → /join opt-in.
// Kept as a 308 so bookmarks, email links, and the deal-page CTAs that
// still shipped before this consolidation don't 404.
export default function SignupRedirect(): never {
  permanentRedirect("/join");
}
