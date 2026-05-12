const fs = require("fs");

function stripComments(sql) {
  let out = '';
  let i = 0, n = sql.length;
  let inSingle = false, inDouble = false, inBacktick = false;

  while (i < n) {
    const c = sql[i];
    const c2 = sql[i + 1];

    if (!inDouble && !inBacktick && c === "'" && !inSingle) { inSingle = true; out += c; i++; continue; }
    if (inSingle) { out += c; if (c === "'" && sql[i - 1] !== "\\") inSingle = false; i++; continue; }

    if (!inSingle && !inBacktick && c === '"' && !inDouble) { inDouble = true; out += c; i++; continue; }
    if (inDouble) { out += c; if (c === '"' && sql[i - 1] !== "\\") inDouble = false; i++; continue; }

    if (!inSingle && !inDouble && c === '`' && !inBacktick) { inBacktick = true; out += c; i++; continue; }
    if (inBacktick) { out += c; if (c === '`') inBacktick = false; i++; continue; }

    if (!inSingle && !inDouble && !inBacktick) {
      // -- ... \n
      if (c === '-' && c2 === '-') {
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
    let i = re.lastIndex; 
    let depth = 1;
    let inSingle = false, inDouble = false, inBacktick = false;

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

    const body = sql.slice(re.lastIndex, i - 1); 

    let j = i;
    while (j < sql.length && sql[j] !== ';') j++;
    blocks.push({ table, body: body.trim() });

    re.lastIndex = j + 1;
  }
  return blocks;
}


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
  const rawLines = body
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l.length && !l.startsWith("--"));

  // Többsoros CONSTRAINT / FOREIGN KEY definíciók összefűzése
  const lines = [];
  for (const raw of rawLines) {
    const line = raw.replace(/,+\s*$/, "");

    if (!lines.length) {
      lines.push(line);
      continue;
    }

    const prev = lines[lines.length - 1];

    const isContinuation =
      /^FOREIGN\s+KEY\b/i.test(line) ||
      /^REFERENCES\b/i.test(line) ||
      /^ON\s+DELETE\b/i.test(line) ||
      /^ON\s+UPDATE\b/i.test(line);

    const prevStartsConstraint = /^CONSTRAINT\b/i.test(prev);
    const prevHasFk = /FOREIGN\s+KEY/i.test(prev);

    if (
      (prevStartsConstraint && isContinuation) ||
      (prevHasFk &&
        (/^REFERENCES\b/i.test(line) || /^ON\s+(DELETE|UPDATE)\b/i.test(line)))
    ) {
      lines[lines.length - 1] += " " + line;
    } else {
      lines.push(line);
    }
  }

  const columns = [];
  const primaryKey = [];
  const foreignKeys = []; // { columns:[], references:{ table, columns:[] } }
  const uniqueKeys = [];  // { name: string|null, columns:[] }
  const indexes = [];     // { name: string|null, columns:[], unique: boolean }

  for (let raw of lines) {
    const line = raw.replace(/,+\s*$/, "");

    // PRIMARY KEY (`a`,`b`)
    if (/^PRIMARY\s+KEY\b/i.test(line)) {
      const m = line.match(/\(([^)]+)\)/);
      if (m) {
        m[1]
          .split(",")
          .map((s) => s.replace(/[`'"]/g, "").trim())
          .forEach((c) => primaryKey.push(c));
      }
      continue;
    }

    // UNIQUE KEY / UNIQUE INDEX
    if (/^(UNIQUE\s+KEY|UNIQUE\s+INDEX)\b/i.test(line)) {
      const nameM = line.match(/^(?:UNIQUE\s+(?:KEY|INDEX))\s+`?(\w+)`?/i);
      const colsM = line.match(/\(([^)]+)\)/);
      uniqueKeys.push({
        name: nameM ? nameM[1] : null,
        columns: colsM
          ? colsM[1].split(",").map((s) => s.replace(/[`'"]/g, "").trim())
          : [],
      });
      continue;
    }

    // sima KEY / INDEX
    if (/^(KEY|INDEX)\b/i.test(line)) {
      const nameM = line.match(/^(?:KEY|INDEX)\s+`?(\w+)`?/i);
      const colsM = line.match(/\(([^)]+)\)/);
      indexes.push({
        name: nameM ? nameM[1] : null,
        columns: colsM
          ? colsM[1].split(",").map((s) => s.replace(/[`'"]/g, "").trim())
          : [],
        unique: false,
      });
      continue;
    }

    // FOREIGN KEY (...) REFERENCES tab (...)
    if (
      (/^CONSTRAINT\b/i.test(line) || /^FOREIGN\s+KEY\b/i.test(line)) &&
      /FOREIGN\s+KEY/i.test(line)
    ) {
      const colsM = line.match(/FOREIGN\s+KEY\s*\(([^)]+)\)/i);
      const refM = line.match(/REFERENCES\s+`?(\w+)`?\s*\(([^)]+)\)/i);
      if (colsM && refM) {
        const cols = colsM[1]
          .split(",")
          .map((s) => s.replace(/[`'"]/g, "").trim())
          .filter(Boolean);
        const refCols = refM[2]
          .split(",")
          .map((s) => s.replace(/[`'"]/g, "").trim())
          .filter(Boolean);

        foreignKeys.push({
          columns: cols,
          references: { table: refM[1], columns: refCols },
        });
      }
      continue;
    }

    // Védőszűrés: ha valamiért külön maradna FK-folytatás sor,
    // semmiképp se kezeljük oszlopdefinícióként.
    if (
      /^CONSTRAINT\b/i.test(line) ||
      /^FOREIGN\s+KEY\b/i.test(line) ||
      /^REFERENCES\b/i.test(line) ||
      /^ON\s+DELETE\b/i.test(line) ||
      /^ON\s+UPDATE\b/i.test(line)
    ) {
      continue;
    }

    // Oszlop definíció
    const head = line.match(/^`?(\w+)`?\s+(.+)$/);
    if (head) {
      const name = head[1];
      const tail = head[2];

      // ENUM értékek
      let enumValues = null;
      const enumM = tail.match(/\bENUM\s*\(([^)]+)\)/i);
      if (enumM) {
        enumValues = enumM[1]
          .split(",")
          .map((s) => s.trim().replace(/^['"]|['"]$/g, ""));
      }

      // Típus: a kulcsszavak előtti rész
      const typeOnly = (
        tail.split(
          /\bNOT\s+NULL\b|\bNULL\b|\bDEFAULT\b|\bUNIQUE\b|\bAUTO_INCREMENT\b|\bCOMMENT\b/i
        )[0] || ""
      ).trim();

      const allowNull = !/\bNOT\s+NULL\b/i.test(tail);
      const autoIncrement = /\bAUTO_INCREMENT\b/i.test(tail);
      const unique = /\bUNIQUE\b/i.test(tail);

      // DEFAULT
      let def = null;
      const defM = tail.match(
        /\bDEFAULT\s+((?:'[^']*')|(?:"[^"]*")|(?:[^\s,]+))/i
      );
      if (defM) def = defM[1].replace(/^['"]|['"]$/g, "");

      // ON UPDATE
      let onUpdate = null;
      const updM = tail.match(
        /\bON\s+UPDATE\s+((?:'[^']*')|(?:"[^"]*")|(?:[^\s,]+))/i
      );
      if (updM) onUpdate = updM[1].replace(/^['"]|['"]$/g, "");

      // COMMENT
      let comment = null;
      const comM = tail.match(
        /\bCOMMENT\s*(?:=|\s)\s*(?:'([^']*)'|"([^"]*)")/i
      );
      if (comM) comment = comM[1] ?? comM[2];

      // inline PRIMARY KEY
      if (/\bPRIMARY\s+KEY\b/i.test(tail)) primaryKey.push(name);

      columns.push({
        name,
        type: typeOnly.replace(/\s+/g, " ").trim(),
        allowNull,
        autoIncrement,
        unique,
        default: def,
        onUpdate,
        enumValues,
        comment,
      });
      continue;
    }

    // Rövid UNIQUE (név nélkül): UNIQUE (a,b)
    if (/^UNIQUE\s*\(/i.test(line)) {
      const colsM = line.match(/\(([^)]+)\)/);
      uniqueKeys.push({
        name: null,
        columns: colsM
          ? colsM[1].split(",").map((s) => s.replace(/[`'"]/g, "").trim())
          : [],
      });
      continue;
    }
  }

  return { columns, primaryKey, foreignKeys, uniqueKeys, indexes };
}

// ALTER TABLE blokkok (több utasítást is felvesz, amíg ';'-ig tart)
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
    pm[1].split(",").map(s => s.replace(/[`'"]/g,"").trim()).forEach(c => pk.push(c));
  }

  // ADD CONSTRAINT ... FOREIGN KEY (`a`,`b`) REFERENCES `tab`(`x`,`y`)
  const fkRe = /ADD\s+CONSTRAINT\s+`?\w+`?\s+FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+`?(\w+)`?\s*\(([^)]+)\)/gim;
  let fm;
  while ((fm = fkRe.exec(body))) {
    const cols    = fm[1].split(",").map(s => s.replace(/[`'"]/g,"").trim());
    const refCols = fm[3].split(",").map(s => s.replace(/[`'"]/g,"").trim());
    fks.push({ columns: cols, references: { table: fm[2], columns: refCols } });
  }

  // ADD UNIQUE KEY `name` (`a`,`b`)
  const ukRe = /ADD\s+UNIQUE\s+(?:KEY|INDEX)\s+`?(\w+)`?\s*\(([^)]+)\)/gim;
  let um;
  while ((um = ukRe.exec(body))) {
    const name = um[1];
    const cols = um[2].split(",").map(s => s.replace(/[`'"]/g,"").trim());
    uniqueKeys.push({ name, columns: cols });
  }

  // ADD KEY/INDEX `name` (`a`,`b`)
  const idxRe = /ADD\s+(?:KEY|INDEX)\s+`?(\w+)`?\s*\(([^)]+)\)/gim;
  let im;
  while ((im = idxRe.exec(body))) {
    const name = im[1];
    const cols = im[2].split(",").map(s => s.replace(/[`'"]/g,"").trim());
    indexes.push({ name, columns: cols, unique: false });
  }

  return { pk, fks, uniqueKeys, indexes };
}

function parseInsertStatements(sql) {
  const inserts = [];
  const re = /\bINSERT\s+INTO\s+`?([A-Za-z0-9_]+)`?/gim;
  let m;

  while ((m = re.exec(sql))) {
    const table = m[1];
    const start = m.index;

    let i = re.lastIndex; // innen keressük a pontosvesszőt
    let inSingle = false, inDouble = false, inBacktick = false;

    while (i < sql.length) {
      const ch = sql[i];
      const prev = sql[i - 1];

      // string/backtick állapotok
      if (!inDouble && !inBacktick && ch === "'" && !inSingle) { inSingle = true; i++; continue; }
      if (inSingle) { if (ch === "'" && prev !== "\\") inSingle = false; i++; continue; }

      if (!inSingle && !inBacktick && ch === '"' && !inDouble) { inDouble = true; i++; continue; }
      if (inDouble) { if (ch === '"' && prev !== "\\") inDouble = false; i++; continue; }

      if (!inSingle && !inDouble && ch === '`' && !inBacktick) { inBacktick = true; i++; continue; }
      if (inBacktick) { if (ch === '`') inBacktick = false; i++; continue; }

      // statement vége: ; csak akkor számít, ha nem vagyunk stringben/backtickben
      if (!inSingle && !inDouble && !inBacktick && ch === ';') {
        i++; // a ; is kell
        break;
      }

      i++;
    }

    const stmt = sql.slice(start, i).trim();
    if (stmt) inserts.push({ table, statement: stmt.endsWith(';') ? stmt : (stmt + ';') });

    // ugorjunk a statement utánra
    re.lastIndex = i;
  }

  return inserts;
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

  // INFORMATION_SCHEMA-szerű adatok kigyűjtése a CREATE/ALTER blokkokból
 const viewRegex =
  /CREATE\s+(?:OR\s+REPLACE\s+)?(?:ALGORITHM\s*=\s*\w+\s+)?(?:DEFINER\s*=\s*.*?\s+)?(?:SQL\s+SECURITY\s+\w+\s+)?VIEW\s+`?(\w+)`?/gim;
  let vm;
  while ((vm = viewRegex.exec(sql))) {
    tableMap.delete(vm[1]);
  }

    const inserts = parseInsertStatements(sql);

  // táblánként is hozzácsapjuk (opcionális, de hasznos)
  const byTable = new Map();
  for (const ins of inserts) {
    if (!byTable.has(ins.table)) byTable.set(ins.table, []);
    byTable.get(ins.table).push(ins.statement);
  }
  for (const t of tableMap.values()) {
    const arr = byTable.get(t.name);
    if (arr && arr.length) {
      t.seed = { inserts: arr };
    }
  }

  return {
    database,
    tables: Array.from(tableMap.values()),
    seed: { inserts } // globálisan is
  };
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
