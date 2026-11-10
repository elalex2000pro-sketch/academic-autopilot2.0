"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ClassEvent } from "@/lib/types";
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react";
export function ClassCalendarTab({
  setMonth,
  month,
  monthLabel,
  setShareDatesOpen,
  WEEKDAYS,
  grid,
  localDayKey,
  eventsByDay,
  eventDate,
  setEventDate,
  editingEventId,
  eventFormRef,
  createEvent,
  eventTitle,
  setEventTitle,
  eventStart,
  setEventStart,
  eventEnd,
  setEventEnd,
  eventLocation,
  setEventLocation,
  eventDescription,
  setEventDescription,
  eventIsExam,
  setEventIsExam,
  savingEvent,
  resetEventForm,
  upcomingEvents,
  formatEventRange,
  user,
  isOwner,
  startEditEvent,
  removeEvent,
}: {
  setMonth: React.Dispatch<React.SetStateAction<Date>>;
  month: Date;
  monthLabel: string;
  setShareDatesOpen: React.Dispatch<React.SetStateAction<boolean>>;
  WEEKDAYS: string[];
  grid: (Date | null)[];
  localDayKey: (date: Date) => string;
  eventsByDay: Map<string, ClassEvent[]>;
  eventDate: string;
  setEventDate: React.Dispatch<React.SetStateAction<string>>;
  editingEventId: string | null;
  eventFormRef: React.RefObject<HTMLFormElement>;
  createEvent: (e: React.FormEvent) => Promise<void>;
  eventTitle: string;
  setEventTitle: React.Dispatch<React.SetStateAction<string>>;
  eventStart: string;
  setEventStart: React.Dispatch<React.SetStateAction<string>>;
  eventEnd: string;
  setEventEnd: React.Dispatch<React.SetStateAction<string>>;
  eventLocation: string;
  setEventLocation: React.Dispatch<React.SetStateAction<string>>;
  eventDescription: string;
  setEventDescription: React.Dispatch<React.SetStateAction<string>>;
  eventIsExam: boolean;
  setEventIsExam: React.Dispatch<React.SetStateAction<boolean>>;
  savingEvent: boolean;
  resetEventForm: () => void;
  upcomingEvents: ClassEvent[];
  formatEventRange: (event: ClassEvent) => string;
  user: import("@/lib/types").User | null;
  isOwner: boolean;
  startEditEvent: (event: ClassEvent) => void;
  removeEvent: (event: ClassEvent) => Promise<void>;
}) {
  return (
    <div className="order-4 space-y-4 xl:col-span-full xl:row-start-2">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
            }
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <CardTitle className="text-base">{monthLabel}</CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
            }
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Comparte una fecha de tu calendario personal para que la vea toda
              la clase.
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setShareDatesOpen(true)}
            >
              <CalendarPlus className="h-4 w-4" />
              Compartir fechas de mi calendario
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="pb-1 text-center text-xs text-muted-foreground"
              >
                {day}
              </div>
            ))}
            {grid.map((day, index) => {
              if (day === null) {
                return <div key={`empty-${index}`} />;
              }
              const key = localDayKey(day);
              const dayEvents = eventsByDay.get(key) ?? [];
              const isToday = localDayKey(new Date()) === key;
              const isSelected = eventDate === key;
              return (
                <button
                  key={key}
                  type="button"
                  data-touch-compact
                  onClick={() => setEventDate(key)}
                  className={`min-h-[64px] rounded-md border p-1 text-left transition-colors hover:border-primary/50 ${
                    isSelected ? "border-primary" : "border-border/50"
                  } ${isToday ? "bg-primary/5" : ""}`}
                >
                  <span
                    className={`text-xs ${
                      isToday
                        ? "font-semibold text-primary"
                        : "text-muted-foreground"
                    }`}
                  >
                    {day.getDate()}
                  </span>
                  <div className="mt-0.5 space-y-0.5">
                    {dayEvents.slice(0, 2).map((event) => (
                      <div
                        key={event.id}
                        className={`truncate rounded px-1 py-0.5 text-[10px] ${
                          event.is_exam
                            ? "bg-red-50 font-semibold text-red-600"
                            : "bg-primary/10 text-primary"
                        }`}
                      >
                        {event.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-[10px] text-muted-foreground">
                        +{dayEvents.length - 2} mas
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {editingEventId ? "Editar evento" : "Anadir evento"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              ref={eventFormRef}
              onSubmit={createEvent}
              className="space-y-3"
            >
              <div className="space-y-1">
                <Label htmlFor="event-title">Titulo</Label>
                <Input
                  id="event-title"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  placeholder="Examen de Calculo"
                  maxLength={300}
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-3 space-y-1 sm:col-span-1">
                  <Label htmlFor="event-date">Dia</Label>
                  <Input
                    id="event-date"
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="event-start">Inicio</Label>
                  <Input
                    id="event-start"
                    type="time"
                    value={eventStart}
                    onChange={(e) => setEventStart(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="event-end">Fin (opcional)</Label>
                  <Input
                    id="event-end"
                    type="time"
                    value={eventEnd}
                    onChange={(e) => setEventEnd(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="event-location">Lugar (opcional)</Label>
                <Input
                  id="event-location"
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                  placeholder="Aula 3 / Zoom"
                  maxLength={200}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="event-description">
                  Descripcion (opcional)
                </Label>
                <Input
                  id="event-description"
                  value={eventDescription}
                  onChange={(e) => setEventDescription(e.target.value)}
                  maxLength={2000}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={eventIsExam}
                  onChange={(e) => setEventIsExam(e.target.checked)}
                />
                Es un examen (se resalta en rojo para toda la clase)
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="submit"
                  size="sm"
                  disabled={!eventTitle.trim() || savingEvent}
                >
                  {savingEvent ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  {editingEventId ? "Guardar cambios" : "Crear evento"}
                </Button>
                {editingEventId && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={resetEventForm}
                  >
                    Cancelar
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Proximos eventos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcomingEvents.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No hay eventos proximos. Crea uno para que lo vea toda la clase.
              </p>
            )}
            {upcomingEvents.map((event) => (
              <div
                key={event.id}
                className={`flex items-start justify-between gap-2 rounded-md border px-3 py-2 text-sm ${
                  event.is_exam
                    ? "border-red-300 bg-red-50/70"
                    : "border-border/60"
                }`}
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate font-medium">
                    {event.is_exam && (
                      <span className="shrink-0 rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-600">
                        Examen
                      </span>
                    )}
                    <span className="truncate">{event.title}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatEventRange(event)}
                    {event.location ? ` - ${event.location}` : ""}
                  </p>
                  {event.description && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {event.description}
                    </p>
                  )}
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Creado por {event.creator_name ?? "alguien"}
                  </p>
                </div>
                {(event.created_by === user?.id || isOwner) && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => startEditEvent(event)}
                      title="Editar evento"
                      aria-label={`Editar ${event.title}`}
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-[#0066FF] dark:hover:text-[#8ab9ff]"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeEvent(event)}
                      title="Eliminar evento"
                      aria-label={`Eliminar ${event.title}`}
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-rose-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
