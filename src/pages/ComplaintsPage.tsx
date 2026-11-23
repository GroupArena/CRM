import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertOctagon,
  Plus,
  Star,
  LifeBuoy,
  Smile,
  CheckCircle2,
} from 'lucide-react';
import { useCrm } from '../context/CrmContext';
import { useAuth } from '../hooks/useAuth';
import {
  COMPLAINT_STATUSES,
  PRIORITY_LABELS,
  type Complaint,
  type ComplaintStatus,
  type PriorityLevel,
  type ServiceRequestStatus,
} from '../types';
import { ComplaintStatusBadge, PriorityText, VipBadge } from '../components/ui/StatusBadge';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import { formatDateFr } from '../utils/crmLogic';
import { computeSatisfactionSummary } from '../utils/billingLogic';

type SupportTab = 'complaints' | 'requests' | 'satisfaction' | 'vip';

const SERVICE_REQUEST_STATUSES: ServiceRequestStatus[] = [
  'Ouverte',
  'En traitement',
  'Traitée',
  'Fermée',
];

export function ComplaintsPage() {
  const {
    selectedEntityId,
    authorizedEntities,
    scopedComplaints,
    scopedServiceRequests,
    scopedSurveys,
    companies,
    contacts,
    users,
    currentUser,
    saveComplaint,
    saveServiceRequest,
    saveSatisfactionSurvey,
    updateCompany,
    updateContact,
  } = useCrm();
  const { canWriteCrm } = useAuth();

  const [tab, setTab] = useState<SupportTab>('complaints');
  const [statusFilter, setStatusFilter] = useState<ComplaintStatus | 'all'>('all');

  // Complaint modal
  const [complaintModalOpen, setComplaintModalOpen] = useState(false);
  const [editingComplaint, setEditingComplaint] = useState<Complaint | null>(null);
  const [compEntityId, setCompEntityId] = useState(
    selectedEntityId !== 'all' ? selectedEntityId : authorizedEntities[0]?.id ?? 'arena-business-center'
  );
  const [compContactId, setCompContactId] = useState('');
  const [compCompanyId, setCompCompanyId] = useState('');
  const [compSubject, setCompSubject] = useState('');
  const [compDescription, setCompDescription] = useState('');
  const [compPriority, setCompPriority] = useState<PriorityLevel>('medium');
  const [compStatus, setCompStatus] = useState<ComplaintStatus>('Nouvelle');
  const [compResolution, setCompResolution] = useState('');

  // Service request form
  const [reqModalOpen, setReqModalOpen] = useState(false);
  const [reqEntityId, setReqEntityId] = useState(
    selectedEntityId !== 'all' ? selectedEntityId : authorizedEntities[0]?.id ?? 'arena-business-center'
  );
  const [reqContactId, setReqContactId] = useState('');
  const [reqCompanyId, setReqCompanyId] = useState('');
  const [reqSubject, setReqSubject] = useState('');
  const [reqDescription, setReqDescription] = useState('');
  const [reqPriority, setReqPriority] = useState<PriorityLevel>('medium');

  // Survey form
  const [surveyModalOpen, setSurveyModalOpen] = useState(false);
  const [surveyEntityId, setSurveyEntityId] = useState(
    selectedEntityId !== 'all' ? selectedEntityId : authorizedEntities[0]?.id ?? 'arena-business-center'
  );
  const [surveyContactId, setSurveyContactId] = useState('');
  const [surveyCompanyId, setSurveyCompanyId] = useState('');
  const [surveyRating, setSurveyRating] = useState(5);
  const [surveyComment, setSurveyComment] = useState('');

  const filteredComplaints = useMemo(() => {
    return scopedComplaints
      .filter((c) => statusFilter === 'all' || c.status === statusFilter)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [scopedComplaints, statusFilter]);

  const satisfactionSummary = useMemo(
    () => computeSatisfactionSummary(scopedSurveys),
    [scopedSurveys]
  );

  const vipCompanies = useMemo(() => companies.filter((c) => c.isVip), [companies]);
  const vipContacts = useMemo(() => contacts.filter((c) => c.isVip), [contacts]);

  const openComplaintForm = (existing?: Complaint) => {
    const defEntity =
      selectedEntityId !== 'all'
        ? selectedEntityId
        : authorizedEntities[0]?.id ?? 'arena-business-center';
    if (existing) {
      setEditingComplaint(existing);
      setCompEntityId(existing.entityId);
      setCompContactId(existing.contactId);
      setCompCompanyId(existing.companyId);
      setCompSubject(existing.subject);
      setCompDescription(existing.description);
      setCompPriority(existing.priority);
      setCompStatus(existing.status);
      setCompResolution(existing.resolution);
    } else {
      setEditingComplaint(null);
      setCompEntityId(defEntity);
      setCompContactId(contacts[0]?.id ?? '');
      setCompCompanyId(contacts[0]?.companyId ?? '');
      setCompSubject('');
      setCompDescription('');
      setCompPriority('medium');
      setCompStatus('Nouvelle');
      setCompResolution('');
    }
    setComplaintModalOpen(true);
  };

  const handleSaveComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compSubject.trim()) return;
    const now = new Date().toISOString();
    const isResolved = compStatus === 'Résolue' || compStatus === 'Clôturée';
    if (editingComplaint) {
      await saveComplaint(
        {
          ...editingComplaint,
          entityId: compEntityId,
          contactId: compContactId,
          companyId: compCompanyId,
          subject: compSubject.trim(),
          description: compDescription.trim(),
          priority: compPriority,
          status: compStatus,
          resolution: compResolution.trim(),
          resolvedAt: isResolved ? editingComplaint.resolvedAt || now : undefined,
        },
        false
      );
    } else {
      await saveComplaint(
        {
          id: `comp-ticket-${Date.now()}`,
          entityId: compEntityId,
          contactId: compContactId,
          companyId: compCompanyId,
          subject: compSubject.trim(),
          description: compDescription.trim(),
          status: compStatus,
          priority: compPriority,
          assignedToUid: currentUser?.uid ?? users[0]?.uid ?? 'system',
          resolution: compResolution.trim(),
          resolvedAt: isResolved ? now : undefined,
          createdAt: now,
          updatedAt: now,
        },
        true
      );
    }
    setComplaintModalOpen(false);
  };

  const handleCreateServiceRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqSubject.trim()) return;
    const now = new Date().toISOString();
    await saveServiceRequest(
      {
        id: `sr-${Date.now()}`,
        entityId: reqEntityId,
        contactId: reqContactId || contacts[0]?.id || '',
        companyId: reqCompanyId || contacts[0]?.companyId || '',
        subject: reqSubject.trim(),
        description: reqDescription.trim(),
        status: 'Ouverte',
        priority: reqPriority,
        createdAt: now,
        updatedAt: now,
      },
      true
    );
    setReqSubject('');
    setReqDescription('');
    setReqModalOpen(false);
  };

  const handleCreateSurvey = async (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toISOString();
    await saveSatisfactionSurvey(
      {
        id: `surv-${Date.now()}`,
        entityId: surveyEntityId,
        contactId: surveyContactId || contacts[0]?.id || '',
        companyId: surveyCompanyId || contacts[0]?.companyId || '',
        rating: surveyRating,
        comment: surveyComment.trim(),
        surveySentAt: now.slice(0, 10),
        answeredAt: now.slice(0, 10),
        createdAt: now,
      },
      true
    );
    setSurveyComment('');
    setSurveyModalOpen(false);
  };

  const tabs: { id: SupportTab; label: string }[] = [
    { id: 'complaints', label: `Réclamations (${scopedComplaints.length})` },
    { id: 'requests', label: `Demandes supplémentaires (${scopedServiceRequests.length})` },
    { id: 'satisfaction', label: `Satisfaction (${satisfactionSummary.averageRating}/5)` },
    { id: 'vip', label: `Suivi Clients VIP (${vipCompanies.length + vipContacts.length})` },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Relation Client, Réclamations & Satisfaction
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Suivi qualité par entité, demandes complémentaires, enquêtes de satisfaction et comptes VIP.
          </p>
        </div>

        {canWriteCrm && (
          <div className="flex flex-wrap items-center gap-2">
            {tab === 'complaints' && (
              <button
                type="button"
                onClick={() => openComplaintForm()}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#19283E] px-4 text-sm font-medium text-white hover:bg-[#223552] whitespace-nowrap"
              >
                <Plus className="h-4 w-4" />
                Nouvelle réclamation
              </button>
            )}
            {tab === 'requests' && (
              <button
                type="button"
                onClick={() => {
                  setReqContactId(contacts[0]?.id ?? '');
                  setReqCompanyId(contacts[0]?.companyId ?? '');
                  setReqModalOpen(true);
                }}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#19283E] px-4 text-sm font-medium text-white hover:bg-[#223552] whitespace-nowrap"
              >
                <Plus className="h-4 w-4" />
                Nouvelle demande
              </button>
            )}
            {tab === 'satisfaction' && (
              <button
                type="button"
                onClick={() => {
                  setSurveyContactId(contacts[0]?.id ?? '');
                  setSurveyCompanyId(contacts[0]?.companyId ?? '');
                  setSurveyModalOpen(true);
                }}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#19283E] px-4 text-sm font-medium text-white hover:bg-[#223552] whitespace-nowrap"
              >
                <Plus className="h-4 w-4" />
                Saisir un avis client
              </button>
            )}
          </div>
        )}
      </div>

      {/* Onglets */}
      <div className="border-b border-slate-200 flex items-center gap-1 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              tab === t.id
                ? 'border-[#C9A125] text-[#19283E] font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'complaints' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`h-8 rounded-lg border px-3 text-xs font-medium whitespace-nowrap ${
                statusFilter === 'all'
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-700'
              }`}
            >
              Toutes
            </button>
            {COMPLAINT_STATUSES.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`h-8 rounded-lg border px-3 text-xs font-medium whitespace-nowrap ${
                  statusFilter === st
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {filteredComplaints.length === 0 ? (
            <EmptyState
              icon={<AlertOctagon className="h-6 w-6" />}
              title="Aucune réclamation"
              description="Toutes les réclamations et incidents qualité de ce périmètre sont traités."
            />
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
              {filteredComplaints.map((comp) => {
                const contact = contacts.find((c) => c.id === comp.contactId);
                const company = companies.find((c) => c.id === comp.companyId);
                const entity = authorizedEntities.find((e) => e.id === comp.entityId);
                return (
                  <div
                    key={comp.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <ComplaintStatusBadge status={comp.status} />
                        <PriorityText priority={comp.priority} />
                        <span className="text-xs text-slate-500">
                          {entity?.name ?? comp.entityId} · {formatDateFr(comp.createdAt)}
                        </span>
                      </div>
                      <h2 className="text-sm font-semibold text-slate-900">{comp.subject}</h2>
                      <p className="text-xs text-slate-600">{comp.description}</p>
                      {comp.resolution && (
                        <p className="text-xs text-emerald-700 font-medium">
                          Résolution : {comp.resolution}
                        </p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-slate-500 pt-1">
                        {company && (
                          <Link
                            to={`/companies/${company.id}`}
                            className="font-medium text-blue-700 hover:underline"
                          >
                            {company.tradeName || company.legalName}
                          </Link>
                        )}
                        {contact && (
                          <Link
                            to={`/contacts/${contact.id}`}
                            className="text-slate-600 hover:text-blue-700 hover:underline"
                          >
                            {contact.fullName}
                          </Link>
                        )}
                      </div>
                    </div>

                    {canWriteCrm && (
                      <div className="flex items-center gap-2 shrink-0">
                        <select
                          aria-label={`Statut de ${comp.subject}`}
                          value={comp.status}
                          onChange={(e) => {
                            const nextStatus = e.target.value as ComplaintStatus;
                            saveComplaint(
                              {
                                ...comp,
                                status: nextStatus,
                                resolvedAt:
                                  nextStatus === 'Résolue' || nextStatus === 'Clôturée'
                                    ? comp.resolvedAt || new Date().toISOString()
                                    : comp.resolvedAt,
                              },
                              false
                            );
                          }}
                          className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs"
                        >
                          {COMPLAINT_STATUSES.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => openComplaintForm(comp)}
                          className="h-8 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Détails
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'requests' && (
        <div className="space-y-4">
          {scopedServiceRequests.length === 0 ? (
            <EmptyState
              icon={<LifeBuoy className="h-6 w-6" />}
              title="Aucune demande supplémentaire"
              description="Suivez ici les demandes de prestations additionnelles et évolutions clients."
            />
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
              {scopedServiceRequests.map((sr) => {
                const contact = contacts.find((c) => c.id === sr.contactId);
                const company = companies.find((c) => c.id === sr.companyId);
                const entity = authorizedEntities.find((e) => e.id === sr.entityId);
                return (
                  <div
                    key={sr.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-semibold text-slate-700">{sr.status}</span>
                        <span>·</span>
                        <PriorityText priority={sr.priority} />
                        <span>·</span>
                        <span>{entity?.name ?? sr.entityId}</span>
                      </div>
                      <p className="text-sm font-semibold text-slate-900">{sr.subject}</p>
                      <p className="text-xs text-slate-600">{sr.description}</p>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        {company && <span>{company.legalName}</span>}
                        {contact && <span>{contact.fullName}</span>}
                      </div>
                    </div>
                    {canWriteCrm && (
                      <select
                        aria-label={`Statut demande ${sr.subject}`}
                        value={sr.status}
                        onChange={(e) =>
                          saveServiceRequest(
                            { ...sr, status: e.target.value as ServiceRequestStatus },
                            false
                          )
                        }
                        className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs shrink-0"
                      >
                        {SERVICE_REQUEST_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'satisfaction' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <span className="text-xs font-medium text-slate-500">Note moyenne</span>
              <p className="mt-2 text-2xl font-bold font-display tabular-nums text-amber-600">
                {satisfactionSummary.averageRating} / 5
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <span className="text-xs font-medium text-slate-500">Réponses collectées</span>
              <p className="mt-2 text-2xl font-bold font-display tabular-nums text-slate-900">
                {satisfactionSummary.answeredCount}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <span className="text-xs font-medium text-slate-500">Enquêtes envoyées</span>
              <p className="mt-2 text-2xl font-bold font-display tabular-nums text-slate-900">
                {satisfactionSummary.totalSurveys}
              </p>
            </div>
          </div>

          {scopedSurveys.length === 0 ? (
            <EmptyState
              icon={<Smile className="h-6 w-6" />}
              title="Aucune enquête de satisfaction"
              description="Saisissez les retours qualité de vos clients pour calculer l'indice de satisfaction par entité."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {scopedSurveys.map((surv) => {
                const contact = contacts.find((c) => c.id === surv.contactId);
                const company = companies.find((c) => c.id === surv.companyId);
                const entity = authorizedEntities.find((e) => e.id === surv.entityId);
                return (
                  <div
                    key={surv.id}
                    className="rounded-xl border border-slate-200 bg-white p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            className={`h-4 w-4 ${
                              n <= surv.rating
                                ? 'fill-amber-400 text-amber-500'
                                : 'text-slate-200'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-slate-500">
                        {entity?.name ?? surv.entityId} · {formatDateFr(surv.answeredAt || surv.surveySentAt)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-800">
                      {surv.comment || 'Aucun commentaire saisi.'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {company?.tradeName || company?.legalName || ''}
                      {company && contact ? ' · ' : ''}
                      {contact?.fullName || ''}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'vip' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-500 fill-amber-400" />
              Entreprises VIP ({vipCompanies.length})
            </h2>
            {vipCompanies.length === 0 ? (
              <p className="text-sm text-slate-500">Aucune entreprise VIP marquée.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {vipCompanies.map((co) => (
                  <li key={co.id} className="py-3 flex items-center justify-between gap-3">
                    <div>
                      <Link
                        to={`/companies/${co.id}`}
                        className="text-sm font-semibold text-slate-900 hover:text-blue-700 flex items-center gap-2"
                      >
                        {co.tradeName || co.legalName}
                        <VipBadge />
                      </Link>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {co.city} · {co.email || co.phone}
                      </p>
                    </div>
                    {canWriteCrm && (
                      <button
                        type="button"
                        onClick={() => updateCompany({ ...co, isVip: false })}
                        className="text-xs text-slate-500 hover:text-slate-900 underline"
                      >
                        Retirer VIP
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-amber-500" />
              Contacts VIP ({vipContacts.length})
            </h2>
            {vipContacts.length === 0 ? (
              <p className="text-sm text-slate-500">Aucun contact VIP marqué.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {vipContacts.map((ct) => {
                  const co = companies.find((c) => c.id === ct.companyId);
                  return (
                    <li key={ct.id} className="py-3 flex items-center justify-between gap-3">
                      <div>
                        <Link
                          to={`/contacts/${ct.id}`}
                          className="text-sm font-semibold text-slate-900 hover:text-blue-700 flex items-center gap-2"
                        >
                          {ct.fullName}
                          <VipBadge />
                        </Link>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {ct.jobTitle || 'Contact'}
                          {co ? ` · ${co.tradeName || co.legalName}` : ''}
                        </p>
                      </div>
                      {canWriteCrm && (
                        <button
                          type="button"
                          onClick={() => updateContact({ ...ct, isVip: false })}
                          className="text-xs text-slate-500 hover:text-slate-900 underline"
                        >
                          Retirer VIP
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Modal Réclamation */}
      <Modal
        open={complaintModalOpen}
        onClose={() => setComplaintModalOpen(false)}
        title={editingComplaint ? 'Mettre à jour la réclamation' : 'Nouvelle réclamation client'}
        subtitle="Rattachée à une entité spécifique et liée à la fiche client partagée."
      >
        <form onSubmit={handleSaveComplaint} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Entité *</label>
              <select
                value={compEntityId}
                onChange={(e) => setCompEntityId(e.target.value)}
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
              <label className="block text-xs font-medium text-slate-700 mb-1">Contact</label>
              <select
                value={compContactId}
                onChange={(e) => {
                  setCompContactId(e.target.value);
                  const ct = contacts.find((c) => c.id === e.target.value);
                  if (ct?.companyId) setCompCompanyId(ct.companyId);
                }}
                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="">—</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Entreprise</label>
              <select
                value={compCompanyId}
                onChange={(e) => setCompCompanyId(e.target.value)}
                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="">—</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.legalName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Objet *</label>
            <input
              type="text"
              required
              value={compSubject}
              onChange={(e) => setCompSubject(e.target.value)}
              placeholder="Ex : Retard de livraison / Qualité prestation"
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Priorité</label>
              <select
                value={compPriority}
                onChange={(e) => setCompPriority(e.target.value as PriorityLevel)}
                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
              >
                {(Object.keys(PRIORITY_LABELS) as PriorityLevel[]).map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Statut</label>
              <select
                value={compStatus}
                onChange={(e) => setCompStatus(e.target.value as ComplaintStatus)}
                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
              >
                {COMPLAINT_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
            <textarea
              rows={2}
              value={compDescription}
              onChange={(e) => setCompDescription(e.target.value)}
              className="w-full rounded-lg border border-slate-200 p-2.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Actions correctives / Résolution
            </label>
            <textarea
              rows={2}
              value={compResolution}
              onChange={(e) => setCompResolution(e.target.value)}
              className="w-full rounded-lg border border-slate-200 p-2.5 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setComplaintModalOpen(false)}
              className="h-9 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="h-9 rounded-lg bg-[#19283E] px-4 text-sm font-medium text-white hover:bg-[#223552]"
            >
              Enregistrer
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Demande supplémentaire */}
      <Modal
        open={reqModalOpen}
        onClose={() => setReqModalOpen(false)}
        title="Nouvelle demande supplémentaire"
      >
        <form onSubmit={handleCreateServiceRequest} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Entité</label>
              <select
                value={reqEntityId}
                onChange={(e) => setReqEntityId(e.target.value)}
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
              <label className="block text-xs font-medium text-slate-700 mb-1">Contact</label>
              <select
                value={reqContactId}
                onChange={(e) => {
                  setReqContactId(e.target.value);
                  const ct = contacts.find((c) => c.id === e.target.value);
                  if (ct?.companyId) setReqCompanyId(ct.companyId);
                }}
                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
              >
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Objet *</label>
            <input
              type="text"
              required
              value={reqSubject}
              onChange={(e) => setReqSubject(e.target.value)}
              placeholder="Ex : Extension horaire salle ou option supplémentaire"
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Priorité</label>
            <select
              value={reqPriority}
              onChange={(e) => setReqPriority(e.target.value as PriorityLevel)}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
            >
              {(Object.keys(PRIORITY_LABELS) as PriorityLevel[]).map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Détails</label>
            <textarea
              rows={3}
              value={reqDescription}
              onChange={(e) => setReqDescription(e.target.value)}
              className="w-full rounded-lg border border-slate-200 p-2.5 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setReqModalOpen(false)}
              className="h-9 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="h-9 rounded-lg bg-[#19283E] px-4 text-sm font-medium text-white hover:bg-[#223552]"
            >
              Créer
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Enquête satisfaction */}
      <Modal
        open={surveyModalOpen}
        onClose={() => setSurveyModalOpen(false)}
        title="Saisir un avis de satisfaction (1 à 5)"
      >
        <form onSubmit={handleCreateSurvey} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Entité</label>
              <select
                value={surveyEntityId}
                onChange={(e) => setSurveyEntityId(e.target.value)}
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
              <label className="block text-xs font-medium text-slate-700 mb-1">Contact</label>
              <select
                value={surveyContactId}
                onChange={(e) => {
                  setSurveyContactId(e.target.value);
                  const ct = contacts.find((c) => c.id === e.target.value);
                  if (ct?.companyId) setSurveyCompanyId(ct.companyId);
                }}
                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
              >
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Note de satisfaction (1 à 5)
            </label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setSurveyRating(n)}
                  className={`h-9 w-10 rounded-lg border text-sm font-semibold ${
                    surveyRating === n
                      ? 'border-amber-500 bg-amber-50 text-amber-800'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  {n}★
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Commentaire</label>
            <textarea
              rows={3}
              value={surveyComment}
              onChange={(e) => setSurveyComment(e.target.value)}
              className="w-full rounded-lg border border-slate-200 p-2.5 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setSurveyModalOpen(false)}
              className="h-9 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="h-9 rounded-lg bg-[#19283E] px-4 text-sm font-medium text-white hover:bg-[#223552]"
            >
              Enregistrer l'avis
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
