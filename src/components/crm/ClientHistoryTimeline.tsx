import { useMemo, useState } from 'react';
import {
  Phone,
  Mail,
  MessageSquare,
  Calendar,
  Briefcase,
  FileText,
  Receipt,
  CreditCard,
  AlertOctagon,
  History,
  Repeat,
} from 'lucide-react';
import { useCrm } from '../../context/CrmContext';
import { useAuth } from '../../hooks/useAuth';
import type { ClientHistoryCategory } from '../../types';
import { buildUnifiedClientHistory } from '../../utils/billingLogic';
import { formatCurrency, formatDateTimeFr } from '../../utils/crmLogic';

interface ClientHistoryTimelineProps {
  contactId?: string;
  companyId?: string;
}

const CATEGORY_LABELS: Record<ClientHistoryCategory, string> = {
  action: 'Actions / Appels / Emails / RDV',
  opportunity: 'Opportunités',
  quote: 'Devis',
  invoice: 'Factures',
  payment: 'Paiements',
  complaint: 'Réclamations',
  service_request: 'Demandes suppl.',
  sequence: 'Séquences',
  status_change: 'Changements de statut',
};

function CategoryIcon({ category, interactionType }: { category: ClientHistoryCategory; interactionType: string }) {
  if (interactionType === 'Appel') return <Phone className="h-4 w-4 text-blue-600" />;
  if (interactionType === 'Email') return <Mail className="h-4 w-4 text-indigo-600" />;
  if (interactionType === 'Message WhatsApp') return <MessageSquare className="h-4 w-4 text-emerald-600" />;
  switch (category) {
    case 'opportunity':
      return <Briefcase className="h-4 w-4 text-violet-600" />;
    case 'quote':
      return <FileText className="h-4 w-4 text-blue-700" />;
    case 'invoice':
      return <Receipt className="h-4 w-4 text-amber-700" />;
    case 'payment':
      return <CreditCard className="h-4 w-4 text-emerald-700" />;
    case 'complaint':
      return <AlertOctagon className="h-4 w-4 text-red-600" />;
    case 'sequence':
      return <Repeat className="h-4 w-4 text-teal-600" />;
    case 'status_change':
      return <History className="h-4 w-4 text-slate-500" />;
    default:
      return <Calendar className="h-4 w-4 text-slate-600" />;
  }
}

export function ClientHistoryTimeline({ contactId, companyId }: ClientHistoryTimelineProps) {
  const {
    entities,
    authorizedEntities,
    users,
    actions,
    deals,
    quotes,
    invoices,
    payments,
    complaints,
    serviceRequests,
    sequenceEnrollments,
    auditLogs,
    prospects,
  } = useCrm();
  const { canViewAllEntities } = useAuth();

  const [entityFilter, setEntityFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<'all' | ClientHistoryCategory>('all');
  const [userFilter, setUserFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');

  const allowedIds = useMemo(
    () => (canViewAllEntities ? null : new Set(authorizedEntities.map((e) => e.id))),
    [canViewAllEntities, authorizedEntities]
  );

  const rawEntries = useMemo(
    () =>
      buildUnifiedClientHistory({
        contactId,
        companyId,
        actions,
        opportunities: deals,
        quotes,
        invoices,
        payments,
        complaints,
        serviceRequests,
        enrollments: sequenceEnrollments,
        auditLogs,
        prospects,
        allowedEntityIds: allowedIds,
      }),
    [
      contactId,
      companyId,
      actions,
      deals,
      quotes,
      invoices,
      payments,
      complaints,
      serviceRequests,
      sequenceEnrollments,
      auditLogs,
      prospects,
      allowedIds,
    ]
  );

  const distinctStatuses = useMemo(
    () => Array.from(new Set(rawEntries.map((e) => e.status).filter(Boolean))),
    [rawEntries]
  );

  const filteredEntries = useMemo(() => {
    return rawEntries.filter((entry) => {
      if (entityFilter !== 'all' && entry.entityId !== entityFilter) return false;
      if (typeFilter !== 'all' && entry.category !== typeFilter) return false;
      if (userFilter !== 'all' && entry.userUid !== userFilter) return false;
      if (statusFilter !== 'all' && entry.status !== statusFilter) return false;
      if (dateFrom && entry.date.slice(0, 10) < dateFrom) return false;
      return true;
    });
  }, [rawEntries, entityFilter, typeFilter, userFilter, statusFilter, dateFrom]);

  const getEntityName = (id: string) =>
    entities.find((e) => e.id === id)?.name ?? (id === 'group' ? 'Arena Group' : id);

  const getUserName = (uid: string) =>
    users.find((u) => u.uid === uid)?.displayName ?? '';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
        <select
          aria-label="Filtrer historique par entité"
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-700"
        >
          <option value="all">Toutes les entités autorisées</option>
          {authorizedEntities.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>

        <select
          aria-label="Filtrer historique par type d'interaction"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as 'all' | ClientHistoryCategory)}
          className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-700"
        >
          <option value="all">Tous types d’interaction</option>
          {(Object.keys(CATEGORY_LABELS) as ClientHistoryCategory[]).map((k) => (
            <option key={k} value={k}>
              {CATEGORY_LABELS[k]}
            </option>
          ))}
        </select>

        <select
          aria-label="Filtrer historique par utilisateur"
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-700"
        >
          <option value="all">Tous les utilisateurs</option>
          {users.map((u) => (
            <option key={u.uid} value={u.uid}>
              {u.displayName}
            </option>
          ))}
        </select>

        <select
          aria-label="Filtrer historique par statut"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-700"
        >
          <option value="all">Tous les statuts</option>
          {distinctStatuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <input
          type="date"
          aria-label="Historique depuis le"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-700"
        />
      </div>

      {filteredEntries.length === 0 ? (
        <p className="text-sm text-slate-500 py-8 text-center">
          Aucun événement dans l’historique pour ces critères.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {filteredEntries.map((entry) => (
            <li key={entry.id} className="py-3.5 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
                  <CategoryIcon category={entry.category} interactionType={entry.interactionType} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-slate-700">
                      {entry.interactionType}
                    </span>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-xs font-medium text-blue-700">
                      {getEntityName(entry.entityId)}
                    </span>
                    {entry.status && (
                      <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] font-medium text-slate-700">
                        {entry.status}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-slate-900 mt-0.5">
                    {entry.title}
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">{entry.description}</p>
                  <p className="text-[11px] text-slate-400 font-sans tabular-nums mt-1">
                    {formatDateTimeFr(entry.date)}
                    {getUserName(entry.userUid) ? ` · ${getUserName(entry.userUid)}` : ''}
                  </p>
                </div>
              </div>
              {entry.amount !== undefined && (
                <span className="text-sm font-sans tabular-nums font-semibold text-slate-900 shrink-0">
                  {formatCurrency(entry.amount, entry.currency || 'MGA')}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
