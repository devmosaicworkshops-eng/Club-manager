import { Router, type Request, type Response } from "express";
import { supabase } from "../lib/supabase.js";
import { verifyToken } from "../lib/auth.js";

const router = Router();

function mapSettings(r: Record<string, unknown>) {
  return {
    currentTrimester: (r.current_trimester as string) || "",
    currentAcademicYear: (r.current_academic_year as string) || "",
    updatedAt: (r.updated_at as string) || "",
  };
}

// GET /settings/trimester — the currently "open" trimester/year. Users
// without an active enrollment for this trimester+year are blocked at
// login (see auth.ts).
router.get("/settings/trimester", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }

  try {
    const { data, error } = await supabase.from("club_settings").select("*").eq("id", 1).maybeSingle();
    if (error) throw error;
    if (!data) {
      res.json({ currentTrimester: "", currentAcademicYear: "", updatedAt: "" });
      return;
    }
    res.json(mapSettings(data as Record<string, unknown>));
  } catch (err: unknown) {
    req.log.error({ err }, "settings fetch error");
    res.status(500).json({ error: (err as Error).message });
  }
});

// PUT /settings/trimester — Admin sets which trimester/year is currently
// active/open for enrollment.
router.put("/settings/trimester", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload || payload.role !== "Admin") {
    res.status(401).json({ error: "Non autorisé" });
    return;
  }

  const { currentTrimester, currentAcademicYear } = req.body as { currentTrimester?: string; currentAcademicYear?: string };
  if (!currentTrimester || !currentAcademicYear) {
    res.status(400).json({ error: "currentTrimester et currentAcademicYear requis" });
    return;
  }

  try {
    const { data, error } = await supabase
      .from("club_settings")
      .upsert({ id: 1, current_trimester: currentTrimester, current_academic_year: currentAcademicYear, updated_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw error;
    res.json(mapSettings(data as Record<string, unknown>));
  } catch (err: unknown) {
    req.log.error({ err }, "settings update error");
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /settings/trimester/auto — automatically activate the trimester that
// matches the current calendar month:
//   Oct–Dec  → T1  |  Jan–Mar → T2  |  Apr–Jun → T3  |  Jul–Sep → (summer, no change)
router.post("/settings/trimester/auto", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload || payload.role !== "Admin") {
    res.status(401).json({ error: "Non autorisé" });
    return;
  }

  const now = new Date();
  const month = now.getMonth() + 1; // 1-based

  let trimester: string | null = null;
  if (month >= 10) trimester = "T1";
  else if (month <= 3) trimester = "T2";
  else if (month <= 6) trimester = "T3";
  // July–September = summer break, no trimester to activate

  if (!trimester) {
    res.json({ skipped: true, reason: "Période de vacances (Jul–Sep) — aucun trimestre activé automatiquement." });
    return;
  }

  // Academic year: if Oct–Dec use current year; otherwise previous year starts the pair
  const yearStart = month >= 10 ? now.getFullYear() : now.getFullYear() - 1;
  const academicYear = `${yearStart}-${yearStart + 1}`;

  try {
    const { data, error } = await supabase
      .from("club_settings")
      .upsert({ id: 1, current_trimester: trimester, current_academic_year: academicYear, updated_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw error;
    res.json({ ...mapSettings(data as Record<string, unknown>), skipped: false });
  } catch (err: unknown) {
    req.log.error({ err }, "auto trimester error");
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
