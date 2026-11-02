import { describe, expect, it } from "vitest";
import { memberInputSchema, normalizeNickname } from "@/features/members/member-schema";

describe("normalizeNickname", () => {
  it("normalizes whitespace, case and Unicode consistently", () => {
    expect(normalizeNickname("  НИк   Name\t")).toBe("ник name");
    expect(normalizeNickname("Cafe\u0301")).toBe("café");
  });

  it("produces an empty value for whitespace-only nicknames", () => {
    expect(normalizeNickname(" \t\n ")).toBe("");
  });
});

describe("memberInputSchema", () => {
  it("rejects a nickname whose normalized value is empty", () => {
    const result = memberInputSchema.safeParse({ nickname: " \t ", comment: "" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.nickname).toContain(
        "Ник не может состоять только из пробелов.",
      );
    }
  });

  it("preserves the entered nickname for display", () => {
    const result = memberInputSchema.parse({ nickname: "  Hero  ", comment: "" });

    expect(result.nickname).toBe("  Hero  ");
  });

  it("defaults the distribution weight and rejects non-positive weights", () => {
    expect(memberInputSchema.parse({ nickname: "Hero", comment: "" }).distributionWeight).toBe(1);
    expect(
      memberInputSchema.safeParse({
        nickname: "Hero",
        comment: "",
        distributionWeight: 0,
      }).success,
    ).toBe(false);
  });
});
