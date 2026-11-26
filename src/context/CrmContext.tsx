import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { where } from 'firebase/firestore';
import {
  auth,
  createAuthUserAsAdmin,
  googleProvider,
  isFirebaseConfigured,
  recoverFirestoreNetwork,
  testFirestoreConnection,
} from '../firebase';
import { formatFirebaseAuthErrorFr, isFirestoreOfflineError } from '../utils/firebaseErrors';
import type {
  AuditLog,
  Company,
  Complaint,
  Contact,
  CrmAction,
  CrmEntity,
  CrmNotification,
  CrmSettings,
  CrmTag,
  Deal,
  EntityScope,
  FollowUpSequence,
  IntegrationSetting,
  Invoice,
  InvoiceItem,
  InvoiceType,
  Lead,
  LegalSetting,
  LostReason,
  NumberingCounter,
  Payment,
  PaymentMethod,
  Pipeline,
  PipelineStage,
  Product,
  Prospect,
  Quote,
  QuoteItem,
  QuoteStatus,
  SatisfactionSurvey,
  SequenceChannel,
  SequenceEnrollment,
  SequenceEnrollmentStatus,
  SequenceStep,
  ServiceRequest,
  ToastMessage,
  UserProfile,
  UserRole,
} from '../types';
import {
  DEFAULT_ENTITIES,
  DEFAULT_INTEGRATIONS,
  DEFAULT_LEGAL_SETTINGS,
  DEFAULT_NUMBERING_COUNTERS,
  DEFAULT_PIPELINES,
  DEFAULT_PIPELINE_STAGES,
  DEFAULT_SETTINGS,
  DEFAULT_TAGS,
  DEMO_ACTIONS,
  DEMO_AUDIT_LOGS,
  DEMO_COMPANIES,
  DEMO_COMPLAINTS,
  DEMO_CONTACTS,
  DEMO_DEALS,
  DEMO_INVOICES,
  DEMO_INVOICE_ITEMS,
  DEMO_LEADS,
  DEMO_NOTIFICATIONS,
  DEMO_PAYMENTS,
  DEMO_PRODUCTS,
  DEMO_PROSPECTS,
  DEMO_QUOTES,
  DEMO_QUOTE_ITEMS,
  DEMO_SATISFACTION_SURVEYS,
  DEMO_SEQUENCES,
  DEMO_SEQUENCE_ENROLLMENTS,
  DEMO_SEQUENCE_STEPS,
  DEMO_SERVICE_REQUESTS,
  DEMO_USERS,
} from '../services/seedData';
import {
  allocateDocumentNumberFirestore,
  appendAuditLog,
  buildEntityConstraints,
  createUserDoc,
  deleteCollectionDoc,
  deleteProductDoc,
  deleteProspectDoc,
  deleteTagDoc,
  deleteUserDoc,
  ensureUserProfile,
  markNotificationReadDoc,
  recordPaymentAndUpdateInvoice,
  saveActionDoc,
  saveCompanyDoc,
  saveComplaintDoc,
  saveContactDoc,
  saveDealDoc,
  saveEntityDoc,
  saveIntegrationDoc,
  saveInvoiceWithItems,
  saveLeadDoc,
  saveLegalSettingDoc,
  saveNotificationDoc,
  saveProductDoc,
  saveProspectDoc,
  saveQuoteWithItems,
  saveSatisfactionSurveyDoc,
  saveSequenceDoc,
  saveSequenceEnrollmentDoc,
  saveSequenceStepDoc,
  saveServiceRequestDoc,
  saveSettingsDoc,
  saveTagDoc,
  seedFirestoreDatabase,
  subscribeToCollection,
  updateUserDoc,
} from '../services/firestoreService';
import {
  canDeleteProductRecord,
  canDeleteUserAccount,
  canManageSettings,
  canViewAllEntities,
  filterActionsByScope,
  filterDealsByScope,
  filterProspectsByScope,
  formatCurrency,
  getAuthorizedEntities,
  mergeDefaultRecordsById,
  setActiveDefaultCurrency,
} from '../utils/crmLogic';
import {
  addDaysToDateIso,
  canValidateInvoices,
  computeDocumentTotals,
  computeInvoiceTotals,
  getEntityShortCode,
  getNextSequenceNumber,
  isNotificationUnreadByUser,
  isNotificationVisibleToUser,
  mergeCompanyRecords,
  mergeContactRecords,
  recalculateInvoiceWithPayments,
  requiresSuperAdminValidation,
  type LineInput,
} from '../utils/billingLogic';

type AuthMode = 'loading' | 'unauthenticated' | 'firebase' | 'demo';

export interface QuoteInputPayload {
  entityId: string;
  contactId: string;
  companyId: string;
  opportunityId?: string;
  issueDate: string;
  validUntil: string;
  currency: string;
  notes: string;
  legalMentions: string;
  showEuroConversion?: boolean;
  euroExchangeRate?: number;
  euroBankName?: string;
  euroRateDate?: string;
  status?: QuoteStatus;
  lines: LineInput[];
}

export interface InvoiceInputPayload {
  entityId: string;
  contactId: string;
  companyId: string;
  quoteId?: string;
  invoiceType?: InvoiceType;
  depositPercentage?: number;
  deductedDepositInvoiceId?: string;
  deductedDepositAmount?: number;
  showEuroConversion?: boolean;
  euroExchangeRate?: number;
  euroBankName?: string;
  euroRateDate?: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  notes: string;
  legalMentions: string;
  status?: Invoice['status'];
  lines: LineInput[];
}

export interface PaymentInputPayload {
  invoiceId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  reference: string;
  notes: string;
}

export interface CreateManagedUserPayload {
  email: string;
  displayName: string;
  password: string;
  role: UserRole;
  entityIds: string[];
}

