"use client";

import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
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

export function SettingsForm({ partyName, canManage }: { partyName: string; canManage: boolean }) {
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

  return <Card>
    <CardHeader><CardTitle>Группа</CardTitle><CardDescription>Название вашего рабочего пространства.</CardDescription></CardHeader>
    <CardContent><form className="max-w-xl space-y-4" onSubmit={onSubmit} noValidate>
      <label htmlFor="party-name" className="block text-sm font-medium">Название группы</label>
      <Input id="party-name" maxLength={80} readOnly={!canManage} aria-invalid={Boolean(form.formState.errors.name)} aria-describedby={form.formState.errors.name ? "party-name-error" : undefined} {...form.register("name")} />
      {form.formState.errors.name && <p id="party-name-error" className="text-sm text-destructive">{form.formState.errors.name.message}</p>}
      {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
      {canManage && <Button type="submit" disabled={isPending}><Save aria-hidden="true" />{isPending ? "Сохранение…" : "Сохранить"}</Button>}
      {!canManage && <p className="text-xs text-muted-foreground">Изменять настройки группы может администратор.</p>}
      <p className="text-xs leading-5 text-muted-foreground">Для локальной базы используйте резервную копию Docker. В продакшене резервирование настраивается у провайдера базы.</p>
    </form></CardContent>
  </Card>;
}
