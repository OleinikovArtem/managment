/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("node:path");
require("dotenv/config");

const Database = require("better-sqlite3");
const { Pool } = require("pg");

function resolveSqlitePath(url) {
  if (!url?.startsWith("file:")) {
    throw new Error("LEGACY_SQLITE_URL must point to the existing SQLite database.");
  }
  const relativePath = decodeURIComponent(url.slice("file:".length).split("?")[0]);
  return path.resolve(process.cwd(), relativePath);
}

async function main() {
  const sourcePath = resolveSqlitePath(process.env.LEGACY_SQLITE_URL || "file:./prisma/dev.db");
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString?.startsWith("postgresql://") && !connectionString?.startsWith("postgres://")) {
    throw new Error("DATABASE_URL must point to the new PostgreSQL database.");
  }

  const source = new Database(sourcePath, { readonly: true, fileMustExist: true });
  const pool = new Pool({ connectionString });
  const items = source.prepare(`
    SELECT id, canonicalName, normalizedName, displayName, category, grade,
           itemType, itemSubtype, isRare, gameVersion, comment, createdAt, updatedAt
    FROM Item
    ORDER BY updatedAt ASC, id ASC
  `).all();
  source.close();

  if (items.length === 0) {
    await pool.end();
    throw new Error("The SQLite catalog is empty; nothing was imported.");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const item of items) {
      await client.query(
        `INSERT INTO "Item" (
          id, "canonicalName", "normalizedName", "displayName", category,
          grade, "itemType", "itemSubtype", "isRare", "gameVersion", comment,
          "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::timestamp, $13::timestamp
        )
        ON CONFLICT ("normalizedName") DO UPDATE SET
          "canonicalName" = EXCLUDED."canonicalName",
          "displayName" = EXCLUDED."displayName",
          category = EXCLUDED.category,
          grade = EXCLUDED.grade,
          "itemType" = EXCLUDED."itemType",
          "itemSubtype" = EXCLUDED."itemSubtype",
          "isRare" = EXCLUDED."isRare",
          "gameVersion" = EXCLUDED."gameVersion",
          comment = EXCLUDED.comment,
          "updatedAt" = EXCLUDED."updatedAt"
        `,
        [
          item.id,
          item.canonicalName,
          item.normalizedName,
          item.displayName,
          item.category,
          item.grade,
          item.itemType,
          item.itemSubtype,
          Boolean(item.isRare),
          item.gameVersion,
          item.comment,
          item.createdAt,
          item.updatedAt,
        ],
      );
    }
    await client.query("COMMIT");
    console.log(`Imported ${items.length} catalog rows from ${sourcePath}.`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
