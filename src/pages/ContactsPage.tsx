import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  Search,
  Contact2,
  Edit2,
  GitMerge,
  Mail,
  Phone,
  MessageSquare,
  Star,
} from 'lucide-react';
import { useCrm } from '../context/CrmContext';
import { useAuth } from '../hooks/useAuth';
import type { Contact } from '../types';
import { VipBadge } from '../components/ui/StatusBadge';
import { EmptyState } from '../components/ui/EmptyState';
import { ContactFormModal } from '../components/crm/ContactFormModal';
import { MergeDuplicatesModal } from '../components/crm/MergeDuplicatesModal';
import { buildMailtoLink, buildWhatsAppLink } from '../utils/billingLogic';

export function ContactsPage() {
  const { contacts, companies, deals, invoices, globalSearch, mergeContacts, updateContact } = useCrm();
  const { canWriteCrm } = useAuth();

  const [search, setSearch] = useState(globalSearch);
  const [vipOnly, setVipOnly] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts.filter((c) => {
      if (vipOnly && !c.isVip) return false;
      if (!q) return true;
      const comp = companies.find((co) => co.id === c.companyId);
      return (
        c.fullName.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.whatsapp.toLowerCase().includes(q) ||
        (comp?.legalName.toLowerCase().includes(q) ?? false)
      );
    });
  }, [contacts, companies, search, vipOnly]);

  const getCompanyName = (companyId: string) =>
    companies.find((c) => c.id === companyId)?.legalName ?? 'Particulier';

  const getEntityLinksCount = (contactId: string) => {
    const entityIds = new Set<string>();
    deals.filter((d) => d.contactId === contactId).forEach((d) => entityIds.add(d.entityId));
    invoices.filter((i) => i.contactId === contactId).forEach((i) => entityIds.add(i.entityId));
    return entityIds.size;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Contacts partagés
          </h1>
          <p className="text-sm text-slate-500 mt-1 tabular-nums">
            Base commune aux 4 entités · {filteredContacts.length} contact
            {filteredContacts.length > 1 ? 's' : ''}
          </p>
        </div>

        {canWriteCrm && (
          <div className="flex items-center gap-2.5">
            {contacts.length >= 2 && (
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
                setEditingContact(null);
                setModalOpen(true);
              }}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#19283E] px-4 text-sm font-medium text-white hover:bg-[#223552] whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              Nouveau contact
            </button>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="search"
            aria-label="Rechercher un contact"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom, email, téléphone, WhatsApp, entreprise..."
            className="w-full h-9 rounded-lg border border-slate-200 pl-9 pr-3 text-sm focus:border-[#C9A125] focus:outline-none"
          />
        </div>

        <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer px-2">
          <input
            type="checkbox"
            checked={vipOnly}
            onChange={(e) => setVipOnly(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-amber-600"
          />
          Contacts VIP uniquement
        </label>
      </div>

      {filteredContacts.length === 0 ? (
        <EmptyState
          icon={<Contact2 className="h-6 w-6" />}
          title="Aucun contact trouvé"
          description="Ajoutez un contact à la base partagée Arena Group pour le lier aux opportunités et devis des 4 entités."
        />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Entreprise</th>
                  <th className="py-3 px-4">Coordonnées</th>
                  <th className="py-3 px-4">Entités actives</th>
                  <th className="py-3 px-4">Statut</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredContacts.map((c) => {
                  const activeEntitiesCount = getEntityLinksCount(c.id);
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4">
                        <Link
                          to={`/contacts/${c.id}`}
                          className="font-semibold text-[#19283E] hover:text-[#AD7300] block"
                        >
                          {c.fullName}
                        </Link>
                        <span className="text-xs text-slate-500">{c.jobTitle || 'Interlocuteur'}</span>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        {c.companyId ? (
                          <Link
                            to={`/companies/${c.companyId}`}
                            className="font-medium text-[#19283E] hover:text-[#AD7300] hover:underline"
                          >
                            {getCompanyName(c.companyId)}
                          </Link>
                        ) : (
                          <span className="text-slate-500">Particulier</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 space-y-0.5">
                        <p className="truncate max-w-[210px]">{c.email || '—'}</p>
                        <p className="font-sans tabular-nums">{c.phone || c.whatsapp || '—'}</p>
                      </td>
                      <td className="py-3 px-4 text-xs font-sans tabular-nums text-slate-700">
                        {activeEntitiesCount > 0 ? `${activeEntitiesCount} entité(s)` : 'Partagé'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          {c.isVip ? (
                            <VipBadge />
                          ) : (
                            <span className="text-xs text-slate-500">Standard</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          {c.phone && (
                            <a
                              href={`tel:${c.phone}`}
                              title="Appeler"
                              className="p-1.5 rounded text-slate-500 hover:bg-slate-100 hover:text-blue-700"
                            >
                              <Phone className="h-4 w-4" />
                            </a>
                          )}
                          {(c.whatsapp || c.phone) && (
                            <a
                              href={buildWhatsAppLink(c.whatsapp || c.phone)}
                              target="_blank"
                              rel="noreferrer"
                              title="Ouvrir WhatsApp"
                              className="p-1.5 rounded text-slate-500 hover:bg-emerald-50 hover:text-emerald-700"
                            >
                              <MessageSquare className="h-4 w-4" />
                            </a>
                          )}
                          {c.email && (
                            <a
                              href={buildMailtoLink(c.email)}
                              title="Envoyer un email"
                              className="p-1.5 rounded text-slate-500 hover:bg-blue-50 hover:text-blue-700"
                            >
                              <Mail className="h-4 w-4" />
                            </a>
                          )}
                          {canWriteCrm && (
                            <>
                              <button
                                type="button"
                                onClick={() => updateContact({ ...c, isVip: !c.isVip })}
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
                                  setEditingContact(c);
                                  setModalOpen(true);
                                }}
                                aria-label={`Modifier ${c.fullName}`}
                                className="p-1.5 rounded text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                            </>
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

      <ContactFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialContact={editingContact}
      />

      <MergeDuplicatesModal
        open={mergeOpen}
        onClose={() => setMergeOpen(false)}
        title="Fusionner deux contacts en doublon"
        options={contacts.map((c) => ({
          id: c.id,
          label: c.fullName,
          sublabel: c.email || c.phone || getCompanyName(c.companyId),
        }))}
        onConfirmMerge={mergeContacts}
      />
    </div>
  );
}
