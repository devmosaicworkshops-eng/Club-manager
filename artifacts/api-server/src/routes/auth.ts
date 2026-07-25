import { Router, type Request, type Response } from "express";
import { supabase } from "../lib/supabase.js";
import { signToken, verifyToken, verifyPassword } from "../lib/auth.js";

const router = Router();

router.post("/auth/login", async (req: Request, res: Response) => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username || !password) {
    res.status(400).json({ error: "username et password requis" });
    return;
  }

  const u = username.trim();

  try {
    // Check Admins
    const { data: admin } = await supabase
      .from("admins")
      .select("*")
      .ilike("username", u)
      .maybeSingle();

    if (admin && (await verifyPassword(password, admin.password))) {
      const token = signToken({ username: admin.username, role: "Admin", nom: admin.username, categorie: "", paymentStatus: "", enrolled: true });
      res.json({ token, user: { username: admin.username, nom: admin.username, role: "Admin", categorie: "", paymentStatus: "", enrolled: true } });
      return;
    }

    // Check Coaches
    const { data: coach } = await supabase
      .from("coaches")
      .select("*")
      .ilike("username", u)
      .maybeSingle();

    if (coach && (await verifyPassword(password, coach.password))) {
      const token = signToken({ username: coach.username, role: "Coach", nom: coach.nom || coach.username, categorie: "", paymentStatus: "", enrolled: true });
      res.json({ token, user: { username: coach.username, nom: coach.nom || coach.username, role: "Coach", categorie: "", paymentStatus: "", enrolled: true } });
      return;
    }

    // Check Users
    const { data: user } = await supabase
      .from("users")
      .select("*")
      .ilike("username", u)
      .maybeSingle();

    if (user && (await verifyPassword(password, user.password))) {
      const { data: settings } = await supabase.from("club_settings").select("*").eq("id", 1).maybeSingle();

      // Users always get access — being unenrolled for the current trimester
      // no longer blocks login. Instead we compute an `enrolled` flag the
      // frontend uses to restrict features (e.g. upcoming séances) and show
      // a "not enrolled" banner. Before an admin has configured a current
      // trimester, everyone counts as enrolled (nothing to gate against yet).
      let enrolled = true;
      let currentTrimesterLabel = "";

      if (settings?.current_trimester && settings?.current_academic_year) {
        currentTrimesterLabel = `${settings.current_trimester} ${settings.current_academic_year}`;
        const { data: enrollment } = await supabase
          .from("trimester_enrollments")
          .select("id, suspension_status")
          .eq("trimester", settings.current_trimester)
          .eq("academic_year", settings.current_academic_year)
          .ilike("user_username", user.username)
          .maybeSingle();

        enrolled = !!enrollment && enrollment.suspension_status === "Actif";
      }

      const nom = `${user.prenom || ""} ${user.nom || ""}`.trim();
      const token = signToken({ username: user.username, role: "User", nom, categorie: user.categorie || "", paymentStatus: user.payment_status || "", enrolled, currentTrimesterLabel });
      res.json({ token, user: { username: user.username, nom, role: "User", categorie: user.categorie || "", paymentStatus: user.payment_status || "", enrolled, currentTrimesterLabel } });
      return;
    }

    res.status(401).json({ error: "Identifiants incorrects" });
  } catch (err: any) {
    req.log.error({ err }, "login error");
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/auth/me", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }
  res.json(payload);
});

export default router;
