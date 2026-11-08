import { Skeleton } from "@/components/ui/skeleton";

function Block({ className = "" }: { className?: string }) {
  return <Skeleton aria-hidden="true" className={`rounded-md bg-muted/70 ${className}`} />;
}

export function CalendarSkeleton() {
  return (
    <div role="status" aria-label="Загружается календарь" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Block className="size-11" />
          <Block className="h-6 w-36" />
          <Block className="size-11" />
          <Block className="h-10 w-24" />
        </div>
        <div className="flex gap-2">
          <Block className="h-11 w-36" />
          <Block className="h-11 w-36" />
          <Block className="size-11" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <Block className="h-[68px]" />
        <Block className="h-[68px]" />
        <Block className="h-11 w-32 self-end" />
      </div>

      <div className="flex justify-between">
        <div className="flex gap-4">
          <Block className="h-4 w-40" />
          <Block className="h-4 w-28" />
        </div>
        <Block className="h-4 w-24" />
      </div>

      <div className="-mx-3 overflow-hidden rounded-lg border border-border sm:mx-0">
        <div className="grid grid-cols-7 border-b border-border bg-muted/30">
          {Array.from({ length: 7 }, (_, index) => (
            <div key={index} className="flex justify-center py-3">
              <Block className="h-3 w-6" />
            </div>
          ))}
        </div>
        {Array.from({ length: 6 }, (_, week) => (
          <div key={week} className="grid grid-cols-7">
            {Array.from({ length: 7 }, (_, day) => (
              <div
                key={day}
                className="min-h-24 min-w-0 space-y-2 border-b border-r border-border p-1.5 last:border-r-0 sm:min-h-36 sm:p-2"
              >
                <Block className="mb-2 size-7 rounded-full" />
                <Block className="h-4 w-full" />
                <Block className="h-4 w-4/5" />
                {week % 2 === 0 && <Block className="hidden h-4 w-3/5 sm:block" />}
              </div>
            ))}
          </div>
        ))}
      </div>
      <span className="sr-only">Загрузка календаря…</span>
    </div>
  );
}
