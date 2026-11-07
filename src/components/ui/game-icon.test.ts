import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import instanceLootDump from "../../../prisma/seeds/bohpts-stage-1-loot.json";
import { itemIconUrl } from "./game-icon";

describe("local drop-table icons", () => {
  it("maps every item in the supplied Stage 1 tables to a local image", () => {
    const items = Object.values(instanceLootDump.sources).flatMap((source) => source.items);
    for (const item of items) {
      const url = itemIconUrl(item.name, item.category);
      expect(url, item.name).not.toBeNull();
      expect(existsSync(resolve(process.cwd(), "public", url!.slice(1))), item.name).toBe(true);
    }
  });
});
