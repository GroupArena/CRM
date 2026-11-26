import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Building2, Edit2, GitMerge, Star } from 'lucide-react';
import { useCrm } from '../context/CrmContext';
import { useAuth } from '../hooks/useAuth';
import type { Company } from '../types';
import { VipBadge } from '../components/ui/StatusBadge';
import { EmptyState } from '../components/ui/EmptyState';
import { CompanyFormModal } from '../components/crm/CompanyFormModal';
import { MergeDuplicatesModal } from '../components/crm/MergeDuplicatesModal';

export function CompaniesPage() {
  const { companies, contacts, invoices, mergeCompanies, updateCompany } = useCrm();
  const { canWriteCrm } = useAuth();

  const [search, setSearch] = useState('');
  const [vipOnly, setVipOnly] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return companies.filter((c) => {
      if (vipOnly && !c.isVip) return false;
      if (!q) return true;
      return (
        (c.legalName ?? '').toLowerCase().includes(q) ||
        (c.tradeName ?? '').toLowerCase().includes(q) ||
        (c.nif ?? '').toLowerCase().includes(q) ||
        (c.city ?? '').toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q)
      );
    });
  }, [companies, search, vipOnly]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Comptes & Entreprises
          </h1>
          <p className="text-sm text-slate-500 mt-1 tabular-nums">
            Référentiel B2B partagé · {filtered.length} entreprise
            {filtered.length > 1 ? 's' : ''}
          </p>
        </div>

        {canWriteCrm && (
          <div className="flex items-center gap-2.5">
            {companies.length >= 2 && (
              <button
                type="button"
                onClick={() => setMergeOpen(true)}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                <GitMerge className="h-4 w-4" />
                Fusionner doublons
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setEditingCompany(null);
                setModalOpen(true);
              }}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#19283E] px-4 text-sm font-medium text-white hover:bg-[#223552] whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              Nouvelle entreprise
            </button>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="search"
            aria-label="Rechercher une entreprise"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Raison sociale, nom commercial, NIF, ville..."
            className="w-full h-9 rounded-lg border border-slate-200 pl-9 pr-3 text-sm"
          />
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer px-2">
          <input
            type="checkbox"
            checked={vipOnly}
            onChange={(e) => setVipOnly(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-amber-600"
          />
          Comptes VIP uniquement
        </label>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-6 w-6" />}
          title="Aucune entreprise enregistrée"
          description="Créez un compte entreprise partagé pour centraliser les informations légales (NIF/STAT/RCS) et le suivi commercial."
        />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Entreprise</th>
                  <th className="py-3 px-4">NIF / STAT / RCS</th>
                  <th className="py-3 px-4">Localisation</th>
                  <th className="py-3 px-4">Contacts & Factures</th>
                  <th className="py-3 px-4">Statut</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filtered.map((c) => {
                  const linkedContacts = contacts.filter((ct) => ct.companyId === c.id).length;
                  const linkedInvoices = invoices.filter((i) => i.companyId === c.id).length;
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4">
                        <Link
                          to={`/companies/${c.id}`}
                          className="font-semibold text-[#19283E] hover:text-[#AD7300] block"
                        >
                          {c.legalName}
                        </Link>
                        <span className="text-xs text-slate-500">
                          {c.tradeName} · {c.legalStatus || 'B2B'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs font-sans tabular-nums text-slate-600 space-y-0.5">
                        <p>NIF : {c.nif || '—'}</p>
                        <p>STAT : {c.stat || '—'}</p>
                        <p>RCS : {c.rcs || '—'}</p>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">
                        {c.city || '—'}
                      </td>
                      <td className="py-3 px-4 text-xs font-sans tabular-nums text-slate-700">
                        {linkedContacts} contact(s) · {linkedInvoices} facture(s)
                      </td>
                      <td className="py-3 px-4">
                        {c.isVip ? (
                          <VipBadge />
                        ) : (
                          <span className="text-xs text-slate-500">Standard</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {canWriteCrm && (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => updateCompany({ ...c, isVip: !c.isVip })}
                              title={c.isVip ? 'Retirer VIP' : 'Passer en VIP'}
                              className={`p-1.5 rounded hover:bg-amber-50 ${
                                c.isVip ? 'text-amber-500' : 'text-slate-400 hover:text-amber-600'
                              }`}
                            >
                              <Star className={`h-4 w-4 ${c.isVip ? 'fill-amber-400' : ''}`} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCompany(c);
                                setModalOpen(true);
                              }}
                              aria-label={`Modifier ${c.legalName}`}
                              className="p-1.5 rounded text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <CompanyFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialCompany={editingCompany}
      />

      <MergeDuplicatesModal
        open={mergeOpen}
        onClose={() => setMergeOpen(false)}
        title="Fusionner deux entreprises en doublon"
        options={companies.map((c) => ({
          id: c.id,
          label: c.legalName,
          sublabel: c.nif || c.email || c.city,
        }))}
        onConfirmMerge={mergeCompanies}
      />
    </div>
  );
}
