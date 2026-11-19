import { Resend } from "resend";

type ParentInvitationEmailInput = {
  parentName: string;
  childName: string;
  email: string;
  code: string;
};

type ParentInvitationEmailResult = {
  id: string | null;
};

const INVITATION_EXPIRY_HOURS = 24;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getEmailConfiguration() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!apiKey || !from || !appUrl) {
    throw new Error("La configuración del correo no está disponible.");
  }

  return { apiKey, from, appUrl };
}

function buildActivationUrl(appUrl: string, code: string) {
  const activationUrl = new URL("/activate-account", appUrl);
  activationUrl.searchParams.set("code", code);
  return activationUrl.toString();
}

function buildInvitationHtml({
  parentName,
  childName,
  code,
  activationUrl,
}: {
  parentName: string;
  childName: string;
  code: string;
  activationUrl: string;
}) {
  const safeParentName = escapeHtml(parentName);
  const safeChildName = escapeHtml(childName);
  const safeCode = escapeHtml(code);
  const safeActivationUrl = escapeHtml(activationUrl);

  return `
    <div style="font-family: Arial, sans-serif; color: #3f362e; line-height: 1.5;">
      <h1 style="color: #d9583c;">Activa tu cuenta de OpenDayCare</h1>
      <p>Hola ${safeParentName},</p>
      <p>
        La guardería te invitó a vincularte con el perfil de
        <strong>${safeChildName}</strong>.
      </p>
      <p>Usa este código para activar tu cuenta:</p>
      <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px;">
        ${safeCode}
      </p>
      <p>Tu invitación es válida durante ${INVITATION_EXPIRY_HOURS} horas.</p>
      <p>
        <a
          href="${safeActivationUrl}"
          style="display: inline-block; background: #d9583c; color: #ffffff;
            padding: 12px 18px; border-radius: 8px; text-decoration: none;"
        >
          Activa tu cuenta
        </a>
      </p>
      <p style="color: #94887b; font-size: 13px;">
        Si no esperabas esta invitación, puedes ignorar este correo.
      </p>
    </div>
  `;
}

export async function sendParentInvitationEmail(
  input: ParentInvitationEmailInput,
): Promise<ParentInvitationEmailResult> {
  const { apiKey, from, appUrl } = getEmailConfiguration();
  const resend = new Resend(apiKey);
  const activationUrl = buildActivationUrl(appUrl, input.code);

  const { data, error } = await resend.emails.send({
    from,
    to: [input.email],
    subject: `Invitación para vincularte con ${input.childName}`,
    html: buildInvitationHtml({
      parentName: input.parentName,
      childName: input.childName,
      code: input.code,
      activationUrl,
    }),
  });

  if (error) {
    throw new Error("No se pudo enviar la invitación por correo.");
  }

  return { id: data?.id ?? null };
}
