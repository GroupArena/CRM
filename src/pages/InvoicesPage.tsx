import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Receipt,
  Download,
  CreditCard,
  Edit2,
  ShieldCheck,
  Eye,
  CheckCircle2,
  Clock,
  Lock,
  FileSpreadsheet,
} from 'lucide-react';
import { useCrm } from '../context/CrmContext';
import { useAuth } from '../hooks/useAuth';
import {
  INVOICE_STATUSES,
  type Invoice,
  type InvoiceApprovalStatus,
  type InvoiceStatus,
} from '../types';
import { InvoiceApprovalBadge, InvoiceStatusBadge } from '../components/ui/StatusBadge';
import { EmptyState } from '../components/ui/EmptyState';
import { InvoiceFormModal } from '../components/crm/InvoiceFormModal';
import { InvoiceDocumentModal } from '../components/crm/InvoiceDocumentModal';
import { PaymentFormModal } from '../components/crm/PaymentFormModal';
import { AccountingReportModal } from '../components/crm/AccountingReportModal';
import { formatCurrency, formatDateFr } from '../utils/crmLogic';
import {
  canSendInvoiceToClient,
  canValidateInvoices,
  getEffectiveInvoiceApprovalStatus,
  resolveInvoiceStatus,
} from '../utils/billingLogic';
import { exportInvoicePdf } from '../utils/pdfExport';

