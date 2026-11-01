import "server-only";

import {
  raidInputSchema,
  type RaidInput,
} from "@/features/raids/raid-schema";
import {
  createPartyRaidRecord,
  getPartyRaidById,
  listActivePartyMembers,
  listPartyItemLootDrops,
  listPartyRaidItems,
  listPartyRaids,
  updatePartyRaidRecord,
} from "@/server/repositories/raid-repository";
import { RaidOperationError } from "@/features/raids/raid-errors";

export class RaidNotFoundError extends RaidOperationError {
  constructor() {
    super("Рейд не найден.");
    this.name = "RaidNotFoundError";
  }
}

export class RaidInputError extends RaidOperationError {
  constructor(message: string) {
    super(message);
    this.name = "RaidInputError";
  }
}

function parseRaidInput(input: unknown): RaidInput {
  if (typeof input === "object" && input !== null && "lootDrops" in input) {
    const lootDrops = input.lootDrops;
    if (Array.isArray(lootDrops)) {
      for (const drop of lootDrops) {
        if (
          typeof drop === "object" &&
          drop !== null &&
          "quantity" in drop &&
          (!Number.isInteger(drop.quantity) || Number(drop.quantity) <= 0)
        ) {
          throw new RaidInputError(
            "Количество предметов должно быть положительным целым числом.",
          );
        }
      }
    }
  }

  const parsed = raidInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new RaidInputError(parsed.error.issues[0]?.message ?? "Некорректные данные рейда.");
  }

  for (const lootDrop of parsed.data.lootDrops) {
    if (!Number.isInteger(lootDrop.quantity) || lootDrop.quantity <= 0) {
      throw new RaidInputError("Количество предметов должно быть положительным целым числом.");
    }
  }

  return parsed.data;
}

export async function listRaids(partyId: string) {
  return listPartyRaids(partyId);
}

export async function getRaidSetup(partyId: string) {
  const [members, items] = await Promise.all([
    listActivePartyMembers(partyId),
    listPartyRaidItems(partyId),
  ]);
  return { members, items };
}

export async function getRaid(partyId: string, raidId: string) {
  const raid = await getPartyRaidById(partyId, raidId);
  if (!raid) {
    throw new RaidNotFoundError();
  }
  return raid;
}

export async function createRaid(partyId: string, input: unknown) {
  const validInput = parseRaidInput(input);
  return createPartyRaidRecord(partyId, validInput);
}

export async function updateRaid(
  partyId: string,
  raidId: string,
  input: unknown,
) {
  const validInput = parseRaidInput(input);
  const updatedId = await updatePartyRaidRecord(partyId, raidId, validInput);
  if (!updatedId) {
    throw new RaidNotFoundError();
  }
  return updatedId;
}

export async function getItemLootHistory(partyId: string, itemId: string) {
  return listPartyItemLootDrops(partyId, itemId);
}
