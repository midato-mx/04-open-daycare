update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[]
where id = 'post-media';

create policy post_photo_select_visible
on public.post_photo
for select
to authenticated
using (
  exists (
    select 1
    from public.post as post
    where post.id = post_photo.post_id
  )
);

create policy post_photo_insert_own_staff
on public.post_photo
for insert
to authenticated
with check (
  exists (
    select 1
    from public.post as post
    join public."user" as profile
      on profile.id = (select auth.uid())
    where post.id = post_photo.post_id
      and post.author_id = (select auth.uid())
      and profile.role in ('staff', 'admin')
      and profile.daycare_id is not null
      and post_photo.storage_path like profile.daycare_id::text || '/' || post.id::text || '/%'
  )
);

create policy post_photo_update_own_staff
on public.post_photo
for update
to authenticated
using (
  exists (
    select 1
    from public.post as post
    join public."user" as profile
      on profile.id = (select auth.uid())
    where post.id = post_photo.post_id
      and post.author_id = (select auth.uid())
      and profile.role in ('staff', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.post as post
    join public."user" as profile
      on profile.id = (select auth.uid())
    where post.id = post_photo.post_id
      and post.author_id = (select auth.uid())
      and profile.role in ('staff', 'admin')
      and profile.daycare_id is not null
      and post_photo.storage_path like profile.daycare_id::text || '/' || post.id::text || '/%'
  )
);

create policy post_photo_delete_own_staff
on public.post_photo
for delete
to authenticated
using (
  exists (
    select 1
    from public.post as post
    join public."user" as profile
      on profile.id = (select auth.uid())
    where post.id = post_photo.post_id
      and post.author_id = (select auth.uid())
      and profile.role in ('staff', 'admin')
  )
);

create policy post_media_select_visible
on storage.objects
for select
to authenticated
using (
  bucket_id = 'post-media'
  and exists (
    select 1
    from public.post_photo as photo
    where photo.storage_path = storage.objects.name
  )
);

create policy post_media_insert_own_staff
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'post-media'
  and name ~* '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'
  and (metadata ->> 'mimetype') in ('image/jpeg', 'image/png', 'image/webp')
  and exists (
    select 1
    from public.post as post
    join public."user" as profile
      on profile.id = (select auth.uid())
    where post.id::text = (storage.foldername(name))[2]
      and post.author_id = (select auth.uid())
      and profile.role in ('staff', 'admin')
      and profile.daycare_id::text = (storage.foldername(name))[1]
  )
);

create policy post_media_update_own_staff
on storage.objects
for update
to authenticated
using (
  bucket_id = 'post-media'
  and exists (
    select 1
    from public.post_photo as photo
    join public.post as post
      on post.id = photo.post_id
    where photo.storage_path = storage.objects.name
      and post.author_id = (select auth.uid())
  )
)
with check (
  bucket_id = 'post-media'
  and name ~* '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'
  and (metadata ->> 'mimetype') in ('image/jpeg', 'image/png', 'image/webp')
  and exists (
    select 1
    from public.post as post
    join public."user" as profile
      on profile.id = (select auth.uid())
    where post.id::text = (storage.foldername(name))[2]
      and post.author_id = (select auth.uid())
      and profile.role in ('staff', 'admin')
      and profile.daycare_id::text = (storage.foldername(name))[1]
  )
);

create policy post_media_delete_own_staff
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'post-media'
  and exists (
    select 1
    from public.post_photo as photo
    join public.post as post
      on post.id = photo.post_id
    join public."user" as profile
      on profile.id = (select auth.uid())
    where photo.storage_path = storage.objects.name
      and post.author_id = (select auth.uid())
      and profile.role in ('staff', 'admin')
  )
);
