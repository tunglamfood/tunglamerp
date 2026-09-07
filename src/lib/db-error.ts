// Turning what the database says into what the office needs to do about it.
//
// Every failure reaching a screen used to arrive as the raw sentence Supabase
// sent — "JWT issued at future", "relation does not exist" — which tells the
// office nothing and reads like the system is broken. Most of these have a
// plain cause and a plain fix, and both belong in the message.

/** A raw database message, rewritten as something worth reading. */
export function explain(raw: string): string {
  const m = raw.toLowerCase();

  // The two clock errors. A signed request carries the time it was made; if
  // this computer and the database disagree by more than a minute, the database
  // refuses it. Windows syncs its clock only occasionally, so a machine that
  // sleeps a lot drifts and this appears for a while, then stops on its own.
  if (m.includes("issued at future") || m.includes("issued in the future")) {
    return (
      "This computer's clock is running ahead of the database's, so the request was refused. " +
      "It usually clears by itself. If it keeps happening, open Windows Settings → Time & " +
      "language → Date & time and press Sync now."
    );
  }
  if (m.includes("jwt expired") || m.includes("token is expired")) {
    return (
      "This computer's clock is running behind the database's, so the request was refused. " +
      "Open Windows Settings → Time & language → Date & time and press Sync now."
    );
  }

  // The database going to sleep is the single most likely thing to go wrong.
  if (m.includes("paused") || m.includes("project is not active")) {
    return (
      "The database is asleep. Sign in at supabase.com, open the project and press Restore. " +
      "It takes about ten minutes to wake up."
    );
  }

  if (
    m.includes("fetch failed") ||
    m.includes("enotfound") ||
    m.includes("econnrefused") ||
    m.includes("etimedout") ||
    m.includes("network")
  ) {
    return (
      "Could not reach the database. Check this computer is online. If it is, the database " +
      "may be asleep — sign in at supabase.com, open the project and press Restore."
    );
  }

  if (m.includes("invalid api key") || m.includes("no api key")) {
    return "The database key is missing or wrong. It lives in .env.local as SUPABASE_SECRET_KEY.";
  }

  if (m.includes("does not exist") && m.includes("relation")) {
    return `That table has not been created in the database yet. (${raw})`;
  }

  // Anything unrecognised is passed through unchanged rather than smoothed over
  // into something vague — a real message we have not seen before is more use
  // than "something went wrong".
  return raw;
}

/**
 * Throws when the database refused, saying what was being done and why it
 * failed. Shared by every store so the wording cannot drift between them.
 */
export function fail(what: string, error: { message: string } | null): void {
  if (error) throw new Error(`${what}: ${explain(error.message)}`);
}
