import { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Download, FileSpreadsheet } from 'lucide-react';
import { useCrm } from '../context/CrmContext';
import { AccountingReportModal } from '../components/crm/AccountingReportModal';
import { SEQUENCE_CHANNEL_LABELS } from '../types';
import { formatCurrency } from '../utils/crmLogic';
import {
  computeFinanceKpis,
  computeLossReasonsBreakdown,
  computeRevenueByEntity,
  computeSalesByClient,
  computeSalesByPeriod,
  computeSalesByProduct,
  computeSalesByRep,
  computeSatisfactionSummary,
  computeSequenceMetrics,
} from '../utils/billingLogic';

const LOSS_COLORS = ['#7A1F2B', '#AD7300', '#C9A125', '#19283E', '#64748B'];

export function ReportsPage() {
  const {
    authorizedEntities,
    scopedInvoices,
    invoiceItems,
    scopedPayments,
    scopedQuotes,
    scopedDeals,
    scopedEnrollments,
    sequenceSteps,
    scopedSurveys,
    products,
    companies,
    contacts,
    users,
    addToast,
  } = useCrm();

  const [entityFilter, setEntityFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [accountingModalOpen, setAccountingModalOpen] = useState(false);

  const inPeriod = (iso?: string) => {
    const d = (iso || '').slice(0, 10);
    if (!d) return true;
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  };

  const filteredInvoices = useMemo(
    () =>
      scopedInvoices.filter(
        (i) => (entityFilter === 'all' || i.entityId === entityFilter) && inPeriod(i.issueDate)
      ),
    [scopedInvoices, entityFilter, dateFrom, dateTo]
  );

  const filteredPayments = useMemo(
    () =>
      scopedPayments.filter(
        (p) => (entityFilter === 'all' || p.entityId === entityFilter) && inPeriod(p.paymentDate)
      ),
    [scopedPayments, entityFilter, dateFrom, dateTo]
  );

  const filteredQuotes = useMemo(
    () =>
      scopedQuotes.filter(
        (q) => (entityFilter === 'all' || q.entityId === entityFilter) && inPeriod(q.issueDate)
      ),
    [scopedQuotes, entityFilter, dateFrom, dateTo]
  );

  const filteredDeals = useMemo(
    () =>
      scopedDeals.filter(
        (d) => (entityFilter === 'all' || d.entityId === entityFilter) && inPeriod(d.createdAt)
      ),
    [scopedDeals, entityFilter, dateFrom, dateTo]
  );

  const filteredEnrollments = useMemo(
    () =>
      scopedEnrollments.filter(
        (e) => (entityFilter === 'all' || e.entityId === entityFilter) && inPeriod(e.enrolledAt)
      ),
    [scopedEnrollments, entityFilter, dateFrom, dateTo]
  );

  const filteredSurveys = useMemo(
    () =>
      scopedSurveys.filter(
        (s) =>
          (entityFilter === 'all' || s.entityId === entityFilter) &&
          inPeriod(s.answeredAt || s.surveySentAt)
      ),
    [scopedSurveys, entityFilter, dateFrom, dateTo]
  );

  const nowIso = new Date().toISOString();
  const financeKpis = useMemo(
    () =>
      computeFinanceKpis({
        quotes: filteredQuotes,
        invoices: filteredInvoices,
        payments: filteredPayments,
        opportunities: filteredDeals,
        referenceDateIso: nowIso,
      }),
    [filteredQuotes, filteredInvoices, filteredPayments, filteredDeals, nowIso]
  );

  const revenueByEntity = useMemo(
    () =>
      computeRevenueByEntity(
        filteredInvoices,
        filteredPayments,
        entityFilter === 'all'
          ? authorizedEntities
          : authorizedEntities.filter((e) => e.id === entityFilter)
      ),
    [filteredInvoices, filteredPayments, authorizedEntities, entityFilter]
  );

  const salesByProduct = useMemo(
    () => computeSalesByProduct(filteredInvoices, invoiceItems, products),
    [filteredInvoices, invoiceItems, products]
  );

  const salesByClient = useMemo(
    () => computeSalesByClient(filteredInvoices, companies, contacts),
    [filteredInvoices, companies, contacts]
  );

  const salesByRep = useMemo(
    () => computeSalesByRep(filteredDeals, filteredInvoices, users),
    [filteredDeals, filteredInvoices, users]
  );

  const salesByPeriod = useMemo(
    () => computeSalesByPeriod(filteredInvoices, filteredPayments),
    [filteredInvoices, filteredPayments]
  );

  const sequenceMetrics = useMemo(
    () =>
      computeSequenceMetrics(
        filteredEnrollments,
        entityFilter === 'all'
          ? sequenceSteps
          : sequenceSteps.filter((s) => s.entityId === entityFilter)
      ),
    [filteredEnrollments, sequenceSteps, entityFilter]
  );

  const lossReasons = useMemo(
    () => computeLossReasonsBreakdown(filteredDeals),
    [filteredDeals]
  );

  const satisfaction = useMemo(
    () => computeSatisfactionSummary(filteredSurveys),
    [filteredSurveys]
  );

  const handleExportReportCsv = () => {
    const header = ['Entité', 'CA Facturé (Ar)', 'CA Encaissé (Ar)'];
    const rows = revenueByEntity.map((r) => [r.name, String(r.billed), String(r.collected)]);
    const csv = [header, ...rows]
      .map((line) => line.map((c) => `"${c.replace(/"/g, '""')}"`).join(';'))
      .join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `arena-crm-rapport-${nowIso.slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addToast({ type: 'success', title: 'Rapport CSV exporté' });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Rapports & Analyses Commerciales
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Performance financière par entité, produits, clients, commerciaux, séquences et satisfaction.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setAccountingModalOpen(true)}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#19283E] px-3.5 text-sm font-medium text-white hover:bg-[#223552] whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="h-4 w-4 text-[#C9A125]" />
            Reporting Factures &amp; Devis
          </button>

          <button
            type="button"
            onClick={handleExportReportCsv}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Download className="h-4 w-4" />
            Exporter synthèse CSV
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Entité</label>
          <select
            aria-label="Filtrer rapport par entité"
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="all">Toutes les entités</option>
            {authorizedEntities.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Du</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Au</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
          />
        </div>
      </div>

      {/* Synthèse KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <span className="text-xs font-medium text-slate-500">CA Encaissé</span>
          <p className="mt-2 text-2xl font-bold font-display tabular-nums text-emerald-700">
            {formatCurrency(financeKpis.collectedRevenue)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <span className="text-xs font-medium text-slate-500">CA Facturé</span>
          <p className="mt-2 text-2xl font-bold font-display tabular-nums text-[#19283E]">
            {formatCurrency(financeKpis.billedRevenue)}
          </p>
        </div>
        <div className="rounded-xl border border-[#E1E4EA] bg-white p-4">
          <span className="text-xs font-medium text-slate-500">Taux réponse séquences</span>
          <p className="mt-2 text-2xl font-bold font-display tabular-nums text-[#19283E]">
            {sequenceMetrics.responseRate} %
          </p>
        </div>
        <div className="rounded-xl border border-[#E1E4EA] bg-white p-4">
          <span className="text-xs font-medium text-slate-500">Satisfaction moyenne</span>
          <p className="mt-2 text-2xl font-bold font-display tabular-nums text-[#AD7300]">
            {satisfaction.averageRating} / 5
          </p>
        </div>
      </div>

      {/* 1. CA encaissé vs facturé par entité + 5. Évolution par période */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-[#E1E4EA] bg-white p-5">
          <h2 className="text-base font-semibold text-[#19283E] mb-4">
            CA facturé vs CA encaissé par entité
          </h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueByEntity} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E1E4EA" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} />
                <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip formatter={(v) => formatCurrency(Number(v) || 0)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="billed" name="CA Facturé" fill="#19283E" radius={[6, 6, 0, 0]} />
                <Bar dataKey="collected" name="CA Encaissé" fill="#C9A125" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-[#E1E4EA] bg-white p-5">
          <h2 className="text-base font-semibold text-[#19283E] mb-4">
            Évolution mensuelle facturé / encaissé
          </h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesByPeriod} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E1E4EA" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#475569' }} />
                <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip formatter={(v) => formatCurrency(Number(v) || 0)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="billed" name="Facturé" stroke="#19283E" fill="#E1E4EA" />
                <Area type="monotone" dataKey="collected" name="Encaissé" stroke="#AD7300" fill="#DBB361" fillOpacity={0.35} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 2. Ventes par produit + 8. Motifs de perte */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-900 mb-4">
            Ventes par produit / service
          </h2>
          {salesByProduct.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">Aucune ligne facturée sur cette période.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-500">
                    <th className="py-2 pr-3">Prestation</th>
                    <th className="py-2 px-3 text-right">Qté</th>
                    <th className="py-2 pl-3 text-right">CA HT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {salesByProduct.slice(0, 8).map((row) => (
                    <tr key={row.name}>
                      <td className="py-2.5 pr-3 font-medium text-slate-800">{row.name}</td>
                      <td className="py-2.5 px-3 text-right font-sans tabular-nums">{row.quantity}</td>
                      <td className="py-2.5 pl-3 text-right font-sans tabular-nums font-semibold">
                        {formatCurrency(row.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-900 mb-4">
            Motifs de perte des opportunités
          </h2>
          {lossReasons.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">Aucune opportunité perdue enregistrée.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={lossReasons}
                      dataKey="count"
                      nameKey="reason"
                      innerRadius={38}
                      outerRadius={72}
                    >
                      {lossReasons.map((entry, idx) => (
                        <Cell key={entry.reason} fill={LOSS_COLORS[idx % LOSS_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="space-y-2 text-sm">
                {lossReasons.map((lr, idx) => (
                  <li key={lr.reason} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-slate-700">
                      <span
                        className="h-2.5 w-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: LOSS_COLORS[idx % LOSS_COLORS.length] }}
                      />
                      {lr.reason}
                    </span>
                    <span className="font-sans tabular-nums text-xs text-slate-600">
                      {lr.count} ({formatCurrency(lr.amount)})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* 3. Ventes par client + 4. Ventes par commercial */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-900 mb-4">
            Classement des ventes par client
          </h2>
          {salesByClient.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">Aucune facturation client.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-500">
                    <th className="py-2 pr-3">Client</th>
                    <th className="py-2 px-3 text-right">Factures</th>
                    <th className="py-2 px-3 text-right">Facturé</th>
                    <th className="py-2 pl-3 text-right">Encaissé</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {salesByClient.slice(0, 8).map((c) => (
                    <tr key={c.clientName}>
                      <td className="py-2.5 pr-3 font-medium text-slate-900">{c.clientName}</td>
                      <td className="py-2.5 px-3 text-right font-sans tabular-nums">{c.count}</td>
                      <td className="py-2.5 px-3 text-right font-sans tabular-nums">{formatCurrency(c.billed)}</td>
                      <td className="py-2.5 pl-3 text-right font-sans tabular-nums text-emerald-700 font-semibold">
                        {formatCurrency(c.paid)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-900 mb-4">
            Performance par commercial
          </h2>
          {salesByRep.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">Aucune donnée commerciale.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-500">
                    <th className="py-2 pr-3">Commercial</th>
                    <th className="py-2 px-3 text-right">Deals gagnés</th>
                    <th className="py-2 px-3 text-right">Montant gagné</th>
                    <th className="py-2 pl-3 text-right">Facturé</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {salesByRep.map((rep) => (
                    <tr key={rep.name}>
                      <td className="py-2.5 pr-3 font-medium text-slate-900">{rep.name}</td>
                      <td className="py-2.5 px-3 text-right font-sans tabular-nums">{rep.wonDeals}</td>
                      <td className="py-2.5 px-3 text-right font-sans tabular-nums">{formatCurrency(rep.wonAmount)}</td>
                      <td className="py-2.5 pl-3 text-right font-sans tabular-nums font-semibold text-blue-700">
                        {formatCurrency(rep.billedAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 6 & 7. Séquences et Taux de réponse par canal + 9. Satisfaction */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <h2 className="text-base font-semibold text-slate-900">
            Performance des séquences & taux de réponse par canal
          </h2>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Appels passés</p>
              <p className="text-lg font-bold font-sans tabular-nums text-slate-900 mt-1">
                {sequenceMetrics.callsMade}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">RDV pris</p>
              <p className="text-lg font-bold font-sans tabular-nums text-blue-700 mt-1">
                {sequenceMetrics.meetingsBooked}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Réponses</p>
              <p className="text-lg font-bold font-sans tabular-nums text-emerald-700 mt-1">
                {sequenceMetrics.repliesReceived}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="py-2 pr-3">Canal</th>
                  <th className="py-2 px-3 text-right">Étapes</th>
                  <th className="py-2 px-3 text-right">Inscriptions</th>
                  <th className="py-2 pl-3 text-right">Taux réponse</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sequenceMetrics.byChannel.map((row) => (
                  <tr key={row.channel}>
                    <td className="py-2.5 pr-3 font-medium text-slate-800">
                      {SEQUENCE_CHANNEL_LABELS[row.channel]}
                    </td>
                    <td className="py-2.5 px-3 text-right font-sans tabular-nums">{row.steps}</td>
                    <td className="py-2.5 px-3 text-right font-sans tabular-nums">{row.enrollments}</td>
                    <td className="py-2.5 pl-3 text-right font-sans tabular-nums font-semibold">
                      {row.responseRate} %
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <h2 className="text-base font-semibold text-slate-900">
            Statistiques de satisfaction client
          </h2>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Note moyenne</p>
              <p className="text-lg font-bold font-sans tabular-nums text-amber-600 mt-1">
                {satisfaction.averageRating} / 5
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Avis collectés</p>
              <p className="text-lg font-bold font-sans tabular-nums text-slate-900 mt-1">
                {satisfaction.answeredCount}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Enquêtes envoyées</p>
              <p className="text-lg font-bold font-sans tabular-nums text-slate-900 mt-1">
                {satisfaction.totalSurveys}
              </p>
            </div>
          </div>

          {filteredSurveys.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">
              Aucun retour client sur la sélection.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {filteredSurveys.slice(0, 4).map((s) => (
                <li key={s.id} className="py-2.5 flex items-center justify-between gap-3">
                  <span className="text-slate-700 truncate">{s.comment || 'Avis client'}</span>
                  <span className="font-sans tabular-nums font-semibold text-amber-700 shrink-0">
                    {s.rating} / 5 ★
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <AccountingReportModal
        open={accountingModalOpen}
        onClose={() => setAccountingModalOpen(false)}
        defaultScope="both"
        defaultEntityId={entityFilter}
        defaultDateFrom={dateFrom}
        defaultDateTo={dateTo}
      />
    </div>
  );
}
