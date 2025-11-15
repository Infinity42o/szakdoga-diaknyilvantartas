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
  // Parancssori argok: node src/generate.js <input> <out>  VAGY  --input ... --out ...
  const cliInput = process.argv[2];
  const cliOut = process.argv[3];

  // Preferáld a --input/--out flaget, ha nincs, használd a pozíciós argokat, ha az sincs, default
  const inputRel = arg("--input") || cliInput || "../db/diaknyilvantartas.sql";
  const outDirRel = arg("--out") || cliOut || "./out";

  // inputot a jelenlegi fájlhoz képest oldjuk fel (stabil futtatás)
  const resolvePreferringCwd = (p) => {
  if (path.isAbsolute(p)) return p;
  const fromCwd = path.resolve(process.cwd(), p);
  return fs.existsSync(fromCwd) ? fromCwd : path.resolve(__dirname, p);
};
const inputAbs = resolvePreferringCwd(inputRel);
  const outDirAbs = path.isAbsolute(outDirRel) ? outDirRel : path.resolve(process.cwd(), outDirRel);

  if (!fs.existsSync(inputAbs)) {
    console.error("hiba! Nem találom az input SQL fájlt:", inputAbs);
    process.exit(1);
  }

  const sql = fs.readFileSync(inputAbs, "utf8");
  const schema = parseSchema(sql);

  // schema.json kiírása
  ensureDir(outDirAbs);
  const schemaPath = path.join(outDirAbs, "schema.json");
  fs.writeFileSync(schemaPath, JSON.stringify(schema, null, 2), "utf8");

  // hello.hbs render
  const tplPath = path.resolve(__dirname, "../templates/hello.hbs");
  if (fs.existsSync(tplPath)) {
    const tplSrc = fs.readFileSync(tplPath, "utf8");
    const tpl = Handlebars.compile(tplSrc);
    const outText = tpl(schema);

    const samplesDir = path.join(outDirAbs, "samples");
    ensureDir(samplesDir);
    fs.writeFileSync(path.join(samplesDir, "HELLO.txt"), outText, "utf8");
  } else {
    console.warn("Hiba! Nem találom a sablont:", tplPath);
  }

  console.log("Műkszik, Kész:", path.relative(process.cwd(), schemaPath), "és samples/HELLO.txt (ha volt sablon).");
}

main();
