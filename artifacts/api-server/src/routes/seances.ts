import { Router, type Request, type Response } from "express";
import { supabase } from "../lib/supabase.js";
import { verifyToken } from "../lib/auth.js";
import { sendWhatsAppMessage } from "../lib/whatsapp.js";

const router = Router();

function mapSeance(r: any) {
  return {
    id: r.id,
    coachUsername: r.coach_username || "",
    date: r.date || "",
    categorie: r.categorie || "",
    groupName: r.group_name || "",
    activityType: r.activity_type || "",
    studentCount: r.student_count || "0",
    objective: r.objective || "",
    materials: r.materials || "",
    status: r.status || "Pending",
    prepTasks: r.prep_tasks || "[]",
  };
}

const VALID_CATEGORIES = ["Mini Maker", "Junior", "Cadets", "Senior"];

router.get("/seances", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }

  try {
    const { data, error } = await supabase.from("seances").select("*").order("created_at", { ascending: true });
    if (error) throw error;

    let seances = (data ?? []).map(mapSeance);

    if (payload.role === "Coach") {
      seances = seances.filter((s) => s.coachUsername.toLowerCase() === payload.username.toLowerCase());
    } else if (payload.role === "User") {
      // A séance targeting a specific group only appears for members of that
      // group; a séance with no group (groupName empty) targets the whole
      // category, preserving the old behavior for users not yet grouped.
      const { data: me } = await supabase.from("users").select("group_name").ilike("username", payload.username).maybeSingle();
      const myGroup = (me?.group_name || "").toLowerCase();
      seances = seances.filter((s) =>
        s.status === "Approved" &&
        s.categorie.toLowerCase() === (payload.categorie || "").toLowerCase() &&
        (!s.groupName || s.groupName.toLowerCase() === myGroup)
      );
    }

    const { coach, categorie, status } = req.query as Record<string, string>;
    if (coach && payload.role === "Admin") seances = seances.filter((s) => s.coachUsername.toLowerCase() === coach.toLowerCase());
    if (categorie && payload.role === "Admin") seances = seances.filter((s) => s.categorie.toLowerCase() === categorie.toLowerCase());
    if (status) seances = seances.filter((s) => s.status === status);

    res.json(seances);
  } catch (err: any) {
    req.log.error({ err }, "seances fetch error");
    res.status(500).json({ error: err.message });
  }
});

// POST /seances — Admin creates a séance slot (date + catégorie required).
// Coach assignment, group, and activity details can be left blank and filled
// in later: the admin assigns a coach/group via PATCH /seances/:id, the
// coach fills in the rest via PATCH /seances/:id/details (which puts it in
// "AwaitingApproval"), and the admin approves/rejects it via
// PATCH /seances/:id/status. Only "Approved" séances are visible to users.
router.post("/seances", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload || payload.role !== "Admin") {
    res.status(401).json({ error: "Non autorisé" });
    return;
  }

  const { date, categorie, activityType, studentCount, objective, materials, prepTasks, groupName, coachUsername } = req.body;

  if (!date || !categorie) {
    res.status(400).json({ error: "Champs requis manquants" });
    return;
  }

  if (categorie && !VALID_CATEGORIES.includes(categorie)) {
    res.status(400).json({ error: `Catégorie invalide. Valeurs: ${VALID_CATEGORIES.join(", ")}` });
    return;
  }

  try {
    const id = `S${Date.now()}`;
    const { error } = await supabase.from("seances").insert({
      id, coach_username: coachUsername || "", date, categorie,
      group_name: groupName || "",
      activity_type: activityType || "",
      student_count: studentCount || "0",
      objective: objective || "",
      materials: materials || "",
      status: "Pending",
      prep_tasks: prepTasks || "[]",
    });
    if (error) throw error;
    res.status(201).json({ success: true });
  } catch (err: any) {
    req.log.error({ err }, "seance create error");
    res.status(500).json({ error: err.message });
  }
});

