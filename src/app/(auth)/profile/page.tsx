import { Suspense } from "react";
import { requireSignedInPageUser } from "@/server/auth/party-access";
import { UserDisplayNameForm } from "@/features/auth/user-display-name-form";

export default function ProfilePage() {
  return <Suspense fallback={<p role="status" className="text-sm text-muted-foreground">Загружаем профиль…</p>}><ProfileContent /></Suspense>;
}

async function ProfileContent() {
  const user = await requireSignedInPageUser();
  return <section className="w-full max-w-xl"><h1 className="text-2xl font-semibold tracking-tight">Ваш профиль</h1><p className="mt-2 mb-6 text-sm leading-6 text-muted-foreground">Укажите, как ваше имя будет отображаться участникам группы. Это не меняет логин.</p><UserDisplayNameForm displayName={user.name} /></section>;
}
