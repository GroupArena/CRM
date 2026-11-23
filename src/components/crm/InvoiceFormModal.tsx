import React, { useEffect, useMemo, useState } from 'react';
import { Eye, FileEdit, Plus, Trash2, ShieldAlert } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { A4DocumentSheet } from './A4DocumentSheet';
import { useCrm } from '../../context/CrmContext';
import { useAuth } from '../../hooks/useAuth';
import {
  INVOICE_STATUSES,
  SUPPORTED_CURRENCIES,
  type Invoice,
  type InvoiceStatus,
  type InvoiceType,
} from '../../types';
import {
  addDaysToDateIso,
  buildBalanceLinesFromDepositItems,
  computeEuroConversion,
  computeInvoiceTotals,
  getDepositInvoicesForEntity,
  requiresSuperAdminValidation,
  resolveProductUnitPrice,
  type LineInput,
} from '../../utils/billingLogic';
import { formatCurrency } from '../../utils/crmLogic';
import { formatInvoiceAmountInWords } from '../../utils/numberToWordsFr';

interface InvoiceFormModalProps {
  open: boolean;
  onClose: () => void;
  defaultEntityId?: string;
  defaultContactId?: string;
  defaultCompanyId?: string;
  initialInvoice?: Invoice | null;
}

export function InvoiceFormModal({
  open,
  onClose,
  defaultEntityId,
  defaultContactId,
  defaultCompanyId,
  initialInvoice,
}: InvoiceFormModalProps) {
  const {
    authorizedEntities,
    selectedEntityId,
    contacts,
    companies,
    products,
    invoices,
    invoiceItems,
    legalSettings,
    settings,
    createInvoice,
    updateInvoice,
  } = useCrm();
  const { user } = useAuth();
  const isSalesCreator = requiresSuperAdminValidation(user);

  const resolvedEntity =
    defaultEntityId ||
    (selectedEntityId !== 'all' ? selectedEntityId : authorizedEntities[0]?.id ?? 'arena-business-center');

  const [entityId, setEntityId] = useState(resolvedEntity);
  const [contactId, setContactId] = useState(defaultContactId ?? '');
  const [companyId, setCompanyId] = useState(defaultCompanyId ?? '');
  const [invoiceType, setInvoiceType] = useState<InvoiceType>('standard');
  const [depositPercentage, setDepositPercentage] = useState<number>(30);
  const [deductedDepositInvoiceId, setDeductedDepositInvoiceId] = useState<string>('');
  const [status, setStatus] = useState<InvoiceStatus>('Émise');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(
    addDaysToDateIso(new Date().toISOString().slice(0, 10), 30)
  );
  const [currency, setCurrency] = useState(settings.defaultCurrency || 'MGA');
  const [showEuroConversion, setShowEuroConversion] = useState(false);
  const [euroExchangeRate, setEuroExchangeRate] = useState<string>('4576');
  const [euroBankName, setEuroBankName] = useState('BNI Madagascar');
  const [euroRateDate, setEuroRateDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [legalMentions, setLegalMentions] = useState('');
  const [lines, setLines] = useState<LineInput[]>([]);
  const [selectedCatalogId, setSelectedCatalogId] = useState('');
  const [activeTab, setActiveTab] = useState<'form' | 'preview'>('form');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const entityProducts = useMemo(
    () =>
      products.filter(
        (p) => p.active && (p.entityIds.length === 0 || p.entityIds.includes(entityId))
      ),
    [products, entityId]
  );

  const entityDepositOptions = useMemo(
    () =>
      getDepositInvoicesForEntity(invoices, {
        entityId,
        excludeInvoiceId: initialInvoice?.id,
      }),
    [invoices, entityId, initialInvoice?.id]
  );

  const selectedDepositInvoice = useMemo(
    () => entityDepositOptions.find((inv) => inv.id === deductedDepositInvoiceId) ?? null,
    [entityDepositOptions, deductedDepositInvoiceId]
  );

  useEffect(() => {
    if (
      deductedDepositInvoiceId &&
      !entityDepositOptions.some((inv) => inv.id === deductedDepositInvoiceId)
    ) {
      setDeductedDepositInvoiceId('');
    }
  }, [deductedDepositInvoiceId, entityDepositOptions]);

  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);
    setActiveTab('form');
    if (initialInvoice) {
      const initialType: InvoiceType =
        initialInvoice.invoiceType === 'deposit'
          ? 'deposit'
          : initialInvoice.invoiceType === 'balance' ||
            (Boolean(initialInvoice.deductedDepositInvoiceId) &&
              Boolean(initialInvoice.deductedDepositAmount && initialInvoice.deductedDepositAmount > 0))
          ? 'balance'
          : 'standard';
      setEntityId(initialInvoice.entityId);
      setContactId(initialInvoice.contactId);
      setCompanyId(initialInvoice.companyId);
      setInvoiceType(initialType);
      if (initialType === 'deposit' && initialInvoice.depositPercentage) {
        setDepositPercentage(initialInvoice.depositPercentage);
      } else if (initialType === 'balance') {
        const linkedDep = invoices.find((i) => i.id === initialInvoice.deductedDepositInvoiceId);
        setDepositPercentage(
          initialInvoice.depositPercentage && initialInvoice.depositPercentage < 100
            ? initialInvoice.depositPercentage
            : linkedDep?.depositPercentage ?? 30
        );
      } else {
        setDepositPercentage(30);
      }
      setDeductedDepositInvoiceId(initialInvoice.deductedDepositInvoiceId ?? '');
      setStatus(initialInvoice.status);
      setIssueDate(initialInvoice.issueDate);
      setDueDate(initialInvoice.dueDate);
      setCurrency(initialInvoice.currency || settings.defaultCurrency || 'MGA');
      setShowEuroConversion(Boolean(initialInvoice.showEuroConversion));
      setEuroExchangeRate(
        initialInvoice.euroExchangeRate ? String(initialInvoice.euroExchangeRate) : '4576'
      );
      setEuroBankName(initialInvoice.euroBankName || 'BNI Madagascar');
      setEuroRateDate(initialInvoice.euroRateDate || initialInvoice.issueDate);
      setNotes(initialInvoice.notes);
      setLegalMentions(initialInvoice.legalMentions);
      const existing = invoiceItems
        .filter((i) => i.invoiceId === initialInvoice.id)
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((i) => ({
          id: i.id,
          productId: i.productId,
          label: i.label,
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          vatRate: 0,
          orderIndex: i.orderIndex,
        }));
      setLines(existing);
    } else {
      const today = new Date().toISOString().slice(0, 10);
      const legal = legalSettings.find((l) => l.entityId === resolvedEntity);
      setEntityId(resolvedEntity);
      setContactId(defaultContactId || contacts[0]?.id || '');
      setCompanyId(defaultCompanyId || contacts[0]?.companyId || '');
      setInvoiceType('standard');
      setDepositPercentage(30);
      setDeductedDepositInvoiceId('');
      setStatus(isSalesCreator ? 'Brouillon' : 'Émise');
      setIssueDate(today);
      setDueDate(addDaysToDateIso(today, 30));
      setCurrency(settings.defaultCurrency || 'MGA');
      setShowEuroConversion(false);
      setEuroExchangeRate('4576');
      setEuroBankName(legal?.bankName || 'BNI Madagascar');
      setEuroRateDate(today);
      setNotes('');
      setLegalMentions(legal?.defaultLegalMentions || '');
      setLines([]);
    }
  }, [
    open,
    initialInvoice,
    resolvedEntity,
    defaultContactId,
    defaultCompanyId,
    contacts,
    products,
    invoiceItems,
    legalSettings,
    settings.defaultCurrency,
  ]);

  const rawDeductedDepositAmount =
    invoiceType === 'balance' && selectedDepositInvoice
      ? selectedDepositInvoice.paidAmount > 0
        ? selectedDepositInvoice.paidAmount
        : selectedDepositInvoice.total
      : invoiceType === 'balance' && initialInvoice?.deductedDepositAmount
      ? initialInvoice.deductedDepositAmount
      : 0;

  const effectiveDepositPct =
    invoiceType === 'balance' && selectedDepositInvoice?.depositPercentage
      ? selectedDepositInvoice.depositPercentage
      : depositPercentage;

  const totals = useMemo(
    () =>
      computeInvoiceTotals(lines, {
        invoiceType,
        depositPercentage: effectiveDepositPct,
        deductedDepositAmount: rawDeductedDepositAmount,
      }),
    [lines, invoiceType, effectiveDepositPct, rawDeductedDepositAmount]
  );

  const euroPreview = useMemo(() => {
    if (!showEuroConversion) return null;
    return computeEuroConversion(totals.total, Number(euroExchangeRate));
  }, [showEuroConversion, totals.total, euroExchangeRate]);

  const previewEntity = authorizedEntities.find((e) => e.id === entityId);
  const previewLegal = legalSettings.find((l) => l.entityId === entityId);
  const previewCompany = companies.find((c) => c.id === companyId);
  const previewContact = contacts.find((c) => c.id === contactId);

  const addProductLine = (productIdToAdd?: string) => {
    const prod = products.find((p) => p.id === (productIdToAdd || selectedCatalogId));
    const nextLine: LineInput = prod
      ? {
          id: `il-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          productId: prod.id,
          label: prod.name,
          description: prod.description,
          quantity: 1,
          unitPrice: resolveProductUnitPrice(prod, 1),
          vatRate: 0,
          orderIndex: lines.length,
        }
      : {
          id: `il-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          label: 'Nouvelle ligne',
          description: '',
          quantity: 1,
          unitPrice: 150000,
          vatRate: 0,
          orderIndex: lines.length,
        };
    setLines((prev) => [...prev, nextLine]);
  };

  const updateLine = (index: number, patch: Partial<LineInput>) => {
    setLines((prev) =>
      prev.map((l, idx) => {
        if (idx !== index) return l;
        const updated = { ...l, ...patch, vatRate: 0 };
        if (patch.quantity !== undefined && l.productId) {
          const prod = products.find((p) => p.id === l.productId);
          if (prod && prod.pricingType === 'tiered') {
            updated.unitPrice = resolveProductUnitPrice(prod, patch.quantity);
          }
        }
        return updated;
      })
    );
  };

  const removeLine = (index: number) => {
    setLines((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSelectDepositInvoice = (depId: string) => {
    setDeductedDepositInvoiceId(depId);
    const dep = entityDepositOptions.find((inv) => inv.id === depId);
    if (!dep) return;

    setContactId(dep.contactId);
    setCompanyId(dep.companyId || '');
    if (dep.currency) {
      setCurrency(dep.currency);
    }
    if (dep.depositPercentage && dep.depositPercentage > 0) {
      setDepositPercentage(dep.depositPercentage);
    }
    if (dep.showEuroConversion && dep.euroExchangeRate) {
      setShowEuroConversion(true);
      setEuroExchangeRate(String(dep.euroExchangeRate));
      if (dep.euroBankName) setEuroBankName(dep.euroBankName);
      if (dep.euroRateDate) setEuroRateDate(dep.euroRateDate);
    }
    const clonedLines = buildBalanceLinesFromDepositItems(invoiceItems, dep.id);
    if (clonedLines.length > 0) {
      setLines(clonedLines);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityId || !contactId || lines.length === 0) {
      setErrorMsg('Veuillez sélectionner un contact, une entité et au moins une ligne.');
      setActiveTab('form');
      return;
    }
    if (
      invoiceType === 'deposit' &&
      (!Number.isFinite(depositPercentage) || depositPercentage <= 0 || depositPercentage > 100)
    ) {
      setErrorMsg("Le pourcentage d'acompte doit être compris entre 1 % et 100 %.");
      setActiveTab('form');
      return;
    }
    if (invoiceType === 'balance' && !deductedDepositInvoiceId) {
      setErrorMsg("Veuillez sélectionner une facture d'acompte émise par cette entité.");
      setActiveTab('form');
      return;
    }
    const parsedEuroRate = Number(euroExchangeRate);
    if (showEuroConversion && (!Number.isFinite(parsedEuroRate) || parsedEuroRate <= 0)) {
      setErrorMsg("Veuillez saisir un cours d'achat Euro valide (strictement positif).");
      setActiveTab('form');
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const cleanDeductedId =
        invoiceType === 'balance' && deductedDepositInvoiceId ? deductedDepositInvoiceId : undefined;
      const cleanDeductedAmount =
        cleanDeductedId && totals.deductedDepositAmount > 0 ? totals.deductedDepositAmount : undefined;
      const persistedDepositPct =
        invoiceType === 'deposit' || invoiceType === 'balance' ? totals.depositPercentage : 100;

      if (initialInvoice) {
        await updateInvoice(
          {
            ...initialInvoice,
            entityId,
            contactId,
            companyId,
            invoiceType,
            depositPercentage: persistedDepositPct,
            deductedDepositInvoiceId: cleanDeductedId,
            deductedDepositAmount: cleanDeductedAmount,
            showEuroConversion,
            euroExchangeRate: showEuroConversion ? parsedEuroRate : undefined,
            euroBankName: showEuroConversion ? euroBankName.trim() : undefined,
            euroRateDate: showEuroConversion ? euroRateDate : undefined,
            status,
            issueDate,
            dueDate,
            currency,
            notes,
            legalMentions,
          },
          lines
        );
      } else {
        await createInvoice({
          entityId,
          contactId,
          companyId,
          invoiceType,
          depositPercentage: persistedDepositPct,
          deductedDepositInvoiceId: cleanDeductedId,
          deductedDepositAmount: cleanDeductedAmount,
          showEuroConversion,
          euroExchangeRate: showEuroConversion ? parsedEuroRate : undefined,
          euroBankName: showEuroConversion ? euroBankName.trim() : undefined,
          euroRateDate: showEuroConversion ? euroRateDate : undefined,
          status,
          issueDate,
          dueDate,
          currency,
          notes,
          legalMentions,
          lines,
        });
      }
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur lors de la création de la facture.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialInvoice ? `Modifier la facture ${initialInvoice.invoiceNumber}` : 'Créer une nouvelle facture'}
      subtitle="Numérotation automatique FAC-{ENTITÉ}-{ANNÉE}-{NUMÉRO} avec mentions légales NIF / STAT / RCS (TVA non applicable)."
      maxWidthClass={activeTab === 'preview' ? 'max-w-5xl' : 'max-w-2xl'}
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Sélecteur Saisie / Prévisualisation A4 */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('form')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === 'form'
                  ? 'bg-white text-[#19283E] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileEdit className="h-3.5 w-3.5" />
              Saisie facture
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === 'preview'
                  ? 'bg-white text-[#19283E] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="h-3.5 w-3.5 text-[#C9A125]" />
              Prévisualisation A4
            </button>
          </div>
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            Aperçu en direct au format A4 officiel
          </span>
        </div>

        {isSalesCreator && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900 flex items-start gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
            <span>
              <strong>Validation Super Admin requise :</strong> en tant que Commercial, cette facture
              sera soumise à validation d&apos;un Super Admin avant son envoi au client.
            </span>
          </div>
        )}

        {errorMsg && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {errorMsg}
          </div>
        )}

        {activeTab === 'preview' ? (
          <A4DocumentSheet
            kind="invoice"
            testId="invoice-form-a4-preview"
            documentNumber={initialInvoice?.invoiceNumber || 'APERÇU (Brouillon)'}
            entityId={entityId}
            issueDate={issueDate}
            secondaryDate={dueDate}
            currency={currency}
            subtotal={totals.subtotal}
            total={totals.total}
            invoiceType={invoiceType}
            depositPercentage={totals.depositPercentage}
            deductedDepositAmount={totals.deductedDepositAmount}
            showEuroConversion={showEuroConversion}
            euroExchangeRate={Number(euroExchangeRate)}
            euroBankName={euroBankName}
            euroRateDate={euroRateDate}
            notes={notes}
            items={totals.lines}
            entity={previewEntity}
            legal={previewLegal}
            company={previewCompany}
            contact={previewContact}
          />
        ) : (
          <div className="space-y-4">

        {/* Type de facturation */}
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 space-y-3">
          <div className="text-xs font-semibold text-slate-800">Type de facturation</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5" role="radiogroup" aria-label="Type de facturation">
            <label
              className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                invoiceType === 'standard'
                  ? 'border-[#19283E] bg-white ring-1 ring-[#19283E]/20'
                  : 'border-slate-200 bg-white/70 hover:bg-white'
              }`}
            >
              <input
                type="radio"
                name="invoiceType"
                value="standard"
                checked={invoiceType === 'standard'}
                onChange={() => {
                  setInvoiceType('standard');
                  setDeductedDepositInvoiceId('');
                }}
                className="mt-0.5 accent-[#19283E]"
              />
              <div>
                <div className="text-sm font-medium text-[#19283E]">Facture Standard (100%)</div>
                <div className="text-[11px] text-slate-500">
                  Facturation classique à 100 %
                </div>
              </div>
            </label>

            <label
              className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                invoiceType === 'deposit'
                  ? 'border-[#19283E] bg-white ring-1 ring-[#19283E]/20'
                  : 'border-slate-200 bg-white/70 hover:bg-white'
              }`}
            >
              <input
                type="radio"
                name="invoiceType"
                value="deposit"
                checked={invoiceType === 'deposit'}
                onChange={() => {
                  setInvoiceType('deposit');
                  setDeductedDepositInvoiceId('');
                  if (!depositPercentage || depositPercentage <= 0 || depositPercentage >= 100) {
                    setDepositPercentage(30);
                  }
                }}
                className="mt-0.5 accent-[#19283E]"
              />
              <div>
                <div className="text-sm font-medium text-[#19283E]">Facture d'Acompte (%)</div>
                <div className="text-[11px] text-slate-500">
                  Calcul selon le pourcentage saisi
                </div>
              </div>
            </label>

            <label
              className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                invoiceType === 'balance'
                  ? 'border-[#19283E] bg-white ring-1 ring-[#19283E]/20'
                  : 'border-slate-200 bg-white/70 hover:bg-white'
              }`}
            >
              <input
                type="radio"
                name="invoiceType"
                value="balance"
                checked={invoiceType === 'balance'}
                onChange={() => setInvoiceType('balance')}
                className="mt-0.5 accent-[#19283E]"
              />
              <div>
                <div className="text-sm font-medium text-[#19283E]">Facture de solde</div>
                <div className="text-[11px] text-slate-500">
                  Solde après acompte émis par l&apos;entité
                </div>
              </div>
            </label>
          </div>

          {invoiceType === 'deposit' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 items-end">
              <div>
                <label htmlFor="inv-deposit-pct" className="block text-xs font-medium text-slate-700 mb-1">
                  Pourcentage d'acompte (%) *
                </label>
                <div className="relative">
                  <input
                    id="inv-deposit-pct"
                    type="number"
                    min="1"
                    max="100"
                    step="0.5"
                    value={depositPercentage}
                    onChange={(e) => setDepositPercentage(Number(e.target.value))}
                    className="w-full h-9 rounded-lg border border-slate-200 bg-white pl-3 pr-8 text-sm font-sans tabular-nums"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500">
                    %
                  </span>
                </div>
              </div>
              <div className="rounded-lg border border-[#C9A125]/35 bg-[#C9A125]/10 px-3 py-2 text-xs text-[#19283E]">
                Acompte calculé :{' '}
                <strong className="font-sans tabular-nums">
                  {formatCurrency(totals.total, currency)}
                </strong>{' '}
                <span className="text-slate-600">
                  sur {formatCurrency(totals.subtotal, currency)}
                </span>
              </div>
            </div>
          )}

          {invoiceType === 'balance' && (
            <div className="rounded-lg border border-emerald-200 bg-white p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="inv-deduct-deposit" className="text-xs font-semibold text-slate-800">
                  Facture d&apos;acompte émise par {previewEntity?.name ?? "l'entité sélectionnée"} *
                </label>
                <span className="text-[11px] font-medium text-emerald-700">
                  {entityDepositOptions.length > 0
                    ? `${entityDepositOptions.length} facture(s) d'acompte disponible(s)`
                    : "Aucune facture d'acompte pour cette entité"}
                </span>
              </div>
              <select
                id="inv-deduct-deposit"
                value={deductedDepositInvoiceId}
                onChange={(e) => handleSelectDepositInvoice(e.target.value)}
                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="">
                  {entityDepositOptions.length > 0
                    ? "Sélectionner une facture d'acompte..."
                    : "Aucune facture d'acompte émise par cette entité"}
                </option>
                {entityDepositOptions.map((dep) => {
                  const depCompany = companies.find((c) => c.id === dep.companyId);
                  const depContact = contacts.find((c) => c.id === dep.contactId);
                  const clientName =
                    depCompany?.tradeName ||
                    depCompany?.legalName ||
                    depContact?.fullName ||
                    'Client';
                  const paidOrTotal = dep.paidAmount > 0 ? dep.paidAmount : dep.total;
                  return (
                    <option key={dep.id} value={dep.id}>
                      {dep.invoiceNumber} — {clientName} — Acompte {dep.depositPercentage ?? 100}% (
                      {formatCurrency(paidOrTotal, dep.currency)}) [{dep.status}]
                    </option>
                  );
                })}
              </select>
              <p className="text-[11px] text-slate-500">
                La sélection d&apos;une facture d&apos;acompte remplit automatiquement les lignes facturées, le client et la devise.
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="inv-entity" className="block text-xs font-medium text-slate-700 mb-1">
              Entité émettrice *
            </label>
            <select
              id="inv-entity"
              value={entityId}
              disabled={Boolean(initialInvoice)}
              onChange={(e) => {
                const eid = e.target.value;
                setEntityId(eid);
                setDeductedDepositInvoiceId('');
                const legal = legalSettings.find((l) => l.entityId === eid);
                if (legal) setLegalMentions(legal.defaultLegalMentions);
              }}
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
            <label htmlFor="inv-contact" className="block text-xs font-medium text-slate-700 mb-1">
              Contact facturé *
            </label>
            <select
              id="inv-contact"
              value={contactId}
              onChange={(e) => {
                const cid = e.target.value;
                setContactId(cid);
                const ct = contacts.find((c) => c.id === cid);
                setCompanyId(ct?.companyId ?? '');
              }}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">Sélectionner</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="inv-company" className="block text-xs font-medium text-slate-700 mb-1">
              Entreprise cliente
            </label>
            <select
              id="inv-company"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">Particulier</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.legalName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label htmlFor="inv-status" className="block text-xs font-medium text-slate-700 mb-1">
              Statut
            </label>
            <select
              id="inv-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as InvoiceStatus)}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
            >
              {INVOICE_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="inv-currency" className="block text-xs font-medium text-slate-700 mb-1">
              Devise
            </label>
            <select
              id="inv-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="inv-issue" className="block text-xs font-medium text-slate-700 mb-1">
              Date d'émission
            </label>
            <input
              id="inv-issue"
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
            />
          </div>
          <div>
            <label htmlFor="inv-due" className="block text-xs font-medium text-slate-700 mb-1">
              Date d'échéance
            </label>
            <input
              id="inv-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
            />
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-800">
              Lignes facturées ({lines.length})
            </span>
            <div className="flex items-center gap-2">
              <select
                aria-label="Produit catalogue facture"
                value={selectedCatalogId}
                onChange={(e) => setSelectedCatalogId(e.target.value)}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs max-w-[230px]"
              >
                <option value="">Ligne personnalisée...</option>
                {entityProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {formatCurrency(p.price, p.currency)}
                    {p.pricingType === 'tiered' ? ' (échelonné)' : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => addProductLine(selectedCatalogId)}
                className="inline-flex h-8 items-center gap-1 rounded-lg bg-slate-900 px-3 text-xs font-medium text-white hover:bg-slate-800"
              >
                <Plus className="h-3.5 w-3.5" />
                Ajouter ligne
              </button>
            </div>
          </div>

          {lines.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-5 text-center text-xs text-slate-500">
              Aucune ligne de facturation. Choisissez un produit/service dans le menu ou cliquez sur{' '}
              <strong className="text-slate-700">Ajouter ligne</strong>.
            </div>
          ) : (
            <>
              <div className="hidden sm:grid grid-cols-12 gap-2 px-2 text-[11px] font-medium text-slate-500">
                <span className="col-span-5">Désignation &amp; détails</span>
                <span className="col-span-2">Qté</span>
                <span className="col-span-2">Prix unitaire</span>
                <span className="col-span-2 text-right">Total ligne</span>
                <span className="col-span-1" />
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {lines.map((line, idx) => {
              const linkedProd = line.productId
                ? products.find((p) => p.id === line.productId)
                : undefined;
              const lineTotal = (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0);
              return (
                <div
                  key={line.id}
                  className="grid grid-cols-12 gap-2 items-start bg-white rounded-lg border border-slate-200 p-2"
                >
                  <div className="col-span-12 sm:col-span-5 space-y-1">
                    <input
                      type="text"
                      aria-label="Désignation ligne facture"
                      value={line.label}
                      onChange={(e) => updateLine(idx, { label: e.target.value })}
                      placeholder="Désignation"
                      className="w-full h-8 rounded border border-slate-200 px-2 text-xs font-medium"
                    />
                    <textarea
                      rows={2}
                      aria-label="Détails ligne facture"
                      value={line.description ?? ''}
                      onChange={(e) => updateLine(idx, { description: e.target.value })}
                      placeholder="Détails de la prestation (optionnel)"
                      className="w-full rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-600 leading-snug resize-y"
                    />
                    {linkedProd?.pricingType === 'tiered' && (
                      <p className="text-[10px] text-[#AD7300] font-medium">
                        Tarif échelonné appliqué selon quantité
                      </p>
                    )}
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <input
                      type="number"
                      min="1"
                      aria-label="Quantité facture"
                      value={line.quantity}
                      onChange={(e) => updateLine(idx, { quantity: Number(e.target.value) || 0 })}
                      className="w-full h-8 rounded border border-slate-200 px-2 text-xs tabular-nums"
                    />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      aria-label="Prix unitaire facture"
                      value={line.unitPrice}
                      onChange={(e) => updateLine(idx, { unitPrice: Number(e.target.value) || 0 })}
                      className="w-full h-8 rounded border border-slate-200 px-2 text-xs tabular-nums"
                    />
                  </div>
                  <div className="col-span-3 sm:col-span-2 text-right font-sans tabular-nums text-xs font-semibold text-slate-800 pt-1.5">
                    {formatCurrency(lineTotal, currency)}
                  </div>
                  <div className="col-span-1 flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => removeLine(idx)}
                      aria-label="Supprimer la ligne"
                      className="p-1 text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
              </div>
            </>
          )}

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pt-2 border-t border-slate-200 text-xs">
            <span className="text-slate-500">TVA non applicable</span>
            <div className="space-y-1 text-right">
              {(invoiceType === 'deposit' || invoiceType === 'balance' || totals.deductedDepositAmount > 0) && (
                <div className="text-slate-600 font-sans tabular-nums">
                  Total prestation (100%) : {formatCurrency(totals.subtotal, currency)}
                </div>
              )}
              {invoiceType === 'deposit' && (
                <div className="text-[#AD7300] font-sans tabular-nums font-medium">
                  Acompte facturé ({totals.depositPercentage}%) :{' '}
                  {formatCurrency(totals.total, currency)}
                </div>
              )}
              {(invoiceType === 'balance' || (invoiceType === 'standard' && totals.deductedDepositAmount > 0)) && (
                <div className="text-emerald-700 font-sans tabular-nums font-medium">
                  Acompte payé ({totals.depositPercentage}%) : -{' '}
                  {formatCurrency(totals.deductedDepositAmount, currency)}
                </div>
              )}
              <div className="font-sans tabular-nums text-sm text-[#19283E] font-bold">
                {invoiceType === 'deposit' || invoiceType === 'balance' || totals.deductedDepositAmount > 0
                  ? `Net à payer : ${formatCurrency(totals.total, currency)}`
                  : `Total net : ${formatCurrency(totals.total, currency)}`}
              </div>
            </div>
          </div>
        </div>

        {/* Option Conversion Euro selon le cours d'achat des banques */}
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-3">
          <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={showEuroConversion}
              onChange={(e) => setShowEuroConversion(e.target.checked)}
              className="accent-[#19283E]"
            />
            Afficher la valeur en Euro (virement international · cours d&apos;achat banque)
          </label>

          {showEuroConversion && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="inv-euro-bank" className="block text-xs font-medium text-slate-700 mb-1">
                    Banque (libre)
                  </label>
                  <input
                    id="inv-euro-bank"
                    type="text"
                    value={euroBankName}
                    onChange={(e) => setEuroBankName(e.target.value)}
                    placeholder="ex. BNI Madagascar"
                    className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="inv-euro-date" className="block text-xs font-medium text-slate-700 mb-1">
                    Date du cours
                  </label>
                  <input
                    id="inv-euro-date"
                    type="date"
                    value={euroRateDate}
                    onChange={(e) => setEuroRateDate(e.target.value)}
                    className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="inv-euro-rate" className="block text-xs font-medium text-slate-700 mb-1">
                    Cours d&apos;achat (1 € = X Ar) *
                  </label>
                  <input
                    id="inv-euro-rate"
                    type="number"
                    min="1"
                    step="0.01"
                    value={euroExchangeRate}
                    onChange={(e) => setEuroExchangeRate(e.target.value)}
                    placeholder="4576"
                    className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-sans tabular-nums"
                  />
                </div>
              </div>

              {euroPreview && (
                <div className="rounded-lg border border-[#19283E]/15 bg-white px-3 py-2 text-xs text-slate-700">
                  Équivalent calculé automatiquement :{' '}
                  <strong className="font-sans tabular-nums text-[#19283E]">{euroPreview.formattedEuro}</strong>{' '}
                  <span className="text-slate-500">
                    ({formatInvoiceAmountInWords(euroPreview.euroAmount, 'EUR')})
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

            <div>
              <label htmlFor="inv-notes" className="block text-xs font-medium text-slate-700 mb-1">
                Notes &amp; mentions complémentaires
              </label>
              <textarea
                id="inv-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-lg border border-slate-200 p-2.5 text-sm"
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-200">
          {activeTab === 'form' ? (
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-[#19283E] hover:bg-slate-100"
            >
              <Eye className="h-3.5 w-3.5 text-[#C9A125]" />
              Aperçu A4
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setActiveTab('form')}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              <FileEdit className="h-3.5 w-3.5" />
              Retour au formulaire
            </button>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-9 rounded-lg bg-[#19283E] px-4 text-sm font-medium text-white hover:bg-[#223552] disabled:opacity-50"
            >
              {submitting ? 'Enregistrement...' : initialInvoice ? 'Mettre à jour' : 'Émettre la facture'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

