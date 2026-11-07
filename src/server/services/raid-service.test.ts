import { beforeEach, describe, expect, it, vi } from "vitest";

const { createPartyRaidRecord, updatePartyRaidRecord } = vi.hoisted(() => ({
  createPartyRaidRecord: vi.fn(),
  updatePartyRaidRecord: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/repositories/instance-repository", () => ({ getInstanceSetup: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));
vi.mock("@/server/repositories/raid-repository", () => ({
  createPartyRaidRecord,
  updatePartyRaidRecord,
  getPartyRaidById: vi.fn(),
  listActivePartyMembers: vi.fn(),
  listPartyItemLootDrops: vi.fn(),
  listPartyRaidItems: vi.fn(),
  listPartyRaids: vi.fn(),
}));

import { createRaid, RaidInputError, updateRaid } from "@/server/services/raid-service";

const validInput = {
  name: "Sunday Raid",
  instanceName: "",
  occurredAt: "2026-11-01T18:30:00.000Z",
  comment: "",
  participants: [{ memberId: "member-1", status: "PRESENT" }],
  lootDrops: [{ itemId: "item-1", quantity: 1, comment: "" }],
};

describe("raid service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates quantity again at the service boundary", async () => {
    await expect(
      createRaid("party-a", {
        ...validInput,
        lootDrops: [{ itemId: "item-1", quantity: 1.5, comment: "" }],
      }),
    ).rejects.toBeInstanceOf(RaidInputError);
    expect(createPartyRaidRecord).not.toHaveBeenCalled();
  });

  it("sends a validated party-scoped snapshot and loot set to the atomic repository", async () => {
    createPartyRaidRecord.mockResolvedValue("raid-1");

    await expect(createRaid("party-a", validInput)).resolves.toBe("raid-1");
    expect(createPartyRaidRecord).toHaveBeenCalledWith(
      "party-a",
      expect.objectContaining({
        participants: [{ memberId: "member-1", status: "PRESENT" }],
        lootDrops: [{ itemId: "item-1", quantity: 1, comment: "" }],
      }),
    );
  });

  it("does not allow service callers to replace or omit the attendance snapshot", async () => {
    updatePartyRaidRecord.mockRejectedValue(new Error("Исторический состав рейда нельзя менять."));

    await expect(
      updateRaid("party-a", "raid-1", {
        ...validInput,
        participants: [{ memberId: "different-member", status: "PRESENT" }],
      }),
    ).rejects.toThrow("Исторический состав рейда нельзя менять.");
  });
});
