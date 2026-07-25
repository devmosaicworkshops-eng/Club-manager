import { useMemo, useState } from "react";
import {
  useGetSeancePresences,
  useSaveSeancePresences,
  useGetUsers,
  getGetPresencesQueryKey,
  type SeancePresenceEntry,
  type Seance,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Save, Users } from "lucide-react";

const STATUSES = ["Présent", "Absent", "Récupérer", "Excusé"] as const;

const statusStyle: Record<string, string> = {
  "Présent": "bg-green-100 text-green-700",
  "Absent": "bg-red-100 text-red-700",
  "Récupérer": "bg-amber-100 text-amber-700",
  "Excusé": "bg-blue-100 text-blue-700",
};

/** Per-student status grid for a single séance. Used by the coach to fill
 * présence and by the admin to view/override it. When `readOnly` is true,
 * radios are disabled and only recorded statuses are shown. */
export function PresenceEditor({
  seance,
  readOnly = false,
  onSaved,
}: {
  seance: Seance;
  readOnly?: boolean;
  onSaved?: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: users } = useGetUsers();
  const { data: existingPresences, isLoading } = useGetSeancePresences(seance.id);
  const savePresences = useSaveSeancePresences();

  const [presenceMap, setPresenceMap] = useState<Record<string, string>>({});

  const existingMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of existingPresences ?? []) m[p.studentUsername] = p.status;
    return m;
  }, [existingPresences]);

  const getStatus = (username: string) => presenceMap[username] ?? existingMap[username] ?? null;
  const setStatus = (username: string, status: string) =>
    setPresenceMap((prev) => ({ ...prev, [username]: status }));

  const studentsInScope = useMemo(() => {
    return (users ?? []).filter((u) => {
      if (u.categorie?.toLowerCase() !== seance.categorie?.toLowerCase()) return false;
      if (seance.groupName) return u.group === seance.groupName;
      return true;
    });
  }, [users, seance]);

  const handleSave = () => {
    const entries = studentsInScope
      .map((u) => ({ studentUsername: u.username, status: getStatus(u.username) }))
      .filter((e): e is SeancePresenceEntry => !!e.status);

    if (entries.length === 0) {
      toast({ title: "Aucune présence à enregistrer", description: "Sélectionnez un statut pour au moins un élève.", variant: "destructive" });
      return;
    }

    savePresences.mutate(
      { seanceId: seance.id, entries },
      {
        onSuccess: (res) => {
          queryClient.invalidateQueries({ queryKey: getGetPresencesQueryKey() });
          queryClient.invalidateQueries({ queryKey: ["seancePresences", seance.id] });
          setPresenceMap({});
          toast({ title: "Présences enregistrées", description: `${res.saved} présence(s) enregistrée(s).` });
          onSaved?.();
        },
        onError: () => toast({ title: "Erreur", description: "Impossible d'enregistrer les présences.", variant: "destructive" }),
      }
    );
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
        <RefreshCw className="w-5 h-5 animate-spin inline mr-2" /> Chargement des présences…
      </div>
    );
  }

  if (studentsInScope.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
        <Users className="w-8 h-8 mx-auto mb-3 text-gray-300" />
        Aucun élève inscrit dans ce groupe/catégorie.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="text-gray-500 border-b border-gray-100 bg-gray-50">
            <tr>
              <th className="px-6 py-3 font-medium">Élève</th>
              {STATUSES.map((s) => (
                <th key={s} className="px-3 py-3 font-medium text-center">{s}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {studentsInScope.map((student) => {
              const current = getStatus(student.username);
              return (
                <tr key={student.username} className="hover:bg-gray-50">
                  <td className="px-6 py-3">
                    <div className="font-medium text-gray-900">{student.nom} {student.prenom}</div>
                    <div className="text-xs text-gray-400">{student.username}</div>
                  </td>
                  {STATUSES.map((s) => (
                    <td key={s} className="px-3 py-3 text-center">
                      {readOnly ? (
                        current === s ? (
                          <span className={`inline-block w-7 h-7 rounded-full ${statusStyle[s]}`} />
                        ) : (
                          <span className="inline-block w-7 h-7 rounded-full border-2 border-gray-100" />
                        )
                      ) : (
                        <label className="cursor-pointer">
                          <input
                            type="radio"
                            name={`${seance.id}-${student.username}`}
                            value={s}
                            checked={current === s}
                            onChange={() => setStatus(student.username, s)}
                            className="sr-only"
                          />
                          <span
                            className={`inline-block w-7 h-7 rounded-full border-2 transition-all ${
                              current === s
                                ? `${statusStyle[s]} border-transparent ring-2 ring-offset-1 ring-current`
                                : "border-gray-200 hover:border-gray-400"
                            }`}
                          />
                        </label>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        {!readOnly && (
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex gap-2">
            <span className="text-xs text-gray-400 mr-2 self-center">Tout marquer :</span>
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => studentsInScope.forEach((u) => setStatus(u.username, s))}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${statusStyle[s]} hover:opacity-80`}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {!readOnly && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={savePresences.isPending} className="gap-2">
            <Save className="w-4 h-4" />
            {savePresences.isPending ? "Enregistrement..." : "Enregistrer les présences"}
          </Button>
        </div>
      )}
    </div>
  );
}
