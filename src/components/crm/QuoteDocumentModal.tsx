import { useState } from 'react';
import { ArrowRightCircle, CheckCircle2, Download, XCircle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { QuoteStatusBadge } from '../ui/StatusBadge';
import { A4DocumentSheet } from './A4DocumentSheet';
import { useCrm } from '../../context/CrmContext';
import { useAuth } from '../../hooks/useAuth';
import type { Quote } from '../../types';
import { exportQuotePdf } from '../../utils/pdfExport';

interface QuoteDocumentModalProps {
  open: boolean;
  onClose: () => void;
  quote: Quote | null;
}

export function QuoteDocumentModal({ open, onClose, quote }: QuoteDocumentModalProps) {
  const {
    entities,
    quoteItems,
    legalSettings,
    companies,
    contacts,
    updateQuoteStatus,
    convertQuoteToInvoice,
    addToast,
  } = useCrm();
  const { canWriteCrm } = useAuth();
  const [busyAction, setBusyAction] = useState(false);

  if (!quote) return null;

  const entity = entities.find((e) => e.id === quote.entityId);
  const legal = legalSettings.find((l) => l.entityId === quote.entityId);
  const company = companies.find((c) => c.id === quote.companyId);
  const contact = contacts.find((c) => c.id === quote.contactId);
  const items = quoteItems
    .filter((i) => i.quoteId === quote.id)
    .sort((a, b) => a.orderIndex - b.orderIndex);

  const canConvert =
    canWriteCrm &&
    (quote.status === 'Accepté' || quote.status === 'Envoyé') &&
    !quote.convertedInvoiceId;

  const handleDownloadPdf = async () => {
    const filename = await exportQuotePdf(quote, items, { entity, legal, company, contact });
    addToast({ type: 'success', title: 'Devis PDF téléchargé', description: filename });
  };

  const handleConvert = async () => {
    setBusyAction(true);
    try {
      await convertQuoteToInvoice(quote.id);
      onClose();
    } finally {
      setBusyAction(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Aperçu devis ${quote.quoteNumber}`}
      subtitle={`Modèle officiel ${entity?.name ?? 'Arena Group'} · Format A4 Charte graphique`}
      maxWidthClass="max-w-5xl"
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <QuoteStatusBadge status={quote.status} />
            {quote.convertedInvoiceId && (
              <span className="text-xs font-medium text-emerald-700">
                Déjà converti en facture
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canWriteCrm && quote.status === 'Envoyé' && (
              <>
                <button
                  type="button"
                  disabled={busyAction}
                  onClick={() => updateQuoteStatus(quote.id, 'Accepté')}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Accepter
                </button>
                <button
                  type="button"
                  disabled={busyAction}
                  onClick={() => updateQuoteStatus(quote.id, 'Refusé')}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Refuser
                </button>
              </>
            )}

            {canConvert && (
              <button
                type="button"
                disabled={busyAction}
                onClick={handleConvert}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
              >
                <ArrowRightCircle className="h-3.5 w-3.5" />
                Convertir en facture
              </button>
            )}

            <button
              type="button"
              onClick={handleDownloadPdf}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#19283E] px-3 text-xs font-medium text-white hover:bg-[#223552]"
            >
              <Download className="h-3.5 w-3.5 text-[#C9A125]" />
              Télécharger PDF client
            </button>
          </div>
        </div>

        <A4DocumentSheet
          kind="quote"
          testId="quote-model-preview"
          documentNumber={quote.quoteNumber}
          entityId={quote.entityId}
          issueDate={quote.issueDate}
          secondaryDate={quote.validUntil}
          currency={quote.currency}
          subtotal={quote.subtotal}
          total={quote.total}
          showEuroConversion={quote.showEuroConversion}
          euroExchangeRate={quote.euroExchangeRate}
          euroBankName={quote.euroBankName}
          euroRateDate={quote.euroRateDate}
          notes={quote.notes}
          items={items}
          entity={entity}
          legal={legal}
          company={company}
          contact={contact}
        />
      </div>
    </Modal>
  );
}
