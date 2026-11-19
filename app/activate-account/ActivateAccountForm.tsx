"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { ValidatedInvitation } from "@/app/activate-account/actions";
import {
  registerParent,
  signInExistingParent,
} from "@/app/activate-account/registration-actions";

function relationshipLabel(
  relationship: ValidatedInvitation["relationship"],
): string {
  return {
    father: "Papá",
    mother: "Mamá",
    guardian: "Tutor/a",
  }[relationship];
}

export default function ActivateAccountForm({
  initialCode,
}: {
  initialCode: string;
}) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [photoConsent, setPhotoConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<ValidatedInvitation | null>(
    null,
  );
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [existingAccount, setExistingAccount] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    window.sessionStorage.setItem(
      "activation-code",
      code.trim().toUpperCase(),
    );
    document.cookie = `activation_code=${encodeURIComponent(code.trim().toUpperCase())}; Path=/; SameSite=Lax`;
    window.history.replaceState(
      null,
      "",
      `/activate-account?code=${encodeURIComponent(code.trim().toUpperCase())}`,
    );

    if (password.length < 8) {
      setError("Crea una contraseña de al menos 8 caracteres.");
      return;
    }

    if (!photoConsent) {
      setError("Confirma el consentimiento de fotos para continuar.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (!invitation) {
        const response = await fetch("/api/validate-invitation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, email }),
        });
        const result = (await response.json()) as
          | { ok: true; invitation: ValidatedInvitation }
          | { ok: false; message: string };
        if (!result.ok) {
          setError(result.message);
          setInvitation(null);
          return;
        }

        setInvitation(result.invitation);
        setError(
          "Código válido. Vuelve a presionar «Activar mi cuenta» para crear tu cuenta.",
        );
        return;
      }

      if (existingAccount) {
        const result = await signInExistingParent({
          code,
          email,
          password,
        });
        if (!result.ok) {
          setError(result.message);
          return;
        }

        router.replace("/");
        return;
      }

      const result = await registerParent({
        code,
        email,
        password,
        photoConsent,
      });
      if (!result.ok) {
        setError(result.message);
        if (result.reason === "existing-account") {
          setExistingAccount(true);
        }
        return;
      }

      setRegistrationComplete(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FBF4EC] p-10">
      <div className="mx-auto w-full max-w-[440px]">
        <div
          className="mb-[22px] flex h-[58px] w-[58px] items-center justify-center rounded-[18px] shadow-[0_12px_26px_-10px_rgba(238,129,100,0.65)]"
          style={{ background: "linear-gradient(155deg,#F8C3A8,#F2937A)" }}
        >
          <svg
            width="30"
            height="30"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        </div>

        <h1 className="mb-2 font-display text-[32px] font-semibold leading-[1.15] text-[#3F362E]">
          Bienvenida a OpenDayCare
        </h1>
        <p className="mb-[26px] text-[15.5px] leading-[1.55] text-[#94887B]">
          Te invitaron a seguir el día de tu hijo. Crea tu contraseña para
          activar la cuenta.
        </p>

        {registrationComplete ? (
          <div className="rounded-[16px] border border-[#CFEBD8] bg-[#F1FAF3] px-5 py-5 text-center">
            <div className="mb-2 font-display text-[20px] font-semibold text-[#3E9B6C]">
              Revisa tu correo
            </div>
            <p className="m-0 text-[14px] leading-relaxed text-[#527560]">
              Te enviamos un enlace para confirmar tu cuenta y vincularte con
              {` ${invitation?.childName ?? "tu hijo"}`}.
            </p>
          </div>
        ) : (
        <form noValidate onSubmit={handleSubmit}>
          <label
            htmlFor="activation-code"
            className="mb-2 block text-[12px] font-bold tracking-[0.7px] text-[#94887B]"
          >
            CÓDIGO DE INVITACIÓN
          </label>
          <input
            id="activation-code"
            value={code}
            onChange={(event) =>
              setCode(
                event.target.value
                  .toUpperCase()
                  .replace(/[^A-Z0-9]/g, "")
                  .slice(0, 5),
              )
            }
            autoComplete="one-time-code"
            maxLength={5}
            className="mb-[18px] w-full rounded-[14px] border-[1.5px] border-[#EADFD0] bg-white px-4 py-[14px] font-display text-[18px] font-bold tracking-[3px] text-[#3F362E] focus:outline-none"
          />

          <label
            htmlFor="activation-email"
            className="mb-2 block text-[12px] font-bold tracking-[0.7px] text-[#94887B]"
          >
            EMAIL
          </label>
          <input
            id="activation-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            className="mb-[18px] w-full rounded-[14px] border-[1.5px] border-[#EADFD0] bg-white px-4 py-[14px] text-[15px] text-[#3F362E] focus:outline-none"
          />

          <label
            htmlFor="activation-password"
            className="mb-2 block text-[12px] font-bold tracking-[0.7px] text-[#94887B]"
          >
            CREAR CONTRASEÑA
          </label>
          <input
            id="activation-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            className="mb-[18px] w-full rounded-[14px] border-[1.5px] border-[#EADFD0] bg-white px-4 py-[14px] text-[15px] text-[#3F362E] focus:outline-none"
          />

          <label className="mb-6 flex cursor-pointer items-start gap-3 rounded-[14px] bg-[#FBF1D6] px-4 py-[14px]">
            <input
              type="checkbox"
              checked={photoConsent}
              onChange={(event) => setPhotoConsent(event.target.checked)}
              className="mt-[1px] h-6 w-6 flex-none appearance-none rounded-[8px] border-[1.5px] border-[#D9CBAF] bg-white bg-center bg-no-repeat checked:border-[#5FB97E] checked:bg-[#5FB97E] checked:bg-[url('data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%2024%2024%22%20fill=%22none%22%20stroke=%22white%22%20stroke-width=%223%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22%3E%3Cpolyline%20points=%2220%206%209%2017%204%2012%22/%3E%3C/svg%3E')]"
            />
            <span className="text-[14px] leading-[1.45] text-[#8A7234]">
              Autorizo a la guardería a tomar y compartir fotos de mi hijo
              dentro de la app.
            </span>
          </label>

          {error ? (
            <p
              role="alert"
              className="mb-4 rounded-[12px] bg-[#FBE3D8] px-3.5 py-3 text-[13px] text-[#B8432F]"
            >
              {error}
            </p>
          ) : null}

          {existingAccount ? (
            <div className="mb-4 rounded-[14px] bg-[#FBF1D6] px-4 py-3 text-[13.5px] text-[#8A7234]">
              Este correo ya tiene una cuenta. Escribe tu contraseña para
              iniciar sesión y completar la vinculación con{" "}
              <strong>{invitation?.childName ?? "tu hijo"}</strong>.
            </div>
          ) : null}

          {invitation && !existingAccount ? (
            <div className="mb-4 rounded-[14px] bg-[#E3ECFB] px-4 py-3 text-[13.5px] text-[#3F5694]">
              Código válido. Te vincularás como{" "}
              <strong>{relationshipLabel(invitation.relationship)}</strong> de{" "}
              <strong>{invitation.childName}</strong>.
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="block w-full rounded-[15px] p-[15px] text-center text-[16px] font-extrabold text-white shadow-[0_10px_22px_-8px_rgba(238,129,100,0.7)] disabled:opacity-60"
            style={{
              background: "linear-gradient(180deg,#F4977E,#EE8164)",
            }}
          >
            {isSubmitting ? "Validando invitación…" : "Activar mi cuenta"}
          </button>
        </form>
        )}

        <p className="mt-[22px] text-center text-[14.5px] text-[#94887B]">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="font-extrabold text-[#C5503A]">
            Iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
