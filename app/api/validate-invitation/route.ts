import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";

export async function POST(request: Request) {
  const input = (await request.json()) as {
    code?: string;
    email?: string;
  };
  const code = input.code?.trim().toUpperCase() ?? "";
  const email = input.email?.trim().toLowerCase() ?? "";

  if (!/^[A-Z0-9]{5}$/.test(code)) {
    return NextResponse.json(
      { ok: false, message: "Escribe un código válido de 5 caracteres." },
      { status: 400 },
    );
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { ok: false, message: "Escribe el correo de la invitación." },
      { status: 400 },
    );
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(cookieStore);
  const { data, error } = await supabase.rpc("validate_parent_invitation", {
    invitation_code: code,
    invited_email: email,
  });

  if (error || !data?.[0]) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "El código no es válido, ya venció o no coincide con ese correo.",
      },
      { status: 400 },
    );
  }

  const invitation = data[0] as {
    invitation_id: string;
    parent_name: string;
    email: string;
    child_name: string;
    room_name: string;
    relationship: "father" | "mother" | "guardian";
  };

  return NextResponse.json({
    ok: true,
    invitation: {
      invitationId: invitation.invitation_id,
      parentName: invitation.parent_name,
      email: invitation.email,
      childName: invitation.child_name,
      roomName: invitation.room_name,
      relationship: invitation.relationship,
    },
  });
}
