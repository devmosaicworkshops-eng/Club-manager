import {
  useGetPaymentsSummary,
  useGetUserBillings,
  useAddUserPayment,
  useSendEnrollmentReceipt,
  getGetUserBillingsQueryKey,
  getGetPaymentsSummaryQueryKey,
} from "@workspace/api-client-react";
import type { UserBilling } from "@workspace/api-client-react";
import { CreditCard, TrendingUp, Users, AlertCircle, Send } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

export default function AdminPaiements() {
  const { data: summary } = useGetPaymentsSummary();
  const { data: billings } = useGetUserBillings();
  const [searchTerm, setSearchTerm] = useState("");
  const [paymentTarget, setPaymentTarget] = useState<UserBilling | null>(null);
  const { toast } = useToast();
  const sendReceipt = useSendEnrollmentReceipt();

  const handleSendReceipt = (user: UserBilling) => {
    if (!user.latestEnrollmentId) {
      toast({ title: "Aucune facturation à envoyer pour cet utilisateur", variant: "destructive" });
      return;
    }
    sendReceipt.mutate(
      { id: user.latestEnrollmentId },
      {
        onSuccess: (res) => {
          if (res.success) {
            toast({ title: "Reçu WhatsApp envoyé", description: `${user.nom} ${user.prenom}` });
          } else {
            toast({ title: "Envoi du reçu échoué", description: res.error || "Vérifiez la connexion WhatsApp", variant: "destructive" });
          }
        },
        onError: (err: any) => {
          toast({ title: "Envoi du reçu échoué", description: err?.message || "Erreur serveur", variant: "destructive" });
        },
      }
    );
  };

  const formatCurrency = (val: number | undefined) =>
    new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD" }).format(val || 0);

  // Only show users who still owe something
  const filteredBillings = (billings ?? [])
    .filter((b) => (b.totalRemaining ?? 0) > 0)
    .filter(
      (b) =>
        b.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.prenom.toLowerCase().includes(searchTerm.toLowerCase())
    );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Paiements</h1>
        <p className="text-gray-500 mt-1">Utilisateurs avec un solde restant à régler.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Attendu</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{formatCurrency(summary?.totalExpected)}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Payé</p>
              <p className="text-2xl font-bold text-green-600 mt-2">{formatCurrency(summary?.totalPaid)}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Solde Restant</p>
              <p className="text-2xl font-bold text-red-600 mt-2">{formatCurrency(summary?.totalRemaining)}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Utilisateurs en Attente</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{summary?.activeUsers || 0}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Users className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Table — only users with remaining > 0 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center gap-4 flex-wrap">
          <div>
            <h2 className="font-semibold text-gray-900">Soldes en attente</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {filteredBillings.length} utilisateur{filteredBillings.length !== 1 ? "s" : ""} avec un solde restant
              {searchTerm ? " · filtrés" : ""}
            </p>
          </div>
          <Input
            placeholder="Rechercher un utilisateur..."
            className="w-64 bg-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 font-medium">Nom complet</th>
                <th className="px-6 py-3 font-medium">Total Attendu</th>
                <th className="px-6 py-3 font-medium">Total Payé</th>
                <th className="px-6 py-3 font-medium">Solde Restant</th>
                <th className="px-6 py-3 font-medium">Statut</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredBillings.map((user) => (
                <tr key={user.username} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{user.nom} {user.prenom}</div>
                    <div className="text-xs text-gray-400">{user.username}</div>
                  </td>
                  <td className="px-6 py-4">{formatCurrency(user.totalExpected)}</td>
                  <td className="px-6 py-4 text-green-600 font-medium">{formatCurrency(user.totalPaid)}</td>
                  <td className="px-6 py-4 font-semibold text-red-600">{formatCurrency(user.totalRemaining)}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      user.paymentStatus === "Payé"     ? "bg-green-100 text-green-700" :
                      user.paymentStatus === "Partiel"  ? "bg-amber-100 text-amber-700" :
                      user.paymentStatus === "Suspendu" ? "bg-red-100 text-red-700" :
                      "bg-gray-100 text-gray-700"
                    }`}>
                      {user.paymentStatus || "Inconnu"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        className="inline-flex items-center gap-1 text-gray-500 hover:text-primary hover:underline text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => handleSendReceipt(user)}
                        disabled={!user.latestEnrollmentId || sendReceipt.isPending}
                        title="Renvoyer le reçu WhatsApp"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Renvoyer le reçu
                      </button>
                      <button
                        className="text-primary hover:underline text-sm font-medium"
                        onClick={() => setPaymentTarget(user)}
                        title="Ajouter un montant reçu à cet utilisateur"
                      >
                        Ajouter montant
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredBillings.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <CreditCard className="w-8 h-8 text-gray-200" />
                      <p className="font-medium text-gray-500">
                        {searchTerm ? "Aucun résultat pour cette recherche." : "🎉 Tous les utilisateurs sont à jour !"}
                      </p>
                      {!searchTerm && (
                        <p className="text-sm">Aucun solde en attente.</p>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <UpdatePaymentDialog
        user={paymentTarget}
        onClose={() => setPaymentTarget(null)}
        formatCurrency={formatCurrency}
      />
    </div>
  );
}

function UpdatePaymentDialog({
  user,
  onClose,
  formatCurrency,
}: {
  user: UserBilling | null;
  onClose: () => void;
  formatCurrency: (val: number | undefined) => string;
}) {
  const [amount, setAmount] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const addPayment = useAddUserPayment();

  const handleClose = () => {
    setAmount("");
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      toast({ title: "Veuillez saisir un montant valide", variant: "destructive" });
      return;
    }

    addPayment.mutate(
      { username: user.username, data: { amount: parsedAmount } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetUserBillingsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetPaymentsSummaryQueryKey() });
          toast({ title: "Paiement enregistré", description: "Un reçu WhatsApp sera envoyé au parent." });
          handleClose();
        },
        onError: () => {
          toast({ title: "Erreur lors de l'enregistrement du paiement", variant: "destructive" });
        },
      }
    );
  };

  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Ajouter un montant reçu — {user ? `${user.nom} ${user.prenom}` : ""}
          </DialogTitle>
        </DialogHeader>
        {user && (
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="grid grid-cols-3 gap-4 text-sm bg-gray-50 rounded-lg p-3">
              <div>
                <p className="text-gray-500">Attendu</p>
                <p className="font-medium">{formatCurrency(user.totalExpected)}</p>
              </div>
              <div>
                <p className="text-gray-500">Payé</p>
                <p className="font-medium text-green-600">{formatCurrency(user.totalPaid)}</p>
              </div>
              <div>
                <p className="text-gray-500">Restant</p>
                <p className="font-semibold text-red-600">{formatCurrency(user.totalRemaining)}</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-amount">Montant reçu (MAD)</Label>
              <Input
                id="payment-amount"
                type="number"
                min="0"
                step="0.01"
                autoFocus
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={handleClose}>
                Annuler
              </Button>
              <Button type="submit" disabled={addPayment.isPending}>
                {addPayment.isPending ? "Ajout en cours..." : "Ajouter le montant"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
