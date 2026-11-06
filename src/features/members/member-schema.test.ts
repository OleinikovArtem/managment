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
  it("accepts Main and four fixed Subclass slots, including Kamael", () => {
    const data = memberInputSchema.parse({ nickname: "Korsa", className: "Grand Khavatari", subclasses: [
      { slot: 1, className: "Cardinal" }, { slot: 2, className: "Doombringer" },
      { slot: 3, className: "Male Soul Hound" }, { slot: 4, className: "Trickster" },
    ] });
    expect(data.subclasses).toHaveLength(4);
    expect(data.level).toBeUndefined();
  });
  it("keeps empty subclass slots and rejects a fifth slot or duplicate profile identity", () => {
    expect(memberInputSchema.parse({ nickname: "Korsa", subclasses: [{ slot: 4, className: "" }] }).subclasses).toEqual([{ slot: 4, className: "" }]);
    expect(memberInputSchema.safeParse({ nickname: "Korsa", subclasses: [{ slot: 5, className: "Cardinal" }] }).success).toBe(false);
    expect(memberInputSchema.safeParse({ nickname: "Korsa", subclasses: [{ slot: 1, id: "same", className: "Cardinal" }, { slot: 2, id: "same", className: "Titan" }] }).success).toBe(false);
  });
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
