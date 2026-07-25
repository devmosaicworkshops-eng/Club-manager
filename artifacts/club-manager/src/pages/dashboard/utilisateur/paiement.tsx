import { useGetEnrollments } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";

export default function UserPaiement() {
  const { user } = useAuth();
  const { data: enrollments } = useGetEnrollments({ userUsername: user?.username ?? undefined });

  // Note: the backend handles the query params if passed correctly, but since we rely on the API hook,
  // we can also filter client-side just to be safe if the hook doesn't pass params correctly yet.
  const myEnrollments = enrollments?.filter(e => e.userUsername === user?.username) || [];

  const formatCurrency = (val: number | undefined) => 
    new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(val || 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Paiement & Facturation</h1>
        <p className="text-gray-500 mt-1">Consultez l'historique de vos paiements et vos factures.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 font-medium">Trimestre</th>
                <th className="px-6 py-3 font-medium">Programme</th>
                <th className="px-6 py-3 font-medium">Montant Attendu</th>
                <th className="px-6 py-3 font-medium">Montant Payé</th>
                <th className="px-6 py-3 font-medium">Solde</th>
                <th className="px-6 py-3 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {myEnrollments.map((env) => (
                <tr key={env.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{env.trimester} {env.academicYear}</td>
                  <td className="px-6 py-4">{env.program}</td>
                  <td className="px-6 py-4">{formatCurrency(env.amountExpected)}</td>
                  <td className="px-6 py-4 text-green-600 font-medium">{formatCurrency(env.amountReceived)}</td>
                  <td className="px-6 py-4 text-red-600 font-medium">{formatCurrency(env.amountRemaining)}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      env.paymentStatus === 'Payé' ? 'bg-green-100 text-green-700' :
                      env.paymentStatus === 'Partiel' ? 'bg-amber-100 text-amber-700' :
                      env.paymentStatus === 'Suspendu' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {env.paymentStatus || 'Inconnu'}
                    </span>
                  </td>
                </tr>
              ))}
              {myEnrollments.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    Aucun historique de paiement trouvé.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
