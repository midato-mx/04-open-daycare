"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient as createServerClient } from "@/utils/supabase/server";

export type PostType =
  | "meal"
  | "nap"
  | "activity"
  | "achievement"
  | "mood"
  | "photo"
  | "announcement";

export type PostAudience =
  | { kind: "room"; roomId: string }
  | { kind: "children"; roomId: string; childIds: string[] };

export type PostDraft = {
  audience: PostAudience;
  type: PostType;
  body: string;
  photos: File[];
};

export type PublishableChild = {
  id: string;
  fullName: string;
  roomId: string;
};

export type PublishableRoom = {
  id: string;
  name: string;
  children: PublishableChild[];
};

type UserRole = "staff" | "parent" | "admin";

type UserProfile = {
  id: string;
  daycare_id: string | null;
  role: UserRole;
};

type ActionFailure = {
  ok: false;
  error: string;
};

type ActionSuccess<T> = {
  ok: true;
  data: T;
};

export type ActionResult<T> = ActionSuccess<T> | ActionFailure;

const MAX_PHOTOS = 10;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function isPublisherRole(role: UserRole): boolean {
  return role === "staff" || role === "admin";
}

function isPostType(value: string): value is PostType {
  return [
    "meal",
    "nap",
    "activity",
    "achievement",
    "mood",
    "photo",
    "announcement",
  ].includes(value);
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType === "image/jpeg") {
    return "jpg";
  }
  if (mimeType === "image/png") {
    return "png";
  }
  return "webp";
}

function validatePhotos(photos: File[]): string | null {
  if (photos.length > MAX_PHOTOS) {
    return "Puedes agregar hasta 10 imágenes por publicación.";
  }

  const invalidPhoto = photos.find(
    (photo) =>
      !ALLOWED_MIME_TYPES.has(photo.type) ||
      photo.size <= 0 ||
      photo.size > MAX_PHOTO_BYTES,
  );

  if (!invalidPhoto) {
    return null;
  }

  if (!ALLOWED_MIME_TYPES.has(invalidPhoto.type)) {
    return "Solo se aceptan imágenes JPG, PNG o WebP.";
  }

  return "Cada imagen debe pesar máximo 10 MB.";
}

async function getAuthorizedContext() {
  const cookieStore = await cookies();
  const supabase = createServerClient(cookieStore);
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) {
    return {
      supabase,
      profile: null,
      error: "Tu sesión expiró. Inicia sesión de nuevo.",
    };
  }

  const { data, error } = await supabase
    .from("user")
    .select("id, daycare_id, role")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    return {
      supabase,
      profile: null,
      error: "No pudimos validar tu perfil.",
    };
  }

  return {
    supabase,
    profile: data as UserProfile,
    error: null,
  };
}

async function getValidAudience(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  profile: UserProfile,
  audience: PostAudience,
): Promise<ActionResult<PublishableChild[]>> {
  if (!profile.daycare_id) {
    return { ok: false, error: "Tu cuenta no está vinculada a una guardería." };
  }

  const { data: room, error: roomError } = await supabase
    .from("room")
    .select("id")
    .eq("id", audience.roomId)
    .eq("daycare_id", profile.daycare_id)
    .maybeSingle();

  if (roomError || !room) {
    return { ok: false, error: "La sala seleccionada no es válida." };
  }

  const { data: children, error: childrenError } = await supabase
    .from("child")
    .select("id, full_name, room_id")
    .eq("room_id", audience.roomId)
    .eq("status", "active");

  if (childrenError) {
    return { ok: false, error: "No pudimos validar a los niños de la sala." };
  }

  const childrenById = new Map(
    (children ?? []).map((child) => [
      child.id as string,
      {
        id: child.id as string,
        fullName: child.full_name as string,
        roomId: child.room_id as string,
      },
    ]),
  );

  const { data: linkedChildren, error: linksError } = await supabase
    .from("parent_child")
    .select("child_id")
    .in("child_id", Array.from(childrenById.keys()));

  if (linksError) {
    return {
      ok: false,
      error: "No pudimos validar las familias vinculadas a la sala.",
    };
  }

  const validChildren = (linkedChildren ?? [])
    .map((link) => childrenById.get(link.child_id as string))
    .filter((child): child is PublishableChild => Boolean(child));

  if (validChildren.length === 0) {
    return {
      ok: false,
      error: "La sala no tiene niños con familias vinculadas.",
    };
  }

  if (audience.kind === "room") {
    return { ok: true, data: validChildren };
  }

  const childIds = Array.from(new Set(audience.childIds));
  if (childIds.length === 0 || childIds.some((id) => !childrenById.has(id))) {
    return {
      ok: false,
      error: "Selecciona niños válidos de la sala elegida.",
    };
  }

  const validChildIds = new Set(validChildren.map((child) => child.id));
  if (childIds.some((id) => !validChildIds.has(id))) {
    return {
      ok: false,
      error: "Cada niño seleccionado debe tener una familia vinculada.",
    };
  }

  return {
    ok: true,
    data: childIds.map((id) => childrenById.get(id) as PublishableChild),
  };
}

