-- Packing and delivery: routes (a lorry and its driver), which route each dealer is on
-- and in what stop order, and when an order was packed.
create table if not exists delivery_routes (
  code    text primary key,
  name    text not null,
  driver  text,
  lorry   text,
  sort    integer not null default 0,
  active  boolean not null default true
);
alter table delivery_routes enable row level security;

alter table sales_customers add column if not exists route_code text references delivery_routes(code) on delete set null;
alter table sales_customers add column if not exists route_sort integer;
alter table sales_orders add column if not exists packed_at timestamptz;
alter table sales_orders add column if not exists packed_by text;
