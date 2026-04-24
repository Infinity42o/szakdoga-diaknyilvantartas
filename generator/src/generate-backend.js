// src/generate-backend.js
const fs = require("fs");
const path = require("path");

const [,, schemaPathArg, outRootArg] = process.argv;
const schemaPath = path.resolve(process.cwd(), schemaPathArg || "./out/schema.json");
const outRoot    = path.resolve(process.cwd(), outRootArg  || "./backend");

if (!fs.existsSync(schemaPath)) {
  console.error("Nem találom a sémát:", schemaPath);
  process.exit(1);
}

const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
fs.mkdirSync(outRoot, { recursive: true });
fs.mkdirSync(path.join(outRoot, "models"), { recursive: true });
fs.mkdirSync(path.join(outRoot, "routes"), { recursive: true });
fs.mkdirSync(path.join(outRoot, "db"), { recursive: true });

// --- Helper-ek ---
const toPascal = s => s.replace(/[_-](\w)/g, (_,c)=>c.toUpperCase()).replace(/^\w/, c=>c.toUpperCase());
const toCamel  = s => s.replace(/[_-](\w)/g, (_,c)=>c.toUpperCase()).replace(/^\w/, c=>c.toLowerCase());

function normalizePk(table) {
  let pk = table.primaryKey;
  let arr = [];

  // 1) primaryKey lehet tömb
  if (Array.isArray(pk)) {
    arr = pk.slice();
  }
  // 2) primaryKey lehet string (akár "a,b")
  else if (typeof pk === "string" && pk.trim()) {
    arr = pk.split(",").map(s => s.trim()).filter(Boolean);
  }

  // 3) ha nincs primaryKey mező, próbáljuk a columns.primaryKey flagből
  if (!arr.length && Array.isArray(table.columns)) {
    arr = table.columns.filter(c => c.primaryKey).map(c => c.name);
  }

  // 4) stabil sorrend: table.columns sorrendje
  if (Array.isArray(table.columns) && table.columns.length) {
    const order = table.columns.map(c => c.name);
    arr.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  }

  // dedupe
  return Array.from(new Set(arr));
}

function getUniqueGroups(table) {
  // Visszafelé kompatibilis: a parser uniqueKeys-et ad, de régebbi kódok uniqueIndexes-et vártak.
  return table.uniqueKeys || table.uniqueIndexes || [];
}

function mapSqlTypeToSequelize(col) {
  const t = (col.type || "").toUpperCase();
  if (col.enumValues && col.enumValues.length) {
    const vals = col.enumValues.map(v => `'${v.replace(/'/g, "\\'")}'`).join(", ");
    return `DataTypes.ENUM(${vals})`;
  }
  if (t.startsWith("INT")) return "DataTypes.INTEGER";
  if (t.startsWith("BIGINT")) return "DataTypes.BIGINT";
  if (t.startsWith("SMALLINT") || t.startsWith("TINYINT")) {
    if (/TINYINT\(\s*1\s*\)/i.test(col.type)) return "DataTypes.BOOLEAN";
    return "DataTypes.SMALLINT";
  }
  if (t.startsWith("DECIMAL") || t.startsWith("NUMERIC")) return "DataTypes.DECIMAL";
  if (t.startsWith("FLOAT")) return "DataTypes.FLOAT";
  if (t.startsWith("DOUBLE")) return "DataTypes.DOUBLE";
  if (t.startsWith("CHAR(") || t.startsWith("VARCHAR(")) return "DataTypes.STRING";
  if (t.startsWith("TEXT") || t.endsWith("TEXT")) return "DataTypes.TEXT";
  if (t.includes("BLOB")) return "DataTypes.BLOB";
  if (t.startsWith("DATE") && !t.includes("TIME")) return "DataTypes.DATEONLY";
  if (t.includes("TIME")) return "DataTypes.DATE";
  if (t.startsWith("JSON")) return "DataTypes.JSON";
  return "DataTypes.STRING";
}

