const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
require("dotenv").config();

function ensureDir(p){ fs.mkdirSync(p,{recursive:true}); }

function groupPush(map, key, v){ if(!map.has(key)) map.set(key,[]); map.get(key).push(v); }

(async function main(){
  const DB_HOST = process.env.DB_HOST || "localhost";
  const DB_USER = process.env.DB_USER || "root";
  const DB_PASS = process.env.DB_PASS || "";
  const DB_NAME = process.env.DB_NAME;
  const DB_PORT = Number(process.env.DB_PORT || 3306);

  if(!DB_NAME){ console.error("❌ .env DB_NAME hiányzik"); process.exit(1); }

  const outDir = path.resolve(__dirname, "./out");
  ensureDir(outDir);
  const outFile = path.join(outDir, "schema.json");

  const conn = await mysql.createConnection({host:DB_HOST,user:DB_USER,password:DB_PASS,port:DB_PORT,database:DB_NAME});

  const [tables] = await conn.execute(`
    SELECT TABLE_NAME, TABLE_TYPE, TABLE_COMMENT
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = ?`, [DB_NAME]);

  const [cols] = await conn.execute(`
    SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, DATA_TYPE, IS_NULLABLE,
           COLUMN_DEFAULT, EXTRA, COLUMN_COMMENT, ORDINAL_POSITION
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = ?
    ORDER BY TABLE_NAME, ORDINAL_POSITION`, [DB_NAME]);

  const [tc] = await conn.execute(`
    SELECT CONSTRAINT_NAME, TABLE_NAME, CONSTRAINT_TYPE
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = ?`, [DB_NAME]);

  const [kcu] = await conn.execute(`
    SELECT CONSTRAINT_NAME, TABLE_NAME, COLUMN_NAME, ORDINAL_POSITION,
           REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = ?
    ORDER BY TABLE_NAME, CONSTRAINT_NAME, ORDINAL_POSITION`, [DB_NAME]);

  const [stats] = await conn.execute(`
    SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, COLUMN_NAME, SEQ_IN_INDEX
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = ?
    ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`, [DB_NAME]);

  await conn.end();

  const tableMap = new Map();
  for (const t of tables) {
    if (t.TABLE_TYPE === "VIEW") continue;
    tableMap.set(t.TABLE_NAME, {
      name: t.TABLE_NAME,
      comment: t.TABLE_COMMENT || null,
      columns: [],
      primaryKey: [],
      foreignKeys: [],
      uniqueKeys: [],
      indexes: []
    });
  }

  for (const c of cols) {
    const t = tableMap.get(c.TABLE_NAME);
    if (!t) continue;

    let enumValues = null;
    if (c.DATA_TYPE.toLowerCase() === "enum") {
      const m = c.COLUMN_TYPE.match(/^enum\((.*)\)$/i);
      if (m) {
        enumValues = m[1].split(",").map(s => s.trim().replace(/^'|^"|'$|"$/g,"").replace(/^'|["']$/g,""));
        enumValues = m[1].split(",").map(s => s.trim().replace(/^['"]|['"]$/g,"")); // tisztább
      }
    }

    t.columns.push({
      name: c.COLUMN_NAME,
      type: c.COLUMN_TYPE,
      allowNull: c.IS_NULLABLE === "YES",
      autoIncrement: (c.EXTRA || "").toLowerCase().includes("auto_increment"),
      unique: false, // majd constraints/indexek alapján
      default: c.COLUMN_DEFAULT,
      onUpdate: (c.EXTRA || "").toLowerCase().includes("on update") ? "CURRENT_TIMESTAMP" : null,
      enumValues,
      comment: c.COLUMN_COMMENT || null
    });
  }

  const consByTable = new Map();
  for (const row of tc) groupPush(consByTable, row.TABLE_NAME, row);

  const kcuByTableCons = new Map();
  for (const row of kcu) groupPush(kcuByTableCons, `${row.TABLE_NAME}::${row.CONSTRAINT_NAME}`, row);

  for (const [tableName, cons] of consByTable.entries()) {
    const t = tableMap.get(tableName);
    if (!t) continue;

    for (const con of cons) {
      const parts = (kcuByTableCons.get(`${tableName}::${con.CONSTRAINT_NAME}`) || [])
        .sort((a,b) => a.ORDINAL_POSITION - b.ORDINAL_POSITION);

      if (con.CONSTRAINT_TYPE === "PRIMARY KEY") {
        t.primaryKey = parts.map(p => p.COLUMN_NAME);
      } else if (con.CONSTRAINT_TYPE === "UNIQUE") {
        t.uniqueKeys.push({ name: con.CONSTRAINT_NAME, columns: parts.map(p => p.COLUMN_NAME) });
        if (parts.length === 1) {
          const col = t.columns.find(c => c.name === parts[0].COLUMN_NAME);
          if (col) col.unique = true;
        }
      } else if (con.CONSTRAINT_TYPE === "FOREIGN KEY") {
        t.foreignKeys.push({
          columns: parts.map(p => p.COLUMN_NAME),
          references: {
            table: parts[0]?.REFERENCED_TABLE_NAME || null,
            columns: parts.map(p => p.REFERENCED_COLUMN_NAME)
          }
        });
      }
    }
  }

  const idxByTable = new Map();
  for (const s of stats) {
    if (s.INDEX_NAME === "PRIMARY") continue;
    groupPush(idxByTable, s.TABLE_NAME, s);
  }
  for (const [tableName, rows] of idxByTable.entries()) {
    const t = tableMap.get(tableName);
    if (!t) continue;
    const byName = new Map();
    for (const r of rows) groupPush(byName, r.INDEX_NAME, r);

    for (const [ixName, parts] of byName.entries()) {
      const ordered = parts.sort((a,b) => a.SEQ_IN_INDEX - b.SEQ_IN_INDEX);
      t.indexes.push({
        name: ixName,
        columns: ordered.map(p => p.COLUMN_NAME),
        unique: ordered[0].NON_UNIQUE === 0
      });
    }
  }

  const schema = { database: DB_NAME, tables: Array.from(tableMap.values()) };
  fs.writeFileSync(outFile, JSON.stringify(schema, null, 2), "utf8");
  console.log("✅ Kész:", path.relative(process.cwd(), outFile));
})();
