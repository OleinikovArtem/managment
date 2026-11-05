import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";

export default function DashboardLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <div className="min-h-screen md:flex">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <header className="flex h-12 items-center justify-between border-b border-border/60 px-4 md:px-8">
          <p className="text-xs text-muted-foreground">Lineage 2 · локальная группа</p>
          <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <span className="size-2 rounded-full bg-emerald-400" />
            Локально
          </span>
        </header>
        <main className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 md:px-8 md:py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
