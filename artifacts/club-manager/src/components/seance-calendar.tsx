import { useMemo, useState, type ReactNode } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export type CalendarSeance = {
  id: string;
  date: string;
};

type SeanceCalendarProps<T extends CalendarSeance> = {
  seances: T[];
  onDayClick?: (day: Date, seances: T[]) => void;
  renderDayBadge?: (seance: T) => ReactNode;
  emptyHint?: string;
};

/** Shared month-grid calendar. Groups the given séances by day and lets the
 * caller render a small badge per séance plus handle day clicks. Used by both
 * the admin scheduling view and the read-only user "emploi du temps" view. */
export function SeanceCalendar<T extends CalendarSeance>({
  seances,
  onDayClick,
  renderDayBadge,
  emptyHint,
}: SeanceCalendarProps<T>) {
  const [month, setMonth] = useState(() => new Date());

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const byDay = useMemo(() => {
    const map = new Map<string, T[]>();
    for (const s of seances) {
      if (!s.date) continue;
      const key = format(new Date(s.date), "yyyy-MM-dd");
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }
    return map;
  }, [seances]);

  const weekLabels = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900 capitalize">
          {format(month, "MMMM yyyy", { locale: fr })}
        </h2>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMonth((m) => subMonths(m, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={() => setMonth(new Date())}>
            Aujourd'hui
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMonth((m) => addMonths(m, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50">
        {weekLabels.map((d) => (
          <div key={d} className="px-2 py-2 text-center text-xs font-medium text-gray-500">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const daySeances = byDay.get(key) ?? [];
          const inMonth = isSameMonth(day, month);
          return (
            <button
              key={key}
              onClick={() => onDayClick?.(day, daySeances)}
              disabled={!onDayClick}
              className={`min-h-[6.5rem] border-b border-r border-gray-100 p-1.5 text-left align-top flex flex-col gap-1 transition-colors ${
                inMonth ? "bg-white" : "bg-gray-50/60"
              } ${onDayClick ? "hover:bg-primary/5 cursor-pointer" : "cursor-default"}`}
            >
              <span
                className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                  isToday(day)
                    ? "bg-primary text-primary-foreground"
                    : inMonth
                    ? "text-gray-700"
                    : "text-gray-400"
                }`}
              >
                {format(day, "d")}
              </span>
              <div className="flex flex-col gap-0.5 overflow-hidden">
                {daySeances.slice(0, 4).map((s) => (
                  <div key={s.id}>{renderDayBadge ? renderDayBadge(s) : null}</div>
                ))}
                {daySeances.length > 4 && (
                  <span className="text-[10px] text-gray-400 px-1">+{daySeances.length - 4} autres</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {seances.length === 0 && emptyHint && (
        <div className="px-5 py-6 text-center text-sm text-gray-500 border-t border-gray-100">{emptyHint}</div>
      )}
    </div>
  );
}
