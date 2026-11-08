import { redirect } from "next/navigation";
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const key of ["month", "day", "instance", "member", "resets"]) {
    const value = params[key];
    if (typeof value === "string") query.set(key, value);
  }
  query.set("view", "calendar");
  redirect(`/raids?${query}`);
}
