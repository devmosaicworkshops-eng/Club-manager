import {
  useGetUsers,
  useGetSeances,
} from "@workspace/api-client-react";
import {
  useGetGalleryAdmin,
  usePostGalleryPhoto,
  useDeleteGalleryPhoto,
} from "@workspace/api-client-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Image as ImageIcon, Plus, Trash2, X, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ImageDropUploader } from "@/components/ImageDropUploader";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function AdminGalerie() {
  const { data: users } = useGetUsers();
  const { data: seances } = useGetSeances();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [filterStudent, setFilterStudent] = useState("all");
  const [filterSeance, setFilterSeance] = useState("all");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const filters = {
    studentUsername: filterStudent !== "all" ? filterStudent : undefined,
    seanceId: filterSeance !== "all" ? filterSeance : undefined,
  };

  const { data: gallery, isLoading } = useGetGalleryAdmin(filters);
  const postPhoto = usePostGalleryPhoto();
  const deletePhoto = useDeleteGalleryPhoto();

  // Upload form state
  const [objectPath, setObjectPath] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [selectedStudent, setSelectedStudent] = useState("none");
  const [selectedSeance, setSelectedSeance] = useState("none");

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!objectPath) return;

    postPhoto.mutate(
      {
        url: objectPath,
        caption: caption.trim() || undefined,
        studentUsername: selectedStudent !== "none" ? selectedStudent : undefined,
        seanceId: selectedSeance !== "none" ? selectedSeance : undefined,
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["galleryAdmin"] });
          toast({ title: "Photo ajoutée", description: selectedStudent !== "none" ? "L'élève peut maintenant la voir dans sa galerie." : "Photo publiée." });
          setObjectPath(null); setCaption(""); setSelectedStudent("none"); setSelectedSeance("none");
          setIsUploadOpen(false);
        },
        onError: () => toast({ title: "Erreur", description: "Impossible d'ajouter la photo.", variant: "destructive" }),
      }
    );
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deletePhoto.mutate({ id: deleteTarget }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["galleryAdmin"] });
        setDeleteTarget(null);
        toast({ title: "Photo supprimée" });
      },
      onError: () => toast({ title: "Erreur", variant: "destructive" }),
    });
  };

  const approvedSeances = (seances ?? []).filter((s) => s.status === "Approved");

  const selectedStudentObj = selectedStudent !== "none"
    ? (users ?? []).find((u) => u.username === selectedStudent)
    : null;

  // When a student is selected, only show séances matching their category —
  // a séance from another category can't be associated with this student.
  const assignableSeances = selectedStudentObj
    ? approvedSeances.filter(
        (s) => s.categorie?.toLowerCase() === selectedStudentObj.categorie?.toLowerCase()
      )
    : approvedSeances;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Galerie</h1>
          <p className="text-gray-500 mt-1">Assignez des photos aux élèves — ils les verront dans leur espace personnel.</p>
        </div>
        <Button onClick={() => setIsUploadOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Ajouter une photo
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={filterStudent} onValueChange={setFilterStudent}>
          <SelectTrigger className="w-52 bg-white">
            <SelectValue placeholder="Tous les élèves" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les élèves</SelectItem>
            {(users ?? []).map((u) => (
              <SelectItem key={u.username} value={u.username}>
                {u.nom} {u.prenom}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterSeance} onValueChange={setFilterSeance}>
          <SelectTrigger className="w-56 bg-white">
            <SelectValue placeholder="Toutes les séances" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les séances</SelectItem>
            {approvedSeances.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.activityType} · {format(new Date(s.date), "dd MMM", { locale: fr })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(filterStudent !== "all" || filterSeance !== "all") && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterStudent("all"); setFilterSeance("all"); }} className="gap-1 text-gray-500">
            <X className="w-3.5 h-3.5" /> Effacer les filtres
          </Button>
        )}

        <span className="text-sm text-gray-400 ml-auto">
          {(gallery ?? []).length} photo{(gallery ?? []).length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="py-20 text-center text-gray-400">Chargement…</div>
      ) : (gallery ?? []).length === 0 ? (
        <div className="py-20 text-center flex flex-col items-center gap-3 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
          <ImageIcon className="w-12 h-12 text-gray-200" />
          <p className="font-medium text-gray-500">Aucune photo</p>
          <p className="text-sm">Cliquez sur « Ajouter une photo » pour commencer.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {(gallery ?? []).map((item) => {
            const student = item.studentUsername
              ? users?.find((u) => u.username === item.studentUsername)
              : null;
            return (
              <div key={item.id} className="group relative aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
                <img
                  src={item.url}
                  alt={item.caption || "Photo galerie"}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/400x400?text=Image"; }}
                />
                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3">
                  {/* Delete button */}
                  <div className="flex justify-end">
                    <button
                      onClick={() => setDeleteTarget(item.id)}
                      className="w-7 h-7 rounded-full bg-red-600 text-white flex items-center justify-center hover:bg-red-700 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {/* Bottom info */}
                  <div>
                    {item.caption && <p className="text-white text-xs font-medium line-clamp-2 mb-1">{item.caption}</p>}
                    {student && (
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-primary/80 flex items-center justify-center text-white text-xs font-bold uppercase">
                          {student.nom.charAt(0)}
                        </div>
                        <span className="text-white text-xs">{student.nom} {student.prenom}</span>
                      </div>
                    )}
                    {!student && (
                      <span className="text-white/60 text-xs italic">Sans assignation</span>
                    )}
                    {item.uploadedAt && (
                      <p className="text-white/50 text-xs mt-1">
                        {format(new Date(item.uploadedAt), "dd MMM yyyy", { locale: fr })}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload dialog */}
      <Dialog
        open={isUploadOpen}
        onOpenChange={(o) => {
          if (!o) {
            setIsUploadOpen(false);
            setObjectPath(null);
            setCaption("");
            setSelectedStudent("none");
            setSelectedSeance("none");
          }
        }}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-4 h-4" /> Ajouter une photo
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpload} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Image <span className="text-red-500">*</span></Label>
              <ImageDropUploader
                previewUrl={objectPath ?? undefined}
                onUploaded={(path) => setObjectPath(path)}
                onClear={() => setObjectPath(null)}
              />
            </div>

            <div className="space-y-2">
              <Label>Assigner à un élève</Label>
              <Select
                value={selectedStudent}
                onValueChange={(v) => {
                  setSelectedStudent(v);
                  // A séance chosen for the previous student may not match
                  // the new student's category — clear it to avoid a mismatch.
                  setSelectedSeance("none");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un élève…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Aucun (photo générale) —</SelectItem>
                  {(users ?? []).map((u) => (
                    <SelectItem key={u.username} value={u.username}>
                      {u.nom} {u.prenom} · {u.categorie}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Séance associée <span className="text-gray-400 text-xs">(optionnel)</span></Label>
              <Select value={selectedSeance} onValueChange={setSelectedSeance}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une séance…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Aucune —</SelectItem>
                  {assignableSeances.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.activityType} · {s.categorie} · {format(new Date(s.date), "dd MMM yyyy", { locale: fr })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedStudentObj && assignableSeances.length === 0 && (
                <p className="text-xs text-gray-400">Aucune séance approuvée pour la catégorie {selectedStudentObj.categorie}.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Légende <span className="text-gray-400 text-xs">(optionnel)</span></Label>
              <Textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Décrivez ce moment…"
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsUploadOpen(false);
                  setObjectPath(null);
                  setCaption("");
                  setSelectedStudent("none");
                  setSelectedSeance("none");
                }}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={postPhoto.isPending || !objectPath}>
                {postPhoto.isPending ? "Ajout…" : "Ajouter"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>Supprimer cette photo ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500">Cette action est irréversible. L'élève ne pourra plus la voir.</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Annuler</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deletePhoto.isPending}>
              {deletePhoto.isPending ? "Suppression…" : "Supprimer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
