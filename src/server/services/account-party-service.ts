import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { PartyRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { ensureBaseItemCatalog } from "@/server/bootstrap/base-item-catalog";

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export class InvitationUnavailableError extends Error {
  constructor() {
    super("Ссылка приглашения недействительна, использована или истекла.");
    this.name = "InvitationUnavailableError";
  }
}

export async function createPartyForUser(userId: string, name: string) {
  return prisma.$transaction(async (transaction) => {
    const party = await transaction.party.create({ data: { name } });
    await transaction.partyMembership.create({
      data: { partyId: party.id, userId, role: PartyRole.OWNER },
    });
    await ensureBaseItemCatalog(transaction);
    const creator = await transaction.user.findUniqueOrThrow({
      where: { id: userId },
      select: { displayName: true, username: true },
    });
    await transaction.partyAuditEvent.create({
      data: {
        partyId: party.id,
        actorUserId: userId,
        actorNameSnapshot: creator.displayName,
        actorUsernameSnapshot: creator.username,
        action: "CREATE",
        entityType: "party",
        entityId: party.id,
        summary: `Создал группу «${name}».`,
      },
    });
    return party;
  });
}

export async function listUserParties(userId: string) {
  return prisma.partyMembership.findMany({
    where: { userId },
    include: { party: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function assertUserBelongsToParty(userId: string, partyId: string) {
  return prisma.partyMembership.findUnique({
    where: { partyId_userId: { partyId, userId } },
    select: { id: true },
  });
}

function hashInvitationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createPartyInvitation(partyId: string, createdByUserId: string, role: PartyRole = PartyRole.MEMBER) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
  const invitation = await prisma.partyInvitation.create({
    data: {
      partyId,
      tokenHash: hashInvitationToken(token),
      createdByUserId,
      role,
      expiresAt,
    },
    select: { id: true, expiresAt: true },
  });
  return { ...invitation, token };
}

export async function listPartyInvitations(partyId: string) {
  return prisma.partyInvitation.findMany({
    where: { partyId },
    select: { id: true, expiresAt: true, acceptedAt: true, revokedAt: true, createdAt: true, role: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}

export async function hasPartyTelegramBot(partyId: string) {
  return Boolean(await prisma.partyTelegramBotConfig.findUnique({ where: { partyId }, select: { partyId: true } }));
}

export async function revokePartyInvitation(partyId: string, invitationId: string) {
  const result = await prisma.partyInvitation.updateMany({
    where: { id: invitationId, partyId, acceptedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count === 1;
}

export async function getInvitationPreview(token: string) {
  if (!/^[A-Za-z0-9_-]{40,50}$/.test(token)) return null;
  const invitation = await prisma.partyInvitation.findUnique({
    where: { tokenHash: hashInvitationToken(token) },
    select: {
      party: { select: { name: true } },
      expiresAt: true,
      acceptedAt: true,
      revokedAt: true,
      role: true,
    },
  });
  if (
    !invitation ||
    invitation.acceptedAt ||
    invitation.revokedAt ||
    invitation.expiresAt <= new Date()
  ) return null;
  return { partyName: invitation.party.name, expiresAt: invitation.expiresAt, role: invitation.role };
}

export async function acceptPartyInvitation(token: string, userId: string) {
  if (!/^[A-Za-z0-9_-]{40,50}$/.test(token)) throw new InvitationUnavailableError();
  const tokenHash = hashInvitationToken(token);
  const now = new Date();

  return prisma.$transaction(async (transaction) => {
    const invitation = await transaction.partyInvitation.findUnique({
      where: { tokenHash },
      select: { id: true, partyId: true, role: true, expiresAt: true, acceptedAt: true, revokedAt: true },
    });
    if (!invitation || invitation.acceptedAt || invitation.revokedAt || invitation.expiresAt <= now) {
      throw new InvitationUnavailableError();
    }

    const claimed = await transaction.partyInvitation.updateMany({
      where: { id: invitation.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } },
      data: { acceptedAt: now },
    });
    if (claimed.count !== 1) throw new InvitationUnavailableError();

    const membership = await transaction.partyMembership.findUnique({
      where: { partyId_userId: { partyId: invitation.partyId, userId } },
      select: { id: true, role: true },
    });
    if (!membership) {
      await transaction.partyMembership.create({
        data: { partyId: invitation.partyId, userId, role: invitation.role },
      });
    } else if (membership.role !== PartyRole.OWNER && invitation.role === PartyRole.ADMIN && membership.role !== PartyRole.ADMIN) {
      await transaction.partyMembership.update({
        where: { id: membership.id },
        data: { role: PartyRole.ADMIN },
      });
    }
    return invitation.partyId;
  });
}
