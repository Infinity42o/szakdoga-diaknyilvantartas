// Auto-generated CRUD for table hallgato
const express = require('express');
const { Op } = require('sequelize');
const router = express.Router();

function buildPkWhere(Model, req, res) {
  const pkFields = ["id"];
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
    const Hallgato = req.app.get('models')['hallgato'];
    const { limit, offset, where, filters } = req.query;
    const opts = {};
    if (limit) opts.limit = Number(limit);
    if (offset) opts.offset = Number(offset);

    if (filters) {
      try {
        const parsed = JSON.parse(filters);
        const arr = Array.isArray(parsed) ? parsed : [];
        const conds = [];
        const attrs = Hallgato.rawAttributes || {};

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
              if (typeof x === 'string' && /^\d{4}-\d{2}-\d{2}/.test(x)) return { ok: true, v: x };
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

    const rows = await Hallgato.findAll(opts);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'LIST_FAILED' });
  }
});

// GET BY PK
router.get('/:id', async (req, res) => {
  try {
    const Hallgato = req.app.get('models')['hallgato'];
    const where = buildPkWhere(Hallgato, req, res);
    if (!where) return;

    const row = await Hallgato.findOne({ where });
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
    const Model = req.app.get('models')['hallgato'];
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
router.put('/:id', async (req, res) => {
  try {
    const Hallgato = req.app.get('models')['hallgato'];
    const where = buildPkWhere(Hallgato, req, res);
    if (!where) return;

    const [cnt] = await Hallgato.update(req.body, { where });
    if (!cnt) return res.status(404).json({ error: 'NOT_FOUND' });
    const row = await Hallgato.findOne({ where });
    res.json(row);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: 'UPDATE_FAILED' });
  }
});

// DELETE BY PK
router.delete('/:id', async (req, res) => {
  try {
    const Hallgato = req.app.get('models')['hallgato'];
    const where = buildPkWhere(Hallgato, req, res);
    if (!where) return;

    const cnt = await Hallgato.destroy({ where });
    if (!cnt) return res.status(404).json({ error: 'NOT_FOUND' });
    res.status(204).end();
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: 'DELETE_FAILED' });
  }
});

module.exports = router;