"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deletePost } from "@/app/feed/actions";

type DeletePostDialogProps = Readonly<{
  postId: string;
  open: boolean;
  onClose: () => void;
}>;

export default function DeletePostDialog({
  postId,
  open,
  onClose,
}: DeletePostDialogProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return null;
  }

  const handleDelete = async () => {
    if (isDeleting) {
      return;
    }

    setIsDeleting(true);
    setError(null);
    const result = await deletePost(postId);
    setIsDeleting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    onClose();
    router.refresh();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(40,32,26,0.5)] px-6"
      onClick={onClose}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-post-dialog-title"
        aria-describedby="delete-post-dialog-description"
        className="w-full max-w-[420px] rounded-[20px] border border-[#ECE0D0] bg-[#FBF4EC] p-6 shadow-[0_20px_50px_-24px_rgba(63,54,46,0.35)]"
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id="delete-post-dialog-title"
          className="m-0 font-display text-[20px] font-semibold text-[#3F362E]"
        >
          ¿Eliminar publicación?
        </h2>
        <p
          id="delete-post-dialog-description"
          className="mt-2 text-[14px] leading-[1.5] text-[#6E6359]"
        >
          Esta acción eliminará la publicación y sus fotografías. No se puede
          deshacer.
        </p>
        {error ? (
          <p className="mt-3 text-[13px] font-bold text-[#D9583C]" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="cursor-pointer rounded-[10px] border border-[#EADFD0] bg-[#FFFDF9] px-4 py-2 text-[14px] font-bold text-[#6E6359] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={isDeleting}
            className="cursor-pointer rounded-[10px] border-none bg-[#D9583C] px-4 py-2 text-[14px] font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDeleting ? "Eliminando…" : "Eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
}
