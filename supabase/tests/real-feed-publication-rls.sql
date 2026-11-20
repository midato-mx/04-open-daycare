begin;

create extension if not exists pgtap with schema extensions;

select plan(24);

insert into auth.users (id, email, raw_user_meta_data)
values
  (
    '11111111-1111-1111-1111-111111111111',
    'real-feed-staff-a@example.com',
    '{"role":"staff","full_name":"Real Feed Staff A"}'::jsonb
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'real-feed-admin-a@example.com',
    '{"role":"admin","full_name":"Real Feed Admin A"}'::jsonb
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'real-feed-parent-a@example.com',
    '{"role":"parent","full_name":"Real Feed Parent A"}'::jsonb
  ),
  (
    '44444444-4444-4444-4444-444444444444',
    'real-feed-staff-b@example.com',
    '{"role":"staff","full_name":"Real Feed Staff B"}'::jsonb
  ),
  (
    '55555555-5555-5555-5555-555555555555',
    'real-feed-parent-b@example.com',
    '{"role":"parent","full_name":"Real Feed Parent B"}'::jsonb
  );

insert into public.daycare (owner_id, name)
values
  ('11111111-1111-1111-1111-111111111111', 'Real Feed Test Daycare A'),
  ('44444444-4444-4444-4444-444444444444', 'Real Feed Test Daycare B');

update public."user" as profile
set daycare_id = daycare.id
from public.daycare as daycare
where profile.id in (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333'
  )
  and daycare.name = 'Real Feed Test Daycare A';

update public."user" as profile
set daycare_id = daycare.id
from public.daycare as daycare
where profile.id in (
    '44444444-4444-4444-4444-444444444444',
    '55555555-5555-5555-5555-555555555555'
  )
  and daycare.name = 'Real Feed Test Daycare B';

insert into public.room (id, daycare_id, name)
select
  case
    when daycare.name = 'Real Feed Test Daycare A' and room_name.name = 'Soles'
      then '10000000-0000-0000-0000-000000000001'::uuid
    when daycare.name = 'Real Feed Test Daycare A' and room_name.name = 'Lunas'
      then '10000000-0000-0000-0000-000000000002'::uuid
    when daycare.name = 'Real Feed Test Daycare B' and room_name.name = 'Soles'
      then '20000000-0000-0000-0000-000000000001'::uuid
    else '20000000-0000-0000-0000-000000000002'::uuid
  end,
  daycare.id,
  room_name.name
from public.daycare as daycare
cross join (values ('Soles'), ('Lunas')) as room_name(name)
where daycare.name like 'Real Feed Test Daycare%'
on conflict (daycare_id, name) do nothing;

insert into public.child (id, room_id, full_name, birth_date)
values
  (
    '30000000-0000-0000-0000-000000000001',
    (
      select room.id
      from public.room as room
      join public.daycare as daycare on daycare.id = room.daycare_id
      where daycare.name = 'Real Feed Test Daycare A'
        and room.name = 'Soles'
    ),
    'Real Feed Child A1',
    '2022-01-15'
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    (
      select room.id
      from public.room as room
      join public.daycare as daycare on daycare.id = room.daycare_id
      where daycare.name = 'Real Feed Test Daycare A'
        and room.name = 'Lunas'
    ),
    'Real Feed Child A2',
    '2021-02-20'
  ),
  (
    '40000000-0000-0000-0000-000000000001',
    (
      select room.id
      from public.room as room
      join public.daycare as daycare on daycare.id = room.daycare_id
      where daycare.name = 'Real Feed Test Daycare B'
        and room.name = 'Soles'
    ),
    'Real Feed Child B1',
    '2020-03-25'
  );

insert into public.parent_child (parent_id, child_id, relationship)
select
  '33333333-3333-3333-3333-333333333333',
  child.id,
  'mother'
from public.child as child
where child.full_name = 'Real Feed Child A1';

set local role postgres;

insert into public.post (author_id, room_id, type, body)
select
  '22222222-2222-2222-2222-222222222222',
  room.id,
  'activity',
  post_body.body
from public.room as room
join public.daycare as daycare on daycare.id = room.daycare_id
cross join (
  values
    ('Admin directed to A1'),
    ('Admin directed to A2'),
    ('Admin room announcement')
) as post_body(body)
where daycare.name = 'Real Feed Test Daycare A'
  and room.name = 'Soles';

insert into public.post (author_id, room_id, type, body)
select
  '44444444-4444-4444-4444-444444444444',
  room.id,
  'announcement',
  'Other daycare announcement'
from public.room as room
join public.daycare as daycare on daycare.id = room.daycare_id
where daycare.name = 'Real Feed Test Daycare B'
  and room.name = 'Soles';

insert into public.post_child (post_id, child_id)
select post.id, child.id
from public.post as post
join public.child as child on child.full_name = 'Real Feed Child A1'
where post.body = 'Admin directed to A1';

insert into public.post_child (post_id, child_id)
select post.id, child.id
from public.post as post
join public.child as child on child.full_name = 'Real Feed Child A2'
where post.body = 'Admin directed to A2';

select ok(
  exists (
    select 1
    from pg_enum
    where enumtypid = 'public.post_type'::regtype
      and enumlabel = 'mood'
  ),
  'post_type accepts mood'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.post_photo'::regclass),
  'RLS is enabled on post_photo'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'post_photo_post_id_idx'
  ),
  'post_photo has an index by post_id'
);

