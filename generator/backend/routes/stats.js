// Generic aggregate stats endpoint (works for any generated DB)
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
  const bt = String.fromCharCode(96); // `
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

  if (!allowedAgg.includes(agg)) {
    agg = 'count';
  }

  const wantExcludeNull = String(excludeNull || '').toLowerCase();
  const shouldExcludeNull =
    wantExcludeNull === '1' ||
    wantExcludeNull === 'true' ||
    wantExcludeNull === 'yes';

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

    let whereClause = '';
    const replacements = {};
    const parts = [];

    if (shouldExcludeNull) {
      parts.push(qid(groupBy) + ' IS NOT NULL');

      if (agg !== 'count') {
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
        // Rossz JSON esetén nincs extra WHERE feltétel.
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
