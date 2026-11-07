export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-6" role="status">
      <span className="sr-only">Загрузка страницы…</span>
      <div className="h-8 w-56 rounded bg-muted" />
      <div className="h-4 w-80 max-w-full rounded bg-muted" />
      <div className="divide-y divide-border border-t border-border" aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="flex h-20 items-center justify-between gap-8">
            <div className="h-4 w-1/3 rounded bg-muted" />
            <div className="h-4 w-16 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