function defaultVal(col) {
  if (!("default" in col) || col.default === undefined || col.default === null) return undefined;

  const raw = String(col.default).trim();
  const d = raw.toUpperCase();

  // DEFAULT NULL -> ne generáljunk defaultValue-t (különben 'NULL' string lesz)
  if (d === "NULL") return undefined;

  if (d === "CURRENT_TIMESTAMP" || d === "CURRENT_TIMESTAMP()") return "DataTypes.NOW";

  // numerikus default (idézőjelek nélkül)
  if (/^-?\d+(\.\d+)?$/.test(raw)) return raw;

  // string default: ha már idézőjelesen jönne, szedjük le a szélső idézőket
  let s = raw;
  if (
    (s.length >= 2 && s.startsWith("'") && s.endsWith("'")) ||
    (s.length >= 2 && s.startsWith('"') && s.endsWith('"'))
  ) {
    s = s.slice(1, -1);
  }
  return `'${String(s).replace(/'/g, "\\'")}'`;
}

function renderModel(table) {
  const className = toPascal(table.name);
  const pk = normalizePk(table);
  const uniqueMap = new Map();

  (getUniqueGroups(table) || []).forEach(ui => {
    uniqueMap.set(ui.name || ("uq_" + ui.columns.join("_")), ui.columns);
  });

  const cols = table.columns.map(col => {
    const parts = [];
    parts.push(`${col.name}: {`);
    parts.push(`  type: ${mapSqlTypeToSequelize(col)},`);
    if (pk.includes(col.name)) parts.push(`  primaryKey: true,`);
    if (col.autoIncrement === true) parts.push(`  autoIncrement: true,`);
      if (col.allowNull === false || col.nullable === false) parts.push(`  allowNull: false,`);
    if (col.unique === true) parts.push(`  unique: true,`);
    const dv = defaultVal(col);
    if (dv) parts.push(`  defaultValue: ${dv},`);
    if (col.comment) parts.push(`  comment: ${JSON.stringify(col.comment)},`);
    parts.push(`}`);
    return parts.join("\n");
  }).join(",\n");

  let indexes = "";
    const uniqueGroups = getUniqueGroups(table);
  if ((table.indexes && table.indexes.length) || (uniqueGroups && uniqueGroups.length)) {
    const ix = [];
    (table.indexes||[]).forEach(i => ix.push(`{ name: ${JSON.stringify(i.name||"ix_"+i.columns.join("_"))}, fields: ${JSON.stringify(i.columns)} }`));
    (uniqueGroups||[]).forEach(u => ix.push(`{ name: ${JSON.stringify(u.name||"uq_"+u.columns.join("_"))}, unique: true, fields: ${JSON.stringify(u.columns)} }`));
    if (ix.length) {
      indexes = `
  ,{
    indexes: [
      ${ix.join(",\n      ")}
    ]
  }`;
    }
  }

  return `// Auto-generated by generate-backend.js
module.exports = (sequelize, DataTypes) => {
  const ${className} = sequelize.define('${table.name}', {
    ${cols}
  }, {
    tableName: '${table.name}',
    timestamps: false
  }${indexes});

  ${className}.associate = (models) => {
    ${renderAssociations(table)}
  };

  return ${className};
};`;
}

function renderAssociations(table) {
  if (!table.foreignKeys || !table.foreignKeys.length) return "// nincsenek FK-k";
  return table.foreignKeys.map((fk) => {
    const sourceFields = fk.columns;
    const targetTable = fk.references.table;
    const targetFields = fk.references.columns;
    if (sourceFields.length === 1 && targetFields.length === 1) {
      const asName = toCamel(targetTable);
      return [
        `// FK ${fk.name || ("fk_"+table.name+"_"+targetTable)} (${sourceFields[0]} -> ${targetTable}.${targetFields[0]})`,
        `models['${table.name}'].belongsTo(models['${targetTable}'], {`,
        `  as: '${asName}',`,
        `  foreignKey: '${sourceFields[0]}'`,
        `});`,
        `models['${targetTable}'].hasMany(models['${table.name}'], {`,
        `  as: '${toCamel(table.name)}List',`,
        `  foreignKey: '${sourceFields[0]}'`,
        `});`
      ].join("\n");
    }
    return `// Kompozit FK kihagyva asszociációként: (${sourceFields.join(", ")}) -> ${targetTable}(${targetFields.join(", ")})`;
  }).join("\n\n");
}

