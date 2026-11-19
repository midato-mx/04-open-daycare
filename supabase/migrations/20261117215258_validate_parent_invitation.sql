create or replace function public.validate_parent_invitation(
  invitation_code text,
  invited_email text
)
returns table (
  invitation_id uuid,
  parent_name text,
  email text,
  child_name text,
  room_name text,
  relationship public.relationship_type
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    invitation.id,
    invitation.full_name,
    invitation.email,
    child.full_name,
    room.name,
    invitation.relationship
  from public.invitation as invitation
  join public.child as child
    on child.id = invitation.child_id
  join public.room as room
    on room.id = child.room_id
  where invitation.code = upper(btrim(invitation_code))
    and invitation.email = lower(btrim(invited_email))
    and invitation.status = 'pending'
    and invitation.expires_at > now();
$$;

revoke all on function public.validate_parent_invitation(text, text) from public;
grant execute on function public.validate_parent_invitation(text, text)
to anon, authenticated;
