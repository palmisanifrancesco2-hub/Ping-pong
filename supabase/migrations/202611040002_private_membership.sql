begin;
-- Only administrators can reserve the owner's verified email; it is never public.
create table private.owner_emails (
  email text primary key check(email = lower(trim(email)) and position('@' in email) > 1)
);
revoke all on private.owner_emails from public,anon,authenticated;

create function public.is_authorized_user() returns boolean
language sql stable security invoker set search_path = '' as $$
  select private.is_member();
$$;
revoke all on function public.is_authorized_user() from public,anon;
grant execute on function public.is_authorized_user() to authenticated;

create function private.register_verified_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email_confirmed_at is not null and exists (
    select 1 from private.owner_emails where email = lower(trim(new.email))
  ) then
    insert into public.authorized_users(user_id) values (new.id) on conflict do nothing;
    insert into public.profiles(user_id) values (new.id) on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke all on function private.register_verified_owner() from public,anon,authenticated;
create trigger register_ping_pong_owner after insert or update of email,email_confirmed_at on auth.users
for each row execute function private.register_verified_owner();
notify pgrst, 'reload schema';
commit;
