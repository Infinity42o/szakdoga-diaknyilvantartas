const fs = require("fs");
const path = require("path");
const Handlebars = require("handlebars");
require("./hbs-helpers"); // segédek regisztrálása



// Ha van külön helper fájlod, maradjon:
try { require("./hbs-helpers"); } catch (_) {
  // Fallback minimál helperek (ha a fájl hiányzik)
  Handlebars.registerHelper("eq", (a, b) => a === b);
  Handlebars.registerHelper("and", (...args) => args.slice(0, -1).every(Boolean));
  Handlebars.registerHelper("or",  (...args) => args.slice(0, -1).some(Boolean));
}

function readJson(p) { return JSON.parse(fs.readFileSync(p, "utf8")); }
function mkdirp(p) { fs.mkdirSync(p, { recursive: true }); }
function write(p, s) { mkdirp(path.dirname(p)); fs.writeFileSync(p, s, "utf8"); }
function loadTpl(rel) {
  const full = path.resolve(__dirname, "../templates", rel);
  return Handlebars.compile(fs.readFileSync(full, "utf8"));
}

// Egyszerű CLI parser: kezeli a --k=v és a "--k v" formát is
function parseCli(argv) {
  const positional = [];
  const flags = {};
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a.startsWith("--")) {
      const noDash = a.replace(/^--/, "");
      if (noDash.includes("=")) {
        const [k, v] = noDash.split("=");
        flags[k] = v === undefined ? true : v;
      } else {
        const k = noDash;
        const next = rest[i + 1];
        if (next && !next.startsWith("--")) { flags[k] = next; i++; }
        else { flags[k] = true; }
      }
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

function main() {
  const { positional, flags } = parseCli(process.argv);
  const [inputSchemaRaw, outDirRaw] = positional;

  if (!inputSchemaRaw || !outDirRaw) {
    console.error("Használat: node src/generate-backend.js <schema.json> <outDir> [--orm=sequelize] [--with-routes] [--with-openapi] [--with-seeds]");
    process.exit(1);
  }

  const inputSchema = path.resolve(inputSchemaRaw);
  const outDir      = path.resolve(outDirRaw);

  const orm = (flags.orm || "sequelize").toString();
  if (orm !== "sequelize") {
    console.warn(`Figyelem: jelenleg csak 'sequelize' támogatott. (kapott: ${orm})`);
  }

  const withRoutes  = Boolean(flags["with-routes"]);
  const withOpenapi = Boolean(flags["with-openapi"]);
  const withSeeds   = Boolean(flags["with-seeds"]);

  if (!fs.existsSync(inputSchema)) {
    console.error(`Nem találom a sémát: ${inputSchema}`);
    process.exit(1);
  }

  const schema = readJson(inputSchema);            // { database, tables: [...] }
  const tables = Array.isArray(schema.tables) ? schema.tables : [];

  // Közös sablon-kontextus (minden sablonnak elérhető lesz: orm, kapcsolók, db, tables)
  const ctx = {
    orm,
    withRoutes,
    withOpenapi,
    withSeeds,
    database: schema.database || null,
    tables
  };

  // 1) projekt skeleton
  write(path.join(outDir, "src/config/db.ts"),        loadTpl("sequelize/db.hbs")(ctx));
  write(path.join(outDir, "src/models/index.ts"),     loadTpl("sequelize/models-index.hbs")(ctx));
  write(path.join(outDir, "src/server.ts"),           loadTpl("express/server.hbs")(ctx));

  // 2) modellek
  for (const t of tables) {
    const perTable = { ...ctx, table: t };
    write(
      path.join(outDir, `src/models/${t.name}.ts`),
      loadTpl("sequelize/model.hbs")(perTable)
    );
  }

  // 3) route-ok (opcionális)
  if (withRoutes) {
    for (const t of tables) {
      const perTable = { ...ctx, table: t };
      write(
        path.join(outDir, `src/routes/${t.name}.ts`),
        loadTpl("express/route.hbs")(perTable)
      );
    }
  }

  // 4) OpenAPI (opcionális)
  if (withOpenapi) {
    write(
      path.join(outDir, "openapi/schema.yaml"),
      loadTpl("openapi/schema.yaml.hbs")(ctx)
    );
  }

  // 5) seedek (opcionális)
  if (withSeeds) {
    for (const t of tables) {
      const perTable = { ...ctx, table: t };
      write(
        path.join(outDir, `seeds/${t.name}.seed.ts`),
        loadTpl("seed/seed.hbs")(perTable)
      );
    }
  }

  // 6) package.json a kimenethez
  write(
    path.join(outDir, "package.json"),
    JSON.stringify({
      name: `${schema.database || "app"}-backend`,
      private: true,
      type: "module",
      scripts: {
        dev: "tsx src/server.ts",
        build: "tsc -p .",
        start: "node dist/server.js"
      },
      dependencies: {
        dotenv: "^16.4.5",
        express: "^4.19.2",
        sequelize: "^6.37.3",
        mysql2: "^3.10.0"
      },
      devDependencies: {
        tsx: "^4.19.0",
        typescript: "^5.6.3",
        "@types/express": "^4.17.21"
      }
    }, null, 2)
  );

  // 7) tsconfig
  write(
    path.join(outDir, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2020",
        module: "ES2020",
        moduleResolution: "Bundler",
        outDir: "dist",
        rootDir: "src",
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true
      },
      include: ["src"]
    }, null, 2)
  );

  // 8) .env.example
  write(
    path.join(outDir, ".env.example"),
    [
      "DB_HOST=localhost",
      "DB_USER=root",
      "DB_PASS=",
      `DB_NAME=${schema.database || "diaknyilvantartas"}`,
      "DB_PORT=3306"
    ].join("\n")
  );

  console.log("✅ Backend generálás kész:", path.resolve(outDir));
}

main();