function renderRoute(table) {
  const className = toPascal(table.name);

  const pk = normalizePk(table);                 // <-- FIX
  const pkFields = pk.length ? pk : ["id"];      // fallback
  const pkParams = pk.length ? pk.map(k => `:${k}`).join("/") : ":id";

  const loadModelLine = `const ${className} = req.app.get('models')['${table.name}'];`;

  return `// Auto-generated CRUD for table ${table.name}
const express = require('express');
const { Op } = require('sequelize');
const router = express.Router();

function buildPkWhere(Model, req, res) {
  const pkFields = ${JSON.stringify(pkFields)};
  const where = {};
  const attrs = Model.rawAttributes || {};

  const numericTypes = [
    'INTEGER','BIGINT','FLOAT','DOUBLE','DECIMAL','REAL',
    'SMALLINT','TINYINT','MEDIUMINT'
  ];

  for (const f of pkFields) {
    if (req.params[f] === undefined) {
      res.status(400).json({ error: 'MISSING_PK', field: f });
      return null;
    }

    let v = req.params[f];
    const typeKey = attrs[f] && attrs[f].type && attrs[f].type.key;

    if (numericTypes.includes(typeKey)) {
      const n = Number(v);
      if (Number.isNaN(n)) {
        res.status(400).json({ error: 'BAD_PK', field: f });
        return null;
      }
      v = n;
    }

    where[f] = v;
  }

  return where;
}

// LIST
router.get('/', async (req, res) => {
  try {
    ${loadModelLine}
    const { limit, offset, where, filters } = req.query;
    const opts = {};
    if (limit) opts.limit = Number(limit);
    if (offset) opts.offset = Number(offset);

    if (filters) {
      try {
        const parsed = JSON.parse(filters);
        const arr = Array.isArray(parsed) ? parsed : [];
        const conds = [];
        const attrs = ${className}.rawAttributes || {};

        for (const f of arr) {
          if (!f || !f.col) continue;
          const col = f.col;
          const op = String(f.op || 'eq').toLowerCase();
          const val = f.val;

          if (
            val === undefined ||
            val === null ||
            val === '' ||
            (Array.isArray(val) && val.length === 0)
          ) {
            continue;
          }

          const attr = attrs[col];
          const typeKey = attr && attr.type && attr.type.key;
          const isStringType = ['STRING', 'TEXT', 'CHAR', 'ENUM'].includes(typeKey);
          const isNumericType = [
            'INTEGER','BIGINT','FLOAT','DOUBLE','DECIMAL','REAL','SMALLINT','TINYINT','MEDIUMINT'
          ].includes(typeKey);
          const isDateType = ['DATE', 'DATEONLY'].includes(typeKey);

          // típusra castolás (scalar vagy tömb)
          const castOne = (x) => {
            if (isNumericType) {
              const n = Number(x);
              if (Number.isNaN(n)) return { ok: false };
              return { ok: true, v: n };
            }
            if (typeKey === 'BOOLEAN') {
              if (x === true || x === 'true' || x === '1' || x === 1) return { ok: true, v: true };
              if (x === false || x === 'false' || x === '0' || x === 0) return { ok: true, v: false };
              return { ok: false };
            }
            if (isDateType) {
              if (typeof x === 'string' && /^\\d{4}-\\d{2}-\\d{2}/.test(x)) return { ok: true, v: x };
              return { ok: false };
            }
            return { ok: true, v: x };
          };

          let typedVal;
          if (Array.isArray(val)) {
            const arrVals = val.map(castOne).filter(r => r.ok).map(r => r.v);
            if (!arrVals.length) continue;
            typedVal = arrVals;
          } else {
            const one = castOne(val);
            if (!one.ok) continue;
            typedVal = one.v;
          }

          const isArrayVal = Array.isArray(typedVal);

          let expr;
          switch (op) {
            case 'in':
              expr = { [col]: { [Op.in]: isArrayVal ? typedVal : [typedVal] } };
              break;
            case 'like':
              // LIKE csak string típusokra – különben essünk vissza sima egyenlőségre
              if (isArrayVal) {
                expr = { [col]: { [Op.in]: typedVal } };
              } else if (isStringType) {
                expr = { [col]: { [Op.like]: '%' + String(typedVal) + '%' } };
              } else {
                expr = { [col]: typedVal };
              }
              break;
            case 'gte':
              expr = { [col]: { [Op.gte]: typedVal } };
              break;
            case 'lte':
              expr = { [col]: { [Op.lte]: typedVal } };
              break;
            case 'gt':
              expr = { [col]: { [Op.gt]: typedVal } };
              break;
            case 'lt':
              expr = { [col]: { [Op.lt]: typedVal } };
              break;
            default:
              expr = isArrayVal
                ? { [col]: { [Op.in]: typedVal } }
                : { [col]: typedVal };
          }

          conds.push(expr);
        }

        if (conds.length === 1) opts.where = conds[0];
        else if (conds.length > 1) opts.where = { [Op.and]: conds };
      } catch (err) {
        console.error(err);
        return res.status(400).json({ error: 'BAD_FILTERS_JSON' });
      }
    } else if (where) {
      try {
        opts.where = JSON.parse(where);
      } catch {
        return res.status(400).json({ error: 'BAD_WHERE_JSON' });
      }
    }

    const rows = await ${className}.findAll(opts);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'LIST_FAILED' });
  }
});

// GET BY PK
router.get('/${pkParams}', async (req, res) => {
  try {
    ${loadModelLine}
    const where = buildPkWhere(${className}, req, res);
    if (!where) return;

    const row = await ${className}.findOne({ where });
    if (!row) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json(row);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'GET_FAILED' });
  }
});

// CREATE
router.post('/', async (req, res) => {
  try {
    const Model = req.app.get('models')['${table.name}'];
    const created = await Model.create(req.body);
    res.status(201).json(created);
  } catch (e) {
    console.error(e);
    if (e.name === 'SequelizeUniqueConstraintError') {
      const detail = e.errors?.[0];
      return res.status(409).json({
        error: 'UNIQUE_VIOLATION',
        field: detail?.path || 'unknown',
        value: detail?.value,
        message: detail?.message || 'Unique constraint violated'
      });
    }
    if (e.name === 'SequelizeValidationError') {
      return res.status(400).json({
        error: 'VALIDATION_FAILED',
        details: e.errors.map(x => ({ field: x.path, message: x.message }))
      });
    }
    res.status(400).json({ error: 'CREATE_FAILED' });
  }
});

// UPDATE BY PK
router.put('/${pkParams}', async (req, res) => {
  try {
    ${loadModelLine}
    const where = buildPkWhere(${className}, req, res);
    if (!where) return;

    const [cnt] = await ${className}.update(req.body, { where });
    if (!cnt) return res.status(404).json({ error: 'NOT_FOUND' });
    const row = await ${className}.findOne({ where });
    res.json(row);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: 'UPDATE_FAILED' });
  }
});

// DELETE BY PK
router.delete('/${pkParams}', async (req, res) => {
  try {
    ${loadModelLine}
    const where = buildPkWhere(${className}, req, res);
    if (!where) return;

    const cnt = await ${className}.destroy({ where });
    if (!cnt) return res.status(404).json({ error: 'NOT_FOUND' });
    res.status(204).end();
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: 'DELETE_FAILED' });
  }
});

module.exports = router;`;
}

