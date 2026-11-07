import { Suspense } from "react";
import { io } from "next/cache";
import { redirect } from "next/navigation";
import { requirePartyPageAccess } from "@/server/auth/party-access";

export default function TelegramSettingsPage() {
  return (
    <Suspense fallback={null}>
      <TelegramSettingsRedirect />
    </Suspense>
  );
}

async function TelegramSettingsRedirect() {
  await io();
  const access = await requirePartyPageAccess();
  if (!access.isOwner) redirect("/settings");
  redirect("/settings?tab=telegram");
  return null;
}
