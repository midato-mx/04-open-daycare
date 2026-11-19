create function public.accept_parent_invitation(invitation_code text)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_user_id uuid;
  current_user_email text;
  invitation_row public.invitation%rowtype;
  child_daycare_id uuid;
  profile_role public.user_role;
  profile_daycare_id uuid;
begin
  current_user_id := (select auth.uid());
  if current_user_id is null then
    raise exception 'Una sesión es necesaria para aceptar la invitación';
  end if;

  select email
  into current_user_email
  from auth.users
  where id = current_user_id
    and email_confirmed_at is not null;

  if current_user_email is null then
    raise exception 'El correo debe estar confirmado';
  end if;

  select role, daycare_id
  into profile_role, profile_daycare_id
  from public."user"
  where id = current_user_id;

  if profile_role is distinct from 'parent'::public.user_role then
    raise exception 'Solo una cuenta de padre puede aceptar esta invitación';
  end if;

  select invitation.*
  into invitation_row
  from public.invitation as invitation
  where invitation.code = upper(btrim(invitation_code))
    and invitation.email = lower(current_user_email)
    and invitation.status = 'pending'
    and invitation.expires_at > now()
  for update;

  if invitation_row.id is null then
    raise exception 'La invitación no es válida o ya expiró';
  end if;

  select room.daycare_id
  into child_daycare_id
  from public.child as child
  join public.room as room
    on room.id = child.room_id
  where child.id = invitation_row.child_id;

  if child_daycare_id is null or profile_daycare_id is distinct from child_daycare_id then
    raise exception 'La cuenta no pertenece a la guardería de la invitación';
  end if;

  insert into public.parent_child (
    parent_id,
    child_id,
    relationship
  )
  values (
    current_user_id,
    invitation_row.child_id,
    invitation_row.relationship
  )
  on conflict (parent_id, child_id) do nothing;

  update public.invitation
  set status = 'accepted',
      accepted_at = now()
  where id = invitation_row.id;

  return invitation_row.child_id;
end;
$$;

revoke all on function public.accept_parent_invitation(text) from public;
grant execute on function public.accept_parent_invitation(text)
to authenticated;
