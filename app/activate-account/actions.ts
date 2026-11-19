"use server";

import { cookies } from "next/headers";
import { createClient as createServerClient } from "@/utils/supabase/server";

export type ValidatedInvitation = {
  invitationId: string;
  parentName: string;
  email: string;
  childName: string;
  roomName: string;
  relationship: "father" | "mother" | "guardian";
};

export type ValidateInvitationResult =
  | { ok: true; invitation: ValidatedInvitation }
  | { ok: false; message: string };

export async function validateInvitation(input: {
  code: string;
  email: string;
}): Promise<ValidateInvitationResult> {
  const code = input.code.trim().toUpperCase();
  const email = input.email.trim().toLowerCase();

  if (!/^[A-Z0-9]{5}$/.test(code)) {
    return {
      ok: false,
      message: "Escribe un código válido de 5 caracteres.",
    };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return {
      ok: false,
      message: "Escribe el correo de la invitación.",
    };
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(cookieStore);
  const { data, error } = await supabase.rpc("validate_parent_invitation", {
    invitation_code: code,
    invited_email: email,
  });

  if (error || !data?.[0]) {
    return {
      ok: false,
      message:
        "El código no es válido, ya venció o no coincide con ese correo.",
    };
  }

  const invitation = data[0] as {
    invitation_id: string;
    parent_name: string;
    email: string;
    child_name: string;
    room_name: string;
    relationship: "father" | "mother" | "guardian";
  };

  return {
    ok: true,
    invitation: {
      invitationId: invitation.invitation_id,
      parentName: invitation.parent_name,
      email: invitation.email,
      childName: invitation.child_name,
      roomName: invitation.room_name,
      relationship: invitation.relationship,
    },
  };
}
