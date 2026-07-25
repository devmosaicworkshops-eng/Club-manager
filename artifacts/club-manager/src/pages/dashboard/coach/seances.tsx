import { useGetSeances, getGetSeancesQueryKey, useFillSeanceDetails } from "@workspace/api-client-react";
import { useCancelSeance, useDeleteSeance } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useEffect, useState } from "react";
import { notifySeanceStatusChanges } from "@/lib/seance-notifications";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ClipboardEdit } from "lucide-react";
import type { Seance } from "@workspace/api-client-react";

export default function CoachSeances() {
  const { user } = useAuth();
  const { data: seances } = useGetSeances();
  const cancelSeance = useCancelSeance();
  const deleteSeance = useDeleteSeance();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [detailsTarget, setDetailsTarget] = useState<Seance | null>(null);

  const mySeances = seances?.filter((s) => s.coachUsername === user?.username && s.status !== "Cancelled") || [];

  // Notify the coach in-app when the admin has approved or rejected a séance
  // they submitted, comparing against the last-seen status per séance.
  useEffect(() => {
    if (!seances || !user?.username) return;
    notifySeanceStatusChanges(
      seances.filter((s) => s.coachUsername === user.username),
      toast
    );
  }, [seances, user?.username]);

  const confirmCancel = () => {
    if (!cancelTarget) return;
    cancelSeance.mutate({ id: cancelTarget }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSeancesQueryKey() });
        setCancelTarget(null);
        toast({
          title: "Séance annulée",
          description: "Les parents des élèves inscrits à cette catégorie ont été notifiés par WhatsApp.",
        });
      },
      onError: () => toast({ title: "Erreur", description: "Impossible d'annuler la séance.", variant: "destructive" }),
    });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteSeance.mutate({ id: deleteTarget }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSeancesQueryKey() });
        setDeleteTarget(null);
        toast({ title: "Séance supprimée", description: "La séance a été définitivement supprimée." });
      },
      onError: () => toast({ title: "Erreur", description: "Impossible de supprimer la séance.", variant: "destructive" }),
    });
  };

  const cancellingSeance = mySeances.find((s) => s.id === cancelTarget);
  const deletingSeance = mySeances.find((s) => s.id === deleteTarget);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Mes Séances</h1>
        <p className="text-gray-500 mt-1">
          L'administration crée les créneaux et vous les assigne. Complétez les détails d'activité, puis l'admin
          les valide — les élèves ne les verront qu'une fois approuvés. Si une séance est rejetée, corrigez les
          détails et renvoyez-la pour approbation. Vous pouvez annuler une séance à venir (les parents seront
          notifiés par WhatsApp) ou la supprimer définitivement.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 font-medium">Date</th>
                <th className="px-6 py-3 font-medium">Activité</th>
                <th className="px-6 py-3 font-medium">Catégorie</th>
                <th className="px-6 py-3 font-medium">Statut</th>
                <th className="px-6 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {mySeances.map((seance) => (
                <tr key={seance.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {format(new Date(seance.date), "dd MMMM yyyy HH:mm", { locale: fr })}
                  </td>
                  <td className="px-6 py-4">
                    {seance.activityType || <span className="text-gray-400 italic">À compléter</span>}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {seance.categorie}{seance.groupName ? ` · ${seance.groupName}` : ""}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      seance.status === "Approved" ? "bg-green-100 text-green-700" :
                      seance.status === "Rejected" ? "bg-red-100 text-red-700" :
                      seance.status === "AwaitingApproval" ? "bg-blue-100 text-blue-700" :
                      "bg-amber-100 text-amber-700"
                    }`}>
                      {seance.status === "Approved" ? "Confirmée" :
                       seance.status === "Rejected" ? "Rejetée · à corriger" :
                       seance.status === "AwaitingApproval" ? "En attente d'approbation" : "À compléter"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {(seance.status === "Pending" || seance.status === "Rejected") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDetailsTarget(seance)}
                        className="gap-1.5 text-primary hover:text-primary hover:bg-primary/5"
                      >
                        <ClipboardEdit className="w-4 h-4" />
                        {seance.status === "Rejected" ? "Corriger" : "Compléter"}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {mySeances.length === 0 && (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">Aucune séance assignée pour le moment.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cancel dialog */}
      <Dialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Annuler la séance ?</DialogTitle>
            <DialogDescription>
              La séance <strong>{cancellingSeance?.activityType || "sans titre"}</strong> ({cancellingSeance?.categorie}) du{" "}
              {cancellingSeance && format(new Date(cancellingSeance.date), "dd MMMM yyyy à HH:mm", { locale: fr })} sera annulée.
              <br /><br />
              Les parents de tous les élèves inscrits dans la catégorie <strong>{cancellingSeance?.categorie}</strong> recevront une notification WhatsApp automatique.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>Ne pas annuler</Button>
            <Button variant="destructive" onClick={confirmCancel} disabled={cancelSeance.isPending}>
              {cancelSeance.isPending ? "Annulation..." : "Confirmer l'annulation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Supprimer définitivement la séance ?</DialogTitle>
            <DialogDescription>
              La séance <strong>{deletingSeance?.activityType || "sans titre"}</strong> ({deletingSeance?.categorie}) du{" "}
              {deletingSeance && format(new Date(deletingSeance.date), "dd MMMM yyyy à HH:mm", { locale: fr })} sera supprimée
              définitivement. Cette action est irréversible.
              <br /><br />
              Toutes les présences enregistrées pour cette séance seront également supprimées.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Annuler</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteSeance.isPending}>
              {deleteSeance.isPending ? "Suppression..." : "Supprimer définitivement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailsTarget} onOpenChange={(o) => !o && setDetailsTarget(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Compléter la séance</DialogTitle>
            <DialogDescription>
              {detailsTarget && format(new Date(detailsTarget.date), "EEEE dd MMMM yyyy à HH:mm", { locale: fr })}
              {" · "}{detailsTarget?.categorie}{detailsTarget?.groupName ? ` · ${detailsTarget.groupName}` : ""}
            </DialogDescription>
          </DialogHeader>
          {detailsTarget && (
            <DetailsForm
              seance={detailsTarget}
              onDone={() => setDetailsTarget(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailsForm({ seance, onDone }: { seance: Seance; onDone: () => void }) {
  const fillDetails = useFillSeanceDetails();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { register, handleSubmit } = useForm({
    defaultValues: {
      activityType: seance.activityType || "",
      studentCount: seance.studentCount || "",
      objective: seance.objective || "",
      materials: seance.materials || "",
    },
  });

  const onSubmit = (data: any) => {
    fillDetails.mutate(
      { id: seance.id, data },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetSeancesQueryKey() });
          toast({ title: "Séance confirmée", description: "Elle est désormais visible par les élèves." });
          onDone();
        },
        onError: () => toast({ title: "Erreur", description: "Échec de l'enregistrement des détails.", variant: "destructive" }),
      }
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label>Type d'activité</Label>
        <Input {...register("activityType")} placeholder="ex: Robotique, Programmation..." required />
      </div>
      <div className="space-y-2">
        <Label>Nombre d'élèves prévu</Label>
        <Input type="number" {...register("studentCount")} placeholder="ex: 12" />
      </div>
      <div className="space-y-2">
        <Label>Objectif de la séance</Label>
        <Textarea {...register("objective")} rows={2} placeholder="Ce que les élèves vont apprendre..." />
      </div>
      <div className="space-y-2">
        <Label>Matériel nécessaire</Label>
        <Textarea {...register("materials")} rows={2} placeholder="Kits LEGO, Ordinateurs..." />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={fillDetails.isPending}>
          {fillDetails.isPending ? "Enregistrement..." : "Confirmer la séance"}
        </Button>
      </DialogFooter>
    </form>
  );
}
