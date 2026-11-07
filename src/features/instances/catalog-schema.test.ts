import { describe, expect, it } from "vitest";
import { instanceNameSchema, normalizeCatalogName, stageContextSchema } from "./catalog-schema";
import { raidInputSchema } from "@/features/raids/raid-schema";
describe("instance and draft stage boundaries",()=>{
  it("normalizes case, Unicode compatibility and spacing for private duplicate detection",()=>{
    expect(normalizeCatalogName("  Ｆｒｅｙａ   HARD ")).toBe("freya hard");
    expect(instanceNameSchema.safeParse("  ").success).toBe(false);
    expect(instanceNameSchema.safeParse("X".repeat(121)).success).toBe(false);
  });
  it("requires stage and revision together and rejects client ownership fields",()=>{
    expect(stageContextSchema.safeParse({stageId:null,revision:null}).success).toBe(true);
    expect(stageContextSchema.safeParse({stageId:"stage",revision:2}).success).toBe(true);
    for(const input of [{stageId:"stage",revision:null},{stageId:null,revision:2},{stageId:"stage",revision:0},{stageId:"stage",revision:1,partyId:"other"}])expect(stageContextSchema.safeParse(input).success).toBe(false);
  });
  it("allows an optional display title but preserves loot quantity and snapshot validation",()=>{
    const data={name:"",occurredAt:"2026-11-06T18:30:00.000Z",stageId:null,stageRevision:null,creationKey:"e535278a-b278-4b04-94a8-07bd6108ad06",participants:[{memberId:"one",status:"PRESENT"}],lootDrops:[]};
    expect(raidInputSchema.safeParse(data).success).toBe(true);
    expect(raidInputSchema.safeParse({...data,lootDrops:[{itemId:"item",quantity:0}]}).success).toBe(false);
    expect(raidInputSchema.safeParse({...data,partyId:"other"}).success).toBe(false);
  });
});
