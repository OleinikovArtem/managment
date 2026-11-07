import { z } from "zod";

export const normalizeCatalogName = (value: string) => value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase();
export const instanceNameSchema = z.string().trim().min(1, "Введите название.").max(120).refine(value => normalizeCatalogName(value).length > 0);
export const catalogId = z.string().trim().min(1).max(200);
export const stageContextSchema = z.object({ stageId: catalogId.nullable(), revision: z.number().int().positive().nullable() }).strict().refine(value => (value.stageId === null) === (value.revision === null), "Выберите стадию и версию набора.");
export type StageContext = z.infer<typeof stageContextSchema>;
export type StageOption = { id: string; name: string; revision: number };
export type InstanceOption = { id: string; name: string; displayName: string; aliases: string[]; source: string; partyId: string | null; isActive: boolean };
export type CatalogItemOption = { id: string; canonicalName: string; displayName: string | null; category?: string | null; partyId?: string | null; isActive?: boolean };
export type LootRecommendations = { context: StageContext; items: CatalogItemOption[]; quick: CatalogItemOption[] };
export class CatalogOperationError extends Error {}
export class StageConflictError extends CatalogOperationError {}
