const mysql = require("mysql2/promise");
require("dotenv").config();

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASS || "",
    database: process.env.DB_NAME || "diaknyilvantartas",
    port: Number(process.env.DB_PORT || 3306),
  });

  // Egyszerű ellenőrzések
  const [rows] = await conn.query("SELECT COUNT(*) AS db FROM hallgato");
  console.log("Hallgatók száma:", rows[0].db);

  const [ver] = await conn.query("SELECT VERSION() AS version");
  console.log("MySQL verzió:", ver[0].version);

  // Extra „health check” lekérdezések
  const [bySzak] = await conn.query(`
    SELECT szak, COUNT(*) AS db
    FROM hallgato
    GROUP BY szak
    ORDER BY db DESC
  `);
  console.log("Hallgatók szakok szerint:", bySzak);

  const [jegyHist] = await conn.query(`
    SELECT b.jegy, COUNT(*) AS db
    FROM beiratkozas b
    WHERE b.jegy IS NOT NULL
    GROUP BY b.jegy
    ORDER BY b.jegy
  `);
  console.log("Jegy eloszlás:", jegyHist);

  await conn.end();
}

main().catch((err) => {
  console.error("Hiba a mysql2 használatakor:", err);
  process.exit(1);
});
