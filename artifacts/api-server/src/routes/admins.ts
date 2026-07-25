import { Router, type Request, type Response } from "express";
import { supabase } from "../lib/supabase.js";
import { verifyToken, hashPassword } from "../lib/auth.js";

const router = Router();

router.get("/admins", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload || payload.role !== "Admin") {
    res.status(403).json({ error: "Réservé aux administrateurs" });
    return;
  }

  try {
    const { data, error } = await supabase.from("admins").select("username");
    if (error) throw error;
    res.json((data ?? []).map((r: any) => ({ username: r.username || "" })));
  } catch (err: any) {
    req.log.error({ err }, "admins fetch error");
    res.status(500).json({ error: err.message });
  }
});

router.post("/admins", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload || payload.role !== "Admin") {
    res.status(401).json({ error: "Non autorisé" });
    return;
  }

  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: "username et password requis" });
    return;
  }

  try {
    const hashedPwd = await hashPassword(password);
    const { error } = await supabase.from("admins").insert({ username, password: hashedPwd });
    if (error) throw error;
    res.status(201).json({ success: true });
  } catch (err: any) {
    req.log.error({ err }, "admin create error");
    res.status(500).json({ error: err.message });
  }
});

export default router;
