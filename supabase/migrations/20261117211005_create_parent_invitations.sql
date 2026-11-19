create type public.relationship_type as enum (
  'father',
  'mother',
  'guardian'
);

create type public.invitation_status as enum (
  'pending',
  'accepted',
  'expired',
  'cancelled'
);

create table public.parent_child (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public."user" (id) on delete cascade,
  child_id uuid not null references public.child (id) on delete cascade,
  relationship public.relationship_type not null,
  created_at timestamptz not null default now(),
  constraint parent_child_parent_id_child_id_key unique (parent_id, child_id)
);

create index parent_child_parent_id_idx
on public.parent_child (parent_id);

create index parent_child_child_id_idx
on public.parent_child (child_id);

create table public.invitation (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.child (id) on delete cascade,
  invited_by uuid not null references public."user" (id) on delete restrict,
  full_name text not null,
  email text not null,
  relationship public.relationship_type not null,
  code text not null unique,
  status public.invitation_status not null default 'pending',
  expires_at timestamptz not null default (now() + interval '24 hours'),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint invitation_code_format_check
    check (code = upper(code) and code ~ '^[A-Z0-9]{5}$'),
  constraint invitation_email_normalized_check
    check (email = lower(email))
);

create index invitation_email_idx
on public.invitation (email);

create index invitation_child_id_idx
on public.invitation (child_id);

create index invitation_status_idx
on public.invitation (status);

create index invitation_expires_at_idx
on public.invitation (expires_at);
