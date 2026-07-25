// Payment status is always derived from amounts, never chosen manually.
// This keeps it consistent with what was actually paid instead of relying
// on an admin to remember to update a free-form dropdown.
export function computePaymentStatus(expected: number, received: number): string {
  if (expected > 0 && received >= expected) return "Payé";
  if (received > 0) return "Partiel";
  return "En attente";
}
