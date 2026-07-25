import { Router, type Request, type Response } from "express";
import { supabase } from "../lib/supabase.js";
import { verifyToken } from "../lib/auth.js";

const router = Router();

function mapGroup(r: Record<string, unknown>, memberCount = 0) {
  return {
    id: r.id as string,
    categorie: (r.categorie as string) || "",
    name: (r.name as string) || "",
    memberCount,
    createdAt: (r.created_at as string) || "",
  };
}

// GET /groups?categorie=Junior
router.get("/groups", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }

  const { categorie } = req.query as { categorie?: string };

  try {
    let query = supabase.from("groups").select("*").order("name", { ascending: true });
    if (categorie) query = query.eq("categorie", categorie);
    const { data: groups, error } = await query;
    if (error) throw error;

    // Count members per group (users sharing categorie + group name).
    const { data: users, error: usersErr } = await supabase
      .from("users")
      .select("categorie, group_name");
    if (usersErr) throw usersErr;

    const counts = new Map<string, number>();
    for (const u of users ?? []) {
      const key = `${(u.categorie || "").toLowerCase()}::${(u.group_name || "").toLowerCase()}`;
      if (!u.group_name) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const result = (groups ?? []).map((g) => {
      const key = `${(g.categorie || "").toLowerCase()}::${(g.name || "").toLowerCase()}`;
      return mapGroup(g, counts.get(key) ?? 0);
    });

    res.json(result);
  } catch (err: unknown) {
    req.log.error({ err }, "groups fetch error");
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /groups — create a group scoped to a category
router.post("/groups", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload || payload.role !== "Admin") {
    res.status(401).json({ error: "Non autorisé" });
    return;
  }

  const { categorie, name } = req.body as { categorie?: string; name?: string };
  if (!categorie || !name) {
    res.status(400).json({ error: "categorie et name requis" });
    return;
  }

  try {
    const { data, error } = await supabase
      .from("groups")
      .insert({ categorie, name })
      .select()
      .single();
    if (error) {
      // unique(categorie, name) violation
      if ((error as { code?: string }).code === "23505") {
        res.status(409).json({ error: "Un groupe avec ce nom existe déjà dans cette catégorie" });
        return;
      }
      throw error;
    }
    res.status(201).json(mapGroup(data as Record<string, unknown>, 0));
  } catch (err: unknown) {
    req.log.error({ err }, "group create error");
    res.status(500).json({ error: (err as Error).message });
  }
});

// DELETE /groups/:id — delete the group; members are NOT deleted, they simply
// become ungrouped (their users.group text field keeps its old value, but since
// the group catalogue entry is gone it will show up under "non assignés" once
// the admin also clears each member's group, or immediately if the frontend
// treats orphaned group names as ungrouped). We proactively clear members'
// group field here so the UI stays consistent with the groups catalogue.
router.delete("/groups/:id", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload || payload.role !== "Admin") {
    res.status(401).json({ error: "Non autorisé" });
    return;
  }

  const id = req.params["id"] as string;

  try {
    const { data: group, error: fetchErr } = await supabase
      .from("groups")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!group) {
      res.status(404).json({ error: "Groupe introuvable" });
      return;
    }

    const { error: clearErr } = await supabase
      .from("users")
      .update({ group_name: "" })
      .eq("categorie", group.categorie)
      .eq("group_name", group.name);
    if (clearErr) throw clearErr;

    const { error: deleteErr } = await supabase.from("groups").delete().eq("id", id);
    if (deleteErr) throw deleteErr;

    res.json({ success: true });
  } catch (err: unknown) {
    req.log.error({ err }, "group delete error");
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
