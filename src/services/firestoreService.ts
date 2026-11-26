import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type QueryConstraint,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  db,
  handleFirestoreError,
  OperationType,
  recoverFirestoreNetwork,
} from '../firebase';
import { isFirestoreOfflineError } from '../utils/firebaseErrors';
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
  Lead,
  LegalSetting,
  NumberingCounter,
  Payment,
  Pipeline,
  PipelineStage,
  Product,
  Prospect,
  Quote,
  QuoteItem,
  SatisfactionSurvey,
  SequenceEnrollment,
  SequenceStep,
  ServiceRequest,
  UserProfile,
} from '../types';
import {
  DEFAULT_ENTITIES,
  DEFAULT_INTEGRATIONS,
  DEFAULT_LEGAL_SETTINGS,
  DEFAULT_NUMBERING_COUNTERS,
  DEFAULT_PIPELINES,
  DEFAULT_PIPELINE_STAGES,
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
} from './seedData';
import { formatDocumentNumber } from '../utils/billingLogic';
import {
  normalizeProductForWrite,
  resolveBootstrappedUserProfile,
  sanitizeUserProfileForWrite,
} from '../utils/crmLogic';

function toIsoString(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return String(value);
}

function normalizeDoc<T>(id: string, data: Record<string, unknown>): T {
  const result: Record<string, unknown> = { ...data, id };
  for (const key of ['createdAt', 'updatedAt', 'lastActivityAt']) {
    if (key in result && result[key]) {
      result[key] = toIsoString(result[key]);
    }
  }
  return result as T;
}

export class FirestoreConnectionError extends Error {
  constructor(message = 'Cloud Firestore temporairement inaccessible (mode hors ligne).') {
    super(message);
    this.name = 'FirestoreConnectionError';
  }
}

export async function ensureUserProfile(
  uid: string,
  email: string,
  displayName: string
): Promise<UserProfile> {
  if (!db) throw new Error('Firestore non initialisé.');
  const userRef = doc(db, 'users', uid);
  const allEntityIds = DEFAULT_ENTITIES.map((e) => e.id);
  try {
    let snap;
    try {
      snap = await getDoc(userRef);
    } catch (readError) {
      if (!isFirestoreOfflineError(readError)) {
        throw readError;
      }
      await recoverFirestoreNetwork();
      await new Promise((resolve) => setTimeout(resolve, 600));
      snap = await getDoc(userRef);
    }

    const existing = snap.exists()
      ? normalizeDoc<UserProfile>(snap.id, snap.data())
      : null;
    const resolved = resolveBootstrappedUserProfile(
      uid,
      email,
      displayName,
      existing,
      allEntityIds
    );

    if (resolved.needsCreate) {
      const profilePayload = {
        uid: resolved.profile.uid,
        email: resolved.profile.email,
        displayName: resolved.profile.displayName,
        role: resolved.profile.role,
        entityIds: resolved.profile.entityIds,
        active: resolved.profile.active,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(userRef, profilePayload);
      const createdSnap = await getDoc(userRef);
      return normalizeDoc<UserProfile>(createdSnap.id, createdSnap.data() ?? {});
    }

    if (resolved.needsUpdate) {
      try {
        await updateDoc(userRef, {
          role: resolved.profile.role,
          entityIds: resolved.profile.entityIds,
          active: resolved.profile.active,
          updatedAt: serverTimestamp(),
        });
        const updatedSnap = await getDoc(userRef);
        if (updatedSnap.exists()) {
          return normalizeDoc<UserProfile>(updatedSnap.id, updatedSnap.data());
        }
      } catch (syncError) {
        console.warn(
          'Impossible de mettre à jour le document users/{uid} existant, utilisation du profil Super Admin résolu :',
          syncError
        );
      }
    }

    return resolved.profile;
  } catch (error) {
    if (isFirestoreOfflineError(error)) {
      throw new FirestoreConnectionError(
        'Cloud Firestore est temporairement inaccessible (client hors ligne ou délai dépassé).'
      );
    }
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
  }
}

export function subscribeToCollection<T>(
  collectionName: string,
  constraints: QueryConstraint[],
  onData: (items: T[]) => void,
  onError?: (error: unknown) => void
): Unsubscribe {
  if (!db) return () => {};
  const q = query(collection(db, collectionName), ...constraints);
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) =>
        normalizeDoc<T>(d.id, d.data() as Record<string, unknown>)
      );
      onData(items);
    },
    (error) => {
      if (isFirestoreOfflineError(error)) {
        console.warn(`Firestore hors ligne lors de l'écoute de ${collectionName}.`);
        return;
      }
      if (onError) {
        onError(error);
        return;
      }
      handleFirestoreError(error, OperationType.LIST, collectionName);
    }
  );
}

