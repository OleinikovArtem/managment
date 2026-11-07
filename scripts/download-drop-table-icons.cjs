/* eslint-disable @typescript-eslint/no-require-imports */
// One-time local asset import from the item icons embedded in a user-supplied table.
const fs = require("node:fs");
const path = require("node:path");

const [sourcePath, outputPath] = process.argv.slice(2);
if (!sourcePath || !outputPath) {
  throw new Error(
    "Usage: node scripts/download-drop-table-icons.cjs <table.html-or-md> <output-dir>",
  );
}

const slug = (name) =>
  name
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const source = fs.readFileSync(sourcePath, "utf8");
const rows = [...source.matchAll(/<tr>([\s\S]*?)<\/tr>/gi)];
const entries = [];
for (const [, row] of rows) {
  const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
  if (cells.length < 3) continue;
  const name = cells[0][1]
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#8203;|\u200b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const image = /(?:data-src|src)="([^"]+)"/i.exec(cells[0][1])?.[1];
  if (name && image && /^https:\/\//i.test(image)) entries.push({ name, image });
}

const seen = new Map();
fs.mkdirSync(outputPath, { recursive: true });
(async () => {
  for (const entry of entries) {
    const existing = seen.get(entry.image);
    if (existing) {
      process.stdout.write(`${entry.name}\t${existing}\t(reused)\n`);
      continue;
    }
    const response = await fetch(entry.image, { signal: AbortSignal.timeout(20000) });
    if (!response.ok)
      throw new Error(`Image request failed (${response.status}) for ${entry.name}`);
    const contentType = response.headers.get("content-type")?.split(";")[0].trim();
    const extension = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp" }[
      contentType
    ];
    if (!extension) throw new Error(`Unsupported image type ${contentType} for ${entry.name}`);
    const filename = `${slug(entry.name)}${extension}`;
    const target = path.join(outputPath, filename);
    fs.writeFileSync(target, Buffer.from(await response.arrayBuffer()), { flag: "wx" });
    seen.set(entry.image, filename);
    process.stdout.write(`${entry.name}\t${filename}\n`);
  }
})().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
