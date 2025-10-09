const fs = require("fs");

function stripComments(sql) {
  // /* ... */ és -- ... sorvége
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--.*$/gm, "")
    .trim();
}

function parseCreateTableBlocks(sql) {
  const blocks = [];
  const re = /CREATE\s+TABLE\s+`?(\w+)`?\s*\(([\s\S]*?)\)\s*;/gim;
  let m;
  while ((m = re.exec(sql))) {
    blocks.push({ table: m[1], body: m[2] });
  }
  return blocks;
}

function parseColumnsAndConstraints(body) {
  const lines = body
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l.length && !l.startsWith("--"));

  const columns = [];
  const primaryKey = [];
  const foreignKeys = [];

  for (let raw of lines) {
    // távolítsd el a sorvégi vesszőt, ha van
    const line = raw.replace(/,+\s*$/, "");

    // PRIMARY KEY (...)
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

    // FOREIGN KEY (`col`) REFERENCES `table`(`id`)
    if (/^CONSTRAINT\s+/i.test(line) && /FOREIGN\s+KEY/i.test(line)) {
      const colM = line.match(/FOREIGN\s+KEY\s*\(`?(\w+)`?\)/i);
      const refM = line.match(/REFERENCES\s+`?(\w+)`?\s*\(`?(\w+)`?\)/i);
      if (colM && refM) {
        foreignKeys.push({
          column: colM[1],
          references: { table: refM[1], column: refM[2] },
        });
      }
      continue;
    }
    if (/^FOREIGN\s+KEY/i.test(line)) {
      const colM = line.match(/FOREIGN\s+KEY\s*\(`?(\w+)`?\)/i);
      const refM = line.match(/REFERENCES\s+`?(\w+)`?\s*\(`?(\w+)`?\)/i);
      if (colM && refM) {
        foreignKeys.push({
          column: colM[1],
          references: { table: refM[1], column: refM[2] },
        });
      }
      continue;
    }

    // Oszlop definíció: <name> <type> [NOT NULL] [AUTO_INCREMENT] [DEFAULT ...] ...
    const colM = line.match(/^`?(\w+)`?\s+([A-Z]+(?:\([^)]+\))?(?:\s+UNSIGNED)?)/i);
    if (colM) {
      const name = colM[1];
      const type = colM[2].replace(/\s+/g, " ").trim();
      const allowNull = !/\bNOT\s+NULL\b/i.test(line);
      const autoIncrement = /\bAUTO_INCREMENT\b/i.test(line);
      const unique = /\bUNIQUE\b/i.test(line) || /UNIQUE KEY/i.test(line);
      let defaultValue = null;
      const defM = line.match(/\bDEFAULT\s+([^,\s]+)/i);
      if (defM) defaultValue = defM[1].replace(/^['"]|['"]$/g, "");

      columns.push({
        name,
        type,
        allowNull,
        autoIncrement,
        unique,
        default: defaultValue,
      });
      continue;
    }

    // Egyéb (UNIQUE KEY, INDEX stb.) – most kihagyjuk
  }

  return { columns, primaryKey, foreignKeys };
}

function parseSchema(sql) {
  const clean = stripComments(sql);
  const blocks = parseCreateTableBlocks(clean);
  const tables = blocks.map(({ table, body }) => {
    const { columns, primaryKey, foreignKeys } = parseColumnsAndConstraints(body);
    return {
      name: table,
      columns,
      primaryKey,
      foreignKeys,
    };
  });
  return { database: null, tables };
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
