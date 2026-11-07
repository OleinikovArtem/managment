import { beforeEach, describe, expect, it, vi } from "vitest";

const { transaction, $transaction } = vi.hoisted(() => {
  const transaction = {
    partyMember: { findMany: vi.fn() },
    partyMemberProfile: { findMany: vi.fn() },
    partyComposition: { create: vi.fn(), updateMany: vi.fn() },
    partyCompositionMember: { deleteMany: vi.fn(), createMany: vi.fn(), findMany: vi.fn() },
  };
  return { transaction, $transaction: vi.fn() };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction } }));

import {
  createPartyComposition,
  updatePartyComposition,
} from "@/server/repositories/composition-repository";

describe("composition repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    $transaction.mockImplementation((callback) => callback(transaction));
    transaction.partyMember.findMany.mockResolvedValue([
      { id: "member-1", className: "Cardinal", profiles: [] },
    ]);
    transaction.partyMemberProfile.findMany.mockResolvedValue([]);
    transaction.partyComposition.create.mockResolvedValue({ id: "composition-1" });
    transaction.partyComposition.updateMany.mockResolvedValue({ count: 1 });
    transaction.partyCompositionMember.findMany.mockResolvedValue([]);
    transaction.partyCompositionMember.deleteMany.mockResolvedValue({ count: 0 });
    transaction.partyCompositionMember.createMany.mockResolvedValue({ count: 1 });
  });

  it("stores a slot profession override without a profile reference", async () => {
    await createPartyComposition("party-1", {
      name: "Mages",
      slots: [{ memberId: "member-1", classOverride: "Duelist" }],
    });

    expect(transaction.partyComposition.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          members: {
            create: [
              expect.objectContaining({
                classOverride: "Duelist",
                slotOrder: 0,
              }),
            ],
          },
        }),
      }),
    );
  });

  it("updates the existing composition ID and replaces its slots transactionally", async () => {
    await expect(
      updatePartyComposition("party-1", "composition-1", {
        name: "Updated",
        slots: [{ memberId: "member-1", classOverride: "Duelist" }],
      }),
    ).resolves.toBe(true);

    expect(transaction.partyComposition.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { partyId: "party-1", id: "composition-1" } }),
    );
    expect(transaction.partyCompositionMember.deleteMany).toHaveBeenCalledWith({
      where: { partyId: "party-1", compositionId: "composition-1" },
    });
    expect(transaction.partyCompositionMember.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          partyId: "party-1",
          compositionId: "composition-1",
          memberId: "member-1",
          profileId: null,
          classOverride: "Duelist",
          slotOrder: 0,
        }),
      ],
    });
  });

  it("rejects a class override that duplicates a saved Main", async () => {
    await expect(
      createPartyComposition("party-1", {
        name: "Invalid",
        slots: [{ memberId: "member-1", classOverride: "Cardinal" }],
      }),
    ).rejects.toThrow("Профессия уже сохранена");
    expect(transaction.partyComposition.create).not.toHaveBeenCalled();
  });
});
