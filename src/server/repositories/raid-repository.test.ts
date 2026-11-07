import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  activeMemberFindMany,
  partyMemberFindFirst,
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
    partyMemberFindFirst: vi.fn(),
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
    $queryRaw: vi.fn().mockResolvedValue([]),
    serverStage: { count: vi.fn().mockResolvedValue(0) },
    partyMember: { findMany: mocks.activeMemberFindMany, findFirst: mocks.partyMemberFindFirst },
    item: { findMany: mocks.itemFindMany, count: vi.fn().mockResolvedValue(1) },
    raid: {
      create: mocks.raidCreate,
      findFirst: mocks.raidFindFirst,
      findUnique: vi.fn().mockResolvedValue(null),
      updateMany: mocks.raidUpdateMany,
    },
    raidParticipant: {
      create: mocks.raidParticipantCreate,
      updateMany: mocks.raidParticipantUpdateMany,
    },
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
  creationKey: "e535278a-b278-4b04-94a8-07bd6108ad06",
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
      select: {
        id: true,
        nickname: true,
        distributionWeight: true,
        className: true,
        role: true,
        level: true,
        profiles: { where: { isActive: true }, select: { className: true } },
      },
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
      lockedAt: null,
      stageId: null,
      _count: { saleTransactions: 0 },
      participants: [{ memberId: "member-1" }, { memberId: "member-2" }],
      lootDrops: [{ id: "drop-1", itemId: "item-1" }],
    });
    itemFindMany.mockResolvedValue([{ id: "item-1" }]);
    partyMemberFindFirst.mockResolvedValue({
      className: "Cardinal",
      role: "Healer",
      level: 80,
      profiles: [],
    });
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

  it("stores a composition-only profession override in the raid class snapshot", async () => {
    activeMemberFindMany.mockResolvedValue([
      {
        id: "member-1",
        nickname: "Current One",
        distributionWeight: 1,
        className: "Cardinal",
        role: "Healer",
        level: 80,
        profiles: [],
      },
    ]);
    itemFindMany.mockResolvedValue([{ id: "item-1" }]);
    raidCreate.mockResolvedValue({ id: "raid-1" });

    await createPartyRaidRecord("party-a", {
      ...validInput,
      participants: [{ memberId: "member-1", status: "PRESENT", classOverride: "Duelist" }],
      lootDrops: [],
    });

    expect(raidParticipantCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          profileId: null,
          classSnapshot: "Duelist",
          roleSnapshot: "Healer",
          levelSnapshot: 80,
          profileSnapshot: null,
        }),
      }),
    );
  });

  it("keeps the historical class snapshot when editing without changing the selected override", async () => {
    raidFindFirst.mockResolvedValue({
      lockedAt: null,
      stageId: null,
      _count: { saleTransactions: 0 },
      participants: [
        { memberId: "member-1", profileId: null, classSnapshot: "Duelist" },
        { memberId: "member-2", profileId: null, classSnapshot: "Cardinal" },
      ],
      lootDrops: [],
    });
    partyMemberFindFirst.mockResolvedValue({
      className: "Cardinal",
      role: "Healer",
      level: 80,
      profiles: [],
    });
    raidUpdateMany.mockResolvedValue({ count: 1 });
    raidParticipantUpdateMany.mockResolvedValue({ count: 1 });

    await updatePartyRaidRecord("party-a", "raid-1", {
      ...validInput,
      lootDrops: [],
      participants: [
        { memberId: "member-1", status: "PRESENT", classOverride: "Duelist" },
        { memberId: "member-2", status: "ABSENT" },
      ],
    });

    expect(raidParticipantUpdateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ data: { status: "PRESENT" } }),
    );
  });
});
