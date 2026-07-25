import { useGetAdmins, useCreateAdmin, getGetAdminsQueryKey } from "@workspace/api-client-react";
import { useState } from "react";
import { Plus, Shield } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";

export default function AdminAdmins() {
  const { data: admins } = useGetAdmins();
  const createAdmin = useCreateAdmin();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { register, handleSubmit, reset } = useForm({
    defaultValues: { username: "", password: "" }
  });

  const onSubmit = (data: any) => {
    createAdmin.mutate({ data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAdminsQueryKey() });
        setIsDialogOpen(false);
        reset();
      }
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Administrateurs</h1>
          <p className="text-gray-500 mt-1">Gestion des accès à l'espace d'administration.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> Nouvel Admin</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Créer un compte Admin</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Nom d'utilisateur</Label>
                <Input {...register("username")} required />
              </div>
              <div className="space-y-2">
                <Label>Mot de passe</Label>
                <Input type="password" {...register("password")} required />
              </div>
              <div className="pt-4 flex justify-end">
                <Button type="submit" disabled={createAdmin.isPending}>
                  {createAdmin.isPending ? "Création..." : "Créer"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {admins?.map(admin => (
          <div key={admin.username} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center text-white">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">@{admin.username}</h3>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Admin</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
