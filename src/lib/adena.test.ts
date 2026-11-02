import { describe, expect, it } from "vitest";
import { adenaColor, formatAdena, parseAdenaInput } from "@/lib/adena";

describe("Adena formatting", () => {
  it("parses compact values without floating point money", () => {
    expect(parseAdenaInput("5.25м")).toBe("5250000");
    expect(parseAdenaInput("1,2б")).toBe("1200000000");
    expect(parseAdenaInput("750к")).toBe("750000");
    expect(parseAdenaInput("1.5")).toBeNull();
  });

  it("formats large values compactly", () => {
    expect(formatAdena(5_250_000n)).toBe("5.25м");
    expect(formatAdena(12_000_000_000n)).toBe("12млрд");
  });

  it("keeps Adena consistently gold", () => {
    expect(adenaColor(1_000_000n)).toContain("hsl(45");
    expect(adenaColor(10_000_000_000n)).toContain("hsl(45");
  });
});
