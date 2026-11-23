import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  Search,
  LayoutGrid,
  Table as TableIcon,
  Archive,
  Trash2,
  Edit2,
  Users,
  ChevronLeft,
  ChevronRight,
  Repeat,
  Play,
  CheckCircle2,
  ArrowRightCircle,
} from 'lucide-react';
import { useCrm } from '../context/CrmContext';
import { useAuth } from '../hooks/useAuth';
import { useProspects, type ProspectFilterOptions } from '../hooks/useProspects';
import {
  ENROLLMENT_STATUS_LABELS,
  LEAD_STATUSES,
  PRIORITY_LABELS,
  PROSPECT_STATUSES,
  SEQUENCE_CHANNEL_LABELS,
  type LeadStatus,
  type PriorityLevel,
  type Prospect,
  type ProspectStatus,
  type SequenceChannel,
} from '../types';
import {
  LeadStatusBadge,
  PriorityText,
  ProspectStatusBadge,
} from '../components/ui/StatusBadge';
import { EmptyState } from '../components/ui/EmptyState';
import { ProspectFormModal } from '../components/crm/ProspectFormModal';
import { Modal } from '../components/ui/Modal';
import { formatCurrency, formatDateFr } from '../utils/crmLogic';
import { computeSequenceMetrics } from '../utils/billingLogic';

const PAGE_SIZE = 8;
type ProspectsTab = 'prospects' | 'leads' | 'sequences';