// PATCH /seances/:id — Admin edits the slot's schedule/targeting/coach.
router.patch("/seances/:id", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload || payload.role !== "Admin") {
    res.status(401).json({ error: "Non autorisé" });
    return;
  }

  const id = req.params["id"] as string;
  const { date, categorie, groupName, coachUsername } = req.body as {
    date?: string; categorie?: string; groupName?: string; coachUsername?: string;
  };

  if (categorie && !VALID_CATEGORIES.includes(categorie)) {
    res.status(400).json({ error: `Catégorie invalide. Valeurs: ${VALID_CATEGORIES.join(", ")}` });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (date !== undefined) updates.date = date;
  if (categorie !== undefined) updates.categorie = categorie;
  if (groupName !== undefined) updates.group_name = groupName;
  if (coachUsername !== undefined) updates.coach_username = coachUsername;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "Aucun champ à mettre à jour" });
    return;
  }

  try {
    const { error } = await supabase.from("seances").update(updates).eq("id", id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    req.log.error({ err }, "seance update error");
    res.status(500).json({ error: err.message });
  }
});

// PATCH /seances/:id/details — Coach (owner) or Admin fills in the activity
// details for a slot the admin created. Marks the séance "AwaitingApproval"
// so the admin can review and approve/reject it — it only becomes visible to
// users once an admin approves it via PATCH /seances/:id/status. Works both
// for a first submission (from "Pending") and a resubmission after a
// rejection (from "Rejected").
router.patch("/seances/:id/details", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload || (payload.role !== "Coach" && payload.role !== "Admin")) {
    res.status(401).json({ error: "Non autorisé" });
    return;
  }

  const id = req.params["id"] as string;
  const { activityType, studentCount, objective, materials, prepTasks } = req.body as {
    activityType?: string; studentCount?: string; objective?: string; materials?: string; prepTasks?: string;
  };

  if (!activityType) {
    res.status(400).json({ error: "Le type d'activité est requis" });
    return;
  }

  try {
    if (payload.role === "Coach") {
      const { data: seance, error: fetchErr } = await supabase
        .from("seances").select("coach_username").eq("id", id).maybeSingle();
      if (fetchErr) throw fetchErr;
      if (!seance) { res.status(404).json({ error: "Séance introuvable" }); return; }
      if (seance.coach_username?.toLowerCase() !== payload.username.toLowerCase()) {
        res.status(403).json({ error: "Vous n'êtes pas assigné à cette séance" });
        return;
      }
    }

    const updates: Record<string, unknown> = {
      activity_type: activityType,
      status: "AwaitingApproval",
    };
    if (studentCount !== undefined) updates.student_count = studentCount || "0";
    if (objective !== undefined) updates.objective = objective;
    if (materials !== undefined) updates.materials = materials;
    if (prepTasks !== undefined) updates.prep_tasks = prepTasks;

    const { error } = await supabase.from("seances").update(updates).eq("id", id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    req.log.error({ err }, "seance details update error");
    res.status(500).json({ error: err.message });
  }
});

// Fixed weekly recurring slots (day of week uses JS Date.getDay(): 0=Sun..6=Sat).
const RECURRING_SLOTS: { day: number; time: string }[] = [
  { day: 3, time: "17:00" }, // Mercredi 17h-19h
  { day: 5, time: "17:00" }, // Vendredi 17h-19h
  { day: 6, time: "09:00" }, // Samedi 09h-13h
  { day: 6, time: "11:00" }, // Samedi 11h-13h
  { day: 6, time: "15:00" }, // Samedi 15h-17h
  { day: 6, time: "15:00" }, // Samedi 15h-19h (duplicate time slot on purpose: two parallel sessions)
];

