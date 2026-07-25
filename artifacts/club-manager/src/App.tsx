import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { AuthProvider } from '@/lib/auth';
import { Layout } from '@/components/layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';

import Login from '@/pages/login';
import RedirectDashboard from '@/pages/dashboard/redirect';
import AdminDashboard from '@/pages/dashboard/admin/index';
import AdminLeads from '@/pages/dashboard/admin/leads';
import AdminPaiements from '@/pages/dashboard/admin/paiements';
import AdminUtilisateurs from '@/pages/dashboard/admin/utilisateurs';
import AdminApprobations from '@/pages/dashboard/admin/approbations';
import AdminPresences from '@/pages/dashboard/admin/presences';
import AdminEvenements from '@/pages/dashboard/admin/evenements';
import AdminGalerie from '@/pages/dashboard/admin/galerie';
import AdminCoaches from '@/pages/dashboard/admin/coaches';
import AdminAdmins from '@/pages/dashboard/admin/admins';
import AdminTrimestres from '@/pages/dashboard/admin/trimestres';
import AdminCalendrier from '@/pages/dashboard/admin/calendrier';
import AdminHistorique from '@/pages/dashboard/admin/historique';

import CoachDashboard from '@/pages/dashboard/coach/index';
import CoachSeances from '@/pages/dashboard/coach/seances';
import CoachPresences from '@/pages/dashboard/coach/presences';

import UserDashboard from '@/pages/dashboard/utilisateur/index';
import UserPresences from '@/pages/dashboard/utilisateur/presences';
import UserPaiement from '@/pages/dashboard/utilisateur/paiement';
import UserGalerie from '@/pages/dashboard/utilisateur/galerie';
import UserEvenements from '@/pages/dashboard/utilisateur/evenements';
import UserParametres from '@/pages/dashboard/utilisateur/parametres';

function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">404 - Not Found</h1>
        <p className="mt-2 text-sm text-gray-600">The page you're looking for doesn't exist.</p>
      </div>
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />

      <Route path="/">
        <RedirectDashboard />
      </Route>

      {/* Admin Routes */}
      <Route path="/dashboard/admin">
        <ProtectedRoute allowedRoles={["Admin"]}>
          <Layout><AdminDashboard /></Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/admin/leads">
        <ProtectedRoute allowedRoles={["Admin"]}>
          <Layout><AdminLeads /></Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/admin/paiements">
        <ProtectedRoute allowedRoles={["Admin"]}>
          <Layout><AdminPaiements /></Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/admin/utilisateurs">
        <ProtectedRoute allowedRoles={["Admin"]}>
          <Layout><AdminUtilisateurs /></Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/admin/approbations">
        <ProtectedRoute allowedRoles={["Admin"]}>
          <Layout><AdminApprobations /></Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/admin/presences">
        <ProtectedRoute allowedRoles={["Admin"]}>
          <Layout><AdminPresences /></Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/admin/evenements">
        <ProtectedRoute allowedRoles={["Admin"]}>
          <Layout><AdminEvenements /></Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/admin/galerie">
        <ProtectedRoute allowedRoles={["Admin"]}>
          <Layout><AdminGalerie /></Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/admin/coaches">
        <ProtectedRoute allowedRoles={["Admin"]}>
          <Layout><AdminCoaches /></Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/admin/admins">
        <ProtectedRoute allowedRoles={["Admin"]}>
          <Layout><AdminAdmins /></Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/admin/trimestres">
        <ProtectedRoute allowedRoles={["Admin"]}>
          <Layout><AdminTrimestres /></Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/admin/calendrier">
        <ProtectedRoute allowedRoles={["Admin"]}>
          <Layout><AdminCalendrier /></Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/admin/historique">
        <ProtectedRoute allowedRoles={["Admin"]}>
          <Layout><AdminHistorique /></Layout>
        </ProtectedRoute>
      </Route>

      {/* Coach Routes */}
      <Route path="/dashboard/coach">
        <ProtectedRoute allowedRoles={["Coach"]}>
          <Layout><CoachDashboard /></Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/coach/seances">
        <ProtectedRoute allowedRoles={["Coach"]}>
          <Layout><CoachSeances /></Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/coach/presences">
        <ProtectedRoute allowedRoles={["Coach"]}>
          <Layout><CoachPresences /></Layout>
        </ProtectedRoute>
      </Route>

      {/* User Routes */}
      <Route path="/dashboard/utilisateur">
        <ProtectedRoute allowedRoles={["User"]}>
          <Layout><UserDashboard /></Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/utilisateur/presences">
        <ProtectedRoute allowedRoles={["User"]}>
          <Layout><UserPresences /></Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/utilisateur/paiement">
        <ProtectedRoute allowedRoles={["User"]}>
          <Layout><UserPaiement /></Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/utilisateur/galerie">
        <ProtectedRoute allowedRoles={["User"]}>
          <Layout><UserGalerie /></Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/utilisateur/evenements">
        <ProtectedRoute allowedRoles={["User"]}>
          <Layout><UserEvenements /></Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/utilisateur/parametres">
        <ProtectedRoute allowedRoles={["User"]}>
          <Layout><UserParametres /></Layout>
        </ProtectedRoute>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, '') ?? ''}>
            <Router />
          </WouterRouter>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
