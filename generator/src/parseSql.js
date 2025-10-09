const fs = require("fs");

function stripComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--.*$/gm, "")
    .trim();
}

function parseDatabaseName(sql) {
  const m1 = sql.match(/USE\s+`?(\w+)`?\s*;/i);
  if (m1) return m1[1];
  const m2 = sql.match(/CREATE\s+DATABASE\s+`?(\w+)`?/i);
  if (m2) return m2[1];
  return null;
}

// Csak CREATE TABLE blokkok (VIEW nem!)
function parseCreateTableBlocks(sql) {
  const blocks = [];
  const re = /CREATE\s+TABLE\s+`?(\w+)`?\s*\(([\s\S]*?)\)\s*;/gim;
  let m;
  while ((m = re.exec(sql))) {
    blocks.push({ table: m[1], body: m[2] });
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
    const v = (mm[1] ?? mm[2])
      .replace(/\\'/g, "'")
      .replace(/\\"/g, '"');
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
    // táblaszintű opciók / egyéb zaj kiszűrése
if (/^(INSERT|ENGINE|CHARSET|COLLATE|ROW_FORMAT|COMMENT|PARTITION|KEY|UNIQUE|INDEX)\b/i.test(line)) {
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
      const colM = line.match(/FOREIGN\s+KEY\s*\((`?\w+`?)\)/i);
      const refM = line.match(/REFERENCES\s+`?(\w+)`?\s*\(`?(\w+)`?\)/i);
      if (colM && refM) {
        const cols = colM[1].replace(/[`]/g, "").split(/\s*,\s*/);
        foreignKeys.push({
          column: cols[0].replace(/[`]/g, ""),
          references: { table: refM[1], column: refM[2] },
        });
      }
      continue;
    }

    // Oszlop definíció
    const colM = line.match(/^`?(\w+)`?\s+([A-Z]+(?:\([^)]+\))?(?:\s+UNSIGNED)?)/i);
    if (colM) {
      const name = colM[1];
      const type = colM[2].replace(/\s+/g, " ").trim();
      const allowNull = !/\bNOT\s+NULL\b/i.test(line);
      const autoIncrement = /\bAUTO_INCREMENT\b/i.test(line);
      const unique = /\bUNIQUE\b/i.test(line);
      let def = null;
      const defM = line.match(/\bDEFAULT\s+([^,\s]+)/i);
      if (defM) def = defM[1].replace(/^['"]|['"]$/g, "");

      // ENUM értékek
      const enumValues = extractEnumValues(line);

      // Inline PRIMARY KEY (ritkább MySQL-ben, de kezeljük)
      if (/\bPRIMARY\s+KEY\b/i.test(line)) primaryKey.push(name);

      columns.push({ name, type, allowNull, autoIncrement, unique, default: def, enumValues });
      continue;
    }
  }

  return { columns, primaryKey, foreignKeys };
}

// ALTER TABLE ... ; blokkok kibányászása (PRIMARY/FOREIGN KEY)
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
      column: cols[0], // POC: első oszlop
      references: { table: fm[2], column: fm[3] },
    });
  }

  return { pk, fks };
}

function parseSchema(sqlRaw) {
  const sql = stripComments(sqlRaw);
  const database = parseDatabaseName(sql);

  // CREATE TABLE-k
  const createBlocks = parseCreateTableBlocks(sql);
  const tableMap = new Map();
  for (const { table, body } of createBlocks) {
    const { columns, primaryKey, foreignKeys } = parseColumnsAndConstraintsFromCreate(body);
    tableMap.set(table, { name: table, columns, primaryKey, foreignKeys });
  }

  // ALTER TABLE-k (PK/FK hozzáfűzés)
  const alterBlocks = parseAlterTableBlocks(sql);
  for (const { table, body } of alterBlocks) {
    const t = tableMap.get(table);
    if (!t) continue;
    const { pk, fks } = extractConstraintsFromAlter(body);
    if (pk.length) {
      const set = new Set([...(t.primaryKey || []), ...pk]);
      t.primaryKey = Array.from(set);
    }
    if (fks.length) {
      t.foreignKeys = [...(t.foreignKeys || []), ...fks];
    }
  }

  // Nézetek kiszűrése – OR REPLACE / ALGORITHM / DEFINER / SQL SECURITY variánsokkal
  const viewRegex =
    /CREATE\s+(?:OR\s+REPLACE\s+)?(?:ALGORITHM\s*=\s*\w+\s+)?(?:DEFINER\s*=\s*.*?\s+)?(?:SQL\s+SECURITY\s+\w+\s+)?VIEW\s+`?(\w+)`?/gim;
  let vm;
  while ((vm = viewRegex.exec(sql))) {
    tableMap.delete(vm[1]);
  }
  // (opcionális extra) v_-val kezdődő neveket is dobd:
  // for (const name of Array.from(tableMap.keys())) if (name.startsWith("v_")) tableMap.delete(name);

  return {
    database,
    tables: Array.from(tableMap.values()),
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
  process.stdout.write(JSON.stringify(schema, null, 2));
}

if (require.main === module) main();

module.exports = { parseSchema };