export function InvoicesPage() {
  const {
    selectedEntityId,
    authorizedEntities,
    scopedInvoices,
    invoices,
    invoiceItems,
    contacts,
    companies,
    legalSettings,
    globalSearch,
    approveInvoice,
    addToast,
  } = useCrm();
  const { canWriteCrm, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [entityFilter, setEntityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');
  const [approvalFilter, setApprovalFilter] = useState<InvoiceApprovalStatus | 'all'>('all');
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [previewInvoiceId, setPreviewInvoiceId] = useState<string | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);

  const isSuperAdmin = canValidateInvoices(user);
  const todayIso = new Date().toISOString();

  useEffect(() => {
    const targetPreviewId = searchParams.get('preview');
    if (targetPreviewId && invoices.some((i) => i.id === targetPreviewId)) {
      setPreviewInvoiceId(targetPreviewId);
    }
  }, [searchParams, invoices]);

  const previewInvoice = useMemo(
    () => (previewInvoiceId ? invoices.find((i) => i.id === previewInvoiceId) ?? null : null),
    [previewInvoiceId, invoices]
  );

  const pendingCount = useMemo(
    () =>
      scopedInvoices.filter(
        (inv) => getEffectiveInvoiceApprovalStatus(inv) === 'pending_approval'
      ).length,
    [scopedInvoices]
  );

  const enrichedInvoices = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    return scopedInvoices
      .map((inv) => ({
        ...inv,
        effectiveStatus: resolveInvoiceStatus(inv, todayIso),
        effectiveApproval: getEffectiveInvoiceApprovalStatus(inv),
      }))
      .filter((inv) => {
        if (entityFilter !== 'all' && inv.entityId !== entityFilter) return false;
        if (statusFilter !== 'all' && inv.effectiveStatus !== statusFilter) return false;
        if (approvalFilter !== 'all' && inv.effectiveApproval !== approvalFilter) return false;
        if (q) {
          const contact = contacts.find((c) => c.id === inv.contactId);
          const company = companies.find((c) => c.id === inv.companyId);
          const hay = [
            inv.invoiceNumber,
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
  }, [
    scopedInvoices,
    entityFilter,
    statusFilter,
    approvalFilter,
    globalSearch,
    contacts,
    companies,
    todayIso,
  ]);

  const summary = useMemo(() => {
    const active = enrichedInvoices.filter(
      (i) => i.effectiveStatus !== 'Annulée' && i.effectiveStatus !== 'Brouillon'
    );
    return {
      billed: active.reduce((sum, i) => sum + (Number(i.total) || 0), 0),
      paid: active.reduce((sum, i) => sum + (Number(i.paidAmount) || 0), 0),
      remaining: active.reduce((sum, i) => sum + (Number(i.remainingAmount) || 0), 0),
    };
  }, [enrichedInvoices]);

  const activeScopeEntityId =
    entityFilter !== 'all'
      ? entityFilter
      : selectedEntityId !== 'all'
      ? selectedEntityId
      : null;
  const activeLegal = activeScopeEntityId
    ? legalSettings.find((l) => l.entityId === activeScopeEntityId)
    : null;

  const handleExportPdf = async (inv: Invoice) => {
    if (!canSendInvoiceToClient(inv)) {
      addToast({
        type: 'error',
        title: 'Validation Super Admin requise',
        description:
          'Cette facture doit être validée par un Super Admin avant export PDF et envoi client.',
      });
      return;
    }
    const items = invoiceItems
      .filter((i) => i.invoiceId === inv.id)
      .sort((a, b) => a.orderIndex - b.orderIndex);
    const entity = authorizedEntities.find((e) => e.id === inv.entityId);
    const legal = legalSettings.find((l) => l.entityId === inv.entityId);
    const company = companies.find((c) => c.id === inv.companyId);
    const contact = contacts.find((c) => c.id === inv.contactId);
    const linkedDep = inv.deductedDepositInvoiceId
      ? invoices.find((i) => i.id === inv.deductedDepositInvoiceId)
      : undefined;
    const resolvedPct =
      inv.depositPercentage && inv.depositPercentage < 100
        ? inv.depositPercentage
        : linkedDep?.depositPercentage ?? inv.depositPercentage;
    const filename = await exportInvoicePdf(
      { ...inv, depositPercentage: resolvedPct },
      items,
      { entity, legal, company, contact }
    );
    addToast({ type: 'success', title: 'Facture PDF exportée', description: filename });
  };

  const closePreviewModal = () => {
    setPreviewInvoiceId(null);
    if (searchParams.has('preview')) {
      const next = new URLSearchParams(searchParams);
      next.delete('preview');
      setSearchParams(next, { replace: true });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#19283E]">Factures</h1>
          <p className="text-sm text-slate-500 mt-1 tabular-nums">
            {enrichedInvoices.length} facture(s) · Facturé : {formatCurrency(summary.billed)} ·
            Encaissé : {formatCurrency(summary.paid)} · Solde dû :{' '}
            {formatCurrency(summary.remaining)}
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
                setEditingInvoice(null);
                setInvoiceModalOpen(true);
              }}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#19283E] px-4 text-sm font-medium text-white hover:bg-[#223552] whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4 text-[#C9A125]" />
              Nouvelle facture
            </button>
          )}
        </div>
      </div>

      {pendingCount > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs sm:text-sm text-amber-900">
            <Clock className="h-4 w-4 text-amber-700 shrink-0" />
            <span>
              <strong>{pendingCount} facture(s) commerciale(s)</strong> en attente de validation Super Admin avant envoi client.
            </span>
          </div>
          <button
            type="button"
            onClick={() =>
              setApprovalFilter((prev) =>
                prev === 'pending_approval' ? 'all' : 'pending_approval'
              )
            }
            className="h-8 rounded-lg border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-900 hover:bg-amber-100"
          >
            {approvalFilter === 'pending_approval'
              ? 'Afficher toutes les factures'
              : `Voir les ${pendingCount} à valider`}
          </button>
        </div>
      )}

      {activeLegal && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-700">
          <div className="flex items-center gap-2 font-medium text-slate-900">
            <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0" />
            <span>
              Émetteur : <strong>{activeLegal.legalName}</strong> ({activeLegal.entityCode})
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4 font-sans tabular-nums text-slate-600">
            <span>NIF : {activeLegal.nif || '—'}</span>
            <span>STAT : {activeLegal.stat || '—'}</span>
            <span>RCS : {activeLegal.rcs || '—'}</span>
            <span className="font-sans text-slate-500">TVA non applicable</span>
          </div>
        </div>
      )}

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
          onChange={(e) => setStatusFilter(e.target.value as InvoiceStatus | 'all')}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="all">Tous les statuts</option>
          {INVOICE_STATUSES.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>

        <select
          aria-label="Filtrer par validation"
          value={approvalFilter}
          onChange={(e) => setApprovalFilter(e.target.value as InvoiceApprovalStatus | 'all')}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="all">Toutes les validations</option>
          <option value="pending_approval">En attente validation</option>
          <option value="approved">Validées</option>
          <option value="rejected">Refusées</option>
        </select>
      </div>

      {enrichedInvoices.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-6 w-6" />}
          title="Aucune facture sur ce périmètre"
          description="Émettez une facture ou convertissez un devis accepté depuis le module Devis."
        />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-3">Numéro &amp; Échéance</th>
                  <th className="py-3 px-3">Client / Contact</th>
                  <th className="py-3 px-3">Entité</th>
                  <th className="py-3 px-3">Statut &amp; Validation</th>
                  <th className="py-3 px-3 text-right">Total net</th>
                  <th className="py-3 px-3 text-right">Reste / Payé</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {enrichedInvoices.map((inv) => {
                  const contact = contacts.find((c) => c.id === inv.contactId);
                  const company = companies.find((c) => c.id === inv.companyId);
                  const entity = authorizedEntities.find((e) => e.id === inv.entityId);
                  const canSendClient = canSendInvoiceToClient(inv);
                  const canPay =
                    canSendClient &&
                    inv.effectiveStatus !== 'Payée' &&
                    inv.effectiveStatus !== 'Annulée';

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-sans tabular-nums text-xs font-semibold text-slate-900">
                          {inv.invoiceNumber}
                        </div>
                        {inv.invoiceType === 'deposit' ? (
                          <div className="text-[11px] font-medium text-[#AD7300] mt-0.5">
                            Acompte {inv.depositPercentage ?? 100}%
                          </div>
                        ) : inv.invoiceType === 'balance' ||
                          (inv.deductedDepositAmount && inv.deductedDepositAmount > 0) ? (
                          <div className="text-[11px] font-medium text-emerald-700 mt-0.5">
                            Solde · Acompte{' '}
                            {inv.depositPercentage && inv.depositPercentage < 100
                              ? `${inv.depositPercentage}% `
                              : ''}
                            payé déduit
                          </div>
                        ) : null}
                        <div className="text-[11px] font-sans tabular-nums text-slate-500 mt-0.5">
                          Éch. {formatDateFr(inv.dueDate)}
                        </div>
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
                        {entity?.name ?? inv.entityId}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex flex-col items-start gap-1">
                          <InvoiceStatusBadge status={inv.effectiveStatus} />
                          <InvoiceApprovalBadge status={inv.effectiveApproval} />
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-sans tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                        {formatCurrency(inv.total, inv.currency)}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="font-sans tabular-nums font-semibold text-slate-900">
                          {formatCurrency(inv.remainingAmount, inv.currency)}
                        </div>
                        <div className="text-[11px] font-sans tabular-nums text-emerald-700 mt-0.5">
                          Payé : {formatCurrency(inv.paidAmount, inv.currency)}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setPreviewInvoiceId(inv.id)}
                            title="Aperçu modèle"
                            aria-label={`Aperçu facture ${inv.invoiceNumber}`}
                            className="p-1.5 rounded text-[#19283E] hover:bg-slate-100"
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          {isSuperAdmin && inv.effectiveApproval !== 'approved' && (
                            <button
                              type="button"
                              onClick={() => approveInvoice(inv.id)}
                              title="Valider pour envoi client"
                              className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700 whitespace-nowrap"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Valider
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleExportPdf(inv)}
                            title={
                              canSendClient
                                ? 'Exporter PDF client'
                                : 'Validation Super Admin requise avant envoi client'
                            }
                            aria-label={`Exporter ${inv.invoiceNumber} en PDF`}
                            className={`p-1.5 rounded ${
                              canSendClient
                                ? 'text-slate-600 hover:bg-slate-100'
                                : 'text-slate-300 cursor-not-allowed'
                            }`}
                          >
                            {canSendClient ? (
                              <Download className="h-4 w-4" />
                            ) : (
                              <Lock className="h-4 w-4" />
                            )}
                          </button>

                          {canWriteCrm && canPay && (
                            <button
                              type="button"
                              onClick={() => {
                                setPaymentInvoice(inv);
                                setPaymentModalOpen(true);
                              }}
                              title="Enregistrer paiement"
                              className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100 whitespace-nowrap"
                            >
                              <CreditCard className="h-3.5 w-3.5" />
                              Encaisser
                            </button>
                          )}

                          {canWriteCrm && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingInvoice(inv);
                                setInvoiceModalOpen(true);
                              }}
                              title="Modifier"
                              aria-label={`Modifier ${inv.invoiceNumber}`}
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

      <InvoiceFormModal
        open={invoiceModalOpen}
        onClose={() => setInvoiceModalOpen(false)}
        initialInvoice={editingInvoice}
      />

      <InvoiceDocumentModal
        open={Boolean(previewInvoice)}
        onClose={closePreviewModal}
        invoice={previewInvoice}
      />

      <PaymentFormModal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        invoice={paymentInvoice}
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

