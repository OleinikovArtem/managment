import { Suspense } from "react";
import { io } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CreatePartyForm, PartyPicker } from "@/features/auth/party-forms";
import { requireSignedInPageUser } from "@/server/auth/party-access";
import { listUserParties } from "@/server/services/account-party-service";

export default function PartiesPage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="text-sm text-muted-foreground">
          Загрузка групп…
        </p>
      }
    >
      <PartiesContent />
    </Suspense>
  );
}

async function PartiesContent() {
  await io();
  const user = await requireSignedInPageUser();
  const parties = await listUserParties(user.id);
  if (parties.length === 0) redirect("/onboarding");
  const activePartyId = (await cookies()).get("party-bank-active-party")?.value;

  return (
    <section className="w-full max-w-2xl">
      <p className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
        Аккаунт {user.name}
      </p>
      <h1 className="text-2xl font-semibold tracking-tight">Ваши группы</h1>
      <p className="mt-2 mb-6 text-sm text-muted-foreground">
        Выберите, с какими данными работать.
      </p>
      <PartyPicker
        parties={parties.map(({ party, role }) => ({ id: party.id, name: party.name, role }))}
        activePartyId={activePartyId}
      />
      <details className="mt-7 border-t border-border pt-5">
        <summary className="cursor-pointer text-sm font-medium">Создать ещё одну группу</summary>
        <div className="mt-4">
          <CreatePartyForm />
        </div>
      </details>
    </section>
  );
}