select ok(
  exists (
    select 1
    from storage.buckets
    where id = 'post-media'
      and public = false
  ),
  'post-media is private'
);

select ok(
  exists (
    select 1
    from storage.buckets
    where id = 'post-media'
      and file_size_limit = 10485760
      and allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[]
  ),
  'post-media enforces the image limits'
);

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

insert into public.post (author_id, room_id, type, body)
select
  auth.uid(),
  room.id,
  'mood',
  'Staff mood'
from public.room as room
join public.daycare as daycare on daycare.id = room.daycare_id
where daycare.name = 'Real Feed Test Daycare A'
  and room.name = 'Soles';

select is(
  (select count(*)::integer from public.post),
  4,
  'staff can create a mood post and read all posts in their daycare'
);

select is(
  (
    select count(*)::integer
    from public.post
    where body = 'Other daycare announcement'
  ),
  0,
  'staff cannot read posts from another daycare'
);

set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';

select throws_ok(
  $$insert into public.post (
      author_id, room_id, type, body
    )
    values (
      auth.uid(),
      '10000000-0000-0000-0000-000000000001',
      'activity',
      'Parent post'
    )$$,
  '42501',
  null,
  'staff-only write policy rejects a parent-shaped post author'
);

set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select throws_ok(
  $$insert into public.post (
      author_id, room_id, type, body
    )
    values (
      auth.uid(),
      '20000000-0000-0000-0000-000000000001',
      'activity',
      'Cross daycare post'
    )$$,
  '42501',
  null,
  'staff cannot create a post in another daycare'
);

update public.post
set body = 'Staff cannot edit another author'
where body = 'Admin directed to A1';

select is(
  (select count(*)::integer from public.post where body = 'Staff cannot edit another author'),
  0,
  'staff cannot edit another author post'
);

set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

update public.post
set body = 'Admin directed to A1 edited'
where body = 'Admin directed to A1';

select is(
  (select body from public.post where body = 'Admin directed to A1 edited'),
  'Admin directed to A1 edited',
  'the author can edit their own post'
);

set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

update public.post
set body = 'Staff mood edited'
where body = 'Staff mood';

insert into public.post_child (post_id, child_id)
select post.id, child.id
from public.post as post
join public.child as child on child.full_name = 'Real Feed Child A1'
where post.body = 'Staff mood edited';

select is(
  (
    select count(*)::integer
    from public.post_child
    where post_id = (select id from public.post where body = 'Staff mood edited')
  ),
  1,
  'the post author can create a child recipient relation'
);

select throws_ok(
  $$insert into public.post_child (post_id, child_id)
    select
      (select id from public.post where body = 'Staff mood edited'),
      '40000000-0000-0000-0000-000000000001'::uuid$$,
  '42501',
  null,
  'a post author cannot target a child from another daycare'
);

insert into storage.objects (bucket_id, name, metadata)
select
  'post-media',
  daycare.id::text || '/' || post.id::text || '/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.jpg',
  jsonb_build_object('mimetype', 'image/jpeg')
from public.post as post
join public.room as room on room.id = post.room_id
join public.daycare as daycare on daycare.id = room.daycare_id
where post.body = 'Staff mood edited';

insert into public.post_photo (
  post_id,
  storage_path,
  mime_type,
  byte_size,
  display_order
)
select
  post.id,
  daycare.id::text || '/' || post.id::text
    || '/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.jpg',
  'image/jpeg',
  1024,
  0
from public.post as post
join public.room as room on room.id = post.room_id
join public.daycare as daycare on daycare.id = room.daycare_id
where post.body = 'Staff mood edited';

set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';

select is(
  (
    select count(*)::integer
    from public.post
  ),
  3,
  'a linked parent sees their child post and room announcement'
);

select is(
  (
    select count(*)::integer
    from public.post
    where body = 'Admin directed to A2'
  ),
  0,
  'a parent cannot see a post directed to another child'
);

select is(
  (select count(*)::integer from public.post_photo),
  1,
  'a linked parent can read an authorized post photo'
);

select is(
  (select count(*)::integer from storage.objects where bucket_id = 'post-media'),
  1,
  'a linked parent can read an authorized storage object'
);

select throws_ok(
  $$insert into public.post_photo (
      post_id, storage_path, mime_type, byte_size
    )
    values (
      (select id from public.post where body = 'Staff mood edited'),
      'invalid/path.jpg',
      'image/jpeg',
      1024
    )$$,
  '42501',
  null,
  'parents cannot create post photo references'
);

set local request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';

select is(
  (
    select count(*)::integer
    from public.post
    where body = 'Admin directed to A1 edited'
  ),
  0,
  'staff from another daycare cannot read posts'
);

select is(
  (select count(*)::integer from public.post_photo),
  0,
  'staff from another daycare cannot read post photos'
);

set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

update public.post_photo
set byte_size = 2048
where storage_path like '%/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.jpg';

select is(
  (select byte_size from public.post_photo limit 1),
  2048,
  'the author can update their post photo metadata'
);

set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';

delete from public.post_photo
where storage_path like '%/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.jpg';

select is(
  (select count(*)::integer from public.post_photo),
  1,
  'parents cannot delete post photo references'
);

set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

delete from public.post
where body = 'Staff mood edited';

select is(
  (select count(*)::integer from public.post_child where post_id is not null),
  2,
  'deleting a post does not affect unrelated recipient relations'
);

select is(
  (select count(*)::integer from public.post_photo),
  0,
  'deleting a post cascades its post photo references'
);

select * from finish();

rollback;
