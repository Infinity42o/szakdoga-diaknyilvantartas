import "dotenv/config";
import mysql from "mysql2/promise";

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASS || "",
    database: process.env.DB_NAME || "diaknyilvantartas",
    port: Number(process.env.DB_PORT || 3306),
  });

  const [rows] = await conn.query("SELECT COUNT(*) AS db FROM hallgato");
  console.log("Hallgatók száma:", rows[0].db);

  const [ver] = await conn.query("SELECT VERSION() AS version");
  console.log("MySQL verzió:", ver[0].version);

  await conn.end();
}

main().catch((err) => {
  console.error("Hiba:", err.message);
  process.exit(1);
});
