import { Router, type Request, type Response } from "express";
import { verifyToken } from "../lib/auth.js";
import { getWhatsAppStatus, resetWhatsApp } from "../lib/whatsapp.js";

const router = Router();

// GET /whatsapp/status — Admin-only. Polled by the hidden admin panel to
// show the current connection state and, when disconnected, the QR code to
// scan.
router.get("/whatsapp/status", (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload || payload.role !== "Admin") {
    res.status(401).json({ error: "Non autorisé" });
    return;
  }
  res.json(getWhatsAppStatus());
});

// POST /whatsapp/reset — Admin-only. Logs out and wipes the persisted
// session so a new device can be linked. Expected to be used rarely
// (e.g. once a year, when the linked phone changes).
router.post("/whatsapp/reset", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload || payload.role !== "Admin") {
    res.status(401).json({ error: "Non autorisé" });
    return;
  }

  const result = await resetWhatsApp();
  if (!result.success) {
    res.status(500).json(result);
    return;
  }
  res.json(result);
});

export default router;
