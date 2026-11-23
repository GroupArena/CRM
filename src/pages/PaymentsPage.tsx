import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, CreditCard, Banknote, Receipt } from 'lucide-react';
import { useCrm } from '../context/CrmContext';
import { useAuth } from '../hooks/useAuth';
import { PAYMENT_METHODS, type PaymentMethod } from '../types';
import { EmptyState } from '../components/ui/EmptyState';
import { PaymentFormModal } from '../components/crm/PaymentFormModal';
import { formatCurrency, formatDateFr } from '../utils/crmLogic';

export function PaymentsPage() {
  const {
    authorizedEntities,
    scopedPayments,
    invoices,
    companies,
    contacts,
    users,
    globalSearch,
  } = useCrm();
  const { canWriteCrm } = useAuth();

  const [entityFilter, setEntityFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState<PaymentMethod | 'all'>('all');
  const [modalOpen, setModalOpen] = useState(false);

  const filteredPayments = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    return scopedPayments
      .filter((pay) => {
        if (entityFilter !== 'all' && pay.entityId !== entityFilter) return false;
        if (methodFilter !== 'all' && pay.paymentMethod !== methodFilter) return false;
        if (q) {
          const inv = invoices.find((i) => i.id === pay.invoiceId);
          const co = inv ? companies.find((c) => c.id === inv.companyId) : undefined;
          const ct = inv ? contacts.find((c) => c.id === inv.contactId) : undefined;
          const hay = [
            pay.reference,
            pay.paymentMethod,
            pay.notes,
            inv?.invoiceNumber ?? '',
            co?.legalName ?? '',
            ct?.fullName ?? '',
          ]
            .join(' ')
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => (b.paymentDate || b.createdAt).localeCompare(a.paymentDate || a.createdAt));
  }, [scopedPayments, entityFilter, methodFilter, globalSearch, invoices, companies, contacts]);

  const totalCollected = useMemo(
    () => filteredPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
    [filteredPayments]
  );

  const topMethod = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of filteredPayments) {
      counts.set(p.paymentMethod, (counts.get(p.paymentMethod) ?? 0) + p.amount);
    }
    let best = '—';
    let bestAmt = 0;
    for (const [method, amt] of counts.entries()) {
      if (amt > bestAmt) {
        bestAmt = amt;
        best = method;
      }
    }
    return best;
  }, [filteredPayments]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Paiements & Encaissements</h1>
          <p className="text-sm text-slate-500 mt-1">
            Suivi de trésorerie encaissée et lettrage automatique avec les factures clients.
          </p>
        </div>

        {canWriteCrm && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            Enregistrer un paiement
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Total encaissé</span>
            <Banknote className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-bold font-display tabular-nums text-emerald-700">
            {formatCurrency(totalCollected)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Règlements enregistrés</span>
            <Receipt className="h-4 w-4 text-slate-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-display tabular-nums text-slate-900">
            {filteredPayments.length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Mode principal</span>
            <CreditCard className="h-4 w-4 text-blue-600" />
          </div>
          <p className="mt-2 text-xl font-bold text-slate-900">{topMethod}</p>
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
          aria-label="Filtrer par mode de paiement"
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value as PaymentMethod | 'all')}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="all">Tous les modes de paiement</option>
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      {filteredPayments.length === 0 ? (
        <EmptyState
          icon={<CreditCard className="h-6 w-6" />}
          title="Aucun paiement enregistré"
          description="Enregistrez un règlement sur une facture émise pour mettre à jour son solde automatiquement."
        />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Facture</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Entité</th>
                  <th className="py-3 px-4">Mode</th>
                  <th className="py-3 px-4">Référence</th>
                  <th className="py-3 px-4">Enregistré par</th>
                  <th className="py-3 px-4 text-right">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredPayments.map((pay) => {
                  const inv = invoices.find((i) => i.id === pay.invoiceId);
                  const company = inv ? companies.find((c) => c.id === inv.companyId) : undefined;
                  const contact = inv ? contacts.find((c) => c.id === inv.contactId) : undefined;
                  const entity = authorizedEntities.find((e) => e.id === pay.entityId);
                  const recorder = users.find((u) => u.uid === pay.recordedByUid);

                  return (
                    <tr key={pay.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 text-xs font-sans tabular-nums text-slate-700 whitespace-nowrap">
                        {formatDateFr(pay.paymentDate)}
                      </td>
                      <td className="py-3 px-4 font-sans tabular-nums text-xs font-semibold text-blue-700 whitespace-nowrap">
                        <Link to="/invoices" className="hover:underline">
                          {inv?.invoiceNumber ?? pay.invoiceId}
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        {company ? (
                          <Link
                            to={`/companies/${company.id}`}
                            className="font-medium text-slate-900 hover:text-blue-700"
                          >
                            {company.tradeName || company.legalName}
                          </Link>
                        ) : contact ? (
                          <Link
                            to={`/contacts/${contact.id}`}
                            className="font-medium text-slate-900 hover:text-blue-700"
                          >
                            {contact.fullName}
                          </Link>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                        {entity?.name ?? pay.entityId}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700">
                          {pay.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs font-sans tabular-nums text-slate-600">
                        {pay.reference || '—'}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">
                        {recorder?.displayName ?? 'Système'}
                      </td>
                      <td className="py-3 px-4 text-right font-sans tabular-nums font-bold text-emerald-700 whitespace-nowrap">
                        {formatCurrency(pay.amount, inv?.currency || 'MGA')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <PaymentFormModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
