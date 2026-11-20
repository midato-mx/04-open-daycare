"use client";

import { useState } from "react";
import DeletePostDialog from "@/app/components/DeletePostDialog";
import type { FeedPost, PostType } from "@/app/lib/data";

type FeedPostCardProps = Readonly<{
  post: FeedPost;
}>;

type Badge = {
  label: string;
  colors: string;
};

const BADGE: Record<PostType, Badge> = {
  meal: { label: "COMIDA", colors: "bg-[#F4DC8E] text-[#9A7B1E]" },
  nap: { label: "SIESTA", colors: "bg-[#E7DCF6] text-[#7B5FC0]" },
  achievement: { label: "LOGRO", colors: "bg-[#CFEBD8] text-[#3E9B6C]" },
  activity: { label: "ACTIVIDAD", colors: "bg-[#C7E7F1] text-[#2E89A6]" },
  mood: { label: "ÁNIMO", colors: "bg-[#F9D2DE] text-[#C56486]" },
  photo: { label: "FOTO", colors: "bg-[#FBD8CC] text-[#D9684A]" },
  announcement: { label: "ANUNCIO", colors: "bg-[#CCD8F4] text-[#4E72C8]" },
};

export default function FeedPostCard({ post }: FeedPostCardProps) {
  const badge = BADGE[post.type];
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  return (
    <article className="rounded-[20px] border border-[#ECE0D0] bg-[#FFFDF9] px-[22px] py-5 shadow-[0_4px_16px_-12px_rgba(120,90,60,0.5)]">
      <div className="mb-3.5 flex items-center gap-3">
        {post.authorInitial ? (
          <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[#A9D9E8] font-display text-[17px] font-semibold text-[#1F7A93]">
            {post.authorInitial}
          </span>
        ) : (
          <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[#CCD8F4] text-[#4E72C8]">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m3 11 18-5v12L3 14v-3zM11.6 16.8a3 3 0 1 1-5.8-1.6" />
            </svg>
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-display text-[16.5px] font-semibold text-[#3F362E]">
            {post.authorName}
          </span>
          <span className="text-[12.5px] text-[#A89A8B]">
            {post.time} · {post.publishedBy}
          </span>
        </div>
        <span
          className={`flex flex-none items-center gap-[7px] rounded-full px-3 py-1.5 ${badge.colors}`}
        >
          <span className="h-2 w-2 rounded-full bg-current" />
          <span className="text-[12px] font-extrabold tracking-[0.5px]">
            {badge.label}
          </span>
        </span>
      </div>

      <div className="mb-2.5 text-[12.5px] text-[#A89A8B]">{post.audience}</div>
      <p className="m-0 text-[15.5px] leading-[1.55] text-[#4A4038]">
        {post.body}
      </p>

      {post.photos.length > 0 && (
        <div
          className={`mt-3.5 grid gap-2 overflow-hidden rounded-[16px] ${
            post.photos.length === 1 ? "grid-cols-1" : "grid-cols-2"
          }`}
          aria-label={`${post.photos.length} ${
            post.photos.length === 1 ? "fotografía" : "fotografías"
          }`}
        >
          {post.photos.map((photo) => (
            // Signed URLs are generated server-side and are intentionally not
            // passed through next/image's public image configuration.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={photo.id}
              src={photo.url}
              alt={photo.alt}
              className={`h-[200px] w-full object-cover ${
                post.photos.length > 2 ? "max-h-[180px]" : ""
              }`}
            />
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center gap-[18px] border-t border-[#F0E6D8] pt-3.5">
        <span className="flex items-center gap-[7px] text-[14px] font-bold text-[#E0654A]">
          <svg
            width="19"
            height="19"
            viewBox="0 0 24 24"
            fill="#E0654A"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21.2l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z" />
          </svg>
          {post.likes}
        </span>
        <span className="flex items-center gap-[7px] text-[14px] font-bold text-[#94887B]">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z" />
          </svg>
          {post.comments}
        </span>
        <span className="flex-1" />
        {post.isAuthor ? (
          <>
            <button
              type="button"
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent("opendaycare:open-create-post", {
                    detail: { post },
                  }),
                )
              }
              className="cursor-pointer border-none bg-transparent p-0 text-[14px] font-extrabold text-[#C5503A]"
              data-post-action="edit"
              data-post-id={post.id}
            >
              Editar
            </button>
            <button
              type="button"
              onClick={() => setIsDeleteDialogOpen(true)}
              className="cursor-pointer border-none bg-transparent p-0 text-[14px] font-extrabold text-[#94887B]"
            >
              Eliminar
            </button>
          </>
        ) : null}
      </div>
      <DeletePostDialog
        postId={post.id}
        open={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
      />
    </article>
  );
}
