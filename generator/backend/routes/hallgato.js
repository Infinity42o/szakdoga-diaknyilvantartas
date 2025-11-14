// Auto-generated CRUD for table hallgato
const express = require('express');
const router = express.Router();

// LIST
router.get('/', async (req, res) => {
  try {
    const Hallgato = req.app.get('models')['hallgato'];
    const limit  = Math.min(Number(req.query.limit || 100), 500);
    const offset = Number(req.query.offset || 0);
    let where = {};
    if (req.query.where) {
      try { where = JSON.parse(req.query.where); } catch {}
    }
    const rows = await Hallgato.findAll({ where, limit, offset });
    return res.json(rows);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'LIST_FAILED' });
  }
});

// GET BY PK
router.get('/:id', async (req, res) => {
  try {
    const Hallgato = req.app.get('models')['hallgato'];
    const where = { id: req.params.id };
    const row = await Hallgato.findOne({ where });
    if (!row) return res.status(404).json({ error: 'NOT_FOUND' });
    return res.json(row);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'GET_FAILED' });
  }
});

// CREATE
router.post('/', async (req, res) => {
  try {
    const Hallgato = req.app.get('models')['hallgato'];
    const payload = { ...req.body };
    for (const k of Object.keys(payload)) {
      if (payload[k] === '') payload[k] = null;
    }
    const created = await Hallgato.create(payload);

    // Preferált visszatöltés: PK -> UNIQUE -> fallback
    
    // PK alapján visszakérés
    const pkWhere = { id: created.id };
    const row = await Hallgato.findOne({ where: pkWhere });
    return res.status(201).json(row || created);
    
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
    return res.status(400).json({ error: 'CREATE_FAILED' });
  }
});


// UPDATE BY PK
router.put('/:id', async (req, res) => {
  try {
    const Hallgato = req.app.get('models')['hallgato'];
    const where = { id: req.params.id };
    const payload = { ...req.body };
    for (const k of Object.keys(payload)) {
      if (payload[k] === '') payload[k] = null;
    }
    const [cnt] = await Hallgato.update(payload, { where });
    if (!cnt) return res.status(404).json({ error: 'NOT_FOUND' });
    const row = await Hallgato.findOne({ where });
    return res.json(row);
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
    return res.status(400).json({ error: 'UPDATE_FAILED' });
  }
});

// DELETE BY PK
router.delete('/:id', async (req, res) => {
  try {
    const Hallgato = req.app.get('models')['hallgato'];
    const where = { id: req.params.id };
    const cnt = await Hallgato.destroy({ where });
    if (!cnt) return res.status(404).json({ error: 'NOT_FOUND' });
    return res.status(204).end();
  } catch (e) {
    console.error(e);
    return res.status(400).json({ error: 'DELETE_FAILED' });
  }
});

module.exports = router;