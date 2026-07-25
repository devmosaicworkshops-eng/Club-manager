import { Router, type Request, type Response } from "express";
import { supabase } from "../lib/supabase.js";
import { verifyToken } from "../lib/auth.js";

const router = Router();

function mapPhoto(r: any) {
  return {
    id: r.id || "",
    url: r.image_url || "",
    caption: r.description || "",
    uploadedAt: r.created_at || "",
    studentUsername: r.student_username || null,
    seanceId: r.seance_id || null,
  };
}

// GET /gallery
// - Admin: all photos; optional ?studentUsername= and ?seanceId= filters
// - Coach: all photos (same as admin, read-only)
// - User: only photos tagged with their username
router.get("/gallery", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload) { res.status(401).json({ error: "Non authentifié" }); return; }

  try {
    let query = supabase.from("gallery").select("*").order("created_at", { ascending: false });

    if (payload.role === "User") {
      // Students only see photos assigned to them
      query = query.eq("student_username", payload.username);
    } else {
      // Admins/coaches can filter by student or seance
      const { studentUsername, seanceId } = req.query as { studentUsername?: string; seanceId?: string };
      if (studentUsername) query = query.eq("student_username", studentUsername);
      if (seanceId) query = query.eq("seance_id", seanceId);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json((data ?? []).map(mapPhoto));
  } catch (err: any) {
    req.log.error({ err }, "gallery fetch error");
    res.status(500).json({ error: err.message });
  }
});

// POST /gallery — Admin uploads a photo and assigns it to a student
router.post("/gallery", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload || payload.role !== "Admin") { res.status(401).json({ error: "Non autorisé" }); return; }

  const { url, caption, studentUsername, seanceId } = req.body as {
    url?: string;
    caption?: string;
    studentUsername?: string;
    seanceId?: string;
  };

  if (!url) { res.status(400).json({ error: "url requis" }); return; }

  try {
    const { data, error } = await supabase
      .from("gallery")
      .insert({
        image_url: url,
        description: caption || "",
        student_username: studentUsername || null,
        seance_id: seanceId || null,
      })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(mapPhoto(data));
  } catch (err: any) {
    req.log.error({ err }, "gallery create error");
    res.status(500).json({ error: err.message });
  }
});

// DELETE /gallery/:id — Admin removes a photo
router.delete("/gallery/:id", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload || payload.role !== "Admin") { res.status(401).json({ error: "Non autorisé" }); return; }

  const { id } = req.params as { id: string };
  try {
    const { error } = await supabase.from("gallery").delete().eq("id", id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    req.log.error({ err }, "gallery delete error");
    res.status(500).json({ error: err.message });
  }
});

export default router;
