import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  Check,
  Calendar,
  List as ListIcon,
  Clock,
  XCircle,
  AlertTriangle,
  Edit2,
  Download,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useCrm } from '../context/CrmContext';
import { useAuth } from '../hooks/useAuth';
import { useActions } from '../hooks/useActions';
import {
  ACTION_TYPES,
  type ActionStatus,
  type ActionType,
  type CrmAction,
} from '../types';
import { ActionStatusBadge, PriorityText } from '../components/ui/StatusBadge';
import { EmptyState } from '../components/ui/EmptyState';
import { ActionFormModal } from '../components/crm/ActionFormModal';
import { formatCurrency, formatDateFr } from '../utils/crmLogic';

type TimeWindowFilter = 'all' | 'late' | 'today' | 'upcoming';

export function AgendaPage() {
  const {
    authorizedEntities,
    users,
    prospects,
    contacts,
    scopedQuotes,
    scopedInvoices,
    globalSearch,
  } = useCrm();
  const { canWriteCrm } = useAuth();

  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [timeWindow, setTimeWindow] = useState<TimeWindowFilter>('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<ActionType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<ActionStatus | 'all'>('all');
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const [modalOpen, setModalOpen] = useState(false);
  const [editingAction, setEditingAction] = useState<CrmAction | null>(null);
  const [defaultModalDate, setDefaultModalDate] = useState<string | undefined>(undefined);

  const todayIso = new Date().toISOString().slice(0, 10);

  const {
    actions,
    lateCount,
    completeAction,
    rescheduleAction,
    cancelAction,
  } = useActions({
    entityId: entityFilter,
    assignedToUid: userFilter,
    type: typeFilter,
    status: statusFilter,
    search: globalSearch,
  });

  const windowedActions = useMemo(() => {
    return actions.filter((a) => {
      if (timeWindow === 'late') return a.effectiveStatus === 'late';
      if (timeWindow === 'today') return a.dueDate === todayIso;
      if (timeWindow === 'upcoming')
        return a.dueDate > todayIso && (a.effectiveStatus === 'planned' || a.effectiveStatus === 'late');
      return true;
    });
  }, [actions, timeWindow, todayIso]);

  // Intégrer les échéances de devis et factures dans le calendrier mensuel
  const deadlines = useMemo(() => {
    const items: { id: string; date: string; label: string; kind: 'quote' | 'invoice' }[] = [];
    for (const q of scopedQuotes) {
      if (q.status === 'Envoyé' && q.validUntil) {
        items.push({
          id: `dl-q-${q.id}`,
          date: q.validUntil,
          label: `Exp. devis ${q.quoteNumber} (${formatCurrency(q.total, q.currency)})`,
          kind: 'quote',
        });
      }
    }
    for (const inv of scopedInvoices) {
      if (inv.status !== 'Payée' && inv.status !== 'Annulée' && inv.dueDate) {
        items.push({
          id: `dl-i-${inv.id}`,
          date: inv.dueDate,
          label: `Éch. facture ${inv.invoiceNumber} (${formatCurrency(inv.remainingAmount, inv.currency)})`,
          kind: 'invoice',
        });
      }
    }
    return items;
  }, [scopedQuotes, scopedInvoices]);

  const calendarDays = useMemo(() => {
    const [yearStr, monthStr] = calendarMonth.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr) - 1;
    const firstDay = new Date(Date.UTC(year, month, 1));
    const lastDay = new Date(Date.UTC(year, month + 1, 0));
    const startWeekday = (firstDay.getUTCDay() + 6) % 7; // Lundi = 0
    const cells: { dateIso: string | null; dayNumber: number | null }[] = [];

    for (let i = 0; i < startWeekday; i++) {
      cells.push({ dateIso: null, dayNumber: null });
    }
    for (let d = 1; d <= lastDay.getUTCDate(); d++) {
      const iso = `${calendarMonth}-${String(d).padStart(2, '0')}`;
      cells.push({ dateIso: iso, dayNumber: d });
    }
    return cells;
  }, [calendarMonth]);

  const shiftMonth = (delta: number) => {
    const [y, m] = calendarMonth.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1 + delta, 1));
    setCalendarMonth(dt.toISOString().slice(0, 7));
  };

  const getTargetLink = (action: CrmAction) => {
    if (action.contactId) {
      const ct = contacts.find((c) => c.id === action.contactId);
      return { label: ct?.fullName || 'Contact', to: `/contacts/${action.contactId}` };
    }
    if (action.prospectId) {
      const p = prospects.find((item) => item.id === action.prospectId);
      return {
        label: p ? `${p.firstName} ${p.lastName}` : 'Prospect',
        to: `/prospects/${action.prospectId}`,
      };
    }
    return { label: 'Interne', to: '/agenda' };
  };

  const getEntityName = (id: string) =>
    authorizedEntities.find((e) => e.id === id)?.name ?? id;

  const getUserName = (uid: string) =>
    users.find((u) => u.uid === uid)?.displayName ?? 'Non assigné';

  const handleQuickReschedule = (action: CrmAction) => {
    const base = new Date(`${action.dueDate || todayIso}T12:00:00`);
    base.setDate(base.getDate() + 2);
    rescheduleAction(action.id, base.toISOString().slice(0, 10), action.dueTime || '10:00');
  };

  const handleExportIcs = () => {
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Arena Group CRM//Agenda//FR',
    ];
    for (const a of windowedActions.slice(0, 30)) {
      const dt = (a.dueDate || todayIso).replace(/-/g, '');
      const tm = (a.dueTime || '09:00').replace(':', '') + '00';
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${a.id}@arena-group-crm`);
      lines.push(`DTSTART:${dt}T${tm}`);
      lines.push(`SUMMARY:${a.type} - ${a.title}`);
      lines.push(`DESCRIPTION:${(a.description || '').replace(/\n/g, ' ')}`);
      lines.push('END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `arena-crm-agenda-${todayIso}.ics`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Agenda, Tâches & Rappels
          </h1>
          <p className="text-sm text-slate-500 mt-1 tabular-nums">
            {windowedActions.length} tâche(s) · {deadlines.length} échéance(s) devis/factures
            {lateCount > 0 && ` · ${lateCount} en retard`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportIcs}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            Export Outlook (.ics)
          </button>

          <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-1">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${
                viewMode === 'list' ? 'bg-slate-900 text-white' : 'text-slate-600'
              }`}
            >
              <ListIcon className="h-3.5 w-3.5" />
              Liste
            </button>
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${
                viewMode === 'calendar' ? 'bg-slate-900 text-white' : 'text-slate-600'
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              Calendrier
            </button>
          </div>

          {canWriteCrm && (
            <button
              type="button"
              onClick={() => {
                setEditingAction(null);
                setDefaultModalDate(undefined);
                setModalOpen(true);
              }}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#19283E] px-4 text-sm font-medium text-white hover:bg-[#223552] whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              Nouvelle tâche
            </button>
          )}
        </div>
      </div>

      {/* Fenêtres temporelles */}
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { id: 'all', label: 'Toutes' },
            { id: 'late', label: `En retard (${lateCount})` },
            { id: 'today', label: "Aujourd'hui" },
            { id: 'upcoming', label: 'À venir' },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTimeWindow(item.id)}
            className={`h-8 rounded-lg border px-3 text-xs font-medium transition-colors whitespace-nowrap ${
              timeWindow === item.id
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {lateCount > 0 && timeWindow === 'all' && (
        <div
          role="status"
          className="flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
        >
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
            <span>
              <strong>{lateCount}</strong> tâche{lateCount > 1 ? 's sont' : ' est'} en retard sur ce périmètre.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setTimeWindow('late')}
            className="text-xs font-semibold underline whitespace-nowrap"
          >
            Voir les retards
          </button>
        </div>
      )}

      {/* Filtres */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <select
          aria-label="Filtrer par entité"
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="all">Toutes les entités</option>
          {authorizedEntities.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>

        <select
          aria-label="Filtrer par collaborateur"
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="all">Tous les collaborateurs</option>
          {users.map((u) => (
            <option key={u.uid} value={u.uid}>
              {u.displayName}
            </option>
          ))}
        </select>

        <select
          aria-label="Filtrer par type"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as ActionType | 'all')}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="all">Tous les types</option>
          {ACTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <select
          aria-label="Filtrer par statut"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ActionStatus | 'all')}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="all">Tous les statuts</option>
          <option value="late">En retard</option>
          <option value="planned">Planifiées</option>
          <option value="done">Terminées</option>
          <option value="cancelled">Annulées</option>
        </select>
      </div>

      {viewMode === 'list' ? (
        windowedActions.length === 0 ? (
          <EmptyState
            icon={<Calendar className="h-6 w-6" />}
            title="Aucune tâche pour cette vue"
            description="Planifiez un appel, une relance ou un rendez-vous pour alimenter votre agenda commercial."
          />
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">Tâche / Rappel</th>
                    <th className="py-3 px-4">Contact / Prospect</th>
                    <th className="py-3 px-4">Entité</th>
                    <th className="py-3 px-4">Échéance</th>
                    <th className="py-3 px-4">Statut</th>
                    <th className="py-3 px-4">Priorité</th>
                    <th className="py-3 px-4">Assignée à</th>
                    <th className="py-3 px-4 text-right">Opérations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {windowedActions.map((action) => {
                    const target = getTargetLink(action);
                    return (
                      <tr key={action.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4">
                          <p className="font-medium text-slate-900">{action.title}</p>
                          <span className="text-xs text-slate-500">
                            {action.type}
                            {action.reminderBeforeMinutes
                              ? ` · Rappel ${action.reminderBeforeMinutes} min`
                              : ''}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <Link
                            to={target.to}
                            className="text-xs font-medium text-blue-700 hover:underline"
                          >
                            {target.label}
                          </Link>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">
                          {getEntityName(action.entityId)}
                        </td>
                        <td className="py-3 px-4 text-xs font-sans tabular-nums text-slate-700 whitespace-nowrap">
                          {formatDateFr(action.dueDate)} {action.dueTime}
                        </td>
                        <td className="py-3 px-4">
                          <ActionStatusBadge status={action.effectiveStatus} />
                        </td>
                        <td className="py-3 px-4">
                          <PriorityText priority={action.priority} />
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">
                          {getUserName(action.assignedToUid)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {canWriteCrm && (
                            <div className="inline-flex items-center justify-end gap-1">
                              {(action.effectiveStatus === 'planned' ||
                                action.effectiveStatus === 'late') && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => completeAction(action.id)}
                                    title="Marquer comme faite"
                                    className="p-1.5 rounded text-emerald-700 hover:bg-emerald-50"
                                  >
                                    <Check className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleQuickReschedule(action)}
                                    title="Reporter de 2 jours"
                                    className="p-1.5 rounded text-blue-700 hover:bg-blue-50"
                                  >
                                    <Clock className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => cancelAction(action.id)}
                                    title="Annuler"
                                    className="p-1.5 rounded text-slate-500 hover:bg-slate-100"
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingAction(action);
                                  setModalOpen(true);
                                }}
                                className="p-1.5 rounded text-slate-500 hover:bg-slate-100"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900 font-sans tabular-nums">
              Calendrier {calendarMonth}
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                aria-label="Mois précédent"
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                aria-label="Mois suivant"
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 text-xs font-semibold text-slate-500 text-center">
            <span>Lun</span>
            <span>Mar</span>
            <span>Mer</span>
            <span>Jeu</span>
            <span>Ven</span>
            <span>Sam</span>
            <span>Dim</span>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((cell, idx) => {
              if (!cell.dateIso) {
                return <div key={`empty-${idx}`} className="min-h-[92px] rounded-lg bg-slate-50/50" />;
              }
              const dayActions = windowedActions.filter((a) => a.dueDate === cell.dateIso);
              const dayDeadlines = deadlines.filter((d) => d.date === cell.dateIso);
              const isToday = cell.dateIso === todayIso;
              return (
                <div
                  key={cell.dateIso}
                  className={`min-h-[96px] rounded-lg border p-2 flex flex-col gap-1 ${
                    isToday ? 'border-blue-400 bg-blue-50/30' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-sans tabular-nums font-semibold ${
                        isToday ? 'text-blue-700' : 'text-slate-700'
                      }`}
                    >
                      {cell.dayNumber}
                    </span>
                    {canWriteCrm && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAction(null);
                          setDefaultModalDate(cell.dateIso!);
                          setModalOpen(true);
                        }}
                        title="Planifier à cette date"
                        className="text-slate-400 hover:text-blue-600"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="space-y-1 overflow-y-auto max-h-20">
                    {dayActions.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => {
                          setEditingAction(a);
                          setModalOpen(true);
                        }}
                        className={`w-full text-left truncate rounded px-1.5 py-0.5 text-[11px] font-medium ${
                          a.effectiveStatus === 'done'
                            ? 'bg-emerald-50 text-emerald-800'
                            : a.effectiveStatus === 'late'
                            ? 'bg-red-50 text-red-800'
                            : 'bg-blue-50 text-blue-800'
                        }`}
                      >
                        {a.dueTime} {a.title}
                      </button>
                    ))}
                    {dayDeadlines.map((dl) => (
                      <div
                        key={dl.id}
                        className={`truncate rounded px-1.5 py-0.5 text-[11px] font-medium ${
                          dl.kind === 'quote'
                            ? 'bg-amber-50 text-amber-800'
                            : 'bg-violet-50 text-violet-800'
                        }`}
                      >
                        {dl.label}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <ActionFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultDueDate={defaultModalDate}
        initialAction={editingAction}
      />
    </div>
  );
}
