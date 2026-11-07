/* eslint-disable @typescript-eslint/no-require-imports */
require('dotenv/config');
const {Client}=require('pg');
const {randomUUID}=require('node:crypto');
const {classifyHighFiveItem}=require('../src/server/bootstrap/high-five-item-classification.ts');
const dump=require('../prisma/seeds/lineage2-high-five-items.json');
const userDrop=require('../prisma/seeds/bohpts-stage-1-loot.json');
const suppliedItems=Object.values(userDrop.sources).flatMap(source=>source.items)
 .map(item=>({canonicalName:item.name,category:item.category}))
 .filter((item,index,all)=>all.findIndex(candidate=>candidate.canonicalName===item.canonicalName)===index)
 .filter(item=>!dump.items.some(candidate=>candidate.canonicalName===item.canonicalName));
const items=[...dump.items,...suppliedItems];
async function seed(db){
 let count=0;
 for(const item of items){
  const c=classifyHighFiveItem(item);
  const result=await db.query(`INSERT INTO "Item" (id,"canonicalName","normalizedName",category,grade,"itemType","itemSubtype","isRare","gameVersion","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now()) ON CONFLICT ("normalizedName") WHERE "partyId" IS NULL DO NOTHING`,[randomUUID(),item.canonicalName,item.canonicalName.normalize('NFC').trim().replace(/\s+/gu,' ').toLowerCase(),c.category,c.grade,c.itemType,c.itemSubtype,c.isRare,dump.gameVersion]);
  count+=result.rowCount;
 }
 return count;
}
module.exports={seed};
if(require.main===module)(async()=>{const db=new Client({connectionString:process.env.DIRECT_URL??process.env.DATABASE_URL});try{await db.connect();await db.query('BEGIN');const count=await seed(db);await db.query('COMMIT');process.stdout.write(`Shared catalog: ${count} missing items inserted; existing rows preserved.\n`);}finally{await db.end();}})().catch(error=>{process.stderr.write(error.message+'\n');process.exitCode=1;});
