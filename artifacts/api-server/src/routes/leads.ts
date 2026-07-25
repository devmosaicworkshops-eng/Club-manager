import { Router, type Request, type Response } from "express";
import { verifyToken } from "../lib/auth.js";
import { getAllLeads, deleteLeadByKey } from "../lib/sheets-leads.js";

const router = Router();

router.get("/leads", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload || payload.role !== "Admin") {
    res.status(401).json({ error: "Non autorisé" });
    return;
  }

  try {
    const leads = await getAllLeads();
    res.json(leads);
  } catch (err: any) {
    req.log.error({ err }, "leads fetch error");
    res.status(500).json({ error: err.message || "Erreur serveur" });
  }
});

// DELETE /leads/by-key — delete a Google Sheet lead row directly (used when the
// lead has no pipeline entry yet, so there is nothing else to clean up)
router.delete("/leads/by-key", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload || payload.role !== "Admin") {
    res.status(401).json({ error: "Non autorisé" });
    return;
  }

  const { rowKey } = req.body as { rowKey?: string };
  if (!rowKey) {
    res.status(400).json({ error: "rowKey requis" });
    return;
  }

  try {
    await deleteLeadByKey(rowKey);
    res.status(204).end();
  } catch (err: any) {
    req.log.error({ err }, "leads sheet delete error");
    res.status(500).json({ error: err.message || "Erreur serveur" });
  }
});

export default router;
