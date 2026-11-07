import type { ReactNode } from "react";
import Link from "next/link";
import { Landmark } from "lucide-react";

export default function AuthLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <main className="flex min-h-screen w-full min-w-0 flex-col overflow-x-hidden bg-background px-5 py-7 sm:px-8 sm:py-10">
      <Link
        href="/"
        className="mx-auto flex w-full max-w-5xl items-center gap-2.5 text-sm font-medium text-foreground"
      >
        <Landmark aria-hidden="true" className="text-chart-1" size={21} strokeWidth={1.6} />
        Party Bank
      </Link>
      <div className="flex w-full min-w-0 flex-1 items-center justify-center py-14">{children}</div>
      <p className="text-center text-xs text-muted-foreground">
        Учет рейдов, добычи и казны группы
      </p>
    </main>
  );
}
