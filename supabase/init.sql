create extension if not exists "pgcrypto";

create table if not exists devices (
  id uuid primary key,
  created_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  fcm_token text
);

create table if not exists unlocks (
  device_id uuid not null references devices(id) on delete cascade,
  neighborhood_index int not null check (neighborhood_index > 0),
  unlocked_at timestamptz not null default now(),
  primary key (device_id, neighborhood_index)
);

create table if not exists stories (
  device_id uuid not null references devices(id) on delete cascade,
  neighborhood_index int not null,
  story_id text not null,
  discovered_at timestamptz not null default now(),
  primary key (device_id, neighborhood_index, story_id)
);

create table if not exists purchases (
  id bigserial primary key,
  device_id uuid not null references devices(id) on delete cascade,
  product_id text not null,
  purchase_token text not null,
  platform text not null check (platform in ('ios', 'android')),
  verified_at timestamptz not null default now(),
  expire_at timestamptz,
  unique (device_id, product_id, purchase_token)
);

create table if not exists stats (
  device_id uuid not null references devices(id) on delete cascade,
  neighborhood_index int not null,
  date date not null,
  total_duration int not null default 0,
  story_discoveries int not null default 0,
  primary key (device_id, neighborhood_index, date)
);

create index if not exists idx_purchases_expire_at on purchases(expire_at);
create index if not exists idx_unlocks_neighborhood on unlocks(neighborhood_index);
