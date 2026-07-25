import { useState, useMemo, useEffect } from "react";
import {
  useGetCurrentTrimester, useUpdateCurrentTrimester,
  useGetRerollStatus, useRerollEnrollments, useUpdateEnrollment,
  useAutoActivateTrimester,
  getGetCurrentTrimesterQueryKey, getGetRerollStatusQueryKey, getGetUsersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Save, CheckCircle2, UserPlus, UserMinus, X, Zap, Search } from "lucide-react";

const TRIMESTERS = [
  { value: "T1", label: "T1 (Oct–Déc)" },
  { value: "T2", label: "T2 (Jan–Mars)" },
  { value: "T3", label: "T3 (Avr–Juin)" },
];

const CATEGORIES = ["Mini Maker", "Junior", "Cadets", "Senior"];

const PARCOURS_OPTIONS = ["1", "2", "3"];
const HORAIRE_OPTIONS = ["1", "2", "3"];

/** Determine the expected trimester from the current calendar month. */
function getAutoTrimester(): { trimester: string; academicYear: string } | null {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-based
  const y = now.getFullYear();
  if (month >= 10) return { trimester: "T1", academicYear: `${y}-${y + 1}` };
  if (month <= 3)  return { trimester: "T2", academicYear: `${y - 1}-${y}` };
  if (month <= 6)  return { trimester: "T3", academicYear: `${y - 1}-${y}` };
  return null; // Jul–Sep: summer break
}

type EntryState = {
  paymentMethod: string;
  amountPerPeriod: string;
  groupName: string;
  parcours: string;
  horaire: string;
};

