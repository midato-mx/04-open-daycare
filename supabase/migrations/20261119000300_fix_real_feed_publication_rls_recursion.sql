create or replace function private.can_read_post(post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.post as post
    where post.id = $1
      and (
        exists (
          select 1
          from public."user" as profile
          where profile.id = (select auth.uid())
            and profile.role in ('staff', 'admin')
            and profile.daycare_id = (
              select author.daycare_id
              from public."user" as author
              where author.id = post.author_id
            )
        )
        or exists (
          select 1
          from public.post_child as tagged_post
          join public.parent_child as link
            on link.child_id = tagged_post.child_id
          where tagged_post.post_id = post.id
            and link.parent_id = (select auth.uid())
        )
        or (
          post.type = 'announcement'
          and exists (
            select 1
            from public.child as room_child
            join public.parent_child as link
              on link.child_id = room_child.id
            where room_child.room_id = post.room_id
              and link.parent_id = (select auth.uid())
          )
        )
      )
  );
$$;

create or replace function private.can_manage_post(post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.post as post
    join public.room as room
      on room.id = post.room_id
    join public."user" as profile
      on profile.id = (select auth.uid())
    where post.id = $1
      and post.author_id = (select auth.uid())
      and profile.role in ('staff', 'admin')
      and profile.daycare_id = room.daycare_id
  );
$$;

create or replace function private.can_manage_post_child(
  post_id uuid,
  child_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.post as post
    join public.child as child
      on child.id = $2
    join public.room as room
      on room.id = child.room_id
    join public."user" as profile
      on profile.id = (select auth.uid())
    where post.id = $1
      and post.author_id = (select auth.uid())
      and post.room_id = child.room_id
      and child.status = 'active'
      and profile.role in ('staff', 'admin')
      and profile.daycare_id = room.daycare_id
      and exists (
        select 1
        from public.parent_child as link
        where link.child_id = child.id
      )
  );
$$;

revoke all on function private.can_read_post(uuid) from public;
revoke all on function private.can_manage_post(uuid) from public;
revoke all on function private.can_manage_post_child(uuid, uuid) from public;

grant execute on function private.can_read_post(uuid) to authenticated;
grant execute on function private.can_manage_post(uuid) to authenticated;
grant execute on function private.can_manage_post_child(uuid, uuid) to authenticated;

drop policy post_select_related on public.post;

create policy post_select_related
on public.post
for select
to authenticated
using ((select private.can_read_post(post.id)));

drop policy post_child_insert_post_author on public.post_child;

create policy post_child_insert_post_author
on public.post_child
for insert
to authenticated
with check (
  (select private.can_manage_post_child(post_child.post_id, post_child.child_id))
);

drop policy post_child_update_post_author on public.post_child;

create policy post_child_update_post_author
on public.post_child
for update
to authenticated
using ((select private.can_manage_post(post_child.post_id)))
with check (
  (select private.can_manage_post_child(post_child.post_id, post_child.child_id))
);

drop policy post_child_delete_post_author on public.post_child;

create policy post_child_delete_post_author
on public.post_child
for delete
to authenticated
using ((select private.can_manage_post(post_child.post_id)));
