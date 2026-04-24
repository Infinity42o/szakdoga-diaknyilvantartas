const mysql = require("mysql2/promise");
require("dotenv").config();

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASS || "",
    database: process.env.DB_NAME || "teszt_halado",
    port: Number(process.env.DB_PORT || 3306),
  });

  const [ver] = await conn.query("SELECT VERSION() AS version");
  console.log("MySQL verzió:", ver[0].version);

  const [tables] = await conn.query("SHOW TABLES");
  console.log("Táblák:", tables);

  const [rows] = await conn.query("SELECT COUNT(*) AS db FROM ugyfel");
  console.log("Ügyfelek száma:", rows[0].db);

  const [byCity] = await conn.query(`
    SELECT varos, COUNT(*) AS db
    FROM ugyfel
    GROUP BY varos
    ORDER BY db DESC, varos
  `);
  console.log("Ügyfelek városonként:", byCity);

  await conn.end();
}

main().catch((err) => {
  console.error("Hiba a mysql2 használatakor:", err);
  process.exit(1);
});