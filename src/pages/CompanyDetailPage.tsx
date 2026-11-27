import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Edit2, Plus, Star } from 'lucide-react';
import { useCrm } from '../context/CrmContext';
import { useAuth } from '../hooks/useAuth';
import {
  DealStatusBadge,
  InvoiceStatusBadge,
  QuoteStatusBadge,
  VipBadge,
} from '../components/ui/StatusBadge';
import { ClientHistoryTimeline } from '../components/crm/ClientHistoryTimeline';
import { CompanyFormModal } from '../components/crm/CompanyFormModal';
import { ContactFormModal } from '../components/crm/ContactFormModal';
import { formatCurrency, formatDateFr } from '../utils/crmLogic';
import { formatInlineAddress } from '../utils/billingLogic';

type CompanyTab = 'history' | 'contacts' | 'opportunities' | 'quotes' | 'invoices' | 'payments';

export function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const {
    companies,
    contacts,
    deals,
    quotes,
    invoices,
    payments,
    entities,
    updateCompany,
  } = useCrm();
  const { canWriteCrm } = useAuth();

  const [tab, setTab] = useState<CompanyTab>('history');
  const [editOpen, setEditOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  const company = companies.find((c) => c.id === id);

  if (!company) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center space-y-3">
        <p className="text-base font-semibold text-slate-900">Entreprise introuvable</p>
        <Link to="/companies" className="text-sm font-medium text-[#19283E] hover:text-[#AD7300] hover:underline">
          Retour aux entreprises
        </Link>
      </div>
    );
  }

  const affiliatedContacts = contacts.filter((c) => c.companyId === company.id);
  const companyDeals = deals.filter((d) => d.companyId === company.id);
  const companyQuotes = quotes.filter((q) => q.companyId === company.id);
  const companyInvoices = invoices.filter((i) => i.companyId === company.id);
  const companyInvoiceIds = new Set(companyInvoices.map((i) => i.id));
  const companyPayments = payments.filter((p) => companyInvoiceIds.has(p.invoiceId));

  const getEntityName = (eid: string) => entities.find((e) => e.id === eid)?.name ?? eid;

  const tabs: { id: CompanyTab; label: string }[] = [
    { id: 'history', label: 'Historique complet' },
    { id: 'contacts', label: `Contacts affiliés (${affiliatedContacts.length})` },
    { id: 'opportunities', label: `Opportunités (${companyDeals.length})` },
    { id: 'quotes', label: `Devis (${companyQuotes.length})` },
    { id: 'invoices', label: `Factures (${companyInvoices.length})` },
    { id: 'payments', label: `Paiements (${companyPayments.length})` },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link
            to="/companies"
            className="mt-1 rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
            aria-label="Retour aux entreprises"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-display text-2xl font-bold text-slate-900">
                {company.legalName}
              </h1>
              {company.isVip && <VipBadge />}
            </div>
            <p className="text-sm text-slate-500 mt-1">
              {company.tradeName} · {company.legalStatus || 'Société'} · {company.city}
            </p>
          </div>
        </div>

        {canWriteCrm && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => updateCompany({ ...company, isVip: !company.isVip })}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Star className={`h-3.5 w-3.5 ${company.isVip ? 'fill-amber-400 text-amber-500' : 'text-slate-400'}`} />
              {company.isVip ? 'VIP actif' : 'Passer VIP'}
            </button>
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Edit2 className="h-4 w-4" />
              Modifier
            </button>
          </div>
        )}
      </div>

      {/* Informations légales */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
        <div>
          <p className="text-xs text-slate-500">NIF / STAT / RCS</p>
          <p className="font-sans tabular-nums text-xs text-slate-900 mt-1">NIF : {company.nif || '—'}</p>
          <p className="font-sans tabular-nums text-xs text-slate-700">STAT : {company.stat || '—'}</p>
          <p className="font-sans tabular-nums text-xs text-slate-700">RCS : {company.rcs || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Siège & Adresse</p>
          <p className="text-slate-900 mt-1">
            {formatInlineAddress(company.address, company.city, company.country) || '—'}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Coordonnées</p>
          <p className="text-slate-900 mt-1">{company.email || '—'}</p>
          <p className="font-sans tabular-nums text-slate-700">{company.phone || company.whatsapp || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Synthèse financière</p>
          <p className="font-sans tabular-nums font-semibold text-slate-900 mt-1">
            Facturé : {formatCurrency(companyInvoices.reduce((s, i) => s + i.total, 0))}
          </p>
          <p className="font-sans tabular-nums text-emerald-700 text-xs">
            Encaissé : {formatCurrency(companyPayments.reduce((s, p) => s + p.amount, 0))}
          </p>
        </div>
      </div>

      <div className="border-b border-slate-200 flex items-center gap-1 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              tab === t.id
                ? 'border-[#C9A125] text-[#19283E] font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'history' && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <ClientHistoryTimeline companyId={company.id} />
        </div>
      )}

      {tab === 'contacts' && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Contacts affiliés</h2>
            {canWriteCrm && (
              <button
                type="button"
                onClick={() => setContactOpen(true)}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#19283E] px-3 text-xs font-medium text-white hover:bg-[#223552]"
              >
                <Plus className="h-3.5 w-3.5" />
                Ajouter un contact
              </button>
            )}
          </div>
          {affiliatedContacts.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">Aucun contact rattaché.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {affiliatedContacts.map((ct) => (
                <li key={ct.id} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <Link
                      to={`/contacts/${ct.id}`}
                      className="text-sm font-semibold text-[#19283E] hover:text-[#AD7300]"
                    >
                      {ct.fullName}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {ct.jobTitle || 'Interlocuteur'} · {ct.email} · {ct.phone}
                    </p>
                  </div>
                  {ct.isVip && <VipBadge />}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'opportunities' && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          {companyDeals.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">Aucune opportunité liée.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {companyDeals.map((d) => (
                <li key={d.id} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{d.name}</p>
                    <p className="text-xs text-slate-500">
                      {getEntityName(d.entityId)} · Clôture : {formatDateFr(d.expectedCloseDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <DealStatusBadge status={d.status} />
                    <span className="font-sans tabular-nums text-sm font-semibold text-slate-900">
                      {formatCurrency(d.amount, d.currency)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'quotes' && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          {companyQuotes.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">Aucun devis émis.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {companyQuotes.map((q) => (
                <li key={q.id} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-sans tabular-nums font-semibold text-slate-900">{q.quoteNumber}</p>
                    <p className="text-xs text-slate-500">
                      {getEntityName(q.entityId)} · Émis le {formatDateFr(q.issueDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <QuoteStatusBadge status={q.status} />
                    <span className="font-sans tabular-nums text-sm font-semibold text-slate-900">
                      {formatCurrency(q.total, q.currency)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'invoices' && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          {companyInvoices.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">Aucune facture émise.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {companyInvoices.map((inv) => (
                <li key={inv.id} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-sans tabular-nums font-semibold text-slate-900">{inv.invoiceNumber}</p>
                    <p className="text-xs text-slate-500">
                      {getEntityName(inv.entityId)} · Échéance {formatDateFr(inv.dueDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <InvoiceStatusBadge status={inv.status} />
                    <span className="font-sans tabular-nums text-sm font-semibold text-slate-900">
                      {formatCurrency(inv.total, inv.currency)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'payments' && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          {companyPayments.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">Aucun paiement enregistré.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {companyPayments.map((pay) => (
                <li key={pay.id} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {pay.paymentMethod} {pay.reference ? `· ${pay.reference}` : ''}
                    </p>
                    <p className="text-xs text-slate-500">
                      {getEntityName(pay.entityId)} · Le {formatDateFr(pay.paymentDate)}
                    </p>
                  </div>
                  <span className="font-sans tabular-nums text-sm font-semibold text-emerald-700">
                    {formatCurrency(pay.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <CompanyFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        initialCompany={company}
      />

      <ContactFormModal
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        defaultCompanyId={company.id}
      />
    </div>
  );
}
