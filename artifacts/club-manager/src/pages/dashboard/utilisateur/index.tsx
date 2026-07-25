import { useMemo, useState } from "react";
import { useGetSeances, getGetSeancesQueryKey, type Seance } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { SeanceCalendar } from "@/components/seance-calendar";
import { CalendarDays } from "lucide-react";

export default function UserDashboard() {
  const { user } = useAuth();
  const notEnrolled = user?.enrolled === false;
  const { data: seances } = useGetSeances(undefined, { query: { queryKey: getGetSeancesQueryKey(), enabled: !notEnrolled } });
  const [selectedDay, setSelectedDay] = useState<{ day: Date; seances: Seance[] } | null>(null);

  const mySeances = useMemo(
    () => (seances ?? []).filter((s) => s.status === "Approved" && s.categorie === user?.categorie),
    [seances, user]
  );

  const upcoming = useMemo(
    () =>
      mySeances
        .filter((s) => new Date(s.date).getTime() >= Date.now() - 24 * 60 * 60 * 1000)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [mySeances]
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Mon Emploi du temps</h1>
        <p className="text-gray-500 mt-1">Vos séances prévues pour la catégorie {user?.categorie}.</p>
      </div>

      {notEnrolled ? (
        <div className="py-12 text-center text-gray-500 bg-white rounded-xl border border-dashed border-gray-300">
          Votre emploi du temps n'est pas disponible car vous n'êtes pas inscrit(e) pour le trimestre en cours.
        </div>
      ) : (
        <div className="space-y-6">
          <SeanceCalendar
            seances={mySeances}
            onDayClick={(day, daySeances) => setSelectedDay({ day, seances: daySeances })}
            emptyHint="Aucune séance planifiée pour votre catégorie pour le moment."
            renderDayBadge={(s) => (
              <span className="block truncate rounded px-1 py-0.5 text-[10px] font-medium border bg-primary/10 text-primary border-primary/20">
                {format(new Date(s.date), "HH:mm")} · {s.activityType || s.categorie}
              </span>
            )}
          />

          {selectedDay && selectedDay.seances.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 capitalize mb-3">
                {format(selectedDay.day, "EEEE dd MMMM yyyy", { locale: fr })}
              </h3>
              <div className="space-y-3">
                {selectedDay.seances.map((s) => (
                  <div key={s.id} className="flex items-start gap-3 rounded-lg border border-gray-100 px-3 py-2.5">
                    <div className="w-1 self-stretch bg-primary rounded-full" />
                    <div>
                      <p className="font-medium text-gray-900">{s.activityType}</p>
                      <p className="text-sm text-gray-500">
                        {format(new Date(s.date), "HH:mm", { locale: fr })} · Coach : {s.coachUsername}
                      </p>
                      {s.objective && <p className="text-sm text-gray-600 mt-1">{s.objective}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-gray-500 mb-3">
              <CalendarDays className="w-4 h-4" /> Prochaines séances
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {upcoming.slice(0, 6).map((seance) => (
                <div key={seance.id} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-start justify-between relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-primary"></div>
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg text-gray-900">{seance.activityType}</h3>
                    </div>
                    <div className="grid gap-2 text-sm text-gray-600">
                      <p><strong>Coach :</strong> {seance.coachUsername}</p>
                      <p><strong>Date :</strong> {format(new Date(seance.date), "dd MMMM yyyy HH:mm", { locale: fr })}</p>
                      {seance.objective && <p className="text-gray-800"><strong>Objectif :</strong> {seance.objective}</p>}
                      {seance.materials && <p className="text-gray-800"><strong>Matériel :</strong> {seance.materials}</p>}
                    </div>
                  </div>
                </div>
              ))}

              {upcoming.length === 0 && (
                <div className="col-span-full py-12 text-center text-gray-500 bg-white rounded-xl border border-dashed border-gray-300">
                  Aucune séance à venir pour le moment.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
