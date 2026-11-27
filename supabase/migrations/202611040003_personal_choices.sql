begin;
create table public.personal_choices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.authorized_users(user_id) on delete cascade,
  event_source_id text not null,
  choice_key text not null,
  snapshot jsonb not null check(jsonb_typeof(snapshot)='object'),
  saved_at timestamptz not null default now(),
  notes text not null default '' check(length(notes)<=1000),
  manual_status text not null default 'pending' check(manual_status in ('pending','won','lost','void')),
  manual_settled_at timestamptz,
  check(manual_status='pending' or manual_settled_at is not null),
  unique(user_id,event_source_id,choice_key)
);
create index personal_choices_user_time_idx on public.personal_choices(user_id,saved_at desc,id);
alter table public.personal_choices enable row level security;
revoke all on public.personal_choices from anon,authenticated;
grant select,insert on public.personal_choices to authenticated;
grant update(notes,manual_status,manual_settled_at) on public.personal_choices to authenticated;
create policy own_choices_read on public.personal_choices for select to authenticated
  using((select private.is_member()) and user_id=(select auth.uid()));
create policy own_choices_insert on public.personal_choices for insert to authenticated
  with check((select private.is_member()) and user_id=(select auth.uid()));
create policy own_choices_update on public.personal_choices for update to authenticated
  using((select private.is_member()) and user_id=(select auth.uid()))
  with check((select private.is_member()) and user_id=(select auth.uid()));
-- A provider report is not independent official confirmation.
alter table public.results drop constraint results_status_check;
alter table public.results add constraint results_status_check check(status in ('official','reported','cancelled','void'));
notify pgrst, 'reload schema';
commit;
