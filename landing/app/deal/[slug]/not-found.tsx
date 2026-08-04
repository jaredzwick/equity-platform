import Link from "next/link";

export default function DealNotFound() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-32 text-center">
      <div className="text-6xl">🏎️💨</div>
      <h1 className="mt-6 text-3xl font-bold text-white">
        That deal already lambo&rsquo;d.
      </h1>
      <p className="mt-3 text-white/60">
        Either the listing was pulled, the URL is wrong, or someone else got there first.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 px-6 py-3 text-sm font-bold uppercase tracking-wide text-black shadow-lg transition hover:shadow-orange-500/60"
      >
        See fresh deals →
      </Link>
    </div>
  );
}
