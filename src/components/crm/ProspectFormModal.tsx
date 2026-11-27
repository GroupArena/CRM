import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { useCrm } from '../../context/CrmContext';
import { useAuth } from '../../hooks/useAuth';
import {
  ACTION_TYPES,
  PRIORITY_LABELS,
  PROSPECT_STATUSES,
  type PriorityLevel,
  type Prospect,
  type ProspectStatus,
} from '../../types';
import { validateProspectInput } from '../../utils/crmLogic';

interface ProspectFormModalProps {
  open: boolean;
  onClose: () => void;
  initialProspect?: Prospect | null;
}

export function ProspectFormModal({
  open,
  onClose,
  initialProspect,
}: ProspectFormModalProps) {
  const {
    authorizedEntities,
    selectedEntityId,
    users,
    tags: availableTags,
    createProspect,
    updateProspect,
  } = useCrm();
  const { user } = useAuth();

  const defaultEntity =
    selectedEntityId !== 'all'
      ? selectedEntityId
      : authorizedEntities[0]?.id ?? 'arena-business-center';

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [primaryEntityId, setPrimaryEntityId] = useState(defaultEntity);
  const [sharedEntityIds, setSharedEntityIds] = useState<string[]>([]);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [mobile, setMobile] = useState('');
  const [website, setWebsite] = useState('');
  const [status, setStatus] = useState<ProspectStatus>('Nouveau');
  const [source, setSource] = useState('Site web');
  const [ownerUid, setOwnerUid] = useState(user?.uid ?? '');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [priority, setPriority] = useState<PriorityLevel>('medium');
  const [estimatedValue, setEstimatedValue] = useState('0');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [consentMarketing, setConsentMarketing] = useState(false);
  const [gdprConsentDate, setGdprConsentDate] = useState('');
  const [nextActionDate, setNextActionDate] = useState('');
  const [nextActionType, setNextActionType] = useState('Appel');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);
    if (initialProspect) {
      setFirstName(initialProspect.firstName);
      setLastName(initialProspect.lastName);
      setCompanyName(initialProspect.companyName);
      setPrimaryEntityId(initialProspect.primaryEntityId);
      setSharedEntityIds(initialProspect.sharedEntityIds);
      setEmail(initialProspect.email);
      setPhone(initialProspect.phone);
      setMobile(initialProspect.mobile);
      setWebsite(initialProspect.website);
      setStatus(initialProspect.status);
      setSource(initialProspect.source);
      setOwnerUid(initialProspect.ownerUid);
      setSelectedTags(initialProspect.tags);
      setPriority(initialProspect.priority);
      setEstimatedValue(String(initialProspect.estimatedValue || 0));
      setAddress(initialProspect.address);
      setCity(initialProspect.city);
      setCountry(initialProspect.country ?? '');
      setConsentMarketing(initialProspect.consentMarketing);
      setGdprConsentDate(initialProspect.gdprConsentDate);
      setNextActionDate(initialProspect.nextActionDate);
      setNextActionType(initialProspect.nextActionType || 'Appel');
      setNotes(initialProspect.notes);
    } else {
      setFirstName('');
      setLastName('');
      setCompanyName('');
      setPrimaryEntityId(defaultEntity);
      setSharedEntityIds([]);
      setEmail('');
      setPhone('');
      setMobile('');
      setWebsite('');
      setStatus('Nouveau');
      setSource('Site web');
      setOwnerUid(user?.uid ?? '');
      setSelectedTags([]);
      setPriority('medium');
      setEstimatedValue('0');
      setAddress('');
      setCity('');
      setCountry('');
      setConsentMarketing(false);
      setGdprConsentDate(new Date().toISOString().slice(0, 10));
      setNextActionDate('');
      setNextActionType('Appel');
      setNotes('');
    }
  }, [open, initialProspect, defaultEntity, user?.uid]);

  const toggleSharedEntity = (entityId: string) => {
    if (entityId === primaryEntityId) return;
    setSharedEntityIds((prev) =>
      prev.includes(entityId)
        ? prev.filter((id) => id !== entityId)
        : [...prev, entityId]
    );
  };

  const toggleTag = (tagName: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagName)
        ? prev.filter((t) => t !== tagName)
        : [...prev, tagName]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericVal = Number(estimatedValue) || 0;
    const validationError = validateProspectInput({
      firstName,
      lastName,
      primaryEntityId,
      email,
      estimatedValue: numericVal,
    });
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      const payload = {
        primaryEntityId,
        sharedEntityIds: sharedEntityIds.filter((id) => id !== primaryEntityId),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        companyName: companyName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        mobile: mobile.trim(),
        website: website.trim(),
        status,
        source: source.trim(),
        ownerUid: ownerUid || user?.uid || 'system',
        tags: selectedTags,
        notes: notes.trim(),
        priority,
        estimatedValue: numericVal,
        address: address.trim(),
        city: city.trim(),
        country: country.trim(),
        consentMarketing,
        gdprConsentDate: consentMarketing
          ? gdprConsentDate || new Date().toISOString().slice(0, 10)
          : gdprConsentDate,
        archived: initialProspect?.archived ?? false,
        nextActionDate,
        nextActionType,
      };
      if (initialProspect) {
        await updateProspect({ ...initialProspect, ...payload });
      } else {
        await createProspect(payload);
      }
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Erreur lors de l'enregistrement."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialProspect ? 'Modifier le prospect' : 'Nouveau prospect'}
      subtitle="Renseignez les coordonnées, l'entité de rattachement et la qualification."
      maxWidthClass="max-w-3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {errorMsg && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {errorMsg}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="prospect-firstName" className="block text-xs font-medium text-slate-700 mb-1">
              Prénom *
            </label>
            <input
              id="prospect-firstName"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm focus:border-blue-600 focus:outline-none"
              placeholder="Ex : Claire"
              required
            />
          </div>
          <div>
            <label htmlFor="prospect-lastName" className="block text-xs font-medium text-slate-700 mb-1">
              Nom *
            </label>
            <input
              id="prospect-lastName"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm focus:border-blue-600 focus:outline-none"
              placeholder="Ex : Martin"
              required
            />
          </div>
          <div>
            <label htmlFor="prospect-company" className="block text-xs font-medium text-slate-700 mb-1">
              Entreprise
            </label>
            <input
              id="prospect-company"
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm focus:border-blue-600 focus:outline-none"
              placeholder="Ex : Martin Conseil SAS"
            />
          </div>
          <div>
            <label htmlFor="prospect-entity" className="block text-xs font-medium text-slate-700 mb-1">
              Entité principale *
            </label>
            <select
              id="prospect-entity"
              value={primaryEntityId}
              onChange={(e) => {
                setPrimaryEntityId(e.target.value);
                setSharedEntityIds((prev) => prev.filter((id) => id !== e.target.value));
              }}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-blue-600 focus:outline-none"
            >
              {authorizedEntities.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <span className="block text-xs font-medium text-slate-700 mb-1.5">
            Partager avec d'autres entités (optionnel)
          </span>
          <div className="flex flex-wrap gap-2">
            {authorizedEntities
              .filter((e) => e.id !== primaryEntityId)
              .map((entity) => {
                const active = sharedEntityIds.includes(entity.id);
                return (
                  <button
                    key={entity.id}
                    type="button"
                    onClick={() => toggleSharedEntity(entity.id)}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                      active
                        ? 'border-blue-600 bg-blue-50 text-blue-800'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {entity.name}
                  </button>
                );
              })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="prospect-email" className="block text-xs font-medium text-slate-700 mb-1">
              Email
            </label>
            <input
              id="prospect-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm focus:border-blue-600 focus:outline-none"
              placeholder="contact@entreprise.fr"
            />
          </div>
          <div>
            <label htmlFor="prospect-phone" className="block text-xs font-medium text-slate-700 mb-1">
              Téléphone fixe
            </label>
            <input
              id="prospect-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm focus:border-blue-600 focus:outline-none"
              placeholder="01 42 68 55 10"
            />
          </div>
          <div>
            <label htmlFor="prospect-mobile" className="block text-xs font-medium text-slate-700 mb-1">
              Mobile
            </label>
            <input
              id="prospect-mobile"
              type="tel"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm focus:border-blue-600 focus:outline-none"
              placeholder="06 12 34 56 78"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label htmlFor="prospect-status" className="block text-xs font-medium text-slate-700 mb-1">
              Statut
            </label>
            <select
              id="prospect-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as ProspectStatus)}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-blue-600 focus:outline-none"
            >
              {PROSPECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="prospect-priority" className="block text-xs font-medium text-slate-700 mb-1">
              Priorité
            </label>
            <select
              id="prospect-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as PriorityLevel)}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-blue-600 focus:outline-none"
            >
              {(Object.keys(PRIORITY_LABELS) as PriorityLevel[]).map((k) => (
                <option key={k} value={k}>
                  {PRIORITY_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="prospect-value" className="block text-xs font-medium text-slate-700 mb-1">
              Valeur estimée (Ar)
            </label>
            <input
              id="prospect-value"
              type="number"
              min="0"
              value={estimatedValue}
              onChange={(e) => setEstimatedValue(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm tabular-nums focus:border-blue-600 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="prospect-owner" className="block text-xs font-medium text-slate-700 mb-1">
              Responsable
            </label>
            <select
              id="prospect-owner"
              value={ownerUid}
              onChange={(e) => setOwnerUid(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-blue-600 focus:outline-none"
            >
              {users.length > 0 ? (
                users.map((u) => (
                  <option key={u.uid} value={u.uid}>
                    {u.displayName}
                  </option>
                ))
              ) : (
                <option value={user?.uid ?? ''}>{user?.displayName ?? 'Moi'}</option>
              )}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="prospect-source" className="block text-xs font-medium text-slate-700 mb-1">
              Source d'acquisition
            </label>
            <input
              id="prospect-source"
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm focus:border-blue-600 focus:outline-none"
              placeholder="Site web, LinkedIn, Salon..."
            />
          </div>
          <div>
            <label htmlFor="prospect-nextActionDate" className="block text-xs font-medium text-slate-700 mb-1">
              Prochaine action (date)
            </label>
            <input
              id="prospect-nextActionDate"
              type="date"
              value={nextActionDate}
              onChange={(e) => setNextActionDate(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="prospect-nextActionType" className="block text-xs font-medium text-slate-700 mb-1">
              Type prochaine action
            </label>
            <select
              id="prospect-nextActionType"
              value={nextActionType}
              onChange={(e) => setNextActionType(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-blue-600 focus:outline-none"
            >
              {ACTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="sm:col-span-2">
            <label htmlFor="prospect-address" className="block text-xs font-medium text-slate-700 mb-1">
              Adresse
            </label>
            <input
              id="prospect-address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Ex : Lot III V 19 A Anosizato Est I"
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="prospect-city" className="block text-xs font-medium text-slate-700 mb-1">
              Ville
            </label>
            <input
              id="prospect-city"
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Ex : 101 Antananarivo"
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="prospect-country" className="block text-xs font-medium text-slate-700 mb-1">
              Pays
            </label>
            <input
              id="prospect-country"
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="Ex : Madagascar"
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="prospect-website" className="block text-xs font-medium text-slate-700 mb-1">
              Site web
            </label>
            <input
              id="prospect-website"
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm focus:border-blue-600 focus:outline-none"
              placeholder="https://..."
            />
          </div>
          <div className="flex items-end gap-3 pb-1">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={consentMarketing}
                onChange={(e) => setConsentMarketing(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
              />
              Consentement marketing RGPD
            </label>
          </div>
        </div>

        {availableTags.length > 0 && (
          <div>
            <span className="block text-xs font-medium text-slate-700 mb-1.5">
              Tags
            </span>
            <div className="flex flex-wrap gap-1.5">
              {availableTags.map((t) => {
                const active = selectedTags.includes(t.name);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTag(t.name)}
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                      active
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <label htmlFor="prospect-notes" className="block text-xs font-medium text-slate-700 mb-1">
            Notes commerciales
          </label>
          <textarea
            id="prospect-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-lg border border-slate-200 p-3 text-sm focus:border-[#C9A125] focus:outline-none"
            placeholder="Contexte du besoin, budget, interlocuteurs..."
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
            {submitting
              ? 'Enregistrement...'
              : initialProspect
              ? 'Enregistrer les modifications'
              : 'Créer le prospect'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