// --- DB INDEX ---
function renderDbIndex() {
  return `// Auto-generated DB index
const { Sequelize, DataTypes } = require('sequelize');
const dotenv = require('dotenv');
dotenv.config();

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS, {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  dialect: 'mysql',
  logging: false
});

const models = {};
function loadModels() {
  const fs = require('fs');
  const path = require('path');
  const modelsDir = path.join(__dirname, '..', 'models');
  for (const file of fs.readdirSync(modelsDir).filter(f => f.endsWith('.js'))) {
    const def = require(path.join(modelsDir, file));
    const mdl = def(sequelize, DataTypes);
    models[mdl.getTableName()] = mdl;
  }
  Object.values(models).forEach(m => { if (m.associate) m.associate(models); });
  return models;
}

module.exports = { sequelize, loadModels };`;
}

// --- META + GENERIKUS STATISZTIKA ROUTE-OK ---

function renderMetaRoute() {
  return `// Generic meta endpoint built from loaded Sequelize models
const express = require('express');
const router = express.Router();

function normalizeTableName(tn) {
  if (!tn) return tn;
  if (typeof tn === 'string') return tn;
  if (typeof tn === 'object' && tn.tableName) return tn.tableName;
  return String(tn);
}

function normalizeRefModel(refModel) {
  if (!refModel) return refModel;

  if (typeof refModel === 'string') return refModel;

  try {
    if (typeof refModel.getTableName === 'function') {
      return normalizeTableName(refModel.getTableName());
    }
  } catch {}

  if (refModel.tableName) return normalizeTableName(refModel.tableName);
  if (refModel.name) return String(refModel.name);

  return String(refModel);
}

function buildFkMapFromAssociations(model) {
  // FK mezők felderítése belongsTo asszociációkból:
  // fkField -> { model: <refTable>, key: <refPk>, as: <alias> }
  const fkMap = new Map();
  const assocs = model.associations || {};

  for (const a of Object.values(assocs)) {
    if (!a) continue;
    if (a.associationType !== 'BelongsTo') continue;

    const fk =
      typeof a.foreignKey === 'string'
        ? a.foreignKey
        : (a.foreignKey && a.foreignKey.name) ? a.foreignKey.name : null;

    if (!fk) continue;

    let refTable = null;
    try {
      const tn = a.target?.getTableName ? a.target.getTableName() : (a.target?.tableName || a.target?.name);
      refTable = normalizeTableName(tn);
    } catch {}

    const refKey = a.targetKey || 'id';

    fkMap.set(fk, { model: refTable, key: refKey, as: a.as });
  }

  return fkMap;
}

function buildTableMeta(models) {
  const result = [];

  for (const [key, model] of Object.entries(models || {})) {
    if (!model || !model.rawAttributes) continue;

    let tableName = model.getTableName ? model.getTableName() : model.tableName || key;
    tableName = normalizeTableName(tableName);

    const attrs = model.rawAttributes;

    // FK-k asszociációból (megbízhatóbb nálad, mint attr.references)
    const fkMap = buildFkMapFromAssociations(model);

    const columns = [];
    const dims = [];
    const metrics = [];

    const numericTypes = [
      'INTEGER','BIGINT','FLOAT','DOUBLE','DECIMAL','REAL',
      'TINYINT','SMALLINT','MEDIUMINT'
    ];
    const catTypes = ['STRING','CHAR','TEXT','ENUM','DATEONLY','DATE','BOOLEAN'];

    for (const [name, attr] of Object.entries(attrs)) {
      const typeObj = attr.type;
      const rawTypeKey =
        typeObj && (typeObj.key || (typeof typeObj.toSql === 'function' ? typeObj.toSql() : null) || String(typeObj));
      const typeKey = rawTypeKey ? String(rawTypeKey).toUpperCase() : '';
      const typeKeyShort = typeKey.split('(')[0];

      const lower = String(name).toLowerCase();
      const isIdLike =
        lower === 'id' ||
        lower.endsWith('_id') ||
        (lower.endsWith('id') && lower.length <= 4);

      // FK felismerés: references vagy belongsTo asszociáció
      const assocRef = fkMap.get(name);
      const isFk = !!attr.references || !!assocRef;

      const col = {
        name,
        type: typeKeyShort || typeKey || String(typeObj),
        allowNull: (attr.allowNull !== false),
        primaryKey: !!attr.primaryKey,
        isForeignKey: isFk,
      };

      if (isFk) {
        const refModel = normalizeRefModel(attr.references?.model || assocRef?.model);
        col.references = {
          model: refModel,
          key: attr.references?.key || assocRef?.key || 'id',
          as: assocRef?.as || undefined,
        };
      }

      columns.push(col);

      // METRIKA: numerikus, de ne legyen FK (ID-kre nincs értelmes SUM/AVG),
      // és ne legyen ID-szerű
      if (numericTypes.includes(typeKeyShort) && !isIdLike && !isFk) {
        metrics.push(name);
      }

      // DIMENZIÓ: kategóriás/PK/numerikus is lehet,
      // de ID-szerűt alapból kihagyjuk - KIVÉVE ha FK (mert erre kell stat!)
      const dimAllowed = (!isIdLike) || isFk;

      if ((catTypes.includes(typeKeyShort) || attr.primaryKey) && dimAllowed) {
        dims.push(name);
      }

      // numerikus dimenziók (pl. jegy, evfolyam, kredit) + FK-k (akkor is ha PK része)
      if (numericTypes.includes(typeKeyShort) && dimAllowed) {
        dims.push(name);
      }
    }

    result.push({
      table: tableName,
      modelKey: key,
      label: tableName,
      columns,
      dimensions: Array.from(new Set(dims)),
      metrics: Array.from(new Set(metrics)),
    });
  }

  return result;
}

router.get('/', (req, res) => {
  try {
    const models = req.app.get('models') || {};
    const tables = buildTableMeta(models);
    res.json({ tables });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'META_FAILED' });
  }
});

module.exports = router;
`;
}

