import "server-only";

import { cookies } from "next/headers";
import { createClient as createServerClient } from "@/utils/supabase/server";

export type UserRole = "staff" | "parent" | "admin";

export type AuthenticatedUserProfile = {
  full_name: string;
  role: UserRole;
};

function isUserRole(value: unknown): value is UserRole {
  return value === "staff" || value === "parent" || value === "admin";
}

export async function getAuthenticatedUserProfile(): Promise<AuthenticatedUserProfile | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(cookieStore);
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) {
    return null;
  }

  const { data, error } = await supabase
    .from("user")
    .select("full_name, role")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data || typeof data.full_name !== "string" || !isUserRole(data.role)) {
    return null;
  }

  return {
    full_name: data.full_name,
    role: data.role,
  };
}