interface CrmContextValue {
  authMode: AuthMode;
  firebaseAvailable: boolean;
  firestoreOffline: boolean;
  authConnectionError: string | null;
  retryFirebaseConnection: () => Promise<boolean>;
  currentUser: UserProfile | null;
  selectedEntityId: EntityScope;
  setSelectedEntityId: (scope: EntityScope) => void;
  globalSearch: string;
  setGlobalSearch: (q: string) => void;
  entities: CrmEntity[];
  authorizedEntities: CrmEntity[];
  users: UserProfile[];
  // Shared entities
  companies: Company[];
  contacts: Contact[];
  products: Product[];
  // Scoped & raw entities
  prospects: Prospect[];
  scopedProspects: Prospect[];
  leads: Lead[];
  scopedLeads: Lead[];
  sequences: FollowUpSequence[];
  scopedSequences: FollowUpSequence[];
  sequenceSteps: SequenceStep[];
  sequenceEnrollments: SequenceEnrollment[];
  scopedEnrollments: SequenceEnrollment[];
  actions: CrmAction[];
  scopedActions: CrmAction[];
  deals: Deal[];
  scopedDeals: Deal[];
  pipelines: Pipeline[];
  stages: PipelineStage[];
  tags: CrmTag[];
  quotes: Quote[];
  scopedQuotes: Quote[];
  quoteItems: QuoteItem[];
  invoices: Invoice[];
  scopedInvoices: Invoice[];
  invoiceItems: InvoiceItem[];
  payments: Payment[];
  scopedPayments: Payment[];
  complaints: Complaint[];
  scopedComplaints: Complaint[];
  serviceRequests: ServiceRequest[];
  scopedServiceRequests: ServiceRequest[];
  satisfactionSurveys: SatisfactionSurvey[];
  scopedSurveys: SatisfactionSurvey[];
  integrations: IntegrationSetting[];
  numberingCounters: NumberingCounter[];
  legalSettings: LegalSetting[];
  auditLogs: AuditLog[];
  notifications: CrmNotification[];
  visibleNotifications: CrmNotification[];
  unreadNotificationCount: number;
  settings: CrmSettings;
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  dismissToast: (id: string) => void;
  markNotificationAsRead: (notificationId: string) => Promise<void>;
  markAllNotificationsAsRead: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  pendingVerificationEmail: string | null;
  resendVerificationEmail: () => Promise<void>;
  refreshVerificationStatus: () => Promise<boolean>;
  enterDemoMode: (userUid?: string) => void;
  switchDemoUser: (userUid: string) => void;
  logout: () => Promise<void>;
  // Companies & Contacts (Shared)
  createCompany: (data: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Company>;
  updateCompany: (company: Company) => Promise<void>;
  mergeCompanies: (primaryId: string, duplicateId: string) => Promise<void>;
  createContact: (data: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Contact>;
  updateContact: (contact: Contact) => Promise<void>;
  mergeContacts: (primaryId: string, duplicateId: string) => Promise<void>;
  // Prospects
  createProspect: (data: Omit<Prospect, 'id' | 'createdAt' | 'updatedAt' | 'lastActivityAt'>) => Promise<Prospect>;
  updateProspect: (prospect: Prospect) => Promise<void>;
  archiveProspect: (prospectId: string, archived: boolean) => Promise<void>;
  deleteProspect: (prospectId: string) => Promise<void>;
  // Leads & Sequences
  createLead: (data: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Lead>;
  updateLead: (lead: Lead) => Promise<void>;
  convertLeadToOpportunity: (leadId: string) => Promise<Deal | null>;
  createSequence: (data: Omit<FollowUpSequence, 'id' | 'createdAt' | 'updatedAt' | 'createdByUid'>) => Promise<FollowUpSequence>;
  updateSequence: (seq: FollowUpSequence) => Promise<void>;
  saveSequenceStep: (step: SequenceStep, isNew: boolean) => Promise<void>;
  enrollLeadInSequence: (leadId: string, sequenceId: string) => Promise<SequenceEnrollment | null>;
  advanceSequenceStep: (
    enrollmentId: string,
    opts?: { outcomeNote?: string; bookMeeting?: boolean; gotReply?: boolean }
  ) => Promise<void>;
  updateEnrollmentStatus: (enrollmentId: string, status: SequenceEnrollmentStatus) => Promise<void>;
  // Actions
  createAction: (data: Omit<CrmAction, 'id' | 'createdAt' | 'updatedAt' | 'createdByUid'>) => Promise<CrmAction>;
  updateAction: (action: CrmAction, touchProspect?: boolean) => Promise<void>;
  completeAction: (actionId: string, outcome?: string) => Promise<void>;
  rescheduleAction: (actionId: string, dueDate: string, dueTime: string) => Promise<void>;
  cancelAction: (actionId: string) => Promise<void>;
  logCommunicationAction: (params: {
    contactId?: string;
    companyId?: string;
    prospectId?: string;
    entityId: string;
    channel: 'Appel' | 'Email' | 'Message WhatsApp';
    title: string;
    description: string;
  }) => Promise<CrmAction>;
  // Deals / Opportunities
  createDeal: (data: Omit<Deal, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Deal>;
  updateDeal: (deal: Deal) => Promise<void>;
  moveDealToStage: (
    dealId: string,
    targetStageId: string,
    lossDetails?: { lostReason?: LostReason; lostComment?: string }
  ) => Promise<void>;
  // Products, Quotes, Invoices, Payments
  saveProduct: (product: Product, isNew: boolean) => Promise<void>;
  deleteProduct: (productId: string) => Promise<void>;
  createQuote: (payload: QuoteInputPayload) => Promise<Quote>;
  updateQuote: (quote: Quote, lines: LineInput[]) => Promise<void>;
  updateQuoteStatus: (quoteId: string, status: QuoteStatus) => Promise<void>;
  convertQuoteToInvoice: (quoteId: string) => Promise<Invoice | null>;
  createInvoice: (payload: InvoiceInputPayload) => Promise<Invoice>;
  updateInvoice: (invoice: Invoice, lines: LineInput[]) => Promise<void>;
  approveInvoice: (invoiceId: string) => Promise<void>;
  rejectInvoice: (invoiceId: string, reason: string) => Promise<void>;
  recordPayment: (payload: PaymentInputPayload) => Promise<Payment | null>;
  // Support, Satisfaction, Settings
  saveComplaint: (complaint: Complaint, isNew: boolean) => Promise<void>;
  saveServiceRequest: (sr: ServiceRequest, isNew: boolean) => Promise<void>;
  saveSatisfactionSurvey: (survey: SatisfactionSurvey, isNew: boolean) => Promise<void>;
  saveIntegration: (integration: IntegrationSetting, isNew: boolean) => Promise<void>;
  saveLegalSetting: (legal: LegalSetting, isNew: boolean) => Promise<void>;
  saveEntity: (entity: CrmEntity, isNew: boolean) => Promise<void>;
  saveUser: (user: UserProfile) => Promise<void>;
  createManagedUser: (payload: CreateManagedUserPayload) => Promise<UserProfile>;
  deleteUser: (uid: string) => Promise<void>;
  saveTag: (tag: CrmTag, isNew: boolean) => Promise<void>;
  deleteTag: (tagId: string) => Promise<void>;
  saveSettings: (nextSettings: CrmSettings) => Promise<void>;
  seedFirestore: () => Promise<void>;
}

const CrmContext = createContext<CrmContextValue | null>(null);

const DEMO_STORAGE_KEY = 'arena_crm_demo_state_v4';

interface DemoStateSnapshot {
  activeUserUid: string;
  entities: CrmEntity[];
  users: UserProfile[];
  companies: Company[];
  contacts: Contact[];
  prospects: Prospect[];
  leads: Lead[];
  sequences: FollowUpSequence[];
  sequenceSteps: SequenceStep[];
  sequenceEnrollments: SequenceEnrollment[];
  actions: CrmAction[];
  deals: Deal[];
  pipelines: Pipeline[];
  stages: PipelineStage[];
  tags: CrmTag[];
  products: Product[];
  quotes: Quote[];
  quoteItems: QuoteItem[];
  invoices: Invoice[];
  invoiceItems: InvoiceItem[];
  payments: Payment[];
  complaints: Complaint[];
  serviceRequests: ServiceRequest[];
  satisfactionSurveys: SatisfactionSurvey[];
  integrations: IntegrationSetting[];
  numberingCounters: NumberingCounter[];
  legalSettings: LegalSetting[];
  auditLogs: AuditLog[];
  notifications: CrmNotification[];
  settings: CrmSettings;
}

function createInitialDemoState(): DemoStateSnapshot {
  return {
    activeUserUid: DEMO_USERS[0].uid,
    entities: DEFAULT_ENTITIES,
    users: DEMO_USERS,
    companies: DEMO_COMPANIES,
    contacts: DEMO_CONTACTS,
    prospects: DEMO_PROSPECTS,
    leads: DEMO_LEADS,
    sequences: DEMO_SEQUENCES,
    sequenceSteps: DEMO_SEQUENCE_STEPS,
    sequenceEnrollments: DEMO_SEQUENCE_ENROLLMENTS,
    actions: DEMO_ACTIONS,
    deals: DEMO_DEALS,
    pipelines: DEFAULT_PIPELINES,
    stages: DEFAULT_PIPELINE_STAGES,
    tags: DEFAULT_TAGS,
    products: DEMO_PRODUCTS,
    quotes: DEMO_QUOTES,
    quoteItems: DEMO_QUOTE_ITEMS,
    invoices: DEMO_INVOICES,
    invoiceItems: DEMO_INVOICE_ITEMS,
    payments: DEMO_PAYMENTS,
    complaints: DEMO_COMPLAINTS,
    serviceRequests: DEMO_SERVICE_REQUESTS,
    satisfactionSurveys: DEMO_SATISFACTION_SURVEYS,
    integrations: DEFAULT_INTEGRATIONS,
    numberingCounters: DEFAULT_NUMBERING_COUNTERS,
    legalSettings: DEFAULT_LEGAL_SETTINGS,
    auditLogs: DEMO_AUDIT_LOGS,
    notifications: DEMO_NOTIFICATIONS,
    settings: DEFAULT_SETTINGS,
  };
}

function loadDemoState(): DemoStateSnapshot {
  const initial = createInitialDemoState();
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY);
    if (!raw) return initial;
    const parsed = JSON.parse(raw) as Partial<DemoStateSnapshot>;
    return {
      ...initial,
      ...parsed,
    };
  } catch {
    return initial;
  }
}

function channelToActionType(channel: SequenceChannel): CrmAction['type'] {
  switch (channel) {
    case 'call':
      return 'Appel';
    case 'email':
      return 'Email';
    case 'whatsapp':
      return 'Message WhatsApp';
    default:
      return 'Relance';
  }
}

export function CrmProvider({ children }: { children: React.ReactNode }) {
  const [authMode, setAuthMode] = useState<AuthMode>('loading');
  const [firestoreOffline, setFirestoreOffline] = useState<boolean>(false);
  const [authConnectionError, setAuthConnectionError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);
  const [selectedEntityId, setSelectedEntityId] = useState<EntityScope>('all');
  const [globalSearch, setGlobalSearch] = useState('');

  const [entities, setEntities] = useState<CrmEntity[]>(DEFAULT_ENTITIES);
  const [users, setUsers] = useState<UserProfile[]>(DEMO_USERS);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [sequences, setSequences] = useState<FollowUpSequence[]>([]);
  const [sequenceSteps, setSequenceSteps] = useState<SequenceStep[]>([]);
  const [sequenceEnrollments, setSequenceEnrollments] = useState<SequenceEnrollment[]>([]);
  const [actions, setActions] = useState<CrmAction[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>(DEFAULT_PIPELINES);
  const [stages, setStages] = useState<PipelineStage[]>(DEFAULT_PIPELINE_STAGES);
  const [tags, setTags] = useState<CrmTag[]>(DEFAULT_TAGS);
  const [products, setProducts] = useState<Product[]>(DEMO_PRODUCTS);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [satisfactionSurveys, setSatisfactionSurveys] = useState<SatisfactionSurvey[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationSetting[]>(DEFAULT_INTEGRATIONS);
  const [numberingCounters, setNumberingCounters] = useState<NumberingCounter[]>(DEFAULT_NUMBERING_COUNTERS);
  const [legalSettings, setLegalSettings] = useState<LegalSetting[]>(DEFAULT_LEGAL_SETTINGS);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [notifications, setNotifications] = useState<CrmNotification[]>([]);
  const [settings, setSettings] = useState<CrmSettings>(DEFAULT_SETTINGS);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    setActiveDefaultCurrency(settings.defaultCurrency);
  }, [settings.defaultCurrency]);

  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const applyDemoSnapshot = useCallback(
    (snap: DemoStateSnapshot, preserveScope = false) => {
      const activeUser =
        snap.users.find((u) => u.uid === snap.activeUserUid) ?? snap.users[0];
      setCurrentUser(activeUser);
      setEntities(snap.entities);
      setUsers(snap.users);
      setCompanies(snap.companies);
      setContacts(snap.contacts);
      setProspects(snap.prospects);
      setLeads(snap.leads);
      setSequences(snap.sequences);
      setSequenceSteps(snap.sequenceSteps);
      setSequenceEnrollments(snap.sequenceEnrollments);
      setActions(snap.actions);
      setDeals(snap.deals);
      setPipelines(snap.pipelines);
      setStages(snap.stages);
      setTags(snap.tags);
      setProducts(snap.products);
      setQuotes(snap.quotes);
      setQuoteItems(snap.quoteItems);
      setInvoices(snap.invoices);
      setInvoiceItems(snap.invoiceItems);
      setPayments(snap.payments);
      setComplaints(snap.complaints);
      setServiceRequests(snap.serviceRequests);
      setSatisfactionSurveys(snap.satisfactionSurveys);
      setIntegrations(snap.integrations);
      setNumberingCounters(snap.numberingCounters);
      setLegalSettings(snap.legalSettings);
      setAuditLogs(snap.auditLogs);
      setNotifications(snap.notifications ?? []);
      setSettings(snap.settings);
      if (!preserveScope) {
        setSelectedEntityId(
          canViewAllEntities(activeUser) ? 'all' : activeUser.entityIds[0] ?? 'all'
        );
      }
    },
    []
  );

  const persistDemoState = useCallback(
    (updater: (prev: DemoStateSnapshot) => DemoStateSnapshot, preserveScope = true) => {
      const current = loadDemoState();
      const next = updater(current);
      try {
        localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage quota errors
      }
      applyDemoSnapshot(next, preserveScope);
    },
    [applyDemoSnapshot]
  );

  const enterDemoMode = useCallback(
    (userUid?: string) => {
      const snap = loadDemoState();
      if (userUid) {
        snap.activeUserUid = userUid;
      }
      try {
        localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(snap));
      } catch {
        // Ignore storage quota errors
      }
      applyDemoSnapshot(snap);
      setAuthMode('demo');
    },
    [applyDemoSnapshot]
  );

  const loadFirebaseProfile = useCallback(async (fbUser: User): Promise<boolean> => {
    try {
      setPendingVerificationEmail(null);
      const profile = await ensureUserProfile(
        fbUser.uid,
        fbUser.email ?? '',
        fbUser.displayName ?? ''
      );
      setFirestoreOffline(false);
      setAuthConnectionError(null);
      setCurrentUser(profile);
      setSelectedEntityId(
        canViewAllEntities(profile) ? 'all' : profile.entityIds[0] ?? 'all'
      );
      setAuthMode('firebase');
      return true;
    } catch (err) {
      if (isFirestoreOfflineError(err)) {
        setFirestoreOffline(true);
        setAuthConnectionError(formatFirebaseAuthErrorFr(err));
      } else {
        setAuthConnectionError(
          'Impossible de charger votre profil CRM depuis Firestore pour le moment.'
        );
      }
      console.error('Erreur chargement profil Firebase:', err);
      setAuthMode('unauthenticated');
      return false;
    }
  }, []);

  const retryFirebaseConnection = useCallback(async (): Promise<boolean> => {
    if (!isFirebaseConfigured || !auth) return false;
    await recoverFirestoreNetwork();
    const ok = await testFirestoreConnection();
    setFirestoreOffline(!ok);
    if (!ok) {
      setAuthConnectionError(
        'Impossible de joindre Cloud Firestore pour le moment (connexion lente ou hors ligne). Vérifiez votre réseau puis réessayez, ou utilisez le mode démonstration.'
      );
      return false;
    }
    setAuthConnectionError(null);
    if (auth.currentUser?.emailVerified) {
      return loadFirebaseProfile(auth.currentUser);
    }
    return true;
  }, [loadFirebaseProfile]);

  useEffect(() => {
    const params = new URLSearchParams(
      window.location.search || window.location.hash.split('?')[1] || ''
    );
    if (params.get('autostart') === '1') {
      enterDemoMode();
      return;
    }

    if (!isFirebaseConfigured || !auth) {
      setAuthMode('unauthenticated');
      return;
    }

    let cancelled = false;
    void testFirestoreConnection().then((ok) => {
      if (!cancelled) {
        setFirestoreOffline(!ok);
      }
    });

    const handleOffline = () => setFirestoreOffline(true);
    const handleOnline = () => {
      void retryFirebaseConnection();
    };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    const unsub = onAuthStateChanged(auth, async (fbUser: User | null) => {
      if (!fbUser) {
        setPendingVerificationEmail(null);
        setAuthConnectionError(null);
        setAuthMode((prev) => (prev === 'demo' ? 'demo' : 'unauthenticated'));
        return;
      }
      if (!fbUser.emailVerified) {
        setPendingVerificationEmail(fbUser.email ?? '');
        setCurrentUser(null);
        setAuthMode('unauthenticated');
        return;
      }
      await loadFirebaseProfile(fbUser);
    });

    return () => {
      cancelled = true;
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      unsub();
    };
  }, [enterDemoMode, loadFirebaseProfile, retryFirebaseConnection]);

  // Real-time Firestore listeners
  useEffect(() => {
    if (authMode !== 'firebase' || !currentUser) return;

    const isSuperAdminUser = currentUser.role === 'super_admin';
    const isManagerPlus =
      currentUser.role === 'super_admin' ||
      currentUser.role === 'entity_admin' ||
      currentUser.role === 'manager';
    const hasAssignedEntities = isSuperAdminUser || currentUser.entityIds.length > 0;
    const tagScopes = ['group', ...currentUser.entityIds].slice(0, 10);

    const entityConstraints = (field = 'entityId') =>
      buildEntityConstraints(field, currentUser, selectedEntityId);
    const integrationConstraints = isSuperAdminUser
      ? []
      : [
          where(
            'entityId',
            'in',
            selectedEntityId === 'all' ? tagScopes : ['group', selectedEntityId]
          ),
        ];

    const notifiedSubErrors = new Set<string>();
    const onSubError = (collectionName: string) => (error: unknown) => {
      console.error(`Erreur écoute Firestore (${collectionName}):`, error);
      if (!notifiedSubErrors.has(collectionName)) {
        notifiedSubErrors.add(collectionName);
        addToast({
          type: 'error',
          title: 'Synchronisation Firestore bloquée',
          description: `Impossible de lire la collection « ${collectionName} » (permissions insuffisantes).`,
        });
      }
    };

    const unsubs = [
      subscribeToCollection<CrmEntity>(
        'entities',
        isSuperAdminUser ? [] : [where('active', '==', true)],
        (items) => setEntities(items.length > 0 ? items : DEFAULT_ENTITIES),
        onSubError('entities')
      ),
      subscribeToCollection<UserProfile>(
        'users',
        isSuperAdminUser ? [] : [where('uid', '==', currentUser.uid)],
        setUsers,
        onSubError('users')
      ),
      // Shared across all 4 entities
      ...(hasAssignedEntities
        ? [
            subscribeToCollection<Company>('companies', [], setCompanies, onSubError('companies')),
            subscribeToCollection<Contact>('contacts', [], setContacts, onSubError('contacts')),
          ]
        : []),
      subscribeToCollection<Product>(
        'products',
        isManagerPlus ? [] : [where('active', '==', true)],
        (items) => setProducts(items.length > 0 ? items : DEMO_PRODUCTS),
        onSubError('products')
      ),
      subscribeToCollection<CrmTag>(
        'tags',
        isSuperAdminUser ? [] : [where('entityId', 'in', tagScopes)],
        (items) => setTags(items.length > 0 ? items : DEFAULT_TAGS),
        onSubError('tags')
      ),
      subscribeToCollection<LegalSetting>(
        'legalSettings',
        isSuperAdminUser
          ? []
          : hasAssignedEntities
          ? entityConstraints()
          : [where('entityId', '==', '__none__')],
        (items) => setLegalSettings(mergeDefaultRecordsById(DEFAULT_LEGAL_SETTINGS, items)),
        onSubError('legalSettings')
      ),
      // Entity-scoped
      subscribeToCollection<Prospect>(
        'prospects',
        entityConstraints('primaryEntityId'),
        setProspects,
        onSubError('prospects')
      ),
      subscribeToCollection<Lead>('leads', entityConstraints(), setLeads, onSubError('leads')),
      subscribeToCollection<FollowUpSequence>(
        'sequences',
        entityConstraints(),
        setSequences,
        onSubError('sequences')
      ),
      subscribeToCollection<SequenceStep>(
        'sequenceSteps',
        entityConstraints(),
        setSequenceSteps,
        onSubError('sequenceSteps')
      ),
      subscribeToCollection<SequenceEnrollment>(
        'sequenceEnrollments',
        entityConstraints(),
        setSequenceEnrollments,
        onSubError('sequenceEnrollments')
      ),
      subscribeToCollection<CrmAction>(
        'actions',
        entityConstraints(),
        setActions,
        onSubError('actions')
      ),
      subscribeToCollection<Deal>(
        'opportunities',
        entityConstraints(),
        setDeals,
        onSubError('opportunities')
      ),
      subscribeToCollection<Pipeline>(
        'pipelines',
        isSuperAdminUser ? [] : entityConstraints(),
        (items) => setPipelines(mergeDefaultRecordsById(DEFAULT_PIPELINES, items)),
        onSubError('pipelines')
      ),
      subscribeToCollection<PipelineStage>(
        'pipelineStages',
        isSuperAdminUser ? [] : entityConstraints(),
        (items) => setStages(mergeDefaultRecordsById(DEFAULT_PIPELINE_STAGES, items)),
        onSubError('pipelineStages')
      ),
      subscribeToCollection<Quote>('quotes', entityConstraints(), setQuotes, onSubError('quotes')),
      subscribeToCollection<QuoteItem>(
        'quoteItems',
        entityConstraints(),
        setQuoteItems,
        onSubError('quoteItems')
      ),
      subscribeToCollection<Invoice>(
        'invoices',
        entityConstraints(),
        setInvoices,
        onSubError('invoices')
      ),
      subscribeToCollection<InvoiceItem>(
        'invoiceItems',
        entityConstraints(),
        setInvoiceItems,
        onSubError('invoiceItems')
      ),
      subscribeToCollection<Payment>(
        'payments',
        entityConstraints(),
        setPayments,
        onSubError('payments')
      ),
      subscribeToCollection<Complaint>(
        'complaints',
        entityConstraints(),
        setComplaints,
        onSubError('complaints')
      ),
      subscribeToCollection<ServiceRequest>(
        'serviceRequests',
        entityConstraints(),
        setServiceRequests,
        onSubError('serviceRequests')
      ),
      subscribeToCollection<SatisfactionSurvey>(
        'satisfactionSurveys',
        entityConstraints(),
        setSatisfactionSurveys,
        onSubError('satisfactionSurveys')
      ),
      subscribeToCollection<IntegrationSetting>(
        'integrations',
        integrationConstraints,
        (items) => setIntegrations(mergeDefaultRecordsById(DEFAULT_INTEGRATIONS, items)),
        onSubError('integrations')
      ),
      subscribeToCollection<NumberingCounter>(
        'numberingCounters',
        entityConstraints(),
        setNumberingCounters,
        onSubError('numberingCounters')
      ),
      subscribeToCollection<AuditLog>(
        'auditLogs',
        entityConstraints(),
        setAuditLogs,
        onSubError('auditLogs')
      ),
      subscribeToCollection<CrmNotification>(
        'notifications',
        entityConstraints(),
        setNotifications,
        onSubError('notifications')
      ),
      subscribeToCollection<CrmSettings>(
        'settings',
        [where('scope', '==', 'global')],
        (items) => {
          if (items.length > 0) setSettings(items[0]);
        },
        onSubError('settings')
      ),
    ];

    return () => {
      unsubs.forEach((fn) => fn());
    };
  }, [authMode, currentUser, selectedEntityId, addToast]);

  const authorizedEntities = useMemo(
    () => getAuthorizedEntities(currentUser, entities),
    [currentUser, entities]
  );

  useEffect(() => {
    if (!currentUser) return;
    if (selectedEntityId === 'all' && !canViewAllEntities(currentUser)) {
      setSelectedEntityId(authorizedEntities[0]?.id ?? 'all');
    }
  }, [currentUser, selectedEntityId, authorizedEntities]);

  const filterByEntityAndAccess = useCallback(
    <T extends { entityId: string }>(items: T[], ownerField?: keyof T): T[] => {
      const allowedIds = new Set(authorizedEntities.map((e) => e.id));
      const canAll = canViewAllEntities(currentUser);
      return items.filter((item) => {
        if (selectedEntityId !== 'all' && item.entityId !== selectedEntityId) return false;
        if (canAll) return true;
        if (allowedIds.has(item.entityId)) return true;
        if (ownerField && item[ownerField] === currentUser?.uid) return true;
        return false;
      });
    },
    [authorizedEntities, currentUser, selectedEntityId]
  );

  const scopedProspects = useMemo(() => {
    let list = filterProspectsByScope(prospects, selectedEntityId, false);
    if (!canViewAllEntities(currentUser)) {
      const allowedIds = new Set(authorizedEntities.map((e) => e.id));
      list = list.filter(
        (p) =>
          allowedIds.has(p.primaryEntityId) ||
          p.sharedEntityIds.some((id) => allowedIds.has(id)) ||
          p.ownerUid === currentUser?.uid
      );
    }
    return list;
  }, [prospects, selectedEntityId, currentUser, authorizedEntities]);

  const scopedActions = useMemo(() => {
    let list = filterActionsByScope(actions, selectedEntityId);
    if (!canViewAllEntities(currentUser)) {
      const allowedIds = new Set(authorizedEntities.map((e) => e.id));
      list = list.filter(
        (a) => allowedIds.has(a.entityId) || a.assignedToUid === currentUser?.uid
      );
    }
    return list;
  }, [actions, selectedEntityId, currentUser, authorizedEntities]);

  const scopedDeals = useMemo(() => {
    let list = filterDealsByScope(deals, selectedEntityId);
    if (!canViewAllEntities(currentUser)) {
      const allowedIds = new Set(authorizedEntities.map((e) => e.id));
      list = list.filter(
        (d) => allowedIds.has(d.entityId) || d.ownerUid === currentUser?.uid
      );
    }
    return list;
  }, [deals, selectedEntityId, currentUser, authorizedEntities]);

  const scopedLeads = useMemo(
    () => filterByEntityAndAccess(leads, 'assignedToUid'),
    [leads, filterByEntityAndAccess]
  );
  const scopedSequences = useMemo(
    () => filterByEntityAndAccess(sequences),
    [sequences, filterByEntityAndAccess]
  );
  const scopedEnrollments = useMemo(
    () => filterByEntityAndAccess(sequenceEnrollments),
    [sequenceEnrollments, filterByEntityAndAccess]
  );
  const scopedQuotes = useMemo(
    () => filterByEntityAndAccess(quotes, 'createdByUid'),
    [quotes, filterByEntityAndAccess]
  );
  const scopedInvoices = useMemo(
    () => filterByEntityAndAccess(invoices, 'createdByUid'),
    [invoices, filterByEntityAndAccess]
  );
  const scopedPayments = useMemo(
    () => filterByEntityAndAccess(payments),
    [payments, filterByEntityAndAccess]
  );
  const scopedComplaints = useMemo(
    () => filterByEntityAndAccess(complaints, 'assignedToUid'),
    [complaints, filterByEntityAndAccess]
  );
  const scopedServiceRequests = useMemo(
    () => filterByEntityAndAccess(serviceRequests),
    [serviceRequests, filterByEntityAndAccess]
  );
  const scopedSurveys = useMemo(
    () => filterByEntityAndAccess(satisfactionSurveys),
    [satisfactionSurveys, filterByEntityAndAccess]
  );

  const visibleNotifications = useMemo(
    () =>
      notifications
        .filter((n) => isNotificationVisibleToUser(n, currentUser))
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    [notifications, currentUser]
  );

  const unreadNotificationCount = useMemo(
    () =>
      visibleNotifications.filter((n) => isNotificationUnreadByUser(n, currentUser?.uid)).length,
    [visibleNotifications, currentUser?.uid]
  );

  const emitNotification = async (
    payload: Omit<CrmNotification, 'id' | 'createdAt' | 'readByUids'>
  ) => {
    const notif: CrmNotification = {
      ...payload,
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      readByUids: currentUser?.uid ? [currentUser.uid] : [],
      createdAt: new Date().toISOString(),
    };
    if (authMode === 'demo') {
      persistDemoState((prev) => ({
        ...prev,
        notifications: [notif, ...(prev.notifications ?? [])],
      }));
    } else if (authMode === 'firebase') {
      await saveNotificationDoc(notif);
    }
  };

  const markNotificationAsRead = async (notificationId: string) => {
    const uid = currentUser?.uid;
    if (!uid) return;
    const target = notifications.find((n) => n.id === notificationId);
    if (!target) return;
    const existingReads = target.readByUids ?? [];
    if (existingReads.includes(uid)) return;
    const nextReads = [...existingReads, uid];
    if (authMode === 'demo') {
      persistDemoState((prev) => ({
        ...prev,
        notifications: (prev.notifications ?? []).map((n) =>
          n.id === notificationId ? { ...n, readByUids: nextReads } : n
        ),
      }));
    } else if (authMode === 'firebase') {
      await markNotificationReadDoc(notificationId, nextReads);
    }
  };

  const markAllNotificationsAsRead = async () => {
    const uid = currentUser?.uid;
    if (!uid) return;
    const unread = visibleNotifications.filter((n) => isNotificationUnreadByUser(n, uid));
    if (unread.length === 0) return;
    if (authMode === 'demo') {
      const unreadIds = new Set(unread.map((u) => u.id));
      persistDemoState((prev) => ({
        ...prev,
        notifications: (prev.notifications ?? []).map((n) =>
          unreadIds.has(n.id) && !(n.readByUids ?? []).includes(uid)
            ? { ...n, readByUids: [...(n.readByUids ?? []), uid] }
            : n
        ),
      }));
    } else if (authMode === 'firebase') {
      await Promise.all(
        unread.map((n) =>
          markNotificationReadDoc(n.id, Array.from(new Set([...(n.readByUids ?? []), uid])))
        )
      );
    }
  };

  const loginWithEmail = async (email: string, password: string) => {
    if (!auth) throw new Error('Firebase Auth non configuré.');
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    if (!cred.user.emailVerified) {
      setPendingVerificationEmail(cred.user.email ?? email.trim());
    }
  };

  const loginWithGoogle = async () => {
    if (!auth) throw new Error('Firebase Auth non configuré.');
    await signInWithPopup(auth, googleProvider);
  };

  const resendVerificationEmail = async () => {
    if (!auth?.currentUser) throw new Error('Aucun utilisateur connecté.');
    await sendEmailVerification(auth.currentUser);
  };

  const refreshVerificationStatus = async (): Promise<boolean> => {
    if (!auth?.currentUser) return false;
    await auth.currentUser.reload();
    if (!auth.currentUser.emailVerified) {
      return false;
    }
    await auth.currentUser.getIdToken(true);
    return loadFirebaseProfile(auth.currentUser);
  };

  const switchDemoUser = (userUid: string) => {
    if (authMode !== 'demo') return;
    persistDemoState((prev) => ({ ...prev, activeUserUid: userUid }), false);
    addToast({ type: 'info', title: 'Profil actif mis à jour' });
  };

  const logout = async () => {
    if (auth?.currentUser) {
      await signOut(auth);
    }
    setPendingVerificationEmail(null);
    setCurrentUser(null);
    setAuthMode('unauthenticated');
  };

  const recordLog = async (
    entityId: string,
    actionType: string,
    targetType: string,
    targetId: string,
    summary: string
  ) => {
    if (!currentUser) return;
    const log: AuditLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      entityId: entityId || 'group',
      actorUid: currentUser.uid,
      actorName: currentUser.displayName,
      actionType,
      targetType,
      targetId,
      summary,
      createdAt: new Date().toISOString(),
    };
    if (authMode === 'demo') {
      persistDemoState((prev) => ({
        ...prev,
        auditLogs: [log, ...prev.auditLogs],
      }));
    } else if (authMode === 'firebase') {
      try {
        await appendAuditLog(log);
      } catch (err) {
        console.warn('Écriture du journal d’audit ignorée :', err);
      }
    }
  };

