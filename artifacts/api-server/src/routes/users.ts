import { Router, type Request, type Response } from "express";
import { supabase } from "../lib/supabase.js";
import { verifyToken, hashPassword, verifyPassword } from "../lib/auth.js";
import { computePaymentStatus } from "../lib/payment-status.js";
import { syncAccrual } from "../lib/accrual.js";
import { sendWhatsAppMessage } from "../lib/whatsapp.js";

const router = Router();

function mapUser(r: Record<string, unknown>, paymentStatus?: string, enrolled?: boolean) {
  return {
    username: (r.username as string) || "",
    nom: (r.nom as string) || "",
    prenom: (r.prenom as string) || "",
    dateNaissance: (r.date_naissance as string) || "",
    nomParent: (r.nom_parent as string) || "",
    numeroParent: (r.numero_parent as string) || "",
    categorie: (r.categorie as string) || "",
    group: (r.group_name as string) || "",
    paymentStatus: paymentStatus ?? (r.payment_status as string) ?? "",
    paymentType: (r.payment_type as string) || "",
    remarque: (r.remarque as string) || "",
    enrolled: enrolled ?? false,
  };
}

router.get("/users", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload || (payload.role !== "Admin" && payload.role !== "Coach")) {
    res.status(403).json({ error: "Réservé aux administrateurs et coachs" });
    return;
  }

  // Coaches only need basic user info (name, categorie, group) for the presence
  // editor — skip the expensive enrollment/payment computation.
  if (payload.role === "Coach") {
    try {
      const { data: users, error } = await supabase
        .from("users")
        .select("username, nom, prenom, categorie, group_name, date_naissance, nom_parent, numero_parent, remarque, payment_status, payment_type");
      if (error) throw error;
      res.json((users ?? []).map((u) => mapUser(u as Record<string, unknown>)));
    } catch (err: unknown) {
      req.log.error({ err }, "users fetch error (coach)");
      res.status(500).json({ error: (err as Error).message });
    }
    return;
  }

  try {
    const [usersRes, enrollmentsRes, settingsRes] = await Promise.all([
      supabase.from("users").select("*"),
      supabase
        .from("trimester_enrollments")
        .select("id, user_username, trimester, academic_year, amount_expected, amount_per_period, billing_start_date, payment_method, amount_received, suspension_status")
        .not("user_username", "is", null),
      supabase.from("club_settings").select("*").eq("id", 1).maybeSingle(),
    ]);
    if (usersRes.error) throw usersRes.error;
    if (enrollmentsRes.error) throw enrollmentsRes.error;

    const users = usersRes.data ?? [];
    const enrollments = await syncAccrual(enrollmentsRes.data ?? []);
    const settings = settingsRes.data as { current_trimester?: string; current_academic_year?: string } | null;

    const result = users.map((u) => {
      const username = (u as Record<string, unknown>).username as string;
      const userEnrollments = enrollments.filter(
        (e) => e.user_username?.toLowerCase() === username?.toLowerCase()
      );

      // Enrolled for the current trimester only when a settings row exists
      // and this user has a matching, non-suspended enrollment — same rule
      // as the login-time `enrolled` flag in auth.ts (`club_settings` is the
      // single source of truth, never a hardcoded trimester/year).
      const enrolled =
        !!settings?.current_trimester &&
        !!settings?.current_academic_year &&
        userEnrollments.some(
          (e) =>
            e.trimester === settings.current_trimester &&
            e.academic_year === settings.current_academic_year &&
            e.suspension_status === "Actif"
        );

      // Only compute a live payment status when the user actually has
      // enrollment/billing data — otherwise fall back to the stored
      // default so brand-new accounts don't show "En attente" incorrectly.
      if (userEnrollments.length === 0) {
        return mapUser(u, undefined, enrolled);
      }

      const totalExpected = userEnrollments.reduce((s, e) => s + Number(e.amount_expected ?? 0), 0);
      const totalReceived = userEnrollments.reduce((s, e) => s + Number(e.amount_received ?? 0), 0);
      return mapUser(u, computePaymentStatus(totalExpected, totalReceived), enrolled);
    });

    res.json(result);
  } catch (err: unknown) {
    req.log.error({ err }, "users fetch error");
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post("/users", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload || payload.role !== "Admin") {
    res.status(401).json({ error: "Non autorisé" });
    return;
  }

  const { username, password, nom, prenom, dateNaissance, nomParent, numeroParent, categorie, group, paymentStatus, paymentType, remarque } = req.body as Record<string, string>;

  if (!username || !password || !nom || !prenom) {
    res.status(400).json({ error: "username, password, nom et prenom requis" });
    return;
  }

  try {
    const hashedPwd = await hashPassword(password);
    const { error } = await supabase.from("users").insert({
      username, password: hashedPwd, nom, prenom,
      date_naissance: dateNaissance || "",
      nom_parent: nomParent || "",
      numero_parent: numeroParent || "",
      categorie: categorie || "",
      // Left empty ("") means "ungrouped" — the admin can assign a group
      // later from the Users page, or right now via this optional field.
      group_name: group || "",
      payment_status: paymentStatus || "En attente",
      payment_type: paymentType || "Trimestriel",
      remarque: remarque || "",
    });
    if (error) throw error;
    res.status(201).json({ success: true });

    // Send login credentials to the parent's WhatsApp number, best-effort —
    // never block or fail account creation because of this.
    if (numeroParent) {
      const body =
        `🎓 *Mosaic Workshops*\n` +
        `Le compte de ${prenom} ${nom} a été créé !\n\n` +
        `Identifiant: ${username}\n` +
        `Mot de passe: ${password}\n\n` +
        `Vous pouvez vous connecter sur la plateforme dès maintenant.`;
      sendWhatsAppMessage(numeroParent, body)
        .then((result) => {
          if (!result.success) {
            req.log.warn({ username, error: result.error }, "user create: WhatsApp credentials send failed");
          }
        })
        .catch((err) => req.log.error({ err, username }, "user create: WhatsApp credentials send threw"));
    } else {
      req.log.warn({ username }, "user create: no numeroParent, skipping WhatsApp credentials send");
    }
  } catch (err: unknown) {
    req.log.error({ err }, "user create error");
    res.status(500).json({ error: (err as Error).message });
  }
});

