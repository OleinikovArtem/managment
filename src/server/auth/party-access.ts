import "server-only";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { PartyRole } from "@/generated/prisma/enums";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

const ACTIVE_PARTY_COOKIE = "party-bank-active-party";

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Для этого действия необходимо войти в аккаунт.");
    this.name = "AuthenticationRequiredError";
  }
}

export class PartyAccessRequiredError extends Error {
  constructor(message = "У вас нет доступа к этой группе.") {
    super(message);
    this.name = "PartyAccessRequiredError";
  }
}

export type PartyAccess = {
  userId: string;
  username: string | null;
  displayName: string;
  partyId: string;
  partyName: string;
  role: PartyRole;
  canManage: boolean;
  isOwner: boolean;
};

async function resolvePartyAccess() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { user: null, memberships: [], membership: null };

  const memberships = await prisma.partyMembership.findMany({
    where: { userId: session.user.id },
    include: { party: true },
    orderBy: { createdAt: "asc" },
  });
  const activePartyId = (await cookies()).get(ACTIVE_PARTY_COOKIE)?.value;
  const selected = memberships.find(({ partyId }) => partyId === activePartyId);
  const membership = selected ?? (memberships.length === 1 ? memberships[0] : null);
  return { user: session.user, memberships, membership };
}

function toAccess(user: NonNullable<Awaited<ReturnType<typeof resolvePartyAccess>>["user"]>, membership: NonNullable<Awaited<ReturnType<typeof resolvePartyAccess>>["membership"]>): PartyAccess {
  const canManage = membership.role !== PartyRole.MEMBER;
  return {
    userId: user.id,
    username: user.username ?? null,
    displayName: user.name,
    partyId: membership.partyId,
    partyName: membership.party.name,
    role: membership.role,
    canManage,
    isOwner: membership.role === PartyRole.OWNER,
  };
}

export async function requireSignedInPageUser() {
  const { user } = await resolvePartyAccess();
  if (!user) redirect("/login");
  return user;
}

export async function requireSignedInActionUser() {
  const { user } = await resolvePartyAccess();
  if (!user) throw new AuthenticationRequiredError();
  return user;
}

export async function requirePartyPageAccess() {
  const { user, memberships, membership } = await resolvePartyAccess();
  if (!user) redirect("/login");
  if (memberships.length === 0) redirect("/onboarding");
  if (!membership) redirect("/parties");
  return toAccess(user, membership);
}

export async function requirePartyActionAccess(minimum: "MEMBER" | "ADMIN" | "OWNER" = "ADMIN") {
  const { user, memberships, membership } = await resolvePartyAccess();
  if (!user) throw new AuthenticationRequiredError();
  if (memberships.length === 0) throw new PartyAccessRequiredError("Сначала создайте группу или примите приглашение.");
  if (!membership) throw new PartyAccessRequiredError("Выберите активную группу.");

  const access = toAccess(user, membership);
  if (minimum === "OWNER" && !access.isOwner) {
    throw new PartyAccessRequiredError("Эти настройки доступны только владельцу группы.");
  }
  if (minimum === "ADMIN" && !access.canManage) {
    throw new PartyAccessRequiredError("Изменять данные группы может только администратор.");
  }
  return access;
}

export async function setActivePartyCookie(partyId: string) {
  (await cookies()).set(ACTIVE_PARTY_COOKIE, partyId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
