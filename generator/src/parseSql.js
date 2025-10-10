const fs = require("fs");

function stripComments(sql) {
  let out = '';
  let i = 0, n = sql.length;
  let inSingle = false, inDouble = false, inBacktick = false;

  while (i < n) {
    const c = sql[i];
    const c2 = sql[i + 1];

    // kilĂ„â€šĂ‚Â©pĂ„â€šĂ‚Â©sek/Ă„â€šĂ‹â€ˇtmenetek a string mĂ„â€šÄąâ€šdokbĂ„â€šÄąâ€šl
    if (!inDouble && !inBacktick && c === "'" && !inSingle) { inSingle = true; out += c; i++; continue; }
    if (inSingle) { out += c; if (c === "'" && sql[i - 1] !== "\\") inSingle = false; i++; continue; }

    if (!inSingle && !inBacktick && c === '"' && !inDouble) { inDouble = true; out += c; i++; continue; }
    if (inDouble) { out += c; if (c === '"' && sql[i - 1] !== "\\") inDouble = false; i++; continue; }

    if (!inSingle && !inDouble && c === '`' && !inBacktick) { inBacktick = true; out += c; i++; continue; }
    if (inBacktick) { out += c; if (c === '`') inBacktick = false; i++; continue; }

    // csak ha NEM vagyunk stringben/backtickben: kommentek eltĂ„â€šĂ‹â€ˇvolĂ„â€šĂ‚Â­tĂ„â€šĂ‹â€ˇsa
    if (!inSingle && !inDouble && !inBacktick) {
      // -- ... \n
      if (c === '-' && c2 === '-') {
        // phpMyAdmin dumpban a -- utĂ„â€šĂ‹â€ˇn szĂ„â€šÄąâ€škĂ„â€šĂ‚Â¶z is lehet; egĂ„â€šĂ‚Â©szen sorvĂ„â€šĂ‚Â©gĂ„â€šĂ‚Â©ig dobd
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
  // CREATE DATABASE [IF NOT EXISTS] `name`
  const mCreate = sql.match(/CREATE\s+DATABASE(?:\s+IF\s+NOT\s+EXISTS)?\s+`?([A-Za-z0-9_]+)`?/i);
  if (mCreate) return mCreate[1];

  // USE `name`;
  const mUse = sql.match(/\bUSE\s+`?([A-Za-z0-9_]+)`?\s*;/i);
  if (mUse) return mUse[1];

  return null;
}


// Csak CREATE TABLE blokkok
function parseCreateTableBlocks(sql) {
  const blocks = [];
  const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?([^\s`(]+)`?\s*\(/gim;
  let m;
  while ((m = re.exec(sql))) {
    const table = m[1];
    let i = re.lastIndex; // a nyitĂ„â€šÄąâ€š "(" UTĂ„â€šĂ‚ÂN vagyunk
    let depth = 1;
    let inSingle = false, inDouble = false, inBacktick = false;

    // gyĂ„Ä…Ă‚Â±jtsĂ„â€šĂ„Ëťk ki a zĂ„â€šĂ‹â€ˇrĂ„â€šÄąâ€š )-ig (kiegyensĂ„â€šÄąĹşlyozva), stringek figyelĂ„â€šĂ‚Â©sĂ„â€šĂ‚Â©vel
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

    const body = sql.slice(re.lastIndex, i - 1); // a zĂ„â€šĂ‹â€ˇrĂ„â€šÄąâ€š ) elĂ„Ä…Ă˘â‚¬Âtti tartalom

    // most engedjĂ„â€šĂ„Ëťk a zĂ„â€šĂ‹â€ˇrĂ„â€šÄąâ€š ) utĂ„â€šĂ‹â€ˇni tĂ„â€šĂ‹â€ˇblabeĂ„â€šĂ‹â€ˇllĂ„â€šĂ‚Â­tĂ„â€šĂ‹â€ˇsokat a ;-ig
    let j = i;
    while (j < sql.length && sql[j] !== ';') j++;
    // const tableOptions = sql.slice(i, j);  // ha kĂ„â€šĂ‚Â©sĂ„Ä…Ă˘â‚¬Âbb kĂ„â€šĂ‚Â©ne
    blocks.push({ table, body: body.trim() });

    // re.lastIndex-et toljuk a pontosvesszĂ„Ä…Ă˘â‚¬Â UTĂ„â€šĂ‚ÂNRA, hogy a kĂ„â€šĂ‚Â¶vetkezĂ„Ä…Ă˘â‚¬Â talĂ„â€šĂ‹â€ˇlatot jĂ„â€šÄąâ€šl kezdje
    re.lastIndex = j + 1;
  }
  return blocks;
}


// enum Ă„â€šĂ‚Â©rtĂ„â€šĂ‚Â©kek kigyĂ„Ä…Ă‚Â±jtĂ„â€šĂ‚Â©se: ENUM('a','b',"c") -> ["a","b","c"]
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

  for (let raw of lines) {
    const line = raw.replace(/,+\s*$/, "");

    // TÄ‚Ë‡bla-szintÄąÂ± PRIMARY KEY
    if (/^PRIMARY\s+KEY\b/i.test(line)) {
      const cols = line.match(/\(([^)]+)\)/);
      if (cols) {
        cols[1]
          .split(",")
          .map((s) => s.replace(/[`'"]/g, "").trim())
          .forEach((c) => primaryKey.push(c));
      }
      continue;
    }

    // TÄ‚Ë‡bla-szintÄąÂ± FOREIGN KEY
    if ((/^CONSTRAINT\b/i.test(line) || /^FOREIGN\s+KEY\b/i.test(line)) && /FOREIGN\s+KEY/i.test(line)) {
      const colM = line.match(/FOREIGN\s+KEY\s*\(([^)]+)\)/i);
      const refM = line.match(/REFERENCES\s+`?(\w+)`?\s*\(`?(\w+)`?\)/i);
      if (colM && refM) {
        const cols = colM[1].split(",").map(s => s.replace(/[`'"]/g,"").trim());
        foreignKeys.push({
          column: cols[0],
          references: { table: refM[1], column: refM[2] },
        });
      }
      continue;
    }

    // Oszlop definÄ‚Â­ciÄ‚Ĺ‚ felismerÄ‚Â©se: <name> <type...> [constraint-ek...]
    const head = line.match(/^`?(\w+)`?\s+(.+)$/);
    if (head) {
      const name = head[1];
      const tail = head[2];

      // ENUM Ä‚Â©rtÄ‚Â©kek
      let enumValues = null;
      const enumM = tail.match(/\bENUM\s*\(([^)]+)\)/i);
      if (enumM) {
        enumValues = enumM[1]
          .split(",")
          .map(s => s.trim().replace(/^['"]|['"]$/g,""));
      }

      // TÄ‚Â­pus: mindent a DEFAULT/NOT NULL/NULL/UNIQUE/AUTO_INCREMENT/COMMENT elÄąâ€tt
      const typeOnly = (tail
        .split(/\bNOT\s+NULL\b|\bNULL\b|\bDEFAULT\b|\bUNIQUE\b|\bAUTO_INCREMENT\b|\bCOMMENT\b/i)[0] || "")
        .trim();

      const allowNull = !/\bNOT\s+NULL\b/i.test(tail);
      const autoIncrement = /\bAUTO_INCREMENT\b/i.test(tail);
      const unique = /\bUNIQUE\b/i.test(tail);

      let def = null;
      const defM = tail.match(/\bDEFAULT\s+((?:'[^']*')|(?:"[^"]*")|(?:[^,\s]+))/i);
      if (defM) def = defM[1].replace(/^['"]|['"]$/g, "");

      // Inline PRIMARY KEY
      if (/\bPRIMARY\s+KEY\b/i.test(tail)) primaryKey.push(name);

      columns.push({
        name,
        type: typeOnly.replace(/\s+/g," ").trim(),
        allowNull,
        autoIncrement,
        unique,
        default: def,
        enumValues
      });
      continue;
    }
  }

  return { columns, primaryKey, foreignKeys };
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

  // ALTER TABLE-k (PK/FK/UNIQUE/INDEX hozzĂ„â€šĂ‹â€ˇfĂ„Ä…Ă‚Â±zĂ„â€šĂ‚Â©s)
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

  // NĂ„â€šĂ‚Â©zetek kiszĂ„Ä…Ă‚Â±rĂ„â€šĂ‚Â©se Ä‚ËĂ˘â€šÂ¬Ă˘â‚¬Ĺ› tĂ„â€šĂ‚Â¶bb variĂ„â€šĂ‹â€ˇns kezelĂ„â€šĂ‚Â©se
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

  // Fallback: ha a regex nem talál DB nevet, próbáljuk a fájlnévből
  if (!schema.database) {
    try {
      const p = require("path");
      const base = p.basename(input, ".sql");
      if (/^[A-Za-z0-9_]+$/.test(base)) {
        schema.database = base;
      }
    } catch (e) { /* no-op */ }
  }

  process.stdout.write(JSON.stringify(schema, null, 2));
}

if (require.main === module) main();module.exports = { parseSchema };
