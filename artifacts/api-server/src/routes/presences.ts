import { Router, type Request, type Response } from "express";
import { supabase } from "../lib/supabase.js";
import { verifyToken } from "../lib/auth.js";

const router = Router();

function mapPresence(r: any) {
  return {
    id: r.id,
    date: r.date || "",
    seanceId: r.seance_id || "",
    categorie: r.categorie || "",
    studentUsername: r.student_username || "",
    status: r.status || "",
  };
}

router.get("/presences", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }

  try {
    const { data, error } = await supabase.from("presence").select("*").order("created_at", { ascending: true });
    if (error) throw error;

    let presences = (data ?? []).map(mapPresence);

    if (payload.role === "User") {
      presences = presences.filter((p) => p.studentUsername.toLowerCase() === payload.username.toLowerCase());
    } else if (payload.role === "Admin" || payload.role === "Coach") {
      const { username, seanceId } = req.query as { username?: string; seanceId?: string };
      if (username) presences = presences.filter((p) => p.studentUsername.toLowerCase() === username.toLowerCase());
      if (seanceId) presences = presences.filter((p) => p.seanceId === seanceId);
    }

    res.json(presences);
  } catch (err: any) {
    req.log.error({ err }, "presences fetch error");
    res.status(500).json({ error: err.message });
  }
});

const VALID_PRESENCE_STATUSES = ["Présent", "Absent", "Récupérer", "Excusé"];

router.post("/presences", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload || (payload.role !== "Coach" && payload.role !== "Admin")) {
    res.status(401).json({ error: "Non autorisé" });
    return;
  }

  const { date, seanceId, categorie, studentUsername, status } = req.body;
  if (!date || !seanceId || !categorie || !studentUsername || !status) {
    res.status(400).json({ error: "Champs requis manquants" });
    return;
  }

  if (!VALID_PRESENCE_STATUSES.includes(status)) {
    res.status(400).json({ error: `Statut invalide. Valeurs: ${VALID_PRESENCE_STATUSES.join(", ")}` });
    return;
  }

  try {
    const { data: seance, error: seanceError } = await supabase
      .from("seances")
      .select("coach_username")
      .eq("id", seanceId)
      .maybeSingle();
    if (seanceError) throw seanceError;
    if (!seance) { res.status(404).json({ error: "Séance introuvable" }); return; }
    // Coaches can only record presence for their own séances; admins can record for any.
    if (payload.role === "Coach" && seance.coach_username.toLowerCase() !== payload.username.toLowerCase()) {
      res.status(403).json({ error: "Accès refusé" }); return;
    }

    const { error } = await supabase.from("presence").insert({ date, seance_id: seanceId, categorie, student_username: studentUsername, status });
    if (error) throw error;
    res.status(201).json({ success: true });
  } catch (err: any) {
    req.log.error({ err }, "presence create error");
    res.status(500).json({ error: err.message });
  }
});

// POST /presences/bulk — upsert presences for an entire séance in one call.
// Coach (owner of the séance) or Admin: presence can be filled or corrected
// by the coach who ran the session, or by an admin.
// Each entry is inserted if no presence exists yet for (seance_id, student_username),
// or updated if one already does.
router.post("/presences/bulk", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload || (payload.role !== "Coach" && payload.role !== "Admin")) {
    res.status(401).json({ error: "Non autorisé" });
    return;
  }

  const { seanceId, entries } = req.body as {
    seanceId?: string;
    entries?: { studentUsername: string; status: string }[];
  };

  if (!seanceId || !Array.isArray(entries) || entries.length === 0) {
    res.status(400).json({ error: "seanceId et entries requis" });
    return;
  }

  if (entries.some((e) => e.status && !VALID_PRESENCE_STATUSES.includes(e.status))) {
    res.status(400).json({ error: `Statut invalide. Valeurs: ${VALID_PRESENCE_STATUSES.join(", ")}` });
    return;
  }

  try {
    const { data: seance, error: seanceErr } = await supabase
      .from("seances")
      .select("date, categorie, coach_username")
      .eq("id", seanceId)
      .maybeSingle();
    if (seanceErr) throw seanceErr;
    if (!seance) { res.status(404).json({ error: "Séance introuvable" }); return; }

    // Coaches can only save presences for their own séances; admins can edit any.
    if (payload.role === "Coach" && seance.coach_username?.toLowerCase() !== payload.username.toLowerCase()) {
      res.status(403).json({ error: "Accès refusé" });
      return;
    }

    const { data: existing, error: fetchErr } = await supabase
      .from("presence")
      .select("id, student_username")
      .eq("seance_id", seanceId);
    if (fetchErr) throw fetchErr;

    const existingMap = new Map((existing ?? []).map((r: any) => [r.student_username?.toLowerCase(), r.id]));
    let saved = 0;

    for (const entry of entries) {
      if (!entry.studentUsername || !entry.status) continue;
      const existingId = existingMap.get(entry.studentUsername.toLowerCase());

      if (existingId) {
        await supabase.from("presence").update({ status: entry.status }).eq("id", existingId);
      } else {
        await supabase.from("presence").insert({
          date: seance.date,
          seance_id: seanceId,
          categorie: seance.categorie,
          student_username: entry.studentUsername,
          status: entry.status,
        });
      }
      saved++;
    }

    res.json({ success: true, saved });
  } catch (err: any) {
    req.log.error({ err }, "bulk presences error");
    res.status(500).json({ error: err.message });
  }
});

export default router;
