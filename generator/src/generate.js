const fs = require("fs");
const path = require("path");
const Handlebars = require("handlebars");
const { parseSchema } = require("./parseSql");

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function arg(flag, fallback = null) {
  const i = process.argv.indexOf(flag);
  if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

function getPositionalArgs() {
  const result = [];

  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];

    if (a === "--input" || a === "--out") {
      i++;
      continue;
    }

    if (!a.startsWith("--")) {
      result.push(a);
    }
  }

  return result;
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Egy konkrét CREATE TABLE blokk törzsének kinyerése.
 * Kezeli:
 * CREATE TABLE hallgato (...)
 * CREATE TABLE `hallgato` (...)
 * CREATE TABLE `db`.`hallgato` (...)
 */
function extractCreateTableBody(sql, tableName) {
  const re = new RegExp(
    "CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?" +
      "(?:(?:`[^`]+`|[A-Za-z_][A-Za-z0-9_]*)\\s*\\.\\s*)?" +
      "(?:`" + escapeRegExp(tableName) + "`|" + escapeRegExp(tableName) + ")\\s*\\(",
    "i"
  );

  const m = re.exec(sql);
  if (!m) return null;

  const open = sql.indexOf("(", m.index);
  if (open === -1) return null;

  let depth = 1;
  let quote = null;

  for (let i = open + 1; i < sql.length; i++) {
    const ch = sql[i];
    const prev = sql[i - 1];

    if (quote) {
      if (ch === quote && prev !== "\\") quote = null;
      continue;
    }

    if (ch === "'" || ch === '"' || ch === "`") {
      quote = ch;
      continue;
    }

    if (ch === "(") depth++;
    else if (ch === ")") depth--;

    if (depth === 0) {
      return sql.slice(open + 1, i);
    }
  }

  return null;
}

/**
 * ALTER TABLE törzsek kinyerése egy adott táblához.
 *
 * Kezeli például:
 * ALTER TABLE `hallgato`
 *   MODIFY `id` int(10) unsigned NOT NULL AUTO_INCREMENT;
 *
 * Ez kell a phpMyAdmin dumpokhoz, mert ott az AUTO_INCREMENT
 * gyakran nem a CREATE TABLE oszlopsorban van, hanem későbbi ALTER-ben.
 */
function extractAlterTableBodies(sql, tableName) {
  const bodies = [];

  const re = new RegExp(
    "ALTER\\s+TABLE\\s+" +
      "(?:(?:`[^`]+`|[A-Za-z_][A-Za-z0-9_]*)\\s*\\.\\s*)?" +
      "(?:`" + escapeRegExp(tableName) + "`|" + escapeRegExp(tableName) + ")\\s+",
    "gi"
  );

  let m;

  while ((m = re.exec(sql)) !== null) {
    const start = re.lastIndex;

    let quote = null;
    let depth = 0;
    let end = sql.length;

    for (let i = start; i < sql.length; i++) {
      const ch = sql[i];
      const prev = sql[i - 1];

      if (quote) {
        if (ch === quote && prev !== "\\") quote = null;
        continue;
      }

      if (ch === "'" || ch === '"' || ch === "`") {
        quote = ch;
        continue;
      }

      if (ch === "(") depth++;
      else if (ch === ")") depth--;

      if (ch === ";" && depth === 0) {
        end = i;
        break;
      }
    }

    bodies.push(sql.slice(start, end).trim());
    re.lastIndex = end + 1;
  }

  return bodies;
}

/**
 * CREATE TABLE vagy ALTER TABLE body felbontása vessző mentén úgy,
 * hogy ENUM(...), DECIMAL(...), CHECK(...), stb. belső vesszői ne törjenek sort.
 */
function splitCreateBody(body) {
  const parts = [];
  let current = "";
  let depth = 0;
  let quote = null;

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    const prev = body[i - 1];

    if (quote) {
      current += ch;
      if (ch === quote && prev !== "\\") quote = null;
      continue;
    }

    if (ch === "'" || ch === '"' || ch === "`") {
      quote = ch;
      current += ch;
      continue;
    }

    if (ch === "(") depth++;
    else if (ch === ")") depth--;

    if (ch === "," && depth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = "";
      continue;
    }

    current += ch;
  }

  if (current.trim()) parts.push(current.trim());
  return parts;
}

