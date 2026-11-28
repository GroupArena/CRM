import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useCrm } from '../../context/CrmContext';
import { LEGAL_STATUS_OPTIONS, type Company } from '../../types';
import { findDuplicateCompanies, isValidHttpUrl } from '../../utils/billingLogic';
import { normalizeOptionalHttpUrl } from '../../utils/crmLogic';

interface CompanyFormModalProps {
  open: boolean;
  onClose: () => void;
  initialCompany?: Company | null;
  onCreated?: (company: Company) => void;
}

export function CompanyFormModal({
  open,
  onClose,
  initialCompany,
  onCreated,
}: CompanyFormModalProps) {
  const { companies, contacts, createCompany, updateCompany } = useCrm();

  const [legalName, setLegalName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [legalStatus, setLegalStatus] = useState('SARL');
  const [nif, setNif] = useState('');
  const [stat, setStat] = useState('');
  const [rcs, setRcs] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [primaryContactId, setPrimaryContactId] = useState('');
  const [isVip, setIsVip] = useState(false);
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);
    if (initialCompany) {
      setLegalName(initialCompany.legalName);
      setTradeName(initialCompany.tradeName);
      setLegalStatus(initialCompany.legalStatus || 'SARL');
      setNif(initialCompany.nif);
      setStat(initialCompany.stat);
      setRcs(initialCompany.rcs ?? '');
      setAddress(initialCompany.address);
      setCity(initialCompany.city);
      setCountry(initialCompany.country ?? '');
      setPhone(initialCompany.phone);
      setWhatsapp(initialCompany.whatsapp);
      setEmail(initialCompany.email);
      setWebsite(initialCompany.website);
      setPrimaryContactId(initialCompany.primaryContactId);
      setIsVip(initialCompany.isVip);
      setNotes(initialCompany.notes);
    } else {
      setLegalName('');
      setTradeName('');
      setLegalStatus('SARL');
      setNif('');
      setStat('');
      setRcs('');
      setAddress('');
      setCity('');
      setCountry('');
      setPhone('');
      setWhatsapp('');
      setEmail('');
      setWebsite('');
      setPrimaryContactId('');
      setIsVip(false);
      setNotes('');
    }
  }, [open, initialCompany]);

  const duplicates = useMemo(
    () =>
      findDuplicateCompanies(
        companies,
        { legalName, tradeName, email, phone },
        initialCompany?.id
      ),
    [companies, legalName, tradeName, email, phone, initialCompany?.id]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!legalName.trim()) {
      setErrorMsg('La raison sociale est obligatoire.');
      return;
    }
    const normalizedWebsite = normalizeOptionalHttpUrl(website);
    if (!isValidHttpUrl(normalizedWebsite)) {
      setErrorMsg("L'URL du site web doit commencer par http:// ou https://.");
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const payload = {
        legalName: legalName.trim(),
        tradeName: tradeName.trim() || legalName.trim(),
        legalStatus: legalStatus.trim(),
        nif: nif.trim(),
        stat: stat.trim(),
        rcs: rcs.trim(),
        address: address.trim(),
        city: city.trim(),
        country: country.trim(),
        phone: phone.trim(),
        whatsapp: whatsapp.trim(),
        email: email.trim(),
        website: normalizedWebsite,
        primaryContactId,
        tags: initialCompany?.tags ?? [],
        notes: notes.trim(),
        isVip,
      };
      if (initialCompany) {
        await updateCompany({ ...initialCompany, ...payload });
      } else {
        const created = await createCompany(payload);
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
      title={initialCompany ? 'Modifier le compte entreprise' : 'Nouvelle entreprise (Base partagée)'}
      subtitle="Fiche partagée entre Arena Business Center, Improveo, Arena Studio Comm et Maison & Artisanat."
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
              <p className="font-semibold">Doublon potentiel détecté dans la base commune :</p>
              <p className="mt-0.5">
                {duplicates.map((d) => d.legalName).join(', ')}. Vous pouvez fusionner les doublons depuis la liste des entreprises.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label htmlFor="comp-legal" className="block text-xs font-medium text-slate-700 mb-1">
              Raison sociale *
            </label>
            <input
              id="comp-legal"
              type="text"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              placeholder="Ex : Véranda & Lumière SAS"
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm focus:border-blue-600 focus:outline-none"
              required
            />
          </div>
          <div>
            <label htmlFor="comp-status" className="block text-xs font-medium text-slate-700 mb-1">
              Statut juridique
            </label>
            <select
              id="comp-status"
              value={legalStatus}
              onChange={(e) => setLegalStatus(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-blue-600 focus:outline-none"
            >
              {legalStatus &&
                !LEGAL_STATUS_OPTIONS.includes(
                  legalStatus as (typeof LEGAL_STATUS_OPTIONS)[number]
                ) && <option value={legalStatus}>{legalStatus}</option>}
              {LEGAL_STATUS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="comp-trade" className="block text-xs font-medium text-slate-700 mb-1">
              Nom commercial
            </label>
            <input
              id="comp-trade"
              type="text"
              value={tradeName}
              onChange={(e) => setTradeName(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
            />
          </div>
          <div>
            <label htmlFor="comp-primary" className="block text-xs font-medium text-slate-700 mb-1">
              Contact principal
            </label>
            <select
              id="comp-primary"
              value={primaryContactId}
              onChange={(e) => setPrimaryContactId(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">Aucun</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="comp-nif" className="block text-xs font-medium text-slate-700 mb-1">
              NIF
            </label>
            <input
              id="comp-nif"
              type="text"
              value={nif}
              onChange={(e) => setNif(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm font-sans tabular-nums"
            />
          </div>
          <div>
            <label htmlFor="comp-stat" className="block text-xs font-medium text-slate-700 mb-1">
              STAT
            </label>
            <input
              id="comp-stat"
              type="text"
              value={stat}
              onChange={(e) => setStat(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm font-sans tabular-nums"
            />
          </div>
          <div>
            <label htmlFor="comp-rcs" className="block text-xs font-medium text-slate-700 mb-1">
              RCS (Registre du commerce)
            </label>
            <input
              id="comp-rcs"
              type="text"
              maxLength={60}
              placeholder="ex. RCS Antananarivo 2020 B 00123"
              value={rcs}
              onChange={(e) => setRcs(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm font-sans tabular-nums"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="comp-email" className="block text-xs font-medium text-slate-700 mb-1">
              Email
            </label>
            <input
              id="comp-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
            />
          </div>
          <div>
            <label htmlFor="comp-phone" className="block text-xs font-medium text-slate-700 mb-1">
              Téléphone
            </label>
            <input
              id="comp-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
            />
          </div>
          <div>
            <label htmlFor="comp-wa" className="block text-xs font-medium text-slate-700 mb-1">
              WhatsApp
            </label>
            <input
              id="comp-wa"
              type="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="+336..."
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <label htmlFor="comp-address" className="block text-xs font-medium text-slate-700 mb-1">
              Adresse
            </label>
            <input
              id="comp-address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Ex : Lot III V 19 A Anosizato Est I"
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
            />
          </div>
          <div>
            <label htmlFor="comp-city" className="block text-xs font-medium text-slate-700 mb-1">
              Ville
            </label>
            <input
              id="comp-city"
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Ex : 101 Antananarivo"
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
            />
          </div>
          <div>
            <label htmlFor="comp-country" className="block text-xs font-medium text-slate-700 mb-1">
              Pays
            </label>
            <input
              id="comp-country"
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="Ex : Madagascar"
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
          <div>
            <label htmlFor="comp-web" className="block text-xs font-medium text-slate-700 mb-1">
              Site web
            </label>
            <input
              id="comp-web"
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://..."
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
            />
          </div>
          <label className="inline-flex items-center gap-2 pt-5 text-sm font-medium text-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={isVip}
              onChange={(e) => setIsVip(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-amber-600"
            />
            Marquer comme compte VIP
          </label>
        </div>

        <div>
          <label htmlFor="comp-notes" className="block text-xs font-medium text-slate-700 mb-1">
            Notes internes
          </label>
          <textarea
            id="comp-notes"
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
            {submitting ? 'Enregistrement...' : initialCompany ? 'Enregistrer' : 'Créer l’entreprise'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