function renderGenericStatsRoute() {
  return `// Generic aggregate stats endpoint (works for any generated DB)
const express = require('express');
const router = express.Router();

function getSequelize(req) {
  const models = req.app.get('models') || {};
  const anyModel = Object.values(models)[0];
  if (!anyModel) {
    throw new Error('NO_MODELS');
  }
  return anyModel.sequelize;
}

function qid(name) {
  // Identifier quoting MySQL/MariaDB-hez backtick-kel, backtick escapinggel
  const bt = String.fromCharCode(96); // \`
  const s = String(name);
  return bt + s.split(bt).join(bt + bt) + bt;
}

function isNumericType(mysqlType) {
  const t = String(mysqlType || '');
  return /int|decimal|float|double|numeric|real/i.test(t);
}

// GET /api/stats/aggregate?table=...&groupBy=...&agg=count|sum|avg|min|max&field=optional&where={"col":"value"}&excludeNull=1
router.get('/aggregate', async (req, res) => {
  const { table, groupBy } = req.query;
  let { agg = 'count', field, where, excludeNull } = req.query;

  if (!table || !groupBy) {
    return res.status(400).json({
      error: 'BAD_REQUEST',
      details: 'table és groupBy paraméter kötelező.',
    });
  }

  const allowedAgg = ['count', 'sum', 'avg', 'min', 'max'];
  agg = String(agg).toLowerCase();
  if (!allowedAgg.includes(agg)) agg = 'count';

  const wantExcludeNull = String(excludeNull || '').toLowerCase();
  const shouldExcludeNull = (wantExcludeNull === '1' || wantExcludeNull === 'true' || wantExcludeNull === 'yes');

  try {
    const sequelize = getSequelize(req);
    const qi = sequelize.getQueryInterface();
    const desc = await qi.describeTable(table);

    if (!desc[groupBy]) {
      return res.status(400).json({
        error: 'BAD_GROUPBY',
        details: 'Ismeretlen csoportosító oszlop: ' + groupBy,
      });
    }

    let aggExpr;
    let usedField = field;

    if (agg === 'count') {
      aggExpr = 'COUNT(*)';
    } else {
      // ha nincs field, próbáljunk numeric oszlopot keresni (ID-k és PK-k nélkül)
      if (!usedField || !desc[usedField]) {
        const numericCandidates = Object.keys(desc).filter((col) => {
          const info = desc[col] || {};
          const type = String(info.type || '');
          const lower = col.toLowerCase();
          const isIdLike =
            lower === 'id' ||
            lower.endsWith('_id') ||
            (lower.endsWith('id') && lower.length <= 4);

          const isNumeric = isNumericType(type);
          const isPk = !!info.primaryKey;

          return isNumeric && !isPk && !isIdLike;
        });

        usedField = numericCandidates[0];
      }

      if (!usedField) {
        return res.status(400).json({
          error: 'NO_NUMERIC_COLUMN',
          details: 'Nem található megfelelő numerikus oszlop az összesítéshez.',
        });
      }

      if (!desc[usedField]) {
        return res.status(400).json({
          error: 'BAD_FIELD',
          details: 'Ismeretlen metrika oszlop: ' + usedField,
        });
      }

      if (!isNumericType(desc[usedField].type)) {
        return res.status(400).json({
          error: 'BAD_FIELD_TYPE',
          details: 'A metrika oszlop nem numerikus: ' + usedField,
        });
      }

      aggExpr = agg.toUpperCase() + '(' + qid(usedField) + ')';
    }

    // where JSON -> egyszerű = feltételek (egyenlőség) + opcionális NULL kizárás
    let whereClause = '';
    const replacements = {};
    const parts = [];

    if (shouldExcludeNull) {
      parts.push(qid(groupBy) + ' IS NOT NULL');
      if (agg !== 'count') {
        // MIN/AVG esetén fontos: ha egy csoportban minden metrika NULL, az eredmény NULL lesz
        parts.push(qid(usedField) + ' IS NOT NULL');
      }
    }

    if (where) {
      try {
        const w = JSON.parse(where);
        let idx = 0;
        for (const [col, val] of Object.entries(w)) {
          if (!desc[col]) continue;
          const key = 'w' + idx++;
          parts.push(qid(col) + ' = :' + key);
          replacements[key] = val;
        }
      } catch (e) {
        // rossz JSON -> nincs extra WHERE feltétel
      }
    }

    if (parts.length) {
      whereClause = 'WHERE ' + parts.join(' AND ');
    }

    const orderDir = (agg === 'min') ? 'ASC' : 'DESC';

    const sql =
      'SELECT ' + qid(groupBy) + ' AS grp, ' + aggExpr + ' AS value ' +
      'FROM ' + qid(table) + ' ' +
      whereClause + ' ' +
      'GROUP BY ' + qid(groupBy) + ' ' +
      'ORDER BY value ' + orderDir;

    const [rows] = await sequelize.query(sql, { replacements });
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'STATS_AGG_FAILED' });
  }
});

module.exports = router;
`;
}

