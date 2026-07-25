import { useState, useMemo, useEffect } from "react";
import {
  useGetLeads, useGetManualLeads, useGetPipeline,
  useUpsertPipeline, useUpdatePipelineEntry, useDeletePipelineEntry,
  useSendWhatsApp, useCreateEnrollment, useUpdateEnrollment, getEnrollments, useCreateUser,
  useCreateManualLead, useUpdateManualLead, useDeleteManualLead,
  useDeleteLeadByKey, useGetGroups, useGetEnrollments, useGetCurrentTrimester,
  getGetPipelineQueryKey, getGetManualLeadsQueryKey, getGetLeadsQueryKey,
  getGetEnrollmentsQueryKey, getGetUserBillingsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PipelineTracker } from "@/components/PipelineTracker";
import { useToast } from "@/components/ui/use-toast";
import {
  MessageCircle, FileText, Phone, User as UserIcon,
  ChevronDown, ChevronUp, Trash2, CheckCircle2, RotateCcw, Calendar,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useWhatsAppTemplate, substituteVars } from "@/hooks/useWhatsAppTemplate";
import { useForm } from "react-hook-form";

type UnifiedLead = {
  id: string;
  nom: string;
  prenom: string;
  numeroParent?: string;
  source: "google" | "manual";
  raw: any;
};

