"use client";
import { Button } from "@/components/ui/button";
export default function CalendarErrorPage({ reset }: { reset: () => void }) {
  return (
    <div role="alert" className="space-y-4">
      <h2 className="text-lg font-semibold">Не удалось загрузить календарь</h2>
      <p>Проверьте соединение и повторите загрузку.</p>
      <Button onClick={reset}>Повторить</Button>
    </div>
  );
}
