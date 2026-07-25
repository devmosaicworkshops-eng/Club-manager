import { useGetSeances } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { CalendarClock, CheckCircle, Clock } from "lucide-react";
import { Link } from "wouter";

export default function CoachDashboard() {
  const { user } = useAuth();
  const { data: seances } = useGetSeances();

  const mySeances = seances?.filter(s => s.coachUsername === user?.username) || [];
  const pendingCount = mySeances.filter(s => s.status === 'Pending').length;
  const approvedCount = mySeances.filter(s => s.status === 'Approved').length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Tableau de bord</h1>
        <p className="text-gray-500 mt-1">Bienvenue {user?.nom}.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/dashboard/coach/seances" className="block group">
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-primary/20 transition-all cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total de mes séances</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{mySeances.length}</p>
              </div>
              <div className="w-12 h-12 rounded-full flex items-center justify-center bg-blue-50 text-blue-600 group-hover:scale-110 transition-transform">
                <CalendarClock className="w-6 h-6" />
              </div>
            </div>
          </div>
        </Link>
        
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Séances Approuvées</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{approvedCount}</p>
            </div>
            <div className="w-12 h-12 rounded-full flex items-center justify-center bg-green-50 text-green-600">
              <CheckCircle className="w-6 h-6" />
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">En attente d'approbation</p>
              <p className="text-3xl font-bold text-amber-600 mt-2">{pendingCount}</p>
            </div>
            <div className="w-12 h-12 rounded-full flex items-center justify-center bg-amber-50 text-amber-600">
              <Clock className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
