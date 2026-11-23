import { Star } from 'lucide-react';
import type {
  ActionStatus,
  ComplaintStatus,
  DealStatus,
  InvoiceApprovalStatus,
  InvoiceStatus,
  LeadStatus,
  PriorityLevel,
  ProspectStatus,
  QuoteStatus,
} from '../../types';
import {
  ACTION_STATUS_LABELS,
  DEAL_STATUS_LABELS,
  INVOICE_APPROVAL_LABELS,
  PRIORITY_LABELS,
} from '../../types';

const PROSPECT_STYLES: Record<ProspectStatus, string> = {
  Nouveau: 'bg-blue-50 text-blue-800 border-blue-200',
  Contacté: 'bg-slate-100 text-slate-800 border-slate-200',
  Qualifié: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  'Rendez-vous pris': 'bg-violet-50 text-violet-800 border-violet-200',
  'Proposition envoyée': 'bg-amber-50 text-amber-800 border-amber-200',
  Négociation: 'bg-orange-50 text-orange-800 border-orange-200',
  Gagné: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  Perdu: 'bg-red-50 text-red-800 border-red-200',
  'Sans réponse': 'bg-stone-100 text-stone-700 border-stone-200',
  'À recontacter': 'bg-yellow-50 text-yellow-800 border-yellow-200',
};

const LEAD_STYLES: Record<LeadStatus, string> = {
  Nouveau: 'bg-blue-50 text-blue-800 border-blue-200',
  Contacté: 'bg-amber-50 text-amber-800 border-amber-200',
  Qualifié: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  'Non qualifié': 'bg-slate-100 text-slate-600 border-slate-200',
};

const QUOTE_STYLES: Record<QuoteStatus, string> = {
  Brouillon: 'bg-slate-100 text-slate-700 border-slate-200',
  Envoyé: 'bg-blue-50 text-blue-800 border-blue-200',
  Accepté: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  Refusé: 'bg-red-50 text-red-800 border-red-200',
  Expiré: 'bg-amber-50 text-amber-800 border-amber-200',
  'Converti en facture': 'bg-indigo-50 text-indigo-800 border-indigo-200',
};

const INVOICE_STYLES: Record<InvoiceStatus, string> = {
  Brouillon: 'bg-slate-100 text-slate-700 border-slate-200',
  Émise: 'bg-blue-50 text-blue-800 border-blue-200',
  'Payée partiellement': 'bg-amber-50 text-amber-800 border-amber-200',
  Payée: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  'En retard': 'bg-red-50 text-red-800 border-red-200',
  Annulée: 'bg-slate-100 text-slate-500 border-slate-200',
};

const COMPLAINT_STYLES: Record<ComplaintStatus, string> = {
  Nouvelle: 'bg-red-50 text-red-800 border-red-200',
  'En cours': 'bg-amber-50 text-amber-800 border-amber-200',
  Résolue: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  Clôturée: 'bg-slate-100 text-slate-700 border-slate-200',
};

const ACTION_STYLES: Record<ActionStatus, string> = {
  planned: 'bg-blue-50 text-blue-800 border-blue-200',
  done: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
  late: 'bg-red-50 text-red-800 border-red-200',
};

const PRIORITY_STYLES: Record<PriorityLevel, string> = {
  low: 'text-slate-600',
  medium: 'text-[#19283E]',
  high: 'text-[#AD7300] font-semibold',
  urgent: 'text-[#7A1F2B] font-semibold',
};

const DEAL_STYLES: Record<DealStatus, string> = {
  open: 'bg-blue-50 text-blue-800 border-blue-200',
  won: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  lost: 'bg-red-50 text-red-800 border-red-200',
};

export function ProspectStatusBadge({ status }: { status: ProspectStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md border whitespace-nowrap ${
        PROSPECT_STYLES[status] ?? 'bg-slate-100 text-slate-800 border-slate-200'
      }`}
    >
      {status}
    </span>
  );
}

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md border whitespace-nowrap ${
        LEAD_STYLES[status] ?? 'bg-slate-100 text-slate-800 border-slate-200'
      }`}
    >
      {status}
    </span>
  );
}

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md border whitespace-nowrap ${
        QUOTE_STYLES[status] ?? 'bg-slate-100 text-slate-800 border-slate-200'
      }`}
    >
      {status}
    </span>
  );
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md border whitespace-nowrap ${
        INVOICE_STYLES[status] ?? 'bg-slate-100 text-slate-800 border-slate-200'
      }`}
    >
      {status}
    </span>
  );
}

const APPROVAL_STYLES: Record<InvoiceApprovalStatus, string> = {
  pending_approval: 'bg-amber-50 text-amber-800 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  rejected: 'bg-red-50 text-red-800 border-red-200',
};

export function InvoiceApprovalBadge({ status }: { status?: InvoiceApprovalStatus }) {
  const effective: InvoiceApprovalStatus = status ?? 'approved';
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-md border whitespace-nowrap ${APPROVAL_STYLES[effective]}`}
    >
      {INVOICE_APPROVAL_LABELS[effective]}
    </span>
  );
}

export function ComplaintStatusBadge({ status }: { status: ComplaintStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md border whitespace-nowrap ${
        COMPLAINT_STYLES[status] ?? 'bg-slate-100 text-slate-800 border-slate-200'
      }`}
    >
      {status}
    </span>
  );
}

export function VipBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-md border border-[#C9A125]/60 bg-[#C9A125]/15 text-[#19283E] whitespace-nowrap">
      <Star className="h-3 w-3 fill-[#C9A125] text-[#AD7300]" />
      VIP
    </span>
  );
}

export function ActionStatusBadge({ status }: { status: ActionStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md border whitespace-nowrap ${ACTION_STYLES[status]}`}
    >
      {ACTION_STATUS_LABELS[status]}
    </span>
  );
}

export function DealStatusBadge({ status }: { status: DealStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md border whitespace-nowrap ${DEAL_STYLES[status]}`}
    >
      {DEAL_STATUS_LABELS[status]}
    </span>
  );
}

export function PriorityText({ priority }: { priority: PriorityLevel }) {
  return (
    <span className={`text-xs whitespace-nowrap ${PRIORITY_STYLES[priority]}`}>
      {PRIORITY_LABELS[priority]}
    </span>
  );
}
