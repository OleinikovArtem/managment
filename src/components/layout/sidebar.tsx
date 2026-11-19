"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";
import {
  Menu,
  Landmark,
  LayoutDashboard,
  Swords,
  UsersRound,
  WalletCards,
  BookOpen,
  Settings2,
  PackageOpen,
} from "lucide-react";
import { SidePanel } from "@/components/ui/side-panel";
import {
  SidebarProvider,
  Sidebar as SidebarFrame,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SignOutButton } from "@/features/auth/party-forms";

const mainLinks = [
  { href: "/dashboard", label: "Обзор", icon: LayoutDashboard, routes: ["/dashboard"] },
  { href: "/raids", label: "Походы", icon: Swords, routes: ["/raids", "/calendar"] },
  { href: "/sales", label: "Финансы", icon: WalletCards, routes: ["/sales", "/ledger"] },
  { href: "/members", label: "Группа", icon: UsersRound, routes: ["/members", "/compositions"] },
];
const secondaryLinks = [
  { href: "/loot", label: "Лут", icon: PackageOpen, routes: ["/loot"] },
  { href: "/items", label: "Каталог предметов", icon: BookOpen, routes: ["/items"] },
  { href: "/settings", label: "Настройки", icon: Settings2, routes: ["/settings"] },
];

type SidebarProps = { displayName: string; partyName: string; loading?: boolean };

export function Sidebar({ displayName, partyName }: SidebarProps) {
  return (
    <Suspense fallback={<SidebarLoading />}>
      <Navigation displayName={displayName} partyName={partyName} />
    </Suspense>
  );
}

export function SidebarLoading() {
  return (
    <Suspense fallback={<div className="h-24 lg:h-screen lg:w-52" aria-hidden="true" />}>
      <Navigation displayName="" partyName="" loading />
    </Suspense>
  );
}

function Navigation({ displayName, partyName, loading = false }: SidebarProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  function links(items: typeof mainLinks, mobile = false) {
    if (mobile)
      return items.map(({ href, label, icon: Icon, routes }) => (
        <Button
          key={href}
          variant="ghost"
          nativeButton={false}
          role="link"
          render={<Link href={href} />}
          aria-current={
            routes.some((route) => pathname === route || pathname.startsWith(route + "/"))
              ? "page"
              : undefined
          }
          onClick={() => setMenuOpen(false)}
          className="mobile-nav-link"
        >
          <Icon size={17} aria-hidden="true" />
          <span>{label}</span>
        </Button>
      ));
    return (
      <SidebarMenu>
        {items.map(({ href, label, icon: Icon, routes }) => {
          const active = routes.some(
            (route) => pathname === route || pathname.startsWith(route + "/"),
          );
          return (
            <SidebarMenuItem key={href}>
              <SidebarMenuButton
                render={<Link href={href} />}
                isActive={active}
                aria-current={active ? "page" : undefined}
                onClick={() => setMenuOpen(false)}
                className="min-h-11 gap-3 px-3 text-sm"
              >
                <Icon size={17} aria-hidden="true" />
                <span>{label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    );
  }
  const brand = (
    <Link
      href="/dashboard"
      className="flex min-h-11 items-center gap-3"
      onClick={() => setMenuOpen(false)}
    >
      <Landmark size={24} strokeWidth={1.5} className="text-[#e6be67]" aria-hidden="true" />
      <span>
        <span className="block text-sm font-semibold tracking-tight">Party Bank</span>
        <span className="block text-xs text-muted-foreground">Казна группы</span>
      </span>
    </Link>
  );

  return (
    <SidebarProvider keyboardShortcut={false} style={{ display: "contents" }}>
      <aside className="app-sidebar">
        <SidebarFrame collapsible="none" className="min-h-0 w-full flex-1 bg-transparent">
          <div className="mb-6 shrink-0">{brand}</div>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto">
            <nav aria-label="Основная навигация">{links(mainLinks)}</nav>
            <nav aria-label="Справочник и настройки">{links(secondaryLinks)}</nav>
          </div>
          <SidebarAccount displayName={displayName} partyName={partyName} loading={loading} />
        </SidebarFrame>
      </aside>
      <header className="mobile-shell">
        <div className="flex items-center justify-between px-4 py-2">
          {brand}
          <Button
            variant="ghost"
            type="button"
            disabled={loading}
            className="inline-flex min-h-11 items-center gap-2 px-2 text-sm"
            onClick={() => setMenuOpen(true)}
          >
            <Menu size={18} aria-hidden="true" />
            Меню
          </Button>
        </div>
        <nav aria-label="Основная навигация" className="grid grid-cols-4 border-t border-border">
          {links(mainLinks, true)}
        </nav>
      </header>
      <SidePanel open={menuOpen} onOpenChange={setMenuOpen} title="Навигация">
        <nav aria-label="Все разделы" className="min-h-0 flex-1 space-y-1 overflow-y-auto">
          {links(mainLinks)}
          <Link
            href="/compositions"
            onClick={() => setMenuOpen(false)}
            className="sidebar-link pl-10"
          >
            Составы
          </Link>
          <Link href="/ledger" onClick={() => setMenuOpen(false)} className="sidebar-link pl-10">
            Операции
          </Link>
          <div className="pt-4">{links(secondaryLinks)}</div>
        </nav>
        <SidebarAccount
          displayName={displayName}
          partyName={partyName}
          loading={loading}
          onNavigate={() => setMenuOpen(false)}
        />
      </SidePanel>
    </SidebarProvider>
  );
}

function SidebarAccount({
  displayName,
  partyName,
  loading,
  onNavigate,
}: SidebarProps & { onNavigate?: () => void }) {
  if (loading) {
    return (
      <div className="mt-4 min-h-[202px] shrink-0 border-t border-border pt-3">
        <span className="sr-only">Загрузка профиля и группы</span>
        <Skeleton className="mx-3 h-3 w-28" />
        <Skeleton className="mx-3 mt-2 h-3 w-20" />
      </div>
    );
  }
  return (
    <div className="shrink-0 border-t border-border pt-3">
      <p className="truncate px-3 text-sm font-medium">{partyName}</p>
      <p className="mt-1 truncate px-3 text-xs text-muted-foreground">{displayName}</p>
      <div className="mt-2 flex flex-col gap-1">
        <Link href="/profile" onClick={onNavigate} className="sidebar-link">
          Мой профиль
        </Link>
        <Link href="/parties" onClick={onNavigate} className="sidebar-link">
          Сменить группу
        </Link>
        <SignOutButton className="min-h-11 justify-start px-3 text-sm text-muted-foreground" />
      </div>
    </div>
  );
}
