-- Phase 2 schema foundation. Apply in a new Supabase PostgreSQL project.
-- No production migration has been executed by this repository.
begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.authorized_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.authorized_users enable row level security;
-- Only SQL administrator / service_role can grant membership.
create or replace function private.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.authorized_users where user_id = (select auth.uid()));
$$;
revoke all on function private.is_member() from public;
grant execute on function private.is_member() to authenticated;

create table public.profiles (
  user_id uuid primary key references public.authorized_users(user_id) on delete cascade,
  display_name text, created_at timestamptz not null default now()
);
create table public.players (
  id uuid primary key default gen_random_uuid(), source text not null, source_id text not null,
  display_name text not null, unique(source,source_id)
);
create table public.competitions (
  id uuid primary key default gen_random_uuid(), source text not null, source_id text not null,
  name text not null, verified_at timestamptz, unique(source,source_id)
);
create table public.events (
  id uuid primary key default gen_random_uuid(), source text not null, source_id text not null,
  competition_id uuid not null references public.competitions(id),
  home_id uuid not null references public.players(id), away_id uuid not null references public.players(id),
  starts_at timestamptz not null, observed_at timestamptz not null,
  state text not null check(state in ('prematch','live','completed','cancelled','unknown')),
  state_verified_at timestamptz,
  check(home_id <> away_id), check(state <> 'live' or state_verified_at is not null),
  unique(source,source_id)
);
create index events_start_idx on public.events(starts_at);
create index events_competition_idx on public.events(competition_id,starts_at);
create table public.results (
  event_id uuid primary key references public.events(id),
  winner_id uuid references public.players(id), source text not null,
  status text not null check(status in ('official','cancelled','void')),
  score jsonb, available_at timestamptz not null, recorded_at timestamptz not null default now()
);
create table public.bookmakers (
  id uuid primary key default gen_random_uuid(), source text not null, source_key text not null,
  name text not null, domain text, adm_concession text, adm_source_url text,
  adm_verified_at timestamptz, adm_valid_until timestamptz,
  check(adm_valid_until is null or (adm_verified_at is not null and adm_source_url is not null and adm_concession is not null and domain is not null and adm_valid_until > adm_verified_at)),
  unique(source,source_key)
);
create table public.markets (
  id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events(id),
  source_key text not null, kind text not null check(kind in ('winner','total','handicap','exact_score','unsupported')),
  unit text not null check(unit in ('match','sets','points','unknown')), period text not null,
  line numeric, settlement_rule text,
  check(kind not in ('total','handicap') or line is not null),
  unique nulls not distinct(event_id,source_key,unit,period,line,settlement_rule)
);
create table public.quotes (
  id uuid primary key default gen_random_uuid(), market_id uuid not null references public.markets(id),
  bookmaker_id uuid not null references public.bookmakers(id), selection text not null,
  decimal_odds numeric not null check(decimal_odds > 1 and decimal_odds not in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric)),
  source text not null, source_updated_at timestamptz not null, received_at timestamptz not null default now(),
  suspended boolean, mode text not null check(mode in ('real','demo')),
  check(source_updated_at <= received_at),
  unique(market_id,bookmaker_id,selection,source_updated_at,mode), unique(id,market_id)
);
-- Append-only quote rows are the price history; no redundant current/history tables.
create index quotes_latest_idx on public.quotes(market_id,bookmaker_id,selection,source_updated_at desc);
create table public.model_versions (
  id uuid primary key default gen_random_uuid(), name text not null, version text not null,
  training_cutoff timestamptz not null, created_at timestamptz not null default now(),
  parameters jsonb not null, validated boolean not null default false, unique(name,version)
);
create table public.predictions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.authorized_users(user_id),
  market_id uuid not null references public.markets(id), quote_id uuid not null,
  model_id uuid not null references public.model_versions(id), selection text not null,
  probability numeric not null check(probability between 0 and 1),
  probability_lower numeric not null check(probability_lower between 0 and 1),
  sample_size integer not null check(sample_size > 0), evidence jsonb not null,
  features_available_at timestamptz not null, predicted_at timestamptz not null default now(),
  mode text not null check(mode in ('real','demo')),
  foreign key(quote_id,market_id) references public.quotes(id,market_id),
  check(probability_lower <= probability), check(features_available_at <= predicted_at),
  unique(id,user_id)
);
create index predictions_user_time_idx on public.predictions(user_id,predicted_at);
create table public.prediction_outcomes (
  prediction_id uuid primary key references public.predictions(id),
  result_event_id uuid not null references public.results(event_id),
  status text not null check(status in ('won','lost','void','pending')),
  theoretical_profit_per_unit numeric, settled_at timestamptz,
  check(status = 'pending' or settled_at is not null)
);
create table public.manual_bets (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.authorized_users(user_id),
  prediction_id uuid, stake numeric not null check(stake > 0 and stake not in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric)),
  decimal_odds numeric not null check(decimal_odds > 1 and decimal_odds not in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric)),
  currency text not null default 'EUR' check(currency = 'EUR'), placed_at timestamptz not null,
  status text not null default 'pending' check(status in ('pending','won','lost','void')),
  actual_profit numeric, notes text,
  foreign key(prediction_id,user_id) references public.predictions(id,user_id)
);
create index manual_bets_user_time_idx on public.manual_bets(user_id,placed_at);
create table public.validation_metrics (
  id uuid primary key default gen_random_uuid(), model_id uuid not null references public.model_versions(id),
  train_end timestamptz not null, test_start timestamptz not null, test_end timestamptz not null,
  sample_size integer not null check(sample_size > 0), brier numeric check(brier between 0 and 1),
  log_loss numeric check(log_loss >= 0 and log_loss not in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric)), calibration jsonb,
  dataset_source text not null, dataset_hash text not null, created_at timestamptz not null default now(),
  check(train_end < test_start and test_start <= test_end)
);
-- Read-only sporting data for members; no browser insert/update policies.
do $$ declare name text; begin
  foreach name in array array['players','competitions','events','results','bookmakers','markets','quotes','model_versions','validation_metrics'] loop
    execute format('alter table public.%I enable row level security',name);
    execute format('revoke all on table public.%I from anon, authenticated',name);
    execute format('grant select on table public.%I to authenticated',name);
    execute format('create policy member_read on public.%I for select to authenticated using ((select private.is_member()))',name);
  end loop;
  foreach name in array array['profiles','predictions','manual_bets'] loop
    execute format('alter table public.%I enable row level security',name);
    execute format('revoke all on table public.%I from anon, authenticated',name);
    execute format('grant select on table public.%I to authenticated',name);
    execute format('create policy own_read on public.%I for select to authenticated using ((select private.is_member()) and user_id = (select auth.uid()))',name);
  end loop;
end $$;
alter table public.prediction_outcomes enable row level security;
revoke all on public.prediction_outcomes from anon, authenticated;
grant select on public.prediction_outcomes to authenticated;
create policy own_outcomes on public.prediction_outcomes for select to authenticated using (
  (select private.is_member()) and exists(select 1 from public.predictions p where p.id = prediction_id and p.user_id = (select auth.uid()))
);
grant insert,update,delete on public.manual_bets to authenticated;
create policy own_bets_insert on public.manual_bets for insert to authenticated with check((select private.is_member()) and user_id = (select auth.uid()));
create policy own_bets_update on public.manual_bets for update to authenticated using((select private.is_member()) and user_id = (select auth.uid())) with check((select private.is_member()) and user_id = (select auth.uid()));
create policy own_bets_delete on public.manual_bets for delete to authenticated using((select private.is_member()) and user_id = (select auth.uid()));
revoke all on public.authorized_users from anon,authenticated;
commit;
