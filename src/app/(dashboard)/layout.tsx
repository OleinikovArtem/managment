import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";

export default function DashboardLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <div className="min-h-screen lg:flex">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <a href="#main-content" className="skip-link">К содержимому</a>
        <main id="main-content" className="app-content">
          {children}
        </main>
      </div>
    </div>
  );
}
