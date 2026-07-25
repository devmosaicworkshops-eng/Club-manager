import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { customFetch } from "@workspace/api-client-react";
import {
  History, ChevronDown, ChevronUp, User, BookOpen,
  Calendar, CreditCard, AlertCircle, Search, X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ─── Types ─────────────────────────────────────────────────────────────────

interface Enrollment {
  id: string;
  trimester: string;
  academicYear: string;
  amountExpected: number;
  amountReceived: number;
  paymentMethod: string;
  billingStartDate: string;
  suspensionStatus: string;
}

interface LeadInfo {
  ecole: string;
  niveau: string;
  troubleApprentissage: string;
  allergie: string;
  allergieDetail: string;
  parcours: string;
  emailParent: string;
  medicalNotes: string;
  rendezvousDate: string | null;
  confirmed: boolean;
}

interface HistoryUser {
  username: string;
  nom: string;
  prenom: string;
  dateNaissance: string;
  nomParent: string;
  numeroParent: string;
  categorie: string;
  group: string;
  remarque: string;
  paymentType: string;
  createdAt: string;
  enrollments: Enrollment[];
  lead: LeadInfo | null;
}

// ─── Category colours ───────────────────────────────────────────────────────

const catColor: Record<string, string> = {
  "Mini Maker": "bg-pink-100 text-pink-700 border-pink-200",
  Junior:       "bg-blue-100 text-blue-700 border-blue-200",
  Cadets:       "bg-amber-100 text-amber-700 border-amber-200",
  Senior:       "bg-violet-100 text-violet-700 border-violet-200",
};

const CATEGORIES = ["Toutes", "Mini Maker", "Junior", "Cadets", "Senior"];

// ─── Data hook ──────────────────────────────────────────────────────────────

function useHistory() {
  return useQuery<HistoryUser[]>({
    queryKey: ["history"],
    queryFn: () => customFetch<HistoryUser[]>("/api/history"),
  });
}

// ─── Helper ─────────────────────────────────────────────────────────────────

function fmt(d: string) {
  if (!d) return "—";
  try { return format(new Date(d), "dd MMM yyyy", { locale: fr }); } catch { return d; }
}

function paymentBadge(expected: number, received: number, status: string) {
  if (status === "Suspendu") return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Suspendu</span>;
  if (expected === 0) return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">—</span>;
  if (received >= expected) return <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Soldé</span>;
  if (received === 0) return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">Non payé</span>;
  return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Partiel</span>;
}

// ─── User row ───────────────────────────────────────────────────────────────

function UserRow({ u }: { u: HistoryUser }) {
  const [open, setOpen] = useState(false);

  const totalExpected = u.enrollments.reduce((s, e) => s + e.amountExpected, 0);
  const totalReceived = u.enrollments.reduce((s, e) => s + e.amountReceived, 0);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      {/* Header row */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
      >
        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center text-white text-sm font-semibold shrink-0">
          {u.prenom.charAt(0).toUpperCase()}{u.nom.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900">{u.prenom} {u.nom}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${catColor[u.categorie] || "bg-gray-100 text-gray-600 border-gray-200"}`}>
              {u.categorie || "—"}
            </span>
            {u.group && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                {u.group}
              </span>
            )}
          </div>
          <div className="flex gap-3 mt-0.5 text-xs text-gray-500 flex-wrap">
            <span>{u.nomParent || "—"}</span>
            {u.numeroParent && <span>· {u.numeroParent}</span>}
            <span>· {u.paymentType || "—"}</span>
            {u.enrollments.length > 0 && (
              <span>· {u.enrollments.length} trimestre{u.enrollments.length > 1 ? "s" : ""}</span>
            )}
          </div>
        </div>

        {/* Quick payment badge */}
        <div className="shrink-0 hidden sm:block">
          {paymentBadge(totalExpected, totalReceived, "")}
        </div>

        {open ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-4 space-y-5">

          {/* ── Section: Profil ── */}
          <section className="space-y-2">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> Profil
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5 text-sm">
              <Info label="Prénom" value={u.prenom} />
              <Info label="Nom" value={u.nom} />
              <Info label="Date de naissance" value={fmt(u.dateNaissance)} />
              <Info label="Nom du parent" value={u.nomParent} />
              <Info label="Téléphone parent" value={u.numeroParent} />
              <Info label="Catégorie" value={u.categorie} />
              {u.group && <Info label="Groupe" value={u.group} />}
              <Info label="Type de paiement" value={u.paymentType} />
              <Info label="Compte créé le" value={fmt(u.createdAt)} />
            </div>
            {u.remarque && (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800 whitespace-pre-wrap">{u.remarque}</p>
              </div>
            )}
          </section>

          {/* ── Section: Fiche lead ── */}
          {u.lead && (
            <section className="space-y-2">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" /> Fiche lead
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5 text-sm">
                <Info label="École" value={u.lead.ecole} />
                <Info label="Niveau" value={u.lead.niveau} />
                <Info label="Parcours" value={u.lead.parcours} />
                <Info label="Email parent" value={u.lead.emailParent} />
                {u.lead.rendezvousDate && <Info label="Rendez-vous" value={fmt(u.lead.rendezvousDate)} />}
                <Info label="Confirmé" value={u.lead.confirmed ? "Oui" : "Non"} />
              </div>
              {u.lead.troubleApprentissage && (
                <div className="text-sm"><span className="text-gray-500 font-medium">Trouble d'apprentissage : </span>{u.lead.troubleApprentissage}</div>
              )}
              {u.lead.allergie && (
                <div className="text-sm"><span className="text-gray-500 font-medium">Allergie : </span>{u.lead.allergie}{u.lead.allergieDetail ? ` — ${u.lead.allergieDetail}` : ""}</div>
              )}
              {u.lead.medicalNotes && (
                <div className="mt-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  <span className="font-medium">Notes médicales : </span>{u.lead.medicalNotes}
                </div>
              )}
            </section>
          )}

          {/* ── Section: Trimestres ── */}
          <section className="space-y-2">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Trimestres inscrits
            </h4>
            {u.enrollments.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Aucune inscription enregistrée.</p>
            ) : (
              <div className="space-y-2">
                {u.enrollments.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5">
                    <CreditCard className="w-4 h-4 text-gray-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800">
                        {e.trimester} · {e.academicYear}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {e.paymentMethod || "—"} · Début : {fmt(e.billingStartDate)}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold text-gray-900">
                        {e.amountReceived.toLocaleString("fr-MA")} / {e.amountExpected.toLocaleString("fr-MA")} MAD
                      </div>
                      {paymentBadge(e.amountExpected, e.amountReceived, e.suspensionStatus)}
                    </div>
                  </div>
                ))}
                <div className="flex justify-end text-xs text-gray-500 pt-1">
                  Total : {totalReceived.toLocaleString("fr-MA")} / {totalExpected.toLocaleString("fr-MA")} MAD
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-gray-400 text-xs">{label}</span>
      <div className="text-gray-800 font-medium truncate">{value || "—"}</div>
    </div>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────

export default function AdminHistorique() {
  const { data: users, isLoading } = useHistory();
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("Toutes");

  const filtered = (users ?? []).filter((u) => {
    const matchCat = catFilter === "Toutes" || u.categorie === catFilter;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      u.nom.toLowerCase().includes(q) ||
      u.prenom.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      u.nomParent.toLowerCase().includes(q) ||
      u.numeroParent.includes(q) ||
      u.remarque.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  const byCategory = CATEGORIES.filter((c) => c !== "Toutes").map((c) => ({
    cat: c,
    count: (users ?? []).filter((u) => u.categorie === c).length,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
          <History className="w-6 h-6" /> Historique des membres
        </h1>
        <p className="text-gray-500 mt-1">
          Fiche complète de chaque élève : profil, données de la fiche lead, trimestres inscrits et remarques.
        </p>
      </div>

      {/* Category stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {byCategory.map(({ cat, count }) => (
          <button
            key={cat}
            onClick={() => setCatFilter((v) => v === cat ? "Toutes" : cat)}
            className={`rounded-xl border px-4 py-3 text-left transition-colors ${
              catFilter === cat
                ? catColor[cat]?.replace("bg-", "bg-").replace("border-", "border-") || "bg-gray-100"
                : "bg-white border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className="text-2xl font-bold text-gray-900">{count}</div>
            <div className="text-xs text-gray-500 mt-0.5">{cat}</div>
          </button>
        ))}
      </div>

      {/* Search + category filter bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom, parent, remarque…"
            className="pl-9 bg-white"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {CATEGORIES.map((c) => (
            <Button
              key={c}
              size="sm"
              variant={catFilter === c ? "default" : "outline"}
              onClick={() => setCatFilter(c)}
            >
              {c}
            </Button>
          ))}
        </div>
        {(search || catFilter !== "Toutes") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setSearch(""); setCatFilter("Toutes"); }}
            className="gap-1 text-gray-500"
          >
            <X className="w-3.5 h-3.5" /> Réinitialiser
          </Button>
        )}
      </div>

      {/* Result count */}
      <p className="text-sm text-gray-400">
        {filtered.length} membre{filtered.length !== 1 ? "s" : ""}
        {catFilter !== "Toutes" ? ` · ${catFilter}` : ""}
        {search ? ` · "${search}"` : ""}
      </p>

      {/* List */}
      {isLoading ? (
        <div className="py-20 text-center text-gray-400">Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-gray-400">Aucun résultat.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((u) => <UserRow key={u.username} u={u} />)}
        </div>
      )}
    </div>
  );
}
