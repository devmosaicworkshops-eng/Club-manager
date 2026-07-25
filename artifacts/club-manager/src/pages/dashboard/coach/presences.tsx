import { useMemo, useState } from "react";
import { useGetSeances, type Seance } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { ChevronLeft, RefreshCw, Users } from "lucide-react";
import { PresenceEditor } from "@/components/presence-editor";

export default function CoachPresences() {
  const { user } = useAuth();
  const { data: seances, isLoading } = useGetSeances();
  const [selected, setSelected] = useState<Seance | null>(null);

  const mySeances = useMemo(
    () =>
      (seances ?? [])
        .filter((s) => s.coachUsername === user?.username && s.status === "Approved")
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [seances, user]
  );

  if (selected) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => setSelected(null)} className="gap-1.5">
          <ChevronLeft className="w-4 h-4" /> Retour à mes séances
        </Button>

        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            {selected.activityType} — {selected.categorie}
            {selected.groupName ? ` · ${selected.groupName}` : ""}
          </h1>
          <p className="text-gray-500 mt-1">
            {format(new Date(selected.date), "EEEE dd MMMM yyyy à HH:mm", { locale: fr })}
          </p>
        </div>

        <PresenceEditor seance={selected} onSaved={() => setSelected(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Présences</h1>
        <p className="text-gray-500 mt-1">
          Choisissez une de vos séances confirmées pour marquer la présence des élèves.
        </p>
      </div>

      {isLoading && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
          <RefreshCw className="w-5 h-5 animate-spin inline mr-2" /> Chargement…
        </div>
      )}

      {!isLoading && mySeances.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
          <Users className="w-10 h-10 mx-auto mb-3 text-gray-200" />
          <p className="font-medium">Aucune séance confirmée</p>
          <p className="text-sm mt-1">Complétez d'abord les détails d'une séance depuis « Mes séances ».</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {mySeances.map((seance) => (
          <button
            key={seance.id}
            onClick={() => setSelected(seance)}
            className="text-left bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-primary/40 transition-all p-5 group"
          >
            <div className="flex items-start justify-between mb-3">
              <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                {seance.categorie}{seance.groupName ? ` · ${seance.groupName}` : ""}
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
            <div className="mt-3 flex items-center gap-1.5 text-xs text-primary font-medium">
              <Users className="w-3.5 h-3.5" />
              Marquer les présences →
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
