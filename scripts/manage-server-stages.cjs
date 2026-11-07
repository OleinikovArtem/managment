/* eslint-disable @typescript-eslint/no-require-imports */
// Administrative operation only; no user-facing endpoint. See docs/INSTANCE_CATALOG.md.
require("dotenv/config");
const fs = require("node:fs");
const { randomUUID, createHash } = require("node:crypto");
const { Client } = require("pg");
const text = (value, label, max = 200) => {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw Error(`Invalid ${label}`);
  return value.trim();
};
async function applyStageOperation(db, input, { manageTransaction = true } = {}) {
  const allowed = [
    "key",
    "actor",
    "stage",
    "recommendations",
    "publish",
    "isSelectable",
    "current",
    "expectedRevision",
    "sourceLabel",
    "confirmEmpty",
  ];
  if (Object.keys(input).some((key) => !allowed.includes(key)))
    throw Error("Unknown operation fields");
  const key = text(input.key, "key"),
    actor = text(input.actor, "actor");
  const hash = createHash("sha256")
    .update(JSON.stringify({ ...input, key: undefined, actor: undefined }))
    .digest("hex");
  if (manageTransaction) await db.query("BEGIN");
  try {
    await db.query("SELECT pg_advisory_xact_lock(715064,1)");
    const prior = (
      await db.query('SELECT "afterState" FROM "ServerStageAuditEvent" WHERE "idempotencyKey"=$1', [
        key,
      ])
    ).rows[0];
    if (prior) {
      if (prior.afterState.requestHash !== hash)
        throw Error("Idempotency key reused with different contents");
      await db.query("COMMIT");
      return { replayed: true };
    }
    await db.query(
      `INSERT INTO "ServerStageConfig" (id,"updatedAt") VALUES ('GLOBAL',now()) ON CONFLICT(id) DO NOTHING`,
    );
    await db.query(`SELECT id FROM "ServerStageConfig" WHERE id='GLOBAL' FOR UPDATE`);
    let stage = null,
      before = null;
    if (input.stage) {
      const { code, name, sequence } = input.stage;
      text(code, "stage.code");
      text(name, "stage.name");
      if (!Number.isInteger(sequence) || sequence < 1) throw Error("Invalid sequence");
      stage = (await db.query('SELECT * FROM "ServerStage" WHERE code=$1 FOR UPDATE', [code]))
        .rows[0];
      if (stage && input.expectedRevision !== stage.revision)
        throw Error("Stage revision conflict");
      if (!stage) {
        stage = (
          await db.query(
            `INSERT INTO "ServerStage" (id,code,name,sequence,"updatedAt") VALUES ($1,$2,$3,$4,now()) RETURNING *`,
            [randomUUID(), code, name, sequence],
          )
        ).rows[0];
      }
      before = {
        ...stage,
        recommendations: (
          await db.query(
            'SELECT "instanceId","itemId","sortOrder","sourceMetadata" FROM "InstanceStageLootRecommendation" WHERE "stageId"=$1 ORDER BY "instanceId","sortOrder","itemId"',
            [stage.id],
          )
        ).rows,
      };
      if (input.recommendations !== undefined) {
        if (!Array.isArray(input.recommendations) || input.recommendations.length > 20000)
          throw Error("Invalid recommendations");
        if (!input.recommendations.length && !input.confirmEmpty)
          throw Error("Empty set requires confirmEmpty=true");
        const data = [],
          seen = new Set();
        for (const row of input.recommendations) {
          if (
            Object.keys(row).some(
              (field) => !["instanceCode", "itemId", "sortOrder", "sourceMetadata"].includes(field),
            )
          )
            throw Error("Unknown recommendation fields");
          if (!Number.isInteger(row.sortOrder) || row.sortOrder < 0)
            throw Error("Invalid sortOrder");
          const instance = (
            await db.query(
              'SELECT id FROM "Instance" WHERE code=$1 AND "partyId" IS NULL AND "isActive"',
              [text(row.instanceCode, "instanceCode")],
            )
          ).rows[0];
          const item = (
            await db.query(
              'SELECT id FROM "Item" WHERE id=$1 AND "partyId" IS NULL AND "isActive"',
              [text(row.itemId, "itemId")],
            )
          ).rows[0];
          if (!instance || !item) throw Error("Unknown, private or archived catalog reference");
          const identity = `${instance.id}/${item.id}`;
          if (seen.has(identity)) throw Error("Duplicate instance/item recommendation");
          seen.add(identity);
          data.push({
            instanceId: instance.id,
            itemId: item.id,
            sortOrder: row.sortOrder,
            sourceMetadata: row.sourceMetadata ?? null,
          });
        }
        data.sort(
          (a, b) =>
            a.instanceId.localeCompare(b.instanceId) ||
            a.sortOrder - b.sortOrder ||
            a.itemId.localeCompare(b.itemId),
        );
        if (JSON.stringify(data) !== JSON.stringify(before.recommendations)) {
          await db.query('DELETE FROM "InstanceStageLootRecommendation" WHERE "stageId"=$1', [
            stage.id,
          ]);
          for (const row of data)
            await db.query(
              'INSERT INTO "InstanceStageLootRecommendation" (id,"instanceId","stageId","itemId","sortOrder","sourceMetadata","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,now())',
              [
                randomUUID(),
                row.instanceId,
                stage.id,
                row.itemId,
                row.sortOrder,
                row.sourceMetadata,
              ],
            );
          stage.revision++;
        }
      }
      if (
        input.publish &&
        input.recommendations === undefined &&
        !(
          await db.query(
            'SELECT 1 FROM "InstanceStageLootRecommendation" WHERE "stageId"=$1 LIMIT 1',
            [stage.id],
          )
        ).rows.length &&
        !input.confirmEmpty
      )
        throw Error("Publication of empty recommendations requires confirmEmpty=true");
      if (input.publish !== undefined && typeof input.publish !== "boolean")
        throw Error("Invalid publish flag");
      if (input.isSelectable !== undefined && typeof input.isSelectable !== "boolean")
        throw Error("Invalid selectable flag");
    } else if (
      input.recommendations !== undefined ||
      input.publish !== undefined ||
      input.isSelectable !== undefined
    )
      throw Error("Stage required");
    async function setCurrent() {
      if (input.current === undefined) return;
      let target = null;
      if (input.current !== "auto") {
        target = (
          await db.query(
            'SELECT id FROM "ServerStage" WHERE code=$1 AND "publishedAt" IS NOT NULL AND "isSelectable"',
            [text(input.current, "current")],
          )
        ).rows[0]?.id;
        if (!target) throw Error("Current stage must be published and selectable");
      }
      await db.query(
        `UPDATE "ServerStageConfig" SET "explicitCurrentStageId"=$1,revision=revision+1,"updatedAt"=now() WHERE id='GLOBAL'`,
        [target],
      );
    }
    if (input.isSelectable === false) await setCurrent();
    if (stage) {
      const selectable = input.isSelectable ?? (input.publish ? true : stage.isSelectable);
      const publishedAt = stage.publishedAt ?? (input.publish ? new Date() : null);
      if (selectable && !publishedAt) throw Error("Cannot select unpublished stage");
      const metadataChanged =
        stage.name !== input.stage.name ||
        stage.sequence !== input.stage.sequence ||
        stage.isSelectable !== selectable ||
        Boolean(stage.publishedAt) !== Boolean(publishedAt);
      if (metadataChanged) stage.revision++;
      stage = (
        await db.query(
          'UPDATE "ServerStage" SET name=$2,sequence=$3,"isSelectable"=$4,"publishedAt"=$5,revision=$6,"updatedAt"=now() WHERE id=$1 RETURNING *',
          [
            stage.id,
            input.stage.name,
            input.stage.sequence,
            selectable,
            publishedAt,
            stage.revision,
          ],
        )
      ).rows[0];
    }
    if (input.isSelectable !== false) await setCurrent();
    const after = {
      requestHash: hash,
      stage,
      recommendations: stage
        ? (
            await db.query(
              'SELECT "instanceId","itemId","sortOrder","sourceMetadata" FROM "InstanceStageLootRecommendation" WHERE "stageId"=$1 ORDER BY "instanceId","sortOrder","itemId"',
              [stage.id],
            )
          ).rows
        : [],
      config: (await db.query(`SELECT * FROM "ServerStageConfig" WHERE id='GLOBAL'`)).rows[0],
    };
    await db.query(
      'INSERT INTO "ServerStageAuditEvent" (id,"stageId",action,actor,"sourceLabel","idempotencyKey","beforeState","afterState") VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [
        randomUUID(),
        stage?.id ?? null,
        input.publish ? "PUBLISH" : stage ? "UPDATE" : "CURRENT",
        actor,
        input.sourceLabel ?? null,
        key,
        before,
        after,
      ],
    );
    if (manageTransaction) await db.query("COMMIT");
    return { stage: stage?.code ?? null, revision: stage?.revision ?? null };
  } catch (error) {
    if (manageTransaction) await db.query("ROLLBACK");
    throw error;
  }
}
module.exports = { applyStageOperation };
if (require.main === module)
  (async () => {
    const filename = process.argv[2];
    if (!filename) throw Error("Usage: node scripts/manage-server-stages.cjs <operation.json>");
    const input = JSON.parse(fs.readFileSync(filename, "utf8").replace(/^\uFEFF/, ""));
    const db = new Client({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL });
    try {
      await db.connect();
      process.stdout.write(JSON.stringify(await applyStageOperation(db, input)) + "\n");
    } finally {
      await db.end();
    }
  })().catch((error) => {
    process.stderr.write(error.message + "\n");
    process.exitCode = 1;
  });
