alter type public.post_type
  add value if not exists 'mood';

create table public.post_photo (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.post (id) on delete cascade,
  storage_path text not null unique,
  mime_type text not null,
  byte_size integer not null,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint post_photo_mime_type_check
    check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  constraint post_photo_byte_size_check
    check (byte_size > 0 and byte_size <= 10485760),
  constraint post_photo_display_order_check
    check (display_order >= 0)
);

create index post_photo_post_id_idx
on public.post_photo (post_id);

alter table public.post_photo enable row level security;

revoke all on table public.post_photo from public, anon, authenticated;
grant select, insert, update, delete on table public.post_photo to authenticated;

insert into storage.buckets (id, name, public)
values ('post-media', 'post-media', false)
on conflict (id) do update
set public = excluded.public;
