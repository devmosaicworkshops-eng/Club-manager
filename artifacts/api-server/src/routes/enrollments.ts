import { Router, type Request, type Response } from "express";
import { supabase } from "../lib/supabase.js";
import { verifyToken } from "../lib/auth.js";
import { computePaymentStatus } from "../lib/payment-status.js";
import { syncAccrual } from "../lib/accrual.js";
import { sendReceiptForEnrollment, sendReceiptForEnrollmentBestEffort } from "../lib/enrollment-receipt.js";

const router = Router();

function mapEnrollment(r: Record<string, unknown>) {
  const expected = Number(r.amount_expected ?? 0);
  const received = Number(r.amount_received ?? 0);
  return {
    id: r.id as string,
    leadKey: (r.lead_key as string) || "",
    leadSource: (r.lead_source as string) || "sheets",
    userUsername: (r.user_username as string | null) ?? null,
    program: (r.program as string) || "",
    categorie: (r.categorie as string) || "",
    paymentMethod: (r.payment_method as string) || "Trimestriel",
    groupName: (r.group_name as string) || "",
    parcours: (r.parcours as string) || "",
    horaire: (r.horaire as string) || "",
    paymentStatus: computePaymentStatus(expected, received),
    facilitator: (r.facilitator as string) || "",
    amountExpected: expected,
    amountReceived: received,
    amountRemaining: expected - received,
    amountPerPeriod: r.amount_per_period != null ? Number(r.amount_per_period) : null,
    billingStartDate: (r.billing_start_date as string | null) ?? null,
    programStartDate: (r.program_start_date as string | null) ?? null,
    programEndDate: (r.program_end_date as string | null) ?? null,
    depositDueDate: (r.deposit_due_date as string | null) ?? null,
    suspensionStatus: (r.suspension_status as string) || "Actif",
    invoiceNumber: (r.invoice_number as string) || "",
    trimester: (r.trimester as string) || "",
    academicYear: (r.academic_year as string) || "",
    receiptSentAt: (r.receipt_sent_at as string | null) ?? null,
    createdAt: (r.created_at as string) || "",
  };
}

/**
 * Compute the next sequential invoice number as a string, e.g. "14".
 * Scans existing invoice_number values, keeps only the purely numeric ones
 * (older rows have blanks or stray text like "asd"), and returns one past
 * the current max — starting at "1" if none exist yet.
 */
async function nextInvoiceNumber(): Promise<string> {
  const { data, error } = await supabase
    .from("trimester_enrollments")
    .select("invoice_number");
  if (error) throw error;
  let max = 0;
  for (const row of (data ?? []) as { invoice_number: string | null }[]) {
    const n = Number(row.invoice_number);
    if (Number.isInteger(n) && n > max) max = n;
  }
  return String(max + 1);
}

// GET /enrollments
router.get("/enrollments", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }

  try {
    let query = supabase.from("trimester_enrollments").select("*").order("created_at", { ascending: false });

    const { leadKey, userUsername } = req.query as { leadKey?: string; userUsername?: string };

    if (leadKey) query = query.eq("lead_key", leadKey);
    if (userUsername) query = query.eq("user_username", userUsername);

    if (payload.role === "User") {
      query = query.eq("user_username", payload.username);
    }

    const { data, error } = await query;
    if (error) throw error;
    const synced = await syncAccrual((data ?? []) as any[]);
    res.json(synced.map(mapEnrollment));
  } catch (err: unknown) {
    req.log.error({ err }, "enrollments fetch error");
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /enrollments
router.post("/enrollments", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload || payload.role !== "Admin") {
    res.status(401).json({ error: "Non autorisé" });
    return;
  }

  const body = req.body as Record<string, unknown>;

  if (!body.leadKey) {
    res.status(400).json({ error: "leadKey requis" });
    return;
  }

  const expected = Number(body.amountExpected ?? 0);
  const received = Number(body.amountReceived ?? 0);
  const perPeriod = body.amountPerPeriod != null && body.amountPerPeriod !== "" ? Number(body.amountPerPeriod) : null;

  try {
    // Auto-assign the next invoice number unless one was explicitly passed
    // (e.g. the reroll flow carrying an existing number forward).
    const invoiceNumber = (body.invoiceNumber as string) || (await nextInvoiceNumber());

    const { data, error } = await supabase
      .from("trimester_enrollments")
      .insert({
        lead_key: body.leadKey,
        lead_source: (body.leadSource as string) || "sheets",
        user_username: (body.userUsername as string) || null,
        program: (body.program as string) || "",
        categorie: (body.categorie as string) || "",
        payment_method: (body.paymentMethod as string) || "Trimestriel",
        group_name: (body.groupName as string) || "",
        parcours: (body.parcours as string) || "",
        horaire: (body.horaire as string) || "",
        facilitator: (body.facilitator as string) || "",
        amount_expected: expected,
        amount_received: received,
        amount_per_period: perPeriod,
        billing_start_date: (body.billingStartDate as string) || (perPeriod ? new Date().toISOString().slice(0, 10) : null),
        program_start_date: (body.programStartDate as string) || null,
        program_end_date: (body.programEndDate as string) || null,
        deposit_due_date: (body.depositDueDate as string) || null,
        suspension_status: "Actif",
        invoice_number: invoiceNumber,
        trimester: (body.trimester as string) || "",
        academic_year: (body.academicYear as string) || "",
      })
      .select()
      .single();
    if (error) throw error;
    const created = data as Record<string, unknown>;
    res.status(201).json(mapEnrollment(created));

    // Trimester is now first active for this enrollment — send the
    // WhatsApp receipt (montant attendu / montant reçu) automatically,
    // best-effort, without blocking the response.
    sendReceiptForEnrollmentBestEffort(created.id as string);
  } catch (err: unknown) {
    req.log.error({ err }, "enrollment create error");
    res.status(500).json({ error: (err as Error).message });
  }
});

