// Generic meta endpoint built from loaded Sequelize models
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
      const tn = a.target?.getTableName
        ? a.target.getTableName()
        : (a.target?.tableName || a.target?.name);
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
        typeObj && (
          typeObj.key ||
          (typeof typeObj.toSql === 'function' ? typeObj.toSql() : null) ||
          String(typeObj)
        );

      const typeKey = rawTypeKey ? String(rawTypeKey).toUpperCase() : '';
      const typeKeyShort = typeKey.split('(')[0];

      const lower = String(name).toLowerCase();
      const isIdLike =
        lower === 'id' ||
        lower.endsWith('_id') ||
        (lower.endsWith('id') && lower.length <= 4);

      const assocRef = fkMap.get(name);
      const isFk = !!attr.references || !!assocRef;

      const col = {
        name,
        type: typeKeyShort || typeKey || String(typeObj),
        allowNull: (attr.allowNull !== false),
        primaryKey: !!attr.primaryKey,
        autoIncrement: !!attr.autoIncrement,
        isForeignKey: isFk,
      };

      const enumValues =
        Array.isArray(typeObj?.values) ? typeObj.values :
        Array.isArray(attr.values) ? attr.values :
        null;

      if (enumValues && enumValues.length) {
        col.enumValues = enumValues;
      }

      if (isFk) {
        const refModel = normalizeRefModel(attr.references?.model || assocRef?.model);

        col.references = {
          model: refModel,
          key: attr.references?.key || assocRef?.key || 'id',
          as: assocRef?.as || undefined,
        };
      }

      columns.push(col);

      // METRIKA: numerikus, de ne legyen FK és ne legyen ID-szerű.
      if (numericTypes.includes(typeKeyShort) && !isIdLike && !isFk) {
        metrics.push(name);
      }

      // DIMENZIÓ: kategóriás/PK/numerikus is lehet,
      // de ID-szerűt alapból kihagyunk, kivéve FK esetén.
      const dimAllowed = (!isIdLike) || isFk;

      if ((catTypes.includes(typeKeyShort) || attr.primaryKey) && dimAllowed) {
        dims.push(name);
      }

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
