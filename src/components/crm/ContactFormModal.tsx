import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useCrm } from '../../context/CrmContext';
import type { Contact } from '../../types';
import { findDuplicateContacts } from '../../utils/billingLogic';

interface ContactFormModalProps {
  open: boolean;
  onClose: () => void;
  initialContact?: Contact | null;
  defaultCompanyId?: string;
  onCreated?: (contact: Contact) => void;
}

export function ContactFormModal({
  open,
  onClose,
  initialContact,
  defaultCompanyId,
  onCreated,
}: ContactFormModalProps) {
  const { contacts, companies, createContact, updateContact } = useCrm();

  const [fullName, setFullName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [companyId, setCompanyId] = useState(defaultCompanyId ?? '');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [isVip, setIsVip] = useState(false);
  const [consentMarketing, setConsentMarketing] = useState(true);
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);
    if (initialContact) {
      setFullName(initialContact.fullName);
      setJobTitle(initialContact.jobTitle);
      setCompanyId(initialContact.companyId);
      setEmail(initialContact.email);
      setPhone(initialContact.phone);
      setWhatsapp(initialContact.whatsapp);
      setIsVip(initialContact.isVip);
      setConsentMarketing(initialContact.consentMarketing);
      setNotes(initialContact.notes);
    } else {
      setFullName('');
      setJobTitle('');
      setCompanyId(defaultCompanyId ?? '');
      setEmail('');
      setPhone('');
      setWhatsapp('');
      setIsVip(false);
      setConsentMarketing(true);
      setNotes('');
    }
  }, [open, initialContact, defaultCompanyId]);

  const duplicates = useMemo(
    () =>
      findDuplicateContacts(
        contacts,
        { fullName, email, phone, whatsapp },
        initialContact?.id
      ),
    [contacts, fullName, email, phone, whatsapp, initialContact?.id]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setErrorMsg('Le nom complet est obligatoire.');
      return;
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMsg('Adresse email invalide.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      const payload = {
        fullName: fullName.trim(),
        jobTitle: jobTitle.trim(),
        companyId,
        email: email.trim(),
        phone: phone.trim(),
        whatsapp: whatsapp.trim(),
        isVip,
        tags: initialContact?.tags ?? [],
        consentMarketing,
        gdprConsentDate: consentMarketing
          ? initialContact?.gdprConsentDate || new Date().toISOString().slice(0, 10)
          : '',
        notes: notes.trim(),
      };
      if (initialContact) {
        await updateContact({ ...initialContact, ...payload });
      } else {
        const created = await createContact(payload);
        onCreated?.(created);
      }
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialContact ? 'Modifier le contact' : 'Nouveau contact (Base partagée)'}
      subtitle="Contact unique partagé entre toutes les entités Arena Group."
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {errorMsg && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {errorMsg}
          </div>
        )}

        {duplicates.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Doublon potentiel détecté :</p>
              <p className="mt-0.5">
                {duplicates.map((d) => `${d.fullName} (${d.email || d.phone})`).join(', ')}. Vous pouvez fusionner ces fiches depuis la liste des contacts.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="ct-fullname" className="block text-xs font-medium text-slate-700 mb-1">
              Nom complet *
            </label>
            <input
              id="ct-fullname"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ex : Marc Delacroix"
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
              required
            />
          </div>
          <div>
            <label htmlFor="ct-job" className="block text-xs font-medium text-slate-700 mb-1">
              Fonction
            </label>
            <input
              id="ct-job"
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="Directeur Général"
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
            />
          </div>
        </div>

        <div>
          <label htmlFor="ct-company" className="block text-xs font-medium text-slate-700 mb-1">
            Entreprise / Compte affilié
          </label>
          <select
            id="ct-company"
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">Particulier / Indépendant</option>
            {companies.map((comp) => (
              <option key={comp.id} value={comp.id}>
                {comp.legalName}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="ct-email" className="block text-xs font-medium text-slate-700 mb-1">
              Email
            </label>
            <input
              id="ct-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
            />
          </div>
          <div>
            <label htmlFor="ct-phone" className="block text-xs font-medium text-slate-700 mb-1">
              Téléphone
            </label>
            <input
              id="ct-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
            />
          </div>
          <div>
            <label htmlFor="ct-wa" className="block text-xs font-medium text-slate-700 mb-1">
              WhatsApp
            </label>
            <input
              id="ct-wa"
              type="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="+336..."
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6 pt-1">
          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={isVip}
              onChange={(e) => setIsVip(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-amber-600"
            />
            Contact VIP
          </label>
          <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={consentMarketing}
              onChange={(e) => setConsentMarketing(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600"
            />
            Consentement marketing RGPD
          </label>
        </div>

        <div>
          <label htmlFor="ct-notes" className="block text-xs font-medium text-slate-700 mb-1">
            Notes
          </label>
          <textarea
            id="ct-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-lg border border-slate-200 p-3 text-sm"
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
            disabled={submitting}
            className="h-9 rounded-lg bg-[#19283E] px-4 text-sm font-medium text-white hover:bg-[#223552] disabled:opacity-50"
          >
            {submitting ? 'Enregistrement...' : initialContact ? 'Enregistrer' : 'Créer le contact'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
