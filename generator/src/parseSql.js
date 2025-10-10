const fs = require("fs");

function stripComments(sql) {
  let out = '';
  let i = 0, n = sql.length;
  let inSingle = false, inDouble = false, inBacktick = false;

  while (i < n) {
    const c = sql[i];
    const c2 = sql[i + 1];

    // kilépések/átmenetek a string módokból
    if (!inDouble && !inBacktick && c === "'" && !inSingle) { inSingle = true; out += c; i++; continue; }
    if (inSingle) { out += c; if (c === "'" && sql[i - 1] !== "\\") inSingle = false; i++; continue; }

    if (!inSingle && !inBacktick && c === '"' && !inDouble) { inDouble = true; out += c; i++; continue; }
    if (inDouble) { out += c; if (c === '"' && sql[i - 1] !== "\\") inDouble = false; i++; continue; }

    if (!inSingle && !inDouble && c === '`' && !inBacktick) { inBacktick = true; out += c; i++; continue; }
    if (inBacktick) { out += c; if (c === '`') inBacktick = false; i++; continue; }

    // csak ha NEM vagyunk stringben/backtickben: kommentek eltávolítása
    if (!inSingle && !inDouble && !inBacktick) {
      // -- ... \n
      if (c === '-' && c2 === '-') {
        // phpMyAdmin dumpban a -- után szóköz is lehet; egészen sorvégéig dobd
        while (i < n && sql[i] !== '\n') i++;
        continue;
      }
      // /* ... */
      if (c === '/' && c2 === '*') {
        i += 2;
        while (i < n && !(sql[i] === '*' && sql[i + 1] === '/')) i++;
        i += 2;
        continue;
      }
    }

    out += c;
    i++;
  }

  return out.trim();
}


function parseDatabaseName(sql) {
  // USE `db-name`;
  let m = sql.match(/USE\s+`([^`]+)`\s*;/i);
  if (m) return m[1];
  // USE db_name;
  m = sql.match(/USE\s+([A-Za-z0-9_$-]+)\s*;/i);
  if (m) return m[1];

  // CREATE DATABASE `db-name`
  m = sql.match(/CREATE\s+DATABASE\s+`([^`]+)`/i);
  if (m) return m[1];
  // CREATE DATABASE db_name
  m = sql.match(/CREATE\s+DATABASE\s+([A-Za-z0-9_$-]+)/i);
  if (m) return m[1];

  return null;
}


