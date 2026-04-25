const mysql = require("mysql2/promise");
require("dotenv").config();

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASS || "",
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 3306),
  });

  const [ver] = await conn.query("SELECT VERSION() AS version");
  console.log("MySQL verzió:", ver[0].version);

  const [tables] = await conn.query("SHOW TABLES");
  console.log("Táblák:", tables);

  const firstTable = tables.length ? Object.values(tables[0])[0] : null;

  if (firstTable) {
    const [rows] = await conn.query(`SELECT COUNT(*) AS db FROM \`${firstTable}\``);
    console.log(`Rekordok száma (${firstTable}):`, rows[0].db);
  } else {
    console.log("Nincs tábla az adatbázisban.");
  }

  await conn.end();
}

main().catch((err) => {
  console.error("Hiba a mysql2 használatakor:", err);
  process.exit(1);
});