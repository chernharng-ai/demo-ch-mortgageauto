export default function Loading() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-2 h-4 w-32 animate-pulse rounded bg-neutral-100" />
      <div className="mb-6 h-7 w-56 animate-pulse rounded bg-neutral-200" />
      <div className="overflow-hidden rounded-lg border border-neutral-200">
        {Array.from({ length: 15 }).map((_, i) => (
          <div key={i} className="flex gap-4 border-b border-neutral-100 p-3.5 last:border-0">
            <div className="h-4 w-1/4 animate-pulse rounded bg-neutral-200" />
            <div className="h-4 w-1/3 animate-pulse rounded bg-neutral-100" />
            <div className="h-4 w-16 animate-pulse rounded bg-neutral-100" />
          </div>
        ))}
      </div>
    </main>
  );
}
