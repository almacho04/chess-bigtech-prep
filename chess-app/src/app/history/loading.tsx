import { SiteHeader } from "@/components/site/header";

export default function HistoryLoading() {
  return (
    <main className="flex flex-1 flex-col">
      <SiteHeader rightContent={<span>Game history</span>} />
      <section className="mx-auto w-full max-w-4xl px-4 py-6 md:px-6">
        <div className="mb-4 flex items-baseline justify-between gap-2">
          <div className="h-6 w-32 animate-pulse rounded bg-foreground/[0.07]" />
          <div className="h-4 w-16 animate-pulse rounded bg-foreground/5" />
        </div>
        <ul className="overflow-hidden rounded-md border border-foreground/10">
          {Array.from({ length: 5 }).map((_, i) => (
            <li
              key={i}
              className="border-b border-foreground/5 px-4 py-3 last:border-b-0"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-foreground/[0.07]" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-foreground/5" />
                </div>
                <div className="hidden gap-2 md:flex">
                  <div className="h-5 w-12 animate-pulse rounded-md bg-foreground/[0.07]" />
                  <div className="h-5 w-16 animate-pulse rounded-md bg-foreground/[0.07]" />
                  <div className="h-5 w-12 animate-pulse rounded-md bg-foreground/[0.07]" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