// POST /seances/generate-recurring — Admin generates recurring slots (one séance
// per category per slot) for the next N weeks, repeating either the built-in
// default weekly schedule or a custom weekly template supplied by the admin
// (fill in one week's slots once, then "copy" it forward across N weeks/months).
// Idempotent: skips any (date, categorie) combination that already exists so it
// can be re-run safely to extend the schedule further into the future.
router.post("/seances/generate-recurring", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload || payload.role !== "Admin") {
    res.status(401).json({ error: "Non autorisé" });
    return;
  }

  const { weeksAhead, slots } = req.body as {
    weeksAhead?: number;
    slots?: { day: number; time: string; categorie: string; groupName?: string }[];
  };
  const parsedWeeks = Number(weeksAhead);
  const weeks = Math.min(Math.max(Number.isFinite(parsedWeeks) ? Math.trunc(parsedWeeks) : 12, 1), 52);

  if (!Array.isArray(slots) || slots.length === 0) {
    res.status(400).json({ error: "Le modèle de semaine est requis (au moins un créneau)." });
    return;
  }

  const template = slots.filter(
    (s) =>
      s &&
      Number.isInteger(s.day) &&
      s.day >= 0 &&
      s.day <= 6 &&
      typeof s.time === "string" &&
      /^\d{2}:\d{2}$/.test(s.time) &&
      VALID_CATEGORIES.includes(s.categorie)
  );

  if (template.length === 0) {
    res.status(400).json({ error: "Le modèle de semaine fourni est invalide (catégorie inconnue ou format incorrect)." });
    return;
  }

  try {
    const { data: existingRows, error: fetchErr } = await supabase.from("seances").select("date, categorie, group_name");
    if (fetchErr) throw fetchErr;
    const existing = new Set(
      (existingRows ?? []).map((r: any) => `${r.date}::${(r.categorie || "").toLowerCase()}::${(r.group_name || "").toLowerCase()}`)
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const toInsert: Record<string, unknown>[] = [];
    for (let w = 0; w < weeks; w++) {
      for (const slot of template) {
        const d = new Date(today);
        const diff = (slot.day - d.getDay() + 7) % 7;
        d.setDate(d.getDate() + diff + w * 7);
        const [h, m] = slot.time.split(":").map(Number);
        d.setHours(h, m, 0, 0);
        const iso = d.toISOString();
        const groupName = slot.groupName ?? "";

        const key = `${iso}::${slot.categorie.toLowerCase()}::${groupName.toLowerCase()}`;
        if (existing.has(key)) continue;
        existing.add(key);
        toInsert.push({
          id: `S${Date.now()}${Math.random().toString(36).slice(2, 8)}`,
          coach_username: "",
          date: iso,
          categorie: slot.categorie,
          group_name: groupName,
          activity_type: "",
          student_count: "0",
          objective: "",
          materials: "",
          status: "Pending",
          prep_tasks: "[]",
        });
      }
    }

    if (toInsert.length > 0) {
      const { error: insertErr } = await supabase.from("seances").insert(toInsert);
      if (insertErr) throw insertErr;
    }

    res.json({ success: true, created: toInsert.length });
  } catch (err: any) {
    req.log.error({ err }, "seance generate-recurring error");
    res.status(500).json({ error: err.message });
  }
});

// DELETE /seances/:id — Coach (owner) or Admin permanently deletes a single séance.
router.delete("/seances/:id", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload || (payload.role !== "Coach" && payload.role !== "Admin")) {
    res.status(401).json({ error: "Non autorisé" });
    return;
  }

  const id = req.params["id"] as string;

  try {
    const { data: seance, error: fetchErr } = await supabase
      .from("seances")
      .select("coach_username")
      .eq("id", id)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!seance) { res.status(404).json({ error: "Séance introuvable" }); return; }

    // Coaches can only delete their own séances
    if (payload.role === "Coach" && seance.coach_username?.toLowerCase() !== payload.username.toLowerCase()) {
      res.status(403).json({ error: "Vous ne pouvez supprimer que vos propres séances" });
      return;
    }

    // Also delete any presence records for this séance to avoid orphaned rows
    await supabase.from("presence").delete().eq("seance_id", id);

    const { error } = await supabase.from("seances").delete().eq("id", id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    req.log.error({ err }, "seance delete error");
    res.status(500).json({ error: err.message });
  }
});

