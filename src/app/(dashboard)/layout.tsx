import type { ReactNode } from "react";
import { Suspense } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { requirePartyPageAccess } from "@/server/auth/party-access";

export const instant = false;

export default function DashboardLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <Suspense fallback={<div className="min-h-screen bg-background" role="status" aria-label="Загрузка группы" />}><DashboardShell>{children}</DashboardShell></Suspense>;
}

async function DashboardShell({ children }: Readonly<{ children: ReactNode }>) {
  const access = await requirePartyPageAccess();
  return (
    <div className="min-h-screen lg:flex">
      <Sidebar displayName={access.displayName} partyName={access.partyName} />
      <div className="min-w-0 flex-1">
        <a href="#main-content" className="skip-link">К содержимому</a>
        <main id="main-content" className="app-content">
          {children}
        </main>
      </div>
    </div>
  );
}
