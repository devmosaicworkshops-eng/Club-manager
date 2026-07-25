import { useState, useCallback } from "react";

const STORAGE_KEY = "mosaic_whatsapp_template";

export const DEFAULT_TEMPLATE =
  "Bonjour {{prenom}} ! Bienvenue chez Mosaic Workshops. Quand êtes-vous disponible pour un rendez-vous ?";

/** Replaces {{prenom}}, {{nom}}, etc. with actual values. Unknown vars are left as-is. */
export function substituteVars(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

/** Persists the global WhatsApp message template in localStorage. */
export function useWhatsAppTemplate() {
  const [template, setTemplateState] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || DEFAULT_TEMPLATE;
    } catch {
      return DEFAULT_TEMPLATE;
    }
  });

  const saveTemplate = useCallback((next: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
    setTemplateState(next);
  }, []);

  const resetTemplate = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setTemplateState(DEFAULT_TEMPLATE);
  }, []);

  return { template, saveTemplate, resetTemplate };
}
