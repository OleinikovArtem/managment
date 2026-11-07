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

export function Sidebar({ displayName, partyName }: { displayName: string; partyName: string }) {
  return (
    <Suspense fallback={<div className="h-24 lg:h-screen lg:w-52" />}>
      <Navigation displayName={displayName} partyName={partyName} />
    </Suspense>
  );
}

function Navigation({ displayName, partyName }: { displayName: string; partyName: string }) {
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
        <div className="mt-auto border-t border-border pt-4">
          <p className="truncate text-xs font-medium">{partyName}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{displayName}</p>
          <div className="mt-2 flex items-center gap-2">
            <Link
              href="/profile"
              className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Мой профиль
            </Link>
            <Link
              href="/parties"
              className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Сменить группу
            </Link>
            <SignOutButton />
          </div>
        </div>
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
          <div className="mt-4 border-t border-border pt-3">
            <p className="truncate px-3 text-xs font-medium">{partyName}</p>
            <p className="mt-1 truncate px-3 text-xs text-muted-foreground">{displayName}</p>
            <Link href="/profile" onClick={() => setMenuOpen(false)} className="sidebar-link">
              Мой профиль
            </Link>
            <Link href="/parties" onClick={() => setMenuOpen(false)} className="sidebar-link">
              Сменить группу
            </Link>
            <SignOutButton />
          </div>
        </nav>
      </EditorDialog>
    </>
  );
}
