revoke all on table public.post from public, anon, authenticated;
grant select, insert, update, delete on table public.post to authenticated;

revoke all on table public.post_child from public, anon, authenticated;
grant select, insert, update, delete on table public.post_child to authenticated;

create policy post_insert_own_staff
on public.post
for insert
to authenticated
with check (
  author_id = (select auth.uid())
  and room_id is not null
  and exists (
    select 1
    from public."user" as profile
    where profile.id = (select auth.uid())
      and profile.role in ('staff', 'admin')
      and profile.daycare_id is not null
  )
  and exists (
    select 1
    from public.room as room
    join public."user" as profile
      on profile.daycare_id = room.daycare_id
    where room.id = post.room_id
      and profile.id = (select auth.uid())
      and profile.role in ('staff', 'admin')
  )
);

create policy post_update_own_staff
on public.post
for update
to authenticated
using (
  author_id = (select auth.uid())
  and exists (
    select 1
    from public."user" as profile
    where profile.id = (select auth.uid())
      and profile.role in ('staff', 'admin')
      and profile.daycare_id = (
        select room.daycare_id
        from public.room as room
        where room.id = post.room_id
      )
  )
)
with check (
  author_id = (select auth.uid())
  and room_id is not null
  and exists (
    select 1
    from public.room as room
    join public."user" as profile
      on profile.daycare_id = room.daycare_id
    where room.id = post.room_id
      and profile.id = (select auth.uid())
      and profile.role in ('staff', 'admin')
  )
);

create policy post_delete_own_staff
on public.post
for delete
to authenticated
using (
  author_id = (select auth.uid())
  and exists (
    select 1
    from public."user" as profile
    where profile.id = (select auth.uid())
      and profile.role in ('staff', 'admin')
      and profile.daycare_id = (
        select room.daycare_id
        from public.room as room
        where room.id = post.room_id
      )
  )
);

create policy post_child_insert_post_author
on public.post_child
for insert
to authenticated
with check (
  exists (
    select 1
    from public.post as post
    join public."user" as profile
      on profile.id = (select auth.uid())
    join public.child as child
      on child.id = post_child.child_id
    join public.room as room
      on room.id = child.room_id
    where post.id = post_child.post_id
      and post.author_id = (select auth.uid())
      and profile.role in ('staff', 'admin')
      and profile.daycare_id = room.daycare_id
      and post.room_id = child.room_id
      and child.status = 'active'
      and exists (
        select 1
        from public.parent_child as link
        where link.child_id = child.id
      )
  )
);

create policy post_child_update_post_author
on public.post_child
for update
to authenticated
using (
  exists (
    select 1
    from public.post as post
    where post.id = post_child.post_id
      and post.author_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.post as post
    join public."user" as profile
      on profile.id = (select auth.uid())
    join public.child as child
      on child.id = post_child.child_id
    join public.room as room
      on room.id = child.room_id
    where post.id = post_child.post_id
      and post.author_id = (select auth.uid())
      and profile.role in ('staff', 'admin')
      and profile.daycare_id = room.daycare_id
      and post.room_id = child.room_id
      and child.status = 'active'
      and exists (
        select 1
        from public.parent_child as link
        where link.child_id = child.id
      )
  )
);

create policy post_child_delete_post_author
on public.post_child
for delete
to authenticated
using (
  exists (
    select 1
    from public.post as post
    where post.id = post_child.post_id
      and post.author_id = (select auth.uid())
      and exists (
        select 1
        from public."user" as profile
        where profile.id = (select auth.uid())
          and profile.role in ('staff', 'admin')
      )
  )
);
