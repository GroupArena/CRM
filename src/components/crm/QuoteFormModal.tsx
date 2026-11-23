import React, { useEffect, useMemo, useState } from 'react';
import { Eye, FileEdit, Plus, Trash2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { A4DocumentSheet } from './A4DocumentSheet';
import { useCrm } from '../../context/CrmContext';
import { QUOTE_STATUSES, SUPPORTED_CURRENCIES, type Quote, type QuoteStatus } from '../../types';
import {
  addDaysToDateIso,
  computeDocumentTotals,
  computeEuroConversion,
  resolveProductUnitPrice,
  type LineInput,
} from '../../utils/billingLogic';
import { formatCurrency } from '../../utils/crmLogic';
import { formatInvoiceAmountInWords } from '../../utils/numberToWordsFr';

interface QuoteFormModalProps {
  open: boolean;
  onClose: () => void;
  defaultEntityId?: string;
  defaultContactId?: string;
  defaultCompanyId?: string;
  defaultOpportunityId?: string;
  initialQuote?: Quote | null;
}

export function QuoteFormModal({
  open,
  onClose,
  defaultEntityId,
  defaultContactId,
  defaultCompanyId,
  defaultOpportunityId,
  initialQuote,
}: QuoteFormModalProps) {
  const {
    authorizedEntities,
    selectedEntityId,
    contacts,
    companies,
    scopedDeals,
    products,
    quoteItems,
    legalSettings,
    settings,
    createQuote,
    updateQuote,
  } = useCrm();

  const resolvedEntity =
    defaultEntityId ||
    (selectedEntityId !== 'all' ? selectedEntityId : authorizedEntities[0]?.id ?? 'arena-business-center');

  const [entityId, setEntityId] = useState(resolvedEntity);
  const [contactId, setContactId] = useState(defaultContactId ?? '');
  const [companyId, setCompanyId] = useState(defaultCompanyId ?? '');
  const [opportunityId, setOpportunityId] = useState(defaultOpportunityId ?? '');
  const [status, setStatus] = useState<QuoteStatus>('Brouillon');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [validUntil, setValidUntil] = useState(
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

  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);
    setActiveTab('form');
    if (initialQuote) {
      setEntityId(initialQuote.entityId);
      setContactId(initialQuote.contactId);
      setCompanyId(initialQuote.companyId);
      setOpportunityId(initialQuote.opportunityId ?? '');
      setStatus(initialQuote.status);
      setIssueDate(initialQuote.issueDate);
      setValidUntil(initialQuote.validUntil);
      setCurrency(initialQuote.currency || settings.defaultCurrency || 'MGA');
      setShowEuroConversion(Boolean(initialQuote.showEuroConversion));
      setEuroExchangeRate(
        initialQuote.euroExchangeRate ? String(initialQuote.euroExchangeRate) : '4576'
      );
      setEuroBankName(initialQuote.euroBankName || 'BNI Madagascar');
      setEuroRateDate(initialQuote.euroRateDate || initialQuote.issueDate);
      setNotes(initialQuote.notes);
      setLegalMentions(initialQuote.legalMentions);
      const existing = quoteItems
        .filter((i) => i.quoteId === initialQuote.id)
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
      setOpportunityId(defaultOpportunityId || '');
      setStatus('Envoyé');
      setIssueDate(today);
      setValidUntil(addDaysToDateIso(today, 30));
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
    initialQuote,
    resolvedEntity,
    defaultContactId,
    defaultCompanyId,
    defaultOpportunityId,
    contacts,
    products,
    quoteItems,
    legalSettings,
    settings.defaultCurrency,
  ]);

  const totals = useMemo(() => computeDocumentTotals(lines), [lines]);
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
          id: `ql-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          productId: prod.id,
          label: prod.name,
          description: prod.description,
          quantity: 1,
          unitPrice: resolveProductUnitPrice(prod, 1),
          vatRate: 0,
          orderIndex: lines.length,
        }
      : {
          id: `ql-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityId || !contactId || lines.length === 0) {
      setErrorMsg('Veuillez sélectionner un contact, une entité et au moins une ligne.');
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
      if (initialQuote) {
        await updateQuote(
          {
            ...initialQuote,
            entityId,
            contactId,
            companyId,
            opportunityId: opportunityId || undefined,
            status,
            issueDate,
            validUntil,
            currency,
            showEuroConversion,
            euroExchangeRate: showEuroConversion ? parsedEuroRate : undefined,
            euroBankName: showEuroConversion ? euroBankName.trim() : undefined,
            euroRateDate: showEuroConversion ? euroRateDate : undefined,
            notes,
            legalMentions,
          },
          lines
        );
      } else {
        await createQuote({
          entityId,
          contactId,
          companyId,
          opportunityId: opportunityId || undefined,
          status,
          issueDate,
          validUntil,
          currency,
          showEuroConversion,
          euroExchangeRate: showEuroConversion ? parsedEuroRate : undefined,
          euroBankName: showEuroConversion ? euroBankName.trim() : undefined,
          euroRateDate: showEuroConversion ? euroRateDate : undefined,
          notes,
          legalMentions,
          lines,
        });
      }
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur lors de la création du devis.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialQuote ? `Modifier le devis ${initialQuote.quoteNumber}` : 'Créer un nouveau devis'}
      subtitle="Numérotation automatique DEV-{ENTITÉ}-{ANNÉE}-{NUMÉRO} · TVA non applicable."
      maxWidthClass={activeTab === 'preview' ? 'max-w-5xl' : 'max-w-2xl'}
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Sélecteur Formulaire / Prévisualisation A4 */}
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
              Saisie du devis
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

        {errorMsg && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {errorMsg}
          </div>
        )}

        {activeTab === 'preview' ? (
          <A4DocumentSheet
            kind="quote"
            testId="quote-form-a4-preview"
            documentNumber={initialQuote?.quoteNumber || 'APERÇU (Brouillon)'}
            entityId={entityId}
            issueDate={issueDate}
            secondaryDate={validUntil}
            currency={currency}
            subtotal={totals.subtotal}
            total={totals.total}
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="qt-entity" className="block text-xs font-medium text-slate-700 mb-1">
              Entité émettrice *
            </label>
            <select
              id="qt-entity"
              value={entityId}
              disabled={Boolean(initialQuote)}
              onChange={(e) => {
                const eid = e.target.value;
                setEntityId(eid);
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
            <label htmlFor="qt-contact" className="block text-xs font-medium text-slate-700 mb-1">
              Contact destinataire *
            </label>
            <select
              id="qt-contact"
              value={contactId}
              onChange={(e) => {
                const cid = e.target.value;
                setContactId(cid);
                const ct = contacts.find((c) => c.id === cid);
                if (ct?.companyId) setCompanyId(ct.companyId);
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
            <label htmlFor="qt-company" className="block text-xs font-medium text-slate-700 mb-1">
              Entreprise cliente
            </label>
            <select
              id="qt-company"
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

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          <div>
            <label htmlFor="qt-status" className="block text-xs font-medium text-slate-700 mb-1">
              Statut
            </label>
            <select
              id="qt-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as QuoteStatus)}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
            >
              {QUOTE_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="qt-currency" className="block text-xs font-medium text-slate-700 mb-1">
              Devise
            </label>
            <select
              id="qt-currency"
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
            <label htmlFor="qt-issue" className="block text-xs font-medium text-slate-700 mb-1">
              Date d'émission
            </label>
            <input
              id="qt-issue"
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
            />
          </div>
          <div>
            <label htmlFor="qt-valid" className="block text-xs font-medium text-slate-700 mb-1">
              Valable jusqu'au
            </label>
            <input
              id="qt-valid"
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
            />
          </div>
          <div>
            <label htmlFor="qt-opp" className="block text-xs font-medium text-slate-700 mb-1">
              Opportunité liée
            </label>
            <select
              id="qt-opp"
              value={opportunityId}
              onChange={(e) => setOpportunityId(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">Aucune</option>
              {scopedDeals
                .filter((d) => d.entityId === entityId)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Lignes du devis */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-800">
              Lignes de prestation ({lines.length})
            </span>
            <div className="flex items-center gap-2">
              <select
                aria-label="Choisir un produit du catalogue"
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
                className="inline-flex h-8 items-center gap-1 rounded-lg bg-slate-900 px-3 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" />
                Ajouter ligne
              </button>
            </div>
          </div>

          {lines.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-5 text-center text-xs text-slate-500">
              Aucune ligne de prestation. Choisissez un produit/service dans le menu ou cliquez sur{' '}
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
                          aria-label="Désignation ligne"
                          value={line.label}
                          onChange={(e) => updateLine(idx, { label: e.target.value })}
                          placeholder="Désignation"
                          className="w-full h-8 rounded border border-slate-200 px-2 text-xs font-medium"
                        />
                        <textarea
                          rows={2}
                          aria-label="Détails de la ligne"
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
                          aria-label="Quantité"
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
                          aria-label="Prix unitaire"
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

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-200 text-xs">
            <span className="text-slate-500">TVA non applicable</span>
            <span className="font-sans tabular-nums text-sm text-[#19283E] font-bold">
              Total net : {formatCurrency(totals.total, currency)}
            </span>
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
                      <label htmlFor="qt-euro-bank" className="block text-xs font-medium text-slate-700 mb-1">
                        Banque (libre)
                      </label>
                      <input
                        id="qt-euro-bank"
                        type="text"
                        value={euroBankName}
                        onChange={(e) => setEuroBankName(e.target.value)}
                        placeholder="ex. BNI Madagascar"
                        className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="qt-euro-date" className="block text-xs font-medium text-slate-700 mb-1">
                        Date du cours
                      </label>
                      <input
                        id="qt-euro-date"
                        type="date"
                        value={euroRateDate}
                        onChange={(e) => setEuroRateDate(e.target.value)}
                        className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="qt-euro-rate" className="block text-xs font-medium text-slate-700 mb-1">
                        Cours d&apos;achat (1 € = X Ar) *
                      </label>
                      <input
                        id="qt-euro-rate"
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
              <label htmlFor="qt-notes" className="block text-xs font-medium text-slate-700 mb-1">
                Notes &amp; conditions commerciales
              </label>
              <textarea
                id="qt-notes"
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
              {submitting ? 'Enregistrement...' : initialQuote ? 'Mettre à jour le devis' : 'Créer le devis'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
