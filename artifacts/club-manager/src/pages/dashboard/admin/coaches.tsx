import { useGetCoaches, useCreateCoach, getGetCoachesQueryKey } from "@workspace/api-client-react";
import { useUpdateCoach, useDeleteCoach } from "@workspace/api-client-react";
import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
  DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";

export default function AdminCoaches() {
  const { data: coaches } = useGetCoaches();
  const createCoach = useCreateCoach();
  const updateCoach = useUpdateCoach();
  const deleteCoach = useDeleteCoach();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<{ username: string; nom: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const { register: regCreate, handleSubmit: hsCreate, reset: resetCreate } = useForm({
    defaultValues: { username: "", nom: "", password: "" },
  });

  const { register: regEdit, handleSubmit: hsEdit, reset: resetEdit } = useForm({
    defaultValues: { nom: "", password: "" },
  });

  const onCreate = (data: any) => {
    createCoach.mutate({ data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCoachesQueryKey() });
        setIsCreateOpen(false);
        resetCreate();
        toast({ title: "Coach créé avec succès" });
      },
      onError: () => toast({ title: "Erreur", description: "Impossible de créer le coach.", variant: "destructive" }),
    });
  };

  const openEdit = (coach: { username: string; nom: string }) => {
    resetEdit({ nom: coach.nom, password: "" });
    setEditTarget(coach);
  };

  const onEdit = (data: any) => {
    if (!editTarget) return;
    const payload: Record<string, string> = {};
    if (data.nom) payload.nom = data.nom;
    if (data.password) payload.password = data.password;

    updateCoach.mutate({ username: editTarget.username, data: payload }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCoachesQueryKey() });
        setEditTarget(null);
        toast({ title: "Coach mis à jour" });
      },
      onError: () => toast({ title: "Erreur", description: "Impossible de modifier le coach.", variant: "destructive" }),
    });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteCoach.mutate({ username: deleteTarget }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCoachesQueryKey() });
        setDeleteTarget(null);
        toast({ title: "Coach supprimé" });
      },
      onError: () => toast({ title: "Erreur", description: "Impossible de supprimer le coach.", variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Coaches</h1>
          <p className="text-gray-500 mt-1">Gérer les comptes formateurs.</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> Nouveau Coach</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader><DialogTitle>Créer un compte Coach</DialogTitle></DialogHeader>
            <form onSubmit={hsCreate(onCreate)} className="space-y-4 pt-4">
              <div className="space-y-2"><Label>Nom complet</Label><Input {...regCreate("nom")} required /></div>
              <div className="space-y-2"><Label>Nom d'utilisateur</Label><Input {...regCreate("username")} required /></div>
              <div className="space-y-2"><Label>Mot de passe</Label><Input type="password" {...regCreate("password")} required /></div>
              <div className="pt-4 flex justify-end">
                <Button type="submit" disabled={createCoach.isPending}>{createCoach.isPending ? "Création..." : "Créer"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {coaches?.map((coach) => (
          <div key={coach.username} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg uppercase shrink-0">
              {coach.nom.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 truncate">{coach.nom}</h3>
              <p className="text-sm text-gray-500">@{coach.username}</p>
            </div>
            <div className="flex flex-col gap-1">
              <Button variant="ghost" size="sm" onClick={() => openEdit(coach)} className="gap-1 text-gray-600 hover:text-gray-900">
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(coach.username)} className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Modifier — {editTarget?.username}</DialogTitle></DialogHeader>
          <form onSubmit={hsEdit(onEdit)} className="space-y-4 pt-4">
            <div className="space-y-2"><Label>Nom complet</Label><Input {...regEdit("nom")} placeholder={editTarget?.nom} /></div>
            <div className="space-y-2"><Label>Nouveau mot de passe <span className="text-gray-400 text-xs">(laisser vide pour ne pas changer)</span></Label><Input type="password" {...regEdit("password")} /></div>
            <div className="pt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>Annuler</Button>
              <Button type="submit" disabled={updateCoach.isPending}>{updateCoach.isPending ? "Enregistrement..." : "Enregistrer"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Supprimer le coach ?</DialogTitle>
            <DialogDescription>Le compte <strong>{deleteTarget}</strong> sera supprimé définitivement. Ses séances resteront dans l'historique.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Annuler</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteCoach.isPending}>
              {deleteCoach.isPending ? "Suppression..." : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
