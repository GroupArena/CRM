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
import { formatDateFr } from '../utils/crmLogic';

export function ActionsPage() {
  const { authorizedEntities, users, prospects, globalSearch } = useCrm();
  const { canWriteCrm } = useAuth();

  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [entityFilter, setEntityFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<ActionType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<ActionStatus | 'all'>('all');
  const [dateFrom, setDateFrom] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingAction, setEditingAction] = useState<CrmAction | null>(null);

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
    dateFrom,
    search: globalSearch,
  });

  const groupedByDate = useMemo(() => {
    const map = new Map<string, typeof actions>();
    for (const action of actions) {
      const key = action.dueDate || 'Sans date';
      const list = map.get(key) ?? [];
      list.push(action);
      map.set(key, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [actions]);

  const getProspectLabel = (prospectId: string) => {
    const found = prospects.find((p) => p.id === prospectId);
    if (!found) return 'Prospect';
    return `${found.firstName} ${found.lastName}${
      found.companyName ? ` (${found.companyName})` : ''
    }`;
  };

  const getEntityName = (id: string) =>
    authorizedEntities.find((e) => e.id === id)?.name ?? id;

  const getUserName = (uid: string) =>
    users.find((u) => u.uid === uid)?.displayName ?? 'Non assigné';

  const handleQuickReschedule = (action: CrmAction) => {
    const base = new Date(`${action.dueDate || new Date().toISOString().slice(0, 10)}T12:00:00`);
    base.setDate(base.getDate() + 2);
    rescheduleAction(action.id, base.toISOString().slice(0, 10), action.dueTime || '10:00');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Actions & Tâches commerciales
          </h1>
          <p className="text-sm text-slate-500 mt-1 tabular-nums">
            {actions.length} action{actions.length > 1 ? 's' : ''} affichée
            {actions.length > 1 ? 's' : ''}
            {lateCount > 0 && ` · ${lateCount} en retard`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-1">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${
                viewMode === 'list'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ListIcon className="h-3.5 w-3.5" />
              Liste
            </button>
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${
                viewMode === 'calendar'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              Par date
            </button>
          </div>

          {canWriteCrm && (
            <button
              type="button"
              onClick={() => {
                setEditingAction(null);
                setModalOpen(true);
              }}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#19283E] px-4 text-sm font-medium text-white hover:bg-[#223552] whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              Nouvelle action
            </button>
          )}
        </div>
      </div>

      {lateCount > 0 && (
        <div
          role="status"
          className="flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
        >
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
            <span>
              <strong>{lateCount}</strong> action{lateCount > 1 ? 's sont' : ' est'} en retard sur le périmètre sélectionné.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'late' ? 'all' : 'late')}
            className="text-xs font-semibold underline whitespace-nowrap"
          >
            {statusFilter === 'late' ? 'Tout afficher' : 'Filtrer les retards'}
          </button>
        </div>
      )}

      {/* Filtres */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
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

        <input
          type="date"
          aria-label="À partir de la date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
        />
      </div>

      {actions.length === 0 ? (
        <EmptyState
          icon={<Calendar className="h-6 w-6" />}
          title="Aucune action à afficher"
          description="Planifiez un appel, une relance ou un rendez-vous pour alimenter votre suivi commercial."
        />
      ) : viewMode === 'list' ? (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Prospect</th>
                  <th className="py-3 px-4">Entité</th>
                  <th className="py-3 px-4">Échéance</th>
                  <th className="py-3 px-4">Statut</th>
                  <th className="py-3 px-4">Priorité</th>
                  <th className="py-3 px-4">Assignée à</th>
                  <th className="py-3 px-4 text-right">Opérations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {actions.map((action) => (
                  <tr key={action.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-900">{action.title}</p>
                      <span className="text-xs text-slate-500">{action.type}</span>
                    </td>
                    <td className="py-3 px-4">
                      <Link
                        to={`/prospects/${action.prospectId}`}
                        className="text-xs font-medium text-blue-700 hover:underline"
                      >
                        {getProspectLabel(action.prospectId)}
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
                                aria-label={`Marquer comme faite : ${action.title}`}
                                title="Marquer comme faite"
                                className="p-1.5 rounded text-emerald-700 hover:bg-emerald-50"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleQuickReschedule(action)}
                                aria-label={`Reporter de 2 jours : ${action.title}`}
                                title="Reporter de 2 jours"
                                className="p-1.5 rounded text-blue-700 hover:bg-blue-50"
                              >
                                <Clock className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => cancelAction(action.id)}
                                aria-label={`Annuler : ${action.title}`}
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
                            aria-label={`Modifier : ${action.title}`}
                            className="p-1.5 rounded text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {groupedByDate.map(([dateKey, dayActions]) => (
            <div key={dateKey} className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-900 pb-3 border-b border-slate-100 font-sans tabular-nums">
                {formatDateFr(dateKey)} · {dayActions.length} action
                {dayActions.length > 1 ? 's' : ''}
              </h2>
              <ul className="divide-y divide-slate-100 mt-2">
                {dayActions.map((action) => (
                  <li
                    key={action.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-sans tabular-nums text-slate-500">
                          {action.dueTime || '--:--'}
                        </span>
                        <span className="text-sm font-medium text-slate-900">
                          {action.title}
                        </span>
                        <ActionStatusBadge status={action.effectiveStatus} />
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {action.type} ·{' '}
                        <Link
                          to={`/prospects/${action.prospectId}`}
                          className="text-blue-700 hover:underline"
                        >
                          {getProspectLabel(action.prospectId)}
                        </Link>
                      </p>
                    </div>
                    {canWriteCrm &&
                      (action.effectiveStatus === 'planned' ||
                        action.effectiveStatus === 'late') && (
                        <button
                          type="button"
                          onClick={() => completeAction(action.id)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-medium text-emerald-800 hover:bg-emerald-100 self-start sm:self-center"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Terminer
                        </button>
                      )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <ActionFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialAction={editingAction}
      />
    </div>
  );
}
