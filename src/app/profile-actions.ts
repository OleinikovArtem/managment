"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireSignedInActionUser } from "@/server/auth/party-access";

const displayNameSchema = z
  .string()
  .trim()
  .min(2, "Имя должно содержать не менее 2 символов.")
  .max(80, "Имя не должно превышать 80 символов.");

export type ProfileActionResult = { ok: true; message: string } | { ok: false; message: string };

export async function updateOwnDisplayNameAction(value: unknown): Promise<ProfileActionResult> {
  const user = await requireSignedInActionUser();
  const parsed = displayNameSchema.safeParse(value);
  if (!parsed.success)
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Проверьте имя." };
  await prisma.user.update({ where: { id: user.id }, data: { displayName: parsed.data } });
  revalidatePath("/profile");
  revalidatePath("/", "layout");
  return { ok: true, message: "Имя для отображения сохранено." };
}
