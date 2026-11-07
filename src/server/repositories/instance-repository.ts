import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@/generated/prisma/client";
import { CatalogOperationError, StageConflictError, normalizeCatalogName, type StageContext } from "@/features/instances/catalog-schema";
import { lockParty, lockStages } from "./catalog-locks";
import { selectableCatalog, visibleCatalog } from "./catalog-scope";

type Tx = Prisma.TransactionClient;
const published = { publishedAt: { not: null }, isSelectable: true };
const itemSelection = { id: true, canonicalName: true, displayName: true, category: true, partyId: true, isActive: true };

export async function resolveStageDefault(tx: Tx, partyId: string) {
  const party = await tx.party.findUniqueOrThrow({ where: { id: partyId }, select: { selectedStageId: true, stageSelectionRevision: true } });
  const config = await tx.serverStageConfig.findUnique({ where: { id: "GLOBAL" } });
  const available = await tx.serverStage.findMany({ where: published, orderBy: { sequence: "asc" }, select: { id: true, name: true, revision: true } });
  const globalStage = config?.explicitCurrentStageId ? available.find(row=>row.id===config.explicitCurrentStageId) : available.at(-1);
  const stage = party.selectedStageId ? available.find(row=>row.id===party.selectedStageId) : globalStage;
  const requested = party.selectedStageId ?? config?.explicitCurrentStageId;
  return { available, globalStageId: globalStage?.id ?? null, context: { stageId: stage?.id ?? null, revision: stage?.revision ?? null }, selection: party.selectedStageId, selectionRevision: party.stageSelectionRevision, unavailable: Boolean(requested && !stage) };
}

export async function assertDraftStage(tx: Tx, context: StageContext) {
  if (!context.stageId) {
    if (context.revision !== null || await tx.serverStage.count({ where: published })) throw new StageConflictError("Выберите доступную стадию. Введённые данные сохранены.");
    return null;
  }
  const stage = await tx.serverStage.findFirst({ where: { id: context.stageId, ...published } });
  if (!stage) throw new StageConflictError("Выбранная стадия больше недоступна. Выберите другую — черновик сохранён.");
  if (stage.revision !== context.revision) throw new StageConflictError("Рекомендации обновились. Обновите их и повторите сохранение — черновик сохранён.");
  return stage;
}

export function getInstanceSetup(partyId: string) {
  return prisma.$transaction(async tx => {
    await lockStages(tx);
    const stages = await resolveStageDefault(tx, partyId);
    const instances = await tx.instance.findMany({ where: visibleCatalog(partyId), orderBy: [{ partyId: "asc" }, { displayName: "asc" }] });
    return { stages, instances: instances.map(({ id, name, displayName, aliases, source, partyId, isActive }) => ({ id, name, displayName, aliases, source, partyId, isActive })) };
  });
}

export async function getLootRecommendations(partyId: string, instanceId: string | null, context: StageContext) {
  return prisma.$transaction(async tx => {
    await lockStages(tx);
    const stage = context.stageId ? await tx.serverStage.findFirst({ where: { id: context.stageId, ...published } }) : null;
    if (context.stageId && !stage) throw new StageConflictError("Стадия недоступна. Выберите другую.");
    const instance = instanceId ? await tx.instance.findFirst({ where: { id: instanceId, ...visibleCatalog(partyId) } }) : null;
    if (instanceId && !instance) throw new CatalogOperationError("Инстанс не найден.");
    const rows = instance?.partyId
      ? await tx.partyInstanceLootPresetItem.findMany({ where: { partyId, preset: { instanceId: instance.id }, item: selectableCatalog(partyId) }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { item: { select: itemSelection } } })
      : instance && stage ? await tx.instanceStageLootRecommendation.findMany({ where: { instanceId: instance.id, stageId: stage.id, item: { partyId: null, isActive: true } }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { item: { select: itemSelection } } }) : [];
    const quick = await tx.partyQuickLootItem.findMany({ where: { partyId, item: selectableCatalog(partyId) }, orderBy: [{ sortOrder: "asc" }, { itemId: "asc" }], select: { item: { select: itemSelection } } });
    return { context: { stageId: stage?.id ?? null, revision: stage?.revision ?? null }, items: rows.map(row => row.item), quick: quick.map(row => row.item) };
  });
}

export async function saveStageDefault(partyId: string, stageId: string | null, revision: number) {
  return prisma.$transaction(async tx => {
    await lockStages(tx); await lockParty(tx, partyId);
    if (stageId && !await tx.serverStage.findFirst({ where: { id: stageId, ...published } })) throw new CatalogOperationError("Стадия недоступна.");
    const changed = await tx.party.updateMany({ where: { id: partyId, stageSelectionRevision: revision }, data: { selectedStageId: stageId, stageSelectionRevision: { increment: 1 } } });
    if (!changed.count) throw new CatalogOperationError("Настройка уже изменена. Обновите страницу настроек.");
    return revision + 1;
  });
}

export async function createCustomInstance(partyId: string, name: string) {
  try { return await prisma.instance.create({ data: { partyId, code: `CUSTOM_${randomUUID()}`, name, displayName: name, normalizedName: normalizeCatalogName(name), category: "Custom", source: "CUSTOM", aliases: [] } }); }
  catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new CatalogOperationError("Такой инстанс уже есть. Если он в архиве — восстановите его."); throw error; }
}

export async function updateCustomInstance(partyId: string, id: string, input: { name?: string; isActive?: boolean }) {
  return prisma.$transaction(async tx => {
    await lockParty(tx, partyId);
    const changed = await tx.instance.updateMany({ where: { partyId, id }, data: { ...(input.name ? { name: input.name, displayName: input.name, normalizedName: normalizeCatalogName(input.name) } : {}), ...(input.isActive !== undefined ? { isActive: input.isActive } : {}) } });
    if (!changed.count) throw new CatalogOperationError("Свой инстанс не найден.");
  });
}

export async function saveLootPreset(partyId: string, instanceId: string | null, itemIds: string[]) {
  return prisma.$transaction(async tx => {
    await lockParty(tx, partyId);
    const count = await tx.item.count({ where: { id: { in: itemIds }, ...selectableCatalog(partyId) } });
    if (count !== itemIds.length) throw new CatalogOperationError("Один из предметов недоступен.");
    if (!instanceId) {
      await tx.partyQuickLootItem.deleteMany({ where: { partyId } });
      await tx.partyQuickLootItem.createMany({ data: itemIds.map((itemId, sortOrder) => ({ partyId, itemId, sortOrder })) });
      return;
    }
    if (!await tx.instance.findFirst({ where: { id: instanceId, partyId } })) throw new CatalogOperationError("Рекомендации общего инстанса изменять нельзя.");
    const preset = await tx.partyInstanceLootPreset.upsert({ where: { partyId_instanceId: { partyId, instanceId } }, create: { partyId, instanceId }, update: { revision: { increment: 1 } } });
    await tx.partyInstanceLootPresetItem.deleteMany({ where: { partyId, presetId: preset.id } });
    await tx.partyInstanceLootPresetItem.createMany({ data: itemIds.map((itemId, sortOrder) => ({ partyId, presetId: preset.id, itemId, sortOrder })) });
  });
}
