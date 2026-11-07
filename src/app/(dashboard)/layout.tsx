import type { ReactNode } from "react";
import { Suspense } from "react";
import { Sidebar, SidebarLoading } from "@/components/layout/sidebar";
import { requirePartyPageAccess } from "@/server/auth/party-access";
import { TelegramNotifications } from "@/features/telegram/notifications";

export const instant = false;

export default function DashboardLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="min-h-screen lg:flex">
      <Suspense fallback={<SidebarLoading />}>
        <DashboardSidebar />
      </Suspense>
      <div className="min-w-0 flex-1">
        <a href="#main-content" className="skip-link">
          К содержимому
        </a>
        <main id="main-content" className="app-content">
          <Suspense fallback={<div className="mb-4 h-11" aria-hidden="true" />}>
            <DashboardNotifications />
          </Suspense>
          {children}
        </main>
      </div>
    </div>
  );
}

async function DashboardSidebar() {
  const access = await requirePartyPageAccess();
  return <Sidebar displayName={access.displayName} partyName={access.partyName} />;
}

async function DashboardNotifications() {
  const access = await requirePartyPageAccess();
  return <TelegramNotifications key={access.partyId} partyId={access.partyId} />;
}
