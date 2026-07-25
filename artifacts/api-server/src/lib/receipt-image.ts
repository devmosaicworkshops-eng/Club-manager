/**
 * Generates a professional payment receipt as a PNG buffer using SVG → sharp.
 * The resulting buffer can be sent directly as a WhatsApp image via Baileys.
 */
import sharp from "sharp";

interface ReceiptData {
  studentName: string;
  username: string;
  trimester: string;
  academicYear: string;
  program: string;
  amountPaid: number;
  totalExpected: number;
  totalPaid: number;
  totalRemaining: number;
  paymentStatus: string;
  date: string; // ISO or display string
}

function escapeXml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmt(n: number): string {
  return new Intl.NumberFormat("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function statusColor(status: string): string {
  if (status === "Payé") return "#16a34a";
  if (status === "Partiel") return "#d97706";
  return "#dc2626";
}

export async function generateReceiptImage(data: ReceiptData): Promise<Buffer> {
  const W = 640;
  const H = 420;
  const accentColor = "#1e3a5f";
  const lightBg = "#f0f4f8";
  const statusCol = statusColor(data.paymentStatus);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Arial, Helvetica, sans-serif">
  <!-- Background -->
  <rect width="${W}" height="${H}" fill="#ffffff" rx="16" ry="16"/>

  <!-- Top header bar -->
  <rect width="${W}" height="80" fill="${accentColor}" rx="16" ry="16"/>
  <rect y="64" width="${W}" height="16" fill="${accentColor}"/>

  <!-- Header text -->
  <text x="32" y="34" font-size="22" font-weight="bold" fill="#ffffff">🎓 Reçu de Paiement</text>
  <text x="32" y="60" font-size="13" fill="#94b4d4">Mosaic Workshops</text>
  <text x="${W - 32}" y="34" font-size="13" fill="#94b4d4" text-anchor="end">${escapeXml(data.date)}</text>

  <!-- Student info section -->
  <rect x="24" y="96" width="${W - 48}" height="70" fill="${lightBg}" rx="10" ry="10"/>
  <text x="44" y="122" font-size="13" fill="#6b7280">Élève</text>
  <text x="44" y="144" font-size="18" font-weight="bold" fill="#111827">${escapeXml(data.studentName)}</text>
  <text x="${W - 44}" y="122" font-size="13" fill="#6b7280" text-anchor="end">Trimestre</text>
  <text x="${W - 44}" y="144" font-size="18" font-weight="bold" fill="${accentColor}" text-anchor="end">${escapeXml(data.trimester)} — ${escapeXml(data.academicYear)}</text>

  <!-- Programme row -->
  <text x="44" y="188" font-size="13" fill="#6b7280">Programme : <tspan fill="#374151" font-weight="bold">${escapeXml(data.program || "N/A")}</tspan></text>

  <!-- Divider -->
  <line x1="24" y1="204" x2="${W - 24}" y2="204" stroke="#e5e7eb" stroke-width="1"/>

  <!-- Payment grid -->
  <!-- Montant versé (big highlighted) -->
  <rect x="24" y="214" width="${W - 48}" height="64" fill="#ecfdf5" rx="10" ry="10" stroke="#bbf7d0" stroke-width="1"/>
  <text x="44" y="238" font-size="13" fill="#166534">Montant versé ce paiement</text>
  <text x="${W - 44}" y="265" font-size="28" font-weight="bold" fill="#16a34a" text-anchor="end">${fmt(data.amountPaid)} MAD</text>

  <!-- Totals row -->
  <rect x="24" y="290" width="${(W - 60) / 3}" height="70" fill="${lightBg}" rx="8" ry="8"/>
  <text x="${24 + (W - 60) / 6}" y="314" font-size="11" fill="#6b7280" text-anchor="middle">Total Attendu</text>
  <text x="${24 + (W - 60) / 6}" y="342" font-size="16" font-weight="bold" fill="#374151" text-anchor="middle">${fmt(data.totalExpected)}</text>
  <text x="${24 + (W - 60) / 6}" y="356" font-size="10" fill="#9ca3af" text-anchor="middle">MAD</text>

  <rect x="${24 + (W - 60) / 3 + 12}" y="290" width="${(W - 60) / 3}" height="70" fill="${lightBg}" rx="8" ry="8"/>
  <text x="${24 + (W - 60) / 3 + 12 + (W - 60) / 6}" y="314" font-size="11" fill="#6b7280" text-anchor="middle">Total Payé</text>
  <text x="${24 + (W - 60) / 3 + 12 + (W - 60) / 6}" y="342" font-size="16" font-weight="bold" fill="#16a34a" text-anchor="middle">${fmt(data.totalPaid)}</text>
  <text x="${24 + (W - 60) / 3 + 12 + (W - 60) / 6}" y="356" font-size="10" fill="#9ca3af" text-anchor="middle">MAD</text>

  <rect x="${24 + 2 * ((W - 60) / 3 + 12)}" y="290" width="${(W - 60) / 3}" height="70" fill="${lightBg}" rx="8" ry="8"/>
  <text x="${24 + 2 * ((W - 60) / 3 + 12) + (W - 60) / 6}" y="314" font-size="11" fill="#6b7280" text-anchor="middle">Solde Restant</text>
  <text x="${24 + 2 * ((W - 60) / 3 + 12) + (W - 60) / 6}" y="342" font-size="16" font-weight="bold" fill="${data.totalRemaining > 0 ? "#dc2626" : "#16a34a"}" text-anchor="middle">${fmt(data.totalRemaining)}</text>
  <text x="${24 + 2 * ((W - 60) / 3 + 12) + (W - 60) / 6}" y="356" font-size="10" fill="#9ca3af" text-anchor="middle">MAD</text>

  <!-- Status badge -->
  <rect x="${W / 2 - 54}" y="374" width="108" height="28" fill="${statusCol}" rx="14" ry="14"/>
  <text x="${W / 2}" y="393" font-size="13" font-weight="bold" fill="#ffffff" text-anchor="middle">${escapeXml(data.paymentStatus)}</text>

  <!-- Footer -->
  <text x="${W / 2}" y="${H - 8}" font-size="10" fill="#d1d5db" text-anchor="middle">Merci pour votre confiance · Mosaic Workshops</text>
</svg>`;

  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return png;
}
