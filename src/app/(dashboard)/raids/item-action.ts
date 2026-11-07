"use server";
import { requirePartyActionAccess } from "@/server/auth/party-access";
import { getPartyItemById } from "@/server/repositories/item-repository";
import { catalogId } from "@/features/instances/catalog-schema";
export async function getRaidItemAction(id: string) {
  const { partyId } = await requirePartyActionAccess("ADMIN");
  const item = await getPartyItemById(partyId, catalogId.parse(id));
  return item ? { id: item.id, canonicalName: item.canonicalName, displayName: item.displayName, category: item.category, partyId: item.partyId, isActive: item.isActive } : null;
}
