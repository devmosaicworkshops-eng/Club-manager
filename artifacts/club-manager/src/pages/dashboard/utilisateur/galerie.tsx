import { useGetMyGallery } from "@workspace/api-client-react";
import { Image as ImageIcon } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useState } from "react";

export default function UserGalerie() {
  const { data: gallery, isLoading } = useGetMyGallery();
  const [lightbox, setLightbox] = useState<string | null>(null);

  const photos = gallery ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Ma Galerie</h1>
        <p className="text-gray-500 mt-1">
          {photos.length > 0
            ? `${photos.length} photo${photos.length > 1 ? "s" : ""} de tes ateliers.`
            : "Tes photos d'ateliers apparaîtront ici quand ton coach en ajoutera."}
        </p>
      </div>

      {isLoading && (
        <div className="py-20 text-center text-gray-400">Chargement…</div>
      )}

      {!isLoading && photos.length === 0 && (
        <div className="py-24 text-center flex flex-col items-center gap-3 text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl">
          <ImageIcon className="w-14 h-14 text-gray-200" />
          <p className="font-semibold text-gray-500 text-lg">Pas encore de photos</p>
          <p className="text-sm max-w-xs">Dès que ton coach publiera des photos de tes séances, tu pourras les retrouver ici.</p>
        </div>
      )}

      {!isLoading && photos.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {photos.map((item) => (
            <button
              key={item.id}
              onClick={() => setLightbox(item.url)}
              className="group relative aspect-square rounded-2xl overflow-hidden bg-gray-100 border border-gray-200 hover:shadow-lg transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <img
                src={item.url}
                alt={item.caption || "Photo atelier"}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/400x400?text=Photo"; }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                {item.caption && (
                  <p className="text-white text-sm font-medium line-clamp-2">{item.caption}</p>
                )}
                {item.uploadedAt && (
                  <p className="text-white/70 text-xs mt-1">
                    {format(new Date(item.uploadedAt), "dd MMMM yyyy", { locale: fr })}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 text-white/70 hover:text-white text-3xl leading-none"
            aria-label="Fermer"
          >
            ×
          </button>
          <img
            src={lightbox}
            alt="Photo agrandie"
            className="max-w-full max-h-full rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