export default function AdminLeads() {
  const { data: googleLeads } = useGetLeads();
  const { data: manualLeads } = useGetManualLeads();
  const { data: pipeline } = useGetPipeline();
  const [activeTab, setActiveTab] = useState("google");
  const [showCompleted, setShowCompleted] = useState(false);

  const unifiedGoogleLeads: UnifiedLead[] = useMemo(() =>
    (googleLeads || []).map(lead => ({
      id: lead._rowIndex, nom: lead.nom, prenom: lead.prenom,
      numeroParent: lead.numeroParent, source: "google", raw: lead,
    })), [googleLeads]);

  const unifiedManualLeads: UnifiedLead[] = useMemo(() =>
    (manualLeads || []).map(lead => ({
      id: lead.id, nom: lead.nom, prenom: lead.prenom,
      numeroParent: lead.numeroParent, source: "manual", raw: lead,
    })), [manualLeads]);

  const getPipelineForLead = (leadId: string) =>
    pipeline?.find(p => p.leadKey === leadId);

  const isCompleted = (lead: UnifiedLead) => {
    if (lead.source === "manual") return !!(lead.raw.confirmed);
    const pe = getPipelineForLead(lead.id);
    return !!(pe?.confirmed);
  };

  const completedGoogleCount = unifiedGoogleLeads.filter(l => isCompleted(l)).length;
  const completedManualCount = unifiedManualLeads.filter(l => isCompleted(l)).length;

  const visibleGoogle = showCompleted ? unifiedGoogleLeads : unifiedGoogleLeads.filter(l => !isCompleted(l));
  const visibleManual = showCompleted ? unifiedManualLeads : unifiedManualLeads.filter(l => !isCompleted(l));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Pipeline des Leads</h1>
          <p className="text-gray-500 mt-1">Gérez l'intégration des nouveaux membres étape par étape.</p>
        </div>
        <div className="flex items-center gap-3">
          {(completedGoogleCount + completedManualCount) > 0 && (
            <button
              onClick={() => setShowCompleted(v => !v)}
              className="text-sm text-gray-500 hover:text-primary flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              {showCompleted ? "Masquer" : "Afficher"} les complétés ({completedGoogleCount + completedManualCount})
            </button>
          )}
          <ManualLeadDialog />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="google" className="gap-2"><FileText className="w-4 h-4" /> Leads Google Form</TabsTrigger>
          <TabsTrigger value="manual" className="gap-2"><UserIcon className="w-4 h-4" /> Leads Manuels (Walk-ins)</TabsTrigger>
        </TabsList>

        <TabsContent value="google" className="space-y-4">
          {visibleGoogle.map(lead => (
            <LeadRow key={`google-${lead.id}`} lead={lead} pipelineEntry={getPipelineForLead(lead.id)} />
          ))}
          {visibleGoogle.length === 0 && (
            <div className="p-8 text-center text-gray-500 bg-white border border-dashed rounded-xl">
              {completedGoogleCount > 0 && !showCompleted
                ? `Tous les leads sont complétés. Cliquez sur "Afficher les complétés" pour les voir.`
                : "Aucun lead trouvé."}
            </div>
          )}
        </TabsContent>

        <TabsContent value="manual" className="space-y-4">
          {visibleManual.map(lead => (
            <LeadRow key={`manual-${lead.id}`} lead={lead} pipelineEntry={undefined} />
          ))}
          {visibleManual.length === 0 && (
            <div className="p-8 text-center text-gray-500 bg-white border border-dashed rounded-xl">
              {completedManualCount > 0 && !showCompleted
                ? `Tous les leads sont complétés. Cliquez sur "Afficher les complétés" pour les voir.`
                : "Aucun lead manuel trouvé."}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Lead Row ─────────────────────────────────────────────────────────────────

function LeadRow({ lead, pipelineEntry }: { lead: UnifiedLead; pipelineEntry: any }) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const deleteManual = useDeleteManualLead();
  const deletePipeline = useDeletePipelineEntry();
  const deleteLeadByKey = useDeleteLeadByKey();

  // Step comes from the right source depending on lead type
  const stepData = lead.source === "manual" ? lead.raw : pipelineEntry;
  const currentStep = stepData?.currentStep ?? (lead.source === "manual" ? 3 : 1);
  const isCompleted = !!(stepData?.confirmed);

  const handleDelete = () => {
    if (lead.source === "manual") {
      deleteManual.mutate({ id: lead.id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetManualLeadsQueryKey() });
          toast({ title: "Lead supprimé" });
        },
        onError: () => toast({ title: "Erreur lors de la suppression", variant: "destructive" }),
      });
    } else if (pipelineEntry) {
      // Deleting the pipeline entry also removes the underlying Google Sheet
      // row server-side, so the lead disappears entirely — refresh both
      // caches so it doesn't stick around (or reappear at step 1).
      deletePipeline.mutate({ id: pipelineEntry.id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetPipelineQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetLeadsQueryKey() });
          toast({ title: "Lead supprimé" });
        },
        onError: () => toast({ title: "Erreur lors de la suppression", variant: "destructive" }),
      });
    } else {
      // Google lead with no pipeline entry yet — delete the sheet row directly
      deleteLeadByKey.mutate({ data: { rowKey: lead.id } }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetLeadsQueryKey() });
          toast({ title: "Lead supprimé" });
        },
        onError: () => toast({ title: "Erreur lors de la suppression", variant: "destructive" }),
      });
    }
  };

  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-opacity ${isCompleted ? "border-green-200 opacity-80" : "border-gray-200"}`}>
      <div className="p-5 flex items-center justify-between">
        {/* Name + phone */}
        <div
          className="flex items-center gap-4 w-1/3 cursor-pointer"
          onClick={() => setExpanded(e => !e)}
        >
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${isCompleted ? "bg-green-100 text-green-700" : "bg-primary/10 text-primary"}`}>
            {isCompleted
              ? <CheckCircle2 className="w-5 h-5" />
              : <>{lead.nom.charAt(0)}{lead.prenom.charAt(0)}</>}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{lead.nom} {lead.prenom}</h3>
            {lead.numeroParent && (
              <p className="text-xs text-gray-500 flex items-center gap-1"><Phone className="w-3 h-3" /> {lead.numeroParent}</p>
            )}
            {isCompleted && <p className="text-xs text-green-600 font-medium">✓ Intégration complète</p>}
          </div>
        </div>

        {/* Pipeline tracker */}
        <div className="w-1/2 px-8 cursor-pointer" onClick={() => setExpanded(e => !e)}>
          <PipelineTracker currentStep={currentStep} isManual={lead.source === "manual"} />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {confirmDelete ? (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
              <span className="text-xs text-red-700">Confirmer ?</span>
              <Button size="sm" variant="destructive" className="h-6 text-xs px-2" onClick={handleDelete}>
                Oui
              </Button>
              <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => setConfirmDelete(false)}>
                Non
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
              title="Supprimer ce lead"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setExpanded(e => !e)}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="p-6 border-t border-gray-100 bg-gray-50/50">
          <LeadPipelineSteps lead={lead} pipelineEntry={pipelineEntry} currentStep={currentStep} stepData={stepData} />
        </div>
      )}
    </div>
  );
}

