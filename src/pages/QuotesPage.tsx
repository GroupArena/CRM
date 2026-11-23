import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Plus,
  FileText,
  Download,
  ArrowRightCircle,
  CheckCircle2,
  XCircle,
  Edit2,
  Eye,
  FileSpreadsheet,
} from 'lucide-react';
import { useCrm } from '../context/CrmContext';
import { useAuth } from '../hooks/useAuth';
import { QUOTE_STATUSES, type Quote, type QuoteStatus } from '../types';
import { QuoteStatusBadge } from '../components/ui/StatusBadge';
import { EmptyState } from '../components/ui/EmptyState';
import { QuoteFormModal } from '../components/crm/QuoteFormModal';
import { QuoteDocumentModal } from '../components/crm/QuoteDocumentModal';
import { AccountingReportModal } from '../components/crm/AccountingReportModal';
import { formatCurrency, formatDateFr } from '../utils/crmLogic';
import { exportQuotePdf } from '../utils/pdfExport';

export function QuotesPage() {
  const {
    selectedEntityId,
    authorizedEntities,
    scopedQuotes,
    quotes,
    quoteItems,
    contacts,
    companies,
    legalSettings,
    globalSearch,
    updateQuoteStatus,
    convertQuoteToInvoice,
    addToast,
  } = useCrm();
  const { canWriteCrm } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [entityFilter, setEntityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | 'all'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [previewQuoteId, setPreviewQuoteId] = useState<string | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);

  useEffect(() => {
    const targetPreviewId = searchParams.get('preview');
    if (targetPreviewId && quotes.some((q) => q.id === targetPreviewId)) {
      setPreviewQuoteId(targetPreviewId);
    }
  }, [searchParams, quotes]);

  const previewQuote = useMemo(
    () => (previewQuoteId ? quotes.find((q) => q.id === previewQuoteId) ?? null : null),
    [previewQuoteId, quotes]
  );

  const filteredQuotes = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    return scopedQuotes
      .filter((quote) => {
        if (entityFilter !== 'all' && quote.entityId !== entityFilter) return false;
        if (statusFilter !== 'all' && quote.status !== statusFilter) return false;
        if (q) {
          const contact = contacts.find((c) => c.id === quote.contactId);
          const company = companies.find((c) => c.id === quote.companyId);
          const hay = [
            quote.quoteNumber,
            contact?.fullName ?? '',
            company?.legalName ?? '',
            company?.tradeName ?? '',
          ]
            .join(' ')
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => (b.issueDate || b.createdAt).localeCompare(a.issueDate || a.createdAt));
  }, [scopedQuotes, entityFilter, statusFilter, globalSearch, contacts, companies]);

  const totalQuoted = useMemo(
    () =>
      filteredQuotes
        .filter((q) => q.status !== 'Refusé' && q.status !== 'Expiré')
        .reduce((sum, q) => sum + (Number(q.total) || 0), 0),
    [filteredQuotes]
  );

  const acceptedCount = useMemo(
    () =>
      filteredQuotes.filter(
        (q) => q.status === 'Accepté' || q.status === 'Converti en facture'
      ).length,
    [filteredQuotes]
  );

  const handleExportPdf = async (quote: Quote) => {
    const items = quoteItems
      .filter((i) => i.quoteId === quote.id)
      .sort((a, b) => a.orderIndex - b.orderIndex);
    const entity = authorizedEntities.find((e) => e.id === quote.entityId);
    const legal = legalSettings.find((l) => l.entityId === quote.entityId);
    const company = companies.find((c) => c.id === quote.companyId);
    const contact = contacts.find((c) => c.id === quote.contactId);
    const filename = await exportQuotePdf(quote, items, { entity, legal, company, contact });
    addToast({ type: 'success', title: 'PDF généré', description: filename });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#19283E]">Devis</h1>
          <p className="text-sm text-slate-500 mt-1 tabular-nums">
            {filteredQuotes.length} devis · Montant actif : {formatCurrency(totalQuoted)} ·{' '}
            {acceptedCount} accepté(s)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setReportModalOpen(true)}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-[#19283E] hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="h-4 w-4 text-[#AD7300]" />
            Reporting comptable
          </button>

          {canWriteCrm && (
            <button
              type="button"
              onClick={() => {
                setEditingQuote(null);
                setModalOpen(true);
              }}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#19283E] px-4 text-sm font-medium text-white hover:bg-[#223552] whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4 text-[#C9A125]" />
              Créer un devis
            </button>
          )}
        </div>
      </div>

      {/* Filtres */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
          aria-label="Filtrer par statut"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as QuoteStatus | 'all')}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="all">Tous les statuts</option>
          {QUOTE_STATUSES.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>
      </div>

      {filteredQuotes.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title="Aucun devis trouvé"
          description="Créez un devis chiffré depuis le catalogue produits & services d'une entité."
        />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-3">Numéro</th>
                  <th className="py-3 px-3">Client / Contact</th>
                  <th className="py-3 px-3">Entité</th>
                  <th className="py-3 px-3">Émission / Validité</th>
                  <th className="py-3 px-3">Statut</th>
                  <th className="py-3 px-3 text-right">Total net</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredQuotes.map((quote) => {
                  const contact = contacts.find((c) => c.id === quote.contactId);
                  const company = companies.find((c) => c.id === quote.companyId);
                  const entity = authorizedEntities.find((e) => e.id === quote.entityId);
                  const canConvert =
                    quote.status === 'Accepté' || quote.status === 'Envoyé';

                  return (
                    <tr key={quote.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-3 font-sans tabular-nums text-xs font-semibold text-slate-900 whitespace-nowrap">
                        {quote.quoteNumber}
                      </td>
                      <td className="py-3 px-3 min-w-[140px]">
                        {company ? (
                          <Link
                            to={`/companies/${company.id}`}
                            className="font-medium text-slate-900 hover:text-blue-700 block leading-snug"
                          >
                            {company.tradeName || company.legalName}
                          </Link>
                        ) : (
                          <span className="font-medium text-slate-900 block leading-snug">
                            Particulier
                          </span>
                        )}
                        {contact && (
                          <Link
                            to={`/contacts/${contact.id}`}
                            className="text-xs text-slate-500 hover:text-blue-700 block"
                          >
                            {contact.fullName}
                          </Link>
                        )}
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-600 leading-snug max-w-[145px]">
                        {entity?.name ?? quote.entityId}
                      </td>
                      <td className="py-3 px-3 text-xs font-sans tabular-nums whitespace-nowrap">
                        <div className="text-slate-700">{formatDateFr(quote.issueDate)}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Val. {formatDateFr(quote.validUntil)}
                        </div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <QuoteStatusBadge status={quote.status} />
                      </td>
                      <td className="py-3 px-3 text-right font-sans tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                        {formatCurrency(quote.total, quote.currency)}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setPreviewQuoteId(quote.id)}
                            title="Aperçu A4"
                            aria-label={`Aperçu A4 ${quote.quoteNumber}`}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            <Eye className="h-3.5 w-3.5 text-[#19283E]" />
                            Aperçu
                          </button>

                          <button
                            type="button"
                            onClick={() => handleExportPdf(quote)}
                            title="Exporter en PDF"
                            aria-label={`Exporter ${quote.quoteNumber} en PDF`}
                            className="p-1.5 rounded text-slate-600 hover:bg-slate-100"
                          >
                            <Download className="h-4 w-4" />
                          </button>

                          {canWriteCrm && quote.status === 'Envoyé' && (
                            <>
                              <button
                                type="button"
                                onClick={() => updateQuoteStatus(quote.id, 'Accepté')}
                                title="Marquer Accepté"
                                aria-label={`Accepter ${quote.quoteNumber}`}
                                className="p-1.5 rounded text-emerald-700 hover:bg-emerald-50"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => updateQuoteStatus(quote.id, 'Refusé')}
                                title="Marquer Refusé"
                                aria-label={`Refuser ${quote.quoteNumber}`}
                                className="p-1.5 rounded text-red-700 hover:bg-red-50"
                              >
                                <XCircle className="h-4 w-4" />
                              </button>
                            </>
                          )}

                          {canWriteCrm && canConvert && !quote.convertedInvoiceId && (
                            <button
                              type="button"
                              onClick={() => convertQuoteToInvoice(quote.id)}
                              title="Convertir en facture"
                              className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 whitespace-nowrap"
                            >
                              <ArrowRightCircle className="h-3.5 w-3.5" />
                              Facturer
                            </button>
                          )}

                          {canWriteCrm && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingQuote(quote);
                                setModalOpen(true);
                              }}
                              title="Modifier"
                              aria-label={`Modifier ${quote.quoteNumber}`}
                              className="p-1.5 rounded text-slate-500 hover:bg-slate-100"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <QuoteFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialQuote={editingQuote}
      />

      <QuoteDocumentModal
        open={Boolean(previewQuote)}
        onClose={() => {
          setPreviewQuoteId(null);
          if (searchParams.has('preview')) {
            const next = new URLSearchParams(searchParams);
            next.delete('preview');
            setSearchParams(next, { replace: true });
          }
        }}
        quote={previewQuote}
      />

      <AccountingReportModal
        open={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        defaultScope="both"
        defaultEntityId={entityFilter !== 'all' ? entityFilter : selectedEntityId}
      />
    </div>
  );
}
