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

function main() {
  const input = arg("--input") || "../db/diaknyilvantartas.sql";
  const outDir = arg("--out") || "./out";

  const sql = fs.readFileSync(path.resolve(process.cwd(), input), "utf8");
  const schema = parseSchema(sql);
  // Ha a dumpban nincs USE/CREATE DATABASE, következtessünk a fájlnévből
if (!schema.database) {
  const abs = path.resolve(process.cwd(), input);
  const guess = path.basename(abs).replace(/\.sql$/i, "");
  schema.database = guess; // pl. diaknyilvantartas
}


  // schema.json kiírása
  ensureDir(outDir);
  fs.writeFileSync(path.join(outDir, "schema.json"), JSON.stringify(schema, null, 2), "utf8");

  // hello.hbs render
  const tplPath = path.resolve(__dirname, "../templates/hello.hbs");
  const tplSrc = fs.readFileSync(tplPath, "utf8");
  const tpl = Handlebars.compile(tplSrc);
  const outText = tpl(schema);

  const samplesDir = path.join(outDir, "samples");
  ensureDir(samplesDir);
  fs.writeFileSync(path.join(samplesDir, "HELLO.txt"), outText, "utf8");

  console.log("✅ Kész: out/schema.json és out/samples/HELLO.txt létrehozva.");
}

main();
