"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard route failed to render.", error);
  }, [error]);

  return (
    <section className="mx-auto max-w-xl rounded-2xl border border-destructive/30 bg-card p-7">
      <p className="text-sm font-medium text-destructive">Не удалось загрузить страницу</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Проверьте локальную базу данных и повторите попытку. Данные не сбрасывались.
      </p>
      <Button className="mt-5" onClick={reset}>
        Повторить
      </Button>
    </section>
  );
}