  const defaultEntityScopeId = () =>
    selectedEntityId !== 'all' ? selectedEntityId : authorizedEntities[0]?.id ?? 'arena-business-center';

  // --- Companies & Contacts (Shared) ---
  const createCompany = async (
    data: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Company> => {
    const now = new Date().toISOString();
    const company: Company = {
      ...data,
      id: `comp-${Date.now()}`,
      createdAt: now,
      updatedAt: now,
    };
    if (authMode === 'demo') {
      persistDemoState((prev) => ({ ...prev, companies: [company, ...prev.companies] }));
    } else {
      await saveCompanyDoc(company, true);
    }
    await recordLog(
      defaultEntityScopeId(),
      'company_created',
      'company',
      company.id,
      `Entreprise créée : ${company.legalName}.`
    );
    addToast({ type: 'success', title: 'Entreprise créée', description: company.legalName });
    return company;
  };

  const updateCompany = async (company: Company) => {
    const updated = { ...company, updatedAt: new Date().toISOString() };
    if (authMode === 'demo') {
      persistDemoState((prev) => ({
        ...prev,
        companies: prev.companies.map((c) => (c.id === updated.id ? updated : c)),
      }));
    } else {
      await saveCompanyDoc(updated, false);
    }
    addToast({ type: 'success', title: 'Entreprise mise à jour' });
  };

  const mergeCompanies = async (primaryId: string, duplicateId: string) => {
    const primary = companies.find((c) => c.id === primaryId);
    const duplicate = companies.find((c) => c.id === duplicateId);
    if (!primary || !duplicate || primaryId === duplicateId) return;
    const merged = mergeCompanyRecords(primary, duplicate);

    if (authMode === 'demo') {
      persistDemoState((prev) => ({
        ...prev,
        companies: prev.companies
          .filter((c) => c.id !== duplicateId)
          .map((c) => (c.id === primaryId ? merged : c)),
        contacts: prev.contacts.map((ct) =>
          ct.companyId === duplicateId ? { ...ct, companyId: primaryId } : ct
        ),
        prospects: prev.prospects.map((p) =>
          p.companyId === duplicateId ? { ...p, companyId: primaryId, companyName: merged.legalName } : p
        ),
        leads: prev.leads.map((l) =>
          l.companyId === duplicateId ? { ...l, companyId: primaryId } : l
        ),
        deals: prev.deals.map((d) =>
          d.companyId === duplicateId ? { ...d, companyId: primaryId } : d
        ),
        quotes: prev.quotes.map((q) =>
          q.companyId === duplicateId ? { ...q, companyId: primaryId } : q
        ),
        invoices: prev.invoices.map((i) =>
          i.companyId === duplicateId ? { ...i, companyId: primaryId } : i
        ),
        complaints: prev.complaints.map((c) =>
          c.companyId === duplicateId ? { ...c, companyId: primaryId } : c
        ),
      }));
    } else {
      await saveCompanyDoc(merged, false);
      const affectedContacts = contacts.filter((c) => c.companyId === duplicateId);
      for (const ct of affectedContacts) {
        await saveContactDoc({ ...ct, companyId: primaryId }, false);
      }
      await deleteCollectionDoc('companies', duplicateId);
    }
    await recordLog(
      defaultEntityScopeId(),
      'company_merged',
      'company',
      primaryId,
      `Doublon « ${duplicate.legalName} » fusionné dans « ${primary.legalName} ».`
    );
    addToast({ type: 'success', title: 'Entreprises fusionnées', description: primary.legalName });
  };

  const createContact = async (
    data: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Contact> => {
    const now = new Date().toISOString();
    const contact: Contact = {
      ...data,
      id: `contact-${Date.now()}`,
      createdAt: now,
      updatedAt: now,
    };
    if (authMode === 'demo') {
      persistDemoState((prev) => ({ ...prev, contacts: [contact, ...prev.contacts] }));
    } else {
      await saveContactDoc(contact, true);
    }
    await recordLog(
      defaultEntityScopeId(),
      'contact_created',
      'contact',
      contact.id,
      `Contact créé : ${contact.fullName}.`
    );
    addToast({ type: 'success', title: 'Contact créé', description: contact.fullName });
    return contact;
  };

  const updateContact = async (contact: Contact) => {
    const updated = { ...contact, updatedAt: new Date().toISOString() };
    if (authMode === 'demo') {
      persistDemoState((prev) => ({
        ...prev,
        contacts: prev.contacts.map((c) => (c.id === updated.id ? updated : c)),
      }));
    } else {
      await saveContactDoc(updated, false);
    }
    addToast({ type: 'success', title: 'Contact enregistré' });
  };

  const mergeContacts = async (primaryId: string, duplicateId: string) => {
    const primary = contacts.find((c) => c.id === primaryId);
    const duplicate = contacts.find((c) => c.id === duplicateId);
    if (!primary || !duplicate || primaryId === duplicateId) return;
    const merged = mergeContactRecords(primary, duplicate);

    if (authMode === 'demo') {
      persistDemoState((prev) => ({
        ...prev,
        contacts: prev.contacts
          .filter((c) => c.id !== duplicateId)
          .map((c) => (c.id === primaryId ? merged : c)),
        leads: prev.leads.map((l) =>
          l.contactId === duplicateId ? { ...l, contactId: primaryId } : l
        ),
        deals: prev.deals.map((d) =>
          d.contactId === duplicateId ? { ...d, contactId: primaryId } : d
        ),
        actions: prev.actions.map((a) =>
          a.contactId === duplicateId ? { ...a, contactId: primaryId } : a
        ),
        quotes: prev.quotes.map((q) =>
          q.contactId === duplicateId ? { ...q, contactId: primaryId } : q
        ),
        invoices: prev.invoices.map((i) =>
          i.contactId === duplicateId ? { ...i, contactId: primaryId } : i
        ),
        complaints: prev.complaints.map((c) =>
          c.contactId === duplicateId ? { ...c, contactId: primaryId } : c
        ),
      }));
    } else {
      await saveContactDoc(merged, false);
      await deleteCollectionDoc('contacts', duplicateId);
    }
    await recordLog(
      defaultEntityScopeId(),
      'contact_merged',
      'contact',
      primaryId,
      `Doublon « ${duplicate.fullName} » fusionné dans « ${primary.fullName} ».`
    );
    addToast({ type: 'success', title: 'Contacts fusionnés', description: primary.fullName });
  };

  // --- Prospects ---
  const createProspect = async (
    data: Omit<Prospect, 'id' | 'createdAt' | 'updatedAt' | 'lastActivityAt'>
  ): Promise<Prospect> => {
    const now = new Date().toISOString();
    const prospect: Prospect = {
      ...data,
      id: `prospect-${Date.now()}`,
      createdAt: now,
      updatedAt: now,
      lastActivityAt: now,
    };
    if (authMode === 'demo') {
      persistDemoState((prev) => ({
        ...prev,
        prospects: [prospect, ...prev.prospects],
      }));
    } else {
      await saveProspectDoc(prospect, true);
    }
    await recordLog(
      prospect.primaryEntityId,
      'prospect_created',
      'prospect',
      prospect.id,
      `Nouveau prospect créé : ${prospect.firstName} ${prospect.lastName} (${prospect.companyName || 'Particulier'}).`
    );
    addToast({
      type: 'success',
      title: 'Prospect créé',
      description: `${prospect.firstName} ${prospect.lastName}`,
    });
    return prospect;
  };

  const updateProspect = async (prospect: Prospect) => {
    const updated = { ...prospect, updatedAt: new Date().toISOString() };
    if (authMode === 'demo') {
      persistDemoState((prev) => ({
        ...prev,
        prospects: prev.prospects.map((p) => (p.id === updated.id ? updated : p)),
      }));
    } else {
      await saveProspectDoc(updated, false);
    }
    await recordLog(
      updated.primaryEntityId,
      'prospect_updated',
      'prospect',
      updated.id,
      `Fiche prospect mise à jour : ${updated.firstName} ${updated.lastName}.`
    );
    addToast({ type: 'success', title: 'Prospect enregistré' });
  };

  const archiveProspect = async (prospectId: string, archived: boolean) => {
    const target = prospects.find((p) => p.id === prospectId);
    if (!target) return;
    await updateProspect({ ...target, archived });
  };

  const deleteProspect = async (prospectId: string) => {
    const target = prospects.find((p) => p.id === prospectId);
    if (authMode === 'demo') {
      persistDemoState((prev) => ({
        ...prev,
        prospects: prev.prospects.filter((p) => p.id !== prospectId),
      }));
    } else {
      await deleteProspectDoc(prospectId);
    }
    if (target) {
      await recordLog(
        target.primaryEntityId,
        'prospect_deleted',
        'prospect',
        prospectId,
        `Prospect supprimé : ${target.firstName} ${target.lastName}.`
      );
    }
    addToast({ type: 'info', title: 'Prospect supprimé' });
  };

  // --- Leads & Follow-up Sequences ---
  const createLead = async (
    data: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Lead> => {
    const now = new Date().toISOString();
    const lead: Lead = {
      ...data,
      id: `lead-${Date.now()}`,
      createdAt: now,
      updatedAt: now,
    };
    if (authMode === 'demo') {
      persistDemoState((prev) => ({ ...prev, leads: [lead, ...prev.leads] }));
    } else {
      await saveLeadDoc(lead, true);
    }
    await recordLog(lead.entityId, 'lead_created', 'contact', lead.contactId, `Lead qualifié dans ${lead.entityId}.`);
    addToast({ type: 'success', title: 'Lead créé' });
    return lead;
  };

  const updateLead = async (lead: Lead) => {
    const updated = { ...lead, updatedAt: new Date().toISOString() };
    if (authMode === 'demo') {
      persistDemoState((prev) => ({
        ...prev,
        leads: prev.leads.map((l) => (l.id === updated.id ? updated : l)),
      }));
    } else {
      await saveLeadDoc(updated, false);
    }
    addToast({ type: 'success', title: 'Lead mis à jour' });
  };

  const convertLeadToOpportunity = async (leadId: string): Promise<Deal | null> => {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return null;
    const contact = contacts.find((c) => c.id === lead.contactId);
    const company = companies.find((c) => c.id === lead.companyId);
    const pipe = pipelines.find((p) => p.entityId === lead.entityId) ?? pipelines[0];
    const firstStage = [...stages]
      .filter((s) => s.entityId === lead.entityId || s.pipelineId === pipe?.id)
      .sort((a, b) => a.order - b.order)[0];

    await updateLead({ ...lead, status: 'Qualifié' });
    const createdDeal = await createDeal({
      entityId: lead.entityId,
      prospectId: '',
      contactId: lead.contactId,
      companyId: lead.companyId,
      name: `Opportunité ${company?.tradeName || company?.legalName || contact?.fullName || 'Client'}`,
      stage: 'Prospect',
      stageId: firstStage?.id ?? `stage-${lead.entityId}-prospect`,
      pipelineId: pipe?.id ?? `pipeline-${lead.entityId}`,
      amount: lead.estimatedValue || 3000,
      currency: settings.defaultCurrency || 'MGA',
      probability: firstStage?.probability ?? 10,
      expectedCloseDate: addDaysToDateIso(new Date().toISOString(), 30),
      serviceConcerned: '',
      ownerUid: lead.assignedToUid || currentUser?.uid || 'system',
      status: 'open',
      notes: lead.notes || `Converti depuis lead (${lead.source}).`,
    });
    return createdDeal;
  };

  const createSequence = async (
    data: Omit<FollowUpSequence, 'id' | 'createdAt' | 'updatedAt' | 'createdByUid'>
  ): Promise<FollowUpSequence> => {
    const now = new Date().toISOString();
    const seq: FollowUpSequence = {
      ...data,
      id: `seq-${Date.now()}`,
      createdByUid: currentUser?.uid ?? 'system',
      createdAt: now,
      updatedAt: now,
    };
    if (authMode === 'demo') {
      persistDemoState((prev) => ({ ...prev, sequences: [seq, ...prev.sequences] }));
    } else {
      await saveSequenceDoc(seq, true);
    }
    addToast({ type: 'success', title: 'Séquence créée', description: seq.name });
    return seq;
  };

  const updateSequence = async (seq: FollowUpSequence) => {
    const updated = { ...seq, updatedAt: new Date().toISOString() };
    if (authMode === 'demo') {
      persistDemoState((prev) => ({
        ...prev,
        sequences: prev.sequences.map((s) => (s.id === updated.id ? updated : s)),
      }));
    } else {
      await saveSequenceDoc(updated, false);
    }
    addToast({ type: 'success', title: 'Séquence mise à jour' });
  };

  const saveSequenceStep = async (step: SequenceStep, isNew: boolean) => {
    if (authMode === 'demo') {
      persistDemoState((prev) => ({
        ...prev,
        sequenceSteps: isNew
          ? [...prev.sequenceSteps, step]
          : prev.sequenceSteps.map((s) => (s.id === step.id ? step : s)),
      }));
    } else {
      await saveSequenceStepDoc(step, isNew);
    }
    addToast({ type: 'success', title: 'Étape de séquence enregistrée' });
  };

  const enrollLeadInSequence = async (
    leadId: string,
    sequenceId: string
  ): Promise<SequenceEnrollment | null> => {
    const lead = leads.find((l) => l.id === leadId);
    const seq = sequences.find((s) => s.id === sequenceId);
    if (!lead || !seq) return null;

    const steps = [...sequenceSteps]
      .filter((s) => s.sequenceId === sequenceId)
      .sort((a, b) => a.order - b.order);
    const firstStep = steps[0];
    const todayIso = new Date().toISOString().slice(0, 10);
    const nextActionDate = firstStep
      ? addDaysToDateIso(todayIso, firstStep.delayDays)
      : todayIso;

    const enrollment: SequenceEnrollment = {
      id: `enr-${Date.now()}`,
      sequenceId,
      leadId,
      contactId: lead.contactId,
      entityId: seq.entityId,
      enrolledAt: todayIso,
      currentStep: 0,
      status: 'active',
      nextActionDate,
      callsMade: 0,
      meetingsBooked: 0,
      repliesReceived: 0,
      updatedAt: new Date().toISOString(),
    };

    if (authMode === 'demo') {
      persistDemoState((prev) => ({
        ...prev,
        sequenceEnrollments: [enrollment, ...prev.sequenceEnrollments],
      }));
    } else {
      await saveSequenceEnrollmentDoc(enrollment, true);
    }

    if (firstStep) {
      await createAction({
        entityId: seq.entityId,
        prospectId: '',
        contactId: lead.contactId,
        companyId: lead.companyId,
        type: channelToActionType(firstStep.channel),
        title: `[Séquence] ${firstStep.title}`,
        description: firstStep.description,
        assignedToUid: lead.assignedToUid || currentUser?.uid || 'system',
        status: 'planned',
        dueDate: nextActionDate,
        dueTime: '09:30',
        priority: lead.priority,
        outcome: '',
        durationMinutes: 20,
        relatedEntityType: 'contact',
      });
    }

    addToast({
      type: 'success',
      title: 'Lead inscrit dans la séquence',
      description: seq.name,
    });
    return enrollment;
  };

  const advanceSequenceStep = async (
    enrollmentId: string,
    opts?: { outcomeNote?: string; bookMeeting?: boolean; gotReply?: boolean }
  ) => {
    const enr = sequenceEnrollments.find((e) => e.id === enrollmentId);
    if (!enr) return;
    const steps = [...sequenceSteps]
      .filter((s) => s.sequenceId === enr.sequenceId)
      .sort((a, b) => a.order - b.order);

    const currentStepObj = steps[enr.currentStep];
    const nextIndex = enr.currentStep + 1;
    const isCompleted = nextIndex >= steps.length;
    const nextStepObj = steps[nextIndex];
    const todayIso = new Date().toISOString().slice(0, 10);
    const nextActionDate = nextStepObj
      ? addDaysToDateIso(todayIso, nextStepObj.delayDays)
      : todayIso;

    const updated: SequenceEnrollment = {
      ...enr,
      currentStep: isCompleted ? enr.currentStep : nextIndex,
      status: isCompleted ? 'completed' : 'active',
      nextActionDate,
      callsMade: enr.callsMade + (currentStepObj?.channel === 'call' ? 1 : 0),
      meetingsBooked: enr.meetingsBooked + (opts?.bookMeeting ? 1 : 0),
      repliesReceived: enr.repliesReceived + (opts?.gotReply ? 1 : 0),
      updatedAt: new Date().toISOString(),
    };

    if (authMode === 'demo') {
      persistDemoState((prev) => ({
        ...prev,
        sequenceEnrollments: prev.sequenceEnrollments.map((e) =>
          e.id === updated.id ? updated : e
        ),
      }));
    } else {
      await saveSequenceEnrollmentDoc(updated, false);
    }

    if (currentStepObj) {
      await createAction({
        entityId: enr.entityId,
        prospectId: '',
        contactId: enr.contactId,
        type: channelToActionType(currentStepObj.channel),
        title: `[Séquence réalisée] ${currentStepObj.title}`,
        description: currentStepObj.description,
        assignedToUid: currentUser?.uid ?? 'system',
        status: 'done',
        dueDate: todayIso,
        dueTime: new Date().toISOString().slice(11, 16),
        completedAt: new Date().toISOString(),
        priority: 'medium',
        outcome: opts?.outcomeNote || 'Étape complétée',
        durationMinutes: 15,
        relatedEntityType: 'contact',
      });
    }

    if (!isCompleted && nextStepObj) {
      await createAction({
        entityId: enr.entityId,
        prospectId: '',
        contactId: enr.contactId,
        type: channelToActionType(nextStepObj.channel),
        title: `[Séquence] ${nextStepObj.title}`,
        description: nextStepObj.description,
        assignedToUid: currentUser?.uid ?? 'system',
        status: 'planned',
        dueDate: nextActionDate,
        dueTime: '09:30',
        priority: 'medium',
        outcome: '',
        durationMinutes: 20,
        relatedEntityType: 'contact',
      });
    }

    addToast({
      type: 'success',
      title: isCompleted ? 'Séquence terminée' : 'Étape suivante planifiée',
    });
  };

  const updateEnrollmentStatus = async (
    enrollmentId: string,
    status: SequenceEnrollmentStatus
  ) => {
    const enr = sequenceEnrollments.find((e) => e.id === enrollmentId);
    if (!enr) return;
    const updated = { ...enr, status, updatedAt: new Date().toISOString() };
    if (authMode === 'demo') {
      persistDemoState((prev) => ({
        ...prev,
        sequenceEnrollments: prev.sequenceEnrollments.map((e) =>
          e.id === updated.id ? updated : e
        ),
      }));
    } else {
      await saveSequenceEnrollmentDoc(updated, false);
    }
    addToast({ type: 'info', title: 'Statut de séquence mis à jour' });
  };

  // --- Actions & Communication Logging ---
  const createAction = async (
    data: Omit<CrmAction, 'id' | 'createdAt' | 'updatedAt' | 'createdByUid'>
  ): Promise<CrmAction> => {
    const now = new Date().toISOString();
    const action: CrmAction = {
      ...data,
      id: `action-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      createdByUid: currentUser?.uid ?? 'system',
      createdAt: now,
      updatedAt: now,
    };
    const isDone = action.status === 'done';
    if (authMode === 'demo') {
      persistDemoState((prev) => ({
        ...prev,
        actions: [action, ...prev.actions],
        prospects:
          isDone && action.prospectId
            ? prev.prospects.map((p) =>
                p.id === action.prospectId
                  ? { ...p, lastActivityAt: now, updatedAt: now }
                  : p
              )
            : prev.prospects,
      }));
    } else {
      await saveActionDoc(action, true, isDone);
    }
    await recordLog(
      action.entityId,
      'action_created',
      action.contactId ? 'contact' : 'action',
      action.contactId || action.id,
      `Action ajoutée : ${action.title} (${action.type}).`
    );
    addToast({ type: 'success', title: 'Action enregistrée', description: action.title });
    return action;
  };

  const updateAction = async (action: CrmAction, touchProspect = false) => {
    const now = new Date().toISOString();
    const updated = { ...action, updatedAt: now };
    if (authMode === 'demo') {
      persistDemoState((prev) => ({
        ...prev,
        actions: prev.actions.map((a) => (a.id === updated.id ? updated : a)),
        prospects:
          touchProspect && updated.prospectId
            ? prev.prospects.map((p) =>
                p.id === updated.prospectId
                  ? { ...p, lastActivityAt: now, updatedAt: now }
                  : p
              )
            : prev.prospects,
      }));
    } else {
      await saveActionDoc(updated, false, touchProspect);
    }
  };

  const completeAction = async (actionId: string, outcome?: string) => {
    const target = actions.find((a) => a.id === actionId);
    if (!target) return;
    const now = new Date().toISOString();
    await updateAction(
      {
        ...target,
        status: 'done',
        completedAt: now,
        outcome: outcome !== undefined ? outcome : target.outcome || 'Action réalisée',
      },
      true
    );
    await recordLog(
      target.entityId,
      'action_completed',
      target.contactId ? 'contact' : 'action',
      target.contactId || target.id,
      `Action terminée : ${target.title}.`
    );
    addToast({ type: 'success', title: 'Action marquée comme terminée' });
  };

  const rescheduleAction = async (actionId: string, dueDate: string, dueTime: string) => {
    const target = actions.find((a) => a.id === actionId);
    if (!target) return;
    await updateAction({ ...target, dueDate, dueTime, status: 'planned' });
    addToast({
      type: 'info',
      title: 'Action reportée',
      description: `Nouvelle échéance : ${dueDate}`,
    });
  };

  const cancelAction = async (actionId: string) => {
    const target = actions.find((a) => a.id === actionId);
    if (!target) return;
    await updateAction({ ...target, status: 'cancelled' });
    addToast({ type: 'info', title: 'Action annulée' });
  };

  const logCommunicationAction = async (params: {
    contactId?: string;
    companyId?: string;
    prospectId?: string;
    entityId: string;
    channel: 'Appel' | 'Email' | 'Message WhatsApp';
    title: string;
    description: string;
  }) => {
    const now = new Date().toISOString();
    return createAction({
      entityId: params.entityId,
      prospectId: params.prospectId || '',
      contactId: params.contactId,
      companyId: params.companyId,
      type: params.channel,
      title: params.title,
      description: params.description,
      assignedToUid: currentUser?.uid ?? 'system',
      status: 'done',
      dueDate: now.slice(0, 10),
      dueTime: now.slice(11, 16),
      completedAt: now,
      priority: 'medium',
      outcome: params.description,
      durationMinutes: 10,
      relatedEntityType: params.contactId ? 'contact' : 'company',
    });
  };

  // --- Opportunities / Deals ---
  const createDeal = async (
    data: Omit<Deal, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Deal> => {
    const now = new Date().toISOString();
    const deal: Deal = {
      ...data,
      id: `deal-${Date.now()}`,
      createdAt: now,
      updatedAt: now,
    };
    if (authMode === 'demo') {
      persistDemoState((prev) => ({ ...prev, deals: [deal, ...prev.deals] }));
    } else {
      await saveDealDoc(deal, true);
    }
    await recordLog(
      deal.entityId,
      'deal_created',
      deal.contactId || 'deal',
      deal.contactId || deal.id,
      `Nouvelle opportunité créée : ${deal.name} (${deal.amount} ${deal.currency}).`
    );
    addToast({ type: 'success', title: 'Opportunité créée', description: deal.name });
    return deal;
  };

  const updateDeal = async (deal: Deal) => {
    const updated = { ...deal, updatedAt: new Date().toISOString() };
    if (authMode === 'demo') {
      persistDemoState((prev) => ({
        ...prev,
        deals: prev.deals.map((d) => (d.id === updated.id ? updated : d)),
      }));
    } else {
      await saveDealDoc(updated, false);
    }
    addToast({ type: 'success', title: 'Opportunité mise à jour' });
  };

  const moveDealToStage = async (
    dealId: string,
    targetStageId: string,
    lossDetails?: { lostReason?: LostReason; lostComment?: string }
  ) => {
    const deal = deals.find((d) => d.id === dealId);
    const stage = stages.find((s) => s.id === targetStageId);
    if (!deal || !stage) return;

    const updated: Deal = {
      ...deal,
      stage: stage.name as Deal['stage'],
      stageId: stage.id,
      probability: stage.probability,
      status: stage.outcomeType,
      lostReason: stage.outcomeType === 'lost' ? lossDetails?.lostReason : undefined,
      lostComment: stage.outcomeType === 'lost' ? lossDetails?.lostComment : undefined,
      updatedAt: new Date().toISOString(),
    };
    if (authMode === 'demo') {
      persistDemoState((prev) => ({
        ...prev,
        deals: prev.deals.map((d) => (d.id === updated.id ? updated : d)),
      }));
    } else {
      await saveDealDoc(updated, false);
    }
    await recordLog(
      deal.entityId,
      'deal_stage_moved',
      deal.contactId ? 'contact' : 'deal',
      deal.contactId || deal.id,
      `Opportunité « ${deal.name} » déplacée vers « ${stage.name} »${
        updated.lostReason ? ` (${updated.lostReason})` : ''
      }.`
    );
    addToast({ type: 'success', title: `Opportunité → ${stage.name}` });
  };

  // --- Products, Quotes, Invoices, Payments ---
  const saveProduct = async (product: Product, isNew: boolean) => {
    const now = new Date().toISOString();
    const payload = { ...product, updatedAt: now, createdAt: isNew ? now : product.createdAt };
    if (authMode === 'demo') {
      persistDemoState((prev) => ({
        ...prev,
        products: isNew
          ? [payload, ...prev.products]
          : prev.products.map((p) => (p.id === payload.id ? payload : p)),
      }));
    } else {
      await saveProductDoc(payload, isNew);
    }
    addToast({ type: 'success', title: isNew ? 'Produit ajouté' : 'Produit mis à jour' });
  };

  const deleteProduct = async (productId: string) => {
    if (!canDeleteProductRecord(currentUser)) {
      addToast({
        type: 'error',
        title: 'Suppression non autorisée',
        description: 'Droits insuffisants pour supprimer un produit du catalogue.',
      });
      return;
    }
    const target = products.find((p) => p.id === productId);
    if (authMode === 'demo') {
      persistDemoState((prev) => ({
        ...prev,
        products: prev.products.filter((p) => p.id !== productId),
      }));
    } else {
      await deleteProductDoc(productId);
    }
    if (target) {
      await recordLog(
        defaultEntityScopeId(),
        'product_deleted',
        'product',
        productId,
        `Produit supprimé du catalogue : ${target.name}.`
      );
    }
    addToast({ type: 'info', title: 'Produit supprimé du catalogue' });
  };

  const allocateNumber = async (prefix: 'DEV' | 'FAC', entityId: string, year: number) => {
    const legal = legalSettings.find((l) => l.entityId === entityId);
    const entityCode = legal?.entityCode || getEntityShortCode(entityId, entities);
    if (authMode === 'demo') {
      const existingNums =
        prefix === 'DEV'
          ? quotes.map((q) => q.quoteNumber)
          : invoices.map((i) => i.invoiceNumber);
      return getNextSequenceNumber(
        numberingCounters,
        existingNums,
        prefix,
        entityId,
        entityCode,
        year
      );
    }
    const number = await allocateDocumentNumberFirestore(prefix, entityId, entityCode, year);
    return {
      number,
      nextCounter: {
        id: `${prefix}-${entityCode}-${year}`,
        prefix,
        entityId,
        entityCode,
        year,
        lastSequence: 1,
        updatedAt: new Date().toISOString(),
      },
    };
  };

  const createQuote = async (payload: QuoteInputPayload): Promise<Quote> => {
    const now = new Date().toISOString();
    const year = Number((payload.issueDate || now).slice(0, 4)) || new Date().getFullYear();
    const { number, nextCounter } = await allocateNumber('DEV', payload.entityId, year);
    const totals = computeDocumentTotals(payload.lines);
    const quoteId = `quote-${Date.now()}`;

    const showEuro = Boolean(
      payload.showEuroConversion && payload.euroExchangeRate && payload.euroExchangeRate > 0
    );

    const quote: Quote = {
      id: quoteId,
      entityId: payload.entityId,
      contactId: payload.contactId,
      companyId: payload.companyId,
      opportunityId: payload.opportunityId,
      quoteNumber: number,
      status: payload.status ?? 'Brouillon',
      issueDate: payload.issueDate,
      validUntil: payload.validUntil,
      currency: payload.currency || settings.defaultCurrency || 'MGA',
      subtotal: totals.subtotal,
      vatAmount: totals.vatAmount,
      total: totals.total,
      notes: payload.notes,
      legalMentions: payload.legalMentions,
      showEuroConversion: showEuro,
      euroExchangeRate: showEuro ? Number(payload.euroExchangeRate) : undefined,
      euroBankName: showEuro ? (payload.euroBankName ?? '').trim() : undefined,
      euroRateDate: showEuro ? (payload.euroRateDate || payload.issueDate) : undefined,
      createdByUid: currentUser?.uid ?? 'system',
      createdAt: now,
      updatedAt: now,
    };

    const items: QuoteItem[] = totals.lines.map((l, idx) => ({
      id: l.id || `qi-${Date.now()}-${idx}`,
      quoteId,
      entityId: payload.entityId,
      productId: l.productId,
      label: l.label,
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      vatRate: l.vatRate,
      lineTotal: l.lineTotal,
      orderIndex: idx,
    }));

    if (authMode === 'demo') {
      persistDemoState((prev) => ({
        ...prev,
        quotes: [quote, ...prev.quotes],
        quoteItems: [...prev.quoteItems, ...items],
        numberingCounters: [
          ...prev.numberingCounters.filter((c) => c.id !== nextCounter.id),
          nextCounter,
        ],
      }));
    } else {
      await saveQuoteWithItems(quote, items, true);
    }

    await recordLog(
      quote.entityId,
      'quote_created',
      'contact',
      quote.contactId,
      `Devis ${quote.quoteNumber} créé (${quote.total} ${quote.currency} net).`
    );
    addToast({ type: 'success', title: `Devis ${quote.quoteNumber} créé` });
    return quote;
  };

  const updateQuote = async (quote: Quote, lines: LineInput[]) => {
    const totals = computeDocumentTotals(lines);
    const showEuro = Boolean(
      quote.showEuroConversion && quote.euroExchangeRate && quote.euroExchangeRate > 0
    );
    const updated: Quote = {
      ...quote,
      showEuroConversion: showEuro,
      euroExchangeRate: showEuro ? Number(quote.euroExchangeRate) : undefined,
      euroBankName: showEuro ? (quote.euroBankName ?? '').trim() : undefined,
      euroRateDate: showEuro ? (quote.euroRateDate || quote.issueDate) : undefined,
      subtotal: totals.subtotal,
      vatAmount: totals.vatAmount,
      total: totals.total,
      updatedAt: new Date().toISOString(),
    };
    const items: QuoteItem[] = totals.lines.map((l, idx) => ({
      id: l.id || `qi-${Date.now()}-${idx}`,
      quoteId: quote.id,
      entityId: quote.entityId,
      productId: l.productId,
      label: l.label,
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      vatRate: l.vatRate,
      lineTotal: l.lineTotal,
      orderIndex: idx,
    }));

    if (authMode === 'demo') {
      persistDemoState((prev) => ({
        ...prev,
        quotes: prev.quotes.map((q) => (q.id === updated.id ? updated : q)),
        quoteItems: [
          ...prev.quoteItems.filter((qi) => qi.quoteId !== quote.id),
          ...items,
        ],
      }));
    } else {
      await saveQuoteWithItems(updated, items, false);
    }
    addToast({ type: 'success', title: `Devis ${quote.quoteNumber} enregistré` });
  };

  const updateQuoteStatus = async (quoteId: string, status: QuoteStatus) => {
    const target = quotes.find((q) => q.id === quoteId);
    if (!target) return;
    const now = new Date().toISOString();
    const updated: Quote = {
      ...target,
      status,
      acceptedAt: status === 'Accepté' ? now : target.acceptedAt,
      refusedAt: status === 'Refusé' ? now : target.refusedAt,
      updatedAt: now,
    };
    const items = quoteItems.filter((i) => i.quoteId === quoteId);
    if (authMode === 'demo') {
      persistDemoState((prev) => ({
        ...prev,
        quotes: prev.quotes.map((q) => (q.id === updated.id ? updated : q)),
      }));
    } else {
      await saveQuoteWithItems(updated, items, false);
    }
    await recordLog(
      updated.entityId,
      'quote_status_changed',
      'contact',
      updated.contactId,
      `Devis ${updated.quoteNumber} passé au statut « ${status} ».`
    );
    addToast({ type: 'success', title: `Devis ${updated.quoteNumber} → ${status}` });
  };

  const createInvoice = async (payload: InvoiceInputPayload): Promise<Invoice> => {
    const now = new Date().toISOString();
    const year = Number((payload.issueDate || now).slice(0, 4)) || new Date().getFullYear();
    const { number, nextCounter } = await allocateNumber('FAC', payload.entityId, year);
    const totals = computeInvoiceTotals(payload.lines, {
      invoiceType: payload.invoiceType,
      depositPercentage: payload.depositPercentage,
      deductedDepositAmount: payload.deductedDepositAmount,
    });
    const invoiceId = `inv-${Date.now()}`;
    const hasDeductedDeposit =
      (totals.invoiceType === 'balance' || totals.invoiceType === 'standard') &&
      Boolean(payload.deductedDepositInvoiceId) &&
      totals.deductedDepositAmount > 0;

    const needsValidation = requiresSuperAdminValidation(currentUser);
    const showEuro = Boolean(payload.showEuroConversion && payload.euroExchangeRate && payload.euroExchangeRate > 0);
    const currency = payload.currency || settings.defaultCurrency || 'MGA';

    const invoice: Invoice = {
      id: invoiceId,
      entityId: payload.entityId,
      contactId: payload.contactId,
      companyId: payload.companyId,
      quoteId: payload.quoteId,
      invoiceNumber: number,
      invoiceType: totals.invoiceType,
      depositPercentage:
        totals.invoiceType === 'deposit' || totals.invoiceType === 'balance'
          ? totals.depositPercentage
          : 100,
      deductedDepositInvoiceId: hasDeductedDeposit ? payload.deductedDepositInvoiceId : undefined,
      deductedDepositAmount: hasDeductedDeposit ? totals.deductedDepositAmount : undefined,
      status: needsValidation ? 'Brouillon' : payload.status ?? 'Émise',
      approvalStatus: needsValidation ? 'pending_approval' : 'approved',
      submittedForApprovalAt: needsValidation ? now : undefined,
      submittedByUid: needsValidation ? currentUser?.uid : undefined,
      submittedByName: needsValidation ? currentUser?.displayName : undefined,
      approvedByUid: !needsValidation ? currentUser?.uid : undefined,
      approvedByName: !needsValidation ? currentUser?.displayName : undefined,
      approvedAt: !needsValidation ? now : undefined,
      showEuroConversion: showEuro,
      euroExchangeRate: showEuro ? Number(payload.euroExchangeRate) : undefined,
      euroBankName: showEuro ? (payload.euroBankName ?? '').trim() : undefined,
      euroRateDate: showEuro ? (payload.euroRateDate || payload.issueDate) : undefined,
      issueDate: payload.issueDate,
      dueDate: payload.dueDate,
      currency,
      subtotal: totals.subtotal,
      vatAmount: totals.vatAmount,
      total: totals.total,
      paidAmount: 0,
      remainingAmount: totals.total,
      legalMentions: payload.legalMentions,
      notes: payload.notes,
      createdByUid: currentUser?.uid ?? 'system',
      createdAt: now,
      updatedAt: now,
    };

    const items: InvoiceItem[] = totals.lines.map((l, idx) => ({
      id: `ii-${Date.now()}-${idx}`,
      invoiceId,
      entityId: payload.entityId,
      productId: l.productId,
      label: l.label,
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      vatRate: l.vatRate,
      lineTotal: l.lineTotal,
      orderIndex: idx,
    }));

    if (authMode === 'demo') {
      persistDemoState((prev) => ({
        ...prev,
        invoices: [invoice, ...prev.invoices],
        invoiceItems: [...prev.invoiceItems, ...items],
        numberingCounters: [
          ...prev.numberingCounters.filter((c) => c.id !== nextCounter.id),
          nextCounter,
        ],
      }));
    } else {
      await saveInvoiceWithItems(invoice, items, true);
    }

    const typeSummary =
      totals.invoiceType === 'deposit'
        ? `Acompte ${totals.depositPercentage}%`
        : totals.invoiceType === 'balance' || hasDeductedDeposit
        ? `Solde après déduction acompte (${totals.depositPercentage}%)`
        : 'Standard';
    await recordLog(
      invoice.entityId,
      'invoice_created',
      'contact',
      invoice.contactId,
      `Facture ${invoice.invoiceNumber} (${typeSummary}) créée (${invoice.total} ${invoice.currency} net)${
        needsValidation ? ' — en attente de validation Super Admin' : ''
      }.`
    );

    if (needsValidation && currentUser) {
      const clientCompany = companies.find((c) => c.id === invoice.companyId);
      const clientContact = contacts.find((c) => c.id === invoice.contactId);
      const clientLabel =
        clientCompany?.tradeName || clientCompany?.legalName || clientContact?.fullName || 'Client';
      await emitNotification({
        type: 'invoice_validation_requested',
        entityId: invoice.entityId,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        title: `Validation facture requise : ${invoice.invoiceNumber}`,
        message: `${currentUser.displayName} (Commercial) a généré la facture ${invoice.invoiceNumber} (${formatCurrency(
          invoice.total,
          invoice.currency
        )}) pour ${clientLabel}. Validation Super Admin requise avant envoi client.`,
        actorUid: currentUser.uid,
        actorName: currentUser.displayName,
        recipientRoles: ['super_admin'],
      });
      addToast({
        type: 'info',
        title: `Facture ${invoice.invoiceNumber} soumise à validation`,
        description: 'Les Super Admins ont été notifiés pour validation avant envoi client.',
      });
    } else {
      addToast({ type: 'success', title: `Facture ${invoice.invoiceNumber} créée` });
    }
    return invoice;
  };

  const updateInvoice = async (invoice: Invoice, lines: LineInput[]) => {
    const totals = computeInvoiceTotals(lines, {
      invoiceType: invoice.invoiceType,
      depositPercentage: invoice.depositPercentage,
      deductedDepositAmount: invoice.deductedDepositAmount,
    });
    const hasDeductedDeposit =
      (totals.invoiceType === 'balance' || totals.invoiceType === 'standard') &&
      Boolean(invoice.deductedDepositInvoiceId) &&
      totals.deductedDepositAmount > 0;
    const invPayments = payments.filter((p) => p.invoiceId === invoice.id);
    const isSalesEditor = requiresSuperAdminValidation(currentUser);
    const showEuro = Boolean(
      invoice.showEuroConversion && invoice.euroExchangeRate && invoice.euroExchangeRate > 0
    );
    const now = new Date().toISOString();

    const baseUpdated: Invoice = {
      ...invoice,
      invoiceType: totals.invoiceType,
      depositPercentage:
        totals.invoiceType === 'deposit' || totals.invoiceType === 'balance'
          ? totals.depositPercentage
          : 100,
      deductedDepositInvoiceId: hasDeductedDeposit ? invoice.deductedDepositInvoiceId : undefined,
      deductedDepositAmount: hasDeductedDeposit ? totals.deductedDepositAmount : undefined,
      status: isSalesEditor ? 'Brouillon' : invoice.status,
      approvalStatus: isSalesEditor ? 'pending_approval' : invoice.approvalStatus ?? 'approved',
      submittedForApprovalAt: isSalesEditor ? now : invoice.submittedForApprovalAt,
      submittedByUid: isSalesEditor ? currentUser?.uid : invoice.submittedByUid,
      submittedByName: isSalesEditor ? currentUser?.displayName : invoice.submittedByName,
      rejectedReason: isSalesEditor ? undefined : invoice.rejectedReason,
      showEuroConversion: showEuro,
      euroExchangeRate: showEuro ? Number(invoice.euroExchangeRate) : undefined,
      euroBankName: showEuro ? (invoice.euroBankName ?? '').trim() : undefined,
      euroRateDate: showEuro ? (invoice.euroRateDate || invoice.issueDate) : undefined,
      subtotal: totals.subtotal,
      vatAmount: totals.vatAmount,
      total: totals.total,
      updatedAt: now,
    };
    const updated =
      invPayments.length > 0
        ? recalculateInvoiceWithPayments(baseUpdated, payments, now)
        : { ...baseUpdated, remainingAmount: totals.total };

    const items: InvoiceItem[] = totals.lines.map((l, idx) => ({
      id: l.id || `ii-${Date.now()}-${idx}`,
      invoiceId: invoice.id,
      entityId: invoice.entityId,
      productId: l.productId,
      label: l.label,
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      vatRate: l.vatRate,
      lineTotal: l.lineTotal,
      orderIndex: idx,
    }));

    if (authMode === 'demo') {
      persistDemoState((prev) => ({
        ...prev,
        invoices: prev.invoices.map((i) => (i.id === updated.id ? updated : i)),
        invoiceItems: [
          ...prev.invoiceItems.filter((ii) => ii.invoiceId !== invoice.id),
          ...items,
        ],
      }));
    } else {
      await saveInvoiceWithItems(updated, items, false);
    }

    if (isSalesEditor && currentUser && invoice.approvalStatus === 'rejected') {
      await emitNotification({
        type: 'invoice_validation_requested',
        entityId: updated.entityId,
        invoiceId: updated.id,
        invoiceNumber: updated.invoiceNumber,
        title: `Facture corrigée à valider : ${updated.invoiceNumber}`,
        message: `${currentUser.displayName} (Commercial) a mis à jour la facture ${updated.invoiceNumber} pour nouvelle validation Super Admin.`,
        actorUid: currentUser.uid,
        actorName: currentUser.displayName,
        recipientRoles: ['super_admin'],
      });
    }
    addToast({ type: 'success', title: `Facture ${invoice.invoiceNumber} mise à jour` });
  };

  const approveInvoice = async (invoiceId: string) => {
    if (!canValidateInvoices(currentUser) || !currentUser) {
      addToast({
        type: 'error',
        title: 'Action réservée aux Super Admins',
        description: 'Seul un Super Admin peut valider une facture commerciale.',
      });
      return;
    }
    const target = invoices.find((i) => i.id === invoiceId);
    if (!target) return;

    const now = new Date().toISOString();
    const updated: Invoice = {
      ...target,
      status: target.status === 'Brouillon' ? 'Émise' : target.status,
      approvalStatus: 'approved',
      approvedByUid: currentUser.uid,
      approvedByName: currentUser.displayName,
      approvedAt: now,
      rejectedByUid: undefined,
      rejectedByName: undefined,
      rejectedAt: undefined,
      rejectedReason: undefined,
      updatedAt: now,
    };
    const items = invoiceItems.filter((ii) => ii.invoiceId === invoiceId);

    if (authMode === 'demo') {
      persistDemoState((prev) => ({
        ...prev,
        invoices: prev.invoices.map((i) => (i.id === updated.id ? updated : i)),
      }));
    } else {
      await saveInvoiceWithItems(updated, items, false);
    }

    await recordLog(
      updated.entityId,
      'invoice_approved',
      'contact',
      updated.contactId,
      `Facture ${updated.invoiceNumber} validée par ${currentUser.displayName} (Super Admin).`
    );

    await emitNotification({
      type: 'invoice_validated',
      entityId: updated.entityId,
      invoiceId: updated.id,
      invoiceNumber: updated.invoiceNumber,
      title: `Facture validée : ${updated.invoiceNumber}`,
      message: `La facture ${updated.invoiceNumber} (${formatCurrency(
        updated.total,
        updated.currency
      )}) a été validée par ${currentUser.displayName}. Elle peut désormais être envoyée au client.`,
      actorUid: currentUser.uid,
      actorName: currentUser.displayName,
      recipientRoles: ['sales', 'entity_admin', 'manager', 'super_admin'],
      targetUserUid: updated.createdByUid,
    });

    addToast({
      type: 'success',
      title: `Facture ${updated.invoiceNumber} validée`,
      description: 'Le commercial et l’équipe ont été notifiés. Envoi client débloqué.',
    });
  };

  const rejectInvoice = async (invoiceId: string, reason: string) => {
    if (!canValidateInvoices(currentUser) || !currentUser) {
      addToast({
        type: 'error',
        title: 'Action réservée aux Super Admins',
        description: 'Seul un Super Admin peut refuser une facture.',
      });
      return;
    }
    const target = invoices.find((i) => i.id === invoiceId);
    if (!target) return;

    const cleanReason = reason.trim() || 'Correction requise avant envoi client.';
    const now = new Date().toISOString();
    const updated: Invoice = {
      ...target,
      status: 'Brouillon',
      approvalStatus: 'rejected',
      rejectedByUid: currentUser.uid,
      rejectedByName: currentUser.displayName,
      rejectedAt: now,
      rejectedReason: cleanReason,
      updatedAt: now,
    };
    const items = invoiceItems.filter((ii) => ii.invoiceId === invoiceId);

    if (authMode === 'demo') {
      persistDemoState((prev) => ({
        ...prev,
        invoices: prev.invoices.map((i) => (i.id === updated.id ? updated : i)),
      }));
    } else {
      await saveInvoiceWithItems(updated, items, false);
    }

    await recordLog(
      updated.entityId,
      'invoice_rejected',
      'contact',
      updated.contactId,
      `Facture ${updated.invoiceNumber} refusée par ${currentUser.displayName} : ${cleanReason}`
    );

    await emitNotification({
      type: 'invoice_rejected',
      entityId: updated.entityId,
      invoiceId: updated.id,
      invoiceNumber: updated.invoiceNumber,
      title: `Facture à corriger : ${updated.invoiceNumber}`,
      message: `${currentUser.displayName} a demandé une correction sur ${updated.invoiceNumber} : « ${cleanReason} ».`,
      actorUid: currentUser.uid,
      actorName: currentUser.displayName,
      recipientRoles: ['sales', 'entity_admin', 'manager', 'super_admin'],
      targetUserUid: updated.createdByUid,
    });

    addToast({
      type: 'info',
      title: `Facture ${updated.invoiceNumber} refusée`,
      description: 'Le commercial et l’équipe ont été notifiés.',
    });
  };

  const convertQuoteToInvoice = async (quoteId: string): Promise<Invoice | null> => {
    const quote = quotes.find((q) => q.id === quoteId);
    if (!quote) return null;
    const items = quoteItems.filter((qi) => qi.quoteId === quoteId);
    const today = new Date().toISOString().slice(0, 10);
    const dueDate = addDaysToDateIso(today, 30);

    const createdInvoice = await createInvoice({
      entityId: quote.entityId,
      contactId: quote.contactId,
      companyId: quote.companyId,
      quoteId: quote.id,
      issueDate: today,
      dueDate,
      currency: quote.currency,
      showEuroConversion: quote.showEuroConversion,
      euroExchangeRate: quote.euroExchangeRate,
      euroBankName: quote.euroBankName,
      euroRateDate: quote.euroRateDate,
      notes: quote.notes || `Facture issue du devis ${quote.quoteNumber}.`,
      legalMentions: quote.legalMentions,
      status: 'Émise',
      lines: items.map((i, idx) => ({
        id: `ii-conv-${Date.now()}-${idx}`,
        productId: i.productId,
        label: i.label,
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        vatRate: i.vatRate,
        orderIndex: i.orderIndex,
      })),
    });

    const updatedQuote: Quote = {
      ...quote,
      status: 'Converti en facture',
      convertedInvoiceId: createdInvoice.id,
      updatedAt: new Date().toISOString(),
    };

    if (authMode === 'demo') {
      persistDemoState((prev) => ({
        ...prev,
        quotes: prev.quotes.map((q) => (q.id === updatedQuote.id ? updatedQuote : q)),
      }));
    } else {
      await saveQuoteWithItems(updatedQuote, items, false);
    }

    addToast({
      type: 'success',
      title: 'Devis converti en facture',
      description: `${quote.quoteNumber} → ${createdInvoice.invoiceNumber}`,
    });
    return createdInvoice;
  };

  const recordPayment = async (payload: PaymentInputPayload): Promise<Payment | null> => {
    const invoice = invoices.find((i) => i.id === payload.invoiceId);
    if (!invoice) return null;

    const payment: Payment = {
      id: `pay-${Date.now()}`,
      invoiceId: invoice.id,
      entityId: invoice.entityId,
      amount: Math.max(0, Number(payload.amount) || 0),
      paymentDate: payload.paymentDate,
      paymentMethod: payload.paymentMethod,
      reference: payload.reference.trim(),
      recordedByUid: currentUser?.uid ?? 'system',
      notes: payload.notes.trim(),
      createdAt: new Date().toISOString(),
    };

    const nextPayments = [payment, ...payments];
    const updatedInvoice = recalculateInvoiceWithPayments(
      invoice,
      nextPayments,
      new Date().toISOString()
    );

    if (authMode === 'demo') {
      persistDemoState((prev) => ({
        ...prev,
        payments: [payment, ...prev.payments],
        invoices: prev.invoices.map((i) =>
          i.id === updatedInvoice.id ? updatedInvoice : i
        ),
      }));
    } else {
      await recordPaymentAndUpdateInvoice(payment, updatedInvoice);
    }

    await recordLog(
      invoice.entityId,
      'payment_recorded',
      'contact',
      invoice.contactId,
      `Paiement de ${payment.amount} ${invoice.currency} enregistré sur ${invoice.invoiceNumber} (${updatedInvoice.status}).`
    );
    addToast({
      type: 'success',
      title: 'Paiement enregistré',
      description: `${invoice.invoiceNumber} → ${updatedInvoice.status}`,
    });
    return payment;
  };

  // --- Complaints, Service Requests, Satisfaction, Integrations, Legal, Settings ---
  const saveComplaint = async (complaint: Complaint, isNew: boolean) => {
    const now = new Date().toISOString();
    const payload: Complaint = {
      ...complaint,
      resolvedAt:
        complaint.status === 'Résolue' || complaint.status === 'Clôturée'
          ? complaint.resolvedAt || now
          : undefined,
      updatedAt: now,
      createdAt: isNew ? now : complaint.createdAt,
    };
    if (authMode === 'demo') {
      persistDemoState((prev) => ({
        ...prev,
        complaints: isNew
          ? [payload, ...prev.complaints]
          : prev.complaints.map((c) => (c.id === payload.id ? payload : c)),
      }));
    } else {
      await saveComplaintDoc(payload, isNew);
    }
    await recordLog(
      payload.entityId,
      isNew ? 'complaint_created' : 'complaint_updated',
      'contact',
      payload.contactId,
      `Réclamation « ${payload.subject} » (${payload.status}).`
    );
    addToast({ type: 'success', title: isNew ? 'Réclamation enregistrée' : 'Réclamation mise à jour' });
  };

  const saveServiceRequest = async (sr: ServiceRequest, isNew: boolean) => {
    const now = new Date().toISOString();
    const payload = { ...sr, updatedAt: now, createdAt: isNew ? now : sr.createdAt };
    if (authMode === 'demo') {
      persistDemoState((prev) => ({
        ...prev,
        serviceRequests: isNew
          ? [payload, ...prev.serviceRequests]
          : prev.serviceRequests.map((s) => (s.id === payload.id ? payload : s)),
      }));
    } else {
      await saveServiceRequestDoc(payload, isNew);
    }
    addToast({ type: 'success', title: 'Demande de service enregistrée' });
  };

  const saveSatisfactionSurvey = async (survey: SatisfactionSurvey, isNew: boolean) => {
    const now = new Date().toISOString();
    const payload = { ...survey, createdAt: isNew ? now : survey.createdAt };
    if (authMode === 'demo') {
      persistDemoState((prev) => ({
        ...prev,
        satisfactionSurveys: isNew
          ? [payload, ...prev.satisfactionSurveys]
          : prev.satisfactionSurveys.map((s) => (s.id === payload.id ? payload : s)),
      }));
    } else {
      await saveSatisfactionSurveyDoc(payload, isNew);
    }
    addToast({ type: 'success', title: 'Évaluation de satisfaction enregistrée' });
  };

  const assertSuperAdminSettings = (): boolean => {
    if (canManageSettings(currentUser)) return true;
    addToast({
      type: 'error',
      title: 'Accès réservé aux Super Admins',
      description: 'Seul un Super Admin peut modifier les paramètres.',
    });
    return false;
  };

  const saveIntegration = async (integration: IntegrationSetting, isNew: boolean) => {
    if (!assertSuperAdminSettings()) return;
    const payload = { ...integration, updatedAt: new Date().toISOString() };
    if (authMode === 'demo') {
      persistDemoState((prev) => ({
        ...prev,
        integrations: isNew
          ? [...prev.integrations, payload]
          : prev.integrations.map((i) => (i.id === payload.id ? payload : i)),
      }));
    } else {
      await saveIntegrationDoc(payload, isNew);
    }
    addToast({ type: 'success', title: 'Configuration d’intégration enregistrée' });
  };

  const saveLegalSetting = async (legal: LegalSetting, isNew: boolean) => {
    if (!assertSuperAdminSettings()) return;
    const payload = { ...legal, updatedAt: new Date().toISOString() };
    if (authMode === 'demo') {
      persistDemoState((prev) => ({
        ...prev,
        legalSettings: isNew
          ? [...prev.legalSettings, payload]
          : prev.legalSettings.map((l) => (l.id === payload.id ? payload : l)),
      }));
    } else {
      await saveLegalSettingDoc(payload, isNew);
    }
    addToast({ type: 'success', title: 'Mentions légales enregistrées' });
  };

  const saveEntity = async (entity: CrmEntity, isNew: boolean) => {
    if (!assertSuperAdminSettings()) return;
    const now = new Date().toISOString();
    const payload: CrmEntity = {
      ...entity,
      slug: (entity.slug || entity.id).trim() || entity.id,
      name: entity.name.trim(),
      description: (entity.description ?? '').trim(),
      color: (entity.color || '#19283E').trim(),
      logoUrl: (entity.logoUrl ?? '').trim(),
      active: Boolean(entity.active),
      updatedAt: now,
      createdAt: isNew ? now : entity.createdAt,
    };
    if (authMode === 'demo') {
      persistDemoState((prev) => ({
        ...prev,
        entities: isNew
          ? [...prev.entities, payload]
          : prev.entities.map((e) => (e.id === payload.id ? payload : e)),
      }));
    } else {
      await saveEntityDoc(payload, isNew);
    }
    addToast({ type: 'success', title: isNew ? 'Entité créée' : 'Entité mise à jour' });
  };

  const saveUser = async (user: UserProfile) => {
    if (!assertSuperAdminSettings()) return;
    const syncedEntityIds =
      user.role === 'super_admin'
        ? Array.from(new Set([...entities.map((e) => e.id), ...(user.entityIds || [])])).slice(0, 10)
        : user.entityIds;
    const updated: UserProfile = {
      ...user,
      entityIds: syncedEntityIds,
      updatedAt: new Date().toISOString(),
    };
    if (authMode === 'demo') {
      persistDemoState((prev) => ({
        ...prev,
        users: prev.users.map((u) => (u.uid === updated.uid ? updated : u)),
      }));
    } else {
      await updateUserDoc(updated);
    }
    addToast({ type: 'success', title: 'Rôle et accès enregistrés', description: user.displayName });
  };

  const createManagedUser = async (payload: CreateManagedUserPayload): Promise<UserProfile> => {
    if (!canManageSettings(currentUser)) {
      throw new Error('Seul un Super Admin peut ajouter un utilisateur.');
    }
    const cleanEmail = payload.email.trim().toLowerCase();
    const cleanName = payload.displayName.trim();
    if (!cleanName) throw new Error('Le nom complet est obligatoire.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new Error("L'adresse email est invalide.");
    }
    if (authMode === 'firebase' && payload.password.length < 6) {
      throw new Error('Le mot de passe doit contenir au moins 6 caractères.');
    }
    if (users.some((u) => u.email.trim().toLowerCase() === cleanEmail)) {
      throw new Error('Un utilisateur avec cette adresse email existe déjà.');
    }

    const assignedEntities =
      payload.role === 'super_admin'
        ? entities.map((e) => e.id)
        : payload.entityIds;

    let uid = `u-demo-${Date.now()}`;
    if (authMode === 'firebase') {
      try {
        const created = await createAuthUserAsAdmin(cleanEmail, payload.password, cleanName);
        uid = created.uid;
      } catch (err) {
        const code = (err as { code?: string })?.code ?? '';
        if (code === 'auth/email-already-in-use') {
          throw new Error('Cette adresse email est déjà enregistrée dans Firebase Auth.');
        }
        if (code === 'auth/weak-password') {
          throw new Error('Mot de passe trop faible (6 caractères minimum).');
        }
        if (code === 'auth/invalid-email') {
          throw new Error('Adresse email invalide.');
        }
        throw err instanceof Error ? err : new Error("Impossible de créer le compte utilisateur.");
      }
    }

    const now = new Date().toISOString();
    const newUser: UserProfile = {
      uid,
      email: cleanEmail,
      displayName: cleanName,
      role: payload.role,
      entityIds: assignedEntities,
      active: true,
      createdAt: now,
      updatedAt: now,
    };

    if (authMode === 'demo') {
      persistDemoState((prev) => ({
        ...prev,
        users: [newUser, ...prev.users],
      }));
    } else {
      await createUserDoc(newUser);
    }

    await recordLog(
      defaultEntityScopeId(),
      'user_created',
      'user',
      newUser.uid,
      `Utilisateur ajouté : ${newUser.displayName} (${newUser.email}, ${newUser.role}).`
    );
    addToast({
      type: 'success',
      title: 'Utilisateur ajouté',
      description: `${newUser.displayName} (${newUser.email})`,
    });
    return newUser;
  };

  const deleteUser = async (uid: string) => {
    const target = users.find((u) => u.uid === uid);
    if (!target || !canDeleteUserAccount(currentUser, target)) {
      addToast({
        type: 'error',
        title: 'Suppression refusée',
        description: 'Action réservée aux Super Admins (auto-suppression impossible).',
      });
      return;
    }
    if (authMode === 'demo') {
      persistDemoState((prev) => ({
        ...prev,
        users: prev.users.filter((u) => u.uid !== uid),
      }));
    } else {
      await deleteUserDoc(uid);
    }
    await recordLog(
      defaultEntityScopeId(),
      'user_deleted',
      'user',
      uid,
      `Utilisateur supprimé : ${target.displayName} (${target.email}).`
    );
    addToast({
      type: 'info',
      title: 'Utilisateur supprimé',
      description: target.displayName,
    });
  };

  const saveTag = async (tag: CrmTag, isNew: boolean) => {
    if (!assertSuperAdminSettings()) return;
    const now = new Date().toISOString();
    const payload = { ...tag, updatedAt: now, createdAt: isNew ? now : tag.createdAt };
    if (authMode === 'demo') {
      persistDemoState((prev) => ({
        ...prev,
        tags: isNew
          ? [...prev.tags, payload]
          : prev.tags.map((t) => (t.id === payload.id ? payload : t)),
      }));
    } else {
      await saveTagDoc(payload, isNew);
    }
    addToast({ type: 'success', title: isNew ? 'Tag créé' : 'Tag mis à jour' });
  };

  const deleteTag = async (tagId: string) => {
    if (!assertSuperAdminSettings()) return;
    const target = tags.find((t) => t.id === tagId);
    if (authMode === 'demo') {
      persistDemoState((prev) => ({
        ...prev,
        tags: prev.tags.filter((t) => t.id !== tagId),
      }));
    } else {
      await deleteTagDoc(tagId);
    }
    addToast({
      type: 'info',
      title: 'Tag supprimé',
      description: target?.name,
    });
  };

  const saveSettings = async (nextSettings: CrmSettings) => {
    if (!assertSuperAdminSettings()) return;
    const updated = {
      ...nextSettings,
      updatedByUid: currentUser?.uid ?? 'system',
      updatedAt: new Date().toISOString(),
    };
    setActiveDefaultCurrency(updated.defaultCurrency);
    if (authMode === 'demo') {
      persistDemoState((prev) => ({ ...prev, settings: updated }));
    } else {
      setSettings(updated);
      await saveSettingsDoc(updated);
    }
    addToast({ type: 'success', title: 'Préférences enregistrées' });
  };

  const seedFirestore = async () => {
    if (!assertSuperAdminSettings()) return;
    if (authMode === 'demo') {
      const fresh = createInitialDemoState();
      localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(fresh));
      applyDemoSnapshot(fresh);
      addToast({ type: 'success', title: 'Données de démonstration réinitialisées' });
      return;
    }
    if (!currentUser) return;
    try {
      await seedFirestoreDatabase(currentUser.uid);
      addToast({
        type: 'success',
        title: 'Base Firestore initialisée',
        description: 'Les 4 entités, contacts, devis, factures et pipelines ont été créés.',
      });
    } catch (error) {
      console.error('Erreur initialisation Firestore:', error);
      addToast({
        type: 'error',
        title: 'Erreur lors de l’initialisation Firestore',
        description:
          error instanceof Error
            ? error.message
            : 'Vérifiez vos droits Super Admin et que votre email est vérifié.',
      });
      throw error;
    }
  };

  return (
    <CrmContext.Provider
      value={{
        authMode,
        firebaseAvailable: isFirebaseConfigured,
        firestoreOffline,
        authConnectionError,
        retryFirebaseConnection,
        currentUser,
        selectedEntityId,
        setSelectedEntityId,
        globalSearch,
        setGlobalSearch,
        entities,
        authorizedEntities,
        users,
        companies,
        contacts,
        products,
        prospects,
        scopedProspects,
        leads,
        scopedLeads,
        sequences,
        scopedSequences,
        sequenceSteps,
        sequenceEnrollments,
        scopedEnrollments,
        actions,
        scopedActions,
        deals,
        scopedDeals,
        pipelines,
        stages,
        tags,
        quotes,
        scopedQuotes,
        quoteItems,
        invoices,
        scopedInvoices,
        invoiceItems,
        payments,
        scopedPayments,
        complaints,
        scopedComplaints,
        serviceRequests,
        scopedServiceRequests,
        satisfactionSurveys,
        scopedSurveys,
        integrations,
        numberingCounters,
        legalSettings,
        auditLogs,
        notifications,
        visibleNotifications,
        unreadNotificationCount,
        settings,
        toasts,
        addToast,
        dismissToast,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        loginWithEmail,
        loginWithGoogle,
        pendingVerificationEmail,
        resendVerificationEmail,
        refreshVerificationStatus,
        enterDemoMode,
        switchDemoUser,
        logout,
        createCompany,
        updateCompany,
        mergeCompanies,
        createContact,
        updateContact,
        mergeContacts,
        createProspect,
        updateProspect,
        archiveProspect,
        deleteProspect,
        createLead,
        updateLead,
        convertLeadToOpportunity,
        createSequence,
        updateSequence,
        saveSequenceStep,
        enrollLeadInSequence,
        advanceSequenceStep,
        updateEnrollmentStatus,
        createAction,
        updateAction,
        completeAction,
        rescheduleAction,
        cancelAction,
        logCommunicationAction,
        createDeal,
        updateDeal,
        moveDealToStage,
        saveProduct,
        deleteProduct,
        createQuote,
        updateQuote,
        updateQuoteStatus,
        convertQuoteToInvoice,
        createInvoice,
        updateInvoice,
        approveInvoice,
        rejectInvoice,
        recordPayment,
        saveComplaint,
        saveServiceRequest,
        saveSatisfactionSurvey,
        saveIntegration,
        saveLegalSetting,
        saveEntity,
        saveUser,
        createManagedUser,
        deleteUser,
        saveTag,
        deleteTag,
        saveSettings,
        seedFirestore,
      }}
    >
      {children}
    </CrmContext.Provider>
  );
}

export function useCrm(): CrmContextValue {
  const ctx = useContext(CrmContext);
  if (!ctx) {
    throw new Error('useCrm doit être utilisé dans un CrmProvider.');
  }
  return ctx;
}
