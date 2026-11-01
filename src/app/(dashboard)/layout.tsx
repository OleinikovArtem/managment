import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";

export default function DashboardLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <div className="min-h-screen md:flex">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <header className="flex h-16 items-center justify-between border-b border-border/70 px-5 md:px-9">
          <p className="text-sm text-muted-foreground">Lineage 2 · локальная группа</p>
          <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <span className="size-2 rounded-full bg-emerald-400" />
            Локально
          </span>
        </header>
        <main className="mx-auto w-full max-w-7xl px-5 py-8 md:px-9 md:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