// PATCH /enrollments/:id
router.patch("/enrollments/:id", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload || payload.role !== "Admin") {
    res.status(401).json({ error: "Non autorisé" });
    return;
  }

  const id = req.params["id"] as string;
  const body = req.body as Record<string, unknown>;

  const updates: Record<string, unknown> = {};
  if (body.amountReceived !== undefined) updates.amount_received = Number(body.amountReceived);
  if (body.amountExpected !== undefined) updates.amount_expected = Number(body.amountExpected);
  if (body.paymentMethod !== undefined) updates.payment_method = body.paymentMethod;
  if (body.categorie !== undefined) updates.categorie = body.categorie;
  if (body.groupName !== undefined) updates.group_name = body.groupName;
  if (body.parcours !== undefined) updates.parcours = body.parcours;
  if (body.horaire !== undefined) updates.horaire = body.horaire;
  if (body.facilitator !== undefined) updates.facilitator = body.facilitator;
  if (body.programStartDate !== undefined) updates.program_start_date = body.programStartDate;
  if (body.programEndDate !== undefined) updates.program_end_date = body.programEndDate;
  if (body.depositDueDate !== undefined) updates.deposit_due_date = body.depositDueDate;
  if (body.suspensionStatus !== undefined) updates.suspension_status = body.suspensionStatus;
  if (body.invoiceNumber !== undefined) updates.invoice_number = body.invoiceNumber;
  if (body.trimester !== undefined) updates.trimester = body.trimester;
  if (body.academicYear !== undefined) updates.academic_year = body.academicYear;
  if (body.userUsername !== undefined) updates.user_username = body.userUsername;
  if (body.amountPerPeriod !== undefined) {
    updates.amount_per_period = body.amountPerPeriod === null || body.amountPerPeriod === "" ? null : Number(body.amountPerPeriod);
  }
  if (body.billingStartDate !== undefined) updates.billing_start_date = body.billingStartDate;

  try {
    const { data, error } = await supabase
      .from("trimester_enrollments")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    res.json(mapEnrollment(data as Record<string, unknown>));
  } catch (err: unknown) {
    req.log.error({ err }, "enrollment update error");
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /enrollments/:id/send-receipt
router.post("/enrollments/:id/send-receipt", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload || payload.role !== "Admin") {
    res.status(401).json({ error: "Non autorisé" });
    return;
  }

  const id = req.params["id"] as string;

  try {
    const result = await sendReceiptForEnrollment(id);
    if (!result.success && result.error === "Aucun numéro de téléphone trouvé pour ce contact") {
      res.status(400).json(result);
      return;
    }
    if (!result.success) {
      req.log.warn({ enrollmentId: id, error: result.error }, "send-receipt: WhatsApp send failed");
    }
    res.json(result);
  } catch (err: unknown) {
    req.log.error({ err }, "send receipt error");
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// GET /enrollments/reroll-status?trimester=T1&academicYear=2025-2026
// Lists every user with their enrollment (if any) for the given
// trimester/year so the admin can see who needs to be re-enrolled.
router.get("/enrollments/reroll-status", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload || payload.role !== "Admin") {
    res.status(401).json({ error: "Non autorisé" });
    return;
  }

  const { trimester, academicYear } = req.query as { trimester?: string; academicYear?: string };
  if (!trimester || !academicYear) {
    res.status(400).json({ error: "trimester et academicYear requis" });
    return;
  }

  try {
    const [usersRes, enrollmentsRes] = await Promise.all([
      supabase.from("users").select("username, nom, prenom, categorie, group_name"),
      supabase
        .from("trimester_enrollments")
        .select("*")
        .eq("trimester", trimester)
        .eq("academic_year", academicYear)
        .not("user_username", "is", null),
    ]);
    if (usersRes.error) throw usersRes.error;
    if (enrollmentsRes.error) throw enrollmentsRes.error;

    const users = usersRes.data ?? [];
    const enrollments = enrollmentsRes.data ?? [];

    // For users not yet enrolled in the target trimester, carry forward their
    // amountPerPeriod and program from their most recent previous enrollment so
    // the admin doesn't have to re-enter the same amount every trimester.
    let previousEnrollments: any[] = [];
    const notEnrolledUsernames = users
      .filter((u) => !enrollments.find((e) => e.user_username?.toLowerCase() === u.username.toLowerCase()))
      .map((u) => u.username);

    if (notEnrolledUsernames.length > 0) {
      const { data: prevData } = await supabase
        .from("trimester_enrollments")
        .select("user_username, amount_per_period, program, payment_method, parcours, horaire")
        .in("user_username", notEnrolledUsernames)
        .not("user_username", "is", null)
        .order("academic_year", { ascending: false });
      previousEnrollments = prevData ?? [];
    }

    const result = users.map((u) => {
      const enrollment = enrollments.find((e) => e.user_username?.toLowerCase() === u.username.toLowerCase());
      // Carry forward from most recent previous enrollment if not yet enrolled in target
      const prev = !enrollment
        ? previousEnrollments.find((e) => e.user_username?.toLowerCase() === u.username.toLowerCase())
        : null;
      return {
        username: u.username,
        nom: u.nom || "",
        prenom: u.prenom || "",
        categorie: u.categorie || "",
        groupName: u.group_name || "",
        parcours: enrollment?.parcours ?? prev?.parcours ?? "",
        horaire: enrollment?.horaire ?? prev?.horaire ?? "",
        enrolled: !!enrollment && enrollment.suspension_status === "Actif",
        enrollmentId: enrollment?.id ?? null,
        program: enrollment?.program ?? prev?.program ?? "",
        paymentMethod: enrollment?.payment_method ?? prev?.payment_method ?? "",
        amountPerPeriod: enrollment?.amount_per_period != null
          ? Number(enrollment.amount_per_period)
          : prev?.amount_per_period != null
            ? Number(prev.amount_per_period)
            : null,
      };
    });

    res.json(result);
  } catch (err: unknown) {
    req.log.error({ err }, "reroll status error");
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /enrollments/reroll — bulk enroll the selected usernames for a given
// trimester/year. Users NOT included simply get no row for that
// trimester, which means they are not charged and lose access once this
// trimester becomes the active one (see /settings/trimester gating).
router.post("/enrollments/reroll", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload || payload.role !== "Admin") {
    res.status(401).json({ error: "Non autorisé" });
    return;
  }

  const body = req.body as {
    trimester?: string;
    academicYear?: string;
    entries?: { username: string; categorie?: string; program?: string; paymentMethod?: string; amountPerPeriod?: number; groupName?: string; parcours?: string; horaire?: string }[];
  };

  if (!body.trimester || !body.academicYear || !Array.isArray(body.entries)) {
    res.status(400).json({ error: "trimester, academicYear et entries requis" });
    return;
  }

  try {
    const today = new Date().toISOString().slice(0, 10);
    const results = [];

    for (const entry of body.entries) {
      if (!entry.username) continue;

      const { data: existing } = await supabase
        .from("trimester_enrollments")
        .select("id")
        .eq("trimester", body.trimester)
        .eq("academic_year", body.academicYear)
        .ilike("user_username", entry.username)
        .maybeSingle();

      const perPeriod = entry.amountPerPeriod != null ? Number(entry.amountPerPeriod) : null;
      const paymentMethod = entry.paymentMethod || "Trimestriel";
      // "Programme" is not something admins type per re-enrollment — it just
      // mirrors the student's catégorie so receipts/history still show a
      // meaningful label without extra manual input.
      const program = entry.program || entry.categorie || "";

      if (existing) {
        const { data, error } = await supabase
          .from("trimester_enrollments")
          .update({
            suspension_status: "Actif",
            program,
            categorie: entry.categorie ?? undefined,
            payment_method: paymentMethod,
            group_name: entry.groupName ?? undefined,
            parcours: entry.parcours ?? undefined,
            horaire: entry.horaire ?? undefined,
            amount_per_period: perPeriod,
            billing_start_date: today,
          })
          .eq("id", existing.id)
          .select()
          .single();
        if (error) throw error;
        results.push(mapEnrollment(data as Record<string, unknown>));
      } else {
        const initialExpected = perPeriod ?? 0;
        const { data, error } = await supabase
          .from("trimester_enrollments")
          .insert({
            lead_key: `reroll-${entry.username}-${body.trimester}-${body.academicYear}`,
            lead_source: "manual",
            user_username: entry.username,
            program,
            categorie: entry.categorie || "",
            payment_method: paymentMethod,
            group_name: entry.groupName || "",
            parcours: entry.parcours || "",
            horaire: entry.horaire || "",
            facilitator: "",
            amount_expected: initialExpected,
            amount_received: 0,
            amount_per_period: perPeriod,
            billing_start_date: today,
            suspension_status: "Actif",
            invoice_number: "",
            trimester: body.trimester,
            academic_year: body.academicYear,
          })
          .select()
          .single();
        if (error) throw error;
        const created = data as Record<string, unknown>;
        results.push(mapEnrollment(created));

        // New enrollment row = trimester first activated for this user —
        // auto-send the WhatsApp receipt, best-effort.
        sendReceiptForEnrollmentBestEffort(created.id as string);
      }
    }

    res.json({ success: true, enrolled: results.length, enrollments: results });
  } catch (err: unknown) {
    req.log.error({ err }, "reroll error");
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
