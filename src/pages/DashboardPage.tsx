import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  AreaChart,
  Area,
  Legend,
} from 'recharts';
import {
  PhoneCall,
  CalendarClock,
  AlertTriangle,
  Briefcase,
  TrendingUp,
  Percent,
  ArrowRight,
  Banknote,
  Receipt,
  FileText,
  Clock,
} from 'lucide-react';
import { useCrm } from '../context/CrmContext';
import {
  computeActivityLast30Days,
  computeDashboardKpis,
  computePipelineByStage,
  computeProspectsByStatus,
  formatCurrency,
  formatDateFr,
  formatDateTimeFr,
} from '../utils/crmLogic';
import {
  computeFinanceKpis,
  computeRevenueByEntity,
  resolveInvoiceStatus,
} from '../utils/billingLogic';
import { ActionStatusBadge } from '../components/ui/StatusBadge';
import { BrandLogo } from '../components/ui/BrandLogo';
import { useActions } from '../hooks/useActions';

export function DashboardPage() {
  const {
    selectedEntityId,
    entities,
    authorizedEntities,
    scopedProspects,
    scopedActions,
    scopedDeals,
    scopedQuotes,
    scopedInvoices,
    scopedPayments,
    stages,
    auditLogs,
    currentUser,
  } = useCrm();
  const isSales = currentUser?.role === 'sales';
  const { actions: enrichedActions } = useActions();

  const [viewRole, setViewRole] = useState<'direction' | 'commercial'>(
    isSales ? 'commercial' : 'direction'
  );

  const nowIso = new Date().toISOString();
  const todayIso = nowIso.slice(0, 10);
  const activeEntity = entities.find((e) => e.id === selectedEntityId);

  const crmKpis = useMemo(
    () => computeDashboardKpis(scopedProspects, scopedActions, scopedDeals, nowIso),
    [scopedProspects, scopedActions, scopedDeals, nowIso]
  );

  const financeKpis = useMemo(
    () =>
      computeFinanceKpis({
        quotes: scopedQuotes,
        invoices: scopedInvoices,
        payments: scopedPayments,
        opportunities: scopedDeals,
        referenceDateIso: nowIso,
      }),
    [scopedQuotes, scopedInvoices, scopedPayments, scopedDeals, nowIso]
  );

  const revenueByEntityData = useMemo(
    () => computeRevenueByEntity(scopedInvoices, scopedPayments, authorizedEntities),
    [scopedInvoices, scopedPayments, authorizedEntities]
  );

  const statusData = useMemo(
    () => computeProspectsByStatus(scopedProspects),
    [scopedProspects]
  );

  const pipelineStageData = useMemo(() => {
    const relevantStages =
      selectedEntityId === 'all'
        ? stages
        : stages.filter((s) => s.entityId === selectedEntityId);
    return computePipelineByStage(scopedDeals, relevantStages);
  }, [scopedDeals, stages, selectedEntityId]);

  const activity30dData = useMemo(
    () => computeActivityLast30Days(scopedActions, nowIso),
    [scopedActions, nowIso]
  );

  const commercialMetrics = useMemo(() => {
    const mineActions = enrichedActions.filter((a) =>
      isSales && currentUser ? a.assignedToUid === currentUser.uid : true
    );
    const todayCount = mineActions.filter(
      (a) => a.dueDate === todayIso && a.effectiveStatus !== 'done' && a.effectiveStatus !== 'cancelled'
    ).length;
    const callsToMake = mineActions.filter(
      (a) =>
        a.type === 'Appel' &&
        (a.effectiveStatus === 'planned' || a.effectiveStatus === 'late')
    ).length;
    const followUps = mineActions.filter(
      (a) =>
        (a.type === 'Relance' || a.type === 'Message WhatsApp' || a.type === 'Email') &&
        (a.effectiveStatus === 'planned' || a.effectiveStatus === 'late')
    ).length;
    const upcomingMeetings = mineActions.filter(
      (a) =>
        (a.type === 'Rendez-vous' || a.type === 'Réunion') &&
        a.effectiveStatus === 'planned'
    ).length;
    const pendingQuotes = scopedQuotes.filter(
      (q) => q.status === 'Envoyé' || q.status === 'Brouillon'
    ).length;
    const unpaidInvoices = scopedInvoices.filter((i) => {
      const st = resolveInvoiceStatus(i, nowIso);
      return st !== 'Payée' && st !== 'Annulée' && st !== 'Brouillon';
    }).length;
    const lateTasks = mineActions.filter((a) => a.effectiveStatus === 'late').length;

    return {
      todayCount,
      callsToMake,
      followUps,
      upcomingMeetings,
      openOpportunities: crmKpis.openDeals,
      pendingQuotes,
      unpaidInvoices,
      lateTasks,
    };
  }, [
    enrichedActions,
    isSales,
    currentUser,
    todayIso,
    scopedQuotes,
    scopedInvoices,
    nowIso,
    crmKpis.openDeals,
  ]);

  const upcomingOrLate = enrichedActions
    .filter((a) => a.effectiveStatus === 'late' || a.effectiveStatus === 'planned')
    .slice(0, 6);

  const directionCards = [
    { label: 'CA encaissé', value: formatCurrency(financeKpis.collectedRevenue), icon: Banknote, tone: 'text-emerald-700' },
    { label: 'CA facturé', value: formatCurrency(financeKpis.billedRevenue), icon: Receipt, tone: 'text-[#19283E]' },
    { label: 'Valeur du pipeline', value: formatCurrency(financeKpis.openPipelineValue), icon: TrendingUp, tone: 'text-[#19283E]' },
    { label: 'Taux de conversion', value: `${financeKpis.conversionRate} %`, icon: Percent, tone: 'text-[#AD7300]' },
    { label: 'Devis envoyés / acceptés', value: `${financeKpis.quotesSent} / ${financeKpis.quotesAccepted}`, icon: FileText, tone: 'text-[#19283E]' },
    { label: 'Factures payées / retard', value: `${financeKpis.invoicesPaid} / ${financeKpis.invoicesOverdue}`, icon: AlertTriangle, tone: financeKpis.invoicesOverdue > 0 ? 'text-[#7A1F2B]' : 'text-[#19283E]' },
    { label: 'Opportunités ouvertes', value: String(crmKpis.openDeals), icon: Briefcase, tone: 'text-[#19283E]' },
    { label: 'Actions en retard', value: String(crmKpis.lateActions), icon: Clock, tone: crmKpis.lateActions > 0 ? 'text-[#7A1F2B]' : 'text-[#19283E]' },
  ];

  const commercialCards = [
    { label: 'Activités du jour', value: String(commercialMetrics.todayCount), icon: CalendarClock, tone: 'text-[#19283E]' },
    { label: 'Appels à passer', value: String(commercialMetrics.callsToMake), icon: PhoneCall, tone: 'text-[#19283E]' },
    { label: 'Relances planifiées', value: String(commercialMetrics.followUps), icon: Clock, tone: 'text-[#AD7300]' },
    { label: 'Rendez-vous à venir', value: String(commercialMetrics.upcomingMeetings), icon: CalendarClock, tone: 'text-[#19283E]' },
    { label: 'Opportunités ouvertes', value: String(commercialMetrics.openOpportunities), icon: Briefcase, tone: 'text-[#19283E]' },
    { label: 'Devis en attente', value: String(commercialMetrics.pendingQuotes), icon: FileText, tone: 'text-[#AD7300]' },
    { label: 'Factures impayées', value: String(commercialMetrics.unpaidInvoices), icon: Receipt, tone: commercialMetrics.unpaidInvoices > 0 ? 'text-[#7A1F2B]' : 'text-[#19283E]' },
    { label: 'Tâches en retard', value: String(commercialMetrics.lateTasks), icon: AlertTriangle, tone: commercialMetrics.lateTasks > 0 ? 'text-[#7A1F2B]' : 'text-[#19283E]' },
  ];

  const activeCards = viewRole === 'direction' ? directionCards : commercialCards;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="hidden sm:flex h-14 w-36 items-center justify-center rounded-xl border border-[#E1E4EA] bg-white px-3 py-2 shrink-0">
            <BrandLogo
              entityId={activeEntity ? activeEntity.id : 'group'}
              variant="light"
              alt={activeEntity ? `Logo ${activeEntity.name}` : 'Logo Arena Group'}
              className="h-full w-full"
            />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold text-[#19283E] truncate">
              {activeEntity ? `Tableau de bord — ${activeEntity.name}` : 'Tableau de bord — Arena Group'}
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              {activeEntity
                ? activeEntity.description
                : 'Pilotage consolidé des 4 entités : commercial, devis, facturation et encaissements.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex items-center rounded-lg border border-[#E1E4EA] bg-white p-1">
            <button
              type="button"
              onClick={() => setViewRole('direction')}
              className={`rounded-md px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                viewRole === 'direction'
                  ? 'bg-[#19283E] text-white'
                  : 'text-slate-600 hover:text-[#19283E]'
              }`}
            >
              Vue Direction
            </button>
            <button
              type="button"
              onClick={() => setViewRole('commercial')}
              className={`rounded-md px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                viewRole === 'commercial'
                  ? 'bg-[#19283E] text-white'
                  : 'text-slate-600 hover:text-[#19283E]'
              }`}
            >
              Vue Commercial
            </button>
          </div>

          <Link
            to="/reports"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#E1E4EA] bg-white px-3.5 text-sm font-medium text-[#19283E] hover:bg-[#E1E4EA]/40 whitespace-nowrap"
          >
            Rapports complets
          </Link>
          <Link
            to="/pipeline"
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#19283E] px-3.5 text-sm font-medium text-white hover:bg-[#223552] whitespace-nowrap"
          >
            Pipeline
            <ArrowRight className="h-4 w-4 text-[#C9A125]" />
          </Link>
        </div>
      </div>

      {/* Grille KPIs */}
      <section aria-label="Indicateurs clés de performance">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {activeCards.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <div
                key={kpi.label}
                className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-500">{kpi.label}</span>
                  <Icon className="h-4 w-4 text-slate-400 shrink-0" />
                </div>
                <p className={`mt-2 text-xl sm:text-2xl font-bold font-display tabular-nums ${kpi.tone}`}>
                  {kpi.value}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-[#E1E4EA] bg-white p-5">
          <h2 className="text-base font-semibold text-[#19283E] mb-4">
            CA facturé et encaissé par entité
          </h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueByEntityData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E1E4EA" vertical={false} />
                <XAxis dataKey="name" interval={0} tick={{ fontSize: 11, fill: '#475569' }} />
                <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip formatter={(val) => formatCurrency(Number(val) || 0)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="billed" name="CA Facturé" fill="#19283E" radius={[6, 6, 0, 0]} />
                <Bar dataKey="collected" name="CA Encaissé" fill="#C9A125" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-[#E1E4EA] bg-white p-5">
          <h2 className="text-base font-semibold text-[#19283E] mb-4">
            Valeur du pipeline par étape
          </h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pipelineStageData} margin={{ top: 8, right: 16, left: 0, bottom: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E1E4EA" vertical={false} />
                <XAxis
                  dataKey="name"
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                  height={44}
                  tick={{ fontSize: 11, fill: '#475569' }}
                />
                <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip formatter={(val) => [formatCurrency(Number(val) || 0), 'Montant']} />
                <Bar dataKey="total" fill="#19283E" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-[#E1E4EA] bg-white p-5">
          <h2 className="text-base font-semibold text-[#19283E] mb-4">
            Répartition des prospects par statut
          </h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E1E4EA" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#475569' }} />
                <YAxis
                  dataKey="status"
                  type="category"
                  width={145}
                  interval={0}
                  tick={{ fontSize: 11, fill: '#19283E' }}
                />
                <Tooltip />
                <Bar dataKey="count" name="Prospects" fill="#C9A125" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-[#E1E4EA] bg-white p-5">
          <h2 className="text-base font-semibold text-[#19283E] mb-4">
            Activité commerciale sur les 30 derniers jours
          </h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activity30dData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E1E4EA" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#475569' }} interval={4} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="planned"
                  name="Actions créées"
                  stroke="#19283E"
                  fill="#E1E4EA"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="done"
                  name="Actions terminées"
                  stroke="#AD7300"
                  fill="#DBB361"
                  fillOpacity={0.35}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Actions prioritaires & Activité récente */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-[#E1E4EA] bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-[#19283E]">
              Actions à traiter en priorité
            </h2>
            <Link to="/agenda" className="text-xs font-medium text-[#AD7300] hover:underline">
              Ouvrir l'agenda
            </Link>
          </div>
          {upcomingOrLate.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">
              Aucune action en attente sur ce périmètre.
            </p>
          ) : (
            <ul className="divide-y divide-[#E1E4EA]/70">
              {upcomingOrLate.map((action) => (
                <li key={action.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      to={
                        action.contactId
                          ? `/contacts/${action.contactId}`
                          : action.prospectId
                          ? `/prospects/${action.prospectId}`
                          : '/agenda'
                      }
                      className="text-sm font-medium text-[#19283E] hover:text-[#AD7300] truncate block"
                    >
                      {action.title}
                    </Link>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {action.type} · Échéance {formatDateFr(action.dueDate)}
                    </p>
                  </div>
                  <ActionStatusBadge status={action.effectiveStatus} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-900 mb-4">
            Activité récente du groupe
          </h2>
          {auditLogs.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">
              Aucun événement récent enregistré.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {auditLogs.slice(0, 6).map((log) => (
                <li key={log.id} className="py-3">
                  <p className="text-sm text-slate-800">{log.summary}</p>
                  <p className="text-xs text-slate-500 mt-0.5 font-sans tabular-nums">
                    {log.actorName} · {formatDateTimeFr(log.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
