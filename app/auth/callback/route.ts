import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";

function activationErrorUrl(
  requestUrl: URL,
  invitationCode: string | null,
) {
  const url = new URL("/activate-account", requestUrl.origin);
  if (invitationCode) {
    url.searchParams.set("code", invitationCode);
  }
  url.searchParams.set("error", "confirmation");
  return url;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const authCode = requestUrl.searchParams.get("code");
  const invitationCode = requestUrl.searchParams.get("invitation_code");

  if (!authCode || !invitationCode) {
    return NextResponse.redirect(
      activationErrorUrl(requestUrl, invitationCode),
    );
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(cookieStore);
  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(authCode);

  if (exchangeError) {
    return NextResponse.redirect(
      activationErrorUrl(requestUrl, invitationCode),
    );
  }

  const { error: acceptanceError } = await supabase.rpc(
    "accept_parent_invitation",
    { invitation_code: invitationCode },
  );

  if (acceptanceError) {
    return NextResponse.redirect(
      activationErrorUrl(requestUrl, invitationCode),
    );
  }

  return NextResponse.redirect(new URL("/", requestUrl.origin));
}
