import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useGetWhatsAppStatus, useResetWhatsApp } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle, CheckCircle2, AlertTriangle, RotateCcw, Save } from "lucide-react";
import { useWhatsAppTemplate, DEFAULT_TEMPLATE } from "@/hooks/useWhatsAppTemplate";

/**
 * Hidden admin-only panel: WhatsApp connection status + QR code + a rarely
 * used "reset connection" control. Not linked from the nav — opened via a
 * discrete click in the sidebar profile block (see layout.tsx).
 */
const VARS = [
  { label: "{{prenom}}", hint: "Prénom du lead" },
  { label: "{{nom}}", hint: "Nom de famille" },
];

export function WhatsAppPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [confirmReset, setConfirmReset] = useState(false);

  // Template editor state
  const { template, saveTemplate, resetTemplate } = useWhatsAppTemplate();
  const [draftTemplate, setDraftTemplate] = useState(template);
  const [templateDirty, setTemplateDirty] = useState(false);

  const handleTemplateChange = (v: string) => {
    setDraftTemplate(v);
    setTemplateDirty(v !== template);
  };

  const handleInsertVar = (v: string) => {
    setDraftTemplate((prev) => prev + v);
    setTemplateDirty(true);
  };

  const handleSaveTemplate = () => {
    saveTemplate(draftTemplate);
    setTemplateDirty(false);
    toast({ title: "✅ Modèle sauvegardé" });
  };

  const handleResetTemplate = () => {
    resetTemplate();
    setDraftTemplate(DEFAULT_TEMPLATE);
    setTemplateDirty(false);
    toast({ title: "Modèle réinitialisé" });
  };

  const { data: status, isLoading } = useGetWhatsAppStatus({
    query: {
      queryKey: ["whatsappStatus"],
      enabled: open,
      refetchInterval: open ? 3000 : false,
    },
  });

  const resetMutation = useResetWhatsApp();

  const handleReset = () => {
    resetMutation.mutate(undefined, {
      onSuccess: (result) => {
        setConfirmReset(false);
        if (result.success) {
          toast({ title: "Connexion réinitialisée", description: "Scannez le nouveau QR code pour relier WhatsApp." });
          queryClient.invalidateQueries({ queryKey: ["whatsappStatus"] });
        } else {
          toast({ title: "Erreur", description: result.error || "La réinitialisation a échoué.", variant: "destructive" });
        }
      },
      onError: () => {
        setConfirmReset(false);
        toast({ title: "Erreur", description: "La réinitialisation a échoué.", variant: "destructive" });
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4" /> Connexion WhatsApp
          </DialogTitle>
          <DialogDescription>
            Utilisée pour envoyer les messages automatiques aux familles.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          {isLoading ? (
            <div className="py-10 text-sm text-muted-foreground">Chargement…</div>
          ) : status?.connected ? (
            <div className="flex flex-col items-center gap-2 py-8">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
              <p className="text-sm font-medium text-foreground">WhatsApp est connecté</p>
              <p className="text-xs text-muted-foreground">Les messages automatiques sont actifs.</p>
            </div>
          ) : status?.qr ? (
            <div className="flex flex-col items-center gap-3">
              <div className="p-3 bg-white rounded-xl border border-border">
                <QRCodeSVG value={status.qr} size={220} />
              </div>
              <p className="text-xs text-muted-foreground text-center max-w-[280px]">
                Ouvrez WhatsApp sur le téléphone du club → Paramètres → Appareils connectés → Connecter un appareil, puis scannez ce code.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-8">
              <AlertTriangle className="w-8 h-8 text-amber-500" />
              <p className="text-sm text-muted-foreground text-center">
                En attente d'un code QR… Le serveur redémarre la connexion, cela peut prendre quelques secondes.
              </p>
            </div>
          )}

          {/* ── Message template editor ───────────────────────────── */}
          <div className="w-full border-t border-border pt-4 space-y-2">
            <p className="text-xs font-medium text-foreground">Modèle de message</p>
            <p className="text-xs text-muted-foreground">
              Variables disponibles — cliquez pour insérer :
            </p>
            <div className="flex flex-wrap gap-1.5">
              {VARS.map((v) => (
                <button
                  key={v.label}
                  type="button"
                  title={v.hint}
                  onClick={() => handleInsertVar(v.label)}
                  className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-xs font-mono border border-indigo-200 hover:bg-indigo-100 transition-colors"
                >
                  {v.label}
                </button>
              ))}
            </div>
            <Textarea
              value={draftTemplate}
              onChange={(e) => handleTemplateChange(e.target.value)}
              rows={4}
              className="text-sm resize-none"
              placeholder="Votre modèle de message…"
            />
            <div className="flex justify-between items-center gap-2">
              <button
                type="button"
                onClick={handleResetTemplate}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
              >
                Remettre par défaut
              </button>
              <Button
                size="sm"
                onClick={handleSaveTemplate}
                disabled={!templateDirty}
                className="gap-1.5"
              >
                <Save className="w-3 h-3" />
                Sauvegarder
              </Button>
            </div>
          </div>

          <div className="w-full border-t border-border pt-4">
            {!confirmReset ? (
              <button
                onClick={() => setConfirmReset(true)}
                className="text-xs text-muted-foreground hover:text-red-600 transition-colors flex items-center gap-1.5 mx-auto"
              >
                <RotateCcw className="w-3 h-3" /> Réinitialiser la connexion
              </button>
            ) : (
              <div className="flex flex-col items-center gap-2 text-center">
                <p className="text-xs text-amber-700">
                  Cela déconnecte WhatsApp immédiatement. Un nouveau code QR sera nécessaire — à utiliser uniquement en cas de problème.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setConfirmReset(false)}>
                    Annuler
                  </Button>
                  <Button variant="destructive" size="sm" onClick={handleReset} disabled={resetMutation.isPending}>
                    {resetMutation.isPending ? "Réinitialisation…" : "Confirmer la réinitialisation"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
