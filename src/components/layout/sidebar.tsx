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
  CalendarDays,
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
  { href: "/raids", label: "Рейды", icon: Swords, routes: ["/raids"] },
  { href: "/sales", label: "Финансы", icon: WalletCards, routes: ["/sales", "/ledger"] },
  { href: "/members", label: "Группа", icon: UsersRound, routes: ["/members", "/compositions"] },
];
const secondaryLinks = [
  { href: "/calendar", label: "Календарь", icon: CalendarDays, routes: ["/calendar"] },
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
                className="min-h-11 text-sm"
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
        <SidebarFrame collapsible="none" className="w-full bg-transparent">
          <div className="mb-9">{brand}</div>
          <nav aria-label="Основная навигация" className="space-y-1">
            {links(mainLinks)}
          </nav>
          <nav aria-label="Справочник и настройки" className="mt-8 space-y-1">
            {links(secondaryLinks)}
          </nav>
          <SidebarAccount displayName={displayName} partyName={partyName} loading={loading} />
        </SidebarFrame>
      </aside>
      <header className="mobile-shell">
        <div className="flex items-center justify-between px-4 py-2">
          {brand}
          <Button
            variant="ghost"
            type="button"
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
        <nav aria-label="Все разделы" className="space-y-1">
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
          <SidebarAccount
            displayName={displayName}
            partyName={partyName}
            loading={loading}
            mobile
            onNavigate={() => setMenuOpen(false)}
          />
        </nav>
      </SidePanel>
    </SidebarProvider>
  );
}

function SidebarAccount({
  displayName,
  partyName,
  loading,
  mobile = false,
  onNavigate,
}: SidebarProps & { mobile?: boolean; onNavigate?: () => void }) {
  const accountClass = mobile ? "sidebar-link" : "text-xs text-muted-foreground";
  if (loading) {
    return (
      <div
        className={`${mobile ? "mt-4 min-h-[88px] border-t pt-3" : "mt-auto min-h-[76px] border-t pt-4"} border-border`}
      >
        <span className="sr-only">Загрузка профиля и группы</span>
        <Skeleton className={`h-3 w-28 ${mobile ? "mx-3" : ""}`} />
        <Skeleton className={`mt-2 h-3 w-20 ${mobile ? "mx-3" : ""}`} />
      </div>
    );
  }
  return (
    <div className={`${mobile ? "mt-4 border-t pt-3" : "mt-auto border-t pt-4"} border-border`}>
      <p className={`truncate font-medium ${mobile ? "px-3 text-xs" : "text-xs"}`}>{partyName}</p>
      <p className={`mt-1 truncate text-muted-foreground ${mobile ? "px-3 text-xs" : "text-xs"}`}>
        {displayName}
      </p>
      <div className={`${mobile ? "mt-2 space-y-1" : "mt-2 flex items-center gap-2"}`}>
        <Link href="/profile" onClick={onNavigate} className={accountClass}>
          Мой профиль
        </Link>
        {mobile && <span className="sr-only"> · </span>}
        <Link href="/parties" onClick={onNavigate} className={accountClass}>
          Сменить группу
        </Link>
        <SignOutButton />
      </div>
    </div>
  );
}
