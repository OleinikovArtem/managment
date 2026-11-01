import { beforeEach, describe, expect, it, vi } from "vitest";

const { createPartyMemberRecord } = vi.hoisted(() => ({
  createPartyMemberRecord: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/repositories/party-member-repository", () => ({
  createPartyMemberRecord,
  updatePartyMemberRecord: vi.fn(),
  deactivatePartyMemberRecord: vi.fn(),
}));

import { Prisma } from "@/generated/prisma/client";
import { createPartyMember, DuplicateNicknameError } from "@/server/services/party-member-service";

describe("createPartyMember", () => {
  beforeEach(() => {
    createPartyMemberRecord.mockReset();
  });

  it("persists the original nickname and its normalized unique key", async () => {
    await createPartyMember("party-1", { nickname: "  Hero   One ", comment: "" });

    expect(createPartyMemberRecord).toHaveBeenCalledWith(
      "party-1",
      { nickname: "  Hero   One ", comment: "" },
      "hero one",
    );
  });

  it("translates database uniqueness conflicts into a service conflict", async () => {
    const uniqueError = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed",
      {
        code: "P2002",
        clientVersion: "7.10.1",
        meta: { target: ["partyId", "normalizedNickname"] },
      },
    );
    createPartyMemberRecord.mockRejectedValue(uniqueError);

    await expect(
      createPartyMember("party-1", { nickname: "Hero", comment: "" }),
    ).rejects.toBeInstanceOf(DuplicateNicknameError);
  });
});
