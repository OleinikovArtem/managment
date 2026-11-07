export default function DashboardLoading() {
  return (
    <div className="page-skeleton space-y-6" role="status" aria-label="Загружается страница">
      <span className="sr-only">Загрузка страницы…</span>
      <div className="h-8 w-52 animate-pulse rounded-md bg-muted/70" />
      <div className="h-4 w-80 max-w-full animate-pulse rounded-md bg-muted/70" />
      <div className="flex flex-wrap gap-3 border-b border-border pb-4" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <div key={index} className="h-9 w-24 animate-pulse rounded-md bg-muted/70" />
        ))}
      </div>
      <div className="divide-y divide-border border-t border-border" aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="flex h-[72px] items-center justify-between gap-8">
            <div className="w-1/3 space-y-2">
              <div className="h-4 animate-pulse rounded-md bg-muted/70" />
              <div className="h-3 w-2/3 animate-pulse rounded-md bg-muted/70" />
            </div>
            <div className="h-5 w-24 animate-pulse rounded-md bg-muted/70" />
          </div>
        ))}
      </div>
    </div>
  );
}
