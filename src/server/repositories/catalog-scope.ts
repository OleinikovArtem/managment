export const visibleCatalog = (partyId: string) => ({ OR: [{ partyId: null }, { partyId }] });
export const selectableCatalog = (partyId: string) => ({
  ...visibleCatalog(partyId),
  isActive: true,
});
