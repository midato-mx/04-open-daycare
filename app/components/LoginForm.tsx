"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const nextFieldErrors: typeof fieldErrors = {};
    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      nextFieldErrors.email = "Escribe tu correo electrónico.";
    }
    if (!password) {
      nextFieldErrors.password = "Escribe tu contraseña.";
    }

    setFieldErrors(nextFieldErrors);
    setAuthError(null);

    if (Object.keys(nextFieldErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) {
        setAuthError(
          error.code === "invalid_credentials"
            ? "El correo o la contraseña no son correctos."
            : "No pudimos iniciar sesión. Inténtalo de nuevo.",
        );
        return;
      }

      router.replace("/");
    } catch {
      setAuthError("No pudimos iniciar sesión. Inténtalo de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleEmailChange(value: string) {
    setEmail(value);
    setFieldErrors((currentErrors) => {
      if (!currentErrors.email) {
        return currentErrors;
      }

      const remainingErrors = { ...currentErrors };
      delete remainingErrors.email;
      return remainingErrors;
    });
    setAuthError(null);
  }

  function handlePasswordChange(value: string) {
    setPassword(value);
    setFieldErrors((currentErrors) => {
      if (!currentErrors.password) {
        return currentErrors;
      }

      const remainingErrors = { ...currentErrors };
      delete remainingErrors.password;
      return remainingErrors;
    });
    setAuthError(null);
  }

  return (
    <form onSubmit={handleSubmit}>
      <label
        htmlFor="login-email"
        className="mb-[9px] block text-[12px] font-bold tracking-[0.7px] text-[#94887B]"
      >
        EMAIL
      </label>
      <input
        id="login-email"
        name="email"
        type="email"
        value={email}
        onChange={(event) => handleEmailChange(event.target.value)}
        autoComplete="email"
        aria-invalid={Boolean(fieldErrors.email)}
        aria-describedby={fieldErrors.email ? "login-email-error" : undefined}
        autoCapitalize="none"
        spellCheck={false}
        className={`w-full rounded-[14px] border-[1.5px] bg-white px-4 py-[14px] text-[15px] text-[#3F362E] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C5503A] focus-visible:ring-offset-2 ${
          fieldErrors.email ? "border-[#D9583C]" : "border-[#EADFD0]"
        }`}
      />
      {fieldErrors.email && (
        <p
          id="login-email-error"
          className="mt-1.5 mb-[18px] text-[13px] text-[#D9583C]"
        >
          {fieldErrors.email}
        </p>
      )}
      {!fieldErrors.email && <div className="mb-[18px]" />}
      <label
        htmlFor="login-password"
        className="mb-2 block text-[12px] font-bold tracking-[0.7px] text-[#94887B]"
      >
        CONTRASEÑA
      </label>
      <input
        id="login-password"
        name="password"
        type="password"
        value={password}
        onChange={(event) => handlePasswordChange(event.target.value)}
        autoComplete="current-password"
        placeholder="••••••••"
        aria-invalid={Boolean(fieldErrors.password)}
        aria-describedby={
          fieldErrors.password ? "login-password-error" : undefined
        }
        className={`w-full rounded-[14px] border-[1.5px] bg-white px-4 py-[14px] text-[15px] text-[#3F362E] placeholder:text-[#B6A99B] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C5503A] focus-visible:ring-offset-2 ${
          fieldErrors.password ? "border-[#D9583C]" : "border-[#EADFD0]"
        }`}
      />
      {fieldErrors.password && (
        <p
          id="login-password-error"
          className="mt-1.5 mb-2.5 text-[13px] text-[#D9583C]"
        >
          {fieldErrors.password}
        </p>
      )}
      {!fieldErrors.password && <div className="mb-2.5" />}
      <div className="mb-5 text-right">
        <span className="text-[13.5px] font-bold text-[#C5503A]">
          ¿Olvidaste tu contraseña?
        </span>
      </div>

      {authError && (
        <p
          role="alert"
          className="mb-4 rounded-[12px] bg-[#FBE3D8] px-3.5 py-3 text-[13px] text-[#B8432F]"
        >
          {authError}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
        className="block w-full rounded-[15px] p-[15px] text-center text-[16px] font-extrabold text-white shadow-[0_10px_22px_-8px_rgba(238,129,100,0.7)]"
        style={{
          background: "linear-gradient(180deg,#F4977E,#EE8164)",
        }}
      >
        {isSubmitting ? "Iniciando sesión…" : "Iniciar sesión"}
      </button>

      <p className="mt-6 text-center text-[14.5px] text-[#94887B]">
        ¿Te invitó la guardería?{" "}
        <Link
          href="/activate-account"
          className="font-extrabold text-[#C5503A]"
        >
          Activa tu cuenta
        </Link>
      </p>
    </form>
  );
}
