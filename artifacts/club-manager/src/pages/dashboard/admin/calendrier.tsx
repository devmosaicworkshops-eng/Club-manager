import { useMemo, useState } from "react";
import {
  useGetSeances,
  useCreateSeance,
  useUpdateSeance,
  useCancelSeance,
  useGenerateRecurringSeances,
  useGetCoaches,
  useGetGroups,
  getGetSeancesQueryKey,
  type Seance,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { CalendarPlus, Plus, RefreshCw, Sparkles, Trash2, Eraser, X, XCircle } from "lucide-react";
import { SeanceCalendar } from "@/components/seance-calendar";

const CATEGORIES = ["Mini Maker", "Junior", "Cadets", "Senior"];

const WEEKDAYS = [
  { value: 1, label: "Lundi" },
  { value: 2, label: "Mardi" },
  { value: 3, label: "Mercredi" },
  { value: 4, label: "Jeudi" },
  { value: 5, label: "Vendredi" },
  { value: 6, label: "Samedi" },
  { value: 0, label: "Dimanche" },
];

type WeekSlot = { day: number; time: string; categorie: string; groupName: string };

// Start with an empty template — admin fills the week manually.
const DEFAULT_WEEK_TEMPLATE: WeekSlot[] = [];

const REPEAT_PRESETS = [
  { label: "4 semaines", weeks: 4 },
  { label: "8 semaines", weeks: 8 },
  { label: "3 mois", weeks: 13 },
  { label: "6 mois", weeks: 26 },
];

const categoryColor: Record<string, string> = {
  "Mini Maker": "bg-pink-100 text-pink-700 border-pink-200",
  Junior: "bg-blue-100 text-blue-700 border-blue-200",
  Cadets: "bg-amber-100 text-amber-700 border-amber-200",
  Senior: "bg-violet-100 text-violet-700 border-violet-200",
};

const statusLabel: Record<string, string> = {
  Pending: "En attente de détails",
  AwaitingApproval: "En attente d'approbation",
  Approved: "Confirmée",
  Cancelled: "Annulée",
  Rejected: "Rejetée · à corriger",
};

export default function AdminCalendrier() {
  const { data: seances } = useGetSeances();
  const { data: coaches } = useGetCoaches();
  const createSeance = useCreateSeance();
  const updateSeance = useUpdateSeance();
  const cancelSeance = useCancelSeance();
  const generateRecurring = useGenerateRecurringSeances();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [dayDialog, setDayDialog] = useState<{ day: Date; seances: Seance[] } | null>(null);
  const [editTarget, setEditTarget] = useState<Seance | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDate, setCreateDate] = useState("");
  const [createCategorie, setCreateCategorie] = useState("Junior");
  const [createGroupName, setCreateGroupName] = useState("__all__");
  const { data: createGroups } = useGetGroups({ categorie: createCategorie });
  const [generateOpen, setGenerateOpen] = useState(false);
  const [weeksAhead, setWeeksAhead] = useState("8");
  const [weekTemplate, setWeekTemplate] = useState<WeekSlot[]>(DEFAULT_WEEK_TEMPLATE);
  const [cancelTarget, setCancelTarget] = useState<Seance | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearPending, setClearPending] = useState(false);
  const [clearCategorie, setClearCategorie] = useState("__all__");
  const [clearGroupName, setClearGroupName] = useState("__all__");
  const { data: clearGroups } = useGetGroups({ categorie: clearCategorie !== "__all__" ? clearCategorie : "" });

  const visibleSeances = useMemo(() => (seances ?? []).filter((s) => s.status !== "Cancelled"), [seances]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetSeancesQueryKey() });

  const handleDayClick = (day: Date, daySeances: Seance[]) => {
    setDayDialog({ day, seances: daySeances });
  };

  const openCreateForDay = (day: Date) => {
    setCreateDate(format(day, "yyyy-MM-dd'T'17:00"));
    setCreateOpen(true);
    setDayDialog(null);
  };

  const handleCreate = (formEl: HTMLFormElement) => {
    const fd = new FormData(formEl);
    const date = String(fd.get("date"));
    const categorie = String(fd.get("categorie"));
    const groupName = String(fd.get("groupName") || "");
    if (!date || !categorie) return;

    createSeance.mutate(
      { data: { date: new Date(date).toISOString(), categorie, groupName: groupName === "__all__" ? "" : groupName } },
      {
        onSuccess: () => {
          invalidate();
          setCreateOpen(false);
          toast({ title: "Séance créée", description: "Assignez un coach, puis le coach complétera les détails." });
        },
        onError: () => toast({ title: "Erreur", description: "Impossible de créer la séance.", variant: "destructive" }),
      }
    );
  };

  const handleUpdate = (id: string, patch: { categorie?: string; groupName?: string; coachUsername?: string }) => {
    updateSeance.mutate(
      { id, data: patch },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: "Séance mise à jour" });
        },
        onError: () => toast({ title: "Erreur", description: "Impossible de mettre à jour la séance.", variant: "destructive" }),
      }
    );
  };

  const handleCancel = () => {
    if (!cancelTarget) return;
    cancelSeance.mutate(
      { id: cancelTarget.id },
      {
        onSuccess: () => {
          invalidate();
          setCancelTarget(null);
          setEditTarget(null);
          toast({ title: "Créneau retiré" });
        },
        onError: () => toast({ title: "Erreur", variant: "destructive" }),
      }
    );
  };

  const handleClear = async () => {
    setClearPending(true);
    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams();
      if (clearCategorie !== "__all__") params.set("categorie", clearCategorie);
      if (clearGroupName !== "__all__" && clearCategorie !== "__all__") params.set("groupName", clearGroupName);
      const qs = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`/api/seances${qs}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      invalidate();
      setClearOpen(false);
      setClearCategorie("__all__");
      setClearGroupName("__all__");
      toast({ title: "Calendrier vidé", description: `${body.deleted ?? 0} séance(s) supprimée(s) à partir d'aujourd'hui.` });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message ?? "Impossible de vider le calendrier.", variant: "destructive" });
    } finally {
      setClearPending(false);
    }
  };

  const addTemplateSlot = () => {
    setWeekTemplate((prev) => [...prev, { day: 6, time: "14:00", categorie: "Junior", groupName: "" }]);
  };

  const updateTemplateSlot = (index: number, patch: Partial<WeekSlot>) => {
    setWeekTemplate((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const removeTemplateSlot = (index: number) => {
    setWeekTemplate((prev) => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = () => {
    if (weekTemplate.length === 0) {
      toast({ title: "Ajoutez au moins un créneau", variant: "destructive" });
      return;
    }
    const weeks = Math.trunc(Number(weeksAhead));
    if (!Number.isFinite(weeks) || weeks < 1) {
      toast({
        title: "Nombre de semaines invalide",
        description: "Indiquez au moins 1 semaine (1 = uniquement la semaine en cours).",
        variant: "destructive",
      });
      return;
    }
    generateRecurring.mutate(
      { data: { weeksAhead: weeks, slots: weekTemplate } },
      {
        onSuccess: (res) => {
          invalidate();
          setGenerateOpen(false);
          toast({
            title: "Créneaux générés",
            description: res.created > 0 ? `${res.created} nouvelle(s) séance(s) ajoutée(s).` : "Tout était déjà à jour pour cette période.",
          });
        },
        onError: () => toast({ title: "Erreur", description: "Impossible de générer les créneaux.", variant: "destructive" }),
      }
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Calendrier des séances</h1>
          <p className="text-gray-500 mt-1">
            Cliquez sur un jour pour créer, assigner ou retirer une séance. Le coach complétera les détails
            (activité, objectif, matériel), puis vous validez dans « Approbations » avant qu'elle soit visible aux élèves.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setGenerateOpen(true)} className="gap-2">
            <Sparkles className="w-4 h-4" /> Générer les créneaux récurrents
          </Button>
          <Button variant="outline" onClick={() => setClearOpen(true)} className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200">
            <Eraser className="w-4 h-4" /> Vider le calendrier
          </Button>
        </div>
      </div>

      <SeanceCalendar
        seances={visibleSeances}
        onDayClick={handleDayClick}
        emptyHint="Aucune séance planifiée. Utilisez « Générer les créneaux récurrents » ou cliquez sur un jour pour en créer une."
        renderDayBadge={(s) => (
          <span
            className={`block truncate rounded px-1 py-0.5 text-[10px] font-medium border ${categoryColor[s.categorie] || "bg-gray-100 text-gray-700 border-gray-200"} ${
              s.status === "Pending" || s.status === "AwaitingApproval" ? "opacity-60" : ""
            }`}
          >
            {format(new Date(s.date), "HH:mm")} · {s.categorie}
            {s.groupName ? ` (${s.groupName})` : ""}
          </span>
        )}
      />

      {/* Day detail dialog */}
      <Dialog open={!!dayDialog} onOpenChange={(o) => !o && setDayDialog(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="capitalize">
              {dayDialog && format(dayDialog.day, "EEEE dd MMMM yyyy", { locale: fr })}
            </DialogTitle>
            <DialogDescription>Séances planifiées ce jour-là.</DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {dayDialog?.seances.length === 0 && (
              <p className="text-sm text-gray-500 py-4 text-center">Aucune séance ce jour-là.</p>
            )}
            {dayDialog?.seances.map((s) => (
              <button
                key={s.id}
                onClick={() => { setEditTarget(s); setDayDialog(null); }}
                className="w-full text-left flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2.5 hover:border-primary/40 hover:bg-primary/5 transition-colors"
              >
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {format(new Date(s.date), "HH:mm")} · {s.categorie}
                    {s.groupName ? ` · ${s.groupName}` : ""}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Coach : {s.coachUsername || "Non assigné"} · {statusLabel[s.status ?? ""] ?? s.status}
                  </div>
                </div>
              </button>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" className="gap-2 w-full sm:w-auto" onClick={() => dayDialog && openCreateForDay(dayDialog.day)}>
              <CalendarPlus className="w-4 h-4" /> Ajouter une séance ce jour
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit séance dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier la séance</DialogTitle>
            <DialogDescription>
              {editTarget && format(new Date(editTarget.date), "EEEE dd MMMM yyyy à HH:mm", { locale: fr })}
            </DialogDescription>
          </DialogHeader>

          {editTarget && (
            <EditSeanceForm
              seance={editTarget}
              coaches={coaches ?? []}
              onSave={(patch) => handleUpdate(editTarget.id, patch)}
            />
          )}

          <DialogFooter className="justify-between sm:justify-between">
            <Button variant="ghost" className="gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => editTarget && setCancelTarget(editTarget)}>
              <XCircle className="w-4 h-4" /> Retirer ce créneau
            </Button>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle séance</DialogTitle>
            <DialogDescription>Le coach complétera les détails (activité, objectif, matériel) une fois assigné.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleCreate(e.currentTarget); }} className="space-y-4">
            <div className="space-y-2">
              <Label>Date et heure</Label>
              <Input type="datetime-local" name="date" defaultValue={createDate} required />
            </div>
            <div className="space-y-2">
              <Label>Catégorie</Label>
              <Select value={createCategorie} onValueChange={(v) => { setCreateCategorie(v); setCreateGroupName("__all__"); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <input type="hidden" name="categorie" value={createCategorie} />
            </div>
            <div className="space-y-2">
              <Label>Groupe (optionnel)</Label>
              <Select value={createGroupName} onValueChange={setCreateGroupName}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Toute la catégorie {createCategorie}</SelectItem>
                  {createGroups?.map((g) => <SelectItem key={g.id} value={g.name}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <input type="hidden" name="groupName" value={createGroupName} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createSeance.isPending}>
                {createSeance.isPending ? "Création..." : "Créer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Generate recurring dialog */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Générer les créneaux récurrents</DialogTitle>
            <DialogDescription>
              Configurez votre semaine type — chaque ligne est un créneau avec son jour, son heure, sa catégorie et son groupe.
              Ensuite choisissez sur combien de semaines la répéter. Les créneaux déjà existants ne sont jamais dupliqués.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {/* Column headers */}
            {weekTemplate.length > 0 && (
              <div className="grid grid-cols-[120px_100px_130px_1fr_36px] gap-2 px-0.5">
                <span className="text-xs font-medium text-gray-500">Jour</span>
                <span className="text-xs font-medium text-gray-500">Heure</span>
                <span className="text-xs font-medium text-gray-500">Catégorie</span>
                <span className="text-xs font-medium text-gray-500">Groupe (optionnel)</span>
                <span />
              </div>
            )}
            <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
              {weekTemplate.map((slot, i) => (
                <div key={i} className="grid grid-cols-[120px_100px_130px_1fr_36px] items-center gap-2">
                  {/* Jour */}
                  <Select value={String(slot.day)} onValueChange={(v) => updateTemplateSlot(i, { day: Number(v) })}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {WEEKDAYS.map((d) => <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {/* Heure */}
                  <Input
                    type="time"
                    value={slot.time}
                    onChange={(e) => updateTemplateSlot(i, { time: e.target.value })}
                    className="h-8 text-sm"
                  />
                  {/* Catégorie */}
                  <Select value={slot.categorie} onValueChange={(v) => updateTemplateSlot(i, { categorie: v, groupName: "" })}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {/* Groupe */}
                  <Input
                    placeholder="Tout le groupe"
                    value={slot.groupName}
                    onChange={(e) => updateTemplateSlot(i, { groupName: e.target.value })}
                    className="h-8 text-sm"
                  />
                  {/* Supprimer */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0"
                    onClick={() => removeTemplateSlot(i)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
              {weekTemplate.length === 0 && (
                <p className="text-sm text-gray-500 py-4 text-center">
                  Aucun créneau — cliquez sur « Ajouter un créneau » pour commencer à construire votre semaine type.
                </p>
              )}
            </div>
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addTemplateSlot}>
              <Plus className="w-3.5 h-3.5" /> Ajouter un créneau
            </Button>
          </div>

          <div className="space-y-2 pt-2 border-t">
            <Label>Répéter sur</Label>
            <div className="flex flex-wrap gap-2">
              {REPEAT_PRESETS.map((p) => (
                <Button
                  key={p.label}
                  type="button"
                  size="sm"
                  variant={Number(weeksAhead) === p.weeks ? "default" : "outline"}
                  onClick={() => setWeeksAhead(String(p.weeks))}
                >
                  {p.label}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Input
                type="number"
                min={1}
                max={52}
                value={weeksAhead}
                onChange={(e) => setWeeksAhead(e.target.value)}
                className="w-24"
              />
              <span className="text-sm text-gray-500">semaine(s) à partir d'aujourd'hui (1 = cette semaine uniquement)</span>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={handleGenerate} disabled={generateRecurring.isPending} className="gap-2">
              {generateRecurring.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {generateRecurring.isPending ? "Génération..." : "Générer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear calendar confirm */}
      <Dialog open={clearOpen} onOpenChange={(o) => { if (!o) { setClearOpen(false); setClearCategorie("__all__"); setClearGroupName("__all__"); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Vider le calendrier</DialogTitle>
            <DialogDescription>
              Supprime les séances <strong>d'aujourd'hui jusqu'à la dernière</strong> — les séances passées sont conservées.
              Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Category filter */}
            <div className="space-y-2">
              <Label>Catégorie</Label>
              <Select value={clearCategorie} onValueChange={(v) => { setClearCategorie(v); setClearGroupName("__all__"); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Toutes les catégories</SelectItem>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Group filter — only shown when a category is selected */}
            {clearCategorie !== "__all__" && (
              <div className="space-y-2">
                <Label>Groupe <span className="text-gray-400 text-xs">(optionnel)</span></Label>
                <Select value={clearGroupName} onValueChange={setClearGroupName}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Tous les groupes</SelectItem>
                    {clearGroups?.map((g) => <SelectItem key={g.id} value={g.name}>{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Summary of what will be deleted */}
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Seront supprimées : séances <strong>à partir d'aujourd'hui</strong>
              {clearCategorie !== "__all__" ? ` · catégorie ${clearCategorie}` : ""}
              {clearCategorie !== "__all__" && clearGroupName !== "__all__" ? ` · groupe ${clearGroupName}` : ""}
              .
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setClearOpen(false); setClearCategorie("__all__"); setClearGroupName("__all__"); }}>
              <X className="w-4 h-4 mr-1.5" /> Annuler
            </Button>
            <Button variant="destructive" onClick={handleClear} disabled={clearPending}>
              {clearPending ? <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> : <Eraser className="w-4 h-4 mr-1.5" />}
              {clearPending ? "Suppression..." : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel confirm */}
      <Dialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Retirer ce créneau ?</DialogTitle>
            <DialogDescription>
              {cancelTarget?.status === "Approved"
                ? "Cette séance est confirmée : les parents des élèves concernés recevront une notification WhatsApp d'annulation."
                : "Cette séance n'a pas encore été approuvée — aucune notification ne sera envoyée."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>
              <X className="w-4 h-4 mr-1.5" /> Annuler
            </Button>
            <Button variant="destructive" onClick={handleCancel} disabled={cancelSeance.isPending}>
              {cancelSeance.isPending ? "Retrait..." : "Confirmer le retrait"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditSeanceForm({
  seance,
  coaches,
  onSave,
}: {
  seance: Seance;
  coaches: { username: string; nom: string }[];
  onSave: (patch: { categorie?: string; groupName?: string; coachUsername?: string }) => void;
}) {
  const [categorie, setCategorie] = useState(seance.categorie);
  const [coachUsername, setCoachUsername] = useState(seance.coachUsername || "__none__");
  const { data: groups } = useGetGroups({ categorie });
  const [groupName, setGroupName] = useState(seance.groupName || "__all__");

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Catégorie</Label>
        <Select value={categorie} onValueChange={(v) => { setCategorie(v); setGroupName("__all__"); }}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Groupe visé</Label>
        <Select value={groupName} onValueChange={setGroupName}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Toute la catégorie {categorie}</SelectItem>
            {groups?.map((g) => <SelectItem key={g.id} value={g.name}>{g.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Coach assigné</Label>
        <Select value={coachUsername} onValueChange={setCoachUsername}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Non assigné</SelectItem>
            {coaches.map((c) => <SelectItem key={c.username} value={c.username}>{c.nom || c.username}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Button
        className="w-full"
        onClick={() =>
          onSave({
            categorie,
            groupName: groupName === "__all__" ? "" : groupName,
            coachUsername: coachUsername === "__none__" ? "" : coachUsername,
          })
        }
      >
        Enregistrer
      </Button>
    </div>
  );
}