export async function getPublishableRooms(): Promise<
  ActionResult<PublishableRoom[]>
> {
  const { supabase, profile, error } = await getAuthorizedContext();

  if (error || !profile || !isPublisherRole(profile.role)) {
    return { ok: false, error: error ?? "No tienes permiso para publicar." };
  }

  if (!profile.daycare_id) {
    return { ok: false, error: "Tu cuenta no está vinculada a una guardería." };
  }

  const { data: rooms, error: roomsError } = await supabase
    .from("room")
    .select("id, name")
    .eq("daycare_id", profile.daycare_id)
    .order("name");

  if (roomsError) {
    return { ok: false, error: "No pudimos cargar las salas." };
  }

  const result: PublishableRoom[] = [];
  for (const room of rooms ?? []) {
    const audience = await getValidAudience(supabase, profile, {
      kind: "room",
      roomId: room.id as string,
    });

    if (audience.ok) {
      result.push({
        id: room.id as string,
        name: room.name as string,
        children: audience.data,
      });
    }
  }

  return { ok: true, data: result };
}

async function uploadPostPhotos(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  daycareId: string,
  postId: string,
  photos: File[],
): Promise<ActionResult<string[]>> {
  const uploadedPaths: string[] = [];

  for (const photo of photos) {
    const photoId = crypto.randomUUID();
    const path = `${daycareId}/${postId}/${photoId}.${extensionForMimeType(photo.type)}`;
    const { error } = await supabase.storage
      .from("post-media")
      .upload(path, photo, {
        contentType: photo.type,
        upsert: false,
      });

    if (error) {
      if (uploadedPaths.length > 0) {
        await supabase.storage.from("post-media").remove(uploadedPaths);
      }
      return {
        ok: false,
        error:
          "No pudimos subir una imagen. Revisa el archivo e inténtalo de nuevo.",
      };
    }

    uploadedPaths.push(path);
  }

  return { ok: true, data: uploadedPaths };
}

async function removePostPhotos(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  paths: string[],
) {
  if (paths.length > 0) {
    await supabase.storage.from("post-media").remove(paths);
  }
}

type PostSnapshot = {
  id: string;
  roomId: string;
  type: PostType;
  body: string;
  childIds: string[];
  photos: Array<{
    storagePath: string;
    mimeType: string;
    byteSize: number;
    displayOrder: number;
  }>;
};

async function getPostSnapshot(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  postId: string,
  authorId: string,
): Promise<PostSnapshot | null> {
  const [{ data: post }, { data: recipients }, { data: photos }] =
    await Promise.all([
      supabase
        .from("post")
        .select("id, room_id, type, body")
        .eq("id", postId)
        .eq("author_id", authorId)
        .maybeSingle(),
      supabase.from("post_child").select("child_id").eq("post_id", postId),
      supabase
        .from("post_photo")
        .select("storage_path, mime_type, byte_size, display_order")
        .eq("post_id", postId),
    ]);

  if (
    !post ||
    typeof post.id !== "string" ||
    typeof post.room_id !== "string" ||
    !isPostType(post.type as string) ||
    typeof post.body !== "string"
  ) {
    return null;
  }

  return {
    id: post.id,
    roomId: post.room_id,
    type: post.type as PostType,
    body: post.body,
    childIds: (recipients ?? []).map(
      (recipient) => recipient.child_id as string,
    ),
    photos: (photos ?? []).map((photo) => ({
      storagePath: photo.storage_path as string,
      mimeType: photo.mime_type as string,
      byteSize: photo.byte_size as number,
      displayOrder: photo.display_order as number,
    })),
  };
}

async function restorePostSnapshot(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  snapshot: PostSnapshot,
) {
  await supabase
    .from("post")
    .update({
      room_id: snapshot.roomId,
      type: snapshot.type,
      body: snapshot.body,
    })
    .eq("id", snapshot.id);

  await supabase.from("post_child").delete().eq("post_id", snapshot.id);
  if (snapshot.childIds.length > 0) {
    await supabase.from("post_child").insert(
      snapshot.childIds.map((childId) => ({
        post_id: snapshot.id,
        child_id: childId,
      })),
    );
  }
}

