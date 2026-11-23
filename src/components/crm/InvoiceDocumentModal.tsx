import { useState } from 'react';
import {
  CheckCircle2,
  Download,
  Lock,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { InvoiceApprovalBadge, InvoiceStatusBadge } from '../ui/StatusBadge';
import { A4DocumentSheet } from './A4DocumentSheet';
import { useCrm } from '../../context/CrmContext';
import { useAuth } from '../../hooks/useAuth';
import type { Invoice } from '../../types';
import {
  canSendInvoiceToClient,
  canValidateInvoices,
  getEffectiveInvoiceApprovalStatus,
  resolveInvoiceStatus,
} from '../../utils/billingLogic';
import { exportInvoicePdf } from '../../utils/pdfExport';

interface InvoiceDocumentModalProps {
  open: boolean;
  onClose: () => void;
  invoice: Invoice | null;
}

export function InvoiceDocumentModal({ open, onClose, invoice }: InvoiceDocumentModalProps) {
  const {
    entities,
    invoices,
    invoiceItems,
    legalSettings,
    companies,
    contacts,
    approveInvoice,
    rejectInvoice,
    addToast,
  } = useCrm();
  const { user } = useAuth();

  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [busyAction, setBusyAction] = useState(false);

  if (!invoice) return null;

  const entity = entities.find((e) => e.id === invoice.entityId);
  const legal = legalSettings.find((l) => l.entityId === invoice.entityId);
  const company = companies.find((c) => c.id === invoice.companyId);
  const contact = contacts.find((c) => c.id === invoice.contactId);
  const items = invoiceItems
    .filter((i) => i.invoiceId === invoice.id)
    .sort((a, b) => a.orderIndex - b.orderIndex);

  const linkedDepositInvoice = invoice.deductedDepositInvoiceId
    ? invoices.find((i) => i.id === invoice.deductedDepositInvoiceId)
    : undefined;
  const resolvedDepositPercentage =
    invoice.depositPercentage && invoice.depositPercentage < 100
      ? invoice.depositPercentage
      : linkedDepositInvoice?.depositPercentage ?? invoice.depositPercentage;

  const approvalStatus = getEffectiveInvoiceApprovalStatus(invoice);
  const effectiveStatus = resolveInvoiceStatus(invoice, new Date().toISOString());
  const isSuperAdmin = canValidateInvoices(user);
  const canSendClient = canSendInvoiceToClient(invoice);

  const handleDownloadPdf = async () => {
    if (!canSendClient) {
      addToast({
        type: 'error',
        title: 'Validation Super Admin requise',
        description:
          'Cette facture doit être validée par un Super Admin avant téléchargement et envoi client.',
      });
      return;
    }
    const filename = await exportInvoicePdf(
      { ...invoice, depositPercentage: resolvedDepositPercentage },
      items,
      { entity, legal, company, contact }
    );
    addToast({ type: 'success', title: 'Facture PDF téléchargée', description: filename });
  };

  const handleApprove = async () => {
    setBusyAction(true);
    try {
      await approveInvoice(invoice.id);
      setRejectMode(false);
    } finally {
      setBusyAction(false);
    }
  };

  const handleReject = async () => {
    setBusyAction(true);
    try {
      await rejectInvoice(invoice.id, rejectReason);
      setRejectMode(false);
      setRejectReason('');
    } finally {
      setBusyAction(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Aperçu facture ${invoice.invoiceNumber}`}
      subtitle={`Modèle officiel ${entity?.name ?? 'Arena Group'} · Format A4 Charte graphique`}
      maxWidthClass="max-w-5xl"
    >
      <div className="space-y-4">
        {/* Bandeau statut & validation Super Admin */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <InvoiceStatusBadge status={effectiveStatus} />
              <InvoiceApprovalBadge status={approvalStatus} />
              {invoice.submittedByName && approvalStatus === 'pending_approval' && (
                <span className="text-xs text-slate-600">
                  Générée par <strong>{invoice.submittedByName}</strong> (Commercial)
                </span>
              )}
              {invoice.approvedByName && approvalStatus === 'approved' && (
                <span className="text-xs text-emerald-700">
                  Validée par <strong>{invoice.approvedByName}</strong>
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {isSuperAdmin && approvalStatus !== 'approved' && (
                <>
                  <button
                    type="button"
                    disabled={busyAction}
                    onClick={handleApprove}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Valider la facture
                  </button>
                  <button
                    type="button"
                    disabled={busyAction}
                    onClick={() => setRejectMode((v) => !v)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Refuser
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={!canSendClient}
                title={
                  canSendClient
                    ? 'Télécharger le PDF prêt pour envoi client'
                    : 'Validation Super Admin requise avant envoi client'
                }
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#19283E] px-3 text-xs font-medium text-white hover:bg-[#223552] disabled:bg-slate-300 disabled:text-slate-600 disabled:cursor-not-allowed"
              >
                {canSendClient ? (
                  <Download className="h-3.5 w-3.5 text-[#C9A125]" />
                ) : (
                  <Lock className="h-3.5 w-3.5" />
                )}
                {canSendClient ? 'Télécharger PDF client' : 'Envoi bloqué (non validée)'}
              </button>
            </div>
          </div>

          {approvalStatus === 'pending_approval' && !isSuperAdmin && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 flex items-center gap-2">
              <Lock className="h-3.5 w-3.5 shrink-0 text-amber-700" />
              <span>
                Cette facture générée par un Commercial doit être validée par un{' '}
                <strong>Super Admin</strong> avant export PDF définitif et envoi au client.
              </span>
            </div>
          )}

          {approvalStatus === 'rejected' && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <div>
                <strong>Facture refusée par {invoice.rejectedByName || 'Super Admin'} :</strong>{' '}
                {invoice.rejectedReason || 'Correction requise avant envoi client.'}
              </div>
            </div>
          )}

          {rejectMode && isSuperAdmin && (
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <input
                type="text"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Motif du refus / correction attendue..."
                className="flex-1 h-8 rounded-lg border border-red-200 bg-white px-3 text-xs"
              />
              <button
                type="button"
                disabled={busyAction}
                onClick={handleReject}
                className="h-8 rounded-lg bg-red-600 px-3 text-xs font-medium text-white hover:bg-red-700"
              >
                Confirmer le refus
              </button>
            </div>
          )}
        </div>

        {/* Document A4 répliquant Facture - Modele.pdf */}
        <A4DocumentSheet
          kind="invoice"
          testId="invoice-model-preview"
          documentNumber={invoice.invoiceNumber}
          entityId={invoice.entityId}
          issueDate={invoice.issueDate}
          secondaryDate={invoice.dueDate}
          currency={invoice.currency}
          subtotal={invoice.subtotal}
          total={invoice.total}
          invoiceType={invoice.invoiceType}
          depositPercentage={resolvedDepositPercentage}
          deductedDepositAmount={invoice.deductedDepositAmount}
          showEuroConversion={invoice.showEuroConversion}
          euroExchangeRate={invoice.euroExchangeRate}
          euroBankName={invoice.euroBankName}
          euroRateDate={invoice.euroRateDate}
          notes={invoice.notes}
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
