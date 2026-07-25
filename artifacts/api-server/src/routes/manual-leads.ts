import { Router, type Request, type Response } from "express";
import { supabase } from "../lib/supabase.js";
import { verifyToken } from "../lib/auth.js";

const router = Router();

function mapManualLead(r: Record<string, unknown>) {
  return {
    id: r.id as string,
    nom: (r.nom as string) || "",
    prenom: (r.prenom as string) || "",
    dateNaissance: (r.date_naissance as string) || "",
    nomParent: (r.nom_parent as string) || "",
    numeroParent: (r.numero_parent as string) || "",
    emailParent: (r.email_parent as string) || "",
    ecole: (r.ecole as string) || "",
    niveau: (r.niveau as string) || "",
    troubleApprentissage: (r.trouble_apprentissage as string) || "",
    allergie: (r.allergie as string) || "",
    allergieDetail: (r.allergie_detail as string) || "",
    parcours: (r.parcours as string) || "",
    paymentType: (r.payment_type as string) || "Trimestriel",
    currentStep: (r.current_step as number) ?? 3,
    confirmed: (r.confirmed as boolean) ?? false,
    source: "manual",
    afSubmitted: (r.af_submitted as boolean) ?? false,
    imageAuthorization: (r.image_authorization as boolean) ?? false,
    identityVerified: (r.identity_verified as boolean) ?? false,
    medicalNotes: (r.medical_notes as string) || "",
    termsSigned: (r.terms_signed as boolean) ?? false,
    feeStatus: (r.fee_status as string) || "",
    reglementSigned: (r.reglement_signed as boolean) ?? false,
    feeDate: (r.fee_date as string | null) ?? null,
    rendezvousDate: (r.rendezvous_date as string | null) ?? null,
  };
}

router.get("/leads/manual", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload || payload.role !== "Admin") {
    res.status(401).json({ error: "Non autorisé" });
    return;
  }

  try {
    const { data, error } = await supabase
      .from("manual_leads")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw error;
    res.json((data ?? []).map(mapManualLead));
  } catch (err: unknown) {
    req.log.error({ err }, "manual leads fetch error");
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post("/leads/manual", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload || payload.role !== "Admin") {
    res.status(401).json({ error: "Non autorisé" });
    return;
  }

  const { nom, prenom, dateNaissance, nomParent, numeroParent, emailParent, ecole, niveau, troubleApprentissage, allergie, allergieDetail, parcours, paymentType } = req.body as Record<string, string>;

  if (!nom || !prenom || !paymentType) {
    res.status(400).json({ error: "nom, prenom et paymentType requis" });
    return;
  }

  try {
    const { data, error } = await supabase
      .from("manual_leads")
      .insert({
        nom, prenom,
        date_naissance: dateNaissance || "",
        nom_parent: nomParent || "",
        numero_parent: numeroParent || "",
        email_parent: emailParent || "",
        ecole: ecole || "",
        niveau: niveau || "",
        trouble_apprentissage: troubleApprentissage || "",
        allergie: allergie || "",
        allergie_detail: allergieDetail || "",
        parcours: parcours || "",
        payment_type: paymentType,
        current_step: 3,
        confirmed: false,
        af_submitted: false,
        image_authorization: false,
        identity_verified: false,
        medical_notes: "",
        terms_signed: false,
        fee_status: "",
        reglement_signed: false,
      })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(mapManualLead(data as Record<string, unknown>));
  } catch (err: unknown) {
    req.log.error({ err }, "manual lead create error");
    res.status(500).json({ error: (err as Error).message });
  }
});

router.delete("/leads/manual/:id", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload || payload.role !== "Admin") {
    res.status(401).json({ error: "Non autorisé" });
    return;
  }
  const id = req.params["id"] as string;
  try {
    const { error } = await supabase.from("manual_leads").delete().eq("id", id);
    if (error) throw error;
    res.status(204).end();
  } catch (err: unknown) {
    req.log.error({ err }, "manual lead delete error");
    res.status(500).json({ error: (err as Error).message });
  }
});

router.patch("/leads/manual/:id", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload || payload.role !== "Admin") {
    res.status(401).json({ error: "Non autorisé" });
    return;
  }

  const id = req.params["id"] as string;
  const { paymentType, currentStep, confirmed, afSubmitted, imageAuthorization, identityVerified, medicalNotes, termsSigned, feeStatus, reglementSigned, feeDate, rendezvousDate } = req.body as Record<string, unknown>;

  const updates: Record<string, unknown> = {};
  if (paymentType !== undefined) updates.payment_type = paymentType;
  if (currentStep !== undefined) updates.current_step = currentStep;
  if (confirmed !== undefined) updates.confirmed = confirmed;
  if (afSubmitted !== undefined) updates.af_submitted = afSubmitted;
  if (imageAuthorization !== undefined) updates.image_authorization = imageAuthorization;
  if (identityVerified !== undefined) updates.identity_verified = identityVerified;
  if (medicalNotes !== undefined) updates.medical_notes = medicalNotes;
  if (termsSigned !== undefined) updates.terms_signed = termsSigned;
  if (feeStatus !== undefined) updates.fee_status = feeStatus;
  if (reglementSigned !== undefined) updates.reglement_signed = reglementSigned;
  if (feeDate !== undefined) updates.fee_date = feeDate;
  if (rendezvousDate !== undefined) updates.rendezvous_date = rendezvousDate;

  try {
    let { data, error } = await supabase
      .from("manual_leads")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    // If rendezvous_date column doesn't exist yet, retry without it
    if (error && updates.rendezvous_date !== undefined &&
        (error.message?.includes("rendezvous_date") || error.code === "42703")) {
      const { rendezvous_date: _dropped, ...updatesWithoutRdv } = updates;
      ({ data, error } = await supabase
        .from("manual_leads")
        .update(updatesWithoutRdv)
        .eq("id", id)
        .select()
        .single());
    }

    if (error) throw error;
    res.json(mapManualLead(data as Record<string, unknown>));
  } catch (err: unknown) {
    req.log.error({ err }, "manual lead update error");
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