// Csak CREATE TABLE blokkok
function parseCreateTableBlocks(sql) {
  const blocks = [];
  const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?([^\s`(]+)`?\s*\(/gim;
  let m;
  while ((m = re.exec(sql))) {
    const table = m[1];
    let i = re.lastIndex; // a nyitó "(" UTÁN vagyunk
    let depth = 1;
    let inSingle = false, inDouble = false, inBacktick = false;

    // gyűjtsük ki a záró )-ig (kiegyensúlyozva), stringek figyelésével
    while (i < sql.length && depth > 0) {
      const ch = sql[i];
      const ch2 = sql[i + 1];

      if (!inDouble && !inBacktick && ch === "'" && !inSingle) { inSingle = true; i++; continue; }
      if (inSingle) { if (ch === "'" && sql[i - 1] !== "\\") inSingle = false; i++; continue; }

      if (!inSingle && !inBacktick && ch === '"' && !inDouble) { inDouble = true; i++; continue; }
      if (inDouble) { if (ch === '"' && sql[i - 1] !== "\\") inDouble = false; i++; continue; }

      if (!inSingle && !inDouble && ch === '`' && !inBacktick) { inBacktick = true; i++; continue; }
      if (inBacktick) { if (ch === '`') inBacktick = false; i++; continue; }

      if (!inSingle && !inDouble && !inBacktick) {
        if (ch === '(') depth++;
        else if (ch === ')') depth--;
      }
      i++;
    }

    const body = sql.slice(re.lastIndex, i - 1); // a záró ) előtti tartalom

    // most engedjük a záró ) utáni táblabeállításokat a ;-ig
    let j = i;
    while (j < sql.length && sql[j] !== ';') j++;
    // const tableOptions = sql.slice(i, j);  // ha később kéne
    blocks.push({ table, body: body.trim() });

    // re.lastIndex-et toljuk a pontosvessző UTÁNRA, hogy a következő találatot jól kezdje
    re.lastIndex = j + 1;
  }
  return blocks;
}


// enum értékek kigyűjtése: ENUM('a','b',"c") -> ["a","b","c"]
function extractEnumValues(line) {
  const m = line.match(/\bENUM\s*\(([\s\S]*?)\)/i);
  if (!m) return null;
  const inside = m[1];
  const vals = [];
  const re = /'((?:\\'|[^'])*)'|"((?:\\"|[^"])*)"/g;
  let mm;
  while ((mm = re.exec(inside))) {
    const v = (mm[1] ?? mm[2]).replace(/\\'/g, "'").replace(/\\"/g, '"');
    vals.push(v);
  }
  return vals.length ? vals : null;
}

function parseColumnsAndConstraintsFromCreate(body) {
  const lines = body
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l.length && !l.startsWith("--"));

  const columns = [];
  const primaryKey = [];
  const foreignKeys = [];
  const uniqueKeys = [];
  const indexes = [];

  for (let raw of lines) {
    const line = raw.replace(/,+\s*$/, "");

    // Zaj sorok kiszűrése (NE szűrd a KEY/UNIQUE/INDEX sorokat!)
    if (/^(INSERT|ENGINE|CHARSET|COLLATE|ROW_FORMAT|COMMENT|PARTITION)\b/i.test(line)) {
      continue;
    }

    // Tábla-szintű PRIMARY KEY (...)
    if (/^PRIMARY\s+KEY/i.test(line)) {
      const cols = line.match(/\(([^)]+)\)/);
      if (cols) {
        cols[1]
          .split(",")
          .map((s) => s.replace(/[`'"]/g, "").trim())
          .forEach((c) => primaryKey.push(c));
      }
      continue;
    }

    // Tábla-szintű FOREIGN KEY (`col`) REFERENCES `table`(`id`)
    if ((/^CONSTRAINT\b/i.test(line) || /^FOREIGN\s+KEY\b/i.test(line)) && /FOREIGN\s+KEY/i.test(line)) {
      const colM = line.match(/FOREIGN\s+KEY\s*\(([^)]+)\)/i);
      const refM = line.match(/REFERENCES\s+`?(\w+)`?\s*\(`?(\w+)`?\)/i);
      if (colM && refM) {
        const cols = colM[1].replace(/[`]/g, "").split(/\s*,\s*/);
        foreignKeys.push({
          column: cols[0],
          references: { table: refM[1], column: refM[2] },
        });
      }
      continue;
    }

    // Tábla-szintű UNIQUE KEY `name` (`a`,`b`)
    if (/^(UNIQUE\s+KEY|UNIQUE\s+INDEX)\b/i.test(line)) {
      const name = (line.match(/^(?:UNIQUE\s+(?:KEY|INDEX))\s+`?(\w+)`?/i)?.[1]) || null;
      const colsMatch = line.match(/\(([^)]+)\)/);
      if (colsMatch) {
        const cols = colsMatch[1].split(",").map(s => s.replace(/[`'"]/g, "").trim());
        uniqueKeys.push({ name, columns: cols });
      }
      continue;
    }

    // Tábla-szintű sima INDEX/KEY `name` (`a`,`b`)
    if (/^(KEY|INDEX)\b/i.test(line)) {
      const name = (line.match(/^(?:KEY|INDEX)\s+`?(\w+)`?/i)?.[1]) || null;
      const colsMatch = line.match(/\(([^)]+)\)/);
      if (colsMatch) {
        const cols = colsMatch[1].split(",").map(s => s.replace(/[`'"]/g, "").trim());
        indexes.push({ name, columns: cols, unique: false });
      }
      continue;
    }

    // Oszlop definíció
    const colM = line.match(
  /^`?(\w+)`?\s+([A-Z]+(?:\s+[A-Z]+)?(?:\([^)]+\))?(?:\s+UNSIGNED)?(?:\s+ZEROFILL)?)/i
);
    if (colM) {
      const name = colM[1];
      const type = colM[2].replace(/\s+/g, " ").trim();
      const allowNull = !/\bNOT\s+NULL\b/i.test(line);
      const autoIncrement = /\bAUTO_INCREMENT\b/i.test(line);
      const unique = /\bUNIQUE\b/i.test(line);
      let def = null;
      const defM = line.match(/\bDEFAULT\s+([^,\s]+)/i);
      if (defM) def = defM[1].replace(/^['"]|['"]$/g, "");

      const enumValues = extractEnumValues(line);

      if (/\bPRIMARY\s+KEY\b/i.test(line)) primaryKey.push(name);

      columns.push({ name, type, allowNull, autoIncrement, unique, default: def, enumValues });
      continue;
    }
  }

  return { columns, primaryKey, foreignKeys, uniqueKeys, indexes };
}

// ALTER TABLE blokkok
function parseAlterTableBlocks(sql) {
  const blocks = [];
  const re = /ALTER\s+TABLE\s+`?(\w+)`?\s+([\s\S]*?)\s*;/gim;
  let m;
  while ((m = re.exec(sql))) {
    blocks.push({ table: m[1], body: m[2] });
  }
  return blocks;
}

function extractConstraintsFromAlter(body) {
  const pk = [];
  const fks = [];
  const uniqueKeys = [];
  const indexes = [];

  // ADD PRIMARY KEY (`a`,`b`)
  const pkRe = /ADD\s+PRIMARY\s+KEY\s*\(([^)]+)\)/gim;
  let pm;
  while ((pm = pkRe.exec(body))) {
    pm[1]
      .split(",")
      .map((s) => s.replace(/[`'"]/g, "").trim())
      .forEach((c) => pk.push(c));
  }

  // ADD CONSTRAINT ... FOREIGN KEY (`col`) REFERENCES `tab`(`id`)
  const fkRe = /ADD\s+CONSTRAINT\s+`?\w+`?\s+FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+`?(\w+)`?\s*\(`?(\w+)`?\)/gim;
  let fm;
  while ((fm = fkRe.exec(body))) {
    const cols = fm[1].split(",").map((s) => s.replace(/[`'"]/g, "").trim());
  fks.push({
  columns: cols,
  references: { table: fm[2], column: fm[3] }
});

  }

  // ADD UNIQUE KEY `name` (`a`,`b`)
  const ukRe = /ADD\s+UNIQUE\s+(?:KEY|INDEX)\s+`?(\w+)`?\s*\(([^)]+)\)/gim;
  let um;
  while ((um = ukRe.exec(body))) {
    const name = um[1];
    const cols = um[2].split(",").map((s) => s.replace(/[`'"]/g, "").trim());
    uniqueKeys.push({ name, columns: cols });
  }

  // ADD KEY/INDEX `name` (`a`,`b`)
  const idxRe = /ADD\s+(?:KEY|INDEX)\s+`?(\w+)`?\s*\(([^)]+)\)/gim;
  let im;
  while ((im = idxRe.exec(body))) {
    const name = im[1];
    const cols = im[2].split(",").map((s) => s.replace(/[`'"]/g, "").trim());
    indexes.push({ name, columns: cols, unique: false });
  }

  return { pk, fks, uniqueKeys, indexes };
}

function parseSchema(sqlRaw) {
  const sql = stripComments(sqlRaw);
  const database = parseDatabaseName(sql);

  // CREATE TABLE-k
  const createBlocks = parseCreateTableBlocks(sql);
  const tableMap = new Map();
  for (const { table, body } of createBlocks) {
    const { columns, primaryKey, foreignKeys, uniqueKeys, indexes } = parseColumnsAndConstraintsFromCreate(body);
    tableMap.set(table, { name: table, columns, primaryKey, foreignKeys, uniqueKeys, indexes });
  }

  // ALTER TABLE-k (PK/FK/UNIQUE/INDEX hozzáfűzés)
  const alterBlocks = parseAlterTableBlocks(sql);
  for (const { table, body } of alterBlocks) {
    const t = tableMap.get(table);
    if (!t) continue;
    const { pk, fks, uniqueKeys, indexes } = extractConstraintsFromAlter(body);
    if (pk.length) {
      const set = new Set([...(t.primaryKey || []), ...pk]);
      t.primaryKey = Array.from(set);
    }
    if (fks.length) {
      t.foreignKeys = [...(t.foreignKeys || []), ...fks];
    }
    if (uniqueKeys.length) {
      t.uniqueKeys = [...(t.uniqueKeys || []), ...uniqueKeys];
    }
    if (indexes.length) {
      t.indexes = [...(t.indexes || []), ...indexes];
    }
  }

  // Nézetek kiszűrése – több variáns kezelése
 const viewRegex =
  /CREATE\s+(?:OR\s+REPLACE\s+)?(?:ALGORITHM\s*=\s*\w+\s+)?(?:DEFINER\s*=\s*.*?\s+)?(?:SQL\s+SECURITY\s+\w+\s+)?VIEW\s+`?(\w+)`?/gim;
  let vm;
  while ((vm = viewRegex.exec(sql))) {
    tableMap.delete(vm[1]);
  }

  return { database, tables: Array.from(tableMap.values()) };
}

function main() {
  const input = process.argv[2];
  if (!input) {
    console.error("Használat: node src/parseSql.js <input.sql>");
    process.exit(1);
  }
  const sql = fs.readFileSync(input, "utf8");
  const schema = parseSchema(sql);
  process.stdout.write(JSON.stringify(schema, null, 2));
}

if (require.main === module) main();

module.exports = { parseSchema };
