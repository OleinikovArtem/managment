import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  activeMemberFindMany,
  itemFindMany,
  raidCreate,
  raidFindFirst,
  raidParticipantCreate,
  raidParticipantUpdateMany,
  raidUpdateMany,
  lootDropCreate,
  lootDropUpdateMany,
  transaction,
} = vi.hoisted(() => {
  const mocks = {
    activeMemberFindMany: vi.fn(),
    itemFindMany: vi.fn(),
    raidCreate: vi.fn(),
    raidFindFirst: vi.fn(),
    raidParticipantCreate: vi.fn(),
    raidParticipantUpdateMany: vi.fn(),
    raidUpdateMany: vi.fn(),
    lootDropCreate: vi.fn(),
    lootDropUpdateMany: vi.fn(),
  };
  const transaction = {
    partyMember: { findMany: mocks.activeMemberFindMany },
    item: { findMany: mocks.itemFindMany },
    raid: { create: mocks.raidCreate, findFirst: mocks.raidFindFirst, updateMany: mocks.raidUpdateMany },
    raidParticipant: { create: mocks.raidParticipantCreate, updateMany: mocks.raidParticipantUpdateMany },
    lootDrop: { create: mocks.lootDropCreate, updateMany: mocks.lootDropUpdateMany },
  };
  return { ...mocks, transaction };
});

const {
  partyMemberFindMany,
  itemListFindMany,
  partyRaidFindMany,
  partyRaidFindFirst,
  partyLootDropFindMany,
  $transaction,
} = vi.hoisted(() => ({
  partyMemberFindMany: vi.fn(),
  itemListFindMany: vi.fn(),
  partyRaidFindMany: vi.fn(),
  partyRaidFindFirst: vi.fn(),
  partyLootDropFindMany: vi.fn(),
  $transaction: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction,
    partyMember: { findMany: partyMemberFindMany },
    item: { findMany: itemListFindMany },
    raid: { findMany: partyRaidFindMany, findFirst: partyRaidFindFirst },
    lootDrop: { findMany: partyLootDropFindMany },
  },
}));

import {
  createPartyRaidRecord,
  getPartyRaidById,
  listPartyItemLootDrops,
  listPartyRaids,
  updatePartyRaidRecord,
} from "@/server/repositories/raid-repository";

const validInput = {
  name: "Sunday Raid",
  instanceName: "",
  occurredAt: "2026-11-01T18:30:00.000Z",
  comment: "",
  participants: [
    { memberId: "member-1", status: "PRESENT" as const },
    { memberId: "member-2", status: "ABSENT" as const },
  ],
  lootDrops: [{ itemId: "item-1", quantity: 2, comment: "" }],
};

describe("raid repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    $transaction.mockImplementation((callback) => callback(transaction));
  });

  it("scopes list, details and item history to partyId", async () => {
    await listPartyRaids("party-a");
    expect(partyRaidFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { partyId: "party-a" } }),
    );

    await getPartyRaidById("party-a", "raid-1");
    expect(partyRaidFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "raid-1", partyId: "party-a" } }),
    );

    await listPartyItemLootDrops("party-a", "item-1");
    expect(partyLootDropFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { partyId: "party-a", itemId: "item-1" } }),
    );
  });

  it("creates the raid, every active member snapshot and every loot entry transactionally", async () => {
    activeMemberFindMany.mockResolvedValue([
      { id: "member-1", nickname: "Current One", distributionWeight: 2 },
      { id: "member-2", nickname: "Current Two", distributionWeight: 1 },
    ]);
    itemFindMany.mockResolvedValue([{ id: "item-1" }]);
    raidCreate.mockResolvedValue({ id: "raid-1" });

    await createPartyRaidRecord("party-a", validInput);

    expect($transaction).toHaveBeenCalledOnce();
    expect(activeMemberFindMany).toHaveBeenCalledWith({
      where: { partyId: "party-a", isActive: true },
      select: { id: true, nickname: true, distributionWeight: true },
    });
    expect(raidParticipantCreate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          partyId: "party-a",
          raidId: "raid-1",
          memberId: "member-1",
          nicknameSnapshot: "Current One",
          status: "PRESENT",
          distributionWeight: 1,
        }),
      }),
    );
    expect(raidParticipantCreate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          nicknameSnapshot: "Current Two",
          status: "ABSENT",
          distributionWeight: 1,
        }),
      }),
    );
    expect(lootDropCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          partyId: "party-a",
          raidId: "raid-1",
          itemId: "item-1",
          quantity: 2,
        }),
      }),
    );
  });

  it("updates existing attendance records and adds loot without deleting history", async () => {
    raidFindFirst.mockResolvedValue({
      participants: [{ memberId: "member-1" }, { memberId: "member-2" }],
      lootDrops: [{ id: "drop-1" }],
    });
    itemFindMany.mockResolvedValue([{ id: "item-1" }]);
    raidParticipantUpdateMany.mockResolvedValue({ count: 1 });
    lootDropUpdateMany.mockResolvedValue({ count: 1 });
    raidUpdateMany.mockResolvedValue({ count: 1 });

    await updatePartyRaidRecord("party-a", "raid-1", {
      ...validInput,
      lootDrops: [
        { id: "drop-1", itemId: "item-1", quantity: 2, comment: "updated" },
        { itemId: "item-1", quantity: 1, comment: "" },
      ],
    });

    expect(raidParticipantUpdateMany).toHaveBeenCalledTimes(2);
    expect(raidParticipantCreate).not.toHaveBeenCalled();
    expect(lootDropUpdateMany).toHaveBeenCalledOnce();
    expect(lootDropCreate).toHaveBeenCalledOnce();
  });
});