/**
 * Egy oszlopdefinícióból vagy ALTER műveletből kiveszi,
 * hogy melyik oszlop AUTO_INCREMENT.
 *
 * Kezeli:
 * `id` int NOT NULL AUTO_INCREMENT
 * id int NOT NULL AUTO_INCREMENT
 * MODIFY `id` int NOT NULL AUTO_INCREMENT
 * MODIFY COLUMN `id` int NOT NULL AUTO_INCREMENT
 * CHANGE `old_id` `id` int NOT NULL AUTO_INCREMENT
 * CHANGE COLUMN `old_id` `id` int NOT NULL AUTO_INCREMENT
 * ADD `id` int NOT NULL AUTO_INCREMENT
 * ADD COLUMN `id` int NOT NULL AUTO_INCREMENT
 */
function markAutoIncrementFromDefinition(def, columnsByName) {
  if (!def || !/\bAUTO_INCREMENT\b/i.test(def)) return;

  let s = def.trim();

  let columnName = null;

  // ALTER TABLE ... ADD COLUMN `id` ...
  s = s.replace(/^ADD\s+COLUMN\s+/i, "").trim();
  s = s.replace(/^ADD\s+/i, "").trim();

  // ALTER TABLE ... MODIFY [COLUMN] `id` ...
  let m =
    s.match(/^MODIFY\s+(?:COLUMN\s+)?`([^`]+)`\s+/i) ||
    s.match(/^MODIFY\s+(?:COLUMN\s+)?([A-Za-z_][A-Za-z0-9_]*)\s+/i);

  if (m) {
    columnName = m[1];
  }

  // ALTER TABLE ... CHANGE [COLUMN] `old` `new` ...
  m =
    s.match(/^CHANGE\s+(?:COLUMN\s+)?`[^`]+`\s+`([^`]+)`\s+/i) ||
    s.match(
      /^CHANGE\s+(?:COLUMN\s+)?[A-Za-z_][A-Za-z0-9_]*\s+([A-Za-z_][A-Za-z0-9_]*)\s+/i
    );

  if (m) {
    columnName = m[1];
  }

  // CREATE TABLE oszlopsor: `id` int ...
  // vagy ALTER ADD után már szintén így néz ki.
  if (!columnName) {
    m =
      s.match(/^`([^`]+)`\s+/) ||
      s.match(/^([A-Za-z_][A-Za-z0-9_]*)\s+/);

    if (m) {
      columnName = m[1];
    }
  }

  if (!columnName) return;

  const col = columnsByName.get(String(columnName).toLowerCase());

  if (col) {
    col.autoIncrement = true;
  }
}

/**
 * Biztonságos AUTO_INCREMENT utófeldolgozás.
 *
 * Nem találgat "id" mezőnév alapján.
 * Csak akkor állít autoIncrement=true értéket,
 * ha az eredeti SQL-ben ténylegesen szerepel AUTO_INCREMENT.
 *
 * Kezeli:
 * 1. CREATE TABLE-ben inline AUTO_INCREMENT
 * 2. ALTER TABLE ... MODIFY ... AUTO_INCREMENT
 * 3. ALTER TABLE ... CHANGE ... AUTO_INCREMENT
 * 4. ALTER TABLE ... ADD COLUMN ... AUTO_INCREMENT
 */
