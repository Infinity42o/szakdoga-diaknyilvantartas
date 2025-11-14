// Auto-generated DB index
const { Sequelize, DataTypes } = require('sequelize');

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
    models[mdl.getTableName()] = mdl; // kulcs: táblanév
  }
  Object.values(models).forEach(m => { if (m.associate) m.associate(models); });
  return models;
}

module.exports = { sequelize, loadModels };