"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateOwnDisplayNameAction } from "@/app/profile-actions";

export function UserDisplayNameForm({ displayName }: { displayName: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const name = String(new FormData(event.currentTarget).get("displayName") ?? "").trim();
    const result = await updateOwnDisplayNameAction(name);
    setPending(false);
    setMessage(result.message);
    if (!result.ok) return;
    router.refresh();
  }
  return <form onSubmit={submit} className="space-y-4"><label className="block space-y-1.5 text-sm font-medium"><span>Имя для отображения</span><Input name="displayName" autoComplete="nickname" minLength={2} maxLength={80} defaultValue={displayName} required disabled={pending} /></label>{message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}<Button type="submit" disabled={pending}>{pending ? "Сохраняем…" : "Сохранить имя"}</Button></form>;
}