// PATCH /users/:username — update profile fields (admin only)
router.patch("/users/:username", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload || payload.role !== "Admin") {
    res.status(401).json({ error: "Non autorisé" });
    return;
  }

  const username = req.params["username"] as string;
  const body = req.body as Record<string, string | undefined>;

  const updates: Record<string, unknown> = {};
  if (body.nom !== undefined) updates.nom = body.nom;
  if (body.prenom !== undefined) updates.prenom = body.prenom;
  if (body.categorie !== undefined) updates.categorie = body.categorie;
  if (body.group !== undefined) updates.group_name = body.group;
  if (body.dateNaissance !== undefined) updates.date_naissance = body.dateNaissance;
  if (body.nomParent !== undefined) updates.nom_parent = body.nomParent;
  if (body.numeroParent !== undefined) updates.numero_parent = body.numeroParent;
  if (body.remarque !== undefined) updates.remarque = body.remarque;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "Aucun champ à mettre à jour" });
    return;
  }

  try {
    const { error } = await supabase.from("users").update(updates).ilike("username", username);
    if (error) throw error;
    res.json({ success: true });
  } catch (err: unknown) {
    req.log.error({ err }, "user profile update error");
    res.status(500).json({ error: (err as Error).message });
  }
});

router.patch("/users/:username/password", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }

  const username = req.params["username"] as string;
  const { oldPassword, newPassword } = req.body as { oldPassword: string; newPassword: string };

  if (payload.role !== "Admin" && payload.username.toLowerCase() !== username.toLowerCase()) {
    res.status(403).json({ error: "Non autorisé" });
    return;
  }

  if (!oldPassword || !newPassword) {
    res.status(400).json({ error: "oldPassword et newPassword requis" });
    return;
  }

  try {
    const { data: user } = await supabase.from("users").select("*").ilike("username", username).maybeSingle();
    if (!user) {
      res.status(404).json({ error: "Utilisateur non trouvé" });
      return;
    }

    const valid = await verifyPassword(oldPassword, (user as Record<string, string>).password || "");
    if (!valid) {
      res.status(400).json({ error: "Mot de passe actuel incorrect" });
      return;
    }

    const hashedPwd = await hashPassword(newPassword);
    const { error } = await supabase.from("users").update({ password: hashedPwd }).ilike("username", username);
    if (error) throw error;
    res.json({ success: true });
  } catch (err: unknown) {
    req.log.error({ err }, "password change error");
    res.status(500).json({ error: (err as Error).message });
  }
});

// DELETE /users/:username — permanently remove a user and all of their
// enrollment/billing history. Admin only.
router.delete("/users/:username", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload || payload.role !== "Admin") {
    res.status(401).json({ error: "Non autorisé" });
    return;
  }

  const username = req.params["username"] as string;

  try {
    const { data: user } = await supabase.from("users").select("username").ilike("username", username).maybeSingle();
    if (!user) {
      res.status(404).json({ error: "Utilisateur non trouvé" });
      return;
    }

    // Clean up rows that reference this user via a foreign key before deleting
    // the user itself — otherwise Postgres rejects the delete with a FK
    // violation and the admin sees a generic "impossible to delete" error.
    const { error: presenceErr } = await supabase.from("presence").delete().ilike("student_username", username);
    if (presenceErr) throw presenceErr;

    const { error: enrollErr } = await supabase.from("trimester_enrollments").delete().ilike("user_username", username);
    if (enrollErr) throw enrollErr;

    const { error: userErr } = await supabase.from("users").delete().ilike("username", username);
    if (userErr) throw userErr;

    res.json({ success: true });
  } catch (err: unknown) {
    req.log.error({ err }, "user delete error");
    // Surface the real database error instead of a generic failure so the
    // admin (and future debugging) can see exactly which constraint blocked
    // the delete, e.g. an unhandled foreign key from another table.
    const message = (err as { message?: string; details?: string })?.details
      ? `${(err as Error).message} (${(err as { details?: string }).details})`
      : (err as Error).message || "Impossible de supprimer cet utilisateur";
    res.status(500).json({ error: message });
  }
});

export default router;
