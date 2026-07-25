import { useGetEvents, getGetEventsQueryKey } from "@workspace/api-client-react";
import { useState } from "react";
import { Plus, Calendar as CalIcon, MapPin, Pencil, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";

type EventForm = { title: string; description: string; date: string; location: string };
type Event = { id: string; title: string; description: string; date: string; location: string; imageUrl: string };

async function apiFetch(path: string, method: string, body?: object) {
  const token = localStorage.getItem("token");
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
  return res.json();
}

export default function AdminEvenements() {
  const { data: events } = useGetEvents();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Event | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Event | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const createForm = useForm<EventForm>({ defaultValues: { title: "", description: "", date: "", location: "" } });
  const editForm = useForm<EventForm>();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetEventsQueryKey() });

  const onCreateSubmit = async (data: EventForm) => {
    setIsSaving(true);
    try {
      await apiFetch("/api/events", "POST", { ...data, date: new Date(data.date).toISOString() });
      invalidate();
      setCreateOpen(false);
      createForm.reset();
      toast({ title: "Événement créé" });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally { setIsSaving(false); }
  };

  const onEditSubmit = async (data: EventForm) => {
    if (!editTarget) return;
    setIsSaving(true);
    try {
      await apiFetch(`/api/events/${editTarget.id}`, "PATCH", { ...data, date: new Date(data.date).toISOString() });
      invalidate();
      setEditTarget(null);
      toast({ title: "Événement modifié" });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally { setIsSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await apiFetch(`/api/events/${deleteTarget.id}`, "DELETE");
      invalidate();
      setDeleteTarget(null);
      toast({ title: "Événement supprimé" });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally { setIsDeleting(false); }
  };

  const openEdit = (event: Event) => {
    // datetime-local needs "YYYY-MM-DDTHH:mm" format
    const localDate = new Date(event.date);
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateLocal = `${localDate.getFullYear()}-${pad(localDate.getMonth() + 1)}-${pad(localDate.getDate())}T${pad(localDate.getHours())}:${pad(localDate.getMinutes())}`;
    editForm.reset({ title: event.title, description: event.description, date: dateLocal, location: event.location });
    setEditTarget(event);
  };

  const EventFormFields = ({ form, onSubmit, submitLabel }: { form: ReturnType<typeof useForm<EventForm>>; onSubmit: (d: EventForm) => void; submitLabel: string }) => (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
      <div className="space-y-2">
        <Label>Titre <span className="text-red-500">*</span></Label>
        <Input {...form.register("title")} required />
      </div>
      <div className="space-y-2">
        <Label>Date &amp; Heure <span className="text-red-500">*</span></Label>
        <Input type="datetime-local" {...form.register("date")} required />
      </div>
      <div className="space-y-2">
        <Label>Lieu</Label>
        <Input {...form.register("location")} placeholder="ex: Salle Principale…" />
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea {...form.register("description")} rows={3} />
      </div>
      <div className="pt-2 flex justify-end gap-2">
        <Button type="submit" disabled={isSaving}>{isSaving ? "Enregistrement…" : submitLabel}</Button>
      </div>
    </form>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Événements</h1>
          <p className="text-gray-500 mt-1 text-sm">Planifiez des compétitions, ateliers et journées portes ouvertes.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2 shrink-0">
          <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Créer un Événement</span><span className="sm:hidden">Créer</span>
        </Button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(events ?? []).map((event) => (
          <div key={event.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col group">
            {/* Image / gradient banner */}
            <div className="h-28 bg-gray-100 relative shrink-0">
              {event.imageUrl ? (
                <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <CalIcon className="w-10 h-10 text-primary/30" />
                </div>
              )}
              {/* Action buttons — always visible on mobile, hover on desktop */}
              <div className="absolute top-2 right-2 flex gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => openEdit(event as Event)}
                  className="w-7 h-7 rounded-full bg-white/90 shadow text-gray-700 flex items-center justify-center hover:bg-white transition-colors"
                  title="Modifier"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setDeleteTarget(event as Event)}
                  className="w-7 h-7 rounded-full bg-white/90 shadow text-red-600 flex items-center justify-center hover:bg-white transition-colors"
                  title="Supprimer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-4 flex-1 flex flex-col gap-2">
              <h3 className="font-semibold text-gray-900 line-clamp-1">{event.title}</h3>
              <div className="space-y-1 text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <CalIcon className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span>{format(new Date(event.date), "dd MMM yyyy, HH:mm", { locale: fr })}</span>
                </div>
                {event.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="line-clamp-1">{event.location}</span>
                  </div>
                )}
              </div>
              {event.description && (
                <p className="text-sm text-gray-400 line-clamp-2 mt-auto pt-1">{event.description}</p>
              )}
            </div>
          </div>
        ))}

        {(events ?? []).length === 0 && (
          <div className="col-span-full py-16 text-center text-gray-500 bg-white rounded-xl border border-dashed border-gray-300 flex flex-col items-center gap-2">
            <CalIcon className="w-10 h-10 text-gray-300" />
            <p className="font-medium">Aucun événement prévu</p>
            <p className="text-sm text-gray-400">Cliquez sur « Créer » pour commencer.</p>
          </div>
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) { setCreateOpen(false); createForm.reset(); } }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader><DialogTitle>Nouvel Événement</DialogTitle></DialogHeader>
          <EventFormFields form={createForm} onSubmit={onCreateSubmit} submitLabel="Créer" />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) setEditTarget(null); }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader><DialogTitle>Modifier l'événement</DialogTitle></DialogHeader>
          <EventFormFields form={editForm} onSubmit={onEditSubmit} submitLabel="Enregistrer" />
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader><DialogTitle>Supprimer cet événement ?</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-500">
            <strong className="text-gray-700">« {deleteTarget?.title} »</strong> sera définitivement supprimé.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Annuler</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Suppression…" : "Supprimer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
