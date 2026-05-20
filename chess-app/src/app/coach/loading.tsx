import { SiteHeader } from "@/components/site/header";

export default function CoachLoading() {
  return (
    <main className="flex flex-1 flex-col">
      <SiteHeader
        rightContent={
          <span>
            <span className="text-foreground/40">mode:</span> AI tutor
          </span>
        }
      />
      <section className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-8">
        <div className="mb-5 space-y-2">
          <div className="h-3 w-24 animate-pulse rounded bg-foreground/5" />
          <div className="h-7 w-72 animate-pulse rounded bg-foreground/[0.07]" />
          <div className="h-4 w-96 animate-pulse rounded bg-foreground/5" />
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-lg border border-foreground/10 bg-foreground/[0.03]"
            />
          ))}
        </div>
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="h-48 animate-pulse rounded-lg border border-foreground/10 bg-foreground/[0.03]" />
          <div className="h-48 animate-pulse rounded-lg border border-foreground/10 bg-foreground/[0.03]" />
        </div>
        <div className="mt-6 h-40 animate-pulse rounded-lg border border-foreground/10 bg-foreground/[0.03]" />
      </section>
    </main>
  );
}
