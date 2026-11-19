begin;

create extension if not exists pgtap with schema extensions;

select plan(19);

insert into auth.users (id, email, raw_user_meta_data)
values
  (
    '11111111-1111-1111-1111-111111111111',
    'invitation-staff-a@example.com',
    '{"role":"staff","full_name":"Invitation Staff A"}'::jsonb
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'invitation-parent-a@example.com',
    '{"role":"parent","full_name":"Invitation Parent A"}'::jsonb
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'invitation-parent-b@example.com',
    '{"role":"parent","full_name":"Invitation Parent B"}'::jsonb
  ),
  (
    '44444444-4444-4444-4444-444444444444',
    'invitation-staff-b@example.com',
    '{"role":"staff","full_name":"Invitation Staff B"}'::jsonb
  );

insert into public.daycare (owner_id, name)
values
  ('11111111-1111-1111-1111-111111111111', 'Invitation Test Daycare A'),
  ('44444444-4444-4444-4444-444444444444', 'Invitation Test Daycare B');

update public."user" as profile
set daycare_id = daycare.id
from public.daycare as daycare
where profile.id in (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222'
)
and daycare.name = 'Invitation Test Daycare A';

update public."user" as profile
set daycare_id = daycare.id
from public.daycare as daycare
where profile.id = '44444444-4444-4444-4444-444444444444'
and daycare.name = 'Invitation Test Daycare B';

update public."user" as profile
set daycare_id = daycare.id
from public.daycare as daycare
where profile.id = '33333333-3333-3333-3333-333333333333'
and daycare.name = 'Invitation Test Daycare B';

insert into public.room (daycare_id, name)
select daycare.id, room_name.name
from public.daycare as daycare
cross join (values ('Soles'), ('Lunas')) as room_name(name)
where daycare.name like 'Invitation Test Daycare%'
on conflict (daycare_id, name) do nothing;

insert into public.child (room_id, full_name, birth_date)
values
  (
    (
      select room.id
      from public.room as room
      join public.daycare as daycare on daycare.id = room.daycare_id
      where daycare.name = 'Invitation Test Daycare A'
        and room.name = 'Soles'
    ),
    'Invitation Child A',
    '2022-01-15'
  ),
  (
    (
      select room.id
      from public.room as room
      join public.daycare as daycare on daycare.id = room.daycare_id
      where daycare.name = 'Invitation Test Daycare B'
        and room.name = 'Soles'
    ),
    'Invitation Child B',
    '2021-02-20'
  );

select results_eq(
  $$select enumlabel::text collate "C" from pg_enum
    where enumtypid = 'public.relationship_type'::regtype
    order by enumsortorder$$,
  $$select unnest(array['father', 'mother', 'guardian']::text[]) collate "C"$$,
  'relationship_type contains the expected values'
);

select results_eq(
  $$select enumlabel::text collate "C" from pg_enum
    where enumtypid = 'public.invitation_status'::regtype
    order by enumsortorder$$,
  $$select unnest(array['pending', 'accepted', 'expired', 'cancelled']::text[]) collate "C"$$,
  'invitation_status contains the expected values'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.parent_child'::regclass
      and conname = 'parent_child_parent_id_child_id_key'
  ),
  'parent_child prevents duplicate links'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.invitation'::regclass
      and conname = 'invitation_code_format_check'
  ),
  'invitation enforces five-character uppercase codes'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.invitation'::regclass),
  'RLS is enabled on invitation'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.parent_child'::regclass),
  'RLS is enabled on parent_child'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.post'::regclass),
  'RLS is enabled on post'
);

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select results_eq(
  $$insert into public.invitation (
      child_id, invited_by, full_name, email, relationship, code
    )
    values (
      (
        select child.id
        from public.child as child
        join public.room as room on room.id = child.room_id
        join public.daycare as daycare on daycare.id = room.daycare_id
        where daycare.name = 'Invitation Test Daycare A'
      ),
      '11111111-1111-1111-1111-111111111111',
      'Pending Parent',
      'pending@example.com',
      'father',
      'OWN01'
    )
    returning code$$,
  array['OWN01'],
  'staff can create an invitation in their daycare'
);

select is(
  (
    select expires_at - created_at
    from public.invitation
    where code = 'OWN01'
  ),
  interval '24 hours',
  'new invitations expire exactly 24 hours after creation'
);