function renderApp(tables) {
  const mounts = (tables || []).map(t => {
    const routeVar = toCamel(t.name) + "Router";
    return `const ${routeVar} = require('./routes/${t.name}.js');
app.use('/api/${t.name}', ${routeVar});`;
  }).join("\n\n");

  return `// Auto-generated Express app
const express = require('express');
const cors = require('cors');
const { sequelize, loadModels } = require('./db');
const dotenv = require('dotenv');
dotenv.config();

const statsRouter = require('./routes/stats.js');
const metaRouter  = require('./routes/meta.js');

const app = express();
app.use(cors());
app.use(express.json());

const models = loadModels();
app.set('models', models);

app.get('/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'DB_DOWN' });
  }
});

// CRUD végpontok a táblákhoz
${mounts}

// Általános statisztikák + meta
app.use('/api/stats', statsRouter);
app.use('/api/meta', metaRouter);

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(PORT, () => console.log('Megy, API listening on port', PORT));
`;
}

// --- Generálás ---

for (const table of schema.tables || []) {
  const modelCode = renderModel(table);
  fs.writeFileSync(path.join(outRoot, "models", `${table.name}.js`), modelCode, "utf8");

  const routeCode = renderRoute(table);
  fs.writeFileSync(path.join(outRoot, "routes", `${table.name}.js`), routeCode, "utf8");
}

// meta + generikus stats route minden generált backendhez
fs.writeFileSync(path.join(outRoot, "routes", "meta.js"), renderMetaRoute(), "utf8");
fs.writeFileSync(path.join(outRoot, "routes", "stats.js"), renderGenericStatsRoute(), "utf8");

// db index + app
fs.writeFileSync(path.join(outRoot, "db", "index.js"), renderDbIndex(), "utf8");
fs.writeFileSync(path.join(outRoot, "app.js"), renderApp(schema.tables || []), "utf8");

console.log("Megy, Backend generálva:", outRoot);
