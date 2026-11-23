import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Phone,
  MessageSquare,
  Mail,
  FileText,
  Briefcase,
  CheckSquare,
  AlertOctagon,
  Edit2,
  Building2,
  Star,
} from 'lucide-react';
import { useCrm } from '../context/CrmContext';
import { useAuth } from '../hooks/useAuth';
import { VipBadge } from '../components/ui/StatusBadge';
import { ClientHistoryTimeline } from '../components/crm/ClientHistoryTimeline';
import { ContactFormModal } from '../components/crm/ContactFormModal';
import { QuoteFormModal } from '../components/crm/QuoteFormModal';
import { DealFormModal } from '../components/crm/DealFormModal';
import { ActionFormModal } from '../components/crm/ActionFormModal';
import { Modal } from '../components/ui/Modal';
import { PRIORITY_LABELS, type PriorityLevel } from '../types';
import { buildMailtoLink, buildWhatsAppLink } from '../utils/billingLogic';

export function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const {
    contacts,
    companies,
    authorizedEntities,
    selectedEntityId,
    updateContact,
    logCommunicationAction,
    saveComplaint,
  } = useCrm();
  const { canWriteCrm, user } = useAuth();

  const contact = contacts.find((c) => c.id === id);
  const company = companies.find((co) => co.id === contact?.companyId);

  const activeEntityId =
    selectedEntityId !== 'all' ? selectedEntityId : authorizedEntities[0]?.id ?? 'arena-business-center';

  const [editOpen, setEditOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [dealOpen, setDealOpen] = useState(false);
  const [actionOpen, setActionOpen] = useState(false);
  const [complaintOpen, setComplaintOpen] = useState(false);

  const [compEntityId, setCompEntityId] = useState(activeEntityId);
  const [compSubject, setCompSubject] = useState('');
  const [compDesc, setCompDesc] = useState('');
  const [compPriority, setCompPriority] = useState<PriorityLevel>('medium');

  if (!contact) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center space-y-3">
        <p className="text-base font-semibold text-slate-900">Contact introuvable</p>
        <Link to="/contacts" className="text-sm font-medium text-[#19283E] hover:text-[#AD7300] hover:underline">
          Retour aux contacts
        </Link>
      </div>
    );
  }

  const handleQuickChannel = async (channel: 'Appel' | 'Email' | 'Message WhatsApp') => {
    await logCommunicationAction({
      contactId: contact.id,
      companyId: contact.companyId || undefined,
      entityId: activeEntityId,
      channel,
      title: `${channel} avec ${contact.fullName}`,
      description: `${channel} initié depuis la fiche contact.`,
    });
  };

  const handleCreateComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compSubject.trim()) return;
    await saveComplaint(
      {
        id: `comp-req-${Date.now()}`,
        entityId: compEntityId,
        contactId: contact.id,
        companyId: contact.companyId || '',
        subject: compSubject.trim(),
        description: compDesc.trim(),
        status: 'Nouvelle',
        priority: compPriority,
        assignedToUid: user?.uid ?? '',
        resolution: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      true
    );
    setCompSubject('');
    setCompDesc('');
    setComplaintOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link
            to="/contacts"
            className="mt-1 rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
            aria-label="Retour aux contacts"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-display text-2xl font-bold text-slate-900">
                {contact.fullName}
              </h1>
              {contact.isVip && <VipBadge />}
            </div>
            <p className="text-sm text-slate-600 mt-1 flex flex-wrap items-center gap-2">
              <span>{contact.jobTitle || 'Interlocuteur'}</span>
              {company && (
                <>
                  <span>·</span>
                  <Link
                    to={`/companies/${company.id}`}
                    className="inline-flex items-center gap-1 font-medium text-[#19283E] hover:text-[#AD7300] hover:underline"
                  >
                    <Building2 className="h-3.5 w-3.5" />
                    {company.legalName}
                  </Link>
                </>
              )}
            </p>
          </div>
        </div>

        {canWriteCrm && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => updateContact({ ...contact, isVip: !contact.isVip })}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Star className={`h-3.5 w-3.5 ${contact.isVip ? 'fill-amber-400 text-amber-500' : 'text-slate-400'}`} />
              {contact.isVip ? 'VIP actif' : 'Passer VIP'}
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

      {/* Boutons d'action rapide depuis la fiche contact */}
      {canWriteCrm && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-wrap items-center gap-2.5">
          <a
            href={contact.phone ? `tel:${contact.phone}` : undefined}
            onClick={() => handleQuickChannel('Appel')}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-800 hover:bg-slate-100 whitespace-nowrap"
          >
            <Phone className="h-3.5 w-3.5 text-blue-600" />
            Appeler
          </a>
          <a
            href={buildWhatsAppLink(contact.whatsapp || contact.phone, `Bonjour ${contact.fullName},`)}
            target="_blank"
            rel="noreferrer"
            onClick={() => handleQuickChannel('Message WhatsApp')}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-medium text-emerald-800 hover:bg-emerald-100 whitespace-nowrap"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            WhatsApp
          </a>
          <a
            href={buildMailtoLink(contact.email, 'Suivi Arena Group')}
            onClick={() => handleQuickChannel('Email')}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs font-medium text-indigo-800 hover:bg-indigo-100 whitespace-nowrap"
          >
            <Mail className="h-3.5 w-3.5" />
            Email
          </a>
          <button
            type="button"
            onClick={() => setQuoteOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#19283E] px-3 text-xs font-medium text-white hover:bg-[#223552] whitespace-nowrap"
          >
            <FileText className="h-3.5 w-3.5" />
            Créer devis
          </button>
          <button
            type="button"
            onClick={() => setDealOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap"
          >
            <Briefcase className="h-3.5 w-3.5 text-violet-600" />
            Créer opportunité
          </button>
          <button
            type="button"
            onClick={() => setActionOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap"
          >
            <CheckSquare className="h-3.5 w-3.5 text-slate-600" />
            Créer tâche
          </button>
          <button
            type="button"
            onClick={() => setComplaintOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-medium text-red-800 hover:bg-red-100 whitespace-nowrap"
          >
            <AlertOctagon className="h-3.5 w-3.5" />
            Ajouter réclamation
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <h2 className="text-base font-semibold text-slate-900">Coordonnées & Conformité</h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Email</dt>
              <dd className="font-medium text-slate-900">{contact.email || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Téléphone</dt>
              <dd className="font-sans tabular-nums text-slate-900">{contact.phone || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">WhatsApp</dt>
              <dd className="font-sans tabular-nums text-slate-900">{contact.whatsapp || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Consentement marketing RGPD</dt>
              <dd className="text-slate-800">
                {contact.consentMarketing
                  ? `Oui (${contact.gdprConsentDate || 'enregistré'})`
                  : 'Non consenti'}
              </dd>
            </div>
            {contact.notes && (
              <div>
                <dt className="text-xs text-slate-500">Notes</dt>
                <dd className="text-slate-700 whitespace-pre-line">{contact.notes}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <h2 className="text-base font-semibold text-slate-900">
            Historique complet inter-entités
          </h2>
          <ClientHistoryTimeline contactId={contact.id} />
        </div>
      </div>

      <ContactFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        initialContact={contact}
      />

      <QuoteFormModal
        open={quoteOpen}
        onClose={() => setQuoteOpen(false)}
        defaultEntityId={activeEntityId}
        defaultContactId={contact.id}
        defaultCompanyId={contact.companyId}
      />

      <DealFormModal
        open={dealOpen}
        onClose={() => setDealOpen(false)}
        defaultEntityId={activeEntityId}
        defaultContactId={contact.id}
        defaultCompanyId={contact.companyId}
      />

      <ActionFormModal
        open={actionOpen}
        onClose={() => setActionOpen(false)}
        defaultEntityId={activeEntityId}
        defaultContactId={contact.id}
        defaultCompanyId={contact.companyId}
      />

      <Modal
        open={complaintOpen}
        onClose={() => setComplaintOpen(false)}
        title="Nouvelle réclamation client"
        subtitle={`Contact : ${contact.fullName}`}
      >
        <form onSubmit={handleCreateComplaint} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="cc-entity" className="block text-xs font-medium text-slate-700 mb-1">
                Entité concernée
              </label>
              <select
                id="cc-entity"
                value={compEntityId}
                onChange={(e) => setCompEntityId(e.target.value)}
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
              <label htmlFor="cc-prio" className="block text-xs font-medium text-slate-700 mb-1">
                Priorité
              </label>
              <select
                id="cc-prio"
                value={compPriority}
                onChange={(e) => setCompPriority(e.target.value as PriorityLevel)}
                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
              >
                {(Object.keys(PRIORITY_LABELS) as PriorityLevel[]).map((k) => (
                  <option key={k} value={k}>
                    {PRIORITY_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="cc-subj" className="block text-xs font-medium text-slate-700 mb-1">
              Objet de la réclamation *
            </label>
            <input
              id="cc-subj"
              type="text"
              value={compSubject}
              onChange={(e) => setCompSubject(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
              required
            />
          </div>
          <div>
            <label htmlFor="cc-desc" className="block text-xs font-medium text-slate-700 mb-1">
              Description détaillée
            </label>
            <textarea
              id="cc-desc"
              rows={3}
              value={compDesc}
              onChange={(e) => setCompDesc(e.target.value)}
              className="w-full rounded-lg border border-slate-200 p-3 text-sm"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setComplaintOpen(false)}
              className="h-9 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="h-9 rounded-lg bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700"
            >
              Enregistrer
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