// ── Pipeline Steps ────────────────────────────────────────────────────────────

function LeadPipelineSteps({
  lead, pipelineEntry, currentStep, stepData,
}: {
  lead: UnifiedLead; pipelineEntry: any; currentStep: number; stepData: any;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const upsertPipeline = useUpsertPipeline();
  const updatePipeline = useUpdatePipelineEntry();
  const updateManual = useUpdateManualLead();

  // minStep: manual leads skip only step 1 (WhatsApp); they can go back to step 2 (Rendez-vous)
  const minStep = lead.source === "manual" ? 2 : 1;

  const handleGoToStep = (step: number, payload?: Record<string, unknown>) => {
    // If going back from a completed state, clear the confirmed flag so the lead
    // re-appears in the active list and isn't hidden by the completed filter.
    const clearConfirmed = stepData?.confirmed && step < 6 ? { confirmed: false } : {};

    if (lead.source === "manual") {
      updateManual.mutate(
        { id: lead.id, data: { currentStep: step, ...clearConfirmed, ...payload } as any },
        {
          onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetManualLeadsQueryKey() }),
          onError: () => toast({ title: "Erreur de mise à jour", variant: "destructive" }),
        }
      );
    } else {
      if (!pipelineEntry) {
        upsertPipeline.mutate(
          { data: { leadKey: lead.id, paymentType: "Trimestriel", currentStep: step } },
          {
            onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetPipelineQueryKey() }),
            onError: () => toast({ title: "Erreur de mise à jour", variant: "destructive" }),
          }
        );
      } else {
        updatePipeline.mutate(
          { id: pipelineEntry.id, data: { currentStep: step, ...clearConfirmed, ...payload } as any },
          {
            onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetPipelineQueryKey() }),
            onError: () => toast({ title: "Erreur de mise à jour", variant: "destructive" }),
          }
        );
      }
    }
  };

  // stepKey forces form re-initialisation when currentStep or data changes
  const stepKey = `${stepData?.id || lead.id}-step${currentStep}`;

  return (
    <div className="space-y-6">

      {/* ── Retour au Rendez-vous — manual leads only, visible from step 3 onwards ── */}
      {lead.source === "manual" && currentStep >= 3 && (
        <div className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-blue-700">
            <Calendar className="w-4 h-4 shrink-0" />
            {stepData?.rendezvousDate ? (
              <span>Rendez-vous : <strong>{new Date(stepData.rendezvousDate).toLocaleDateString("fr-FR", { dateStyle: "long" })}</strong></span>
            ) : (
              <span className="text-blue-600">Rendez-vous</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => handleGoToStep(2)}
            className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 bg-white rounded-lg px-3 py-1.5 transition-colors shrink-0 ml-4"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {stepData?.rendezvousDate ? "Modifier" : "Planifier"}
          </button>
        </div>
      )}

      {/* STEP 1: WhatsApp — Google leads only */}
      {lead.source === "google" && (
        <StepSection
          title="Étape 1 — Contact WhatsApp"
          stepNum={1} currentStep={currentStep} minStep={minStep}
          onGoToStep={handleGoToStep}
          doneLabel={stepData?.whatsappStatus === "replied" ? "Message envoyé · réponse reçue" : "Message envoyé"}
        >
          <WhatsAppAction
            key={stepKey} lead={lead} pipelineEntry={pipelineEntry}
            onAdvance={() => handleGoToStep(2)}
          />
        </StepSection>
      )}

      {/* STEP 2: Rendez-vous — Google leads always; manual leads when at step 2 */}
      {(lead.source === "google" || currentStep <= 2) && (
        <StepSection
          title="Étape 2 — Rendez-vous"
          stepNum={2} currentStep={currentStep} minStep={minStep}
          onGoToStep={handleGoToStep}
          doneLabel={stepData?.rendezvousDate
            ? `Rendez-vous: ${new Date(stepData.rendezvousDate).toLocaleDateString("fr-FR", { dateStyle: "long" })}`
            : "Rendez-vous confirmé"}
        >
          <RdvForm
            key={stepKey} pipelineEntry={pipelineEntry}
            onSave={(date: string) => handleGoToStep(3, { rendezvousDate: date })}
          />
        </StepSection>
      )}

      {/* STEP 3: Porte Légale */}
      <StepSection
        title="Étape 3 — Porte Légale & Admin"
        stepNum={3} currentStep={currentStep} minStep={minStep}
        onGoToStep={handleGoToStep}
        doneLabel="Documents & frais validés"
      >
        <LegalGateForm
          key={stepKey} stepData={stepData}
          onSave={(data: Record<string, unknown>) => handleGoToStep(4, data)}
        />
      </StepSection>

      {/* STEP 4: Activation Trimestre */}
      <StepSection
        title="Étape 4 — Activation du Trimestre"
        stepNum={4} currentStep={currentStep} minStep={minStep}
        onGoToStep={handleGoToStep}
        doneLabel="Trimestre activé"
      >
        <EnrollmentForm key={stepKey} lead={lead} onComplete={() => handleGoToStep(5)} />
      </StepSection>

      {/* STEP 5: Création Compte */}
      <StepSection
        title="Étape 5 — Création du Compte"
        stepNum={5} currentStep={currentStep} minStep={minStep}
        onGoToStep={handleGoToStep}
        doneLabel="Compte utilisateur créé · Intégration complète ✓"
      >
        <CreateUserForm
          key={stepKey} lead={lead}
          onComplete={() => handleGoToStep(6, { confirmed: true })}
        />
      </StepSection>
    </div>
  );
}

