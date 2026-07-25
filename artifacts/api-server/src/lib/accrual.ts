import { supabase } from "./supabase.js";

// Number of days considered one billing cycle. Trimestriel is the only
// supported payment method — billing always follows the trimester cycle
// (~90 days), refilled on each reroll.
const CYCLE_DAYS: Record<string, number> = {
  Trimestriel: 90,
};

export interface AccrualRow {
  id: string;
  amount_expected: number | string | null;
  amount_per_period: number | string | null;
  billing_start_date: string | null;
  payment_method: string | null;
  suspension_status: string | null;
}

// Computes what amount_expected *should* be right now given the per-period
// amount entered at activation and how many billing cycles have elapsed
// since billing_start_date. Legacy rows without amount_per_period/
// billing_start_date are left untouched (return the stored amount_expected
// as-is) so old data keeps working exactly as before.
export function computeAccruedExpected(row: AccrualRow): number {
  const stored = Number(row.amount_expected ?? 0);
  const perPeriod = row.amount_per_period != null ? Number(row.amount_per_period) : null;

  if (!perPeriod || perPeriod <= 0 || !row.billing_start_date) {
    return stored;
  }

  // Freeze accrual for suspended/inactive enrollments — do not keep charging
  // a user who is not currently enrolled/active.
  if (row.suspension_status && row.suspension_status !== "Actif") {
    return stored;
  }

  const cycleDays = CYCLE_DAYS[row.payment_method || ""] ?? 90;
  const start = new Date(row.billing_start_date);
  if (Number.isNaN(start.getTime())) return stored;

  const now = new Date();
  const daysElapsed = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
  const periodsElapsed = Math.max(1, Math.floor(daysElapsed / cycleDays) + 1);

  return Math.round(perPeriod * periodsElapsed * 100) / 100;
}

// Recomputes amount_expected for a batch of enrollment rows and persists any
// rows whose accrued amount increased since it was last stored. Returns the
// same rows with amount_expected updated in-place so callers can use them
// immediately without a second round-trip.
export async function syncAccrual<T extends AccrualRow>(rows: T[]): Promise<T[]> {
  const updates: { id: string; amount_expected: number }[] = [];

  for (const row of rows) {
    const accrued = computeAccruedExpected(row);
    const stored = Number(row.amount_expected ?? 0);
    if (accrued !== stored) {
      updates.push({ id: row.id, amount_expected: accrued });
      row.amount_expected = accrued;
    }
  }

  if (updates.length > 0) {
    await Promise.all(
      updates.map((u) =>
        supabase.from("trimester_enrollments").update({ amount_expected: u.amount_expected }).eq("id", u.id)
      )
    );
  }

  return rows;
}
