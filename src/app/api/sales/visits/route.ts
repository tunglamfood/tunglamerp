// A visit's photos, as short-lived links.
import { visitPhotoUrls } from "@/lib/store-visits";
import { attempt, guard, problem } from "@/lib/route-helpers";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const stop = await guard("sales");
  if (stop) return stop;
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!id) return problem("Which visit?");
  return attempt(async () => ({ photos: await visitPhotoUrls(id) }));
}
