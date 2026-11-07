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
import { EditorDialog } from "@/components/ui/editor-dialog";
import { SignOutButton } from "@/features/auth/party-forms";

const mainLinks = [
  { href: "/dashboard", label: "Обзор", icon: LayoutDashboard, routes: ["/dashboard"] },
  { href: "/raids", label: "Рейды", icon: Swords, routes: ["/raids"] },
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
    return items.map(({ href, label, icon: Icon, routes }) => {
      const active = routes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
      return (
        <Link
          href={href}
          key={href}
          aria-current={active ? "page" : undefined}
          onClick={() => setMenuOpen(false)}
          className={mobile ? "mobile-nav-link" : "sidebar-link"}
        >
          <Icon size={17} aria-hidden="true" />
          <span>{label}</span>
        </Link>
      );
    });
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
    <>
      <aside className="app-sidebar">
        <div className="mb-9">{brand}</div>
        <nav aria-label="Основная навигация" className="space-y-1">
          {links(mainLinks)}
        </nav>
        <nav aria-label="Справочник и настройки" className="mt-8 space-y-1">
          {links(secondaryLinks)}
        </nav>
        <SidebarAccount displayName={displayName} partyName={partyName} loading={loading} />
      </aside>
      <header className="mobile-shell">
        <div className="flex items-center justify-between px-4 py-2">
          {brand}
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-2 px-2 text-sm"
            onClick={() => setMenuOpen(true)}
          >
            <Menu size={18} aria-hidden="true" />
            Меню
          </button>
        </div>
        <nav aria-label="Основная навигация" className="grid grid-cols-4 border-t border-border">
          {links(mainLinks, true)}
        </nav>
      </header>
      <EditorDialog open={menuOpen} onClose={() => setMenuOpen(false)} title="Навигация">
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
      </EditorDialog>
    </>
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
        <div className={`h-3 w-28 animate-pulse rounded bg-muted ${mobile ? "mx-3" : ""}`} />
        <div className={`mt-2 h-3 w-20 animate-pulse rounded bg-muted ${mobile ? "mx-3" : ""}`} />
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
