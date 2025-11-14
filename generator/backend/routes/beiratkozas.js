// Auto-generated CRUD for table beiratkozas
const express = require('express');
const router = express.Router();

// LIST
router.get('/', async (req, res) => {
  try {
    const Beiratkozas = req.app.get('models')['beiratkozas'];
    const limit  = Math.min(Number(req.query.limit || 100), 500);
    const offset = Number(req.query.offset || 0);
    let where = {};
    if (req.query.where) {
      try { where = JSON.parse(req.query.where); } catch {}
    }
    const rows = await Beiratkozas.findAll({ where, limit, offset });
    return res.json(rows);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'LIST_FAILED' });
  }
});

// GET BY PK
router.get('/:hallgato_id/:kurzus_id', async (req, res) => {
  try {
    const Beiratkozas = req.app.get('models')['beiratkozas'];
    const where = { hallgato_id: req.params.hallgato_id, kurzus_id: req.params.kurzus_id };
    const row = await Beiratkozas.findOne({ where });
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
    const Beiratkozas = req.app.get('models')['beiratkozas'];
    const payload = { ...req.body };
    for (const k of Object.keys(payload)) {
      if (payload[k] === '') payload[k] = null;
    }
    const created = await Beiratkozas.create(payload);

    // Preferált visszatöltés: PK -> UNIQUE -> fallback
    
    // PK alapján visszakérés
    const pkWhere = { hallgato_id: created.hallgato_id, kurzus_id: created.kurzus_id };
    const row = await Beiratkozas.findOne({ where: pkWhere });
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
router.put('/:hallgato_id/:kurzus_id', async (req, res) => {
  try {
    const Beiratkozas = req.app.get('models')['beiratkozas'];
    const where = { hallgato_id: req.params.hallgato_id, kurzus_id: req.params.kurzus_id };
    const payload = { ...req.body };
    for (const k of Object.keys(payload)) {
      if (payload[k] === '') payload[k] = null;
    }
    const [cnt] = await Beiratkozas.update(payload, { where });
    if (!cnt) return res.status(404).json({ error: 'NOT_FOUND' });
    const row = await Beiratkozas.findOne({ where });
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
router.delete('/:hallgato_id/:kurzus_id', async (req, res) => {
  try {
    const Beiratkozas = req.app.get('models')['beiratkozas'];
    const where = { hallgato_id: req.params.hallgato_id, kurzus_id: req.params.kurzus_id };
    const cnt = await Beiratkozas.destroy({ where });
    if (!cnt) return res.status(404).json({ error: 'NOT_FOUND' });
    return res.status(204).end();
  } catch (e) {
    console.error(e);
    return res.status(400).json({ error: 'DELETE_FAILED' });
  }
});

module.exports = router;