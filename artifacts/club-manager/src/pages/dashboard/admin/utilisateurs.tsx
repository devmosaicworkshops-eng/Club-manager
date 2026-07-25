import {
  useGetUsers, useDeleteUser, getGetUsersQueryKey,
  useGetGroups, useCreateGroup, useDeleteGroup, getGetGroupsQueryKey,
} from "@workspace/api-client-react";
import { useUpdateUserProfile } from "@workspace/api-client-react";
import type { User, Group } from "@workspace/api-client-react";
import { useState } from "react";
import { Trash2, Pencil, ChevronRight, ChevronLeft, Users as UsersIcon, FolderPlus, UserPlus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
  DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm, Controller } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";

const CATEGORIES = ["Mini Maker", "Junior", "Cadets", "Senior"];

export default function AdminUtilisateurs() {
  const { data: users, isLoading } = useGetUsers();
  const deleteUser = useDeleteUser();
  const updateUserProfile = useUpdateUserProfile();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [selectedCategorie, setSelectedCategorie] = useState<string | null>(null);

  const { data: groupsForSelected } = useGetGroups({ categorie: selectedCategorie || "" });

  const {
    register: regEdit, handleSubmit: hsEdit, reset: resetEdit, control: ctrlEdit, watch: watchEdit,
  } = useForm({
    defaultValues: { nom: "", prenom: "", categorie: "", group: "", dateNaissance: "", nomParent: "", numeroParent: "", remarque: "" },
  });

  const editCategorie = watchEdit("categorie");
  const { data: groupsForEdit } = useGetGroups({ categorie: editCategorie || "" });

  const openEdit = (u: User) => {
    resetEdit({
      nom: u.nom || "",
      prenom: u.prenom || "",
      categorie: u.categorie || "",
      group: (u as any).group || "",
      dateNaissance: (u as any).dateNaissance || "",
      nomParent: (u as any).nomParent || "",
      numeroParent: (u as any).numeroParent || "",
      remarque: (u as any).remarque || "",
    });
    setEditTarget(u);
  };

  const onEditSubmit = (data: any) => {
    if (!editTarget) return;
    updateUserProfile.mutate({ username: editTarget.username, data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetUsersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetGroupsQueryKey() });
        setEditTarget(null);
        toast({ title: "Profil mis à jour" });
      },
      onError: () => toast({ title: "Erreur", description: "Impossible de modifier l'utilisateur.", variant: "destructive" }),
    });
  };

  const confirmDelete = () => {
    if (!userToDelete) return;
    deleteUser.mutate({ username: userToDelete }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetUsersQueryKey() });
        toast({ title: "Utilisateur supprimé", description: `${userToDelete} a été supprimé définitivement.` });
        setUserToDelete(null);
      },
      onError: () => toast({ title: "Erreur", description: "Impossible de supprimer l'utilisateur.", variant: "destructive" }),
    });
  };

  const assignGroup = (u: User, groupName: string) => {
    updateUserProfile.mutate({ username: u.username, data: { group: groupName } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetUsersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetGroupsQueryKey() });
        toast({ title: groupName ? `${u.nom} ajouté(e) au groupe` : `${u.nom} retiré(e) du groupe` });
      },
      onError: () => toast({ title: "Erreur", description: "Impossible de mettre à jour le groupe.", variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Utilisateurs</h1>
        <p className="text-gray-500 mt-1">Gérer les comptes élèves/membres, organisés par catégorie et groupe. Les nouveaux comptes sont créés via le parcours d'inscription (Leads).</p>
      </div>

      {!selectedCategorie ? (
        <CategoriesGrid users={users ?? []} onSelect={setSelectedCategorie} />
      ) : (
        <CategoryDetail
          categorie={selectedCategorie}
          onBack={() => setSelectedCategorie(null)}
          users={(users ?? []).filter((u) => (u.categorie || "") === selectedCategorie)}
          groups={groupsForSelected ?? []}
          onEdit={openEdit}
          onDelete={setUserToDelete}
          onAssignGroup={assignGroup}
        />
      )}

      {isLoading && !selectedCategorie && (
        <p className="text-sm text-gray-400">Chargement…</p>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Modifier — {editTarget?.username}</DialogTitle></DialogHeader>
          <form onSubmit={hsEdit(onEditSubmit)} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Prénom</Label><Input {...regEdit("prenom")} /></div>
              <div className="space-y-2"><Label>Nom</Label><Input {...regEdit("nom")} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Catégorie</Label>
                <Controller control={ctrlEdit} name="categorie" render={({ field }) => (
                  <Select value={field.value} onValueChange={(v) => { field.onChange(v); }}>
                    <SelectTrigger><SelectValue placeholder="Catégorie" /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                )} />
              </div>
              <div className="space-y-2">
                <Label>Groupe</Label>
                <Controller control={ctrlEdit} name="group" render={({ field }) => (
                  <Select value={field.value || "__none__"} onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Groupe" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Non assigné</SelectItem>
                      {groupsForEdit?.map((g) => <SelectItem key={g.id} value={g.name}>{g.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )} />
              </div>
            </div>
            <div className="space-y-2"><Label>Date de naissance</Label><Input type="date" {...regEdit("dateNaissance")} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Nom du parent</Label><Input {...regEdit("nomParent")} /></div>
              <div className="space-y-2"><Label>Numéro du parent</Label><Input {...regEdit("numeroParent")} placeholder="06 ou +212..." /></div>
            </div>
            <div className="space-y-2">
              <Label>Remarque</Label>
              <Textarea {...regEdit("remarque")} rows={2} placeholder="Notes internes…" />
            </div>
            <div className="pt-2 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>Annuler</Button>
              <Button type="submit" disabled={updateUserProfile.isPending}>{updateUserProfile.isPending ? "Enregistrement..." : "Enregistrer"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Supprimer l'utilisateur ?</DialogTitle>
            <DialogDescription>
              Cette action supprimera définitivement le compte <strong>{userToDelete}</strong> ainsi que tout son historique. Irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserToDelete(null)}>Annuler</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteUser.isPending}>
              {deleteUser.isPending ? "Suppression..." : "Supprimer définitivement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CategoriesGrid({ users, onSelect }: { users: User[]; onSelect: (c: string) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {CATEGORIES.map((c) => {
        const count = users.filter((u) => (u.categorie || "") === c).length;
        const ungrouped = users.filter((u) => (u.categorie || "") === c && !(u as any).group).length;
        return (
          <button
            key={c}
            onClick={() => onSelect(c)}
            className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm text-left hover:border-primary hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                <UsersIcon className="w-5 h-5" />
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-primary transition-colors" />
            </div>
            <h3 className="font-semibold text-gray-900 mt-4">{c}</h3>
            <p className="text-sm text-gray-500 mt-1">{count} utilisateur{count !== 1 ? "s" : ""}</p>
            {ungrouped > 0 && (
              <p className="text-xs text-amber-600 mt-1">{ungrouped} non assigné{ungrouped !== 1 ? "s" : ""}</p>
            )}
          </button>
        );
      })}
    </div>
  );
}

function CategoryDetail({
  categorie, onBack, users, groups, onEdit, onDelete, onAssignGroup,
}: {
  categorie: string;
  onBack: () => void;
  users: User[];
  groups: Group[];
  onEdit: (u: User) => void;
  onDelete: (username: string) => void;
  onAssignGroup: (u: User, groupName: string) => void;
}) {
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<Group | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createGroup = useCreateGroup();
  const deleteGroup = useDeleteGroup();

  const { register: regGroup, handleSubmit: hsGroup, reset: resetGroup } = useForm({ defaultValues: { name: "" } });

  const ungroupedUsers = users.filter((u) => !(u as any).group);

  const onCreateGroupSubmit = (data: { name: string }) => {
    createGroup.mutate({ data: { categorie, name: data.name } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetGroupsQueryKey() });
        setIsCreateGroupOpen(false);
        resetGroup();
        toast({ title: `Groupe "${data.name}" créé` });
      },
      onError: (err: any) => {
        toast({ title: "Erreur", description: err?.body?.error || err?.message || "Impossible de créer le groupe.", variant: "destructive" });
      },
    });
  };

  const confirmDeleteGroup = () => {
    if (!groupToDelete) return;
    deleteGroup.mutate({ id: groupToDelete.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetGroupsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetUsersQueryKey() });
        toast({ title: "Groupe supprimé", description: "Ses membres sont désormais non assignés." });
        if (selectedGroup === groupToDelete.name) setSelectedGroup(null);
        setGroupToDelete(null);
      },
      onError: () => toast({ title: "Erreur lors de la suppression du groupe", variant: "destructive" }),
    });
  };

  const UserRow = ({ u, showRemove }: { u: User; showRemove?: boolean }) => (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 font-medium text-primary">{u.username}</td>
      <td className="px-6 py-4 text-gray-900">{u.nom} {u.prenom}</td>
      <td className="px-6 py-4">
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          u.enrolled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
        }`}>
          {u.enrolled ? "Inscrit ce trimestre" : "Non inscrit"}
        </span>
      </td>
      <td className="px-6 py-4 text-right space-x-1">
        {showRemove ? (
          <Button variant="ghost" size="sm" className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 gap-1.5" onClick={() => onAssignGroup(u, "")}>
            Retirer du groupe
          </Button>
        ) : (
          groups.length > 0 && (
            <Select onValueChange={(v) => onAssignGroup(u, v)}>
              <SelectTrigger className="h-8 w-40 inline-flex text-xs"><SelectValue placeholder="Ajouter à un groupe" /></SelectTrigger>
              <SelectContent>
                {groups.map((g) => <SelectItem key={g.id} value={g.name}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )
        )}
        <Button variant="ghost" size="sm" onClick={() => onEdit(u)} className="gap-1 text-gray-600 hover:text-gray-900">
          <Pencil className="w-3.5 h-3.5" /> Modifier
        </Button>
        <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-1.5" onClick={() => onDelete(u.username)}>
          <Trash2 className="w-3.5 h-3.5" /> Supprimer
        </Button>
      </td>
    </tr>
  );

  if (selectedGroup) {
    const members = users.filter((u) => (u as any).group === selectedGroup);
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-sm">
          <button onClick={onBack} className="text-gray-400 hover:text-gray-700">{categorie}</button>
          <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
          <button onClick={() => setSelectedGroup(null)} className="text-gray-400 hover:text-gray-700">Groupes</button>
          <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
          <span className="font-medium text-gray-900">{selectedGroup}</span>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50">
            <h2 className="font-semibold text-gray-900">Membres — {selectedGroup}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{members.length} élève{members.length !== 1 ? "s" : ""}</p>
          </div>
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 font-medium">Utilisateur</th>
                <th className="px-6 py-3 font-medium">Nom complet</th>
                <th className="px-6 py-3 font-medium">Inscription trimestre</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {members.map((u) => <UserRow key={u.username} u={u} showRemove />)}
              {members.length === 0 && (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">Aucun membre dans ce groupe.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm">
        <button onClick={onBack} className="inline-flex items-center gap-1 text-gray-400 hover:text-gray-700">
          <ChevronLeft className="w-3.5 h-3.5" /> Catégories
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
        <span className="font-medium text-gray-900">{categorie}</span>
      </div>

      {/* Groups section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Groupes</h2>
            <p className="text-xs text-gray-400 mt-0.5">{groups.length} groupe{groups.length !== 1 ? "s" : ""} dans {categorie}</p>
          </div>
          <Dialog open={isCreateGroupOpen} onOpenChange={setIsCreateGroupOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2"><FolderPlus className="w-4 h-4" /> Nouveau groupe</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader><DialogTitle>Créer un groupe — {categorie}</DialogTitle></DialogHeader>
              <form onSubmit={hsGroup(onCreateGroupSubmit)} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Nom du groupe</Label>
                  <Input {...regGroup("name", { required: true })} placeholder="ex: Groupe A, Samedi 10h…" autoFocus />
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={createGroup.isPending}>{createGroup.isPending ? "Création..." : "Créer"}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {groups.map((g) => (
            <div key={g.id} className="border border-gray-200 rounded-lg p-4 flex items-center justify-between hover:border-primary transition-colors">
              <button className="text-left flex-1" onClick={() => setSelectedGroup(g.name)}>
                <p className="font-medium text-gray-900">{g.name}</p>
                <p className="text-xs text-gray-400">{g.memberCount ?? 0} membre{(g.memberCount ?? 0) !== 1 ? "s" : ""}</p>
              </button>
              <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => setGroupToDelete(g)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
          {groups.length === 0 && (
            <p className="text-sm text-gray-400 col-span-full py-4 text-center">
              Aucun groupe pour {categorie} — créez-en un pour organiser les élèves.
            </p>
          )}
        </div>
      </div>

      {/* Ungrouped users */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-amber-500" /> Utilisateurs non assignés
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">{ungroupedUsers.length} en attente d'affectation à un groupe</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 font-medium">Utilisateur</th>
                <th className="px-6 py-3 font-medium">Nom complet</th>
                <th className="px-6 py-3 font-medium">Inscription trimestre</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ungroupedUsers.map((u) => <UserRow key={u.username} u={u} />)}
              {ungroupedUsers.length === 0 && (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">Tous les utilisateurs de {categorie} sont assignés à un groupe.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete group confirm */}
      <Dialog open={!!groupToDelete} onOpenChange={(open) => !open && setGroupToDelete(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Supprimer le groupe ?</DialogTitle>
            <DialogDescription>
              Le groupe <strong>{groupToDelete?.name}</strong> sera supprimé. Ses membres ne seront pas supprimés — ils redeviendront non assignés.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupToDelete(null)}>Annuler</Button>
            <Button variant="destructive" onClick={confirmDeleteGroup} disabled={deleteGroup.isPending}>
              {deleteGroup.isPending ? "Suppression..." : "Supprimer le groupe"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
