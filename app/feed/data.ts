import "server-only";

import { cookies } from "next/headers";
import type { FeedPost, PostType } from "@/app/lib/data";
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
  type: "meal" | "nap" | "activity" | "achievement" | "photo" | "announcement";
  title: string | null;
  body: string;
  published_at: string;
};

type AuthorRow = {
  id: string;
  full_name: string;
};

export type FeedPageData = {
  profile: UserProfile | null;
  posts: FeedPost[];
  kidsCount: number;
  dateLabel: string;
  canCompose: boolean;
  error: string | null;
};

const postTypeMap: Record<PostRow["type"], PostType> = {
  meal: "activity",
  nap: "activity",
  activity: "activity",
  achievement: "achievement",
  photo: "activity",
  announcement: "announcement",
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
    return {
      ...emptyData,
      error: "No pudimos cargar tu perfil.",
    };
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
  const authorIds = Array.from(new Set(rows.map((post) => post.author_id)));
  const { data: authorData } =
    authorIds.length > 0
      ? await supabase
          .from("user")
          .select("id, full_name")
          .in("id", authorIds)
      : { data: [] };
  const authors = new Map(
    ((authorData ?? []) as AuthorRow[]).map((author) => [
      author.id,
      author.full_name,
    ]),
  );

  const { count: linkedKidsCount } = await supabase
    .from("parent_child")
    .select("child_id", { count: "exact", head: true })
    .eq("parent_id", userId);

  const isParent = profile.role === "parent";
  const posts = rows.map((post) => ({
    id: post.id,
    type: postTypeMap[post.type],
    authorName: isParent
      ? "Equipo de tu guardería"
      : (authors.get(post.author_id) ?? "Equipo de la guardería"),
    authorInitial: isParent
      ? undefined
      : (authors.get(post.author_id)?.charAt(0).toUpperCase() ?? undefined),
    time: formatPostTime(post.published_at),
    publishedBy: isParent ? "publicado por la guardería" : "publicado por ti",
    audience: isParent
      ? "Visible para las familias vinculadas"
      : post.type === "announcement"
        ? "Para: toda la sala"
        : "Para: familias vinculadas",
    body: post.body,
    photoLabel: post.type === "photo" ? "Foto adjunta" : undefined,
    likes: 0,
    comments: 0,
  }));

  return {
    profile,
    posts,
    kidsCount: linkedKidsCount ?? 0,
    dateLabel: formatDateLabel(new Date()),
    canCompose: profile.role === "staff" || profile.role === "admin",
    error: null,
  };
}
