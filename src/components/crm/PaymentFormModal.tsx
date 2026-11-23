import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { useCrm } from '../../context/CrmContext';
import { PAYMENT_METHODS, type Invoice, type PaymentMethod } from '../../types';
import { formatCurrency } from '../../utils/crmLogic';

interface PaymentFormModalProps {
  open: boolean;
  onClose: () => void;
  invoice?: Invoice | null;
}

export function PaymentFormModal({ open, onClose, invoice }: PaymentFormModalProps) {
  const { scopedInvoices, recordPayment } = useCrm();

  const unpaidInvoices = scopedInvoices.filter(
    (i) => i.status !== 'Payée' && i.status !== 'Annulée'
  );

  const [invoiceId, setInvoiceId] = useState(invoice?.id ?? '');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Virement');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const activeInvoice =
    invoice || scopedInvoices.find((i) => i.id === invoiceId) || unpaidInvoices[0];

  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);
    const target = invoice || unpaidInvoices[0];
    setInvoiceId(target?.id ?? '');
    setAmount(target ? String(target.remainingAmount) : '');
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentMethod('Virement');
    setReference('');
    setNotes('');
  }, [open, invoice]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount);
    if (!activeInvoice) {
      setErrorMsg('Veuillez sélectionner une facture.');
      return;
    }
    if (!numAmount || numAmount <= 0) {
      setErrorMsg('Le montant du règlement doit être strictement positif.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      await recordPayment({
        invoiceId: activeInvoice.id,
        amount: numAmount,
        paymentDate,
        paymentMethod,
        reference,
        notes,
      });
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur lors du paiement.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Enregistrer un paiement"
      subtitle={
        activeInvoice
          ? `Facture ${activeInvoice.invoiceNumber} · Reste à payer : ${formatCurrency(
              activeInvoice.remainingAmount,
              activeInvoice.currency
            )}`
          : 'Sélectionnez une facture à régler.'
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {errorMsg && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {errorMsg}
          </div>
        )}

        {!invoice && (
          <div>
            <label htmlFor="pay-invoice" className="block text-xs font-medium text-slate-700 mb-1">
              Facture concernée *
            </label>
            <select
              id="pay-invoice"
              value={invoiceId}
              onChange={(e) => {
                const iid = e.target.value;
                setInvoiceId(iid);
                const found = scopedInvoices.find((i) => i.id === iid);
                if (found) setAmount(String(found.remainingAmount));
              }}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
            >
              {unpaidInvoices.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.invoiceNumber} — Reste {formatCurrency(i.remainingAmount, i.currency)}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="pay-amount" className="block text-xs font-medium text-slate-700 mb-1">
              Montant encaissé ({activeInvoice?.currency || 'MGA'}) *
            </label>
            <input
              id="pay-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm font-sans tabular-nums"
              required
            />
          </div>
          <div>
            <label htmlFor="pay-date" className="block text-xs font-medium text-slate-700 mb-1">
              Date de paiement *
            </label>
            <input
              id="pay-date"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="pay-method" className="block text-xs font-medium text-slate-700 mb-1">
              Mode de paiement
            </label>
            <select
              id="pay-method"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="pay-ref" className="block text-xs font-medium text-slate-700 mb-1">
              Référence transaction
            </label>
            <input
              id="pay-ref"
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="VIR-2026-..."
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm font-sans tabular-nums"
            />
          </div>
        </div>

        <div>
          <label htmlFor="pay-notes" className="block text-xs font-medium text-slate-700 mb-1">
            Notes
          </label>
          <textarea
            id="pay-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-lg border border-slate-200 p-2.5 text-sm"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={submitting || !activeInvoice}
            className="h-9 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {submitting ? 'Validation...' : 'Enregistrer le paiement'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
