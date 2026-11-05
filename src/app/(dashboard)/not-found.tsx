import Link from "next/link";

export default function WorkspaceNotFound() {
  return <section className="max-w-xl py-8"><h1 className="text-xl font-semibold">Запись не найдена</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Проверьте ссылку или вернитесь к обзору группы.</p><Link href="/dashboard" className="mt-5 inline-flex min-h-11 items-center text-sm underline underline-offset-4">К обзору</Link></section>;
}
