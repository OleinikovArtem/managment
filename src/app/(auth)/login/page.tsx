import { Suspense } from "react";
import { AuthForm } from "@/features/auth/auth-form";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  return (
    <Suspense
      fallback={
        <p role="status" className="text-sm text-muted-foreground">
          Загружаем вход…
        </p>
      }
    >
      <LoginContent searchParams={searchParams} />
    </Suspense>
  );
}

async function LoginContent({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const params = await searchParams;
  return (
    <AuthForm
      mode="login"
      returnTo={Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo}
    />
  );
}
