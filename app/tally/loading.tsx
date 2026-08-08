export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 h-7 w-48 animate-pulse rounded bg-neutral-200" />
      <div className="overflow-hidden rounded-lg border border-neutral-200">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4 border-b border-neutral-100 p-4 last:border-0">
            <div className="h-4 w-1/4 animate-pulse rounded bg-neutral-200" />
            <div className="h-4 w-1/5 animate-pulse rounded bg-neutral-100" />
            <div className="h-4 w-1/6 animate-pulse rounded bg-neutral-100" />
            <div className="h-4 w-12 animate-pulse rounded bg-neutral-100" />
          </div>
        ))}
      </div>
    </main>
  );
}
