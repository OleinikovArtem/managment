"use client";

import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Database, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { PartyActionResult } from "@/features/settings/party-action-result";
import { updatePartySettingsAction } from "@/app/(dashboard)/settings/actions";
import { partySettingsSchema } from "@/features/settings/party-schema";

export function SettingsForm({ partyName }: { partyName: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const form = useForm<{ name: string }>({
    resolver: zodResolver(partySettingsSchema),
    defaultValues: { name: partyName },
  });

  function applyResult(result: PartyActionResult) {
    if (!result.ok) {
      setMessage(result.message);
      toast.error(result.message);
      const nameError = result.fieldErrors?.name?.[0];
      if (nameError) {
        form.setError("name", { message: nameError });
      }
      return;
    }
    setMessage(result.message);
    toast.success(result.message);
    router.refresh();
  }

  const onSubmit = form.handleSubmit((values) => {
    setMessage(null);
    startTransition(async () => {
      applyResult(await updatePartySettingsAction(values));
    });
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.7fr)]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Параметры группы</CardTitle>
          <CardDescription>Название отображается в локальном приложении.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit} noValidate>
            <div className="space-y-2">
              <label htmlFor="party-name" className="text-sm font-medium">
                Название группы
              </label>
              <Input
                id="party-name"
                maxLength={80}
                aria-invalid={Boolean(form.formState.errors.name)}
                {...form.register("name")}
              />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>
            {message && (
              <p role="status" className="text-sm text-muted-foreground">
                {message}
              </p>
            )}
            <Button type="submit" disabled={isPending}>
              <Save aria-hidden="true" />
              {isPending ? "Сохранение..." : "Сохранить"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader className="flex-row items-start gap-3">
          <span className="rounded-lg bg-primary/10 p-2 text-primary">
            <Database aria-hidden="true" size={18} />
          </span>
          <div className="space-y-1">
            <CardTitle>Локальное хранение</CardTitle>
            <CardDescription>База данных SQLite</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="text-sm leading-6 text-muted-foreground">
          Изменения сохраняются в локальной базе приложения. Обычный запуск не удаляет и не
          пересоздаёт базу данных.
        </CardContent>
      </Card>
    </div>
  );
}
