import { useMemo } from "react";
import { useGetPresences, useGetSeances, type Seance } from "@workspace/api-client-react";
import { format, isFuture } from "date-fns";
import { fr } from "date-fns/locale";
import { CheckCircle2, XCircle, Clock3, FileQuestion, CalendarClock } from "lucide-react";

const statusMeta: Record<string, { icon: typeof CheckCircle2; classes: string; dot: string }> = {
  "Présent": { icon: CheckCircle2, classes: "bg-green-50 text-green-700 border-green-200", dot: "bg-green-500" },
  "Absent": { icon: XCircle, classes: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
  "En retard": { icon: Clock3, classes: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  "Excusé": { icon: FileQuestion, classes: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
};

export default function UserPresences() {
  const { data: presences, isLoading } = useGetPresences();
  const { data: seances } = useGetSeances();

  const seanceById = useMemo(() => {
    const m = new Map<string, Seance>();
    for (const s of seances ?? []) m.set(s.id, s);
    return m;
  }, [seances]);

  const rows = useMemo(() => {
    return (presences ?? [])
      .map((p) => ({ presence: p, seance: seanceById.get(p.seanceId) }))
      .sort((a, b) => new Date(b.presence.date).getTime() - new Date(a.presence.date).getTime());
  }, [presences, seanceById]);

  const stats = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of presences ?? []) counts[p.status] = (counts[p.status] || 0) + 1;
    return counts;
  }, [presences]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Mes Présences</h1>
        <p className="text-gray-500 mt-1">Historique de vos présences, marquées par vos coachs après chaque séance.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(["Présent", "Absent", "En retard", "Excusé"] as const).map((s) => {
          const meta = statusMeta[s];
          const Icon = meta.icon;
          return (
            <div key={s} className={`rounded-xl border p-4 ${meta.classes}`}>
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide">
                <Icon className="w-4 h-4" /> {s}
              </div>
              <p className="text-2xl font-bold mt-1">{stats[s] || 0}</p>
            </div>
          );
        })}
      </div>

      {isLoading && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
          Chargement…
        </div>
      )}

      {!isLoading && rows.length === 0 && (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center text-gray-500">
          <CalendarClock className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          Aucune présence enregistrée pour le moment.
        </div>
      )}

      <div className="relative">
        <div className="absolute left-[27px] top-2 bottom-2 w-px bg-gray-200" aria-hidden />
        <div className="space-y-3">
          {rows.map(({ presence, seance }) => {
            const meta = statusMeta[presence.status] ?? statusMeta["Excusé"];
            const Icon = meta.icon;
            const future = presence.date ? isFuture(new Date(presence.date)) : false;
            return (
              <div key={presence.id} className="relative flex items-start gap-4 pl-1">
                <div className={`relative z-10 w-14 h-14 rounded-full flex items-center justify-center border-4 border-white shrink-0 ${meta.dot}`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {seance?.activityType || presence.categorie}
                      </p>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {presence.date && format(new Date(presence.date), "EEEE dd MMMM yyyy à HH:mm", { locale: fr })}
                        {seance?.coachUsername ? ` · Coach : ${seance.coachUsername}` : ""}
                      </p>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${meta.classes}`}>
                      <Icon className="w-3.5 h-3.5" /> {presence.status}{future ? " (à venir)" : ""}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
