import { Router, type Request, type Response } from "express";
import { supabase } from "../lib/supabase.js";
import { verifyToken } from "../lib/auth.js";

const router = Router();

// GET /history — Admin view: each user enriched with their trimester
// enrollment history and (if found) their matched manual lead data.
router.get("/history", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload || payload.role !== "Admin") {
    res.status(401).json({ error: "Non autorisé" });
    return;
  }

  try {
    const [usersRes, enrollmentsRes, leadsRes] = await Promise.all([
      supabase
        .from("users")
        .select(
          "username, nom, prenom, date_naissance, nom_parent, numero_parent, categorie, group_name, remarque, payment_type, payment_status"
        )
        .order("nom", { ascending: true }),
      supabase
        .from("trimester_enrollments")
        .select(
          "id, user_username, trimester, academic_year, amount_expected, amount_received, payment_method, billing_start_date, suspension_status"
        )
        .order("academic_year", { ascending: true }),
      supabase
        .from("manual_leads")
        .select(
          "id, nom, prenom, date_naissance, nom_parent, numero_parent, email_parent, ecole, niveau, trouble_apprentissage, allergie, allergie_detail, parcours, payment_type, confirmed, medical_notes, rendezvous_date, created_at"
        ),
    ]);

    if (usersRes.error) throw usersRes.error;
    if (enrollmentsRes.error) throw enrollmentsRes.error;

    const users = usersRes.data ?? [];
    const enrollments = enrollmentsRes.data ?? [];
    const leads = leadsRes.data ?? [];

    const result = users.map((u: any) => {
      const userEnrollments = enrollments
        .filter((e: any) => e.user_username?.toLowerCase() === u.username?.toLowerCase())
        .map((e: any) => ({
          id: e.id,
          trimester: e.trimester || "",
          academicYear: e.academic_year || "",
          amountExpected: Number(e.amount_expected ?? 0),
          amountReceived: Number(e.amount_received ?? 0),
          paymentMethod: e.payment_method || "",
          billingStartDate: e.billing_start_date || "",
          suspensionStatus: e.suspension_status || "Actif",
        }));

      // Try to match a lead by normalised name (best-effort — leads are not
      // formally linked to user accounts via FK, so a fuzzy name match is the
      // only bridge we have).
      const normName = (s: string) => (s || "").trim().toLowerCase().replace(/\s+/g, " ");
      const matchedLead = leads.find(
        (l: any) =>
          normName(l.nom) === normName(u.nom) &&
          normName(l.prenom) === normName(u.prenom)
      );

      return {
        username: u.username || "",
        nom: u.nom || "",
        prenom: u.prenom || "",
        dateNaissance: u.date_naissance || "",
        nomParent: u.nom_parent || "",
        numeroParent: u.numero_parent || "",
        categorie: u.categorie || "",
        group: u.group_name || "",
        remarque: u.remarque || "",
        paymentType: u.payment_type || "",
        enrollments: userEnrollments,
        lead: matchedLead
          ? {
              ecole: matchedLead.ecole || "",
              niveau: matchedLead.niveau || "",
              troubleApprentissage: matchedLead.trouble_apprentissage || "",
              allergie: matchedLead.allergie || "",
              allergieDetail: matchedLead.allergie_detail || "",
              parcours: matchedLead.parcours || "",
              emailParent: matchedLead.email_parent || "",
              medicalNotes: matchedLead.medical_notes || "",
              rendezvousDate: matchedLead.rendezvous_date || null,
              confirmed: matchedLead.confirmed ?? false,
            }
          : null,
      };
    });

    res.json(result);
  } catch (err: any) {
    req.log.error({ err }, "history fetch error");
    res.status(500).json({ error: err.message });
  }
});

export default router;
