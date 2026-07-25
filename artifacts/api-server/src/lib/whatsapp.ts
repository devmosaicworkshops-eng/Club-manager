/**
 * WhatsApp integration via Baileys (open-source, no external API keys required).
 * On first boot (or when session expires), a QR code is printed to the console —
 * scan it with the WhatsApp mobile app to authenticate.
 * Session credentials are persisted in whatsapp_auth/ so restarts stay logged in.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  type WASocket,
  type BaileysEventMap,
} from "@whiskeysockets/baileys";
import qrcodeTerminal from "qrcode-terminal";
import { supabase } from "./supabase.js";
import { logger } from "./logger.js";

// ── Singleton socket ─────────────────────────────────────────────────────────

let sock: WASocket | null = null;
let isReady = false;
let isReconnecting = false; // guard against concurrent reconnect storms
let latestQr: string | null = null; // most recent QR string pending a scan, cleared once connected

/**
 * Normalise a phone number to Baileys' JID format: digits only + @s.whatsapp.net.
 *
 * Handles:
 *   "0612345678"    → Morocco local (10 digits starting with 0) → "212612345678@s.whatsapp.net"
 *   "+212612345678" → strip + → "212612345678@s.whatsapp.net"
 *   "212612345678"  → already international → unchanged
 */
function toJid(phone: string): string {
  let digits = phone.replace(/[\s\-+()\u200B]/g, "");
  // Morocco local format: 0XXXXXXXXX (10 digits starting with 0)
  if (/^0\d{9}$/.test(digits)) {
    digits = "212" + digits.slice(1);
  }
  return `${digits}@s.whatsapp.net`;
}

// ── Inbound message handler ──────────────────────────────────────────────────

async function handleIncoming(
  messages: BaileysEventMap["messages.upsert"]["messages"]
): Promise<void> {
  for (const msg of messages) {
    // Only care about real incoming texts (not our own outbound)
    if (msg.key.fromMe) continue;
    const jid = msg.key.remoteJid;
    if (!jid) continue;

    // Extract phone digits from JID (strip @s.whatsapp.net / @g.us for groups)
    const phone = jid.replace(/@.*/, "");
    const last9 = phone.slice(-9);

    const text =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      "";

    logger.info({ phone, text }, "Inbound WhatsApp message");

    try {
      // Match against sheets pipeline by phone suffix
      const { data: pipelineRows, error: fetchErr } = await supabase
        .from("lead_pipeline")
        .select("id, lead_key, whatsapp_status")
        .eq("lead_source", "sheets")
        .ilike("lead_key", `%${last9}%`);

      if (fetchErr) {
        logger.error({ err: fetchErr, phone }, "Supabase fetch error in inbound handler");
        continue;
      }

      if (pipelineRows && pipelineRows.length > 0) {
        for (const row of pipelineRows) {
          // Only advance if still waiting for a reply
          if (row.whatsapp_status !== "replied") {
            const { error: updateErr } = await supabase
              .from("lead_pipeline")
              .update({
                whatsapp_status: "replied",
                replied_at: new Date().toISOString(),
                current_step: 2,
                rendezvous_notes: text
                  ? `Réponse reçue: ${text}`
                  : "Réponse reçue",
              })
              .eq("id", row.id);

            if (updateErr) {
              logger.error({ err: updateErr, leadKey: row.lead_key }, "Failed to update pipeline replied status");
            } else {
              logger.info({ leadKey: row.lead_key }, "Lead marked as replied");
            }
          }
        }
      }
    } catch (err) {
      logger.error({ err, phone }, "Unexpected error in inbound message handler");
    }
  }
}

// ── Connection bootstrap ─────────────────────────────────────────────────────

async function connect(): Promise<void> {
  const { state, saveCreds } = await useMultiFileAuthState("whatsapp_auth");

  sock = makeWASocket({
    auth: state,
    // Suppress verbose Baileys logging — use our own pino logger
    logger: logger.child({ module: "baileys" }) as any,
    printQRInTerminal: false, // We handle QR ourselves for cleaner output
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      latestQr = qr;
      logger.info("📱 WhatsApp QR code — scan with your phone:");
      qrcodeTerminal.generate(qr, { small: true });
    }

    if (connection === "open") {
      isReady = true;
      latestQr = null;
      logger.info("✅ WhatsApp connected and ready");
    }

    if (connection === "close") {
      isReady = false;
      sock = null;
      const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      logger.warn({ statusCode }, "WhatsApp connection closed");
      if (shouldReconnect && !isReconnecting) {
        isReconnecting = true;
        logger.info("Reconnecting WhatsApp in 5 seconds…");
        setTimeout(() => {
          isReconnecting = false;
          connect().catch((err) =>
            logger.error({ err }, "WhatsApp reconnect attempt failed")
          );
        }, 5000);
      } else if (!shouldReconnect && !isReconnecting) {
        // Baileys reports 401/loggedOut both for an explicit logout AND for a
        // stale/never-fully-paired auth state (e.g. the QR was never scanned
        // before the server restarted). In both cases the persisted session
        // is unusable, so wipe it and start a fresh connection automatically
        // — otherwise the admin panel polls forever with no new QR ever
        // generated.
        isReconnecting = true;
        logger.warn(
          "WhatsApp session invalid (logged out or never paired) — wiping whatsapp_auth/ and generating a fresh QR"
        );
        (async () => {
          try {
            const authDir = path.join(process.cwd(), "whatsapp_auth");
            await fs.rm(authDir, { recursive: true, force: true });
          } catch (err) {
            logger.error({ err }, "Failed to clear stale WhatsApp auth state");
          } finally {
            isReconnecting = false;
            connect().catch((err) =>
              logger.error({ err }, "WhatsApp reconnect after auth reset failed")
            );
          }
        })();
      }
    }
  });

  sock.ev.on("messages.upsert", ({ messages, type }) => {
    if (type === "notify") {
      handleIncoming(messages).catch((err) =>
        logger.error({ err }, "Unhandled error in messages.upsert handler")
      );
    }
  });
}

