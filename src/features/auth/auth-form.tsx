"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import {
  isValidNewPassword,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_RULE_MESSAGE,
} from "@/lib/password-policy";

type AuthMode = "login" | "register";

type AuthFormProps = { mode: AuthMode; returnTo?: string };

const headings: Record<AuthMode, { title: string; description: string }> = {
  login: { title: "Вход в группу", description: "Введите логин и пароль, чтобы продолжить." },
  register: { title: "Создать аккаунт", description: "Задайте логин и пароль. Email не нужен." },
};

function safeReturnTo(value?: string) {
  return value && /^\/invite\/[A-Za-z0-9_-]+$/.test(value) ? value : "/onboarding";
}

export function AuthForm({ mode, returnTo }: AuthFormProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const redirectTo = safeReturnTo(returnTo);
  const heading = headings[mode];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const username = String(form.get("username") ?? "")
      .trim()
      .toLocaleLowerCase("en-US");
    const password = String(form.get("password") ?? "");
    if (mode === "register" && !isValidNewPassword(password)) {
      setError(PASSWORD_RULE_MESSAGE);
      setPending(false);
      return;
    }
    try {
      if (mode === "register") {
        const result = await authClient.signUp.email({
          name: username,
          username,
          email: `${username}@users.partybank.invalid`,
          password,
          callbackURL: redirectTo,
        });
        if (result.error) throw new Error(result.error.message);
        router.replace(redirectTo);
        router.refresh();
      } else if (mode === "login") {
        const result = await authClient.signIn.username({
          username,
          password,
          callbackURL: redirectTo,
        });
        if (result.error) throw new Error(result.error.message);
        router.replace(redirectTo);
        router.refresh();
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Не удалось выполнить запрос. Попробуйте ещё раз.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="min-w-0" style={{ width: "min(26rem, calc(100vw - 2.5rem))" }}>
      <div className="mb-8 border-b border-border pb-5">
        <h1 className="text-2xl font-semibold tracking-tight">{heading.title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{heading.description}</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block space-y-1.5 text-sm font-medium">
          <span>Логин</span>
          <Input
            name="username"
            autoComplete="username"
            minLength={3}
            maxLength={30}
            pattern="[A-Za-z0-9_.]+"
            required
            disabled={pending}
          />
          <span className="block text-xs font-normal text-muted-foreground">
            Латинские буквы, цифры, точка и подчёркивание.
          </span>
        </label>
        {(mode === "login" || mode === "register") && (
          <label className="block space-y-1.5 text-sm font-medium">
            <span>Пароль</span>
            <Input
              name="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={mode === "register" ? PASSWORD_MIN_LENGTH : 1}
              maxLength={PASSWORD_MAX_LENGTH}
              required
              disabled={pending}
            />
            {mode === "register" && (
              <span className="block text-xs font-normal text-muted-foreground">
                От 8 символов, хотя бы одна буква и одна цифра.
              </span>
            )}
          </label>
        )}
        {mode === "login" && (
          <p className="text-xs leading-5 text-muted-foreground">
            Вход по логину и паролю. Сброс пароля без email пока недоступен.
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Подождите…" : mode === "login" ? "Войти" : "Создать аккаунт"}
        </Button>
      </form>
      {mode === "login" || mode === "register" ? (
        <p className="mt-6 border-t border-border pt-5 text-sm text-muted-foreground">
          {mode === "login" ? "Ещё нет аккаунта? " : "Уже зарегистрированы? "}
          <Link
            href={
              mode === "login"
                ? `/register${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`
                : `/login${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`
            }
            className="font-medium text-foreground underline underline-offset-4"
          >
            {mode === "login" ? "Создать" : "Войти"}
          </Link>
        </p>
      ) : null}
    </section>
  );
}
