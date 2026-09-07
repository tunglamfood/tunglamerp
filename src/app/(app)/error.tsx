"use client";
// What you see instead of a blank screen when something inside the app breaks.
//
// Written for the office, not for a developer: it says what did not happen, and
// gives one button that usually fixes it. The technical detail is kept, but
// folded away, because it is only useful when reporting the problem.
import { useEffect, useState } from "react";
import Link from "next/link";
import { Btn, Card } from "@/components/ui";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showDetail, setShowDetail] = useState(false);

  // Kept in the browser console too, so it survives the page being reset.
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl py-10">
      <Card className="p-7">
        <h1 className="text-xl font-extrabold tracking-tight">This screen could not load</h1>
        <p className="mt-2 text-sm text-mute">
          Nothing was changed and nothing was lost. It is usually the connection to the
          database dropping for a moment.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <Btn onClick={reset}>Try again</Btn>
          <Link href="/home">
            <Btn kind="ghost">Back to the dashboard</Btn>
          </Link>
        </div>

        <p className="mt-5 text-xs text-mute">
          If it keeps happening, the database may be asleep. Sign in at supabase.com,
          open the project and press Restore — it takes about ten minutes to wake up.
        </p>

        <button
          onClick={() => setShowDetail((v) => !v)}
          className="mt-5 text-xs font-semibold text-faint underline underline-offset-2"
        >
          {showDetail ? "Hide the technical detail" : "Show the technical detail"}
        </button>
        {showDetail && (
          <pre className="mt-3 max-h-56 overflow-auto rounded-xl bg-gray-50 p-3 text-[11px] leading-relaxed text-mute">
            {error.message}
            {error.digest ? `\n\nReference: ${error.digest}` : ""}
          </pre>
        )}
      </Card>
    </div>
  );
}
