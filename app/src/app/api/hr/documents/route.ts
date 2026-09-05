// Passports, work permits, FOMEMA, insurance — and when they run out.
import { deleteDocument, listDocuments, saveDocument } from "@/lib/store-hr";
import { attempt, guard, problem, readBody, str, strOrNull } from "@/lib/route-helpers";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const stop = await guard();
  if (stop) return stop;
  const code = new URL(request.url).searchParams.get("code") ?? "";
  return attempt(async () => ({ documents: await listDocuments(code || undefined) }));
}

export async function POST(request: Request) {
  const stop = await guard();
  if (stop) return stop;
  const b = await readBody(request);
  if (!b) return problem("Could not read what was sent.");
  const code = str(b.code);
  const kind = str(b.kind);
  if (!code) return problem("Which worker is this for?");
  if (!kind) return problem("What kind of document is this?");
  const issued = strOrNull(b.issuedOn);
  const expires = strOrNull(b.expiresOn);
  if (issued && expires && expires < issued) {
    return problem("The expiry date cannot be before the issue date.");
  }
  return attempt(() =>
    saveDocument({
      id: b.id ? Number(b.id) : undefined,
      code,
      kind,
      number: strOrNull(b.number),
      issuedOn: issued,
      expiresOn: expires,
      note: strOrNull(b.note),
    }),
  );
}

export async function DELETE(request: Request) {
  const stop = await guard();
  if (stop) return stop;
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!id) return problem("Which document should be removed?");
  return attempt(() => deleteDocument(id));
}
