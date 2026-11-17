// A photo for a portal product that has no page on tunglamfood.my (a private-label
// item, say). Stored in the public "portal-photos" bucket — product photos only.
import { serverSupabase } from "@/lib/supabase-server";
import { guard, problem } from "@/lib/route-helpers";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const stop = await guard("sales");
  if (stop) return stop;
  const form = await request.formData().catch(() => null);
  const id = Number(form?.get("id"));
  const file = form?.get("photo");
  if (!id) return problem("Save the product first, then add its photo.");
  if (!(file instanceof File) || file.size === 0) return problem("Choose a photo.");
  if (file.size > 4 * 1024 * 1024) return problem("That photo is over 4 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  const png = bytes[0] === 0x89 && bytes[1] === 0x50;
  const webp = String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (!jpeg && !png && !webp) return problem("Use a JPG, PNG or WebP photo.");

  const db = serverSupabase();
  const { data: prev } = await db.from("portal_products").select("photo_path").eq("id", id).maybeSingle();
  const path = `products/${id}-${Date.now()}.${jpeg ? "jpg" : png ? "png" : "webp"}`;
  const up = await db.storage.from("portal-photos").upload(path, bytes, { contentType: jpeg ? "image/jpeg" : png ? "image/png" : "image/webp" });
  if (up.error) return problem(`Could not save the photo: ${up.error.message}`, 500);
  const { error } = await db.from("portal_products").update({ photo_path: path, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return problem("Could not attach the photo to the product.", 500);
  if (prev?.photo_path) await db.storage.from("portal-photos").remove([prev.photo_path as string]);
  return Response.json({ ok: true, value: { url: db.storage.from("portal-photos").getPublicUrl(path).data.publicUrl } });
}

export async function DELETE(request: Request) {
  const stop = await guard("sales");
  if (stop) return stop;
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!id) return problem("Which product?");
  const db = serverSupabase();
  const { data: prev } = await db.from("portal_products").select("photo_path").eq("id", id).maybeSingle();
  await db.from("portal_products").update({ photo_path: null }).eq("id", id);
  if (prev?.photo_path) await db.storage.from("portal-photos").remove([prev.photo_path as string]);
  return Response.json({ ok: true, value: null });
}
