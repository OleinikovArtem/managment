import Link from "next/link";

const links = {
  finance: [{ href: "/sales", label: "Выплаты" }, { href: "/ledger", label: "Операции" }],
  group: [{ href: "/members", label: "Участники" }, { href: "/compositions", label: "Составы" }],
};

export function SectionNavigation({ section, active }: { section: keyof typeof links; active: string }) {
  return <nav className="section-tabs" aria-label={section === "finance" ? "Разделы финансов" : "Разделы группы"}>
    {links[section].map((link) => <Link key={link.href} href={link.href} aria-current={active === link.href ? "page" : undefined}>{link.label}</Link>)}
  </nav>;
}
