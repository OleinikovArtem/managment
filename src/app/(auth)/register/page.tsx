import { Suspense } from "react";
import { AuthForm } from "@/features/auth/auth-form";

export default function RegisterPage({ searchParams }: { searchParams: Promise<{ returnTo?: string | string[] }> }) {
  return <Suspense fallback={<p role="status" className="text-sm text-muted-foreground">Загружаем регистрацию…</p>}><RegisterContent searchParams={searchParams} /></Suspense>;
}

async function RegisterContent({ searchParams }: { searchParams: Promise<{ returnTo?: string | string[] }> }) {
  const params = await searchParams;
  return <AuthForm mode="register" returnTo={Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo} />;
}
