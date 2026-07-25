/**
 * Shared logic for sending a WhatsApp receipt for a trimester enrollment —
 * used both by the manual "Renvoyer le reçu" admin action and by automatic
 * sends triggered right after a trimester is first activated for a user
 * (initial enrollment creation or reroll), so both include the initial
 * "montant attendu" / "montant reçu" amounts.
 */
import { supabase } from "./supabase.js";
import { sendWhatsAppImage } from "./whatsapp.js";
import { generateReceiptImage } from "./receipt-image.js";
import { computePaymentStatus } from "./payment-status.js";
import { getAllLeads } from "./sheets-leads.js";
import { logger } from "./logger.js";

export type SendReceiptResult = { success: boolean; error?: string };

export async function sendReceiptForEnrollment(enrollmentId: string): Promise<SendReceiptResult> {
  const { data: enrollment, error: fetchErr } = await supabase
    .from("trimester_enrollments")
    .select("*")
    .eq("id", enrollmentId)
    .single();
  if (fetchErr) {
    return { success: false, error: fetchErr.message };
  }

  // Resolve the parent's phone number. A linked user account (user_username)
  // is the source of truth whenever it exists — see
  // .agents/memory/club-manager-receipt-lookup.md. Only fall back to the
  // lead tables when there is no linked user yet.
  let phoneNumber = "";
  let studentName = "";

  if (enrollment.user_username) {
    const { data: u } = await supabase
      .from("users")
      .select("nom, prenom, numero_parent")
      .ilike("username", enrollment.user_username)
      .maybeSingle();
    phoneNumber = u?.numero_parent || "";
    studentName = `${u?.nom || ""} ${u?.prenom || ""}`.trim();
  }

  if (!phoneNumber) {
    if (enrollment.lead_source === "manual") {
      const { data: ml } = await supabase
        .from("manual_leads")
        .select("nom, prenom, numero_parent")
        .eq("id", enrollment.lead_key)
        .maybeSingle();
      phoneNumber = ml?.numero_parent || "";
      studentName = studentName || `${ml?.nom || ""} ${ml?.prenom || ""}`.trim();
    } else if (enrollment.lead_source === "sheets") {
      const leads = await getAllLeads();
      const sl = leads.find((l) => l._rowIndex === enrollment.lead_key);
      phoneNumber = sl?.numeroParent || "";
      studentName = studentName || `${sl?.nom || ""} ${sl?.prenom || ""}`.trim();
    }
  }

  if (!phoneNumber) {
    return { success: false, error: "Aucun numéro de téléphone trouvé pour ce contact" };
  }

  const e = enrollment as Record<string, unknown>;
  const expected = Number(e.amount_expected ?? 0);
  const received = Number(e.amount_received ?? 0);
  const remaining = expected - received;
  const paymentStatus = computePaymentStatus(expected, received);
  const dateStr = new Date().toLocaleDateString("fr-MA", { day: "2-digit", month: "2-digit", year: "numeric" });

  try {
    const imgBuf = await generateReceiptImage({
      studentName: studentName || (enrollment.user_username as string) || "",
      username: (enrollment.user_username as string) || "",
      trimester: (e.trimester as string) || "",
      academicYear: (e.academic_year as string) || "",
      program: (e.program as string) || "",
      amountPaid: received,
      totalExpected: expected,
      totalPaid: received,
      totalRemaining: remaining,
      paymentStatus,
      date: dateStr,
    });

    const whatsappResult = await sendWhatsAppImage(
      phoneNumber,
      imgBuf,
      `🎓 *Reçu Mosaic Workshops*\nN° Facture: ${e.invoice_number || "N/A"}\nMerci pour votre confiance!`
    );

    if (whatsappResult.success) {
      await supabase
        .from("trimester_enrollments")
        .update({ receipt_sent_at: new Date().toISOString() })
        .eq("id", enrollmentId);
    } else {
      logger.warn({ enrollmentId, error: whatsappResult.error }, "sendReceiptForEnrollment: WhatsApp send failed");
    }

    return { success: whatsappResult.success, error: whatsappResult.success ? undefined : whatsappResult.error };
  } catch (err: unknown) {
    logger.error({ err, enrollmentId }, "sendReceiptForEnrollment threw");
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Fire-and-forget wrapper for automatic sends right after a trimester
 * enrollment is first created (leads pipeline conversion or reroll).
 * Never throws — logs failures instead of swallowing them, since WhatsApp
 * send failures are otherwise invisible to admins.
 */
export function sendReceiptForEnrollmentBestEffort(enrollmentId: string): void {
  sendReceiptForEnrollment(enrollmentId)
    .then((result) => {
      if (!result.success) {
        logger.warn({ enrollmentId, error: result.error }, "auto receipt send failed");
      }
    })
    .catch((err) => logger.error({ err, enrollmentId }, "auto receipt send threw"));
}
