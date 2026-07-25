import { Router, type Request, type Response } from "express";
import { supabase } from "../lib/supabase.js";
import { verifyToken } from "../lib/auth.js";

const router = Router();

function mapEvent(r: any) {
  return {
    id: r.id || "",
    title: r.title || "",
    description: r.description || "",
    date: r.date || "",
    location: r.location || "",
    imageUrl: r.image_url || "",
  };
}

router.get("/events", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload) { res.status(401).json({ error: "Non authentifié" }); return; }

  try {
    const { data, error } = await supabase.from("events").select("*").order("date", { ascending: false });
    if (error) throw error;
    res.json((data ?? []).map(mapEvent));
  } catch (err: any) {
    req.log.error({ err }, "events fetch error");
    res.status(500).json({ error: err.message });
  }
});

router.post("/events", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload || payload.role !== "Admin") { res.status(401).json({ error: "Non autorisé" }); return; }

  const { title, description, date, location } = req.body;
  if (!title || !date) { res.status(400).json({ error: "title et date requis" }); return; }

  try {
    const { data, error } = await supabase.from("events").insert({ title, description: description || "", date, location: location || "" }).select().single();
    if (error) throw error;
    res.status(201).json(mapEvent(data));
  } catch (err: any) {
    req.log.error({ err }, "event create error");
    res.status(500).json({ error: err.message });
  }
});

router.patch("/events/:id", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload || payload.role !== "Admin") { res.status(401).json({ error: "Non autorisé" }); return; }

  const { id } = req.params;
  const { title, description, date, location } = req.body;

  const updates: Record<string, unknown> = {};
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (date !== undefined) updates.date = date;
  if (location !== undefined) updates.location = location;

  try {
    const { data, error } = await supabase.from("events").update(updates).eq("id", id).select().single();
    if (error) throw error;
    res.json(mapEvent(data));
  } catch (err: any) {
    req.log.error({ err }, "event update error");
    res.status(500).json({ error: err.message });
  }
});

router.delete("/events/:id", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload || payload.role !== "Admin") { res.status(401).json({ error: "Non autorisé" }); return; }

  const { id } = req.params;
  try {
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    req.log.error({ err }, "event delete error");
    res.status(500).json({ error: err.message });
  }
});

export default router;