// DELETE /seances — Admin deletes séances from today onwards.
// Optional query params:
//   categorie  — restrict to a specific category
//   groupName  — restrict to a specific group (requires categorie)
//   scope      — "all" deletes every séance including past ones (use with care)
router.delete("/seances", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload || payload.role !== "Admin") {
    res.status(401).json({ error: "Non autorisé" });
    return;
  }

  const { categorie, groupName, scope } = req.query as Record<string, string>;

  try {
    let query = supabase.from("seances").delete({ count: "exact" });

    // By default only delete from today onwards; "all" scope removes everything.
    if (scope !== "all") {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      query = query.gte("date", todayStart.toISOString());
    } else {
      // Supabase requires at least one filter on a delete — use a tautology.
      query = query.neq("id", "");
    }

    if (categorie) {
      query = query.eq("categorie", categorie);
    }
    if (groupName) {
      query = query.eq("group_name", groupName);
    }

    const { error, count } = await query;
    if (error) throw error;
    res.json({ success: true, deleted: count ?? 0 });
  } catch (err: any) {
    req.log.error({ err }, "seances clear error");
    res.status(500).json({ error: err.message });
  }
});

router.patch("/seances/:id/status", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload || payload.role !== "Admin") {
    res.status(401).json({ error: "Non autorisé" });
    return;
  }

  const id = req.params["id"] as string;
  const { status } = req.body as { status: string };
  const VALID_STATUSES = ["Pending", "AwaitingApproval", "Approved", "Rejected"];

  if (!status || !VALID_STATUSES.includes(status)) {
    res.status(400).json({ error: `Status invalide. Valeurs: ${VALID_STATUSES.join(", ")}` });
    return;
  }

  try {
    const { error } = await supabase.from("seances").update({ status }).eq("id", id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    req.log.error({ err }, "seance status update error");
    res.status(500).json({ error: err.message });
  }
});

// PATCH /seances/:id/cancel — coach cancels their own approved seance.
// Sets status to "Cancelled" and notifies all enrolled users in that category.
router.patch("/seances/:id/cancel", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload || (payload.role !== "Coach" && payload.role !== "Admin")) {
    res.status(401).json({ error: "Non autorisé" });
    return;
  }

  const id = req.params["id"] as string;

  try {
    const { data: seance, error: fetchErr } = await supabase
      .from("seances")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!seance) { res.status(404).json({ error: "Séance introuvable" }); return; }

    // Coaches can only cancel their own seances
    if (payload.role === "Coach" && seance.coach_username?.toLowerCase() !== payload.username.toLowerCase()) {
      res.status(403).json({ error: "Vous ne pouvez annuler que vos propres séances" });
      return;
    }

    const { error: updateErr } = await supabase.from("seances").update({ status: "Cancelled" }).eq("id", id);
    if (updateErr) throw updateErr;

    res.json({ success: true });

    // Only notify parents if this séance was ever visible to users (Approved).
    // A Pending draft slot (no coach details yet, or an empty admin-created
    // slot) was never shown to anyone, so cancelling it should stay silent.
    if (seance.status !== "Approved") return;

    // Send WA notifications to parents of users in this category (fire-and-forget)
    setImmediate(async () => {
      try {
        let notifyQuery = supabase
          .from("users")
          .select("nom, prenom, numero_parent")
          .eq("categorie", seance.categorie);
        if (seance.group_name) notifyQuery = notifyQuery.eq("group_name", seance.group_name);
        const { data: users } = await notifyQuery;

        const dateStr = seance.date
          ? new Date(seance.date).toLocaleString("fr-MA", { dateStyle: "full", timeStyle: "short" })
          : "";

        for (const u of users ?? []) {
          if (!u.numero_parent) continue;
          const msg = `❌ *Séance Annulée — Mosaic Workshops*\n\nBonjour,\n\nLa séance *${seance.activity_type}* (${seance.categorie}) prévue le *${dateStr}* a été annulée.\n\nNous vous informerons de la prochaine date.\n\nMerci de votre compréhension.`;
          await sendWhatsAppMessage(u.numero_parent, msg).catch(() => {});
        }
      } catch { /* notifications best-effort */ }
    });
  } catch (err: any) {
    req.log.error({ err }, "seance cancel error");
    res.status(500).json({ error: err.message });
  }
});

export default router;
