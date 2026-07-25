import { Router, type Request, type Response } from "express";
import { supabase } from "../lib/supabase.js";
import { verifyToken } from "../lib/auth.js";
import { computePaymentStatus } from "../lib/payment-status.js";
import { syncAccrual } from "../lib/accrual.js";
import { sendWhatsAppImage } from "../lib/whatsapp.js";
import { generateReceiptImage } from "../lib/receipt-image.js";

const router = Router();

// GET /payments/summary — global payments overview
router.get("/payments/summary", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload || payload.role !== "Admin") {
    res.status(401).json({ error: "Non autorisé" });
    return;
  }

  try {
    // Only count enrollments actually linked to a user — enrollments created
    // from the leads pipeline before conversion have no user_username yet
    // and must not inflate the totals shown here (they'd double the totals
    // vs. the per-user breakdown below, which only lists real users).
    const { data: rawEnrollments, error } = await supabase
      .from("trimester_enrollments")
      .select("id, user_username, amount_expected, amount_per_period, billing_start_date, payment_method, amount_received, suspension_status")
      .not("user_username", "is", null);
    if (error) throw error;

    const enrollments = await syncAccrual(rawEnrollments ?? []);

    // Aggregate per user (a user can have several enrollments) so a fully
    // paid / overpaid user contributes nothing to the totals below — this
    // mirrors the "Soldes en attente" table, which only lists users who
    // still owe money. Summing raw enrollment rows instead would let a
    // settled user's negative remainder still show up as leftover "Solde
    // Restant" (e.g. -10 MAD) even though nobody actually owes anything.
    const perUser = new Map<string, { expected: number; paid: number }>();
    for (const e of enrollments) {
      const username = (e.user_username as string | null) ?? "";
      if (!username) continue;
      const expected = Number(e.amount_expected ?? 0);
      const received = Number(e.amount_received ?? 0);
      const agg = perUser.get(username) ?? { expected: 0, paid: 0 };
      agg.expected += expected;
      agg.paid += received;
      perUser.set(username, agg);
    }

    let totalExpected = 0;
    let totalPaid = 0;
    let overdueCount = 0;
    let activeUsers = 0;

    for (const { expected, paid } of perUser.values()) {
      const remaining = expected - paid;
      if (remaining <= 0) continue; // fully paid or overpaid — nothing owed
      totalExpected += expected;
      totalPaid += paid;
      activeUsers++;
      if (computePaymentStatus(expected, paid) === "En attente") {
        overdueCount++;
      }
    }

    res.json({
      totalExpected,
      totalPaid,
      totalRemaining: totalExpected - totalPaid,
      activeUsers,
      overdueCount,
    });
  } catch (err: unknown) {
    req.log.error({ err }, "payments summary error");
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /payments/users — per-user billing breakdown
router.get("/payments/users", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload || payload.role !== "Admin") {
    res.status(401).json({ error: "Non autorisé" });
    return;
  }

  try {
    const [usersRes, enrollmentsRes] = await Promise.all([
      supabase.from("users").select("username, nom, prenom"),
      supabase
        .from("trimester_enrollments")
        .select("id, user_username, amount_expected, amount_per_period, billing_start_date, payment_method, amount_received, suspension_status, trimester, academic_year")
        .not("user_username", "is", null),
    ]);

    if (usersRes.error) throw usersRes.error;
    if (enrollmentsRes.error) throw enrollmentsRes.error;

    const users = usersRes.data ?? [];
    const enrollments = await syncAccrual(enrollmentsRes.data ?? []);

    const result = users.map((u) => {
      const userEnrollments = enrollments.filter(
        (e) => e.user_username?.toLowerCase() === u.username.toLowerCase()
      );

      const totalExpected = userEnrollments.reduce((s, e) => s + Number(e.amount_expected ?? 0), 0);
      const totalPaid = userEnrollments.reduce((s, e) => s + Number(e.amount_received ?? 0), 0);

      const latest = userEnrollments.sort((a, b) => {
        const aKey = `${a.academic_year || ""}${a.trimester || ""}`;
        const bKey = `${b.academic_year || ""}${b.trimester || ""}`;
        return bKey.localeCompare(aKey);
      })[0];

      return {
        username: u.username,
        nom: u.nom || "",
        prenom: u.prenom || "",
        totalExpected,
        totalPaid,
        totalRemaining: totalExpected - totalPaid,
        enrollmentCount: userEnrollments.length,
        paymentStatus: computePaymentStatus(totalExpected, totalPaid),
        latestTrimester: latest ? `${latest.trimester || ""} ${latest.academic_year || ""}`.trim() : "",
        latestEnrollmentId: (latest?.id as string) ?? null,
      };
    });

    res.json(result);
  } catch (err: unknown) {
    req.log.error({ err }, "user billings error");
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /payments/users/:username/add-payment — record an additional payment
// against the user's latest (most recent trimester) enrollment.
router.post("/payments/users/:username/add-payment", async (req: Request, res: Response) => {
  const payload = verifyToken(req.headers.authorization);
  if (!payload || payload.role !== "Admin") {
    res.status(401).json({ error: "Non autorisé" });
    return;
  }

  const username = req.params["username"] as string;
  const { amount } = req.body as { amount?: number };
  const addedAmount = Number(amount);

  if (!addedAmount || addedAmount <= 0) {
    res.status(400).json({ error: "Le montant doit être un nombre positif" });
    return;
  }

  try {
    const { data: userEnrollments, error } = await supabase
      .from("trimester_enrollments")
      .select("*")
      .ilike("user_username", username);
    if (error) throw error;

    const enrollments = await syncAccrual(userEnrollments ?? []);
    if (enrollments.length === 0) {
      res.status(404).json({ error: "Aucune facturation trouvée pour cet utilisateur" });
      return;
    }

    const latest = enrollments.sort((a, b) => {
      const aKey = `${a.academic_year || ""}${a.trimester || ""}`;
      const bKey = `${b.academic_year || ""}${b.trimester || ""}`;
      return bKey.localeCompare(aKey);
    })[0];

    const newReceived = Number(latest.amount_received ?? 0) + addedAmount;

    const { error: updateErr } = await supabase
      .from("trimester_enrollments")
      .update({ amount_received: newReceived })
      .eq("id", latest.id);
    if (updateErr) throw updateErr;

    const { data: userRow, error: userErr } = await supabase
      .from("users")
      .select("username, nom, prenom")
      .ilike("username", username)
      .maybeSingle();
    if (userErr) throw userErr;

    const { data: refreshedEnrollments, error: refreshErr } = await supabase
      .from("trimester_enrollments")
      .select("id, amount_expected, amount_per_period, billing_start_date, payment_method, amount_received, suspension_status, trimester, academic_year")
      .ilike("user_username", username);
    if (refreshErr) throw refreshErr;

    const allEnrollments = await syncAccrual(refreshedEnrollments ?? []);
    const totalExpected = allEnrollments.reduce((s, e) => s + Number(e.amount_expected ?? 0), 0);
    const totalPaid = allEnrollments.reduce((s, e) => s + Number(e.amount_received ?? 0), 0);
    const latestRefreshed = allEnrollments.sort((a, b) => {
      const aKey = `${a.academic_year || ""}${a.trimester || ""}`;
      const bKey = `${b.academic_year || ""}${b.trimester || ""}`;
      return bKey.localeCompare(aKey);
    })[0];

    const paymentStatus = computePaymentStatus(totalExpected, totalPaid);
    const latestTrimester = latestRefreshed
      ? `${latestRefreshed.trimester || ""} ${latestRefreshed.academic_year || ""}`.trim()
      : "";

    res.json({
      username,
      nom: userRow?.nom || "",
      prenom: userRow?.prenom || "",
      totalExpected,
      totalPaid,
      totalRemaining: totalExpected - totalPaid,
      enrollmentCount: allEnrollments.length,
      paymentStatus,
      latestTrimester,
      latestEnrollmentId: (latestRefreshed?.id as string) ?? null,
    });

    // Send WhatsApp receipt image to the parent — fire-and-forget so the API
    // response is never delayed by WhatsApp connectivity issues.
    setImmediate(async () => {
      try {
        const { data: fullUser } = await supabase
          .from("users")
          .select("nom, prenom, numero_parent")
          .ilike("username", username)
          .maybeSingle();

        if (!fullUser?.numero_parent) return;

        const now = new Date();
        const dateStr = now.toLocaleDateString("fr-MA", { day: "2-digit", month: "2-digit", year: "numeric" });

        const imgBuf = await generateReceiptImage({
          studentName: `${fullUser.nom || ""} ${fullUser.prenom || ""}`.trim(),
          username,
          trimester: latestRefreshed?.trimester || "",
          academicYear: latestRefreshed?.academic_year || "",
          program: (latestRefreshed as any)?.program || "",
          amountPaid: addedAmount,
          totalExpected,
          totalPaid,
          totalRemaining: totalExpected - totalPaid,
          paymentStatus,
          date: dateStr,
        });

        const result = await sendWhatsAppImage(
          fullUser.numero_parent,
          imgBuf,
          `✅ Paiement reçu — ${addedAmount.toFixed(2)} MAD\nMerci ! Mosaic Workshops`
        );
        if (!result.success) {
          req.log.warn({ username, error: result.error }, "add-payment: automatic receipt send failed");
        }
      } catch (err) {
        // Best-effort — never fail the payment itself — but still log so the
        // admin can find out why a receipt silently didn't go out (this used
        // to be swallowed with an empty catch, making failures invisible).
        req.log.error({ err, username }, "add-payment: unexpected error generating/sending receipt");
      }
    });
  } catch (err: unknown) {
    req.log.error({ err }, "add payment error");
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
