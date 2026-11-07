import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { normalizeNickname, type MemberInput } from "@/features/members/member-schema";
import {
  createPartyMemberRecord,
  deactivatePartyMemberRecord,
  updatePartyMemberRecord,
} from "@/server/repositories/party-member-repository";

export class DuplicateNicknameError extends Error {
  constructor() {
    super("Участник с таким ником уже существует в этой группе.");
    this.name = "DuplicateNicknameError";
  }
}

export class PartyMemberNotFoundError extends Error {
  constructor() {
    super("Участник не найден или уже деактивирован.");
    this.name = "PartyMemberNotFoundError";
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function getNormalizedNickname(nickname: string): string {
  const normalizedNickname = normalizeNickname(nickname);
  if (normalizedNickname.length === 0) {
    throw new Error("Ник не может состоять только из пробелов.");
  }
  return normalizedNickname;
}

export async function createPartyMember(partyId: string, input: MemberInput): Promise<void> {
  const normalizedNickname = getNormalizedNickname(input.nickname);

  try {
    await createPartyMemberRecord(partyId, input, normalizedNickname);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new DuplicateNicknameError();
    }
    throw error;
  }
}

export async function updatePartyMember(
  partyId: string,
  memberId: string,
  input: MemberInput,
): Promise<void> {
  const normalizedNickname = getNormalizedNickname(input.nickname);

  try {
    const member = await updatePartyMemberRecord(partyId, memberId, input, normalizedNickname);
    if (!member) {
      throw new PartyMemberNotFoundError();
    }
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new DuplicateNicknameError();
    }
    throw error;
  }
}

export async function deactivatePartyMember(partyId: string, memberId: string): Promise<void> {
  const member = await deactivatePartyMemberRecord(partyId, memberId);
  if (!member) {
    throw new PartyMemberNotFoundError();
  }
}
