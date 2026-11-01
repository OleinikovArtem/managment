import "server-only";

import { getPartyById, renameParty } from "@/server/repositories/party-repository";

export class PartyNotFoundError extends Error {
  constructor() {
    super("Группа не найдена.");
    this.name = "PartyNotFoundError";
  }
}

export async function getPartySettings(partyId: string) {
  const party = await getPartyById(partyId);
  if (!party) {
    throw new PartyNotFoundError();
  }
  return party;
}

export async function updatePartyName(partyId: string, name: string) {
  const result = await renameParty(partyId, name);
  if (result.count !== 1) {
    throw new PartyNotFoundError();
  }
}
