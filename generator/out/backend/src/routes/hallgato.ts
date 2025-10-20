import { Router } from "express";
import { models } from "../models";

const router = Router();
const M = (models as any).Hallgato || (models as any).hallgato;

router.get("/", async (_req, res) => {
  const rows = await M.findAll();
  res.json(rows);
});

router.get("/:id", async (req, res) => {
  const row = await M.findByPk(req.params.id as any);
  if (!row) return res.status(404).end();
  res.json(row);
});

router.post("/", async (req, res) => {
  const created = await M.create(req.body);
  res.status(201).json(created);
});

router.put("/:id", async (req, res) => {
  const row = await M.findByPk(req.params.id as any);
  if (!row) return res.status(404).end();
  await row.update(req.body);
  res.json(row);
});

router.delete("/:id", async (req, res) => {
  const row = await M.findByPk(req.params.id as any);
  if (!row) return res.status(404).end();
  await row.destroy();
  res.status(204).end();
});

export default router;
