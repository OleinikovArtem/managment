export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-6" aria-label="Загрузка страницы">
      <div className="h-8 w-56 rounded bg-muted" />
      <div className="h-4 w-80 max-w-full rounded bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="h-36 rounded-xl border border-border bg-card" />
        ))}
      </div>
    </div>
  );
}
