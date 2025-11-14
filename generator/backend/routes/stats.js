console.log('[stats] router loaded');
const express = require('express');
const router = express.Router();

function getSequelize(req) {
  const anyModel = req.app.get('models')['hallgato'];
  return anyModel.sequelize;
}

// 1) Jegyek eloszlása – beiratkozas.jegy alapján
router.get('/grades', async (req, res) => {
  try {
    const sequelize = getSequelize(req);
    const [rows] = await sequelize.query(`
      SELECT b.jegy AS jegy, COUNT(*) AS db
      FROM beiratkozas b
      WHERE b.jegy IS NOT NULL
      GROUP BY b.jegy
      ORDER BY b.jegy
    `);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'STATS_GRADES_FAILED' });
  }
});

// 2) Hallgatók száma szakonként
router.get('/by-szak', async (req, res) => {
  try {
    const sequelize = getSequelize(req);
    const [rows] = await sequelize.query(`
      SELECT h.szak AS szak, COUNT(*) AS db
      FROM hallgato h
      GROUP BY h.szak
      ORDER BY db DESC, szak
    `);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'STATS_BY_SZAK_FAILED' });
  }
});

// 3) Össz kredit hallgatónként – mindig JOIN-nal (nincs view-mágia)
router.get('/credits-per-student', async (req, res) => {
  try {
    const sequelize = getSequelize(req);

    const [rows] = await sequelize.query(`
      SELECT h.id,
             h.neptun,
             h.nev,
             COALESCE(SUM(t.kredit), 0) AS ossz_kredit
      FROM hallgato h
      LEFT JOIN beiratkozas b ON b.hallgato_id = h.id
      LEFT JOIN kurzus k      ON k.id = b.kurzus_id
      LEFT JOIN tantargy t    ON t.id = k.tantargy_id
      GROUP BY h.id, h.neptun, h.nev
      ORDER BY ossz_kredit DESC, h.nev
    `);

    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'STATS_CREDITS_FAILED' });
  }
});

module.exports = router;