function enrichAutoIncrementFromSql(schema, sql) {
  if (!schema || !Array.isArray(schema.tables)) return schema;

  for (const table of schema.tables) {
    const tableName = table.table || table.name || table.modelKey || table.label;
    if (!tableName || !Array.isArray(table.columns)) continue;

    const columnsByName = new Map(
      table.columns.map((c) => [String(c.name).toLowerCase(), c])
    );

    // Alapállapot: amit a parser már true-ra tett, maradjon true.
    // Ami nem true, legyen explicit false.
    for (const col of table.columns) {
      if (col.autoIncrement !== true) {
        col.autoIncrement = false;
      }
    }

    // 1) CREATE TABLE blokk vizsgálata
    const createBody = extractCreateTableBody(sql, tableName);

    if (createBody) {
      const definitions = splitCreateBody(createBody);

      for (const def of definitions) {
        markAutoIncrementFromDefinition(def, columnsByName);
      }
    }

    // 2) ALTER TABLE blokkok vizsgálata
    const alterBodies = extractAlterTableBodies(sql, tableName);

    for (const body of alterBodies) {
      const operations = splitCreateBody(body);

      for (const op of operations) {
        markAutoIncrementFromDefinition(op, columnsByName);
      }
    }
  }

  return schema;
}

function main() {
  // Használat:
  // node src/generate.js <input.sql> <outDir>
  // vagy:
  // node src/generate.js --input <input.sql> --out <outDir>
  //
  // npm scriptből:
  // npm run parse:dump -- ..\db\diaknyilvantartas.sql .\out

  const positional = getPositionalArgs();

  const inputRel =
    arg("--input") ||
    positional[0] ||
    "../db/diaknyilvantartas.sql";

  const outDirRel =
    arg("--out") ||
    positional[1] ||
    "./out";

  // Relatív inputot először a futtatási könyvtárhoz képest oldjuk fel.
  // Ha ott nincs, akkor a src mappához képest.
  const resolvePreferringCwd = (p) => {
    if (path.isAbsolute(p)) return p;

    const fromCwd = path.resolve(process.cwd(), p);
    if (fs.existsSync(fromCwd)) return fromCwd;

    return path.resolve(__dirname, p);
  };

  const inputAbs = resolvePreferringCwd(inputRel);

  const outDirAbs = path.isAbsolute(outDirRel)
    ? outDirRel
    : path.resolve(process.cwd(), outDirRel);

  if (!fs.existsSync(inputAbs)) {
    console.error("hiba! Nem találom az input SQL fájlt:", inputAbs);
    process.exit(1);
  }

  const sql = fs.readFileSync(inputAbs, "utf8");

  // Parser + biztonságos AUTO_INCREMENT enrichment.
  const schema = enrichAutoIncrementFromSql(parseSchema(sql), sql);

  // schema.json kiírása
  ensureDir(outDirAbs);

  const schemaPath = path.join(outDirAbs, "schema.json");
  fs.writeFileSync(schemaPath, JSON.stringify(schema, null, 2), "utf8");

  // seed.sql kiírása, ha vannak INSERT-ek
  if (
    schema.seed &&
    Array.isArray(schema.seed.inserts) &&
    schema.seed.inserts.length
  ) {
    const seedSql =
      [
        "SET FOREIGN_KEY_CHECKS=0;",
        ...schema.seed.inserts.map((x) => x.statement || x),
        "SET FOREIGN_KEY_CHECKS=1;",
      ].join("\n") + "\n";

    fs.writeFileSync(path.join(outDirAbs, "seed.sql"), seedSql, "utf8");
  }

  // hello.hbs render, opcionális.
  // Ha nincs ilyen sablon, nem hiba.
  const tplPath = path.resolve(__dirname, "../templates/hello.hbs");

  if (fs.existsSync(tplPath)) {
    const tplSrc = fs.readFileSync(tplPath, "utf8");
    const tpl = Handlebars.compile(tplSrc);
    const outText = tpl(schema);

    const samplesDir = path.join(outDirAbs, "samples");
    ensureDir(samplesDir);

    fs.writeFileSync(path.join(samplesDir, "HELLO.txt"), outText, "utf8");
  } else {
    console.warn("Info: nincs opcionális hello.hbs sablon:", tplPath);
  }

  console.log(
    "Műkszik, Kész:",
    path.relative(process.cwd(), schemaPath),
    "és samples/HELLO.txt (ha volt sablon)."
  );
}

main();