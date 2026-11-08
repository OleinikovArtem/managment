import { Skeleton } from "@/components/ui/skeleton";
export function CalendarSkeleton() {
  return (
    <div role="status" aria-label="Загружается календарь" className="space-y-6">
      <Skeleton className="h-12 w-full" />
      <div className="grid grid-cols-7 gap-px rounded-lg border border-border bg-border">
        {Array.from({ length: 35 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-none sm:h-36" />
        ))}
      </div>
      <span className="sr-only">Загрузка календаря…</span>
    </div>
  );
}
