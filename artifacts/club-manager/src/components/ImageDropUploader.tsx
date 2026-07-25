import { useCallback, useRef, useState } from "react";
import { UploadCloud, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Drag-and-drop / browse image uploader.
 * POSTs the file as multipart/form-data to the API upload proxy,
 * which handles the GCS signed-URL PUT server-side (avoids CORS issues).
 * Reports the normalized object path back via onUploaded.
 */
export function ImageDropUploader({
  onUploaded,
  previewUrl,
  onClear,
}: {
  onUploaded: (objectPath: string) => void;
  previewUrl?: string;
  onClear?: () => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        setError("Merci de choisir un fichier image.");
        return;
      }
      setError(null);
      setIsUploading(true);
      try {
        const token = localStorage.getItem("token");
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/storage/uploads", {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error ?? `HTTP ${res.status}`);
        }

        const { objectPath } = await res.json();
        onUploaded(objectPath);
      } catch (err: any) {
        setError("Échec de l'envoi. Réessayez.");
        console.error("Upload error:", err);
      } finally {
        setIsUploading(false);
      }
    },
    [onUploaded]
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  if (previewUrl) {
    return (
      <div className="relative rounded-lg overflow-hidden aspect-video bg-gray-100 border border-gray-200 group">
        <img src={previewUrl} alt="Aperçu" className="w-full h-full object-cover" />
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed aspect-video cursor-pointer transition-colors",
          isDragging ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300 bg-gray-50"
        )}
      >
        {isUploading ? (
          <>
            <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
            <p className="text-sm text-gray-500">Envoi en cours…</p>
          </>
        ) : (
          <>
            <UploadCloud className="w-6 h-6 text-gray-400" />
            <p className="text-sm text-gray-500 text-center px-4">
              Glissez une image ici ou <span className="text-primary font-medium">parcourez</span>
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