/** Call once at server startup to initialise the Baileys connection. */
export async function initWhatsApp(): Promise<void> {
  try {
    await connect();
  } catch (err) {
    logger.error({ err }, "Failed to initialise WhatsApp (Baileys)");
  }
}

// ── Status / QR / reset for the admin UI ─────────────────────────────────────

export interface WhatsAppStatus {
  connected: boolean;
  qr: string | null;
}

/** Current connection status + pending QR (if any), for the admin panel. */
export function getWhatsAppStatus(): WhatsAppStatus {
  return { connected: isReady, qr: isReady ? null : latestQr };
}

/**
 * Log out the current session, wipe the persisted auth state, and start a
 * fresh connection so a new QR code is generated. Rarely used — only when
 * the linked phone changes or the session becomes unrecoverable.
 */
export async function resetWhatsApp(): Promise<{ success: boolean; error?: string }> {
  try {
    if (sock) {
      try {
        await sock.logout();
      } catch (err) {
        logger.warn({ err }, "WhatsApp logout during reset failed (continuing)");
      }
    }
    sock = null;
    isReady = false;
    isReconnecting = false;
    latestQr = null;

    const authDir = path.join(process.cwd(), "whatsapp_auth");
    await fs.rm(authDir, { recursive: true, force: true });

    logger.warn("WhatsApp session reset — starting fresh connection, new QR pending");
    await connect();
    return { success: true };
  } catch (err: any) {
    logger.error({ err }, "WhatsApp reset failed");
    return { success: false, error: err.message || "Reset failed" };
  }
}

// ── Public send API ──────────────────────────────────────────────────────────

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send a text message via the active Baileys socket.
 * @param to   Phone number in international format, e.g. "212600000000"
 * @param body Message text (supports WhatsApp markdown: *bold*, _italic_)
 */
const SEND_TIMEOUT_MS = 15_000;

/** Rejects after `ms` milliseconds with a timeout error. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`WhatsApp send timed out after ${ms / 1000}s`)), ms)
    ),
  ]);
}

// ── Outbound send queue ──────────────────────────────────────────────────────
// WhatsApp's abuse detection flags accounts that send several messages back
// to back — even a handful — especially via an unofficial client like
// Baileys. Every outbound send (single or triggered by a bulk action like
// re-enrolling a whole trimester) is funneled through this queue so sends
// are never fired concurrently and are always spaced out by a randomized
// human-like delay instead of going out in a burst.
const MIN_SEND_GAP_MS = 8_000;
const MAX_SEND_GAP_MS = 20_000;
let sendQueueTail: Promise<unknown> = Promise.resolve();

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function enqueueSend<T>(task: () => Promise<T>): Promise<T> {
  const run = sendQueueTail.then(async () => {
    const result = await task();
    const gap = MIN_SEND_GAP_MS + Math.random() * (MAX_SEND_GAP_MS - MIN_SEND_GAP_MS);
    await delay(gap);
    return result;
  });
  // Swallow rejections on the shared tail so one failed send doesn't wedge
  // the queue for everything queued after it.
  sendQueueTail = run.catch(() => undefined);
  return run;
}

export async function sendWhatsAppImage(
  to: string,
  image: Buffer,
  caption?: string
): Promise<WhatsAppSendResult> {
  return enqueueSend(async () => {
    if (!sock || !isReady) {
      return { success: false, error: "WhatsApp not connected." };
    }
    try {
      const jid = toJid(to);
      const result = await withTimeout(
        sock.sendMessage(jid, { image, mimetype: "image/png", caption: caption ?? "" }),
        SEND_TIMEOUT_MS
      );
      return { success: true, messageId: result?.key?.id ?? undefined };
    } catch (err: any) {
      logger.error({ err, to }, "Baileys image send error");
      return { success: false, error: err.message || "Send failed" };
    }
  });
}

export async function sendWhatsAppMessage(
  to: string,
  body: string
): Promise<WhatsAppSendResult> {
  return enqueueSend(async () => {
    if (!sock || !isReady) {
      return {
        success: false,
        error:
          "WhatsApp not connected. Check the server console for the QR code.",
      };
    }

    try {
      const jid = toJid(to);
      const result = await withTimeout(
        sock.sendMessage(jid, { text: body }),
        SEND_TIMEOUT_MS
      );
      // result?.key?.id can be string | null | undefined — coerce null to undefined
      const messageId = result?.key?.id ?? undefined;
      return { success: true, messageId };
    } catch (err: any) {
      logger.error({ err, to }, "Baileys send error");
      return { success: false, error: err.message || "Send failed" };
    }
  });
}
