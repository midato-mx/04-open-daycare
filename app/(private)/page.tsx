import FeedPostCard from "@/app/components/FeedPostCard";
import FeedComposer from "@/app/components/FeedComposer";
import PokemonViewer from "@/app/components/PokemonViewer";
import { getFeedPageData } from "@/app/feed/data";

export default async function Home() {
  const feed = await getFeedPageData();
  const firstName = feed.profile?.full_name.split(" ")[0] ?? "familia";

  return (
    <main className="h-screen min-w-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[760px] px-10 pt-[34px] pb-20">
        <header className="mb-6">
          <div className="mb-1 text-[12.5px] font-extrabold tracking-[0.8px] text-[#D9583C]">
            GUARDERÍA · SALA SOLES
          </div>
          <h1 className="m-0 font-display text-[30px] font-semibold text-[#3F362E]">
            Buenas, {firstName}
          </h1>
          <p className="mt-[5px] mb-0 text-[14.5px] text-[#94887B]">
            {feed.kidsCount} niños · {feed.dateLabel}
          </p>
        </header>

        {/* <PokemonViewer /> */}

        {feed.canCompose ? (
          <FeedComposer initial={feed.profile?.full_name.charAt(0) ?? "E"} />
        ) : null}

        <div className="mb-3.5 flex items-center gap-3.5">
          <span className="text-[12.5px] font-extrabold tracking-[0.8px] text-[#8A7C6D]">
            PUBLICADO HOY
          </span>
          <span className="h-px flex-1 bg-[#E7DAC8]" />
        </div>

        <div className="flex flex-col gap-4">
          {feed.error ? (
            <div className="rounded-[16px] border border-[#F0C9BE] bg-[#FFF4F0] px-5 py-4 text-[14px] text-[#B8432F]">
              {feed.error}
            </div>
          ) : feed.posts.length > 0 ? (
            feed.posts.map((post) => <FeedPostCard key={post.id} post={post} />)
          ) : (
            <div className="rounded-[16px] border border-dashed border-[#DBCDBA] bg-[#FFFDF9] px-5 py-8 text-center text-[14px] text-[#94887B]">
              Todavía no hay publicaciones para mostrar.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
