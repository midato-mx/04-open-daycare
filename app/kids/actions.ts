"use server";

import { randomInt, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { sendParentInvitationEmail } from "@/utils/email/invitation";
import { createClient as createServerClient } from "@/utils/supabase/server";

type RelationshipType = "father" | "mother" | "guardian";

export type AddKidResult =
  | { ok: true }
  | {
      ok: false;
      errors: {
        fullName?: string;
        birthDate?: string;
        room?: string;
        form?: string;
      };
    };

export type InviteParentResult =
  | { ok: true; invitationId: string }
  | { ok: false; message: string };

type BirthDateValidation = { date: Date } | { error: string };

const invitationCodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const invitationCodeLength = 5;
const invitationCodeAttempts = 5;

function createInvitationCode(): string {
  return Array.from({ length: invitationCodeLength }, () =>
    invitationCodeAlphabet.charAt(
      randomInt(0, invitationCodeAlphabet.length),
    ),
  ).join("");
}

function normalizeInvitationInput(input: {
  fullName: string;
  email: string;
  relationship: string;
  childId: string;
}) {
  const relationshipMap: Record<string, RelationshipType> = {
    father: "father",
    mother: "mother",
    guardian: "guardian",
    "Papá": "father",
    "Mamá": "mother",
    "Tutor/a": "guardian",
  };

  const relationship = relationshipMap[input.relationship];
  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  const childId = input.childId.trim();

  if (!fullName || !childId || !relationship) {
    return null;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return null;
  }

  return { fullName, email, relationship, childId };
}

export async function inviteParent(input: {
  fullName: string;
  email: string;
  relationship: string;
  childId: string;
}): Promise<InviteParentResult> {
  const normalizedInput = normalizeInvitationInput(input);
  if (!normalizedInput) {
    return { ok: false, message: "Revisa los datos de la invitación." };
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(cookieStore);
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) {
    return {
      ok: false,
      message: "Tu sesión expiró. Inicia sesión de nuevo.",
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("user")
    .select("daycare_id, role")
    .eq("id", userId)
    .maybeSingle();

  if (
    profileError ||
    !profile ||
    (profile.role !== "staff" && profile.role !== "admin")
  ) {
    return {
      ok: false,
      message: "No tienes permiso para enviar invitaciones.",
    };
  }

  if (!profile.daycare_id) {
    return {
      ok: false,
      message: "Tu cuenta no tiene una guardería asignada.",
    };
  }

  const { data: child, error: childError } = await supabase
    .from("child")
    .select("id, full_name, room_id")
    .eq("id", normalizedInput.childId)
    .maybeSingle();

  if (childError || !child) {
    return { ok: false, message: "No se encontró el niño seleccionado." };
  }

  const { data: room, error: roomError } = await supabase
    .from("room")
    .select("daycare_id")
    .eq("id", child.room_id)
    .eq("daycare_id", profile.daycare_id)
    .maybeSingle();

  if (roomError || !room) {
    return {
      ok: false,
      message: "No puedes invitar a un niño de otra guardería.",
    };
  }

  const { data: pendingInvitation, error: pendingError } = await supabase
    .from("invitation")
    .select("id")
    .eq("child_id", child.id)
    .eq("email", normalizedInput.email)
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();

  if (pendingError) {
    return {
      ok: false,
      message: "No se pudo revisar la invitación existente.",
    };
  }

  const expiresAt = new Date(
    Date.now() + 24 * 60 * 60 * 1000,
  ).toISOString();

  for (let attempt = 0; attempt < invitationCodeAttempts; attempt += 1) {
    const code = createInvitationCode();
    const invitationId = pendingInvitation?.id ?? randomUUID();
    const invitationData = {
      full_name: normalizedInput.fullName,
      email: normalizedInput.email,
      relationship: normalizedInput.relationship,
      code,
      status: "pending" as const,
      expires_at: expiresAt,
      accepted_at: null,
    };

    const invitationQuery = pendingInvitation
      ? supabase
          .from("invitation")
          .update(invitationData)
          .eq("id", invitationId)
      : supabase.from("invitation").insert({
          id: invitationId,
          child_id: child.id,
          invited_by: userId,
          ...invitationData,
        });

    const { error: invitationError } = await invitationQuery;
    if (!invitationError) {
      try {
        await sendParentInvitationEmail({
          parentName: normalizedInput.fullName,
          childName: child.full_name,
          email: normalizedInput.email,
          code,
        });
      } catch {
        await supabase
          .from("invitation")
          .update({
            status: "cancelled",
            expires_at: new Date().toISOString(),
          })
          .eq("id", invitationId)
          .eq("status", "pending");

        return {
          ok: false,
          message: "No pudimos enviar la invitación. Intenta de nuevo.",
        };
      }

      revalidatePath(`/kids/${child.id}`);
      return { ok: true, invitationId };
    }

    if (invitationError.code !== "23505") {
      return {
        ok: false,
        message: "No se pudo guardar la invitación.",
      };
    }
  }

  return {
    ok: false,
    message: "No se pudo generar un código disponible. Intenta de nuevo.",
  };
}

function parseBirthDate(value: string): Date | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12) {
    return null;
  }

  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function isFutureDate(date: Date): boolean {
  const today = new Date();
  const todayAtMidnight = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  return date.getTime() > todayAtMidnight.getTime();
}

function validateBirthDate(value: string): BirthDateValidation {
  if (!value) {
    return { error: "Escribe la fecha de nacimiento." };
  }

  const date = parseBirthDate(value);
  if (!date) {
    return { error: "Escribe una fecha válida (dd/mm/aaaa)." };
  }

  if (isFutureDate(date)) {
    return { error: "La fecha no puede ser en el futuro." };
  }

  return { date };
}

function formatDatabaseDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeAllergyTags(value: string): string[] {
  const tagMap: Record<string, string> = {
    egg: "egg",
    huevo: "egg",
    gluten: "gluten",
    lactose: "lactose",
    lactosa: "lactose",
    mani: "peanut",
    peanut: "peanut",
    cacahuate: "peanut",
    nuts: "tree_nut",
    nuez: "tree_nut",
    nueces: "tree_nut",
    seafood: "shellfish",
    mariscos: "shellfish",
    shellfish: "shellfish",
    soy: "soy",
    soya: "soy",
  };

  return Array.from(
    new Set(
      value
        .split(",")
        .map((tag) =>
          tag
            .trim()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase(),
        )
        .filter((tag) => tagMap[tag])
        .map((tag) => tagMap[tag]),
    ),
  );
}

export async function addKid(formData: FormData): Promise<AddKidResult> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const rawBirthDate = String(formData.get("birthDate") ?? "").trim();
  const roomId = String(formData.get("roomId") ?? "").trim();
  const allergies = String(formData.get("allergies") ?? "").trim();
  const medicalNotes = String(formData.get("medicalNotes") ?? "").trim();

  const errors: {
    fullName?: string;
    birthDate?: string;
    room?: string;
  } = {};
  if (!fullName) {
    errors.fullName = "Escribe el nombre completo.";
  }
  if (!roomId) {
    errors.room = "Selecciona una sala.";
  }

  const birthDateValidation = validateBirthDate(rawBirthDate);
  if ("error" in birthDateValidation) {
    return {
      ok: false,
      errors: { ...errors, birthDate: birthDateValidation.error },
    };
  }
  if (errors.fullName || errors.room) {
    return { ok: false, errors };
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(cookieStore);
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) {
    return {
      ok: false,
      errors: { form: "Tu sesión expiró. Inicia sesión de nuevo." },
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("user")
    .select("daycare_id, role")
    .eq("id", userId)
    .maybeSingle();

  if (
    profileError ||
    !profile ||
    (profile.role !== "staff" && profile.role !== "admin")
  ) {
    return {
      ok: false,
      errors: { form: "No tienes permiso para agregar niños." },
    };
  }

  if (!profile.daycare_id) {
    return {
      ok: false,
      errors: { form: "Tu cuenta no tiene una guardería asignada." },
    };
  }

  const { data: room, error: roomError } = await supabase
    .from("room")
    .select("id")
    .eq("id", roomId)
    .eq("daycare_id", profile.daycare_id)
    .maybeSingle();

  if (roomError || !room) {
    return {
      ok: false,
      errors: { room: "Selecciona una sala válida." },
    };
  }

  const { error: insertError } = await supabase.from("child").insert({
    room_id: room.id,
    full_name: fullName,
    birth_date: formatDatabaseDate(birthDateValidation.date),
    enrolled_at: formatDatabaseDate(new Date()),
    medical_notes: medicalNotes || null,
    allergy_tags: normalizeAllergyTags(allergies),
  });

  if (insertError) {
    return {
      ok: false,
      errors: { form: "No se pudo guardar al niño. Intenta de nuevo." },
    };
  }

  revalidatePath("/kids");
  return { ok: true };
}
