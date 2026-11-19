create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;

create function private.current_staff_daycare_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select case
    when profile.role in ('staff'::public.user_role, 'admin'::public.user_role)
      then profile.daycare_id
    else null
  end
  from public."user" as profile
  where profile.id = (select auth.uid());
$$;

revoke all on function private.current_staff_daycare_id() from public;
grant execute on function private.current_staff_daycare_id() to authenticated;

create policy user_select_same_daycare_staff
on public."user"
for select
to authenticated
using (
  daycare_id = (select private.current_staff_daycare_id())
);
