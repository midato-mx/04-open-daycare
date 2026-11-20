"use client";

function openCreatePost(focusFiles = false) {
  window.dispatchEvent(
    new CustomEvent("opendaycare:open-create-post", {
      detail: { focusFiles },
    }),
  );
}

export default function FeedComposer({
  initial,
}: Readonly<{
  initial: string;
}>) {
  return (
    <div className="mb-6 flex items-center gap-3.5 rounded-[18px] border border-[#ECE0D0] bg-[#FFFDF9] px-[18px] py-3.5 shadow-[0_4px_14px_-10px_rgba(120,90,60,0.4)]">
      <button
        type="button"
        onClick={() => openCreatePost()}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3.5 border-none bg-transparent p-0 text-left"
      >
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[#F2937A] font-display text-[16px] font-semibold text-white">
          {initial}
        </span>
        <span className="flex-1 text-[15px] text-[#A89A8B]">
          Comparte un momento…
        </span>
      </button>
      <button
        type="button"
        onClick={() => openCreatePost(true)}
        aria-label="Agregar fotos a una publicación"
        className="flex h-[38px] w-[38px] flex-none cursor-pointer items-center justify-center rounded-[12px] border-none bg-[#FBE3D8] text-[#E0654A]"
      >
        <svg
          width="19"
          height="19"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
      </button>
    </div>
  );
}
