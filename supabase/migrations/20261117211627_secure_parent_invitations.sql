alter table public.parent_child enable row level security;
alter table public.invitation enable row level security;

revoke all on table public.parent_child from public, anon, authenticated;
revoke all on table public.invitation from public, anon, authenticated;

grant select on table public.invitation to authenticated;
grant insert on table public.invitation to authenticated;
grant update (full_name, email, relationship, code, status, expires_at, accepted_at)
on table public.invitation to authenticated;

create policy invitation_select_same_daycare_staff
on public.invitation
for select
to authenticated
using (
  exists (
    select 1
    from public.child as child
    join public.room as room
      on room.id = child.room_id
    join public."user" as profile
      on profile.daycare_id = room.daycare_id
    where child.id = invitation.child_id
      and profile.id = (select auth.uid())
      and profile.role in ('staff', 'admin')
  )
);

create policy invitation_insert_same_daycare_staff
on public.invitation
for insert
to authenticated
with check (
  invited_by = (select auth.uid())
  and exists (
    select 1
    from public.child as child
    join public.room as room
      on room.id = child.room_id
    join public."user" as profile
      on profile.daycare_id = room.daycare_id
    where child.id = invitation.child_id
      and profile.id = (select auth.uid())
      and profile.role in ('staff', 'admin')
  )
);

create policy invitation_update_same_daycare_staff
on public.invitation
for update
to authenticated
using (
  exists (
    select 1
    from public.child as child
    join public.room as room
      on room.id = child.room_id
    join public."user" as profile
      on profile.daycare_id = room.daycare_id
    where child.id = invitation.child_id
      and profile.id = (select auth.uid())
      and profile.role in ('staff', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.child as child
    join public.room as room
      on room.id = child.room_id
    join public."user" as profile
      on profile.daycare_id = room.daycare_id
    where child.id = invitation.child_id
      and profile.id = (select auth.uid())
      and profile.role in ('staff', 'admin')
  )
);
