import { useGetSeances, type Seance } from "@workspace/api-client-react";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, RefreshCw, Users, ClipboardEdit } from "lucide-react";
import { PresenceEditor } from "@/components/presence-editor";

const CATEGORIES = ["Mini Maker", "Junior", "Cadets", "Senior"];

export default function AdminPresences() {
  const { data: seances, isLoading } = useGetSeances();

  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selected, setSelected] = useState<Seance | null>(null);

  const approvedSeances = useMemo(() => {
    const all = (seances ?? [])
      .filter((s) => s.status === "Approved")
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (selectedCategory === "all") return all;
    return all.filter((s) => s.categorie === selectedCategory);
  }, [seances, selectedCategory]);

  // ── Séance detail view (editable by admin) ─────────────────────────────
  if (selected) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => setSelected(null)} className="gap-1.5">
          <ChevronLeft className="w-4 h-4" /> Retour aux séances
        </Button>

        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              {selected.activityType} — {selected.categorie}
            </h1>
            <p className="text-gray-500 mt-1">
              {format(new Date(selected.date), "EEEE dd MMMM yyyy à HH:mm", { locale: fr })}
              {" · "}Coach : {selected.coachUsername || "Non assigné"}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary border border-primary/20">
            <ClipboardEdit className="w-3.5 h-3.5" /> Édition admin
          </span>
        </div>

        <PresenceEditor seance={selected} />
      </div>
    );
  }

  // ── Séance list view ─────────────────────────────────────────────────────
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Présences</h1>
          <p className="text-gray-500 mt-1">
            Consultez et modifiez la présence pour chaque séance confirmée.
          </p>
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-44 bg-white">
            <SelectValue placeholder="Toutes les catégories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les catégories</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
          <RefreshCw className="w-5 h-5 animate-spin inline mr-2" /> Chargement…
        </div>
      )}

      {!isLoading && approvedSeances.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
          <Users className="w-10 h-10 mx-auto mb-3 text-gray-200" />
          <p className="font-medium">Aucune séance confirmée</p>
          <p className="text-sm mt-1">Les séances doivent être complétées par le coach pour apparaître ici.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {approvedSeances.map((seance) => (
          <button
            key={seance.id}
            onClick={() => setSelected(seance)}
            className="text-left bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-primary/40 transition-all p-5 group"
          >
            <div className="flex items-start justify-between mb-3">
              <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                {seance.categorie}
              </span>
              <span className="text-xs text-gray-400">
                {format(new Date(seance.date), "dd MMM", { locale: fr })}
              </span>
            </div>
            <h3 className="font-semibold text-gray-900 group-hover:text-primary transition-colors">
              {seance.activityType}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {format(new Date(seance.date), "EEEE dd MMMM yyyy · HH:mm", { locale: fr })}
            </p>
            <p className="text-xs text-gray-400 mt-2">Coach : {seance.coachUsername || "Non assigné"}</p>
            <div className="mt-3 flex items-center gap-1.5 text-xs text-primary font-medium">
              <ClipboardEdit className="w-3.5 h-3.5" />
              Gérer les présences →
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
