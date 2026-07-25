import { Router, type Request, type Response } from "express";
import { supabase } from "../lib/supabase.js";
import { verifyToken, hashPassword } from "../lib/auth.js";

const router = Router();

router.get("/coaches", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload || payload.role !== "Admin") {
    res.status(403).json({ error: "Réservé aux administrateurs" });
    return;
  }

  try {
    const { data, error } = await supabase.from("coaches").select("*");
    if (error) throw error;
    res.json((data ?? []).map((r: any) => ({ username: r.username || "", nom: r.nom || "" })));
  } catch (err: any) {
    req.log.error({ err }, "coaches fetch error");
    res.status(500).json({ error: err.message });
  }
});

router.patch("/coaches/:username", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload || payload.role !== "Admin") {
    res.status(401).json({ error: "Non autorisé" });
    return;
  }

  const username = req.params["username"] as string;
  const { nom, password } = req.body as { nom?: string; password?: string };

  try {
    const updates: Record<string, unknown> = {};
    if (nom) updates.nom = nom;
    if (password) updates.password = await hashPassword(password);

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "Aucun champ à mettre à jour" });
      return;
    }

    const { error } = await supabase.from("coaches").update(updates).ilike("username", username);
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    req.log.error({ err }, "coach update error");
    res.status(500).json({ error: err.message });
  }
});

router.delete("/coaches/:username", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload || payload.role !== "Admin") {
    res.status(401).json({ error: "Non autorisé" });
    return;
  }

  const username = req.params["username"] as string;

  try {
    const { error } = await supabase.from("coaches").delete().ilike("username", username);
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    req.log.error({ err }, "coach delete error");
    res.status(500).json({ error: err.message });
  }
});

router.post("/coaches", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload || payload.role !== "Admin") {
    res.status(401).json({ error: "Non autorisé" });
    return;
  }

  const { username, nom, password } = req.body;
  if (!username || !nom || !password) {
    res.status(400).json({ error: "username, nom et password requis" });
    return;
  }

  try {
    const hashedPwd = await hashPassword(password);
    const { error } = await supabase.from("coaches").insert({ username, nom, password: hashedPwd });
    if (error) throw error;
    res.status(201).json({ success: true });
  } catch (err: any) {
    req.log.error({ err }, "coach create error");
    res.status(500).json({ error: err.message });
  }
});

export default router;
