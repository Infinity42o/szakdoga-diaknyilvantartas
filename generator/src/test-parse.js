const fs = require("fs");
const path = require("path");
const { parseSchema } = require("./parseSql");

function read(sqlFile) {
  const sql = fs.readFileSync(sqlFile, "utf8");
  return parseSchema(sql, sqlFile);
}

function assert(cond, msg) {
  if (!cond) {
    console.error("❌", msg);
    process.exit(1);
  }
}

(function main(){
  const fx = path.resolve(__dirname, "../fixtures");

  // 1) composite
  const s1 = read(path.join(fx, "composite_keys.sql"));
  const A = s1.tables.find(t => t.name === "A");
  const B = s1.tables.find(t => t.name === "B");
  assert(A && B, "A és B táblák megvannak");
  assert(A.primaryKey.length === 2, "A: összetett PK (2 oszlop)");
  assert(B.foreignKeys.length === 1, "B: van 1 FK");
  assert(B.foreignKeys[0].columns.length === 2, "B: összetett FK (2 oszlop)");

  // 2) unique/index
  const s2 = read(path.join(fx, "unique_index.sql"));
  const U = s2.tables.find(t => t.name === "U");
  assert(U.uniqueKeys.some(u => (u.name === "uq_email") && u.columns.includes("email")), "U: uq_email UNIQUE");
  assert(U.indexes.some(i => (i.name === "ix_email_prefix") && i.columns.includes("email")), "U: ix_email_prefix INDEX");

  // 3) enum/defaults/comment
  const s3 = read(path.join(fx, "enums_defaults.sql"));
  const E = s3.tables.find(t => t.name === "E");
  const colNem = E.columns.find(c => c.name === "nem");
  assert(colNem && Array.isArray(colNem.enumValues) && colNem.enumValues.length === 3, "E.nem: ENUM 3 értékkel");
  const created = E.columns.find(c => c.name === "created_at");
  assert(created && created.default && created.onUpdate, "E.created_at: DEFAULT és ON UPDATE kiolvasva");
  const note = E.columns.find(c => c.name === "note");
  assert(note && note.comment === "megjegyzes", "E.note: COMMENT kiolvasva");

  console.log("✅ test-parse: minden OK");
})();
