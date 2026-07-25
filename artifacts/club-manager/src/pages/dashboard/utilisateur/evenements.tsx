import { useGetEvents } from "@workspace/api-client-react";
import { Calendar as CalIcon, MapPin } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function UserEvenements() {
  const { data: events } = useGetEvents();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Événements à venir</h1>
        <p className="text-gray-500 mt-1">Participez à nos événements, compétitions et journées portes ouvertes.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {events?.map(event => (
          <div key={event.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col sm:flex-row">
            <div className="sm:w-1/3 h-48 sm:h-auto bg-gray-100 relative shrink-0">
              {event.imageUrl ? (
                <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <CalIcon className="w-12 h-12 text-primary/30" />
                </div>
              )}
            </div>
            <div className="p-5 flex-1 flex flex-col">
              <h3 className="font-bold text-lg text-gray-900 line-clamp-2">{event.title}</h3>
              
              <div className="mt-3 space-y-1.5 text-sm text-gray-600 mb-4">
                <div className="flex items-center gap-2">
                  <CalIcon className="w-4 h-4 text-primary shrink-0" />
                  <span>{format(new Date(event.date), 'dd MMMM yyyy à HH:mm', { locale: fr })}</span>
                </div>
                {event.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary shrink-0" />
                    <span>{event.location}</span>
                  </div>
                )}
              </div>
              
              {event.description && (
                <p className="text-sm text-gray-500 line-clamp-3 mt-auto">{event.description}</p>
              )}
            </div>
          </div>
        ))}
        {events?.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-500 bg-white rounded-xl border border-dashed border-gray-300">
            Aucun événement prévu.
          </div>
        )}
      </div>
    </div>
  );
}
