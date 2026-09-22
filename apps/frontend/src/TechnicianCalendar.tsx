import { useState, useEffect, useMemo } from 'react';
import { evaluationsService } from './services';
import type { EvaluationListItem } from '@reto/shared';
import './TechnicianCalendar.css';

interface TechnicianCalendarProps {
  onOpenField?: (evaluationId: number) => void;
  notify?: (message: string) => void;
}

type CalendarView = 'month' | 'week' | 'day';

interface CalendarEvent {
  evaluationId: number;
  scheduledDate: Date;
  status: string;
  priority?: string;
  reason?: string;
  observations?: string;
  institutionName: string;
  address?: string;
}

export default function TechnicianCalendar({ onOpenField, notify }: TechnicianCalendarProps) {
  // Fecha ancla del calendario (por defecto Septiembre 2026 o fecha actual)
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date('2026-09-21T09:00:00.000Z'));
  const [view, setView] = useState<CalendarView>('month');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // Carga de datos combinada (Calendario + Lista detallada)
  const loadCalendarData = async () => {
    setLoading(true);
    try {
      // Calcular rango según la vista o mes
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();

      const startOfMonth = new Date(year, month, 1);
      const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

      // 1. Llamar endpoint oficial de calendario (RF-11)
      const calPromise = evaluationsService.getCalendar({
        from: startOfMonth.toISOString(),
        to: endOfMonth.toISOString(),
        view: 'month',
      });

      // 2. Llamar endpoint de lista para enriquecer nombres y direcciones
      const listPromise = evaluationsService.list({ page: 1, pageSize: 100 });

      const [calRes, listRes] = await Promise.all([calPromise, listPromise]);

      const detailedMap = new Map<number, EvaluationListItem>();
      if (listRes.valid && listRes.data?.items) {
        listRes.data.items.forEach((item) => {
          detailedMap.set(item.evaluationId, item);
        });
      }

      const mergedEvents: CalendarEvent[] = [];

      // Si el calendario responde, mapeamos
      if (calRes.valid && Array.isArray(calRes.data)) {
        calRes.data.forEach((calItem) => {
          const detail = detailedMap.get(calItem.evaluationId);
          mergedEvents.push({
            evaluationId: calItem.evaluationId,
            scheduledDate: new Date(calItem.scheduledDate),
            status: calItem.status,
            priority: detail?.priority ?? 'MEDIUM',
            reason: detail?.reason ?? 'GMP Hygienic-Sanitary Inspection',
            observations: detail?.observations ?? 'Coordinate entry with plant manager.',
            institutionName: detail?.institution?.name ?? `Establishment #${calItem.institutionId ?? calItem.evaluationId}`,
            address: detail?.institution?.streetName ?? 'Dominican Republic',
          });
        });
      } else if (listRes.valid && listRes.data?.items) {
        // Fallback enriquecido desde el listado
        listRes.data.items.forEach((item) => {
          mergedEvents.push({
            evaluationId: item.evaluationId,
            scheduledDate: new Date(item.scheduledDate),
            status: item.status,
            priority: item.priority ?? 'MEDIUM',
            reason: item.reason ?? 'GMP Sanitary Inspection',
            observations: item.observations ?? '',
            institutionName: item.institution?.name ?? `Establishment #${item.institutionId}`,
            address: item.institution?.streetName ?? 'Dominican Republic',
          });
        });
      }

      setEvents(mergedEvents);
    } catch (err: unknown) {
      console.error('Error al cargar calendario de evaluaciones:', err);
      notify?.('Could not synchronize the calendar with the server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCalendarData();
  }, [currentDate.getFullYear(), currentDate.getMonth()]);

  // Controles de Navegación
  const handlePrev = () => {
    if (view === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    } else if (view === 'week') {
      const next = new Date(currentDate);
      next.setDate(next.getDate() - 7);
      setCurrentDate(next);
    } else {
      const next = new Date(currentDate);
      next.setDate(next.getDate() - 1);
      setCurrentDate(next);
    }
  };

  const handleNext = () => {
    if (view === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    } else if (view === 'week') {
      const next = new Date(currentDate);
      next.setDate(next.getDate() + 7);
      setCurrentDate(next);
    } else {
      const next = new Date(currentDate);
      next.setDate(next.getDate() + 1);
      setCurrentDate(next);
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date('2026-09-21T09:00:00.000Z'));
  };

  // Etiqueta del Mes y Año
  const formattedMonth = useMemo(() => {
    return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(currentDate);
  }, [currentDate]);

  // Cálculo de Días para la Grilla Mensual
  const monthDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Domingo
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells: { date: Date; isCurrentMonth: boolean; dayNumber: number }[] = [];

    // Días del mes previo
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      cells.push({
        date: new Date(year, month - 1, daysInPrevMonth - i),
        isCurrentMonth: false,
        dayNumber: daysInPrevMonth - i,
      });
    }

    // Días del mes actual
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push({
        date: new Date(year, month, day),
        isCurrentMonth: true,
        dayNumber: day,
      });
    }

    // Días del mes siguiente para completar múltiplos de 7
    const remaining = 7 - (cells.length % 7);
    if (remaining < 7) {
      for (let day = 1; day <= remaining; day++) {
        cells.push({
          date: new Date(year, month + 1, day),
          isCurrentMonth: false,
          dayNumber: day,
        });
      }
    }

    return cells;
  }, [currentDate]);

  // Eventos filtrados por fecha
  const getEventsForDate = (targetDate: Date) => {
    return events.filter((ev) => {
      return (
        ev.scheduledDate.getFullYear() === targetDate.getFullYear() &&
        ev.scheduledDate.getMonth() === targetDate.getMonth() &&
        ev.scheduledDate.getDate() === targetDate.getDate()
      );
    });
  };

  // Cías de la Semana activa (para Vista Semanal)
  const weekDays = useMemo(() => {
    const startOfWeek = new Date(currentDate);
    const day = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - day); // Inicio en Domingo

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [currentDate]);

  // Día activo para Vista Diaria
  const activeDayEvents = useMemo(() => {
    return getEventsForDate(currentDate);
  }, [currentDate, events]);

  return (
    <section className="tc-container">
      {/* Cabecera */}
      <div className="tc-header">
        <div className="tc-title-area">
          <small className="eyebrow" style={{ color: '#00236f', fontWeight: 700, textTransform: 'uppercase' }}>
            Sanitary Surveillance • RF-11
          </small>
          <h1>Schedule and Evaluation Calendar</h1>
          <p>Planning of field visits, assigned inspections, and GMP status tracking.</p>
        </div>

        {/* Leyenda Semántica */}
        <div className="tc-legend">
          <div className="tc-legend-item">
            <span className="tc-legend-dot programada" />
            <span>Scheduled</span>
          </div>
          <div className="tc-legend-item">
            <span className="tc-legend-dot reprogramada" />
            <span>Rescheduled</span>
          </div>
          <div className="tc-legend-item">
            <span className="tc-legend-dot finalizada" />
            <span>Completed</span>
          </div>
          <div className="tc-legend-item">
            <span className="tc-legend-dot cancelada" />
            <span>Canceled</span>
          </div>
        </div>
      </div>

      {/* Barra de Herramientas de Navegación */}
      <div className="tc-toolbar">
        <div className="tc-nav-group">
          <button className="tc-btn-nav" onClick={handleToday}>
            Today
          </button>
          <button className="tc-btn-nav" onClick={handlePrev} title="Previous">
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>chevron_left</span>
          </button>
          <span className="tc-month-label">{formattedMonth}</span>
          <button className="tc-btn-nav" onClick={handleNext} title="Next">
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>chevron_right</span>
          </button>
        </div>

        {/* Selector de Vista (Mes / Semana / Día) */}
        <div className="tc-view-selector">
          <button
            className={`tc-view-btn ${view === 'month' ? 'active' : ''}`}
            onClick={() => setView('month')}
          >
            Month
          </button>
          <button
            className={`tc-view-btn ${view === 'week' ? 'active' : ''}`}
            onClick={() => setView('week')}
          >
            Week
          </button>
          <button
            className={`tc-view-btn ${view === 'day' ? 'active' : ''}`}
            onClick={() => setView('day')}
          >
            Day
          </button>
        </div>
      </div>

      {/* Contenedor del Calendario */}
      <div className="tc-calendar-card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#535f73' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '2rem', animation: 'spin 1s infinite linear' }}>
              sync
            </span>
            <p>Synchronizing schedule with backend...</p>
          </div>
        ) : view === 'month' ? (
          <>
            {/* Cabecera de días de la semana */}
            <div className="tc-weekdays-header">
              <div>Sun</div>
              <div>Mon</div>
              <div>Tue</div>
              <div>Wed</div>
              <div>Thu</div>
              <div>Fri</div>
              <div>Sat</div>
            </div>

            {/* Grilla Mensual */}
            <div className="tc-month-grid">
              {monthDays.map((cell, idx) => {
                const dayEvents = getEventsForDate(cell.date);
                const isToday =
                  cell.date.toDateString() === new Date('2026-09-21T09:00:00.000Z').toDateString();

                return (
                  <div
                    key={idx}
                    className={`tc-day-cell ${cell.isCurrentMonth ? '' : 'other-month'} ${isToday ? 'today' : ''}`}
                    onClick={() => {
                      setCurrentDate(cell.date);
                      if (dayEvents.length === 1) {
                        setSelectedEvent(dayEvents[0]);
                      }
                    }}
                  >
                    <div className="tc-day-header">
                      <span className="tc-day-number">{cell.dayNumber}</span>
                      {dayEvents.length > 0 && (
                        <span className="tc-day-count-badge">{dayEvents.length}</span>
                      )}
                    </div>

                    <div className="tc-events-list">
                      {dayEvents.map((ev) => {
                        const timeString = ev.scheduledDate.toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                        });

                        return (
                          <button
                            key={ev.evaluationId}
                            className={`tc-event-pill status-${ev.status}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEvent(ev);
                            }}
                            title={`#${ev.evaluationId}: ${ev.institutionName} (${ev.status})`}
                          >
                            <span className="tc-event-time">{timeString}</span>
                            <span className="tc-event-title">{ev.institutionName}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : view === 'week' ? (
          /* Vista Semanal */
          <div className="tc-week-grid">
            {weekDays.map((dayDate, idx) => {
              const dayEvents = getEventsForDate(dayDate);
              const isToday = dayDate.toDateString() === new Date('2026-09-21T09:00:00.000Z').toDateString();
              const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(dayDate);

              return (
                <div key={idx} className={`tc-week-col ${isToday ? 'today' : ''}`}>
                  <div className="tc-week-col-header">
                    <span className="tc-week-col-day">{dayName}</span>
                    <span className="tc-week-col-date">{dayDate.getDate()}</span>
                  </div>

                  <div className="tc-events-list">
                    {dayEvents.map((ev) => (
                      <button
                        key={ev.evaluationId}
                        className={`tc-event-pill status-${ev.status}`}
                        onClick={() => setSelectedEvent(ev)}
                      >
                        <span className="tc-event-time">
                          {ev.scheduledDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="tc-event-title">{ev.institutionName}</span>
                      </button>
                    ))}
                    {dayEvents.length === 0 && (
                      <span style={{ fontSize: '0.75rem', color: '#a0aec0', textAlign: 'center', marginTop: '1rem' }}>
                        No appointments
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Vista Diaria */
          <div className="tc-day-view-container">
            <h2 style={{ fontSize: '1.2rem', color: '#00236f', margin: '0 0 0.5rem 0' }}>
              Schedule for {new Intl.DateTimeFormat('en-US', { dateStyle: 'full' }).format(currentDate)}
            </h2>

            {activeDayEvents.length === 0 ? (
              <p style={{ color: '#535f73' }}>No evaluations scheduled for this day.</p>
            ) : (
              activeDayEvents.map((ev) => (
                <div key={ev.evaluationId} className="tc-day-agenda-item">
                  <div className="tc-day-agenda-time">
                    {ev.scheduledDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="tc-day-agenda-info">
                    <h3>{ev.institutionName}</h3>
                    <p>
                      <strong>Reason:</strong> {ev.reason} • <strong>Status:</strong> {ev.status} •{' '}
                      <strong>Priority:</strong> {ev.priority}
                    </p>
                    <p style={{ fontSize: '0.8rem', color: '#718096', marginTop: '0.2rem' }}>
                      📍 {ev.address}
                    </p>
                  </div>
                  <button
                    className="tc-btn-open-field"
                    onClick={() => {
                      if (onOpenField) onOpenField(ev.evaluationId);
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>play_circle</span>
                    Evaluate
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Modal Drawer de Detalle de Cita */}
      {selectedEvent && (
        <div className="tc-modal-backdrop" onClick={() => setSelectedEvent(null)}>
          <div className="tc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tc-modal-header">
              <div>
                <h2>{selectedEvent.institutionName}</h2>
                <p>Scheduled Official Inspection • No. #{selectedEvent.evaluationId}</p>
              </div>
              <button className="tc-modal-close" onClick={() => setSelectedEvent(null)}>
                &times;
              </button>
            </div>

            <div className="tc-modal-body">
              <div className="tc-detail-grid">
                <div className="tc-detail-item">
                  <label>Date and Time</label>
                  <span>
                    {selectedEvent.scheduledDate.toLocaleDateString('en-US', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'long',
                    })}{' '}
                    at{' '}
                    {selectedEvent.scheduledDate.toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                <div className="tc-detail-item">
                  <label>Status</label>
                  <span style={{ fontWeight: 800 }}>{selectedEvent.status}</span>
                </div>

                <div className="tc-detail-item">
                  <label>Priority</label>
                  <span>{selectedEvent.priority ?? 'MEDIUM'}</span>
                </div>

                <div className="tc-detail-item">
                  <label>Location</label>
                  <span>{selectedEvent.address ?? 'Dominican Republic'}</span>
                </div>
              </div>

              <div className="tc-detail-item">
                <label>Evaluation Reason</label>
                <span>{selectedEvent.reason}</span>
              </div>

              {selectedEvent.observations && (
                <div className="tc-detail-item">
                  <label>Coordination Instructions</label>
                  <span style={{ color: '#535f73', fontStyle: 'italic' }}>
                    "{selectedEvent.observations}"
                  </span>
                </div>
              )}
            </div>

            <div className="tc-modal-footer">
              <button
                type="button"
                className="tc-btn-nav"
                onClick={() => setSelectedEvent(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="tc-btn-open-field"
                onClick={() => {
                  const evalId = selectedEvent.evaluationId;
                  setSelectedEvent(null);
                  if (onOpenField) onOpenField(evalId);
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>checklist</span>
                ⚡ Open Field Form
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
