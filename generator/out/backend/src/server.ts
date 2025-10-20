import "dotenv/config";
import express from "express";
import { sequelize } from "./models";
import beiratkozasRouter from "./routes/beiratkozas";
import hallgatoRouter from "./routes/hallgato";
import kurzusRouter from "./routes/kurzus";
import tanarRouter from "./routes/tanar";
import tantargyRouter from "./routes/tantargy";

const app = express();
app.use(express.json());

app.use("/api/beiratkozas", beiratkozasRouter);
app.use("/api/hallgato",    hallgatoRouter);
app.use("/api/kurzus",      kurzusRouter);
app.use("/api/tanar",       tanarRouter);
app.use("/api/tantargy",    tantargyRouter);

// (opcionális) hibakezelő middleware
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error("❌", err);
  res.status(Number(err?.status || err?.statusCode || 500)).json({ error: err?.message || "Internal Server Error" });
});

const port = Number(process.env.PORT || 3000);
async function main() {
  await sequelize.authenticate();
  app.listen(port, () => console.log(`✅ API listening on http://localhost:${port}`));
}
main();
