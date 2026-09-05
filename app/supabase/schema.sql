-- TungLam HR, Stage 1. Run this once in the Supabase SQL editor.
--
-- Tables are prefixed hr_ because the same Supabase project still holds the
-- previous app's tables (workers, months, punches, advances, leaves). They are
-- empty, but dropping them would break that app, which is kept as a backup.
-- Every table is reached only through the server, using the secret key, so
-- row level security is left on with no public policy: nothing in the browser
-- can read wages directly.

create table if not exists hr_workers (
  code         text primary key,          -- Million code, e.g. 'B32'
  scanner_id   text not null default '',  -- CheckTime EMP ID
  name         text not null,
  site         text not null check (site in ('KB','KL')),
  "group"      text not null check ("group" in ('B1','B2','B3','B4')),
  nationality  text,
  status       text not null default 'active'
               check (status in ('active','left','balik-cuti')),
  updated_at   timestamptz not null default now()
);
create index if not exists hr_workers_scanner_id_idx on hr_workers (scanner_id);

create table if not exists hr_month_scans (
  month_key  text not null,               -- '2026-06'
  code       text not null references hr_workers(code) on delete cascade,
  work_date  date not null,
  punches    text[] not null default '{}',
  primary key (month_key, code, work_date)
);

create table if not exists hr_month_corrections (
  month_key      text not null,
  code           text not null references hr_workers(code) on delete cascade,
  work_date      date not null,
  first_override text,
  last_override  text,
  marked_absent  boolean not null default false,
  updated_at     timestamptz not null default now(),
  primary key (month_key, code, work_date)
);

create table if not exists hr_month_extras (
  month_key text not null,
  code      text not null references hr_workers(code) on delete cascade,
  allowance numeric not null default 0,
  advance   numeric not null default 0,
  primary key (month_key, code)
);

alter table hr_workers            enable row level security;
alter table hr_month_scans        enable row level security;
alter table hr_month_corrections  enable row level security;
alter table hr_month_extras       enable row level security;

-- ── Stage 2: money and time off ─────────────────────────────────────────────
-- One table for every recurring money line against a worker in a month:
-- allowances, advances, levy, hostel, utilities, fines. A "kind" rather than a
-- column each, because the factory will invent kinds we have not thought of.
create table if not exists hr_pay_items (
  id         bigserial primary key,
  month_key  text not null,
  code       text not null references hr_workers(code) on delete cascade,
  kind       text not null,
  label      text not null default '',
  amount     numeric not null default 0,
  note       text,
  created_at timestamptz not null default now()
);
create index if not exists hr_pay_items_month_idx on hr_pay_items (month_key, code);

create table if not exists hr_leave (
  id         bigserial primary key,
  code       text not null references hr_workers(code) on delete cascade,
  kind       text not null,
  from_date  date not null,
  to_date    date not null,
  days       numeric not null default 1,
  paid       boolean not null default true,
  note       text,
  created_at timestamptz not null default now()
);
create index if not exists hr_leave_code_idx on hr_leave (code, from_date);

-- ── Stage 3: the things that protect you ────────────────────────────────────
create table if not exists hr_documents (
  id         bigserial primary key,
  code       text not null references hr_workers(code) on delete cascade,
  kind       text not null,
  number     text,
  issued_on  date,
  expires_on date,
  note       text,
  created_at timestamptz not null default now()
);
create index if not exists hr_documents_expiry_idx on hr_documents (expires_on);

create table if not exists hr_assignments (
  id         bigserial primary key,
  code       text not null references hr_workers(code) on delete cascade,
  kind       text not null,
  value      text not null,
  from_date  date,
  to_date    date,
  note       text,
  created_at timestamptz not null default now()
);
create index if not exists hr_assignments_code_idx on hr_assignments (code, kind);

-- ── Stage 4: records ────────────────────────────────────────────────────────
create table if not exists hr_notes (
  id         bigserial primary key,
  code       text not null references hr_workers(code) on delete cascade,
  kind       text not null,
  on_date    date not null,
  subject    text not null,
  detail     text,
  created_at timestamptz not null default now()
);
create index if not exists hr_notes_code_idx on hr_notes (code, on_date);

-- Status is the one label the payroll reads: only people whose status counts as
-- working are calculated and exported. A new status starts as NOT paid, because
-- leaving somebody out for a month is the recoverable mistake.
create table if not exists hr_statuses (
  name              text primary key,
  counts_as_working boolean not null default false,
  sort_order        integer not null default 100
);
insert into hr_statuses (name, counts_as_working, sort_order) values
  ('active', true, 1), ('left', false, 2), ('balik-cuti', false, 3)
on conflict (name) do nothing;

-- ── Sales ───────────────────────────────────────────────────────────────────
create table if not exists sales_customers (
  code         text primary key,
  name         text not null,
  short_name   text not null default '',
  state        text not null default '',
  address      text,
  contact      text,
  email        text,
  attn         text,
  income_taxno text,
  active       boolean not null default true,
  updated_at   timestamptz not null default now()
);
create index if not exists sales_customers_state_idx on sales_customers (state);

create table if not exists sales_products (
  item_code   text primary key,
  description text not null,
  barcode     text,
  item_group  text not null default '',
  item_type   text not null default '',
  uom         text not null default '',
  pack_size   text not null default '',
  base_price  numeric not null default 0,
  cost        numeric not null default 0,
  active      boolean not null default true,
  updated_at  timestamptz not null default now()
);
create index if not exists sales_products_group_idx on sales_products (item_group);

-- The heart of it: the same product costs a different price to every dealer,
-- and those prices change. Each row is one dealer's price for one product from
-- a given date; the newest row on or before the order date is the one that
-- applies, so old orders keep the price they were actually sold at.
create table if not exists sales_prices (
  id             bigserial primary key,
  customer_code  text not null references sales_customers(code) on delete cascade,
  item_code      text not null references sales_products(item_code) on delete cascade,
  price          numeric not null,
  effective_from date not null default current_date,
  note           text,
  created_at     timestamptz not null default now()
);
create unique index if not exists sales_prices_one_per_day
  on sales_prices (customer_code, item_code, effective_from);
create index if not exists sales_prices_lookup_idx on sales_prices (customer_code, item_code);

create table if not exists sales_orders (
  id            bigserial primary key,
  order_no      text not null unique,
  customer_code text not null references sales_customers(code),
  order_date    date not null default current_date,
  deliver_on    date,
  status        text not null default 'draft',
  their_ref     text,
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists sales_orders_customer_idx on sales_orders (customer_code, order_date);

create table if not exists sales_order_lines (
  id        bigserial primary key,
  order_id  bigint not null references sales_orders(id) on delete cascade,
  line_no   integer not null default 1,
  item_code text not null references sales_products(item_code),
  qty       numeric not null default 0,
  uom       text not null default '',
  price     numeric not null default 0,
  note      text
);
create index if not exists sales_order_lines_order_idx on sales_order_lines (order_id);

alter table hr_pay_items      enable row level security;
alter table hr_leave          enable row level security;
alter table hr_documents      enable row level security;
alter table hr_assignments    enable row level security;
alter table hr_notes          enable row level security;
alter table hr_statuses       enable row level security;
alter table sales_customers   enable row level security;
alter table sales_products    enable row level security;
alter table sales_prices      enable row level security;
alter table sales_orders      enable row level security;
alter table sales_order_lines enable row level security;