select throws_ok(
  $$insert into public.invitation (
      child_id, invited_by, full_name, email, relationship, code
    )
    values (
      (
        select child.id
        from public.child as child
        join public.room as room on room.id = child.room_id
        join public.daycare as daycare on daycare.id = room.daycare_id
        where daycare.name = 'Invitation Test Daycare A'
      ),
      '11111111-1111-1111-1111-111111111111',
      'Invalid Parent',
      'INVALID@EXAMPLE.COM',
      'father',
      'OWN02'
    )$$,
  '23514',
  null,
  'invitation emails must be lowercase'
);

select throws_ok(
  $$insert into public.invitation (
      child_id, invited_by, full_name, email, relationship, code
    )
    values (
      (
        select child.id
        from public.child as child
        join public.room as room on room.id = child.room_id
        join public.daycare as daycare on daycare.id = room.daycare_id
        where daycare.name = 'Invitation Test Daycare A'
      ),
      '11111111-1111-1111-1111-111111111111',
      'Invalid Parent',
      'invalid@example.com',
      'father',
      'short'
    )$$,
  '23514',
  null,
  'invitation codes must be five uppercase alphanumeric characters'
);

set local role postgres;

insert into public.parent_child (parent_id, child_id, relationship)
values (
  '22222222-2222-2222-2222-222222222222',
  (
    select child.id
    from public.child as child
    join public.room as room on room.id = child.room_id
    join public.daycare as daycare on daycare.id = room.daycare_id
    where daycare.name = 'Invitation Test Daycare A'
  ),
  'mother'
);

select throws_ok(
  $$insert into public.parent_child (parent_id, child_id, relationship)
    values (
      '22222222-2222-2222-2222-222222222222',
      (
        select child.id
        from public.child as child
        join public.room as room on room.id = child.room_id
        join public.daycare as daycare on daycare.id = room.daycare_id
        where daycare.name = 'Invitation Test Daycare A'
      ),
      'mother'
    )$$,
  '23505',
  null,
  'duplicate parent_child links are rejected'
);

insert into public.parent_child (parent_id, child_id, relationship)
select
  '33333333-3333-3333-3333-333333333333',
  child.id,
  'father'
from public.child as child
join public.room as room on room.id = child.room_id
join public.daycare as daycare on daycare.id = room.daycare_id
where daycare.name = 'Invitation Test Daycare B';

insert into public.post (author_id, room_id, type, body)
select
  '11111111-1111-1111-1111-111111111111',
  room.id,
  'activity',
  post_body.body
from public.room as room
join public.daycare as daycare on daycare.id = room.daycare_id
cross join (
  values ('Visible to linked parent'), ('Hidden from unlinked parent')
) as post_body(body)
where daycare.name = 'Invitation Test Daycare A';

insert into public.post_child (post_id, child_id)
select
  post.id,
  child.id
from public.post as post
cross join lateral (
  select child.id
  from public.child as child
  join public.room as room on room.id = child.room_id
  join public.daycare as daycare on daycare.id = room.daycare_id
  where daycare.name = 'Invitation Test Daycare A'
  order by child.full_name
  limit 1
) as child
where post.body = 'Visible to linked parent';

set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

select is(
  (select count(*)::integer from public.parent_child),
  1,
  'parent can read only their own accepted link'
);

select is(
  (select count(*)::integer from public.invitation),
  0,
  'parent cannot read invitations'
);

select is(
  (select count(*)::integer from public.post),
  1,
  'parent can read only posts tagged to their linked child'
);

select throws_ok(
  $$insert into public.invitation (
      child_id, invited_by, full_name, email, relationship, code
    )
    values (gen_random_uuid(), auth.uid(), 'Parent', 'parent@example.com', 'mother', 'PAR01')$$,
  '42501',
  null,
  'parent cannot create invitations'
);

set local request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';

select is(
  (select count(*)::integer from public.invitation),
  0,
  'staff from another daycare cannot read invitations'
);

set local role anon;

select throws_ok(
  $$select * from public.invitation$$,
  '42501',
  null,
  'anonymous users cannot read invitations'
);

select throws_ok(
  $$insert into public.invitation (
      child_id, invited_by, full_name, email, relationship, code
    )
    values (gen_random_uuid(), gen_random_uuid(), 'Anonymous', 'anon@example.com', 'guardian', 'AN001')$$,
  '42501',
  null,
  'anonymous users cannot create invitations'
);

select * from finish();

rollback;
