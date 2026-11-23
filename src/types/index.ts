export type UserRole = 'super_admin' | 'entity_admin' | 'manager' | 'sales' | 'reader';

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin Arena Group',
  entity_admin: 'Admin Entité',
  manager: 'Manager',
  sales: 'Commercial',
  reader: 'Lecteur',
};

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  entityIds: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CrmEntity {
  id: string;
  name: string;
  slug: string;
  description: string;
  logoUrl?: string;
  color: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ProspectStatus =
  | 'Nouveau'
  | 'Contacté'
  | 'Qualifié'
  | 'Rendez-vous pris'
  | 'Proposition envoyée'
  | 'Négociation'
  | 'Gagné'
  | 'Perdu'
  | 'Sans réponse'
  | 'À recontacter';

export const PROSPECT_STATUSES: ProspectStatus[] = [
  'Nouveau',
  'Contacté',
  'Qualifié',
  'Rendez-vous pris',
  'Proposition envoyée',
  'Négociation',
  'Gagné',
  'Perdu',
  'Sans réponse',
  'À recontacter',
];

export type PriorityLevel = 'low' | 'medium' | 'high' | 'urgent';

export const PRIORITY_LABELS: Record<PriorityLevel, string> = {
  low: 'Basse',
  medium: 'Moyenne',
  high: 'Haute',
  urgent: 'Urgente',
};

export interface Prospect {
  id: string;
  primaryEntityId: string;
  sharedEntityIds: string[];
  contactId?: string;
  companyId?: string;
  firstName: string;
  lastName: string;
  companyName: string;
  email: string;
  phone: string;
  mobile: string;
  website: string;
  status: ProspectStatus;
  source: string;
  ownerUid: string;
  tags: string[];
  notes: string;
  priority: PriorityLevel;
  estimatedValue: number;
  address: string;
  city: string;
  country: string;
  consentMarketing: boolean;
  gdprConsentDate: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  nextActionDate: string;
  nextActionType: string;
}

// --- 1. Contacts & Comptes / Entreprises partagés ---
export interface Company {
  id: string;
  legalName: string;
  tradeName: string;
  legalStatus: string;
  nif: string;
  stat: string;
  rcs: string;
  vatNumber?: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  primaryContactId: string;
  tags: string[];
  notes: string;
  isVip: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Contact {
  id: string;
  fullName: string;
  jobTitle: string;
  phone: string;
  whatsapp: string;
  email: string;
  companyId: string;
  isVip: boolean;
  tags: string[];
  consentMarketing: boolean;
  gdprConsentDate: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

// --- 3. Prospection & Séquences de relance ---
export type LeadStatus = 'Nouveau' | 'Contacté' | 'Qualifié' | 'Non qualifié';

export const LEAD_STATUSES: LeadStatus[] = [
  'Nouveau',
  'Contacté',
  'Qualifié',
  'Non qualifié',
];

export type SequenceChannel = 'call' | 'email' | 'whatsapp' | 'task';

export const SEQUENCE_CHANNEL_LABELS: Record<SequenceChannel, string> = {
  call: 'Appel',
  email: 'Email',
  whatsapp: 'Message WhatsApp',
  task: 'Rappel manuel',
};

export interface Lead {
  id: string;
  contactId: string;
  companyId: string;
  entityId: string;
  source: string;
  status: LeadStatus;
  assignedToUid: string;
  priority: PriorityLevel;
  estimatedValue: number;
  lastContactAt: string;
  nextFollowUpDate: string;
  nextFollowUpChannel: SequenceChannel;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface FollowUpSequence {
  id: string;
  name: string;
  entityId: string;
  description: string;
  active: boolean;
  createdByUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface SequenceStep {
  id: string;
  sequenceId: string;
  entityId: string;
  order: number;
  channel: SequenceChannel;
  delayDays: number;
  title: string;
  description: string;
  templateId?: string;
}

export type SequenceEnrollmentStatus = 'active' | 'completed' | 'paused' | 'cancelled';

export const ENROLLMENT_STATUS_LABELS: Record<SequenceEnrollmentStatus, string> = {
  active: 'Active',
  completed: 'Terminée',
  paused: 'En pause',
  cancelled: 'Annulée',
};

export interface SequenceEnrollment {
  id: string;
  sequenceId: string;
  leadId: string;
  contactId: string;
  entityId: string;
  enrolledAt: string;
  currentStep: number;
  status: SequenceEnrollmentStatus;
  nextActionDate: string;
  callsMade: number;
  meetingsBooked: number;
  repliesReceived: number;
  updatedAt: string;
}

// --- 4. Actions & Agenda ---
export type ActionType =
  | 'Appel'
  | 'Email'
  | 'Réunion'
  | 'Message WhatsApp'
  | 'Note'
  | 'Tâche'
  | 'Rendez-vous'
  | 'Relance'
  | 'Envoi de devis'
  | 'Suivi dossier'
  | 'Autre';

export const ACTION_TYPES: ActionType[] = [
  'Appel',
  'Email',
  'Réunion',
  'Message WhatsApp',
  'Note',
  'Tâche',
  'Rendez-vous',
  'Relance',
  'Envoi de devis',
  'Suivi dossier',
  'Autre',
];

export type ActionStatus = 'planned' | 'done' | 'cancelled' | 'late';

export const ACTION_STATUS_LABELS: Record<ActionStatus, string> = {
  planned: 'Planifiée',
  done: 'Terminée',
  cancelled: 'Annulée',
  late: 'En retard',
};

export type RelatedEntityType = 'prospect' | 'deal' | 'contact' | 'company' | 'quote' | 'invoice';

export interface CrmAction {
  id: string;
  entityId: string;
  prospectId: string;
  contactId?: string;
  companyId?: string;
  dealId?: string;
  type: ActionType;
  title: string;
  description: string;
  assignedToUid: string;
  createdByUid: string;
  status: ActionStatus;
  dueDate: string;
  dueTime: string;
  completedAt?: string;
  priority: PriorityLevel;
  outcome: string;
  durationMinutes?: number;
  reminderBeforeMinutes?: number;
  outlookEventId?: string;
  relatedEntityType: RelatedEntityType;
  createdAt: string;
  updatedAt: string;
}

// --- 5. Pipeline & Opportunités ---
export type DealStatus = 'open' | 'won' | 'lost';

export const DEAL_STATUS_LABELS: Record<DealStatus, string> = {
  open: 'En cours',
  won: 'Gagné',
  lost: 'Perdu',
};

export type OpportunityStageName =
  | 'Prospect'
  | 'Qualification'
  | 'Proposition'
  | 'Négociation'
  | 'Gagné'
  | 'Perdu';

export type LostReason = 'Prix' | 'Concurrent' | 'Timing' | 'Pas de budget' | 'Autre';

export const LOST_REASONS: LostReason[] = [
  'Prix',
  'Concurrent',
  'Timing',
  'Pas de budget',
  'Autre',
];

export interface Deal {
  id: string;
  entityId: string;
  prospectId: string;
  contactId?: string;
  companyId?: string;
  name: string;
  stage?: OpportunityStageName;
  stageId: string;
  pipelineId: string;
  amount: number;
  currency: string;
  probability: number;
  expectedCloseDate: string;
  serviceConcerned?: string;
  productId?: string;
  ownerUid: string;
  status: DealStatus;
  lostReason?: LostReason;
  lostComment?: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Pipeline {
  id: string;
  entityId: string;
  name: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineStage {
  id: string;
  pipelineId: string;
  entityId: string;
  name: string;
  order: number;
  probability: number;
  color: string;
  outcomeType: DealStatus;
  createdAt: string;
  updatedAt: string;
}

// --- 6. Catalogue Produits & Services ---
export type ProductPricingType = 'fixed' | 'tiered';

export const PRODUCT_PRICING_TYPE_LABELS: Record<ProductPricingType, string> = {
  fixed: 'Tarification fixe',
  tiered: 'Tarification échelonnée (paliers de volume)',
};

export type ProductBillingFrequency =
  | 'one_time'
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'annual';

export const PRODUCT_BILLING_FREQUENCY_LABELS: Record<ProductBillingFrequency, string> = {
  one_time: 'Ponctuelle (achat unique)',
  weekly: 'Hebdomadaire',
  monthly: 'Mensuelle',
  quarterly: 'Trimestrielle',
  annual: 'Annuelle',
};

export type ProductBillingDurationUnit = 'weeks' | 'months' | 'years' | 'unlimited';

export const PRODUCT_BILLING_DURATION_UNIT_LABELS: Record<ProductBillingDurationUnit, string> = {
  weeks: 'semaine(s)',
  months: 'mois',
  years: 'an(s)',
  unlimited: 'Durée indéterminée',
};

export interface ProductCustomProperty {
  key: string;
  value: string;
}

export interface ProductPricingTier {
  minQty: number;
  maxQty?: number | null;
  unitPrice: number;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  description: string;
  folder: string;
  category: string;
  customProperties: ProductCustomProperty[];
  price: number;
  unitCost: number;
  pricingType: ProductPricingType;
  pricingTiers: ProductPricingTier[];
  billingFrequency: ProductBillingFrequency;
  billingDurationCount?: number;
  billingDurationUnit?: ProductBillingDurationUnit;
  imageUrl?: string;
  productUrl?: string;
  currency: string;
  unit: string;
  vatRate: number;
  active: boolean;
  entityIds: string[];
  createdAt: string;
  updatedAt: string;
}

// --- 7. Devis ---
export type QuoteStatus =
  | 'Brouillon'
  | 'Envoyé'
  | 'Accepté'
  | 'Refusé'
  | 'Expiré'
  | 'Converti en facture';

export const QUOTE_STATUSES: QuoteStatus[] = [
  'Brouillon',
  'Envoyé',
  'Accepté',
  'Refusé',
  'Expiré',
  'Converti en facture',
];

export interface Quote {
  id: string;
  entityId: string;
  contactId: string;
  companyId: string;
  opportunityId?: string;
  quoteNumber: string;
  status: QuoteStatus;
  issueDate: string;
  validUntil: string;
  currency: string;
  subtotal: number;
  vatAmount: number;
  total: number;
  notes: string;
  legalMentions: string;
  showEuroConversion?: boolean;
  euroExchangeRate?: number;
  euroBankName?: string;
  euroRateDate?: string;
  createdByUid: string;
  pdfUrl?: string;
  acceptedAt?: string;
  refusedAt?: string;
  convertedInvoiceId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteItem {
  id: string;
  quoteId: string;
  entityId: string;
  productId?: string;
  label: string;
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  lineTotal: number;
  orderIndex: number;
}

// --- 8. Facturation & Paiements ---
export type InvoiceStatus =
  | 'Brouillon'
  | 'Émise'
  | 'Payée partiellement'
  | 'Payée'
  | 'En retard'
  | 'Annulée';

export const INVOICE_STATUSES: InvoiceStatus[] = [
  'Brouillon',
  'Émise',
  'Payée partiellement',
  'Payée',
  'En retard',
  'Annulée',
];

export type InvoiceType = 'standard' | 'deposit' | 'balance';

export type InvoiceApprovalStatus = 'pending_approval' | 'approved' | 'rejected';

export const INVOICE_APPROVAL_LABELS: Record<InvoiceApprovalStatus, string> = {
  pending_approval: 'En attente validation',
  approved: 'Validée',
  rejected: 'Refusée',
};

export interface Invoice {
  id: string;
  entityId: string;
  contactId: string;
  companyId: string;
  quoteId?: string;
  invoiceNumber: string;
  invoiceType?: InvoiceType;
  depositPercentage?: number;
  deductedDepositInvoiceId?: string;
  deductedDepositAmount?: number;
  status: InvoiceStatus;
  approvalStatus?: InvoiceApprovalStatus;
  submittedForApprovalAt?: string;
  submittedByUid?: string;
  submittedByName?: string;
  approvedByUid?: string;
  approvedByName?: string;
  approvedAt?: string;
  rejectedByUid?: string;
  rejectedByName?: string;
  rejectedAt?: string;
  rejectedReason?: string;
  showEuroConversion?: boolean;
  euroExchangeRate?: number;
  euroBankName?: string;
  euroRateDate?: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  subtotal: number;
  vatAmount: number;
  total: number;
  paidAmount: number;
  remainingAmount: number;
  legalMentions: string;
  notes: string;
  createdByUid: string;
  pdfUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  entityId: string;
  productId?: string;
  label: string;
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  lineTotal: number;
  orderIndex: number;
}

export type PaymentMethod =
  | 'Espèces'
  | 'Virement'
  | 'Chèque'
  | 'Carte'
  | 'Mobile Money'
  | 'Autre';

export const PAYMENT_METHODS: PaymentMethod[] = [
  'Espèces',
  'Virement',
  'Chèque',
  'Carte',
  'Mobile Money',
  'Autre',
];

export interface Payment {
  id: string;
  invoiceId: string;
  entityId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  reference: string;
  recordedByUid: string;
  notes: string;
  createdAt: string;
}

// --- 9. Relation client, Réclamations & Satisfaction ---
export type ComplaintStatus = 'Nouvelle' | 'En cours' | 'Résolue' | 'Clôturée';

export const COMPLAINT_STATUSES: ComplaintStatus[] = [
  'Nouvelle',
  'En cours',
  'Résolue',
  'Clôturée',
];

export interface Complaint {
  id: string;
  entityId: string;
  contactId: string;
  companyId: string;
  subject: string;
  description: string;
  status: ComplaintStatus;
  priority: PriorityLevel;
  assignedToUid: string;
  resolution: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type ServiceRequestStatus = 'Ouverte' | 'En traitement' | 'Traitée' | 'Fermée';

export interface ServiceRequest {
  id: string;
  entityId: string;
  contactId: string;
  companyId: string;
  subject: string;
  description: string;
  status: ServiceRequestStatus;
  priority: PriorityLevel;
  createdAt: string;
  updatedAt: string;
}

export interface SatisfactionSurvey {
  id: string;
  entityId: string;
  contactId: string;
  companyId: string;
  opportunityId?: string;
  rating: number;
  comment: string;
  surveySentAt: string;
  answeredAt?: string;
  createdAt: string;
}

// --- 11. Intégrations, Compteurs, Mentions légales ---
export interface IntegrationSetting {
  id: string;
  provider: 'outlook' | 'whatsapp';
  entityId: string;
  enabled: boolean;
  tenantId?: string;
  clientId?: string;
  accountEmail?: string;
  businessPhoneNumber?: string;
  syncEmails: boolean;
  syncCalendar: boolean;
  status: 'disconnected' | 'ready' | 'connected';
  lastSyncAt?: string;
  updatedAt: string;
}

export interface NumberingCounter {
  id: string;
  prefix: 'DEV' | 'FAC';
  entityId: string;
  entityCode: string;
  year: number;
  lastSequence: number;
  updatedAt: string;
}

export interface LegalSetting {
  id: string;
  entityId: string;
  entityCode: string;
  legalName: string;
  nif: string;
  stat: string;
  rcs?: string;
  vatNumber?: string;
  address: string;
  phone?: string;
  email?: string;
  paymentTerms: string;
  defaultLegalMentions: string;
  bankAccountHolder?: string;
  bankName?: string;
  bankAddress?: string;
  iban?: string;
  bic?: string;
  signatureImageUrl?: string;
  stampImageUrl?: string;
  updatedAt: string;
}

// --- Historique unifié client ---
export type ClientHistoryCategory =
  | 'action'
  | 'opportunity'
  | 'quote'
  | 'invoice'
  | 'payment'
  | 'complaint'
  | 'service_request'
  | 'sequence'
  | 'status_change';

export interface ClientHistoryEntry {
  id: string;
  entityId: string;
  category: ClientHistoryCategory;
  interactionType: string;
  title: string;
  description: string;
  date: string;
  userUid: string;
  status: string;
  amount?: number;
  currency?: string;
}

export interface CrmTag {
  id: string;
  entityId: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  entityId: string;
  actorUid: string;
  actorName: string;
  actionType: string;
  targetType: string;
  targetId: string;
  summary: string;
  createdAt: string;
}

export interface CrmSettings {
  id: string;
  scope: string;
  defaultCurrency: string;
  defaultProspectView: 'table' | 'cards';
  updatedByUid: string;
  updatedAt: string;
}

export type EntityScope = 'all' | string;

export type CrmNotificationType =
  | 'invoice_validation_requested'
  | 'invoice_validated'
  | 'invoice_rejected';

export interface CrmNotification {
  id: string;
  type: CrmNotificationType;
  entityId: string;
  invoiceId: string;
  invoiceNumber: string;
  title: string;
  message: string;
  actorUid: string;
  actorName: string;
  recipientRoles: UserRole[];
  targetUserUid?: string;
  readByUids: string[];
  createdAt: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  description?: string;
}

export const SUPPORTED_CURRENCIES = [
  { code: 'MGA', label: 'MGA (Ar)', symbol: 'Ar' },
  { code: 'EUR', label: 'EUR (€)', symbol: '€' },
  { code: 'USD', label: 'USD ($)', symbol: '$' },
  { code: 'CHF', label: 'CHF', symbol: 'CHF' },
] as const;

export type SupportedCurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]['code'];

export const LEGAL_STATUS_OPTIONS = [
  'EI',
  'SARLU',
  'SARL',
  'SAU',
  'SA',
  'SCS',
  'SNC',
  'SC',
  'GIE',
  'SDET',
  'Association',
  'ONG',
] as const;

export type LegalStatusOption = (typeof LEGAL_STATUS_OPTIONS)[number];
