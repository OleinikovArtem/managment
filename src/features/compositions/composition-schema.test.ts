import { describe, expect, it } from "vitest";
import { compositionInputSchema } from "@/features/compositions/composition-schema";

const base = { name: "Mages", slots: [{ memberId: "member-1" }] };

describe("composition input", () => {
  it("accepts a supported class override on a member slot", () => {
    expect(
      compositionInputSchema.safeParse({
        ...base,
        slots: [{ memberId: "member-1", classOverride: "Duelist" }],
      }).success,
    ).toBe(true);
  });

  it("rejects an unsupported class and a profile combined with an override", () => {
    expect(
      compositionInputSchema.safeParse({
        ...base,
        slots: [{ memberId: "member-1", classOverride: "Unsupported Class" }],
      }).success,
    ).toBe(false);
    expect(
      compositionInputSchema.safeParse({
        ...base,
        slots: [{ memberId: "member-1", profileId: "profile-1", classOverride: "Duelist" }],
      }).success,
    ).toBe(false);
  });
});