async function removeUploadedPostPhotos(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  postId: string,
  uploadedPaths: string[],
) {
  await removePostPhotos(supabase, uploadedPaths);
  if (uploadedPaths.length > 0) {
    await supabase
      .from("post_photo")
      .delete()
      .eq("post_id", postId)
      .in("storage_path", uploadedPaths);
  }
}

export async function createPost(
  draft: PostDraft,
): Promise<ActionResult<{ postId: string }>> {
  const { supabase, profile, error } = await getAuthorizedContext();

  if (error || !profile || !isPublisherRole(profile.role)) {
    return { ok: false, error: error ?? "No tienes permiso para publicar." };
  }

  const body = draft.body.trim();
  if (!body) {
    return { ok: false, error: "Escribe una descripción antes de publicar." };
  }
  if (!isPostType(draft.type)) {
    return { ok: false, error: "Selecciona un tipo de publicación válido." };
  }

  const photoError = validatePhotos(draft.photos);
  if (photoError) {
    return { ok: false, error: photoError };
  }

  const audience = await getValidAudience(supabase, profile, draft.audience);
  if (!audience.ok) {
    return audience;
  }

  const persistedType =
    draft.audience.kind === "room" ? "announcement" : draft.type;
  // Generate the identifier before inserting so this operation does not need
  // INSERT ... RETURNING. The post SELECT policy intentionally limits reads,
  // and PostgREST applies that policy to a RETURNING clause as well.
  const postId = crypto.randomUUID();
  const { error: postError } = await supabase.from("post").insert({
    id: postId,
    author_id: profile.id,
    room_id: draft.audience.roomId,
    type: persistedType,
    body,
  });

  if (postError) {
    return {
      ok: false,
      error: "No pudimos crear la publicación. Inténtalo de nuevo.",
    };
  }

  const childIds =
    draft.audience.kind === "children"
      ? audience.data.map((child) => ({ post_id: postId, child_id: child.id }))
      : [];

  if (childIds.length > 0) {
    const { error: relationError } = await supabase
      .from("post_child")
      .insert(childIds);

    if (relationError) {
      await supabase.from("post").delete().eq("id", postId);
      return {
        ok: false,
        error:
          "No pudimos guardar los destinatarios. La publicación no se creó.",
      };
    }
  }

  const uploadResult = await uploadPostPhotos(
    supabase,
    profile.daycare_id as string,
    postId,
    draft.photos,
  );

  if (!uploadResult.ok) {
    await supabase.from("post").delete().eq("id", postId);
    return uploadResult;
  }

  if (uploadResult.data.length > 0) {
    const { error: photoError } = await supabase.from("post_photo").insert(
      uploadResult.data.map((storagePath, displayOrder) => {
        const photo = draft.photos[displayOrder];
        return {
          post_id: postId,
          storage_path: storagePath,
          mime_type: photo.type,
          byte_size: photo.size,
          display_order: displayOrder,
        };
      }),
    );

    if (photoError) {
      await removePostPhotos(supabase, uploadResult.data);
      await supabase.from("post").delete().eq("id", postId);
      return {
        ok: false,
        error: "No pudimos guardar las imágenes. La publicación no se creó.",
      };
    }
  }

  revalidatePath("/");
  return { ok: true, data: { postId } };
}

