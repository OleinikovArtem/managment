import { Suspense } from "react";
import { io } from "next/cache";
import { redirect } from "next/navigation";
import { CreatePartyForm } from "@/features/auth/party-forms";
import { requireSignedInPageUser } from "@/server/auth/party-access";
import { listUserParties } from "@/server/services/account-party-service";

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="text-sm text-muted-foreground">
          Загрузка аккаунта…
        </p>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}

async function OnboardingContent() {
  await io();
  const user = await requireSignedInPageUser();
  const parties = await listUserParties(user.id);
  if (parties.length > 0) redirect("/parties");

  return (
    <section className="w-full max-w-2xl">
      <p className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
        Первый шаг
      </p>
      <h1 className="text-2xl font-semibold tracking-tight">Создайте свою группу</h1>
      <p className="mt-2 mb-7 max-w-xl text-sm leading-6 text-muted-foreground">
        Вы станете владельцем. Позже сможете пригласить администраторов и участников по ссылке.
      </p>
      <CreatePartyForm />
    </section>
  );
}
