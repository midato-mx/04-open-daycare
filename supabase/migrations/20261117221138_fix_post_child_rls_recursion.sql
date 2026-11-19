drop policy post_child_select_related on public.post_child;

create policy post_child_select_related
on public.post_child
for select
to authenticated
using (
  exists (
    select 1
    from public.parent_child as link
    where link.child_id = post_child.child_id
      and link.parent_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.child as child
    join public.room as room
      on room.id = child.room_id
    join public."user" as profile
      on profile.daycare_id = room.daycare_id
    where child.id = post_child.child_id
      and profile.id = (select auth.uid())
      and profile.role in ('staff', 'admin')
  )
);
