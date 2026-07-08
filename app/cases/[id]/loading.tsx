export default function Loading() {
  return (
    <main className="min-h-screen p-6 sm:p-10 max-w-5xl mx-auto flex items-center justify-center">
      <div className="flex items-center gap-3 text-neutral-500 text-sm">
        <span className="h-4 w-4 rounded-full border-2 border-neutral-300 border-t-neutral-900 animate-spin" />
        Loading…
      </div>
    </main>
  );
}
