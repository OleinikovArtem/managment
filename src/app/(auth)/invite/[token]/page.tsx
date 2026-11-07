import { Suspense } from "react";
import { io } from "next/cache";
import { headers } from "next/headers";
import Link from "next/link";
import { AcceptInvitationButton } from "@/features/auth/party-forms";
import { auth } from "@/lib/auth";
import { getInvitationPreview } from "@/server/services/account-party-service";

export default function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <Suspense
      fallback={
        <p role="status" className="text-sm text-muted-foreground">
          Проверяем приглашение…
        </p>
      }
    >
      <InvitationRoute params={params} />
    </Suspense>
  );
}

async function InvitationRoute({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <InvitationContent token={token} />;
}

async function InvitationContent({ token }: { token: string }) {
  await io();
  const [preview, session] = await Promise.all([
    getInvitationPreview(token),
    auth.api.getSession({ headers: await headers() }),
  ]);
  if (!preview)
    return (
      <section className="w-full max-w-lg">
        <h1 className="text-2xl font-semibold">Приглашение недействительно</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Ссылка могла истечь, быть отозвана или уже использована.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Ко входу
        </Link>
      </section>
    );

  const returnTo = `/invite/${token}`;
  if (!session)
    return (
      <section className="w-full max-w-lg">
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Приглашение в группу
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{preview.partyName}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Войдите или создайте аккаунт, чтобы присоединиться как{" "}
          {preview.role === "ADMIN" ? "администратор" : "участник"}.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/login?returnTo=${encodeURIComponent(returnTo)}`}
            className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Войти
          </Link>
          <Link
            href={`/register?returnTo=${encodeURIComponent(returnTo)}`}
            className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted"
          >
            Создать аккаунт
          </Link>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Ссылка истекает {preview.expiresAt.toLocaleDateString("ru-RU")}.
        </p>
      </section>
    );

  return (
    <section className="w-full max-w-lg">
      <p className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
        Приглашение в группу
      </p>
      <h1 className="text-2xl font-semibold tracking-tight">{preview.partyName}</h1>
      <p className="mt-3 mb-6 text-sm leading-6 text-muted-foreground">
        Аккаунт {session.user.name} получит роль{" "}
        {preview.role === "ADMIN"
          ? "администратора с правом управления"
          : "участника с доступом только для просмотра"}
        .
      </p>
      <AcceptInvitationButton token={token} />
    </section>
  );
}
