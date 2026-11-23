import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { useCrm } from '../../context/CrmContext';
import { useAuth } from '../../hooks/useAuth';
import { LOST_REASONS, SUPPORTED_CURRENCIES, type Deal, type LostReason } from '../../types';
import { formatCurrency, validateDealInput } from '../../utils/crmLogic';

interface DealFormModalProps {
  open: boolean;
  onClose: () => void;
  defaultEntityId?: string;
  defaultProspectId?: string;
  defaultContactId?: string;
  defaultCompanyId?: string;
  initialDeal?: Deal | null;
}

export function DealFormModal({
  open,
  onClose,
  defaultEntityId,
  defaultProspectId,
  defaultContactId,
  defaultCompanyId,
  initialDeal,
}: DealFormModalProps) {
  const {
    authorizedEntities,
    selectedEntityId,
    scopedProspects,
    contacts,
    companies,
    products,
    pipelines,
    stages,
    users,
    settings,
    createDeal,
    updateDeal,
  } = useCrm();
  const { user } = useAuth();

  const resolvedEntity =
    defaultEntityId ||
    (selectedEntityId !== 'all' ? selectedEntityId : authorizedEntities[0]?.id ?? '');

  const [entityId, setEntityId] = useState(resolvedEntity);
  const [contactId, setContactId] = useState(defaultContactId ?? '');
  const [companyId, setCompanyId] = useState(defaultCompanyId ?? '');
  const [prospectId, setProspectId] = useState(defaultProspectId ?? '');
  const [name, setName] = useState('');
  const [serviceConcerned, setServiceConcerned] = useState('');
  const [productId, setProductId] = useState('');
  const [pipelineId, setPipelineId] = useState('');
  const [stageId, setStageId] = useState('');
  const [amount, setAmount] = useState('1500000');
  const [currency, setCurrency] = useState(settings.defaultCurrency || 'MGA');
  const [probability, setProbability] = useState('25');
  const [expectedCloseDate, setExpectedCloseDate] = useState('');
  const [ownerUid, setOwnerUid] = useState(user?.uid ?? '');
  const [lostReason, setLostReason] = useState<LostReason>('Prix');
  const [lostComment, setLostComment] = useState('');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const entityPipelines = pipelines.filter((p) => p.entityId === entityId);
  const activePipelineId =
    pipelineId && entityPipelines.some((p) => p.id === pipelineId)
      ? pipelineId
      : entityPipelines[0]?.id ?? `pipeline-${entityId}`;

  const pipelineStages = [...stages]
    .filter((s) => s.pipelineId === activePipelineId)
    .sort((a, b) => a.order - b.order);

  const selectedStage = stages.find((s) => s.id === stageId);
  const isLostStage = selectedStage?.outcomeType === 'lost';

  const entityProducts = products.filter(
    (p) => p.active && (p.entityIds.length === 0 || p.entityIds.includes(entityId))
  );

  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);
    if (initialDeal) {
      setEntityId(initialDeal.entityId);
      setContactId(initialDeal.contactId ?? '');
      setCompanyId(initialDeal.companyId ?? '');
      setProspectId(initialDeal.prospectId ?? '');
      setName(initialDeal.name);
      setServiceConcerned(initialDeal.serviceConcerned ?? '');
      setProductId(initialDeal.productId ?? '');
      setPipelineId(initialDeal.pipelineId);
      setStageId(initialDeal.stageId);
      setAmount(String(initialDeal.amount));
      setCurrency(initialDeal.currency || settings.defaultCurrency || 'MGA');
      setProbability(String(initialDeal.probability));
      setExpectedCloseDate(initialDeal.expectedCloseDate);
      setOwnerUid(initialDeal.ownerUid);
      setLostReason(initialDeal.lostReason ?? 'Prix');
      setLostComment(initialDeal.lostComment ?? '');
      setNotes(initialDeal.notes);
    } else {
      const targetProspect = scopedProspects.find((p) => p.id === defaultProspectId);
      const targetContact =
        contacts.find((c) => c.id === (defaultContactId || targetProspect?.contactId)) ?? contacts[0];
      const nextEntity =
        defaultEntityId || targetProspect?.primaryEntityId || resolvedEntity;
      const pipe = pipelines.find((p) => p.entityId === nextEntity) ?? pipelines[0];
      const firstStage = [...stages]
        .filter((s) => s.pipelineId === pipe?.id)
        .sort((a, b) => a.order - b.order)[0];

      setEntityId(nextEntity);
      setContactId(defaultContactId || targetProspect?.contactId || targetContact?.id || '');
      setCompanyId(defaultCompanyId || targetProspect?.companyId || targetContact?.companyId || '');
      setProspectId(defaultProspectId || targetProspect?.id || '');
      setName('');
      setServiceConcerned('');
      setProductId('');
      setPipelineId(pipe?.id ?? '');
      setStageId(firstStage?.id ?? '');
      setAmount(String(targetProspect?.estimatedValue || 1500000));
      setCurrency(settings.defaultCurrency || 'MGA');
      setProbability(String(firstStage?.probability ?? 10));
      setExpectedCloseDate(
        new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10)
      );
      setOwnerUid(user?.uid ?? '');
      setLostReason('Prix');
      setLostComment('');
      setNotes('');
    }
  }, [
    open,
    initialDeal,
    defaultEntityId,
    defaultProspectId,
    defaultContactId,
    defaultCompanyId,
    resolvedEntity,
    scopedProspects,
    contacts,
    pipelines,
    stages,
    user?.uid,
    settings.defaultCurrency,
  ]);

  const handleStageChange = (nextStageId: string) => {
    setStageId(nextStageId);
    const stage = stages.find((s) => s.id === nextStageId);
    if (stage) {
      setProbability(String(stage.probability));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount);
    const resolvedStageId = stageId || pipelineStages[0]?.id || '';
    const chosenStage = stages.find((s) => s.id === resolvedStageId);
    const status = chosenStage?.outcomeType ?? 'open';

    const validationError = validateDealInput({
      name,
      entityId,
      prospectId,
      contactId,
      stageId: resolvedStageId,
      amount: numAmount,
      status,
      lostReason: status === 'lost' ? lostReason : undefined,
      lostComment: status === 'lost' ? lostComment : undefined,
    });
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      const commonPayload = {
        entityId,
        prospectId,
        contactId: contactId || undefined,
        companyId: companyId || undefined,
        name: name.trim(),
        stage: chosenStage?.name as Deal['stage'],
        serviceConcerned: serviceConcerned.trim() || undefined,
        productId: productId || undefined,
        pipelineId: activePipelineId,
        stageId: resolvedStageId,
        amount: numAmount,
        currency,
        probability: Number(probability) || 0,
        expectedCloseDate,
        ownerUid: ownerUid || user?.uid || 'system',
        status,
        lostReason: status === 'lost' ? lostReason : undefined,
        lostComment: status === 'lost' ? lostComment.trim() : undefined,
        notes: notes.trim(),
      };

      if (initialDeal) {
        await updateDeal({
          ...initialDeal,
          ...commonPayload,
        });
      } else {
        await createDeal(commonPayload);
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
      title={initialDeal ? "Détail de l'opportunité" : 'Nouvelle opportunité commerciale'}
      subtitle="Rattachez l'opportunité à une entité, un contact partagé et un produit/service."
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {errorMsg && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {errorMsg}
          </div>
        )}

        <div>
          <label htmlFor="deal-name" className="block text-xs font-medium text-slate-700 mb-1">
            Nom de l'opportunité *
          </label>
          <input
            id="deal-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex : Pack 3 Bureaux + Domiciliation"
            className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm focus:border-blue-600 focus:outline-none"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="deal-entity" className="block text-xs font-medium text-slate-700 mb-1">
              Entité *
            </label>
            <select
              id="deal-entity"
              value={entityId}
              onChange={(e) => {
                const eid = e.target.value;
                setEntityId(eid);
                const pipe = pipelines.find((p) => p.entityId === eid);
                if (pipe) {
                  setPipelineId(pipe.id);
                  const first = [...stages]
                    .filter((s) => s.pipelineId === pipe.id)
                    .sort((a, b) => a.order - b.order)[0];
                  if (first) {
                    setStageId(first.id);
                    setProbability(String(first.probability));
                  }
                }
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
            <label htmlFor="deal-contact" className="block text-xs font-medium text-slate-700 mb-1">
              Contact partagé *
            </label>
            <select
              id="deal-contact"
              value={contactId}
              onChange={(e) => {
                const cid = e.target.value;
                setContactId(cid);
                const ct = contacts.find((c) => c.id === cid);
                if (ct?.companyId) setCompanyId(ct.companyId);
              }}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">Sélectionner un contact</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="deal-company" className="block text-xs font-medium text-slate-700 mb-1">
              Entreprise
            </label>
            <select
              id="deal-company"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">Aucune / Particulier</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.legalName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="deal-product" className="block text-xs font-medium text-slate-700 mb-1">
              Produit / Service du catalogue
            </label>
            <select
              id="deal-product"
              value={productId}
              onChange={(e) => {
                const pid = e.target.value;
                setProductId(pid);
                const prod = products.find((p) => p.id === pid);
                if (prod) {
                  setServiceConcerned(prod.name);
                  if (!name.trim()) setName(prod.name);
                  setAmount(String(prod.price));
                }
              }}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">Prestation personnalisée</option>
              {entityProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({formatCurrency(p.price, p.currency)})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="deal-service" className="block text-xs font-medium text-slate-700 mb-1">
              Service concerné
            </label>
            <input
              id="deal-service"
              type="text"
              value={serviceConcerned}
              onChange={(e) => setServiceConcerned(e.target.value)}
              placeholder="Ex : Domiciliation, Qualiopi, Branding..."
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label htmlFor="deal-stage" className="block text-xs font-medium text-slate-700 mb-1">
              Étape du pipeline *
            </label>
            <select
              id="deal-stage"
              value={stageId}
              onChange={(e) => handleStageChange(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
            >
              {pipelineStages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.probability}%)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="deal-amount" className="block text-xs font-medium text-slate-700 mb-1">
              Montant *
            </label>
            <input
              id="deal-amount"
              type="number"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm tabular-nums"
              required
            />
          </div>
          <div>
            <label htmlFor="deal-currency" className="block text-xs font-medium text-slate-700 mb-1">
              Devise
            </label>
            <select
              id="deal-currency"
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
            <label htmlFor="deal-probability" className="block text-xs font-medium text-slate-700 mb-1">
              Probabilité (%)
            </label>
            <input
              id="deal-probability"
              type="number"
              min="0"
              max="100"
              value={probability}
              onChange={(e) => setProbability(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm tabular-nums"
            />
          </div>
        </div>

        {isLostStage && (
          <div className="rounded-lg border border-red-200 bg-red-50/70 p-3.5 space-y-3">
            <p className="text-xs font-semibold text-red-900">
              Motif de perte obligatoire (étape Perdu)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="deal-lost-reason" className="block text-xs font-medium text-red-900 mb-1">
                  Motif *
                </label>
                <select
                  id="deal-lost-reason"
                  value={lostReason}
                  onChange={(e) => setLostReason(e.target.value as LostReason)}
                  className="w-full h-9 rounded-lg border border-red-200 bg-white px-3 text-sm"
                >
                  {LOST_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="deal-lost-comment" className="block text-xs font-medium text-red-900 mb-1">
                  Commentaire {lostReason === 'Autre' ? '*' : '(optionnel)'}
                </label>
                <input
                  id="deal-lost-comment"
                  type="text"
                  value={lostComment}
                  onChange={(e) => setLostComment(e.target.value)}
                  placeholder="Détails de la perte..."
                  className="w-full h-9 rounded-lg border border-red-200 bg-white px-3 text-sm"
                />
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="deal-closeDate" className="block text-xs font-medium text-slate-700 mb-1">
              Date de clôture prévisionnelle
            </label>
            <input
              id="deal-closeDate"
              type="date"
              value={expectedCloseDate}
              onChange={(e) => setExpectedCloseDate(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
            />
          </div>
          <div>
            <label htmlFor="deal-owner" className="block text-xs font-medium text-slate-700 mb-1">
              Responsable
            </label>
            <select
              id="deal-owner"
              value={ownerUid}
              onChange={(e) => setOwnerUid(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
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

        <div>
          <label htmlFor="deal-notes" className="block text-xs font-medium text-slate-700 mb-1">
            Notes sur l'opportunité
          </label>
          <textarea
            id="deal-notes"
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
            {submitting
              ? 'Enregistrement...'
              : initialDeal
              ? "Mettre à jour l'opportunité"
              : "Créer l'opportunité"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
