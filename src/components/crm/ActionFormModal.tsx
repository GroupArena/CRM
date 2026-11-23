import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { useCrm } from '../../context/CrmContext';
import { useAuth } from '../../hooks/useAuth';
import {
  ACTION_TYPES,
  PRIORITY_LABELS,
  type ActionStatus,
  type ActionType,
  type CrmAction,
  type PriorityLevel,
  type RelatedEntityType,
} from '../../types';
import { validateActionInput } from '../../utils/crmLogic';

interface ActionFormModalProps {
  open: boolean;
  onClose: () => void;
  defaultProspectId?: string;
  defaultContactId?: string;
  defaultCompanyId?: string;
  defaultEntityId?: string;
  defaultDealId?: string;
  defaultDueDate?: string;
  initialAction?: CrmAction | null;
}

export function ActionFormModal({
  open,
  onClose,
  defaultProspectId,
  defaultContactId,
  defaultCompanyId,
  defaultEntityId,
  defaultDealId,
  defaultDueDate,
  initialAction,
}: ActionFormModalProps) {
  const {
    authorizedEntities,
    selectedEntityId,
    scopedProspects,
    contacts,
    companies,
    users,
    createAction,
    updateAction,
  } = useCrm();
  const { user } = useAuth();

  const resolvedDefaultEntity =
    defaultEntityId ||
    (selectedEntityId !== 'all' ? selectedEntityId : authorizedEntities[0]?.id ?? '');

  const [entityId, setEntityId] = useState(resolvedDefaultEntity);
  const [prospectId, setProspectId] = useState(defaultProspectId ?? '');
  const [contactId, setContactId] = useState(defaultContactId ?? '');
  const [companyId, setCompanyId] = useState(defaultCompanyId ?? '');
  const [type, setType] = useState<ActionType>('Appel');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedToUid, setAssignedToUid] = useState(user?.uid ?? '');
  const [status, setStatus] = useState<ActionStatus>('planned');
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueTime, setDueTime] = useState('10:00');
  const [priority, setPriority] = useState<PriorityLevel>('medium');
  const [durationMinutes, setDurationMinutes] = useState('30');
  const [reminderBeforeMinutes, setReminderBeforeMinutes] = useState('30');
  const [outcome, setOutcome] = useState('');
  const [relatedEntityType, setRelatedEntityType] = useState<RelatedEntityType>('contact');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);
    if (initialAction) {
      setEntityId(initialAction.entityId);
      setProspectId(initialAction.prospectId);
      setContactId(initialAction.contactId ?? '');
      setCompanyId(initialAction.companyId ?? '');
      setType(initialAction.type);
      setTitle(initialAction.title);
      setDescription(initialAction.description);
      setAssignedToUid(initialAction.assignedToUid);
      setStatus(initialAction.status);
      setDueDate(initialAction.dueDate);
      setDueTime(initialAction.dueTime);
      setPriority(initialAction.priority);
      setDurationMinutes(String(initialAction.durationMinutes ?? 30));
      setReminderBeforeMinutes(String(initialAction.reminderBeforeMinutes ?? 30));
      setOutcome(initialAction.outcome);
      setRelatedEntityType(initialAction.relatedEntityType);
    } else {
      const targetProspect = scopedProspects.find((p) => p.id === defaultProspectId);
      const targetContact = contacts.find(
        (c) => c.id === (defaultContactId || targetProspect?.contactId)
      );
      setEntityId(
        defaultEntityId || targetProspect?.primaryEntityId || resolvedDefaultEntity
      );
      setProspectId(defaultProspectId || targetProspect?.id || '');
      setContactId(defaultContactId || targetProspect?.contactId || '');
      setCompanyId(
        defaultCompanyId || targetProspect?.companyId || targetContact?.companyId || ''
      );
      setType('Tâche');
      setTitle('');
      setDescription('');
      setAssignedToUid(user?.uid ?? '');
      setStatus('planned');
      setDueDate(defaultDueDate || new Date().toISOString().slice(0, 10));
      setDueTime('10:00');
      setPriority('medium');
      setDurationMinutes('30');
      setReminderBeforeMinutes('30');
      setOutcome('');
      setRelatedEntityType(
        defaultDealId ? 'deal' : defaultContactId ? 'contact' : defaultCompanyId ? 'company' : 'prospect'
      );
    }
  }, [
    open,
    initialAction,
    defaultProspectId,
    defaultContactId,
    defaultCompanyId,
    defaultEntityId,
    defaultDealId,
    defaultDueDate,
    resolvedDefaultEntity,
    scopedProspects,
    contacts,
    user?.uid,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateActionInput({
      title,
      prospectId,
      contactId,
      companyId,
      entityId,
      dueDate,
    });
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      const completedAt =
        status === 'done'
          ? initialAction?.completedAt || new Date().toISOString()
          : undefined;
      if (initialAction) {
        await updateAction(
          {
            ...initialAction,
            entityId,
            prospectId,
            contactId: contactId || undefined,
            companyId: companyId || undefined,
            dealId: defaultDealId || initialAction.dealId,
            type,
            title: title.trim(),
            description: description.trim(),
            assignedToUid: assignedToUid || user?.uid || 'system',
            status,
            dueDate,
            dueTime,
            completedAt,
            priority,
            outcome: outcome.trim(),
            durationMinutes: Number(durationMinutes) || 0,
            reminderBeforeMinutes: Number(reminderBeforeMinutes) || 0,
            relatedEntityType,
          },
          status === 'done'
        );
      } else {
        await createAction({
          entityId,
          prospectId,
          contactId: contactId || undefined,
          companyId: companyId || undefined,
          dealId: defaultDealId,
          type,
          title: title.trim(),
          description: description.trim(),
          assignedToUid: assignedToUid || user?.uid || 'system',
          status,
          dueDate,
          dueTime,
          completedAt,
          priority,
          outcome: outcome.trim(),
          durationMinutes: Number(durationMinutes) || 0,
          reminderBeforeMinutes: Number(reminderBeforeMinutes) || 0,
          relatedEntityType,
        });
      }
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Erreur lors de l'enregistrement de l'action."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialAction ? "Modifier l'action" : 'Planifier une tâche / action'}
      subtitle="Rendez-vous, rappel, relance ou tâche liée à un contact, une entreprise ou une entité."
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="action-entity" className="block text-xs font-medium text-slate-700 mb-1">
              Entité *
            </label>
            <select
              id="action-entity"
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
            >
              {authorizedEntities.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="action-contact" className="block text-xs font-medium text-slate-700 mb-1">
              Contact lié
            </label>
            <select
              id="action-contact"
              value={contactId}
              onChange={(e) => {
                const cid = e.target.value;
                setContactId(cid);
                const found = contacts.find((c) => c.id === cid);
                if (found?.companyId) setCompanyId(found.companyId);
              }}
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
          <div>
            <label htmlFor="action-company" className="block text-xs font-medium text-slate-700 mb-1">
              Entreprise liée
            </label>
            <select
              id="action-company"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">Aucune</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.legalName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="action-type" className="block text-xs font-medium text-slate-700 mb-1">
              Type d'action
            </label>
            <select
              id="action-type"
              value={type}
              onChange={(e) => setType(e.target.value as ActionType)}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
            >
              {ACTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="action-title" className="block text-xs font-medium text-slate-700 mb-1">
              Objet *
            </label>
            <input
              id="action-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex : Appel de suivi devis"
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label htmlFor="action-dueDate" className="block text-xs font-medium text-slate-700 mb-1">
              Date d'échéance *
            </label>
            <input
              id="action-dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
              required
            />
          </div>
          <div>
            <label htmlFor="action-dueTime" className="block text-xs font-medium text-slate-700 mb-1">
              Heure
            </label>
            <input
              id="action-dueTime"
              type="time"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
            />
          </div>
          <div>
            <label htmlFor="action-priority" className="block text-xs font-medium text-slate-700 mb-1">
              Priorité
            </label>
            <select
              id="action-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as PriorityLevel)}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
            >
              {(Object.keys(PRIORITY_LABELS) as PriorityLevel[]).map((k) => (
                <option key={k} value={k}>
                  {PRIORITY_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="action-reminder" className="block text-xs font-medium text-slate-700 mb-1">
              Rappel avant
            </label>
            <select
              id="action-reminder"
              value={reminderBeforeMinutes}
              onChange={(e) => setReminderBeforeMinutes(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="0">Aucun</option>
              <option value="15">15 min avant</option>
              <option value="30">30 min avant</option>
              <option value="60">1 heure avant</option>
              <option value="1440">24 heures avant</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="action-assignee" className="block text-xs font-medium text-slate-700 mb-1">
              Assignée à
            </label>
            <select
              id="action-assignee"
              value={assignedToUid}
              onChange={(e) => setAssignedToUid(e.target.value)}
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
          <div>
            <label htmlFor="action-status" className="block text-xs font-medium text-slate-700 mb-1">
              Statut
            </label>
            <select
              id="action-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as ActionStatus)}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="planned">Planifiée</option>
              <option value="done">Terminée</option>
              <option value="cancelled">Annulée</option>
            </select>
          </div>
          <div>
            <label htmlFor="action-duration" className="block text-xs font-medium text-slate-700 mb-1">
              Durée (minutes)
            </label>
            <input
              id="action-duration"
              type="number"
              min="0"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm tabular-nums"
            />
          </div>
        </div>

        <div>
          <label htmlFor="action-description" className="block text-xs font-medium text-slate-700 mb-1">
            Détails / notes préparatoires
          </label>
          <textarea
            id="action-description"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-slate-200 p-3 text-sm"
          />
        </div>

        {status === 'done' && (
          <div>
            <label htmlFor="action-outcome" className="block text-xs font-medium text-slate-700 mb-1">
              Résultat / compte-rendu
            </label>
            <input
              id="action-outcome"
              type="text"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              placeholder="Ex : Besoin confirmé, devis à envoyer sous 48h"
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
            />
          </div>
        )}

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
            {submitting ? 'Enregistrement...' : initialAction ? 'Mettre à jour' : "Créer l'action"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
