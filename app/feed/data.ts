import "server-only";

import { cookies } from "next/headers";
import type { FeedPost, FeedPhoto, PostType } from "@/app/lib/data";
import { createClient as createServerClient } from "@/utils/supabase/server";

type UserRole = "staff" | "parent" | "admin";

type UserProfile = {
  id: string;
  daycare_id: string | null;
  role: UserRole;
  full_name: string;
};

type PostRow = {
  id: string;
  author_id: string;
  room_id: string | null;
  type: PostType;
  title: string | null;
  body: string;
  published_at: string;
};

type AuthorRow = {
  id: string;
  full_name: string;
};

type ChildRow = {
  id: string;
  full_name: string;
  room_id: string;
};

type PostChildRow = {
  post_id: string;
  child_id: string;
};

type PostPhotoRow = {
  id: string;
  post_id: string;
  storage_path: string;
};

export type FeedPageData = {
  profile: UserProfile | null;
  posts: FeedPost[];
  kidsCount: number;
  dateLabel: string;
  canCompose: boolean;
  error: string | null;
};

const postTypeLabels: Record<PostType, string> = {
  meal: "Comida",
  nap: "Siesta",
  activity: "Actividad",
  achievement: "Logro",
  mood: "Ánimo",
  photo: "Foto",
  announcement: "Anuncio",
};

function formatPostTime(value: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function formatDateLabel(value: Date): string {
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "short",
  }).format(value);
}

function makeAudienceLabel(
  post: PostRow,
  childNames: string[],
  isParent: boolean,
): string {
  if (post.type === "announcement") {
    return "Para: toda la sala";
  }

  if (isParent) {
    return "Visible para las familias vinculadas";
  }

  if (childNames.length === 0) {
    return "Para: familias vinculadas";
  }

  const names = childNames.join(", ");
  return `Para: familia${childNames.length > 1 ? "s" : ""} de ${names}`;
}

async function createSignedPhotos(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  photos: PostPhotoRow[],
): Promise<Map<string, FeedPhoto[]>> {
  const entries = await Promise.all(
    photos.map(async (photo) => {
      const { data, error } = await supabase.storage
        .from("post-media")
        .createSignedUrl(photo.storage_path, 300);

      if (error || !data?.signedUrl) {
        return null;
      }

      return {
        postId: photo.post_id,
        photo: {
          id: photo.id,
          url: data.signedUrl,
          alt: "Fotografía de la publicación",
          storagePath: photo.storage_path,
        },
      };
    }),
  );

  const photosByPost = new Map<string, FeedPhoto[]>();
  for (const entry of entries) {
    if (!entry) {
      continue;
    }
    const current = photosByPost.get(entry.postId) ?? [];
    current.push(entry.photo);
    photosByPost.set(entry.postId, current);
  }
  return photosByPost;
}

export async function getFeedPageData(): Promise<FeedPageData> {
  const emptyData: FeedPageData = {
    profile: null,
    posts: [],
    kidsCount: 0,
    dateLabel: formatDateLabel(new Date()),
    canCompose: false,
    error: null,
  };

  const cookieStore = await cookies();
  const supabase = createServerClient(cookieStore);
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) {
    return { ...emptyData, error: "Inicia sesión para ver el feed." };
  }

  const { data: profileData, error: profileError } = await supabase
    .from("user")
    .select("id, daycare_id, role, full_name")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profileData) {
    return { ...emptyData, error: "No pudimos cargar tu perfil." };
  }

  const profile = profileData as UserProfile;
  const { data: postData, error: postsError } = await supabase
    .from("post")
    .select("id, author_id, room_id, type, title, body, published_at")
    .order("published_at", { ascending: false });

  if (postsError) {
    return {
      ...emptyData,
      profile,
      canCompose: profile.role === "staff" || profile.role === "admin",
      error: "No pudimos cargar las publicaciones.",
    };
  }

  const rows = (postData ?? []) as PostRow[];
  const postIds = rows.map((post) => post.id);
  const authorIds = Array.from(new Set(rows.map((post) => post.author_id)));

  const [{ data: authorData }, { data: recipientData }, { data: photoData }] =
    await Promise.all([
      authorIds.length > 0
        ? supabase.from("user").select("id, full_name").in("id", authorIds)
        : Promise.resolve({ data: [] }),
      postIds.length > 0
        ? supabase
            .from("post_child")
            .select("post_id, child_id")
            .in("post_id", postIds)
        : Promise.resolve({ data: [] }),
      postIds.length > 0
        ? supabase
            .from("post_photo")
            .select("id, post_id, storage_path")
            .in("post_id", postIds)
        : Promise.resolve({ data: [] }),
    ]);

  const authors = new Map(
    ((authorData ?? []) as AuthorRow[]).map((author) => [
      author.id,
      author.full_name,
    ]),
  );
  const recipients = (recipientData ?? []) as PostChildRow[];
  const recipientIds = Array.from(
    new Set(recipients.map((recipient) => recipient.child_id)),
  );
  const { data: childData } =
    recipientIds.length > 0
      ? await supabase
          .from("child")
          .select("id, full_name, room_id")
          .in("id", recipientIds)
      : { data: [] };
  const children = new Map(
    ((childData ?? []) as ChildRow[]).map((child) => [child.id, child]),
  );
  const photosByPost = await createSignedPhotos(
    supabase,
    (photoData ?? []) as PostPhotoRow[],
  );
  const isParent = profile.role === "parent";

  const { count: linkedKidsCount } = await supabase
    .from("parent_child")
    .select("child_id", { count: "exact", head: true })
    .eq("parent_id", userId);
  const { count: daycareKidsCount } =
    !isParent && profile.daycare_id
      ? await supabase
          .from("child")
          .select("id", { count: "exact", head: true })
      : { count: null };

  const posts = rows.map((post) => {
    const postRecipients = recipients.filter(
      (recipient) => recipient.post_id === post.id,
    );
    const childNames = postRecipients
      .map((recipient) => children.get(recipient.child_id)?.full_name)
      .filter((name): name is string => Boolean(name));
    const photos = photosByPost.get(post.id) ?? [];

    return {
      id: post.id,
      type: post.type,
      authorName: isParent
        ? "Equipo de tu guardería"
        : (authors.get(post.author_id) ?? "Equipo de la guardería"),
      authorInitial: isParent
        ? undefined
        : (authors.get(post.author_id)?.charAt(0).toUpperCase() ?? undefined),
      time: formatPostTime(post.published_at),
      publishedBy: isParent
        ? "publicado por la guardería"
        : post.author_id === userId
          ? "publicado por ti"
          : "publicado por tu equipo",
      audience: makeAudienceLabel(post, childNames, isParent),
      roomId: post.room_id,
      childIds: postRecipients.map((recipient) => recipient.child_id),
      body: post.body,
      photoLabel:
        photos.length > 0
          ? `${photos.length} ${photos.length === 1 ? "foto" : "fotos"} adjunta${photos.length === 1 ? "" : "s"}`
          : undefined,
      photos,
      isAuthor: post.author_id === userId,
      likes: 0,
      comments: 0,
    } satisfies FeedPost;
  });

  return {
    profile,
    posts,
    kidsCount: (isParent ? linkedKidsCount : daycareKidsCount) ?? 0,
    dateLabel: formatDateLabel(new Date()),
    canCompose: profile.role === "staff" || profile.role === "admin",
    error: null,
  };
}

export { postTypeLabels };