// ── Enrollment/User linking helper ─────────────────────────────────────────
// After the account is created in Step 5, the trimester enrollment created in
// Step 4 is still linked only by leadKey (userUsername is null, since the
// account didn't exist yet). We look it up here and patch it to the new
// username so payments show up correctly across the app.
function useLinkEnrollmentToUser() {
  const queryClient = useQueryClient();
  const updateEnrollment = useUpdateEnrollment();

  return async (leadKey: string, username: string) => {
    const enrollments = await queryClient.fetchQuery({
      queryKey: getGetEnrollmentsQueryKey({ leadKey }),
      queryFn: () => getEnrollments({ leadKey }),
    });

    const enrollment = Array.isArray(enrollments) ? enrollments[0] : undefined;
    if (!enrollment?.id) return;

    await updateEnrollment.mutateAsync({ id: enrollment.id, data: { userUsername: username } });
    queryClient.invalidateQueries({ queryKey: getGetEnrollmentsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetUserBillingsQueryKey() });
  };
}

// ── Step Section Wrapper ──────────────────────────────────────────────────────

function StepSection({
  title, stepNum, currentStep, minStep, onGoToStep, doneLabel, children,
}: {
  title: string;
  stepNum: number;
  currentStep: number;
  minStep: number;
  onGoToStep: (step: number) => void;
  doneLabel?: string;
  children: React.ReactNode;
}) {
  const isActive = currentStep === stepNum;
  const isDone = currentStep > stepNum;
  const isFuture = currentStep < stepNum;

  return (
    <div className={`relative pl-6 border-l-2 pb-2 ${isActive ? "border-primary" : isDone ? "border-green-500" : "border-gray-200"}`}>
      {/* Step dot */}
      <div className={`absolute -left-2 top-0.5 w-3.5 h-3.5 rounded-full border-2
        ${isActive ? "bg-primary border-primary ring-4 ring-primary/20"
          : isDone ? "bg-green-500 border-green-500"
          : "bg-white border-gray-300"}`}
      />

      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <h4 className={`text-sm font-bold ${isActive ? "text-primary" : isDone ? "text-gray-800" : "text-gray-400"}`}>
          {isDone && <span className="text-green-500 mr-1.5">✓</span>}
          {title}
        </h4>

        {/* Done → "Modifier" button */}
        {isDone && stepNum >= minStep && (
          <button
            type="button"
            onClick={() => onGoToStep(stepNum)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-primary transition-colors"
          >
            <RotateCcw className="w-3 h-3" /> Modifier
          </button>
        )}
      </div>

      {/* Done: show summary only */}
      {isDone && doneLabel && (
        <p className="text-xs text-gray-500 italic">{doneLabel}</p>
      )}

      {/* Active: show form + optional back button */}
      {isActive && (
        <div>
          {stepNum > minStep && (
            <button
              type="button"
              onClick={() => onGoToStep(stepNum - 1)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-primary mb-3 transition-colors"
            >
              ← Étape précédente
            </button>
          )}
          {children}
        </div>
      )}

      {/* Future: grayed out placeholder */}
      {isFuture && (
        <p className="text-xs text-gray-400 italic">En attente des étapes précédentes…</p>
      )}
    </div>
  );
}

// ── Step Forms ────────────────────────────────────────────────────────────────

function WhatsAppAction({ lead, pipelineEntry, onAdvance }: any) {
  const sendWhatsApp = useSendWhatsApp();
  const { toast } = useToast();
  const alreadySent = pipelineEntry?.whatsappStatus === "sent" || pipelineEntry?.whatsappStatus === "replied";

  // Global template → substitute vars → local editable copy
  const { template } = useWhatsAppTemplate();
  const rendered = substituteVars(template, { prenom: lead.prenom ?? "", nom: lead.nom ?? "" });
  const [message, setMessage] = useState(rendered);

  // Re-sync when the global template changes (e.g. saved from WhatsApp panel)
  useEffect(() => {
    setMessage(substituteVars(template, { prenom: lead.prenom ?? "", nom: lead.nom ?? "" }));
  }, [template, lead.prenom, lead.nom]);

  const handleSend = () => {
    sendWhatsApp.mutate({
      data: {
        leadKey: lead.id,
        leadSource: lead.source,
        phoneNumber: lead.numeroParent || "",
        message,
      },
    }, {
      onSuccess: (res) => {
        if (res.success) {
          toast({ title: "✅ Message WhatsApp envoyé" });
          onAdvance();
        } else {
          toast({ title: "Envoi échoué", description: res.error || "Vérifiez la connexion WhatsApp", variant: "destructive" });
        }
      },
      onError: () => toast({ title: "Erreur d'envoi", variant: "destructive" }),
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="space-y-1">
        <p className="text-xs text-gray-500">Message à envoyer — modifiable avant envoi :</p>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          className="text-sm resize-none bg-white"
          placeholder="Rédigez votre message…"
        />
        {alreadySent && (
          <p className="text-xs text-green-600">✓ Message déjà envoyé — cliquez pour renvoyer et passer à l'étape suivante</p>
        )}
      </div>
      <Button
        onClick={handleSend}
        disabled={!lead.numeroParent || !message.trim() || sendWhatsApp.isPending}
        className="gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white w-full sm:w-auto"
      >
        <MessageCircle className="w-4 h-4" />
        {sendWhatsApp.isPending ? "Envoi…" : "Envoyer via WhatsApp"}
      </Button>
    </div>
  );
}

function RdvForm({ pipelineEntry, onSave }: any) {
  const [date, setDate] = useState(
    pipelineEntry?.rendezvousDate ? pipelineEntry.rendezvousDate.substring(0, 16) : ""
  );

  return (
    <div className="flex items-end gap-4">
      <div className="flex-1 space-y-2">
        <Label>Date et heure du rendez-vous</Label>
        <Input type="datetime-local" value={date} onChange={e => setDate(e.target.value)} />
      </div>
      <Button
        onClick={() => onSave(new Date(date).toISOString())}
        disabled={!date}
      >
        Confirmer
      </Button>
    </div>
  );
}

function LegalGateForm({ stepData, onSave }: any) {
  const { register, handleSubmit } = useForm({
    defaultValues: {
      afSubmitted: stepData?.afSubmitted || false,
      imageAuthorization: stepData?.imageAuthorization || false,
      identityVerified: stepData?.identityVerified || false,
      termsSigned: stepData?.termsSigned || false,
      reglementSigned: stepData?.reglementSigned || false,
      feeStatus: stepData?.feeStatus || "Non Payé",
      medicalNotes: stepData?.medicalNotes || "",
    },
  });

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4 bg-white p-4 rounded-xl border border-gray-200">
      <div className="grid grid-cols-2 gap-3">
        {[
          ["afSubmitted", "Formulaire Admission (AF) Soumis"],
          ["imageAuthorization", "Autorisation Image Signée"],
          ["identityVerified", "Identité Vérifiée"],
          ["termsSigned", "Conditions Générales Signées"],
          ["reglementSigned", "Règlement Intérieur Signé"],
        ].map(([field, label]) => (
          <label key={field} className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" {...register(field as any)} className="w-4 h-4 rounded border-gray-300 accent-primary" />
            {label}
          </label>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
        <div className="space-y-2">
          <Label>Statut Frais d'inscription</Label>
          <select {...register("feeStatus")} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
            <option value="Non Payé">Non Payé</option>
            <option value="Payé">Payé</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label>Notes Médicales</Label>
          <Input {...register("medicalNotes")} placeholder="Allergies, notes…" />
        </div>
      </div>
      <Button type="submit" className="w-full">Valider & Passer à l'étape 4</Button>
    </form>
  );
}

const CATEGORIES = ["Mini Maker", "Junior", "Cadets", "Senior"];

/** Determine the expected trimester from the current calendar month, mirroring
 * the same logic used on the Trimestres page, as a fallback when no admin has
 * activated a trimester yet. */
function getAutoTrimester(): { trimester: string; academicYear: string } | null {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-based
  const y = now.getFullYear();
  if (month >= 10) return { trimester: "T1", academicYear: `${y}-${y + 1}` };
  if (month <= 3)  return { trimester: "T2", academicYear: `${y - 1}-${y}` };
  if (month <= 6)  return { trimester: "T3", academicYear: `${y - 1}-${y}` };
  return null; // Jul–Sep: summer break
}

function EnrollmentForm({ lead, onComplete }: any) {
  const createEnrollment = useCreateEnrollment();
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  // Default to whatever trimester/year is actually active club-wide, so a
  // freshly enrolled lead lands in the same period the Trimestres page shows
  // by default — no separate manual re-add needed for it to show up there.
  const { data: activeTrimester } = useGetCurrentTrimester();
  const auto = getAutoTrimester();
  const defaultTrimester = activeTrimester?.currentTrimester || auto?.trimester || "T1";
  const defaultAcademicYear = activeTrimester?.currentAcademicYear || auto?.academicYear || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
  const { register, handleSubmit, watch, setValue } = useForm({
    values: {
      categorie: "Junior", paymentMethod: "Trimestriel", groupName: "",
      facilitator: "", amountExpected: 0,
      amountReceived: 0, suspensionStatus: "Actif", invoiceNumber: "",
      trimester: defaultTrimester, academicYear: defaultAcademicYear,
      parcours: "", horaire: "",
    },
  });
  const categorie = watch("categorie");
  const { data: groups } = useGetGroups({ categorie });

  const onSubmit = (data: any) => {
    createEnrollment.mutate({
      data: {
        ...data,
        leadKey: lead.id,
        leadSource: lead.source,
        amountExpected: Number(data.amountExpected),
        amountReceived: Number(data.amountReceived),
      },
    }, {
      onSuccess: () => { setIsOpen(false); onComplete(); },
      onError: () => toast({ title: "Erreur lors de la création", variant: "destructive" }),
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>Activer le Trimestre</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Créer une Facturation (Trimestre)</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Catégorie</Label>
              <select
                {...register("categorie")}
                onChange={(e) => { setValue("categorie", e.target.value); setValue("groupName", ""); }}
                className="flex h-9 w-full rounded-md border border-input px-3 text-sm"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <input type="hidden" {...register("paymentMethod")} value="Trimestriel" />
            <div className="space-y-2">
              <Label>Méthode de Paiement</Label>
              <div className="flex h-9 w-full items-center rounded-md border border-input px-3 text-sm text-gray-500">
                Trimestriel
              </div>
            </div>
            <input type="hidden" {...register("trimester")} />
            <input type="hidden" {...register("academicYear")} />
            <div className="space-y-2 col-span-2">
              <Label>Trimestre</Label>
              <div className="flex h-9 w-full items-center rounded-md border border-input px-3 text-sm text-gray-600 bg-gray-50">
                {defaultTrimester} {defaultAcademicYear}
                {!activeTrimester?.currentTrimester && (
                  <span className="ml-2 text-xs text-amber-600">(estimé — aucun trimestre actif défini)</span>
                )}
              </div>
              <p className="text-xs text-gray-400">
                Déterminé automatiquement par le trimestre actif du club, pour que cet élève apparaisse directement sur la page Trimestres.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Montant Attendu (MAD)</Label>
              <Input type="number" {...register("amountExpected")} required />
            </div>
            <div className="space-y-2">
              <Label>Montant Reçu (MAD)</Label>
              <Input type="number" {...register("amountReceived")} required />
            </div>
            <div className="space-y-2">
              <Label>Groupe</Label>
              <select {...register("groupName")} className="flex h-9 w-full rounded-md border border-input px-3 text-sm">
                <option value="">Non assigné</option>
                {(groups ?? []).map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Choix du Parcours</Label>
              <select {...register("parcours")} className="flex h-9 w-full rounded-md border border-input px-3 text-sm">
                <option value="">Non défini</option>
                <option value="1">Pathway 1</option>
                <option value="2">Pathway 2</option>
                <option value="3">Pathway 3</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Choix d'Horaire</Label>
              <select {...register("horaire")} className="flex h-9 w-full rounded-md border border-input px-3 text-sm">
                <option value="">Non défini</option>
                <option value="1">Timing 1</option>
                <option value="2">Timing 2</option>
                <option value="3">Timing 3</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>N° Facture</Label>
              <input type="hidden" {...register("invoiceNumber")} value="" />
              <div className="flex h-9 w-full items-center rounded-md border border-input px-3 text-sm text-gray-500 bg-gray-50">
                Automatique
              </div>
            </div>
          </div>
          <Button type="submit" className="w-full mt-4" disabled={createEnrollment.isPending}>
            {createEnrollment.isPending ? "Enregistrement…" : "Enregistrer & Activer"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CreateUserForm({ lead, onComplete }: any) {
  const createUser = useCreateUser();
  const linkEnrollmentToUser = useLinkEnrollmentToUser();
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  // Catégorie & groupe were already chosen at Step 4 (Activation du Trimestre);
  // reuse them here instead of asking again.
  const { data: enrollments } = useGetEnrollments({ leadKey: lead.id });
  const enrollment = Array.isArray(enrollments) ? enrollments[0] : undefined;
  const categorie = enrollment?.categorie || "Junior";
  const groupName = enrollment?.groupName || "";
  const { register, handleSubmit } = useForm({
    defaultValues: {
      username: `${lead.prenom.toLowerCase()}.${lead.nom.toLowerCase()}`.replace(/\s+/g, ""),
      password: "password123",
      nom: lead.nom,
      prenom: lead.prenom,
    },
  });

  const onSubmit = (data: any) => {
    createUser.mutate({
      data: {
        ...data,
        categorie,
        group: groupName,
        nomParent: lead.raw?.nomParent || "",
        numeroParent: lead.numeroParent || "",
      },
    }, {
      onSuccess: async () => {
        try {
          await linkEnrollmentToUser(lead.id, data.username);
        } catch {
          toast({ title: "Compte créé, mais la facturation n'a pas pu être liée", variant: "destructive" });
        }
        setIsOpen(false);
        onComplete();
      },
      onError: () => toast({ title: "Erreur lors de la création", variant: "destructive" }),
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gray-900 hover:bg-black text-white">Finaliser & Créer Compte</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Créer le Compte Plateforme</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Prénom</Label>
              <Input {...register("prenom")} required />
            </div>
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input {...register("nom")} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Nom d'utilisateur</Label>
            <Input {...register("username")} required />
          </div>
          <div className="space-y-2">
            <Label>Mot de passe temporaire</Label>
            <Input {...register("password")} required />
          </div>
          <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
            Catégorie: <span className="font-medium text-gray-900">{categorie}</span>
            {" · "}Groupe: <span className="font-medium text-gray-900">{groupName || "Non assigné"}</span>
          </div>
          <Button type="submit" className="w-full" disabled={createUser.isPending}>
            {createUser.isPending ? "Création…" : "Créer l'utilisateur"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Manual Lead Dialog ────────────────────────────────────────────────────────

function ManualLeadDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const createLead = useCreateManualLead();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { register, handleSubmit, reset } = useForm({
    defaultValues: {
      nom: "", prenom: "", nomParent: "", numeroParent: "",
      emailParent: "", paymentType: "Trimestriel",
    },
  });

  const onSubmit = (data: any) => {
    createLead.mutate({ data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetManualLeadsQueryKey() });
        toast({ title: "✅ Lead créé avec succès" });
        setIsOpen(false);
        reset();
      },
      onError: (err: any) =>
        toast({ title: "Erreur de création", description: err?.message || "Vérifiez les champs", variant: "destructive" }),
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>+ Ajouter Lead Manuel</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Ajouter un Walk-in</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Prénom de l'enfant <span className="text-red-500">*</span></Label>
              <Input {...register("prenom", { required: true })} placeholder="Prénom" />
            </div>
            <div className="space-y-2">
              <Label>Nom de l'enfant <span className="text-red-500">*</span></Label>
              <Input {...register("nom", { required: true })} placeholder="Nom" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Nom du parent</Label>
            <Input {...register("nomParent")} placeholder="Nom du parent / tuteur" />
          </div>
          <div className="space-y-2">
            <Label>Téléphone Parent</Label>
            <Input {...register("numeroParent")} placeholder="+212 6XX XXX XXX" />
          </div>
          <div className="space-y-2">
            <Label>Email Parent</Label>
            <Input type="email" {...register("emailParent")} placeholder="email@example.com" />
          </div>
          <input type="hidden" {...register("paymentType", { required: true })} value="Trimestriel" />
          <Button type="submit" className="w-full" disabled={createLead.isPending}>
            {createLead.isPending ? "Création…" : "Créer Lead"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

