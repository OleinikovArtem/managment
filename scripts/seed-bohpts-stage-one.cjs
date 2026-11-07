/* eslint-disable @typescript-eslint/no-require-imports */
require('dotenv/config');
const { Client } = require('pg');
const { applyStageOperation } = require('./manage-server-stages.cjs');
const source = require('../prisma/seeds/bohpts-stage-1-loot.json');

const idempotencyKey = 'bohpts-stage-1-drop-v1';
const normalize = (name) => name.normalize('NFC').trim().replace(/\s+/gu, ' ').toLowerCase();

async function seed(client) {
  await client.query('SELECT pg_advisory_xact_lock(715064,1)');
  const prior = await client.query('SELECT 1 FROM "ServerStageAuditEvent" WHERE "idempotencyKey"=$1', [idempotencyKey]);
  if (prior.rowCount) return { replayed: true, recommendations: 0 };

  const stage = (await client.query('SELECT * FROM "ServerStage" WHERE code=$1', [source.stage.code])).rows[0];
  const instances = new Map();
  for (const list of Object.values(source.sources)) {
    const instanceCode = list.instanceCode;
    if (!instances.has(instanceCode)) {
      const row = (await client.query('SELECT id FROM "Instance" WHERE code=$1 AND "partyId" IS NULL AND "isActive"', [instanceCode])).rows[0];
      if (!row) throw new Error(`Missing shared instance ${instanceCode}; seed the instance catalog first`);
      instances.set(instanceCode, row.id);
    }
  }

  const replacements = [];
  for (const list of Object.values(source.sources)) {
    for (const [sortOrder, item] of list.items.entries()) {
      const row = (await client.query('SELECT id FROM "Item" WHERE "normalizedName"=$1 AND "partyId" IS NULL AND "isActive"', [normalize(item.name)])).rows[0];
      if (!row) throw new Error(`Missing shared item ${item.name}; seed the item catalog first`);
      replacements.push({
        instanceCode: list.instanceCode,
        itemId: row.id,
        sortOrder,
        sourceMetadata: {
          source: list.sourceLabel,
          tableNote: list.tableNote,
          quantity: item.quantity,
          groupChance: item.groupChance,
        },
      });
    }
  }

  const existing = stage
    ? (await client.query('SELECT i.code AS "instanceCode", r."itemId", r."sortOrder", r."sourceMetadata" FROM "InstanceStageLootRecommendation" r JOIN "Instance" i ON i.id=r."instanceId" WHERE r."stageId"=$1 ORDER BY i.code,r."sortOrder",r."itemId"', [stage.id])).rows
    : [];
  const targetCodes = new Set(instances.keys());
  const recommendations = [
    ...existing.filter((row) => !targetCodes.has(row.instanceCode)),
    ...replacements,
  ];
  const input = {
    key: idempotencyKey,
    actor: 'catalog-bootstrap',
    sourceLabel: 'User-provided BOHPTS Lab 78 and Fortress/Castle Dungeon drop tables',
    stage: stage ? { code: stage.code, name: stage.name, sequence: stage.sequence } : source.stage,
    recommendations,
    publish: true,
    isSelectable: true,
    ...(stage ? { expectedRevision: stage.revision } : {}),
  };
  await applyStageOperation(client, input, { manageTransaction: false });
  return { replayed: false, recommendations: replacements.length };
}

async function main() {
  const client = new Client({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL });
  try {
    await client.connect();
    await client.query('BEGIN');
    const result = await seed(client);
    await client.query('COMMIT');
    process.stdout.write(`${result.replayed ? 'Stage 1 drop table already applied' : `Stage 1 published with ${result.recommendations} user-supplied recommendations`}\n`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

module.exports = { seed };
if (require.main === module) main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
