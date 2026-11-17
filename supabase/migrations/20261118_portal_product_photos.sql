-- A photo uploaded in the ERP for a portal product with no page on tunglamfood.my.
alter table portal_products add column if not exists photo_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portal-photos', 'portal-photos', true, 4194304, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
