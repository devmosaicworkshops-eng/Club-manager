import { useGetSeances, useUpdateSeanceStatus, getGetSeancesQueryKey } from "@workspace/api-client-react";
import { Check, X, Clock } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function AdminApprobations() {
  const { data: seances } = useGetSeances({ status: 'AwaitingApproval' });
  const updateStatus = useUpdateSeanceStatus();
  const queryClient = useQueryClient();

  const pendingSeances = seances?.filter(s => s.status === 'AwaitingApproval') || [];

  const handleStatusUpdate = (id: string, status: string) => {
    updateStatus.mutate(
      { id, data: { status } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetSeancesQueryKey() });
        }
      }
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Approbations des Séances</h1>
        <p className="text-gray-500 mt-1">
          Le coach a complété les détails de ces créneaux — validez-les pour les rendre visibles aux élèves,
          ou rejetez-les pour que le coach les corrige.
        </p>
      </div>

      {pendingSeances.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-xl border border-dashed border-gray-300">
          <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">Aucune séance en attente</h3>
          <p className="text-gray-500 mt-1">Toutes les séances ont été traitées.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {pendingSeances.map(seance => (
            <div key={seance.id} className="bg-white p-6 rounded-xl border border-amber-200 shadow-sm flex items-start justify-between relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-amber-400"></div>
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-semibold text-lg text-gray-900">{seance.activityType}</h3>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                    En attente
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm text-gray-600">
                  <p><strong>Coach :</strong> {seance.coachUsername}</p>
                  <p><strong>Date :</strong> {format(new Date(seance.date), 'dd MMMM yyyy HH:mm', { locale: fr })}</p>
                  <p><strong>Catégorie :</strong> {seance.categorie}</p>
                  <p><strong>Élèves prévus :</strong> {seance.studentCount || 'Non spécifié'}</p>
                  {seance.objective && <p className="col-span-2 mt-2 text-gray-800"><strong>Objectif :</strong> {seance.objective}</p>}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button 
                  onClick={() => handleStatusUpdate(seance.id, 'Approved')}
                  className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg font-medium transition-colors"
                >
                  <Check className="w-4 h-4" /> Approuver
                </button>
                <button 
                  onClick={() => handleStatusUpdate(seance.id, 'Rejected')}
                  className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg font-medium transition-colors"
                >
                  <X className="w-4 h-4" /> Rejeter
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
