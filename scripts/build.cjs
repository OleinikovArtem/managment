/* eslint-disable @typescript-eslint/no-require-imports */
const { execSync } = require("node:child_process");

function run(command) {
  execSync(command, { stdio: "inherit", env: process.env });
}

if (process.env.VERCEL_ENV === "production") {
  run("npx prisma migrate deploy");
  run("npx prisma db execute --file prisma/postgresql-constraints.sql");
}

run("npx prisma generate");
run("npx next build");
