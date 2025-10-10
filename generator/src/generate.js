#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const Handlebars = require("handlebars");
const { parseSchema } = require("./parseSql");

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function arg(flag, fallback = null) {
  const i = process.argv.indexOf(flag);
  if (i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")) {
    return process.argv[i + 1];
  }
  return fallback;
}

function readText(filePath, label) {
  try {
    const buf = fs.readFileSync(filePath);
    let txt = buf.toString("utf8");
    // BOM eltávolítás (Windows exportok)
    if (txt.charCodeAt(0) === 0xfeff) txt = txt.slice(1);
    return txt;
  } catch (err) {
    throw new Error(`${label} nem olvasható: ${filePath}\n${err.message}`);
  }
}

function registerHelpers(dir) {
  if (!dir) return;
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".js"));
  for (const f of files) {
    // minden helper modul {name, fn} vagy { [name]: fn, ... } lehet
    // rugalmas regisztráció:
    // eslint-disable-next-line import/no-dynamic-require, global-require
    const mod = require(path.join(dir, f));
    if (typeof mod === "function") {
      Handlebars.registerHelper(path.basename(f, ".js"), mod);
    } else if (mod && typeof mod === "object") {
      for (const [name, fn] of Object.entries(mod)) {
        if (typeof fn === "function") Handlebars.registerHelper(name, fn);
      }
    }
  }
}

function registerPartials(dir) {
  if (!dir) return;
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".hbs") || f.endsWith(".handlebars"));
  for (const f of files) {
    const name = path.basename(f).replace(/\.(hbs|handlebars)$/i, "");
    const src = readText(path.join(dir, f), `Partial (${name})`);
    Handlebars.registerPartial(name, src);
  }
}

function main() {
  const input = arg("--input") || "../db/diaknyilvantartas.sql";
  const outDir = arg("--out") || "./out";
  const templatePathArg = arg("--template") || "../templates/hello.hbs";
  const helpersDir = arg("--helpers");   // pl. ../templates/helpers
  const partialsDir = arg("--partials"); // pl. ../templates/partials
  const force = process.argv.includes("--force");

  // Az input és a template útvonalakat a script könyvtárához viszonyítjuk, ha relatívak:
  const baseDir = __dirname; // a generator.js helye
  const inputPath = path.isAbsolute(input) ? input : path.resolve(process.cwd(), input);
  const tplPath = path.isAbsolute(templatePathArg)
    ? templatePathArg
    : path.resolve(baseDir, templatePathArg);

  // 1) SQL beolvasás
  const sql = readText(inputPath, "SQL input");

  // 2) parse + adatbázisnév kitalálás fallback-ként
  let schema;
  try {
    schema = parseSchema(sql);
  } catch (err) {
    throw new Error(`parseSchema hiba: ${err.message}`);
  }

  if (!schema || typeof schema !== "object") {
    throw new Error("parseSchema üres vagy hibás objektumot adott vissza.");
  }

  if (!schema.database) {
    const guess = path.basename(inputPath).replace(/\.sql$/i, "");
    schema.database = guess; // pl. diaknyilvantartas
  }

  // 3) Handlebars környezet felkészítése
  registerHelpers(helpersDir && path.resolve(baseDir, helpersDir));
  registerPartials(partialsDir && path.resolve(baseDir, partialsDir));

  const tplSrc = readText(tplPath, "Sablon (Handlebars)");
  const tpl = Handlebars.compile(tplSrc);

  // 4) Kimeneti könyvtár(ak)
  ensureDir(outDir);
  const samplesDir = path.join(outDir, "samples");
  ensureDir(samplesDir);

<<<<<<< Updated upstream
  console.log("Kész: out/schema.json és out/samples/HELLO.txt létrehozva.");
=======
  const schemaJsonPath = path.join(outDir, "schema.json");
  const helloPath = path.join(samplesDir, "HELLO.txt");

  // 5) Felülírás-védelem (ha nincs --force)
  if (!force) {
    for (const p of [schemaJsonPath, helloPath]) {
      if (fs.existsSync(p)) {
        throw new Error(`A kimeneti fájl már létezik: ${p}\nHasználd a --force kapcsolót a felülíráshoz.`);
      }
    }
  }

  // 6) Kiírás
  fs.writeFileSync(schemaJsonPath, JSON.stringify(schema, null, 2), "utf8");
  const outText = tpl(schema);
  fs.writeFileSync(helloPath, outText, "utf8");

  console.log("Kész  →  ");
  console.log(" -", schemaJsonPath);
  console.log(" -", helloPath);
>>>>>>> Stashed changes
}

try {
  main();
} catch (err) {
  console.error("Hiba :", err.message);
  process.exit(1);
}
