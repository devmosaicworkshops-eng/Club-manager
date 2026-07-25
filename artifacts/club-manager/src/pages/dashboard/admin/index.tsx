import { useGetLeads, useGetUsers, useGetCoaches, useGetSeances } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Users, BookOpen, GraduationCap, CalendarClock } from "lucide-react";
import { Link } from "wouter";

const cardStyles = [
  { bg: "bg-[#FDF3F3] border-[#F9E4E4]" },
  { bg: "bg-[#F3F8F4] border-[#E4EFE6]" },
  { bg: "bg-[#F4F4FA] border-[#E8E8F2]" },
  { bg: "bg-[#FEF9EB] border-[#FDF1D3]" },
];

export default function AdminDashboard() {
  const { user } = useAuth();
  const { data: leads } = useGetLeads();
  const { data: users } = useGetUsers();
  const { data: coaches } = useGetCoaches();
  const { data: seances } = useGetSeances({ status: 'Pending' });

  const pendingSeances = seances?.filter(s => s.status === 'Pending') || [];

  const stats = [
    {
      title: "Total Leads",
      value: leads?.length || 0,
      icon: Users,
      path: "/dashboard/admin/leads"
    },
    {
      title: "Utilisateurs Actifs",
      value: users?.length || 0,
      icon: GraduationCap,
      path: "/dashboard/admin/utilisateurs"
    },
    {
      title: "Total Coaches",
      value: coaches?.length || 0,
      icon: BookOpen,
      path: "/dashboard/admin/coaches"
    },
    {
      title: "Séances en attente",
      value: pendingSeances.length,
      icon: CalendarClock,
      path: "/dashboard/admin/approbations"
    }
  ];

  return (
    <div className="space-y-8">
      <div className="max-w-2xl">
        <h1 className="font-editorial text-4xl md:text-5xl mb-3 text-foreground leading-tight">
          Bonjour, <span className="italic font-light">{user?.nom || user?.username}</span> 👋
        </h1>
        <p className="text-lg text-muted-foreground leading-relaxed">
          Voici l'aperçu général de Mosaic Workshops aujourd'hui.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          const style = cardStyles[idx % cardStyles.length];
          return (
            <Link key={idx} href={stat.path} className="block group">
              <div className={`p-6 rounded-3xl border ${style.bg} shadow-[0_4px_20px_rgba(45,40,36,0.04)] hover:shadow-[0_6px_24px_rgba(45,40,36,0.08)] transition-all cursor-pointer min-h-[160px] flex flex-col justify-between`}>
                <div className="flex justify-between items-start mb-4">
                  <span className="text-sm font-medium text-muted-foreground">{stat.title}</span>
                  <div className="w-9 h-9 rounded-full bg-white/60 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                    <Icon className="w-4 h-4 text-foreground" />
                  </div>
                </div>
                <p className="font-editorial text-4xl text-foreground tracking-tight">{stat.value}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
