"use server";

import { cookies } from "next/headers";
import { createClient as createServerClient } from "@/utils/supabase/server";

type RegistrationInvitation = {
  invitation_id: string;
  parent_name: string;
  email: string;
  child_id: string;
  child_name: string;
  room_name: string;
  daycare_id: string;
  relationship: "father" | "mother" | "guardian";
};

export type RegisterParentResult =
  | {
      ok: true;
      requiresEmailConfirmation: boolean;
      email: string;
      childName: string;
    }
  | { ok: false; message: string; reason?: "existing-account" };

export async function registerParent(input: {
  code: string;
  email: string;
  password: string;
  photoConsent: boolean;
}): Promise<RegisterParentResult> {
  const code = input.code.trim().toUpperCase();
  const email = input.email.trim().toLowerCase();

  if (!/^[A-Z0-9]{5}$/.test(code)) {
    return { ok: false, message: "Escribe un código válido de 5 caracteres." };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, message: "Escribe el correo de la invitación." };
  }

  if (input.password.length < 8) {
    return {
      ok: false,
      message: "Crea una contraseña de al menos 8 caracteres.",
    };
  }

  if (!input.photoConsent) {
    return {
      ok: false,
      message: "Confirma el consentimiento de fotos para continuar.",
    };
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(cookieStore);
  const { data: invitationData, error: invitationError } = await supabase.rpc(
    "get_parent_registration_invitation",
    {
      invitation_code: code,
      invited_email: email,
    },
  );

  if (invitationError || !invitationData?.[0]) {
    return {
      ok: false,
      message:
        "El código no es válido, ya venció o no coincide con ese correo.",
    };
  }

  const invitation = invitationData[0] as RegistrationInvitation;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    return {
      ok: false,
      message: "No se pudo preparar la confirmación de tu cuenta.",
    };
  }

  const confirmationUrl = new URL("/auth/callback", appUrl);
  confirmationUrl.searchParams.set("invitation_code", code);

  const { data, error } = await supabase.auth.signUp({
    email: invitation.email,
    password: input.password,
    options: {
      emailRedirectTo: confirmationUrl.toString(),
      data: {
        full_name: invitation.parent_name,
        role: "parent",
        daycare_id: invitation.daycare_id,
        photo_consent: input.photoConsent,
      },
    },
  });

  if (error) {
    if (
      error.message.toLowerCase().includes("already registered") ||
      error.message.toLowerCase().includes("already exists")
    ) {
      return {
        ok: false,
        message:
          "Este correo ya tiene una cuenta. Inicia sesión para continuar.",
      };
    }

    return {
      ok: false,
      message: "No pudimos crear tu cuenta. Intenta de nuevo.",
    };
  }

  if (data.user && data.user.identities?.length === 0) {
    return {
      ok: false,
      reason: "existing-account",
      message:
        "Este correo ya tiene una cuenta. Inicia sesión para continuar.",
    };
  }

  return {
    ok: true,
    requiresEmailConfirmation: !data.session,
    email: invitation.email,
    childName: invitation.child_name,
  };
}

export async function signInExistingParent(input: {
  code: string;
  email: string;
  password: string;
}): Promise<
  | { ok: true; childName: string }
  | { ok: false; message: string }
> {
  const code = input.code.trim().toUpperCase();
  const email = input.email.trim().toLowerCase();
  const cookieStore = await cookies();
  const supabase = createServerClient(cookieStore);

  const { data: invitationData, error: invitationError } = await supabase.rpc(
    "get_parent_registration_invitation",
    {
      invitation_code: code,
      invited_email: email,
    },
  );

  if (invitationError || !invitationData?.[0]) {
    return {
      ok: false,
      message:
        "El código no es válido, ya venció o no coincide con ese correo.",
    };
  }

  const invitation = invitationData[0] as RegistrationInvitation;
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: invitation.email,
    password: input.password,
  });

  if (signInError) {
    return {
      ok: false,
      message: "El correo o la contraseña no son correctos.",
    };
  }

  const { error: acceptanceError } = await supabase.rpc(
    "accept_parent_invitation",
    { invitation_code: code },
  );

  if (acceptanceError) {
    return {
      ok: false,
      message:
        "No pudimos vincular tu cuenta con la invitación. Intenta de nuevo.",
    };
  }

  return { ok: true, childName: invitation.child_name };
}
