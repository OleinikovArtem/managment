/* eslint-disable @typescript-eslint/no-require-imports */
const { execSync } = require("node:child_process");

function run(command) {
  execSync(command, { stdio: "inherit", env: process.env });
}

if (process.env.VERCEL_ENV === "production") {
  run("npx prisma migrate deploy");
  run("npx prisma db execute --file prisma/postgresql-constraints.sql");
  run("npx prisma db execute --file prisma/catalog-constraints.sql");
  run("node --experimental-strip-types scripts/seed-base-item-catalog.cjs");
  run("node scripts/seed-instance-catalog.cjs");
  run("node scripts/seed-bohpts-stage-one.cjs");
}

run("npx prisma generate");
run("npx next build");