export function ProspectsPage() {
  const {
    entities,
    authorizedEntities,
    selectedEntityId,
    users,
    tags,
    contacts,
    companies,
    scopedLeads,
    scopedSequences,
    sequenceSteps,
    scopedEnrollments,
    globalSearch,
    setGlobalSearch,
    settings,
    createLead,
    updateLead,
    convertLeadToOpportunity,
    createSequence,
    saveSequenceStep,
    enrollLeadInSequence,
    advanceSequenceStep,
  } = useCrm();
  const { canWriteCrm, canEditProspect, canDeleteProspect, user } = useAuth();

  const [activeTab, setActiveTab] = useState<ProspectsTab>('prospects');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>(
    settings.defaultProspectView || 'table'
  );
  const [entityFilter, setEntityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<ProspectStatus | 'all'>('all');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityLevel | 'all'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [sortBy, setSortBy] = useState<ProspectFilterOptions['sortBy']>('updatedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProspect, setEditingProspect] = useState<Prospect | null>(null);

  // Leads state
  const [leadStatusFilter, setLeadStatusFilter] = useState<LeadStatus | 'all'>('all');
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [leadContactId, setLeadContactId] = useState('');
  const [leadEntityId, setLeadEntityId] = useState(
    selectedEntityId !== 'all' ? selectedEntityId : authorizedEntities[0]?.id ?? 'arena-business-center'
  );
  const [leadSource, setLeadSource] = useState('Site web');
  const [leadPriority, setLeadPriority] = useState<PriorityLevel>('medium');
  const [leadValue, setLeadValue] = useState('4500');
  const [leadNotes, setLeadNotes] = useState('');

  // Sequences state
  const [enrollModalLeadId, setEnrollModalLeadId] = useState<string | null>(null);
  const [selectedSeqId, setSelectedSeqId] = useState('');
  const [seqModalOpen, setSeqModalOpen] = useState(false);
  const [seqName, setSeqName] = useState('');
  const [seqEntityId, setSeqEntityId] = useState(
    selectedEntityId !== 'all' ? selectedEntityId : authorizedEntities[0]?.id ?? 'arena-business-center'
  );
  const [seqDesc, setSeqDesc] = useState('');
  const [stepModalSeqId, setStepModalSeqId] = useState<string | null>(null);
  const [stepChannel, setStepChannel] = useState<SequenceChannel>('call');
  const [stepDelayDays, setStepDelayDays] = useState('2');
  const [stepTitle, setStepTitle] = useState('');
  const [stepDesc, setStepDesc] = useState('');

  const { prospects, archiveProspect, deleteProspect } = useProspects({
    search: globalSearch,
    entityId: entityFilter,
    status: statusFilter,
    ownerUid: ownerFilter,
    tag: tagFilter,
    priority: priorityFilter,
    dateFrom,
    includeArchived,
    sortBy,
    sortDir,
  });

  const totalPages = Math.max(1, Math.ceil(prospects.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedProspects = prospects.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  const filteredLeads = useMemo(() => {
    return scopedLeads.filter((l) => {
      if (leadStatusFilter !== 'all' && l.status !== leadStatusFilter) return false;
      return true;
    });
  }, [scopedLeads, leadStatusFilter]);

  const seqMetrics = useMemo(
    () => computeSequenceMetrics(scopedEnrollments, sequenceSteps),
    [scopedEnrollments, sequenceSteps]
  );

  const getEntityName = (id: string) => entities.find((e) => e.id === id)?.name ?? id;
  const getOwnerName = (uid: string) => users.find((u) => u.uid === uid)?.displayName ?? 'Non assigné';
  const getContactName = (cid: string) => contacts.find((c) => c.id === cid)?.fullName ?? 'Contact';
  const getCompanyName = (coid: string) => companies.find((c) => c.id === coid)?.legalName ?? '';

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetContactId = leadContactId || contacts[0]?.id || '';
    if (!targetContactId) return;
    const ct = contacts.find((c) => c.id === targetContactId);
    await createLead({
      contactId: targetContactId,
      companyId: ct?.companyId ?? '',
      entityId: leadEntityId,
      source: leadSource.trim() || 'Direct',
      status: 'Nouveau',
      assignedToUid: user?.uid ?? '',
      priority: leadPriority,
      estimatedValue: Number(leadValue) || 0,
      lastContactAt: new Date().toISOString(),
      nextFollowUpDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
      nextFollowUpChannel: 'call',
      notes: leadNotes.trim(),
    });
    setLeadNotes('');
    setLeadModalOpen(false);
  };

  const handleCreateSequence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!seqName.trim()) return;
    const created = await createSequence({
      name: seqName.trim(),
      entityId: seqEntityId,
      description: seqDesc.trim(),
      active: true,
    });
    await saveSequenceStep(
      {
        id: `step-${Date.now()}`,
        sequenceId: created.id,
        entityId: created.entityId,
        order: 0,
        channel: 'call',
        delayDays: 0,
        title: 'Premier appel de qualification',
        description: 'Contacter le lead et qualifier le besoin.',
      },
      true
    );
    setSeqName('');
    setSeqDesc('');
    setSeqModalOpen(false);
  };

  const handleAddStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stepModalSeqId || !stepTitle.trim()) return;
    const seq = scopedSequences.find((s) => s.id === stepModalSeqId);
    const existingSteps = sequenceSteps.filter((s) => s.sequenceId === stepModalSeqId);
    await saveSequenceStep(
      {
        id: `step-${Date.now()}`,
        sequenceId: stepModalSeqId,
        entityId: seq?.entityId ?? leadEntityId,
        order: existingSteps.length,
        channel: stepChannel,
        delayDays: Math.max(0, Number(stepDelayDays) || 0),
        title: stepTitle.trim(),
        description: stepDesc.trim(),
      },
      true
    );
    setStepTitle('');
    setStepDesc('');
    setStepModalSeqId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Prospection & Séquences
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Base prospects, qualification des leads et séquences de relance multi-canal.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {activeTab === 'prospects' && (
            <>
              <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-1">
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${
                    viewMode === 'table' ? 'bg-slate-900 text-white' : 'text-slate-600'
                  }`}
                >
                  <TableIcon className="h-3.5 w-3.5" />
                  Tableau
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${
                    viewMode === 'cards' ? 'bg-slate-900 text-white' : 'text-slate-600'
                  }`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Cartes
                </button>
              </div>
              {canWriteCrm && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingProspect(null);
                    setModalOpen(true);
                  }}
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#19283E] px-4 text-sm font-medium text-white hover:bg-[#223552] whitespace-nowrap"
                >
                  <Plus className="h-4 w-4" />
                  Nouveau prospect
                </button>
              )}
            </>
          )}

          {activeTab === 'leads' && canWriteCrm && (
            <button
              type="button"
              onClick={() => {
                setLeadContactId(contacts[0]?.id ?? '');
                setLeadModalOpen(true);
              }}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#19283E] px-4 text-sm font-medium text-white hover:bg-[#223552] whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              Nouveau lead
            </button>
          )}

          {activeTab === 'sequences' && canWriteCrm && (
            <button
              type="button"
              onClick={() => setSeqModalOpen(true)}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#19283E] px-4 text-sm font-medium text-white hover:bg-[#223552] whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              Nouvelle séquence
            </button>
          )}
        </div>
      </div>

      {/* Onglets */}
      <div className="border-b border-slate-200 flex items-center gap-1 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('prospects')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap ${
            activeTab === 'prospects'
              ? 'border-[#C9A125] text-[#19283E] font-semibold'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          Base Prospects ({prospects.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('leads')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap ${
            activeTab === 'leads'
              ? 'border-[#C9A125] text-[#19283E] font-semibold'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          Leads & Qualification ({scopedLeads.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('sequences')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap ${
            activeTab === 'sequences'
              ? 'border-[#C9A125] text-[#19283E] font-semibold'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          Séquences de relance ({scopedSequences.length})
        </button>
      </div>

      {activeTab === 'prospects' && (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              <div className="lg:col-span-2 relative">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  id="prospects-search"
                  type="search"
                  value={globalSearch}
                  onChange={(e) => {
                    setGlobalSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Nom, entreprise, email, téléphone..."
                  className="w-full h-9 rounded-lg border border-slate-200 pl-9 pr-3 text-sm"
                />
              </div>

              <select
                aria-label="Filtrer par entité"
                value={entityFilter}
                onChange={(e) => {
                  setEntityFilter(e.target.value);
                  setPage(1);
                }}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="all">Toutes entités</option>
                {authorizedEntities.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filtrer par statut"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as ProspectStatus | 'all');
                  setPage(1);
                }}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="all">Tous statuts</option>
                {PROSPECT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filtrer par priorité"
                value={priorityFilter}
                onChange={(e) => {
                  setPriorityFilter(e.target.value as PriorityLevel | 'all');
                  setPage(1);
                }}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="all">Toutes priorités</option>
                {(Object.keys(PRIORITY_LABELS) as PriorityLevel[]).map((k) => (
                  <option key={k} value={k}>
                    {PRIORITY_LABELS[k]}
                  </option>
                ))}
              </select>

              <select
                aria-label="Trier les prospects"
                value={`${sortBy}:${sortDir}`}
                onChange={(e) => {
                  const [field, dir] = e.target.value.split(':');
                  setSortBy(field as ProspectFilterOptions['sortBy']);
                  setSortDir(dir as 'asc' | 'desc');
                }}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="updatedAt:desc">Tri : Mise à jour</option>
                <option value="lastActivityAt:desc">Tri : Activité</option>
                <option value="estimatedValue:desc">Tri : Valeur</option>
                <option value="name:asc">Tri : Nom (A → Z)</option>
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <select
                value={ownerFilter}
                onChange={(e) => setOwnerFilter(e.target.value)}
                className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs"
              >
                <option value="all">Tous responsables</option>
                {users.map((u) => (
                  <option key={u.uid} value={u.uid}>
                    {u.displayName}
                  </option>
                ))}
              </select>

              <select
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs"
              >
                <option value="all">Tous tags</option>
                {tags.map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>

              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs"
              />

              <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer ml-auto">
                <input
                  type="checkbox"
                  checked={includeArchived}
                  onChange={(e) => setIncludeArchived(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600"
                />
                Inclure archivés
              </label>
            </div>
          </div>

          {paginatedProspects.length === 0 ? (
            <EmptyState
              icon={<Users className="h-6 w-6" />}
              title="Aucun prospect trouvé"
              description="Modifiez vos filtres ou créez un nouveau prospect."
            />
          ) : viewMode === 'table' ? (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="py-3 px-4">Prospect & Entreprise</th>
                      <th className="py-3 px-4">Entité</th>
                      <th className="py-3 px-4">Statut</th>
                      <th className="py-3 px-4">Priorité</th>
                      <th className="py-3 px-4 text-right">Valeur</th>
                      <th className="py-3 px-4">Prochaine action</th>
                      <th className="py-3 px-4">Responsable</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {paginatedProspects.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4">
                          <Link
                            to={`/prospects/${p.id}`}
                            className="font-semibold text-slate-900 hover:text-blue-600 block"
                          >
                            {p.firstName} {p.lastName}
                          </Link>
                          <span className="text-xs text-slate-500">
                            {p.companyName || 'Particulier'}
                            {p.email ? ` · ${p.email}` : ''}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-700">
                          {getEntityName(p.primaryEntityId)}
                        </td>
                        <td className="py-3 px-4">
                          <ProspectStatusBadge status={p.status} />
                        </td>
                        <td className="py-3 px-4">
                          <PriorityText priority={p.priority} />
                        </td>
                        <td className="py-3 px-4 text-right font-sans tabular-nums font-medium text-slate-900">
                          {formatCurrency(p.estimatedValue)}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600 font-sans tabular-nums">
                          {p.nextActionDate
                            ? `${formatDateFr(p.nextActionDate)} · ${p.nextActionType}`
                            : '—'}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">
                          {getOwnerName(p.ownerUid)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center justify-end gap-1">
                            {canEditProspect(p) && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingProspect(p);
                                    setModalOpen(true);
                                  }}
                                  className="p-1.5 rounded text-slate-500 hover:bg-slate-100"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => archiveProspect(p.id, !p.archived)}
                                  className="p-1.5 rounded text-slate-500 hover:bg-slate-100"
                                >
                                  <Archive className="h-4 w-4" />
                                </button>
                              </>
                            )}
                            {canDeleteProspect(p) && (
                              <button
                                type="button"
                                onClick={() => deleteProspect(p.id)}
                                className="p-1.5 rounded text-slate-500 hover:bg-red-50 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {paginatedProspects.map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between gap-4"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        to={`/prospects/${p.id}`}
                        className="text-base font-semibold text-slate-900 hover:text-blue-600"
                      >
                        {p.firstName} {p.lastName}
                      </Link>
                      <ProspectStatusBadge status={p.status} />
                    </div>
                    <p className="text-sm text-slate-600 mt-1">{p.companyName || 'Particulier'}</p>
                    <p className="text-xs text-slate-500 mt-1">{getEntityName(p.primaryEntityId)}</p>
                  </div>
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="font-sans tabular-nums font-semibold">
                      {formatCurrency(p.estimatedValue)}
                    </span>
                    <PriorityText priority={p.priority} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span className="tabular-nums">
                Page {safePage} sur {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Précédent
                </button>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 disabled:opacity-40"
                >
                  Suivant
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Onglet Leads & Qualification */}
      {activeTab === 'leads' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {(['all', ...LEAD_STATUSES] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setLeadStatusFilter(st)}
                className={`h-8 rounded-lg border px-3 text-xs font-medium whitespace-nowrap ${
                  leadStatusFilter === st
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                {st === 'all' ? 'Tous statuts' : st}
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">Contact & Entreprise</th>
                    <th className="py-3 px-4">Entité</th>
                    <th className="py-3 px-4">Source</th>
                    <th className="py-3 px-4">Statut</th>
                    <th className="py-3 px-4 text-right">Potentiel</th>
                    <th className="py-3 px-4">Prochaine relance</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4">
                        <Link
                          to={`/contacts/${lead.contactId}`}
                          className="font-semibold text-slate-900 hover:text-blue-600 block"
                        >
                          {getContactName(lead.contactId)}
                        </Link>
                        {lead.companyId && (
                          <span className="text-xs text-slate-500">
                            {getCompanyName(lead.companyId)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700">
                        {getEntityName(lead.entityId)}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">{lead.source}</td>
                      <td className="py-3 px-4">
                        {canWriteCrm ? (
                          <select
                            aria-label={`Statut du lead ${getContactName(lead.contactId)}`}
                            value={lead.status}
                            onChange={(e) =>
                              updateLead({ ...lead, status: e.target.value as LeadStatus })
                            }
                            className="h-7 rounded border border-slate-200 bg-white px-2 text-xs"
                          >
                            {LEAD_STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <LeadStatusBadge status={lead.status} />
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-sans tabular-nums font-medium">
                        {formatCurrency(lead.estimatedValue)}
                      </td>
                      <td className="py-3 px-4 text-xs font-sans tabular-nums text-slate-600">
                        {formatDateFr(lead.nextFollowUpDate)} ·{' '}
                        {SEQUENCE_CHANNEL_LABELS[lead.nextFollowUpChannel]}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {canWriteCrm && (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                const matchSeq =
                                  scopedSequences.find((s) => s.entityId === lead.entityId) ??
                                  scopedSequences[0];
                                setSelectedSeqId(matchSeq?.id ?? '');
                                setEnrollModalLeadId(lead.id);
                              }}
                              className="inline-flex h-7 items-center gap-1 rounded border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              <Repeat className="h-3 w-3" />
                              Séquence
                            </button>
                            <button
                              type="button"
                              onClick={() => convertLeadToOpportunity(lead.id)}
                              className="inline-flex h-7 items-center gap-1 rounded bg-[#19283E] px-2 text-xs font-medium text-white hover:bg-[#223552]"
                            >
                              <ArrowRightCircle className="h-3 w-3" />
                              Opportunité
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
        </div>
      )}

      {/* Onglet Séquences de relance */}
      {activeTab === 'sequences' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Inscriptions actives</p>
              <p className="text-2xl font-bold font-sans tabular-nums text-slate-900 mt-1">
                {seqMetrics.active}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Appels passés</p>
              <p className="text-2xl font-bold font-sans tabular-nums text-blue-700 mt-1">
                {seqMetrics.callsMade}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">RDV pris</p>
              <p className="text-2xl font-bold font-sans tabular-nums text-violet-700 mt-1">
                {seqMetrics.meetingsBooked}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Réponses obtenues</p>
              <p className="text-2xl font-bold font-sans tabular-nums text-emerald-700 mt-1">
                {seqMetrics.repliesReceived}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Taux de réponse</p>
              <p className="text-2xl font-bold font-sans tabular-nums text-emerald-700 mt-1">
                {seqMetrics.responseRate} %
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {scopedSequences.map((seq) => {
              const steps = sequenceSteps
                .filter((st) => st.sequenceId === seq.id)
                .sort((a, b) => a.order - b.order);
              return (
                <div
                  key={seq.id}
                  className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-blue-700">
                        {getEntityName(seq.entityId)}
                      </p>
                      <h2 className="text-base font-semibold text-slate-900 mt-0.5">
                        {seq.name}
                      </h2>
                      <p className="text-xs text-slate-500 mt-1">{seq.description}</p>
                    </div>
                    {canWriteCrm && (
                      <button
                        type="button"
                        onClick={() => setStepModalSeqId(seq.id)}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Étape
                      </button>
                    )}
                  </div>

                  <ol className="space-y-2">
                    {steps.map((step, index) => (
                      <li
                        key={step.id}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 flex items-center justify-between gap-3"
                      >
                        <div>
                          <p className="text-xs font-semibold text-slate-900">
                            Étape {index + 1} · {SEQUENCE_CHANNEL_LABELS[step.channel]} (J+{step.delayDays})
                          </p>
                          <p className="text-xs text-slate-700 mt-0.5">{step.title}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              );
            })}
          </div>

          {/* Suivi des inscriptions actives */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">
                Suivi des prospects inscrits en séquence
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">Séquence</th>
                    <th className="py-3 px-4">Étape actuelle</th>
                    <th className="py-3 px-4">Prochaine action</th>
                    <th className="py-3 px-4">Statut</th>
                    <th className="py-3 px-4 text-right">Exécution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {scopedEnrollments.map((enr) => {
                    const seq = scopedSequences.find((s) => s.id === enr.sequenceId);
                    const steps = sequenceSteps
                      .filter((s) => s.sequenceId === enr.sequenceId)
                      .sort((a, b) => a.order - b.order);
                    const current = steps[enr.currentStep];
                    return (
                      <tr key={enr.id}>
                        <td className="py-3 px-4 font-medium text-slate-900">
                          <Link to={`/contacts/${enr.contactId}`} className="hover:text-blue-600">
                            {getContactName(enr.contactId)}
                          </Link>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-700">
                          {seq?.name || enr.sequenceId}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-700">
                          Étape {enr.currentStep + 1}/{Math.max(1, steps.length)}
                          {current ? ` · ${current.title}` : ''}
                        </td>
                        <td className="py-3 px-4 text-xs font-sans tabular-nums text-slate-600">
                          {formatDateFr(enr.nextActionDate)}
                        </td>
                        <td className="py-3 px-4 text-xs font-medium text-slate-700">
                          {ENROLLMENT_STATUS_LABELS[enr.status]}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {canWriteCrm && enr.status === 'active' && (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  advanceSequenceStep(enr.id, {
                                    outcomeNote: 'Étape validée',
                                  })
                                }
                                className="inline-flex h-7 items-center gap-1 rounded bg-emerald-600 px-2.5 text-xs font-medium text-white hover:bg-emerald-700"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Étape faite
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  advanceSequenceStep(enr.id, {
                                    outcomeNote: 'Réponse & RDV obtenu',
                                    gotReply: true,
                                    bookMeeting: true,
                                  })
                                }
                                className="inline-flex h-7 items-center gap-1 rounded border border-blue-200 bg-blue-50 px-2 text-xs font-medium text-blue-800 hover:bg-blue-100"
                              >
                                + Réponse / RDV
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
        </div>
      )}

      <ProspectFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialProspect={editingProspect}
      />

      {/* Modale nouveau lead */}
      <Modal
        open={leadModalOpen}
        onClose={() => setLeadModalOpen(false)}
        title="Nouveau lead commercial"
        subtitle="Rattachez un contact partagé à une entité pour démarrer une séquence de prospection."
      >
        <form onSubmit={handleCreateLead} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="ld-contact" className="block text-xs font-medium text-slate-700 mb-1">
                Contact partagé *
              </label>
              <select
                id="ld-contact"
                value={leadContactId}
                onChange={(e) => setLeadContactId(e.target.value)}
                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
              >
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ld-entity" className="block text-xs font-medium text-slate-700 mb-1">
                Entité *
              </label>
              <select
                id="ld-entity"
                value={leadEntityId}
                onChange={(e) => setLeadEntityId(e.target.value)}
                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
              >
                {authorizedEntities.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="ld-src" className="block text-xs font-medium text-slate-700 mb-1">
                Source
              </label>
              <input
                id="ld-src"
                type="text"
                value={leadSource}
                onChange={(e) => setLeadSource(e.target.value)}
                className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
              />
            </div>
            <div>
              <label htmlFor="ld-prio" className="block text-xs font-medium text-slate-700 mb-1">
                Priorité
              </label>
              <select
                id="ld-prio"
                value={leadPriority}
                onChange={(e) => setLeadPriority(e.target.value as PriorityLevel)}
                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
              >
                {(Object.keys(PRIORITY_LABELS) as PriorityLevel[]).map((k) => (
                  <option key={k} value={k}>
                    {PRIORITY_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ld-val" className="block text-xs font-medium text-slate-700 mb-1">
                Valeur estimée (Ar)
              </label>
              <input
                id="ld-val"
                type="number"
                min="0"
                value={leadValue}
                onChange={(e) => setLeadValue(e.target.value)}
                className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm font-sans tabular-nums"
              />
            </div>
          </div>

          <div>
            <label htmlFor="ld-notes" className="block text-xs font-medium text-slate-700 mb-1">
              Notes
            </label>
            <textarea
              id="ld-notes"
              rows={2}
              value={leadNotes}
              onChange={(e) => setLeadNotes(e.target.value)}
              className="w-full rounded-lg border border-slate-200 p-2.5 text-sm"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setLeadModalOpen(false)}
              className="h-9 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="h-9 rounded-lg bg-[#19283E] px-4 text-sm font-medium text-white hover:bg-[#223552]"
            >
              Créer le lead
            </button>
          </div>
        </form>
      </Modal>

      {/* Modale inscription séquence */}
      <Modal
        open={Boolean(enrollModalLeadId)}
        onClose={() => setEnrollModalLeadId(null)}
        title="Inscrire le lead dans une séquence"
        subtitle="Une première tâche de relance sera automatiquement planifiée dans l'agenda."
      >
        <div className="space-y-4">
          <select
            value={selectedSeqId}
            onChange={(e) => setSelectedSeqId(e.target.value)}
            className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
          >
            {scopedSequences.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({getEntityName(s.entityId)})
              </option>
            ))}
          </select>
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setEnrollModalLeadId(null)}
              className="h-9 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={!selectedSeqId}
              onClick={async () => {
                if (enrollModalLeadId && selectedSeqId) {
                  await enrollLeadInSequence(enrollModalLeadId, selectedSeqId);
                  setEnrollModalLeadId(null);
                  setActiveTab('sequences');
                }
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#19283E] px-4 text-sm font-medium text-white hover:bg-[#223552] disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5" />
              Démarrer la séquence
            </button>
          </div>
        </div>
      </Modal>

      {/* Modale nouvelle séquence */}
      <Modal
        open={seqModalOpen}
        onClose={() => setSeqModalOpen(false)}
        title="Nouvelle séquence de relance"
      >
        <form onSubmit={handleCreateSequence} className="space-y-4">
          <div>
            <label htmlFor="seq-name" className="block text-xs font-medium text-slate-700 mb-1">
              Nom de la séquence *
            </label>
            <input
              id="seq-name"
              type="text"
              value={seqName}
              onChange={(e) => setSeqName(e.target.value)}
              placeholder="Ex : Relance Devis Branding J+7"
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
              required
            />
          </div>
          <div>
            <label htmlFor="seq-ent" className="block text-xs font-medium text-slate-700 mb-1">
              Entité *
            </label>
            <select
              id="seq-ent"
              value={seqEntityId}
              onChange={(e) => setSeqEntityId(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
            >
              {authorizedEntities.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="seq-desc" className="block text-xs font-medium text-slate-700 mb-1">
              Description
            </label>
            <textarea
              id="seq-desc"
              rows={2}
              value={seqDesc}
              onChange={(e) => setSeqDesc(e.target.value)}
              className="w-full rounded-lg border border-slate-200 p-2.5 text-sm"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setSeqModalOpen(false)}
              className="h-9 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="h-9 rounded-lg bg-[#19283E] px-4 text-sm font-medium text-white hover:bg-[#223552]"
            >
              Créer la séquence
            </button>
          </div>
        </form>
      </Modal>

      {/* Modale ajout étape séquence */}
      <Modal
        open={Boolean(stepModalSeqId)}
        onClose={() => setStepModalSeqId(null)}
        title="Ajouter une étape à la séquence"
      >
        <form onSubmit={handleAddStep} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="st-chan" className="block text-xs font-medium text-slate-700 mb-1">
                Canal
              </label>
              <select
                id="st-chan"
                value={stepChannel}
                onChange={(e) => setStepChannel(e.target.value as SequenceChannel)}
                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
              >
                {(Object.keys(SEQUENCE_CHANNEL_LABELS) as SequenceChannel[]).map((k) => (
                  <option key={k} value={k}>
                    {SEQUENCE_CHANNEL_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="st-delay" className="block text-xs font-medium text-slate-700 mb-1">
                Délai (jours après inscription)
              </label>
              <input
                id="st-delay"
                type="number"
                min="0"
                value={stepDelayDays}
                onChange={(e) => setStepDelayDays(e.target.value)}
                className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm font-sans tabular-nums"
              />
            </div>
          </div>
          <div>
            <label htmlFor="st-title" className="block text-xs font-medium text-slate-700 mb-1">
              Titre de l'étape *
            </label>
            <input
              id="st-title"
              type="text"
              value={stepTitle}
              onChange={(e) => setStepTitle(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
              required
            />
          </div>
          <div>
            <label htmlFor="st-desc" className="block text-xs font-medium text-slate-700 mb-1">
              Instructions / message type
            </label>
            <textarea
              id="st-desc"
              rows={2}
              value={stepDesc}
              onChange={(e) => setStepDesc(e.target.value)}
              className="w-full rounded-lg border border-slate-200 p-2.5 text-sm"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setStepModalSeqId(null)}
              className="h-9 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="h-9 rounded-lg bg-[#19283E] px-4 text-sm font-medium text-white hover:bg-[#223552]"
            >
              Ajouter l'étape
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
