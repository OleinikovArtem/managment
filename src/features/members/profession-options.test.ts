import { describe, expect, it } from "vitest";
import {
  buildProfessionOptions,
  filterProfessionOptions,
  resolveSelectedProfessionOption,
} from "@/features/members/profession-options";
import { LINEAGE2_HIGH_FIVE_CLASSES } from "@/features/members/lineage2-classes";

describe("buildProfessionOptions", () => {
  it("keeps Main and subclass slots first, then sorts the remaining catalog without duplicates", () => {
    const options = buildProfessionOptions(" Duelist ", [
      { id: "second", className: "Cardinal", subclassSlot: 2 },
      { id: "first", className: "Dreadnought", subclassSlot: 1 },
      { id: "duplicate", className: "duelist", subclassSlot: 3 },
    ]);

    expect(options.slice(0, 3).map(({ className }) => className)).toEqual([
      "Duelist",
      "Dreadnought",
      "Cardinal",
    ]);
    expect(options.slice(3).map(({ className }) => className)).toEqual(
      options
        .slice(3)
        .map(({ className }) => className)
        .toSorted((a, b) => a.localeCompare(b)),
    );
    expect(options.filter(({ className }) => className.toLowerCase() === "duelist")).toHaveLength(
      1,
    );
  });

  it("offers the entire catalog when no saved class exists", () => {
    expect(buildProfessionOptions(null, [])).toHaveLength(LINEAGE2_HIGH_FIVE_CLASSES.length);
  });

  it("keeps a legacy selection linked without adding duplicate profession rows", () => {
    const preserved = { profileId: "sub", className: "Cardinal" };
    const options = buildProfessionOptions(
      "Cardinal",
      [{ id: "sub", className: "Cardinal", subclassSlot: 1 }],
      preserved,
    );

    expect(options.filter(({ className }) => className === "Cardinal")).toHaveLength(1);
    expect(options.some(({ value }) => value === "profile:sub")).toBe(false);
    expect(resolveSelectedProfessionOption(options, "profile:sub", preserved)).toEqual(
      options.find(({ value }) => value === "main"),
    );
    expect(
      buildProfessionOptions("Cardinal", [], { className: "Old Legacy Class" }).some(
        ({ value }) => value === "class:Old Legacy Class",
      ),
    ).toBe(true);
  });
});

describe("filterProfessionOptions", () => {
  it("filters without changing the selected stable order and ignores case", () => {
    const options = buildProfessionOptions("Cardinal", [
      { id: "one", className: "Dreadnought", subclassSlot: 1 },
    ]);
    const filtered = filterProfessionOptions(options, "dReAd");
    expect(filtered.map(({ className }) => className)).toEqual(["Dreadnought"]);
    expect(filterProfessionOptions(options, "no-such-class")).toEqual([]);
  });
});
