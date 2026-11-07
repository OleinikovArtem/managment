"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function DashboardError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error("Dashboard route failed to render.", error);
  }, [error]);

  return (
    <section className="max-w-xl py-8" role="alert">
      <h1 className="text-xl font-semibold">Не удалось загрузить страницу</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Повторите попытку. Если ошибка сохраняется, проверьте доступ к локальной базе данных.
      </p>
      <Button className="mt-5" onClick={retry}>
        Повторить
      </Button>
    </section>
  );
}
