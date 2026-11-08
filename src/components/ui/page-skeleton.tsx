import { Skeleton } from "@/components/ui/skeleton";
function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <Skeleton
      className={`rounded-md bg-muted/70 motion-reduce:animate-none ${className}`}
      aria-hidden="true"
    />
  );
}

export function RaidListSkeleton() {
  return (
    <div className="page-skeleton" role="status" aria-label="Загружаются рейды">
      <div className="toolbar">
        <SkeletonBlock className="h-11 w-full max-w-md" />
        <SkeletonBlock className="h-4 w-24" />
      </div>
      {[0, 1, 2].map((group) => (
        <section key={group} className="mt-7 space-y-3">
          <SkeletonBlock className="h-5 w-32" />
          <div className="divide-y divide-border border-t border-border">
            {[0, 1].map((row) => (
              <div key={row} className="flex h-[68px] items-center justify-between gap-6">
                <div className="min-w-0 flex-1 space-y-2">
                  <SkeletonBlock className="h-4 w-2/5" />
                  <SkeletonBlock className="h-3 w-1/3" />
                </div>
                <SkeletonBlock className="h-4 w-28" />
              </div>
            ))}
          </div>
        </section>
      ))}
      <span className="sr-only">Загрузка списка рейдов…</span>
    </div>
  );
}

export function PayoutsSkeleton() {
  return (
    <div className="page-skeleton space-y-7" role="status" aria-label="Загружаются выплаты">
      <div className="finance-summary-skeleton">
        {[0, 1, 2, 3, 4].map((index) => (
          <div key={index} className="space-y-3">
            <SkeletonBlock className="h-3 w-20" />
            <SkeletonBlock className="h-6 w-28 max-w-full" />
          </div>
        ))}
      </div>
      <div className="toolbar">
        <SkeletonBlock className="h-11 w-full max-w-md" />
        <SkeletonBlock className="h-10 w-64 max-w-full" />
      </div>
      <div className="divide-y divide-border border-t border-border">
        {[0, 1, 2, 3, 4].map((index) => (
          <div key={index} className="flex h-[72px] items-center justify-between gap-5">
            <div className="space-y-2">
              <SkeletonBlock className="h-4 w-36" />
              <SkeletonBlock className="h-3 w-24" />
            </div>
            <SkeletonBlock className="h-5 w-28" />
          </div>
        ))}
      </div>
      <span className="sr-only">Загрузка выплат…</span>
    </div>
  );
}

export function LedgerSkeleton() {
  return (
    <div className="page-skeleton space-y-5" role="status" aria-label="Загружаются операции">
      <div className="toolbar">
        <SkeletonBlock className="h-11 w-full max-w-md" />
        <SkeletonBlock className="h-10 w-64 max-w-full" />
      </div>
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <div key={index} className="border-b border-border py-4">
          <div className="flex items-center justify-between gap-5">
            <div className="space-y-2">
              <SkeletonBlock className="h-4 w-48 max-w-full" />
              <SkeletonBlock className="h-3 w-36 max-w-full" />
            </div>
            <SkeletonBlock className="h-5 w-28" />
          </div>
        </div>
      ))}
      <span className="sr-only">Загрузка журнала операций…</span>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="page-skeleton space-y-7" role="status" aria-label="Загружается обзор группы">
      <div className="grid gap-5 border-y border-border py-5 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="space-y-3">
            <SkeletonBlock className="h-3 w-24" />
            <SkeletonBlock className="h-6 w-32 max-w-full" />
          </div>
        ))}
      </div>
      <div className="grid gap-7 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
        <section className="space-y-4">
          <SkeletonBlock className="h-5 w-40" />
          <SkeletonBlock className="h-64 w-full" />
        </section>
        <section className="space-y-4">
          <SkeletonBlock className="h-5 w-36" />
          <div className="divide-y divide-border border-t border-border">
            {[0, 1, 2, 3, 4].map((index) => (
              <div key={index} className="flex h-14 items-center justify-between gap-4">
                <SkeletonBlock className="h-4 w-36 max-w-[65%]" />
                <SkeletonBlock className="h-4 w-16" />
              </div>
            ))}
          </div>
        </section>
      </div>
      <span className="sr-only">Загрузка аналитики…</span>
    </div>
  );
}

export function GridRowsSkeleton({ label, rows = 6 }: { label: string; rows?: number }) {
  return (
    <div className="page-skeleton" role="status" aria-label={label}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <SkeletonBlock className="h-11 w-full max-w-sm" />
        <SkeletonBlock className="h-10 w-36" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="space-y-3 border-b border-border p-4">
            <div className="flex items-center gap-3">
              <SkeletonBlock className="size-11 shrink-0" />
              <div className="min-w-0 flex-1 space-y-2">
                <SkeletonBlock className="h-4 w-2/3" />
                <SkeletonBlock className="h-3 w-1/2" />
              </div>
            </div>
            <SkeletonBlock className="h-3 w-full" />
            <SkeletonBlock className="h-9 w-28" />
          </div>
        ))}
      </div>
      <span className="sr-only">{label}…</span>
    </div>
  );
}

export function LootListSkeleton() {
  return (
    <div className="page-skeleton" role="status" aria-label="Загружается лут">
      <div className="mb-5 flex flex-wrap gap-3">
        <SkeletonBlock className="h-11 w-full max-w-sm" />
        <SkeletonBlock className="h-11 w-64 max-w-full" />
        <SkeletonBlock className="h-8 w-40" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <div key={index} className="space-y-4 border-b border-border p-4">
            <div className="flex gap-3">
              <SkeletonBlock className="size-12 shrink-0" />
              <div className="flex-1 space-y-2">
                <SkeletonBlock className="h-4 w-2/3" />
                <SkeletonBlock className="h-3 w-1/3" />
              </div>
            </div>
            <SkeletonBlock className="h-3 w-full" />
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map((cell) => (
                <div key={cell} className="space-y-2">
                  <SkeletonBlock className="h-3 w-12" />
                  <SkeletonBlock className="h-4 w-8" />
                </div>
              ))}
            </div>
            <SkeletonBlock className="h-9 w-32" />
          </div>
        ))}
      </div>
      <span className="sr-only">Загрузка списка добычи…</span>
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div
      className="page-skeleton max-w-5xl space-y-7"
      role="status"
      aria-label="Загружаются настройки"
    >
      {[0, 1].map((section) => (
        <section key={section} className="space-y-4 border-b border-border pb-7">
          <SkeletonBlock className="h-5 w-40" />
          <SkeletonBlock className="h-4 w-80 max-w-full" />
          <div className="grid gap-4 sm:grid-cols-2">
            <SkeletonBlock className="h-11 w-full" />
            <SkeletonBlock className="h-11 w-full" />
          </div>
        </section>
      ))}
      <span className="sr-only">Загрузка настроек…</span>
    </div>
  );
}

export function RowsOnlySkeleton({ label, rows = 6 }: { label: string; rows?: number }) {
  return (
    <div className="page-skeleton" role="status" aria-label={label}>
      <div className="divide-y divide-border border-t border-border">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex min-h-16 items-center justify-between gap-5 py-3">
            <div className="min-w-0 flex-1 space-y-2">
              <SkeletonBlock className="h-4 w-2/3 max-w-80" />
              <SkeletonBlock className="h-3 w-1/2 max-w-56" />
            </div>
            <SkeletonBlock className="h-4 w-24" />
          </div>
        ))}
      </div>
      <span className="sr-only">{label}…</span>
    </div>
  );
}
