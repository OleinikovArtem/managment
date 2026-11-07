import { describe, expect, it } from "vitest";
import { raidInputSchema } from "@/features/raids/raid-schema";

const validInput = {
  name: "Sunday Raid",
  instanceName: "Antharas",
  occurredAt: "2026-11-01T18:30:00.000Z",
  comment: "",
  participants: [
    { memberId: "member-1", status: "PRESENT" },
    { memberId: "member-2", status: "ABSENT" },
  ],
  lootDrops: [{ itemId: "item-1", quantity: 2, comment: "" }],
};

describe("raid input validation", () => {
  it("accepts a UTC raid time, attendance snapshot and positive integer quantity", () => {
    expect(raidInputSchema.safeParse(validInput).success).toBe(true);
  });

  it("accepts a manually selected roster without an optional composition", () => {
    expect(raidInputSchema.safeParse({ ...validInput, compositionId: undefined }).success).toBe(
      true,
    );
  });

  it("accepts a class override and rejects a profile plus override in one slot", () => {
    expect(
      raidInputSchema.safeParse({
        ...validInput,
        participants: [{ memberId: "member-1", status: "PRESENT", classOverride: "Duelist" }],
      }).success,
    ).toBe(true);
    expect(
      raidInputSchema.safeParse({
        ...validInput,
        participants: [
          {
            memberId: "member-1",
            status: "PRESENT",
            profileId: "profile-1",
            classOverride: "Duelist",
          },
        ],
      }).success,
    ).toBe(false);
  });

  it.each([0, -1, 1.5])("rejects loot quantity %s", (quantity) => {
    const result = raidInputSchema.safeParse({
      ...validInput,
      lootDrops: [{ itemId: "item-1", quantity }],
    });

    expect(result.success).toBe(false);
  });

  it("requires at least one present participant", () => {
    const result = raidInputSchema.safeParse({
      ...validInput,
      participants: [{ memberId: "member-1", status: "ABSENT" }],
    });

    expect(result.success).toBe(false);
  });

  it("rejects duplicate participant rows and client party IDs", () => {
    expect(
      raidInputSchema.safeParse({
        ...validInput,
        participants: [
          { memberId: "member-1", status: "PRESENT" },
          { memberId: "member-1", status: "ABSENT" },
        ],
      }).success,
    ).toBe(false);
    expect(raidInputSchema.safeParse({ ...validInput, partyId: "client-party" }).success).toBe(
      false,
    );
  });
});
