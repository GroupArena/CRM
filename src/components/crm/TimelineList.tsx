import {
  Phone,
  Mail,
  Users,
  MessageSquare,
  FileText,
  CheckSquare,
  Calendar,
  RotateCw,
  FileCheck,
  FolderKanban,
  Clock,
  Check,
} from 'lucide-react';
import type { CrmAction, CrmEntity, UserProfile } from '../../types';
import { ActionStatusBadge } from '../ui/StatusBadge';
import { formatDateFr, formatDateTimeFr, resolveEffectiveActionStatus } from '../../utils/crmLogic';

interface TimelineListProps {
  actions: CrmAction[];
  entities: CrmEntity[];
  users: UserProfile[];
  onComplete?: (actionId: string) => void;
  canWrite?: boolean;
}

function getActionIcon(type: CrmAction['type']) {
  switch (type) {
    case 'Appel':
      return Phone;
    case 'Email':
      return Mail;
    case 'Réunion':
      return Users;
    case 'Message WhatsApp':
      return MessageSquare;
    case 'Note':
      return FileText;
    case 'Tâche':
      return CheckSquare;
    case 'Rendez-vous':
      return Calendar;
    case 'Relance':
      return RotateCw;
    case 'Envoi de devis':
      return FileCheck;
    case 'Suivi dossier':
      return FolderKanban;
    default:
      return Clock;
  }
}

export function TimelineList({
  actions,
  entities,
  users,
  onComplete,
  canWrite = false,
}: TimelineListProps) {
  const nowIso = new Date().toISOString();
  const sorted = [...actions].sort((a, b) =>
    (b.completedAt || b.createdAt).localeCompare(a.completedAt || a.createdAt)
  );

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-slate-500 py-6 text-center">
        Aucune activité enregistrée pour le moment.
      </p>
    );
  }

  return (
    <ol className="relative space-y-4">
      {sorted.map((action) => {
        const Icon = getActionIcon(action.type);
        const effStatus = resolveEffectiveActionStatus(action, nowIso);
        const entity = entities.find((e) => e.id === action.entityId);
        const assignee = users.find((u) => u.uid === action.assignedToUid);

        return (
          <li
            key={action.id}
            className="flex items-start gap-3.5 rounded-lg border border-slate-200 bg-white p-4"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-semibold text-slate-900 truncate">
                    {action.title}
                  </span>
                  <ActionStatusBadge status={effStatus} />
                </div>
                <span className="text-xs font-sans tabular-nums text-slate-500 whitespace-nowrap">
                  {action.completedAt
                    ? `Réalisée le ${formatDateTimeFr(action.completedAt)}`
                    : `Échéance : ${formatDateFr(action.dueDate)} ${action.dueTime || ''}`}
                </span>
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>{action.type}</span>
                {entity && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{entity.name}</span>
                  </>
                )}
                {assignee && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>Assignée à {assignee.displayName}</span>
                  </>
                )}
              </div>

              {action.description && (
                <p className="mt-2 text-sm text-slate-700 whitespace-pre-line">
                  {action.description}
                </p>
              )}

              {action.outcome && (
                <p className="mt-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-2.5 py-1.5">
                  Compte-rendu : {action.outcome}
                </p>
              )}
            </div>

            {canWrite && onComplete && (effStatus === 'planned' || effStatus === 'late') && (
              <button
                type="button"
                onClick={() => onComplete(action.id)}
                aria-label={`Marquer comme faite : ${action.title}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100 transition-colors whitespace-nowrap shrink-0"
              >
                <Check className="h-3.5 w-3.5" />
                Terminer
              </button>
            )}
          </li>
        );
      })}
    </ol>
  );
}
