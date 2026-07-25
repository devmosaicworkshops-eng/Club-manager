import { Router, type Request, type Response } from "express";
import { supabase } from "../lib/supabase.js";
import { verifyToken } from "../lib/auth.js";
import { sendWhatsAppMessage } from "../lib/whatsapp.js";
import { deleteLeadByKey } from "../lib/sheets-leads.js";

const router = Router();

function mapPipeline(r: Record<string, unknown>) {
  return {
    id: r.id as string,
    leadKey: (r.lead_key as string) || "",
    leadSource: (r.lead_source as string) || "sheets",
    paymentType: (r.payment_type as string) || "Trimestriel",
    currentStep: (r.current_step as number) ?? 1,
    confirmed: (r.confirmed as boolean) ?? false,
    whatsappStatus: (r.whatsapp_status as string) || "pending",
    whatsappSentAt: (r.whatsapp_sent_at as string | null) ?? null,
    repliedAt: (r.replied_at as string | null) ?? null,
    rendezvousDate: (r.rendezvous_date as string | null) ?? null,
    rendezvousNotes: (r.rendezvous_notes as string) || "",
    afSubmitted: (r.af_submitted as boolean) ?? false,
    imageAuthorization: (r.image_authorization as boolean) ?? false,
    identityVerified: (r.identity_verified as boolean) ?? false,
    medicalNotes: (r.medical_notes as string) || "",
    termsSigned: (r.terms_signed as boolean) ?? false,
    feeStatus: (r.fee_status as string) || "",
    reglementSigned: (r.reglement_signed as boolean) ?? false,
    feeDate: (r.fee_date as string | null) ?? null,
  };
}

// GET /pipeline
router.get("/pipeline", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload || payload.role !== "Admin") {
    res.status(401).json({ error: "Non autorisé" });
    return;
  }

  try {
    const { data, error } = await supabase
      .from("lead_pipeline")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw error;
    res.json((data ?? []).map(mapPipeline));
  } catch (err: unknown) {
    req.log.error({ err }, "pipeline fetch error");
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /pipeline — upsert pipeline entry for a sheets lead
router.post("/pipeline", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload || payload.role !== "Admin") {
    res.status(401).json({ error: "Non autorisé" });
    return;
  }

  const { leadKey, paymentType, currentStep, confirmed } = req.body as {
    leadKey: string;
    paymentType: string;
    currentStep: number;
    confirmed?: boolean;
  };

  if (!leadKey || !paymentType || currentStep === undefined) {
    res.status(400).json({ error: "leadKey, paymentType et currentStep requis" });
    return;
  }

  try {
    const { data, error } = await supabase
      .from("lead_pipeline")
      .upsert(
        {
          lead_key: leadKey,
          lead_source: "sheets",
          payment_type: paymentType,
          current_step: currentStep,
          confirmed: confirmed ?? false,
        },
        { onConflict: "lead_key,lead_source" }
      )
      .select()
      .single();
    if (error) throw error;
    res.json(mapPipeline(data as Record<string, unknown>));
  } catch (err: unknown) {
    req.log.error({ err }, "pipeline upsert error");
    res.status(500).json({ error: (err as Error).message });
  }
});

// PATCH /pipeline/:id — update step data for a pipeline entry
router.patch("/pipeline/:id", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload || payload.role !== "Admin") {
    res.status(401).json({ error: "Non autorisé" });
    return;
  }

  const id = req.params["id"] as string;
  const body = req.body as Record<string, unknown>;

  const updates: Record<string, unknown> = {};
  if (body.paymentType !== undefined) updates.payment_type = body.paymentType;
  if (body.currentStep !== undefined) updates.current_step = body.currentStep;
  if (body.confirmed !== undefined) updates.confirmed = body.confirmed;
  if (body.rendezvousDate !== undefined) updates.rendezvous_date = body.rendezvousDate;
  if (body.rendezvousNotes !== undefined) updates.rendezvous_notes = body.rendezvousNotes;
  if (body.afSubmitted !== undefined) updates.af_submitted = body.afSubmitted;
  if (body.imageAuthorization !== undefined) updates.image_authorization = body.imageAuthorization;
  if (body.identityVerified !== undefined) updates.identity_verified = body.identityVerified;
  if (body.medicalNotes !== undefined) updates.medical_notes = body.medicalNotes;
  if (body.termsSigned !== undefined) updates.terms_signed = body.termsSigned;
  if (body.feeStatus !== undefined) updates.fee_status = body.feeStatus;
  if (body.reglementSigned !== undefined) updates.reglement_signed = body.reglementSigned;
  if (body.feeDate !== undefined) updates.fee_date = body.feeDate;

  try {
    const { data, error } = await supabase
      .from("lead_pipeline")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    res.json(mapPipeline(data as Record<string, unknown>));
  } catch (err: unknown) {
    req.log.error({ err }, "pipeline update error");
    res.status(500).json({ error: (err as Error).message });
  }
});

// DELETE /pipeline/:id — remove a pipeline entry (and its Google Sheet row if from sheets)
router.delete("/pipeline/:id", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload || payload.role !== "Admin") {
    res.status(401).json({ error: "Non autorisé" });
    return;
  }

  const id = req.params["id"] as string;

  try {
    // Fetch the entry first so we know the lead_key and source
    const { data: entry, error: fetchErr } = await supabase
      .from("lead_pipeline")
      .select("lead_key, lead_source")
      .eq("id", id)
      .single();
    if (fetchErr) throw fetchErr;

    // Delete from Google Sheets if this is a sheets lead
    if (entry?.lead_source === "sheets" && entry?.lead_key) {
      try {
        await deleteLeadByKey(entry.lead_key);
      } catch (sheetsErr) {
        req.log.warn({ err: sheetsErr, leadKey: entry.lead_key }, "Sheets row delete failed — proceeding with Supabase delete");
      }
    }

    const { error } = await supabase
      .from("lead_pipeline")
      .delete()
      .eq("id", id);
    if (error) throw error;
    res.status(204).end();
  } catch (err: unknown) {
    req.log.error({ err }, "pipeline delete error");
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /pipeline/whatsapp/send — send WhatsApp message to a lead
router.post("/pipeline/whatsapp/send", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload || payload.role !== "Admin") {
    res.status(401).json({ error: "Non autorisé" });
    return;
  }

  const { leadKey, leadSource, phoneNumber, message } = req.body as {
    leadKey: string;
    leadSource: string;
    phoneNumber: string;
    message: string;
  };

  if (!leadKey || !phoneNumber || !message) {
    res.status(400).json({ error: "leadKey, phoneNumber et message requis" });
    return;
  }

  try {
    const result = await sendWhatsAppMessage(phoneNumber, message);

    if (result.success) {
      await supabase
        .from("lead_pipeline")
        .update({
          whatsapp_status: "sent",
          whatsapp_sent_at: new Date().toISOString(),
          current_step: 1,
        })
        .eq("lead_key", leadKey)
        .eq("lead_source", leadSource || "sheets");
    }

    res.json({ success: result.success, messageId: result.messageId, error: result.error });
  } catch (err: unknown) {
    req.log.error({ err }, "whatsapp send error");
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
