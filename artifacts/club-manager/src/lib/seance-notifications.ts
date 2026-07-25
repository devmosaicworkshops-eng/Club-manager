import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { Seance } from "@workspace/api-client-react";

const STORAGE_KEY = "mosaic:coach-seance-status-cache";

type StatusCache = Record<string, string>;

function readCache(): StatusCache {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeCache(cache: StatusCache) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // ignore storage errors (e.g. private browsing quota)
  }
}

type ToastFn = (opts: { title: string; description?: string; variant?: "default" | "destructive" }) => void;

/**
 * Compares the current séances a coach can see against the last-seen status
 * for each one (persisted in localStorage) and fires a toast notification
 * whenever the admin has approved or rejected a séance the coach submitted
 * for review. Call this on every seances list load — it is a no-op when
 * nothing has changed since the coach last saw the list.
 */
export function notifySeanceStatusChanges(seances: Seance[], toast: ToastFn) {
  const cache = readCache();
  let changed = false;

  for (const s of seances) {
    const status = s.status || "";
    const previous = cache[s.id];
    if (previous !== undefined && previous !== status) {
      const dateStr = s.date ? format(new Date(s.date), "dd MMMM 'à' HH:mm", { locale: fr }) : "";
      if (status === "Approved" && previous === "AwaitingApproval") {
        toast({
          title: "Séance approuvée ✅",
          description: `La séance ${s.categorie} du ${dateStr} a été validée par l'administration et est maintenant visible par les élèves.`,
        });
      } else if (status === "Rejected") {
        toast({
          title: "Séance rejetée",
          description: `La séance ${s.categorie} du ${dateStr} a été rejetée par l'administration. Corrigez les détails et renvoyez-la pour approbation.`,
          variant: "destructive",
        });
      }
    }
    if (previous !== status) changed = true;
    cache[s.id] = status;
  }

  if (changed) writeCache(cache);
}
