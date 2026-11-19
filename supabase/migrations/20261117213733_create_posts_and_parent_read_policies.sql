create type public.post_type as enum (
  'meal',
  'nap',
  'activity',
  'achievement',
  'photo',
  'announcement'
);

create table public.post (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public."user" (id) on delete restrict,
  room_id uuid references public.room (id) on delete set null,
  type public.post_type not null,
  title text,
  body text not null,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index post_author_id_idx
on public.post (author_id);

create index post_room_id_idx
on public.post (room_id);

create index post_published_at_idx
on public.post (published_at desc);

create table public.post_child (
  post_id uuid not null references public.post (id) on delete cascade,
  child_id uuid not null references public.child (id) on delete cascade,
  primary key (post_id, child_id)
);

create index post_child_child_id_idx
on public.post_child (child_id);

create function public.update_post_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger post_set_updated_at
before update on public.post
for each row
execute function public.update_post_updated_at();

revoke all on function public.update_post_updated_at() from public;

alter table public.post enable row level security;
alter table public.post_child enable row level security;

grant select on table public.parent_child to authenticated;
grant select on table public.post to authenticated;
grant select on table public.post_child to authenticated;

create policy parent_child_select_related
on public.parent_child
for select
to authenticated
using (
  parent_id = (select auth.uid())
  or exists (
    select 1
    from public.child as child
    join public.room as room
      on room.id = child.room_id
    join public."user" as profile
      on profile.daycare_id = room.daycare_id
    where child.id = parent_child.child_id
      and profile.id = (select auth.uid())
      and profile.role in ('staff', 'admin')
  )
);

create policy post_select_related
on public.post
for select
to authenticated
using (
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
      from public.room as post_room
      join public.child as room_child
        on room_child.room_id = post_room.id
      join public.parent_child as link
        on link.child_id = room_child.id
      where post_room.id = post.room_id
        and link.parent_id = (select auth.uid())
    )
  )
);

create policy post_child_select_related
on public.post_child
for select
to authenticated
using (
  exists (
    select 1
    from public.post as post
    where post.id = post_child.post_id
  )
);
