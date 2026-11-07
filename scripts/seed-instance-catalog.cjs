/* eslint-disable @typescript-eslint/no-require-imports */
require("dotenv/config");
const { Client } = require("pg");
const { randomUUID } = require("node:crypto");
const instances = require("../prisma/seeds/instances.json");
async function seed(client) {
  for (const [code, name, displayName, source, category, aliases] of instances) {
    await client.query(
      `INSERT INTO "Instance" (id,code,name,"displayName","normalizedName",source,category,aliases,"updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now()) ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,"displayName"=EXCLUDED."displayName",aliases=EXCLUDED.aliases,category=EXCLUDED.category,"updatedAt"=now() WHERE "Instance"."partyId" IS NULL`,
      [
        randomUUID(),
        code,
        name,
        displayName,
        displayName.normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase(),
        source,
        category,
        aliases,
      ],
    );
  }
  await client.query(
    `INSERT INTO "ServerStageConfig" (id,"updatedAt") VALUES ('GLOBAL',now()) ON CONFLICT(id) DO NOTHING`,
  );
}
async function main() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  });
  try {
    await client.connect();
    await client.query("BEGIN");
    await seed(client);
    await client.query("COMMIT");
    process.stdout.write(
      `Instance catalog ready: ${instances.length} codes; no loot or stages published.\n`,
    );
  } finally {
    await client.end();
  }
}
module.exports = { seed };
if (require.main === module)
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
