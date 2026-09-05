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