export default function AdminTrimestres() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const auto = getAutoTrimester();
  const currentYear = new Date().getFullYear();
  const defaultTrimester = auto?.trimester ?? "T1";
  const defaultYear = auto?.academicYear ?? `${currentYear}-${currentYear + 1}`;

  const [trimester, setTrimester] = useState(defaultTrimester);
  const [academicYear, setAcademicYear] = useState(defaultYear);
  const [hasManuallyChangedPeriod, setHasManuallyChangedPeriod] = useState(false);

  const { data: settings } = useGetCurrentTrimester();
  const updateTrimester = useUpdateCurrentTrimester();
  const autoActivate = useAutoActivateTrimester();

  // Default the page to whichever trimester/year is actually active club-wide
  // (set by the admin below) rather than a calendar guess, so this always
  // opens on the same period new enrollments from the leads pipeline land in.
  useEffect(() => {
    if (!hasManuallyChangedPeriod && settings?.currentTrimester && settings?.currentAcademicYear) {
      setTrimester(settings.currentTrimester);
      setAcademicYear(settings.currentAcademicYear);
    }
  }, [settings, hasManuallyChangedPeriod]);

  const { data: candidates, isLoading } = useGetRerollStatus({ trimester, academicYear });
  const reroll = useRerollEnrollments();
  const updateEnrollment = useUpdateEnrollment();

  const [entries, setEntries] = useState<Record<string, EntryState>>({});
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [addSelection, setAddSelection] = useState<Record<string, boolean>>({});

  const [subscribedSearch, setSubscribedSearch] = useState("");
  const [subscribedCategorie, setSubscribedCategorie] = useState("all");
  const [addSearch, setAddSearch] = useState("");
  const [addCategorie, setAddCategorie] = useState("all");

  useEffect(() => {
    setEntries({});
    setAddSelection({});
    setShowAddPanel(false);
  }, [trimester, academicYear]);

  const allCandidates = useMemo(() => candidates ?? [], [candidates]);
  const subscribedCandidates = useMemo(() => allCandidates.filter((c) => c.enrolled), [allCandidates]);
  const availableCandidates = useMemo(() => allCandidates.filter((c) => !c.enrolled), [allCandidates]);

  const matchesFilter = (c: { nom: string; prenom: string; username: string; categorie?: string }, search: string, categorie: string) => {
    if (categorie !== "all" && c.categorie !== categorie) return false;
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return `${c.nom} ${c.prenom} ${c.username}`.toLowerCase().includes(q);
  };

  const filteredSubscribed = useMemo(
    () => subscribedCandidates.filter((c) => matchesFilter(c, subscribedSearch, subscribedCategorie)),
    [subscribedCandidates, subscribedSearch, subscribedCategorie]
  );
  const filteredAvailable = useMemo(
    () => availableCandidates.filter((c) => matchesFilter(c, addSearch, addCategorie)),
    [availableCandidates, addSearch, addCategorie]
  );

  const getEntry = (username: string): EntryState => {
    if (entries[username]) return entries[username];
    const c = allCandidates.find((x) => x.username === username);
    return {
      paymentMethod: c?.paymentMethod || "Trimestriel",
      amountPerPeriod: c?.amountPerPeriod != null ? String(c.amountPerPeriod) : "",
      groupName: c?.groupName ?? "",
      parcours: c?.parcours ?? "",
      horaire: c?.horaire ?? "",
    };
  };

  const updateEntry = (username: string, patch: Partial<EntryState>) =>
    setEntries((prev) => ({ ...prev, [username]: { ...getEntry(username), ...patch } }));

  const handleActivateTrimester = () => {
    updateTrimester.mutate(
      { data: { currentTrimester: trimester, currentAcademicYear: academicYear } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCurrentTrimesterQueryKey() });
          toast({ title: "Trimestre activé", description: `${trimester} ${academicYear} est maintenant le trimestre en cours.` });
        },
        onError: () => toast({ title: "Erreur", description: "Impossible d'activer le trimestre.", variant: "destructive" }),
      }
    );
  };

  const handleAutoActivate = () => {
    autoActivate.mutate(undefined, {
      onSuccess: (res: any) => {
        queryClient.invalidateQueries({ queryKey: getGetCurrentTrimesterQueryKey() });
        if (res.skipped) {
          toast({ title: "Période estivale", description: res.reason });
        } else {
          setHasManuallyChangedPeriod(false);
          setTrimester(res.currentTrimester);
          setAcademicYear(res.currentAcademicYear);
          toast({ title: "Trimestre auto-activé", description: `${res.currentTrimester} ${res.currentAcademicYear} activé selon la date du jour.` });
        }
      },
      onError: () => toast({ title: "Erreur", description: "Impossible d'activer automatiquement.", variant: "destructive" }),
    });
  };

  const handleSaveSubscribed = () => {
    const changed = subscribedCandidates.filter((c) => entries[c.username]);
    if (changed.length === 0) {
      toast({ title: "Aucune modification" });
      return;
    }
    reroll.mutate(
      { data: { trimester, academicYear, entries: changed.map((c) => { const e = getEntry(c.username); return { username: c.username, categorie: c.categorie, paymentMethod: e.paymentMethod, amountPerPeriod: e.amountPerPeriod ? Number(e.amountPerPeriod) : undefined, groupName: e.groupName, parcours: e.parcours, horaire: e.horaire }; }) } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetRerollStatusQueryKey({ trimester, academicYear }) });
          queryClient.invalidateQueries({ queryKey: getGetUsersQueryKey() });
          toast({ title: "Modifications enregistrées" });
          setEntries((p) => { const n = { ...p }; for (const c of changed) delete n[c.username]; return n; });
        },
        onError: () => toast({ title: "Erreur", variant: "destructive" }),
      }
    );
  };

  const handleAddSelected = () => {
    const selected = availableCandidates.filter((c) => addSelection[c.username]);
    if (selected.length === 0) {
      toast({ title: "Aucun utilisateur sélectionné", variant: "destructive" });
      return;
    }
    reroll.mutate(
      { data: { trimester, academicYear, entries: selected.map((c) => { const e = getEntry(c.username); return { username: c.username, categorie: c.categorie, paymentMethod: e.paymentMethod, amountPerPeriod: e.amountPerPeriod ? Number(e.amountPerPeriod) : undefined, groupName: e.groupName, parcours: e.parcours, horaire: e.horaire }; }) } },
      {
        onSuccess: (res) => {
          queryClient.invalidateQueries({ queryKey: getGetRerollStatusQueryKey({ trimester, academicYear }) });
          queryClient.invalidateQueries({ queryKey: getGetUsersQueryKey() });
          toast({ title: "Utilisateurs ajoutés", description: `${res.enrolled} ajouté(s) à ${trimester} ${academicYear}.` });
          setAddSelection({});
          setEntries((p) => { const n = { ...p }; for (const c of selected) delete n[c.username]; return n; });
          setShowAddPanel(false);
        },
        onError: () => toast({ title: "Erreur", variant: "destructive" }),
      }
    );
  };

  const handleUnenroll = (enrollmentId: string | null | undefined, username: string) => {
    if (!enrollmentId) return;
    updateEnrollment.mutate(
      { id: enrollmentId, data: { suspensionStatus: "Inactif" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetRerollStatusQueryKey({ trimester, academicYear }) });
          queryClient.invalidateQueries({ queryKey: getGetUsersQueryKey() });
          toast({ title: "Utilisateur retiré", description: `${username} retiré de ${trimester} ${academicYear}.` });
        },
        onError: () => toast({ title: "Erreur", variant: "destructive" }),
      }
    );
  };

  const isCurrentTrimester = settings?.currentTrimester === trimester && settings?.currentAcademicYear === academicYear;
  const autoMatchesCurrent = auto && settings?.currentTrimester === auto.trimester && settings?.currentAcademicYear === auto.academicYear;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Réinscriptions par trimestre</h1>
        <p className="text-gray-500 mt-1">
          Les nouveaux inscrits via le pipeline de leads apparaissent automatiquement ici pour le trimestre actif.
          Utilisez cette page pour réinscrire au trimestre suivant les élèves déjà présents (ex: réinscrire pour T2 ceux qui étaient en T1).
        </p>
      </div>

      {/* Settings card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label>Trimestre</Label>
            <Select value={trimester} onValueChange={(v) => { setHasManuallyChangedPeriod(true); setTrimester(v); }}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TRIMESTERS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Année scolaire</Label>
            <Input value={academicYear} onChange={(e) => { setHasManuallyChangedPeriod(true); setAcademicYear(e.target.value); }} className="w-40" placeholder="2025-2026" />
          </div>
          <Button
            variant={isCurrentTrimester ? "default" : "outline"}
            onClick={handleActivateTrimester}
            disabled={updateTrimester.isPending}
            className={`gap-2 ${isCurrentTrimester ? "bg-green-600 hover:bg-green-700 border-green-600 text-white" : ""}`}
          >
            <CheckCircle2 className="w-4 h-4" />
            {isCurrentTrimester ? "✅ Trimestre actif" : "Activer ce trimestre"}
          </Button>
          <Button variant="outline" onClick={handleAutoActivate} disabled={autoActivate.isPending} className="gap-2">
            <Zap className="w-4 h-4" />
            {autoActivate.isPending ? "Activation..." : "Auto (selon mois)"}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          {settings?.currentTrimester && (
            <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-medium ${autoMatchesCurrent ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"}`}>
              <span className={`w-2 h-2 rounded-full ${autoMatchesCurrent ? "bg-green-500" : "bg-blue-400"}`} />
              Actif : {settings.currentTrimester} {settings.currentAcademicYear}
              {autoMatchesCurrent && " · correspond au mois en cours"}
            </span>
          )}
          {auto && (
            <span className="text-gray-400">Attendu selon le calendrier : <strong className="text-gray-600">{auto.trimester} {auto.academicYear}</strong></span>
          )}
        </div>
      </div>

      {/* Subscribed users table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-gray-900">Utilisateurs inscrits — {trimester} {academicYear}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {filteredSubscribed.length} / {subscribedCandidates.length} utilisateur(s)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowAddPanel((v) => !v)} className="gap-2">
              <UserPlus className="w-4 h-4" /> Réinscrire des utilisateurs
            </Button>
            <Button onClick={handleSaveSubscribed} disabled={reroll.isPending} className="gap-2">
              <Save className="w-4 h-4" />{reroll.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </div>
        <div className="px-6 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3 bg-gray-50/50">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <Input value={subscribedSearch} onChange={(e) => setSubscribedSearch(e.target.value)} placeholder="Rechercher un nom, prénom, identifiant..." className="h-9 pl-8" />
          </div>
          <Select value={subscribedCategorie} onValueChange={setSubscribedCategorie}>
            <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les catégories</SelectItem>
              {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="overflow-x-auto max-h-[28rem] overflow-y-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-500 border-b border-gray-200 sticky top-0">
              <tr>
                <th className="px-4 py-3 font-medium">Utilisateur</th>
                <th className="px-4 py-3 font-medium">Catégorie</th>
                <th className="px-4 py-3 font-medium">Groupe</th>
                <th className="px-4 py-3 font-medium">Parcours</th>
                <th className="px-4 py-3 font-medium">Horaire</th>
                <th className="px-4 py-3 font-medium">Méthode</th>
                <th className="px-4 py-3 font-medium">Montant / période</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500"><RefreshCw className="w-4 h-4 animate-spin inline mr-2" />Chargement...</td></tr>
              )}
              {!isLoading && filteredSubscribed.map((c) => {
                const e = getEntry(c.username);
                return (
                  <tr key={c.username} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{c.nom} {c.prenom}</div>
                      <div className="text-xs text-gray-500">{c.username}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{c.categorie || "—"}</td>
                    <td className="px-4 py-3 text-gray-700">{e.groupName || "Non assigné"}</td>
                    <td className="px-4 py-3">
                      <Select value={e.parcours || "none"} onValueChange={(v) => updateEntry(c.username, { parcours: v === "none" ? "" : v })}>
                        <SelectTrigger className="h-8 w-24"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">—</SelectItem>
                          {PARCOURS_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3">
                      <Select value={e.horaire || "none"} onValueChange={(v) => updateEntry(c.username, { horaire: v === "none" ? "" : v })}>
                        <SelectTrigger className="h-8 w-24"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">—</SelectItem>
                          {HORAIRE_OPTIONS.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3 text-gray-500">Trimestriel</td>
                    <td className="px-4 py-3">
                      <Input type="number" value={e.amountPerPeriod} onChange={(ev) => updateEntry(c.username, { amountPerPeriod: ev.target.value })} placeholder="MAD" className="h-8 w-28" />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleUnenroll(c.enrollmentId, c.username)} disabled={updateEnrollment.isPending} className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50">
                        <UserMinus className="w-4 h-4" /> Retirer
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {!isLoading && subscribedCandidates.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">Aucun utilisateur inscrit pour ce trimestre pour le moment. Les nouveaux inscrits du pipeline de leads apparaîtront ici automatiquement.</td></tr>
              )}
              {!isLoading && subscribedCandidates.length > 0 && filteredSubscribed.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">Aucun résultat pour ces filtres.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add users panel */}
      {showAddPanel && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-gray-900">Réinscrire des utilisateurs — {trimester} {academicYear}</h2>
              <p className="text-xs text-gray-500 mt-0.5">Utilisateurs déjà connus, pas encore inscrits à ce trimestre. Les montants sont pré-remplis depuis leur trimestre précédent.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleAddSelected} disabled={reroll.isPending} className="gap-2">
                <UserPlus className="w-4 h-4" />{reroll.isPending ? "Ajout..." : "Ajouter la sélection"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowAddPanel(false)}><X className="w-4 h-4" /></Button>
            </div>
          </div>
          <div className="px-6 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3 bg-gray-50/50">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <Input value={addSearch} onChange={(e) => setAddSearch(e.target.value)} placeholder="Rechercher un nom, prénom, identifiant..." className="h-9 pl-8" />
            </div>
            <Select value={addCategorie} onValueChange={setAddCategorie}>
              <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les catégories</SelectItem>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="overflow-x-auto max-h-[28rem] overflow-y-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 border-b border-gray-200 sticky top-0">
                <tr>
                  <th className="px-4 py-3 font-medium">Ajouter</th>
                  <th className="px-4 py-3 font-medium">Utilisateur</th>
                  <th className="px-4 py-3 font-medium">Catégorie</th>
                  <th className="px-4 py-3 font-medium">Groupe</th>
                  <th className="px-4 py-3 font-medium">Parcours</th>
                  <th className="px-4 py-3 font-medium">Horaire</th>
                  <th className="px-4 py-3 font-medium">Méthode</th>
                  <th className="px-4 py-3 font-medium">Montant / période</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {!isLoading && filteredAvailable.map((c) => {
                  const e = getEntry(c.username);
                  const sel = !!addSelection[c.username];
                  return (
                    <tr key={c.username} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={sel} onChange={(ev) => setAddSelection((p) => ({ ...p, [c.username]: ev.target.checked }))} className="w-4 h-4" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{c.nom} {c.prenom}</div>
                        <div className="text-xs text-gray-500">{c.username}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{c.categorie || "—"}</td>
                      <td className="px-4 py-3 text-gray-700">{e.groupName || "Non assigné"}</td>
                      <td className="px-4 py-3">
                        <Select value={e.parcours || "none"} onValueChange={(v) => updateEntry(c.username, { parcours: v === "none" ? "" : v })} disabled={!sel}>
                          <SelectTrigger className="h-8 w-24"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">—</SelectItem>
                            {PARCOURS_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3">
                        <Select value={e.horaire || "none"} onValueChange={(v) => updateEntry(c.username, { horaire: v === "none" ? "" : v })} disabled={!sel}>
                          <SelectTrigger className="h-8 w-24"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">—</SelectItem>
                            {HORAIRE_OPTIONS.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3 text-gray-500">Trimestriel</td>
                      <td className="px-4 py-3">
                        <Input type="number" value={e.amountPerPeriod} onChange={(ev) => updateEntry(c.username, { amountPerPeriod: ev.target.value })} placeholder="MAD" className="h-8 w-28" disabled={!sel} />
                      </td>
                    </tr>
                  );
                })}
                {!isLoading && availableCandidates.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">Tous les utilisateurs sont déjà inscrits.</td></tr>
                )}
                {!isLoading && availableCandidates.length > 0 && filteredAvailable.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">Aucun résultat pour ces filtres.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
