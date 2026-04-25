// Auto-generated Express app
const express = require('express');
const cors = require('cors');
const { sequelize, loadModels } = require('./db');
const dotenv = require('dotenv');

dotenv.config();

const statsRouter = require('./routes/stats.js');
const metaRouter = require('./routes/meta.js');

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
const beiratkozasRouter = require('./routes/beiratkozas.js');
app.use('/api/beiratkozas', beiratkozasRouter);

const hallgatoRouter = require('./routes/hallgato.js');
app.use('/api/hallgato', hallgatoRouter);

const kurzusRouter = require('./routes/kurzus.js');
app.use('/api/kurzus', kurzusRouter);

const tanarRouter = require('./routes/tanar.js');
app.use('/api/tanar', tanarRouter);

const tantargyRouter = require('./routes/tantargy.js');
app.use('/api/tantargy', tantargyRouter);

// Általános statisztikák + meta
app.use('/api/stats', statsRouter);
app.use('/api/meta', metaRouter);

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.listen(PORT, () => {
  console.log('Megy, API listening on port', PORT);
});
