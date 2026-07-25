import { useAuth } from "@/lib/auth";
import { Link, useLocation } from "wouter";
import { ReactNode, useState, useEffect } from "react";
import { WhatsAppPanel } from "@/components/WhatsAppPanel";
import { useGetSeances } from "@workspace/api-client-react";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  UserCheck,
  CalendarCheck,
  Calendar,
  Image as ImageIcon,
  LogOut,
  Settings,
  Clock,
  RotateCcw,
  AlertTriangle,
  ShieldCheck,
  GraduationCap,
  Menu,
  X,
  History,
} from "lucide-react";

type NavItem = { name: string; path: string; icon: typeof LayoutDashboard; badge?: number };
type NavGroup = { title: string; items: NavItem[] };

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: seances } = useGetSeances();

  // Close mobile sidebar on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  if (!user) return <>{children}</>;

  const rejectedCount =
    user.role === "Coach"
      ? (seances ?? []).filter((s) => s.coachUsername === user.username && s.status === "Rejected").length
      : 0;

  const adminNavGroups: NavGroup[] = [
    {
      title: "Vision globale",
      items: [{ name: "Tableau de bord", path: "/dashboard/admin", icon: LayoutDashboard }],
    },
    {
      title: "Opérations",
      items: [
        { name: "Leads", path: "/dashboard/admin/leads", icon: Users },
        { name: "Trimestres", path: "/dashboard/admin/trimestres", icon: RotateCcw },
        { name: "Paiements", path: "/dashboard/admin/paiements", icon: CreditCard },
        { name: "Approbations", path: "/dashboard/admin/approbations", icon: CalendarCheck },
        { name: "Calendrier", path: "/dashboard/admin/calendrier", icon: Calendar },
        { name: "Présences", path: "/dashboard/admin/presences", icon: Clock },
        { name: "Événements", path: "/dashboard/admin/evenements", icon: Calendar },
      ],
    },
    {
      title: "Communauté",
      items: [
        { name: "Utilisateurs", path: "/dashboard/admin/utilisateurs", icon: UserCheck },
        { name: "Historique", path: "/dashboard/admin/historique", icon: History },
        { name: "Coaches", path: "/dashboard/admin/coaches", icon: GraduationCap },
        { name: "Administrateurs", path: "/dashboard/admin/admins", icon: ShieldCheck },
        { name: "Galerie", path: "/dashboard/admin/galerie", icon: ImageIcon },
      ],
    },
  ];

  const coachNavGroups: NavGroup[] = [
    {
      title: "Mon activité",
      items: [
        { name: "Tableau de bord", path: "/dashboard/coach", icon: LayoutDashboard },
        { name: "Mes séances", path: "/dashboard/coach/seances", icon: Calendar, badge: rejectedCount },
        { name: "Présences", path: "/dashboard/coach/presences", icon: Clock },
      ],
    },
  ];

  const userNavGroups: NavGroup[] = [
    {
      title: "Mon espace",
      items: [
        { name: "Emploi du temps", path: "/dashboard/utilisateur", icon: Calendar },
        { name: "Mes présences", path: "/dashboard/utilisateur/presences", icon: Clock },
        { name: "Paiement", path: "/dashboard/utilisateur/paiement", icon: CreditCard },
        { name: "Galerie", path: "/dashboard/utilisateur/galerie", icon: ImageIcon },
        { name: "Événements", path: "/dashboard/utilisateur/evenements", icon: Calendar },
        { name: "Paramètres", path: "/dashboard/utilisateur/parametres", icon: Settings },
      ],
    },
  ];

  const navGroups =
    user.role === "Admin" ? adminNavGroups : user.role === "Coach" ? coachNavGroups : userNavGroups;

  const initial = (user.nom || user.username || "?").charAt(0).toUpperCase();

  // Find the active page name for the mobile top bar
  const allItems = navGroups.flatMap((g) => g.items);
  const activeItem = allItems.find((item) => item.path === location);
  const activePageName = activeItem?.name ?? "Mosaic Workshops";

  const SidebarContent = () => (
    <>
      {/* Logo / Brand */}
      <div className="px-5 py-4 border-b border-sidebar-border shrink-0 flex items-center justify-between">
        <div>
          <h1 className="font-editorial text-lg text-sidebar-foreground leading-tight">Mosaic</h1>
          <p className="text-xs text-muted-foreground">Workshops</p>
        </div>
        {/* Close button — mobile only */}
        <button
          onClick={() => setMobileOpen(false)}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors md:hidden"
          aria-label="Fermer le menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-5">
        {navGroups.map((group) => (
          <div key={group.title}>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-3 mb-1.5">
              {group.title}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = location === item.path;
                const Icon = item.icon;
                return (
                  <Link key={item.path} href={item.path}>
                    <div
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium cursor-pointer transition-all relative
                        ${isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.name}</span>
                      {item.badge ? (
                        <span className="ml-auto shrink-0 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                          {item.badge}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border shrink-0">
        {user.role === "Admin" ? (
          <button
            onClick={() => { setWhatsappOpen(true); setMobileOpen(false); }}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-xl text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent transition-colors mb-1"
          >
            <div className="w-8 h-8 rounded-full bg-foreground flex items-center justify-center shrink-0">
              <span className="font-editorial text-background text-sm">{initial}</span>
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="text-sm font-medium text-foreground truncate">{user.nom || user.username}</div>
              <div className="text-xs text-muted-foreground truncate">{user.role}</div>
            </div>
          </button>
        ) : (
          <div className="flex items-center gap-3 px-3 py-2 mb-1">
            <div className="w-8 h-8 rounded-full bg-foreground flex items-center justify-center shrink-0">
              <span className="font-editorial text-background text-sm">{initial}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground truncate">{user.nom || user.username}</div>
              <div className="text-xs text-muted-foreground truncate">{user.role}</div>
            </div>
          </div>
        )}
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Déconnexion
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-[100dvh] bg-background overflow-hidden">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — fixed drawer on mobile, static on desktop */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-[272px] bg-sidebar border-r border-sidebar-border flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"}
          md:relative md:translate-x-0 md:shrink-0 md:shadow-none
        `}
      >
        <SidebarContent />
      </aside>

      {user.role === "Admin" && <WhatsAppPanel open={whatsappOpen} onOpenChange={setWhatsappOpen} />}

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile top bar */}
        <header className="flex items-center gap-3 h-14 px-4 border-b border-border bg-background/95 backdrop-blur-sm shrink-0 md:hidden sticky top-0 z-30">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 -ml-1 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Ouvrir le menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-sm text-foreground truncate block">{activePageName}</span>
          </div>
          {/* User avatar pill */}
          <div className="w-8 h-8 rounded-full bg-foreground flex items-center justify-center shrink-0">
            <span className="font-editorial text-background text-sm">{initial}</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="px-4 py-5 md:px-8 md:py-8 max-w-6xl mx-auto space-y-4 md:space-y-6">
            {user.role === "User" && user.enrolled === false && (
              <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium">
                    Vous n'êtes pas inscrit(e) pour le trimestre en cours{user.currentTrimesterLabel ? ` (${user.currentTrimesterLabel})` : ""}.
                  </p>
                  <p className="text-amber-700/90 mt-0.5">
                    Certaines informations, comme les prochaines séances, ne sont pas disponibles tant que vous n'êtes pas réinscrit(e).
                    Veuillez contacter l'administration pour vous réinscrire.
                  </p>
                </div>
              </div>
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
