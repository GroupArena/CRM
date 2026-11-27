import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Edit2,
  Plus,
  Mail,
  Phone,
  Globe,
  MapPin,
  Briefcase,
  Building,
  Check,
} from 'lucide-react';
import { useCrm } from '../context/CrmContext';
import { useAuth } from '../hooks/useAuth';
import { useActions } from '../hooks/useActions';
import {
  DealStatusBadge,
  PriorityText,
  ProspectStatusBadge,
} from '../components/ui/StatusBadge';
import { TimelineList } from '../components/crm/TimelineList';
import { ProspectFormModal } from '../components/crm/ProspectFormModal';
import { ActionFormModal } from '../components/crm/ActionFormModal';
import { DealFormModal } from '../components/crm/DealFormModal';
import {
  formatCurrency,
  formatDateFr,
  formatDateTimeFr,
} from '../utils/crmLogic';
import { formatInlineAddress } from '../utils/billingLogic';

type DetailTab =
  | 'informations'
  | 'activites'
  | 'actions'
  | 'opportunites'
  | 'notes'
  | 'historique';

export function ProspectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const {
    prospects,
    entities,
    users,
    deals,
    stages,
    auditLogs,
    updateProspect,
  } = useCrm();
  const { canEditProspect } = useAuth();
  const { actions: prospectActions, completeAction } = useActions({
    prospectId: id,
  });

  const [activeTab, setActiveTab] = useState<DetailTab>('informations');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [dealModalOpen, setDealModalOpen] = useState(false);

  const prospect = prospects.find((p) => p.id === id);
  const [notesDraft, setNotesDraft] = useState(prospect?.notes ?? '');
  const [savingNotes, setSavingNotes] = useState(false);

  if (!prospect) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Prospect introuvable</h1>
        <p className="text-sm text-slate-500 mt-1">
          Ce prospect n'existe plus ou vous n'avez pas les droits d'accès à son entité.
        </p>
        <Link
          to="/prospects"
          className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour aux prospects
        </Link>
      </div>
    );
  }

  const editable = canEditProspect(prospect);
  const primaryEntity = entities.find((e) => e.id === prospect.primaryEntityId);
  const sharedEntities = entities.filter((e) =>
    prospect.sharedEntityIds.includes(e.id)
  );
  const owner = users.find((u) => u.uid === prospect.ownerUid);
  const prospectDeals = deals.filter((d) => d.prospectId === prospect.id);
  const upcomingActions = prospectActions.filter(
    (a) => a.effectiveStatus === 'planned' || a.effectiveStatus === 'late'
  );
  const recentDoneActions = prospectActions.filter(
    (a) => a.effectiveStatus === 'done'
  );
  const relatedLogs = auditLogs.filter((l) => l.targetId === prospect.id);

  const tabs: { id: DetailTab; label: string }[] = [
    { id: 'informations', label: 'Informations' },
    { id: 'activites', label: 'Activités' },
    { id: 'actions', label: `Actions (${upcomingActions.length})` },
    { id: 'opportunites', label: `Opportunités (${prospectDeals.length})` },
    { id: 'notes', label: 'Notes' },
    { id: 'historique', label: 'Historique' },
  ];

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      await updateProspect({ ...prospect, notes: notesDraft });
    } finally {
      setSavingNotes(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/prospects"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Retour à la liste des prospects
        </Link>

        <div className="rounded-xl border border-slate-200 bg-white p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-2xl font-bold text-slate-900">
                {prospect.firstName} {prospect.lastName}
              </h1>
              <ProspectStatusBadge status={prospect.status} />
              <PriorityText priority={prospect.priority} />
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <span>{prospect.companyName || 'Particulier'}</span>
              <span aria-hidden="true">·</span>
              <span className="font-medium text-slate-800">
                {primaryEntity?.name ?? prospect.primaryEntityId}
              </span>
              {sharedEntities.length > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    Partagé : {sharedEntities.map((e) => e.name).join(', ')}
                  </span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span className="font-sans tabular-nums font-semibold text-slate-900">
                {formatCurrency(prospect.estimatedValue)}
              </span>
            </div>

            <p className="mt-1.5 text-xs text-slate-500 font-sans tabular-nums">
              Dernière activité : {formatDateTimeFr(prospect.lastActivityAt)} · Responsable :{' '}
              {owner?.displayName ?? 'Non assigné'}
            </p>
          </div>

          {editable && (
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setEditModalOpen(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                <Edit2 className="h-4 w-4" />
                Modifier
              </button>
              <button
                type="button"
                onClick={() => setActionModalOpen(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#19283E] px-3.5 text-sm font-medium text-white hover:bg-[#223552] whitespace-nowrap"
              >
                <Plus className="h-4 w-4" />
                Ajouter une action
              </button>
              <button
                type="button"
                onClick={() => setDealModalOpen(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 text-sm font-medium text-white hover:bg-slate-800 whitespace-nowrap"
              >
                <Briefcase className="h-4 w-4" />
                Créer opportunité
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Onglets */}
      <div className="border-b border-slate-200 flex items-center gap-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveTab(tab.id);
              if (tab.id === 'notes') setNotesDraft(prospect.notes);
            }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === tab.id
                ? 'border-[#C9A125] text-[#19283E] font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'informations' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-6 space-y-5">
            <h2 className="text-base font-semibold text-slate-900">
              Coordonnées & qualification
            </h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs text-slate-500 flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" /> Email
                </dt>
                <dd className="mt-1 font-medium text-slate-900">
                  {prospect.email || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" /> Téléphone / Mobile
                </dt>
                <dd className="mt-1 font-medium font-sans tabular-nums text-slate-900">
                  {prospect.phone || '—'} {prospect.mobile ? ` / ${prospect.mobile}` : ''}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5" /> Site web
                </dt>
                <dd className="mt-1 font-medium text-slate-900">
                  {prospect.website || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" /> Localisation
                </dt>
                <dd className="mt-1 font-medium text-slate-900">
                  {formatInlineAddress(prospect.address, prospect.city, prospect.country) || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Source</dt>
                <dd className="mt-1 font-medium text-slate-900">
                  {prospect.source || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">RGPD & Consentement</dt>
                <dd className="mt-1 font-medium text-slate-900">
                  {prospect.consentMarketing ? 'Accord marketing actif' : 'Non consenti'}
                  {prospect.gdprConsentDate ? ` (${formatDateFr(prospect.gdprConsentDate)})` : ''}
                </dd>
              </div>
            </dl>

            {prospect.tags.length > 0 && (
              <div className="pt-4 border-t border-slate-100">
                <p className="text-xs font-medium text-slate-500 mb-1.5">Tags associés</p>
                <p className="text-sm text-slate-800">{prospect.tags.join(' · ')}</p>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
            <h2 className="text-base font-semibold text-slate-900">
              Prochaines échéances
            </h2>
            {upcomingActions.length === 0 ? (
              <p className="text-sm text-slate-500">Aucune tâche à venir.</p>
            ) : (
              <ul className="space-y-3">
                {upcomingActions.map((a) => (
                  <li
                    key={a.id}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-3 flex items-start justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">{a.title}</p>
                      <p className="text-xs text-slate-500 font-sans tabular-nums mt-0.5">
                        {a.type} · {formatDateFr(a.dueDate)} {a.dueTime}
                      </p>
                    </div>
                    {editable && (
                      <button
                        type="button"
                        onClick={() => completeAction(a.id)}
                        aria-label={`Terminer ${a.title}`}
                        className="p-1.5 rounded bg-white border border-slate-200 text-emerald-700 hover:bg-emerald-50"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {activeTab === 'activites' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">
              Dernières interactions réalisées ({recentDoneActions.length})
            </h2>
          </div>
          <TimelineList
            actions={recentDoneActions}
            entities={entities}
            users={users}
          />
        </div>
      )}

      {activeTab === 'actions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">
              Toutes les actions du prospect ({prospectActions.length})
            </h2>
            {editable && (
              <button
                type="button"
                onClick={() => setActionModalOpen(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#19283E] px-3.5 text-sm font-medium text-white hover:bg-[#223552]"
              >
                <Plus className="h-4 w-4" />
                Planifier une action
              </button>
            )}
          </div>
          <TimelineList
            actions={prospectActions}
            entities={entities}
            users={users}
            canWrite={editable}
            onComplete={(actionId) => completeAction(actionId)}
          />
        </div>
      )}

      {activeTab === 'opportunites' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">
              Opportunités commerciales ({prospectDeals.length})
            </h2>
            {editable && (
              <button
                type="button"
                onClick={() => setDealModalOpen(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 text-sm font-medium text-white hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" />
                Nouvelle opportunité
              </button>
            )}
          </div>

          {prospectDeals.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
              Aucune opportunité rattachée à ce prospect.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {prospectDeals.map((deal) => {
                const stage = stages.find((s) => s.id === deal.stageId);
                const entity = entities.find((e) => e.id === deal.entityId);
                return (
                  <div
                    key={deal.id}
                    className="rounded-xl border border-slate-200 bg-white p-5 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-slate-900">{deal.name}</h3>
                      <DealStatusBadge status={deal.status} />
                    </div>
                    <p className="text-xs text-slate-500 flex items-center gap-1.5">
                      <Building className="h-3.5 w-3.5" />
                      {entity?.name ?? deal.entityId} · Étape : {stage?.name ?? '—'}
                    </p>
                    <div className="flex items-center justify-between pt-2 text-sm">
                      <span className="font-sans tabular-nums font-bold text-slate-900">
                        {formatCurrency(deal.amount, deal.currency)}
                      </span>
                      <span className="text-xs font-sans tabular-nums text-slate-500">
                        Probabilité : {deal.probability}% · Clôture :{' '}
                        {formatDateFr(deal.expectedCloseDate)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'notes' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="text-base font-semibold text-slate-900">Notes internes</h2>
          <textarea
            rows={6}
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            disabled={!editable}
            className="w-full rounded-lg border border-slate-200 p-3 text-sm focus:border-[#C9A125] focus:outline-none disabled:bg-slate-50"
            placeholder="Ajoutez vos notes de suivi..."
          />
          {editable && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSaveNotes}
                disabled={savingNotes}
                className="h-9 rounded-lg bg-[#19283E] px-4 text-sm font-medium text-white hover:bg-[#223552] disabled:opacity-50"
              >
                {savingNotes ? 'Enregistrement...' : 'Enregistrer les notes'}
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'historique' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-base font-semibold text-slate-900 mb-3">
              Timeline chronologique des actions
            </h2>
            <TimelineList
              actions={prospectActions}
              entities={entities}
              users={users}
              canWrite={editable}
              onComplete={(actionId) => completeAction(actionId)}
            />
          </div>
          {relatedLogs.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">
                Journal d'audit
              </h3>
              <ul className="divide-y divide-slate-100 text-xs text-slate-600">
                {relatedLogs.map((log) => (
                  <li key={log.id} className="py-2 flex items-center justify-between gap-4">
                    <span>{log.summary}</span>
                    <span className="font-sans tabular-nums text-slate-400 whitespace-nowrap">
                      {formatDateTimeFr(log.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <ProspectFormModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        initialProspect={prospect}
      />

      <ActionFormModal
        open={actionModalOpen}
        onClose={() => setActionModalOpen(false)}
        defaultProspectId={prospect.id}
        defaultEntityId={prospect.primaryEntityId}
      />

      <DealFormModal
        open={dealModalOpen}
        onClose={() => setDealModalOpen(false)}
        defaultProspectId={prospect.id}
        defaultEntityId={prospect.primaryEntityId}
      />
    </div>
  );
}
