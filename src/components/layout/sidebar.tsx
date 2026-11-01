"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import {
  LayoutDashboard,
  ScrollText,
  Settings2,
  UsersRound,
  WalletCards,
} from "lucide-react";

const navigation = [
  { href: "/dashboard", label: "Обзор", icon: LayoutDashboard },
  { href: "/members", label: "Участники", icon: UsersRound },
  { href: "/items", label: "Предметы", icon: ScrollText },
  { href: "/settings", label: "Настройки", icon: Settings2 },
];

export function Sidebar() {
  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-sidebar-border bg-sidebar px-4 py-4 md:min-h-screen md:w-64 md:border-r md:border-b-0 md:px-5 md:py-7">
      <Link href="/dashboard" className="mb-5 flex items-center gap-3 md:mb-10">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <WalletCards aria-hidden="true" size={21} />
        </span>
        <span>
          <span className="block text-sm font-semibold tracking-tight text-sidebar-foreground">
            Party Bank
          </span>
          <span className="block text-xs text-muted-foreground">Менеджер группы</span>
        </span>
      </Link>

      <Suspense fallback={<NavigationFallback />}>
        <SidebarNavigation />
      </Suspense>

      <div className="mt-auto hidden rounded-xl border border-sidebar-border bg-background/40 p-4 md:block">
        <p className="text-xs font-medium text-sidebar-foreground">Локальный режим</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Данные хранятся на этом компьютере.
        </p>
      </div>
    </aside>
  );
}

function SidebarNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Основная навигация" className="flex gap-2 md:flex-col">
        {navigation.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors ${
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
              }`}
            >
              <Icon aria-hidden="true" size={17} />
              {label}
            </Link>
          );
        })}
    </nav>
  );
}

function NavigationFallback() {
  return (
    <nav aria-label="Основная навигация" className="flex gap-2 md:flex-col">
      {navigation.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className="flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground"
        >
          <Icon aria-hidden="true" size={17} />
          {label}
        </Link>
      ))}
    </nav>
  );
}
