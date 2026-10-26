/** Shown instantly while the next page loads on the server. */
export default function Loading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="mb-3 h-3 w-24 rounded bg-line" />
      <div className="mb-4 h-10 w-72 max-w-full rounded bg-line" />
      <div className="mb-10 h-4 w-96 max-w-full rounded bg-line/70" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-square rounded-lg bg-line/60" />)}
      </div>
    </div>
  );
}