export function buildEntityConstraints(
  field: string,
  user: UserProfile,
  selectedEntityId: EntityScope
): QueryConstraint[] {
  if (selectedEntityId !== 'all') {
    return [where(field, '==', selectedEntityId)];
  }
  if (user.role === 'super_admin') {
    return [];
  }
  if (user.entityIds.length > 0) {
    return [where(field, 'in', user.entityIds.slice(0, 10))];
  }
  return [where(field, '==', '__none__')];
}

async function saveStandardDoc<T extends { id: string }>(
  collectionName: string,
  record: T | (Record<string, unknown> & { id: string }),
  isNew: boolean,
  hasCreatedAt = true
): Promise<void> {
  if (!db) throw new Error('Firestore non initialisé.');
  const ref = doc(db, collectionName, record.id);
  const clean: Record<string, unknown> = { ...record };
  delete clean.createdAt;
  delete clean.updatedAt;
  delete clean.lastActivityAt;
  for (const key of Object.keys(clean)) {
    if (clean[key] === undefined) delete clean[key];
  }
  let effectiveOp: OperationType = isNew ? OperationType.CREATE : OperationType.UPDATE;
  try {
    let shouldCreate = isNew;
    if (!shouldCreate) {
      const existingSnap = await getDoc(ref);
      if (!existingSnap.exists()) {
        shouldCreate = true;
        effectiveOp = OperationType.CREATE;
      }
    }
    if (shouldCreate) {
      await setDoc(ref, {
        ...clean,
        ...(hasCreatedAt ? { createdAt: serverTimestamp() } : {}),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        ...clean,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(
      error,
      effectiveOp,
      `${collectionName}/${record.id}`
    );
  }
}

export async function deleteCollectionDoc(
  collectionName: string,
  id: string
): Promise<void> {
  if (!db) throw new Error('Firestore non initialisé.');
  try {
    await deleteDoc(doc(db, collectionName, id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${collectionName}/${id}`);
  }
}

// --- Shared Companies & Contacts ---
export const saveCompanyDoc = (company: Company, isNew: boolean) =>
  saveStandardDoc('companies', company, isNew);

export const saveContactDoc = (contact: Contact, isNew: boolean) =>
  saveStandardDoc(
    'contacts',
    {
      ...contact,
      cin: (contact.cin ?? '').trim(),
    },
    isNew
  );

export const saveLeadDoc = (lead: Lead, isNew: boolean) =>
  saveStandardDoc('leads', lead, isNew);

export const saveSequenceDoc = (seq: FollowUpSequence, isNew: boolean) =>
  saveStandardDoc('sequences', seq, isNew);

export async function saveSequenceStepDoc(step: SequenceStep, isNew: boolean): Promise<void> {
  if (!db) throw new Error('Firestore non initialisé.');
  const ref = doc(db, 'sequenceSteps', step.id);
  const clean: Record<string, unknown> = { ...step };
  for (const k of Object.keys(clean)) {
    if (clean[k] === undefined) delete clean[k];
  }
  try {
    if (isNew) {
      await setDoc(ref, clean);
    } else {
      await updateDoc(ref, clean);
    }
  } catch (error) {
    handleFirestoreError(
      error,
      isNew ? OperationType.CREATE : OperationType.UPDATE,
      `sequenceSteps/${step.id}`
    );
  }
}

export const saveSequenceEnrollmentDoc = (enr: SequenceEnrollment, isNew: boolean) =>
  saveStandardDoc('sequenceEnrollments', enr, isNew, false);

async function seedMissingCollectionDefaults<T extends { id: string }>(
  collectionName: string,
  defaults: T[],
  excludeId: string,
  mapPayload: (item: T) => Record<string, unknown>
): Promise<void> {
  if (!db) return;
  const database = db;
  try {
    const existingIds = await getExistingDocIds(collectionName);
    const missingDefaults = defaults.filter(
      (def) => def.id !== excludeId && !existingIds.has(def.id)
    );
    if (missingDefaults.length === 0) return;
    const batch = writeBatch(database);
    for (const def of missingDefaults) {
      batch.set(doc(database, collectionName, def.id), mapPayload(def));
    }
    await batch.commit();
  } catch {
    // Non bloquant : l'opération principale a déjà été exécutée
  }
}

export async function saveProductDoc(product: Product, isNew: boolean): Promise<void> {
  const payload = normalizeProductForWrite(product);
  await saveStandardDoc('products', payload, isNew);
  await seedMissingCollectionDefaults('products', DEMO_PRODUCTS, product.id, (def) => {
    const clean = normalizeProductForWrite(def);
    delete clean.createdAt;
    delete clean.updatedAt;
    return {
      ...clean,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
  });
}

export async function deleteProductDoc(productId: string): Promise<void> {
  await seedMissingCollectionDefaults('products', DEMO_PRODUCTS, productId, (def) => {
    const clean = normalizeProductForWrite(def);
    delete clean.createdAt;
    delete clean.updatedAt;
    return {
      ...clean,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
  });
  await deleteCollectionDoc('products', productId);
}

export const saveComplaintDoc = (complaint: Complaint, isNew: boolean) =>
  saveStandardDoc('complaints', complaint, isNew);

export const saveServiceRequestDoc = (sr: ServiceRequest, isNew: boolean) =>
  saveStandardDoc('serviceRequests', sr, isNew);

export async function saveSatisfactionSurveyDoc(
  survey: SatisfactionSurvey,
  isNew: boolean
): Promise<void> {
  if (!db) throw new Error('Firestore non initialisé.');
  const ref = doc(db, 'satisfactionSurveys', survey.id);
  const clean: Record<string, unknown> = { ...survey };
  delete clean.createdAt;
  for (const k of Object.keys(clean)) {
    if (clean[k] === undefined) delete clean[k];
  }
  try {
    if (isNew) {
      await setDoc(ref, { ...clean, createdAt: serverTimestamp() });
    } else {
      await updateDoc(ref, clean);
    }
  } catch (error) {
    handleFirestoreError(
      error,
      isNew ? OperationType.CREATE : OperationType.UPDATE,
      `satisfactionSurveys/${survey.id}`
    );
  }
}

export const saveIntegrationDoc = (integration: IntegrationSetting, isNew: boolean) =>
  saveStandardDoc('integrations', integration, isNew, false);

export const saveLegalSettingDoc = (legal: LegalSetting, isNew: boolean) =>
  saveStandardDoc('legalSettings', legal, isNew, false);

// --- Transactional unique document number allocation (DEV / FAC) ---
export async function allocateDocumentNumberFirestore(
  prefix: 'DEV' | 'FAC',
  entityId: string,
  entityCode: string,
  year: number
): Promise<string> {
  if (!db) throw new Error('Firestore non initialisé.');
  const counterId = `${prefix}-${entityCode}-${year}`;
  const counterRef = doc(db, 'numberingCounters', counterId);
  try {
    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(counterRef);
      const currentSeq = snap.exists() ? Number(snap.data().lastSequence || 0) : 0;
      const nextSeq = currentSeq + 1;
      tx.set(counterRef, {
        id: counterId,
        prefix,
        entityId,
        entityCode,
        year,
        lastSequence: nextSeq,
        updatedAt: serverTimestamp(),
      });
      return formatDocumentNumber(prefix, entityCode, year, nextSeq);
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `numberingCounters/${counterId}`);
  }
}

// --- Quotes, Invoices & Payments ---
export async function saveQuoteWithItems(
  quote: Quote,
  items: QuoteItem[],
  isNew: boolean
): Promise<void> {
  if (!db) throw new Error('Firestore non initialisé.');
  try {
    const batch = writeBatch(db);
    const quoteRef = doc(db, 'quotes', quote.id);
    const cleanQuote: Record<string, unknown> = { ...quote };
    delete cleanQuote.createdAt;
    delete cleanQuote.updatedAt;
    for (const k of Object.keys(cleanQuote)) {
      if (cleanQuote[k] === undefined) delete cleanQuote[k];
    }
    if (isNew) {
      batch.set(quoteRef, {
        ...cleanQuote,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.update(quoteRef, {
        ...cleanQuote,
        updatedAt: serverTimestamp(),
      });
    }
    for (const item of items) {
      const cleanItem: Record<string, unknown> = { ...item };
      for (const k of Object.keys(cleanItem)) {
        if (cleanItem[k] === undefined) delete cleanItem[k];
      }
      batch.set(doc(db, 'quoteItems', item.id), cleanItem);
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      isNew ? OperationType.CREATE : OperationType.UPDATE,
      `quotes/${quote.id}`
    );
  }
}

export async function saveInvoiceWithItems(
  invoice: Invoice,
  items: InvoiceItem[],
  isNew: boolean
): Promise<void> {
  if (!db) throw new Error('Firestore non initialisé.');
  try {
    const batch = writeBatch(db);
    const invRef = doc(db, 'invoices', invoice.id);
    const cleanInv: Record<string, unknown> = { ...invoice };
    delete cleanInv.createdAt;
    delete cleanInv.updatedAt;
    for (const k of Object.keys(cleanInv)) {
      if (cleanInv[k] === undefined) delete cleanInv[k];
    }
    if (isNew) {
      batch.set(invRef, {
        ...cleanInv,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.update(invRef, {
        ...cleanInv,
        updatedAt: serverTimestamp(),
      });
    }
    for (const item of items) {
      const cleanItem: Record<string, unknown> = { ...item };
      for (const k of Object.keys(cleanItem)) {
        if (cleanItem[k] === undefined) delete cleanItem[k];
      }
      batch.set(doc(db, 'invoiceItems', item.id), cleanItem);
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      isNew ? OperationType.CREATE : OperationType.UPDATE,
      `invoices/${invoice.id}`
    );
  }
}

export async function recordPaymentAndUpdateInvoice(
  payment: Payment,
  updatedInvoice: Invoice
): Promise<void> {
  if (!db) throw new Error('Firestore non initialisé.');
  try {
    const batch = writeBatch(db);
    const payRef = doc(db, 'payments', payment.id);
    const cleanPay: Record<string, unknown> = { ...payment };
    delete cleanPay.createdAt;
    batch.set(payRef, {
      ...cleanPay,
      createdAt: serverTimestamp(),
    });
    const invRef = doc(db, 'invoices', updatedInvoice.id);
    batch.update(invRef, {
      paidAmount: updatedInvoice.paidAmount,
      remainingAmount: updatedInvoice.remainingAmount,
      status: updatedInvoice.status,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `payments/${payment.id}`);
  }
}

// --- Existing Prospect, Action, Deal, Entity, User, Tag, Settings, AuditLog ---
export async function saveProspectDoc(
  prospect: Prospect,
  isNew: boolean
): Promise<void> {
  if (!db) throw new Error('Firestore non initialisé.');
  const ref = doc(db, 'prospects', prospect.id);
  const clean: Record<string, unknown> = { ...prospect };
  delete clean.createdAt;
  delete clean.updatedAt;
  delete clean.lastActivityAt;
  for (const k of Object.keys(clean)) {
    if (clean[k] === undefined) delete clean[k];
  }
  try {
    if (isNew) {
      await setDoc(ref, {
        ...clean,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastActivityAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        ...clean,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(
      error,
      isNew ? OperationType.CREATE : OperationType.UPDATE,
      `prospects/${prospect.id}`
    );
  }
}

export async function deleteProspectDoc(prospectId: string): Promise<void> {
  return deleteCollectionDoc('prospects', prospectId);
}

export async function saveActionDoc(
  action: CrmAction,
  isNew: boolean,
  updateProspectLastActivity = false
): Promise<void> {
  if (!db) throw new Error('Firestore non initialisé.');
  const actionRef = doc(db, 'actions', action.id);
  const clean: Record<string, unknown> = { ...action };
  delete clean.createdAt;
  delete clean.updatedAt;
  for (const k of Object.keys(clean)) {
    if (clean[k] === undefined) delete clean[k];
  }
  try {
    const batch = writeBatch(db);
    if (isNew) {
      batch.set(actionRef, {
        ...clean,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.update(actionRef, {
        ...clean,
        updatedAt: serverTimestamp(),
      });
    }
    if (updateProspectLastActivity && action.prospectId) {
      const prospectRef = doc(db, 'prospects', action.prospectId);
      batch.update(prospectRef, {
        lastActivityAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      isNew ? OperationType.CREATE : OperationType.UPDATE,
      `actions/${action.id}`
    );
  }
}

export const saveDealDoc = (deal: Deal, isNew: boolean) =>
  saveStandardDoc('opportunities', deal, isNew);

export async function saveEntityDoc(entity: CrmEntity, isNew: boolean): Promise<void> {
  const normalized: CrmEntity = {
    ...entity,
    slug: (entity.slug || entity.id).trim() || entity.id,
    name: entity.name.trim(),
    description: (entity.description ?? '').trim(),
    color: (entity.color || '#19283E').trim(),
    logoUrl: (entity.logoUrl ?? '').trim(),
    active: Boolean(entity.active),
  };
  await saveStandardDoc('entities', normalized, isNew);

  // Si la collection entities vient d'être initialisée via l'édition d'une entité par défaut,
  // crée aussi les autres entités par défaut manquantes pour qu'elles restent visibles.
  if (db) {
    try {
      const existingIds = await getExistingDocIds('entities');
      const missingDefaults = DEFAULT_ENTITIES.filter(
        (def) => def.id !== normalized.id && !existingIds.has(def.id)
      );
      if (missingDefaults.length > 0) {
        const batch = writeBatch(db);
        for (const def of missingDefaults) {
          const { createdAt: _c, updatedAt: _u, ...rest } = def;
          batch.set(doc(db, 'entities', def.id), {
            ...rest,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        await batch.commit();
      }
    } catch {
      // Non bloquant : l'entité modifiée a déjà été enregistrée
    }
  }
}

export async function createUserDoc(user: UserProfile): Promise<void> {
  if (!db) throw new Error('Firestore non initialisé.');
  const ref = doc(db, 'users', user.uid);
  const clean = sanitizeUserProfileForWrite(user);
  try {
    await setDoc(ref, {
      ...clean,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}`);
  }
}

export async function updateUserDoc(user: UserProfile): Promise<void> {
  if (!db) throw new Error('Firestore non initialisé.');
  const ref = doc(db, 'users', user.uid);
  const clean = sanitizeUserProfileForWrite(user);
  let effectiveOp = OperationType.UPDATE;
  try {
    const existingSnap = await getDoc(ref);
    if (!existingSnap.exists()) {
      effectiveOp = OperationType.CREATE;
      await setDoc(ref, {
        ...clean,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        ...clean,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, effectiveOp, `users/${user.uid}`);
  }
}

export async function deleteUserDoc(uid: string): Promise<void> {
  return deleteCollectionDoc('users', uid);
}

export async function saveTagDoc(tag: CrmTag, isNew: boolean): Promise<void> {
  await saveStandardDoc('tags', tag, isNew);
  await seedMissingCollectionDefaults('tags', DEFAULT_TAGS, tag.id, (def) => {
    const { createdAt: _c, updatedAt: _u, ...rest } = def;
    return {
      ...rest,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
  });
}

export async function deleteTagDoc(tagId: string): Promise<void> {
  await seedMissingCollectionDefaults('tags', DEFAULT_TAGS, tagId, (def) => {
    const { createdAt: _c, updatedAt: _u, ...rest } = def;
    return {
      ...rest,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
  });
  await deleteCollectionDoc('tags', tagId);
}

export async function saveSettingsDoc(settings: CrmSettings): Promise<void> {
  if (!db) throw new Error('Firestore non initialisé.');
  const ref = doc(db, 'settings', settings.id);
  const { updatedAt: _u, ...rest } = settings;
  try {
    await setDoc(ref, {
      ...rest,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `settings/${settings.id}`);
  }
}

export async function appendAuditLog(log: AuditLog): Promise<void> {
  if (!db) return;
  const ref = doc(db, 'auditLogs', log.id);
  const { createdAt: _c, ...rest } = log;
  try {
    await setDoc(ref, {
      ...rest,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `auditLogs/${log.id}`);
  }
}

export async function saveNotificationDoc(notification: CrmNotification): Promise<void> {
  if (!db) return;
  const ref = doc(db, 'notifications', notification.id);
  const clean: Record<string, unknown> = { ...notification };
  delete clean.createdAt;
  for (const k of Object.keys(clean)) {
    if (clean[k] === undefined) delete clean[k];
  }
  try {
    await setDoc(ref, {
      ...clean,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `notifications/${notification.id}`);
  }
}

export async function markNotificationReadDoc(
  notificationId: string,
  readByUids: string[]
): Promise<void> {
  if (!db) return;
  const ref = doc(db, 'notifications', notificationId);
  try {
    await updateDoc(ref, { readByUids });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `notifications/${notificationId}`);
  }
}

async function getExistingDocIds(collectionName: string): Promise<Set<string>> {
  if (!db) return new Set();
  const snap = await getDocs(collection(db, collectionName));
  return new Set(snap.docs.map((d) => d.id));
}

export async function seedFirestoreDatabase(currentUid: string): Promise<void> {
  if (!db) throw new Error('Firestore non initialisé.');
  const database = db;
  try {
    const ops: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];

    const queueIfMissing = async <T extends { id: string }>(
      collectionName: string,
      items: T[],
      mapPayload: (item: T) => Record<string, unknown>
    ) => {
      const existingIds = await getExistingDocIds(collectionName);
      for (const item of items) {
        if (existingIds.has(item.id)) continue;
        ops.push((batch) => {
          batch.set(doc(database, collectionName, item.id), mapPayload(item));
        });
      }
    };

    await queueIfMissing('entities', DEFAULT_ENTITIES, (entity) => {
      const { createdAt: _c, updatedAt: _u, ...rest } = entity;
      return { ...rest, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    });

    await queueIfMissing('legalSettings', DEFAULT_LEGAL_SETTINGS, (legal) => {
      const { updatedAt: _u, ...rest } = legal;
      return { ...rest, updatedAt: serverTimestamp() };
    });

    await queueIfMissing('numberingCounters', DEFAULT_NUMBERING_COUNTERS, (cnt) => {
      const { updatedAt: _u, ...rest } = cnt;
      return { ...rest, updatedAt: serverTimestamp() };
    });

    await queueIfMissing('integrations', DEFAULT_INTEGRATIONS, (intItem) => {
      const { updatedAt: _u, ...rest } = intItem;
      return { ...rest, updatedAt: serverTimestamp() };
    });

    await queueIfMissing('pipelines', DEFAULT_PIPELINES, (pipeline) => {
      const { createdAt: _c, updatedAt: _u, ...rest } = pipeline;
      return { ...rest, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    });

    await queueIfMissing('pipelineStages', DEFAULT_PIPELINE_STAGES, (stage) => {
      const { createdAt: _c, updatedAt: _u, ...rest } = stage;
      return { ...rest, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    });

    await queueIfMissing('tags', DEFAULT_TAGS, (tag) => {
      const { createdAt: _c, updatedAt: _u, ...rest } = tag;
      return { ...rest, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    });

    await queueIfMissing('companies', DEMO_COMPANIES, (company) => {
      const { createdAt: _c, updatedAt: _u, ...rest } = company;
      return { ...rest, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    });

    await queueIfMissing('contacts', DEMO_CONTACTS, (contact) => {
      const { createdAt: _c, updatedAt: _u, ...rest } = contact;
      return { ...rest, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    });

    await queueIfMissing('products', DEMO_PRODUCTS, (product) => {
      const clean = normalizeProductForWrite(product);
      delete clean.createdAt;
      delete clean.updatedAt;
      return { ...clean, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    });

    await queueIfMissing('leads', DEMO_LEADS, (lead) => {
      const { createdAt: _c, updatedAt: _u, ...rest } = lead;
      return { ...rest, assignedToUid: currentUid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    });

    await queueIfMissing('sequences', DEMO_SEQUENCES, (seq) => {
      const { createdAt: _c, updatedAt: _u, ...rest } = seq;
      return { ...rest, createdByUid: currentUid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    });

    await queueIfMissing('sequenceSteps', DEMO_SEQUENCE_STEPS, (step) => ({ ...step }));

    await queueIfMissing('sequenceEnrollments', DEMO_SEQUENCE_ENROLLMENTS, (enr) => {
      const { updatedAt: _u, ...rest } = enr;
      return { ...rest, updatedAt: serverTimestamp() };
    });

    await queueIfMissing('prospects', DEMO_PROSPECTS, (prospect) => {
      const { createdAt: _c, updatedAt: _u, lastActivityAt: _l, ...rest } = prospect;
      return {
        ...rest,
        ownerUid: currentUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastActivityAt: serverTimestamp(),
      };
    });

    await queueIfMissing('actions', DEMO_ACTIONS, (action) => {
      const { createdAt: _c, updatedAt: _u, ...rest } = action;
      return {
        ...rest,
        assignedToUid: currentUid,
        createdByUid: currentUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
    });

    await queueIfMissing('opportunities', DEMO_DEALS, (deal) => {
      const { createdAt: _c, updatedAt: _u, ...rest } = deal;
      return { ...rest, ownerUid: currentUid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    });

    await queueIfMissing('quotes', DEMO_QUOTES, (quote) => {
      const { createdAt: _c, updatedAt: _u, ...rest } = quote;
      return { ...rest, createdByUid: currentUid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    });

    await queueIfMissing('quoteItems', DEMO_QUOTE_ITEMS, (qi) => ({ ...qi }));

    await queueIfMissing('invoices', DEMO_INVOICES, (inv) => {
      const { createdAt: _c, updatedAt: _u, ...rest } = inv;
      return { ...rest, createdByUid: currentUid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    });

    await queueIfMissing('invoiceItems', DEMO_INVOICE_ITEMS, (ii) => ({ ...ii }));

    await queueIfMissing('payments', DEMO_PAYMENTS, (pay) => {
      const { createdAt: _c, ...rest } = pay;
      return { ...rest, recordedByUid: currentUid, createdAt: serverTimestamp() };
    });

    await queueIfMissing('complaints', DEMO_COMPLAINTS, (comp) => {
      const { createdAt: _c, updatedAt: _u, ...rest } = comp;
      return { ...rest, assignedToUid: currentUid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    });

    await queueIfMissing('serviceRequests', DEMO_SERVICE_REQUESTS, (sr) => {
      const { createdAt: _c, updatedAt: _u, ...rest } = sr;
      return { ...rest, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    });

    await queueIfMissing('satisfactionSurveys', DEMO_SATISFACTION_SURVEYS, (surv) => {
      const { createdAt: _c, ...rest } = surv;
      return { ...rest, createdAt: serverTimestamp() };
    });

    await queueIfMissing('auditLogs', DEMO_AUDIT_LOGS, (log) => {
      const { createdAt: _c, ...rest } = log;
      return { ...rest, actorUid: currentUid, createdAt: serverTimestamp() };
    });

    await queueIfMissing('notifications', DEMO_NOTIFICATIONS, (notif) => {
      const { createdAt: _c, ...rest } = notif;
      return { ...rest, actorUid: currentUid, createdAt: serverTimestamp() };
    });

    const existingSettings = await getExistingDocIds('settings');
    if (!existingSettings.has('global')) {
      ops.push((batch) => {
        batch.set(doc(database, 'settings', 'global'), {
          id: 'global',
          scope: 'global',
          defaultCurrency: 'MGA',
          defaultProspectView: 'table',
          updatedByUid: currentUid,
          updatedAt: serverTimestamp(),
        });
      });
    }

    const CHUNK_SIZE = 400;
    for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
      const batch = writeBatch(database);
      for (const applyOp of ops.slice(i, i + CHUNK_SIZE)) {
        applyOp(batch);
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'seedFirestoreDatabase');
  }
}