export async function updatePost(
  postId: string,
  draft: PostDraft,
  photosToRemove: string[] = [],
): Promise<ActionResult<{ postId: string }>> {
  const { supabase, profile, error } = await getAuthorizedContext();

  if (error || !profile || !isPublisherRole(profile.role)) {
    return { ok: false, error: error ?? "No tienes permiso para editar." };
  }

  const body = draft.body.trim();
  if (!body) {
    return { ok: false, error: "Escribe una descripción antes de guardar." };
  }
  if (!isPostType(draft.type)) {
    return { ok: false, error: "Selecciona un tipo de publicación válido." };
  }

  const photoError = validatePhotos(draft.photos);
  if (photoError) {
    return { ok: false, error: photoError };
  }

  const audience = await getValidAudience(supabase, profile, draft.audience);
  if (!audience.ok) {
    return audience;
  }

  const snapshot = await getPostSnapshot(supabase, postId, profile.id);
  if (!snapshot) {
    return {
      ok: false,
      error: "No encontramos una publicación propia para editar.",
    };
  }

  const pathsToDelete = Array.from(new Set(photosToRemove)).filter((path) =>
    snapshot.photos.some((photo) => photo.storagePath === path),
  );
  const persistedType =
    draft.audience.kind === "room" ? "announcement" : draft.type;
  const uploadResult = await uploadPostPhotos(
    supabase,
    profile.daycare_id as string,
    postId,
    draft.photos,
  );

  if (!uploadResult.ok) {
    return uploadResult;
  }

  const uploadedPaths = uploadResult.data;
  if (uploadedPaths.length > 0) {
    const { error: photoError } = await supabase.from("post_photo").insert(
      uploadedPaths.map((storagePath, displayOrder) => {
        const photo = draft.photos[displayOrder];
        return {
          post_id: postId,
          storage_path: storagePath,
          mime_type: photo.type,
          byte_size: photo.size,
          display_order: snapshot.photos.length + displayOrder,
        };
      }),
    );

    if (photoError) {
      await removeUploadedPostPhotos(supabase, postId, uploadedPaths);
      return {
        ok: false,
        error:
          "No pudimos guardar las imágenes. La publicación anterior se conservó.",
      };
    }
  }

  const { error: updateError } = await supabase
    .from("post")
    .update({
      room_id: draft.audience.roomId,
      type: persistedType,
      body,
    })
    .eq("id", postId)
    .eq("author_id", profile.id);

  if (updateError) {
    await removeUploadedPostPhotos(supabase, postId, uploadedPaths);
    await restorePostSnapshot(supabase, snapshot);
    return {
      ok: false,
      error:
        "No pudimos guardar los cambios. La publicación anterior se conservó.",
    };
  }

  const { error: deleteRecipientsError } = await supabase
    .from("post_child")
    .delete()
    .eq("post_id", postId);

  if (deleteRecipientsError) {
    await removeUploadedPostPhotos(supabase, postId, uploadedPaths);
    await restorePostSnapshot(supabase, snapshot);
    return {
      ok: false,
      error: "No pudimos actualizar los destinatarios.",
    };
  }

  if (draft.audience.kind === "children") {
    const { error: recipientError } = await supabase.from("post_child").insert(
      audience.data.map((child) => ({
        post_id: postId,
        child_id: child.id,
      })),
    );

    if (recipientError) {
      await removeUploadedPostPhotos(supabase, postId, uploadedPaths);
      await restorePostSnapshot(supabase, snapshot);
      return {
        ok: false,
        error: "No pudimos actualizar los destinatarios.",
      };
    }
  }

  if (pathsToDelete.length > 0) {
    const { error: storageError } = await supabase.storage
      .from("post-media")
      .remove(pathsToDelete);

    if (storageError) {
      await removeUploadedPostPhotos(supabase, postId, uploadedPaths);
      await restorePostSnapshot(supabase, snapshot);
      return {
        ok: false,
        error:
          "No pudimos eliminar las imágenes seleccionadas. La publicación anterior se conservó.",
      };
    }

    const { error: deletePhotosError } = await supabase
      .from("post_photo")
      .delete()
      .eq("post_id", postId)
      .in("storage_path", pathsToDelete);

    if (deletePhotosError) {
      await removeUploadedPostPhotos(supabase, postId, uploadedPaths);
      await restorePostSnapshot(supabase, snapshot);
      return {
        ok: false,
        error:
          "No pudimos actualizar las imágenes. La publicación anterior se conservó.",
      };
    }
  }

  revalidatePath("/");
  return { ok: true, data: { postId: snapshot.id } };
}

export async function deletePost(
  postId: string,
): Promise<ActionResult<{ postId: string }>> {
  const { supabase, profile, error } = await getAuthorizedContext();

  if (error || !profile || !isPublisherRole(profile.role)) {
    return { ok: false, error: error ?? "No tienes permiso para eliminar." };
  }

  const { data: photos, error: photosError } = await supabase
    .from("post_photo")
    .select("storage_path")
    .eq("post_id", postId);

  if (photosError) {
    return {
      ok: false,
      error: "No pudimos preparar las imágenes para eliminar la publicación.",
    };
  }

  const paths = (photos ?? []).map((photo) => photo.storage_path as string);
  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from("post-media")
      .remove(paths);

    if (storageError) {
      return {
        ok: false,
        error: "No pudimos eliminar las imágenes. La publicación se conservó.",
      };
    }
  }

  const { error: deleteError } = await supabase
    .from("post")
    .delete()
    .eq("id", postId)
    .eq("author_id", profile.id);

  if (deleteError) {
    return {
      ok: false,
      error: "No pudimos eliminar la publicación. Inténtalo de nuevo.",
    };
  }

  revalidatePath("/");
  return { ok: true, data: { postId } };
}
