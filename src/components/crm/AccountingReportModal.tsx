import { useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, FileText, RotateCcw } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useCrm } from '../../context/CrmContext';
import { formatCurrency } from '../../utils/crmLogic';
import {
  buildAccountingReportCsv,
  compileAccountingReport,
  getAccountingReportFilename,
  type AccountingReportFilter,
  type AccountingReportGranularity,
  type AccountingReportScope,
} from '../../utils/accountingReport';
import { exportAccountingReportPdf } from '../../utils/accountingReportPdf';

interface AccountingReportModalProps {
  open: boolean;
  onClose: () => void;
  defaultScope?: AccountingReportScope;
  defaultEntityId?: string;
  defaultDateFrom?: string;
  defaultDateTo?: string;
}

export function AccountingReportModal({
  open,
  onClose,
  defaultScope = 'both',
  defaultEntityId = 'all',
  defaultDateFrom = '',
  defaultDateTo = '',
}: AccountingReportModalProps) {
  const {
    authorizedEntities,
    scopedInvoices,
    invoiceItems,
    scopedQuotes,
    quoteItems,
    scopedPayments,
    companies,
    contacts,
    addToast,
  } = useCrm();

  const [scope, setScope] = useState<AccountingReportScope>(defaultScope);
  const [entityId, setEntityId] = useState<string>(defaultEntityId);
  const [dateFrom, setDateFrom] = useState<string>(defaultDateFrom);
  const [dateTo, setDateTo] = useState<string>(defaultDateTo);
  const [granularity, setGranularity] = useState<AccountingReportGranularity>('document');
  const [includeInactive, setIncludeInactive] = useState<boolean>(false);

  useEffect(() => {
    if (!open) return;
    setScope(defaultScope);
    setEntityId(defaultEntityId || 'all');
    setDateFrom(defaultDateFrom || '');
    setDateTo(defaultDateTo || '');
  }, [open, defaultScope, defaultEntityId, defaultDateFrom, defaultDateTo]);

  const filter = useMemo<AccountingReportFilter>(
    () => ({
      scope,
      entityId,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      includeInactive,
      granularity,
      referenceDateIso: new Date().toISOString(),
    }),
    [scope, entityId, dateFrom, dateTo, includeInactive, granularity]
  );

  const report = useMemo(
    () =>
      compileAccountingReport(
        {
          entities: authorizedEntities,
          invoices: scopedInvoices,
          invoiceItems,
          quotes: scopedQuotes,
          quoteItems,
          payments: scopedPayments,
          companies,
          contacts,
        },
        filter
      ),
    [
      authorizedEntities,
      scopedInvoices,
      invoiceItems,
      scopedQuotes,
      quoteItems,
      scopedPayments,
      companies,
      contacts,
      filter,
    ]
  );

  const handleResetFilters = () => {
    setScope('both');
    setEntityId('all');
    setDateFrom('');
    setDateTo('');
    setGranularity('document');
    setIncludeInactive(false);
  };

  const handleDownloadCsv = () => {
    if (report.rows.length === 0) return;
    const csv = buildAccountingReportCsv(report, filter);
    const filename = getAccountingReportFilename(filter, authorizedEntities, 'csv');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    addToast({
      type: 'success',
      title: 'Reporting comptable CSV téléchargé',
      description: `${filename} (${report.rows.length} ligne(s))`,
    });
  };

  const handleDownloadPdf = () => {
    if (report.rows.length === 0) return;
    const filename = exportAccountingReportPdf(report, filter, authorizedEntities);
    addToast({
      type: 'success',
      title: 'Reporting comptable PDF téléchargé',
      description: `${filename} (${report.totalDocuments} document(s))`,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Reporting comptable compilé"
      subtitle="Export structuré des factures et devis pour la saisie des écritures comptables."
      maxWidthClass="max-w-4xl"
    >
      <div className="space-y-5">
        {/* Périmètre documentaire */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Documents à compiler
          </label>
          <div
            className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 w-full sm:w-auto"
            role="group"
            aria-label="Documents à compiler"
          >
            {(
              [
                { id: 'both', label: 'Factures & Devis (Compilé)' },
                { id: 'invoices', label: 'Factures uniquement' },
                { id: 'quotes', label: 'Devis uniquement' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setScope(opt.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  scope === opt.id
                    ? 'bg-white text-[#19283E] shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Critères d'extraction */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label htmlFor="acc-entity" className="block text-xs font-medium text-slate-600 mb-1">
              Entité
            </label>
            <select
              id="acc-entity"
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800"
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
            <label htmlFor="acc-granularity" className="block text-xs font-medium text-slate-600 mb-1">
              Niveau de détail
            </label>
            <select
              id="acc-granularity"
              value={granularity}
              onChange={(e) => setGranularity(e.target.value as AccountingReportGranularity)}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800"
            >
              <option value="document">Par document</option>
              <option value="line">Par ligne (détaillé)</option>
            </select>
          </div>

          <div>
            <label htmlFor="acc-from" className="block text-xs font-medium text-slate-600 mb-1">
              Émis du
            </label>
            <input
              id="acc-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800"
            />
          </div>

          <div>
            <label htmlFor="acc-to" className="block text-xs font-medium text-slate-600 mb-1">
              Au
            </label>
            <input
              id="acc-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-[#19283E]"
            />
            <span>Inclure brouillons, devis refusés/expirés et factures annulées</span>
          </label>

          <button
            type="button"
            onClick={handleResetFilters}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Réinitialiser
          </button>
        </div>

        {/* Synthèse de compilation */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
            <span className="text-xs font-semibold text-[#19283E]">
              Aperçu de la compilation
            </span>
            <span className="text-xs text-slate-600 tabular-nums">
              {report.invoiceCount} facture(s) · {report.quoteCount} devis · {report.rows.length}{' '}
              ligne(s) exportée(s)
            </span>
          </div>

          {report.totalsByCurrency.length === 0 ? (
            <p className="text-sm text-slate-500 py-3 text-center">
              Aucun document ne correspond aux filtres sélectionnés.
            </p>
          ) : (
            <div className="space-y-2.5">
              {report.totalsByCurrency.map((sum) => (
                <div
                  key={sum.currency}
                  className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-white rounded-lg border border-slate-200 p-3"
                >
                  <div>
                    <span className="text-slate-500 block">
                      Facturé net ({sum.currency})
                    </span>
                    <span className="font-semibold text-[#19283E] tabular-nums text-sm mt-0.5 block">
                      {formatCurrency(sum.invoicesNetTotal, sum.currency)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Encaissé</span>
                    <span className="font-semibold text-emerald-700 tabular-nums text-sm mt-0.5 block">
                      {formatCurrency(sum.invoicesPaid, sum.currency)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Solde dû</span>
                    <span className="font-semibold text-amber-700 tabular-nums text-sm mt-0.5 block">
                      {formatCurrency(sum.invoicesRemaining, sum.currency)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">
                      Total Devis ({sum.quoteCount})
                    </span>
                    <span className="font-semibold text-slate-900 tabular-nums text-sm mt-0.5 block">
                      {formatCurrency(sum.quotesTotal, sum.currency)}
                    </span>
                  </div>
                </div>
              ))}

              {/* Extrait des premières lignes compilées */}
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                      <th className="py-2 px-2.5">Document</th>
                      <th className="py-2 px-2.5">Date</th>
                      <th className="py-2 px-2.5">Client</th>
                      <th className="py-2 px-2.5">Statut</th>
                      <th className="py-2 px-2.5 text-right">
                        {granularity === 'line' ? 'Montant ligne' : 'Net / Total'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.rows.slice(0, 5).map((r) => (
                      <tr key={r.rowId}>
                        <td className="py-2 px-2.5 whitespace-nowrap">
                          <div className="font-semibold text-slate-900 tabular-nums">
                            {r.documentNumber}
                          </div>
                          <div className="text-[11px] text-slate-500">{r.documentSubType}</div>
                        </td>
                        <td className="py-2 px-2.5 whitespace-nowrap tabular-nums text-slate-600">
                          {r.issueDate}
                        </td>
                        <td className="py-2 px-2.5 max-w-[190px] truncate text-slate-800">
                          {r.clientName}
                          {granularity === 'line' && r.lineLabel ? ` — ${r.lineLabel}` : ''}
                        </td>
                        <td className="py-2 px-2.5 whitespace-nowrap text-slate-600">{r.status}</td>
                        <td className="py-2 px-2.5 text-right whitespace-nowrap font-semibold tabular-nums text-slate-900">
                          {formatCurrency(
                            granularity === 'line' && r.lineTotal !== null
                              ? r.lineTotal
                              : r.netTotal,
                            r.currency
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {report.rows.length > 5 && (
                  <div className="border-t border-slate-100 px-3 py-1.5 text-[11px] text-slate-500 bg-slate-50/50">
                    + {report.rows.length - 5} autre(s) ligne(s) incluse(s) dans le fichier téléchargé.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Colonnes incluses (info concise sans puces) */}
        <p className="text-xs text-slate-500 leading-relaxed">
          Colonnes comptables incluses dans le CSV : Catégorie, Type (Standard / Acompte / Solde /
          Devis), Numéro, Entité, Dates, Client (NIF / STAT / RCS), Référence liée, Total
          prestation 100 %, Acompte déduit, Net à payer, Encaissé, Solde dû, Équivalent EUR, Modes
          &amp; références de règlement.
        </p>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            Fermer
          </button>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={report.rows.length === 0}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-[#19283E] hover:bg-slate-50 disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <FileText className="h-4 w-4 text-[#AD7300]" />
            Télécharger PDF
          </button>

          <button
            type="button"
            onClick={handleDownloadCsv}
            disabled={report.rows.length === 0}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#19283E] px-4 text-sm font-medium text-white hover:bg-[#223552] disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <FileSpreadsheet className="h-4 w-4 text-[#C9A125]" />
            Télécharger CSV comptable
          </button>
        </div>
      </div>
    </Modal>
  );
}
