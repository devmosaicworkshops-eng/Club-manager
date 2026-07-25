import { useUpdateUserPassword } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { useToast } from "@/components/ui/use-toast";

export default function UserParametres() {
  const { user } = useAuth();
  const updatePassword = useUpdateUserPassword();
  const { toast } = useToast();

  const { register, handleSubmit, reset } = useForm({
    defaultValues: {
      oldPassword: "",
      newPassword: "",
      confirmPassword: ""
    }
  });

  const onSubmit = (data: any) => {
    if (data.newPassword !== data.confirmPassword) {
      toast({ title: "Erreur", description: "Les mots de passe ne correspondent pas.", variant: "destructive" });
      return;
    }

    if (!user) return;

    updatePassword.mutate({ 
      username: user.username,
      data: { oldPassword: data.oldPassword, newPassword: data.newPassword }
    }, {
      onSuccess: () => {
        toast({ title: "Succès", description: "Votre mot de passe a été mis à jour." });
        reset();
      },
      onError: () => {
        toast({ title: "Erreur", description: "L'ancien mot de passe est incorrect.", variant: "destructive" });
      }
    });
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Paramètres</h1>
        <p className="text-gray-500 mt-1">Gérez vos informations de compte.</p>
      </div>

      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Profil</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500 block mb-1">Nom complet</span>
            <span className="font-medium text-gray-900">{user?.nom}</span>
          </div>
          <div>
            <span className="text-gray-500 block mb-1">Nom d'utilisateur</span>
            <span className="font-medium text-gray-900">{user?.username}</span>
          </div>
          <div>
            <span className="text-gray-500 block mb-1">Catégorie</span>
            <span className="font-medium text-gray-900">{user?.categorie || 'N/A'}</span>
          </div>
          <div>
            <span className="text-gray-500 block mb-1">Statut Paiement</span>
            <span className="font-medium text-gray-900">{user?.paymentStatus || 'N/A'}</span>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Changer le mot de passe</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Ancien mot de passe</Label>
            <Input type="password" {...register("oldPassword")} required />
          </div>
          <div className="space-y-2">
            <Label>Nouveau mot de passe</Label>
            <Input type="password" {...register("newPassword")} required />
          </div>
          <div className="space-y-2">
            <Label>Confirmer le nouveau mot de passe</Label>
            <Input type="password" {...register("confirmPassword")} required />
          </div>
          <div className="pt-2">
            <Button type="submit" disabled={updatePassword.isPending}>
              {updatePassword.isPending ? "Mise à jour..." : "Mettre à jour le mot de passe"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
