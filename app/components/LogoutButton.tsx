"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function LogoutButton() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleLogout() {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        setErrorMessage("No se pudo cerrar sesión. Inténtalo de nuevo.");
        return;
      }

      router.replace("/login");
    } catch {
      setErrorMessage("No se pudo cerrar sesión. Inténtalo de nuevo.");
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <>
      <button
        type="button"
        title="Cerrar sesión"
        aria-label="Cerrar sesión"
        aria-busy={isSigningOut}
        aria-describedby={errorMessage ? "logout-error" : undefined}
        disabled={isSigningOut}
        onClick={handleLogout}
        className="flex h-8 w-8 flex-none items-center justify-center rounded-[10px] bg-[#F6ECDF] text-[#94887B] disabled:cursor-wait disabled:opacity-60"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
        </svg>
      </button>
      {errorMessage && (
        <span id="logout-error" role="alert" className="sr-only">
          {errorMessage}
        </span>
      )}
    </>
  );
}
