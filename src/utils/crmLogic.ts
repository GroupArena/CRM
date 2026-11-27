import type {
  ActionStatus,
  CrmAction,
  CrmEntity,
  Deal,
  EntityScope,
  PipelineStage,
  Product,
  Prospect,
  UserProfile,
} from '../types';

export const BOOTSTRAPPED_SUPER_ADMIN_EMAILS = [
  'navalona.rajaonarivelo@gmail.com',
  'navalona@arenabusinesscenter.com',
  'navalona@group-arena.com',
] as const;

export function isBootstrappedSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return (BOOTSTRAPPED_SUPER_ADMIN_EMAILS as readonly string[]).includes(normalized);
}

export type FirestoreConnectionStatus = 'checking' | 'connected' | 'offline';

export function shouldShowDemoModeOption(params: {
  firebaseAvailable: boolean;
  firestoreConnectionStatus: FirestoreConnectionStatus;
  firestoreOffline: boolean;
  authConnectionError: string | null;
}): boolean {
  if (!params.firebaseAvailable) return true;
  if (params.firestoreOffline || Boolean(params.authConnectionError)) return true;
  if (params.firestoreConnectionStatus === 'offline') return true;
  return false;
}

export interface ResolvedUserProfileResult {
  needsCreate: boolean;
  needsUpdate: boolean;
  profile: UserProfile;
}

export function resolveBootstrappedUserProfile(
  uid: string,
  email: string,
  displayName: string,
  existingProfile: UserProfile | null,
  allEntityIds: string[]
): ResolvedUserProfileResult {
  const cleanEmail = email.trim();
  const isBootstrapped = isBootstrappedSuperAdminEmail(cleanEmail);

  if (!existingProfile) {
    return {
      needsCreate: true,
      needsUpdate: false,
      profile: {
        uid,
        email: cleanEmail,
        displayName: displayName.trim() || cleanEmail.split('@')[0] || 'Utilisateur',
        role: isBootstrapped ? 'super_admin' : 'reader',
        entityIds: isBootstrapped ? [...allEntityIds] : [],
        active: true,
        createdAt: '',
        updatedAt: '',
      },
    };
  }

  const shouldEnsureSuperAdminEntities =
    isBootstrapped ||
    (existingProfile.role === 'super_admin' && existingProfile.active);

  if (!shouldEnsureSuperAdminEntities) {
    return {
      needsCreate: false,
      needsUpdate: false,
      profile: existingProfile,
    };
  }

  const existingEntities = Array.isArray(existingProfile.entityIds)
    ? existingProfile.entityIds
    : [];
  const missingEntity = allEntityIds.some((id) => !existingEntities.includes(id));
  const needsUpdate = isBootstrapped
    ? existingProfile.role !== 'super_admin' ||
      !existingProfile.active ||
      missingEntity
    : missingEntity;

  if (!needsUpdate) {
    return {
      needsCreate: false,
      needsUpdate: false,
      profile: existingProfile,
    };
  }

  const mergedEntities = Array.from(new Set([...allEntityIds, ...existingEntities]));
  return {
    needsCreate: false,
    needsUpdate: true,
    profile: {
      ...existingProfile,
      uid: existingProfile.uid || uid,
      email: existingProfile.email || cleanEmail,
      role: isBootstrapped ? 'super_admin' : existingProfile.role,
      entityIds: mergedEntities,
      active: isBootstrapped ? true : existingProfile.active,
    },
  };
}

export function sanitizeUserProfileForWrite(
  user: UserProfile & { id?: string }
): Record<string, unknown> {
  const {
    id: _ignoredId,
    createdAt: _ignoredCreatedAt,
    updatedAt: _ignoredUpdatedAt,
    ...rest
  } = user;
  const clean: Record<string, unknown> = {
    uid: rest.uid,
    email: rest.email.trim(),
    displayName: rest.displayName.trim() || rest.email.trim().split('@')[0] || 'Utilisateur',
    role: rest.role,
    entityIds: Array.isArray(rest.entityIds)
      ? Array.from(new Set(rest.entityIds.filter((v) => typeof v === 'string' && v.trim().length > 0))).slice(0, 10)
      : [],
    active: Boolean(rest.active),
  };
  return clean;
}

export function normalizeProductForWrite(
  product: Product
): Record<string, unknown> & { id: string } {
  const cleanSku = (product.sku || '').trim();
  const payload: Record<string, unknown> & { id: string } = {
    ...product,
    folder: (product.folder || '').trim(),
    imageUrl: (product.imageUrl || '').trim(),
    productUrl: (product.productUrl || '').trim(),
    customProperties: (product.customProperties || [])
      .filter((prop) => prop.key.trim().length > 0)
      .map((prop) => ({ key: prop.key.trim(), value: prop.value.trim() })),
    pricingTiers: (product.pricingTiers || []).map((tier) => ({
      minQty: Math.max(1, Number(tier.minQty) || 1),
      maxQty:
        tier.maxQty === undefined || tier.maxQty === null || Number.isNaN(Number(tier.maxQty))
          ? null
          : Number(tier.maxQty),
      unitPrice: Math.max(0, Number(tier.unitPrice) || 0),
    })),
  };

  if (cleanSku) {
    payload.sku = cleanSku;
  } else {
    delete payload.sku;
  }

  if (
    product.billingDurationCount === undefined ||
    product.billingDurationCount === null ||
    Number.isNaN(Number(product.billingDurationCount))
  ) {
    delete payload.billingDurationCount;
  } else {
    payload.billingDurationCount = Number(product.billingDurationCount);
  }

  return payload;
}

export function canViewAllEntities(user: UserProfile | null): boolean {
  if (!user || !user.active) return false;
  return user.role === 'super_admin';
}

export function canWriteCrm(user: UserProfile | null): boolean {
  if (!user || !user.active) return false;
  return user.role !== 'reader';
}

export function isSuperAdminUser(user: UserProfile | null): boolean {
  return Boolean(user && user.active && user.role === 'super_admin');
}

export function canManageSettings(user: UserProfile | null): boolean {
  return isSuperAdminUser(user);
}

export function canManageUsers(user: UserProfile | null): boolean {
  return isSuperAdminUser(user);
}

export function canManageEntities(user: UserProfile | null): boolean {
  return isSuperAdminUser(user);
}

export function canDeleteUserAccount(
  actor: UserProfile | null,
  target: Pick<UserProfile, 'uid'>
): boolean {
  return isSuperAdminUser(actor) && Boolean(actor && target.uid !== actor.uid);
}

export function canDeleteProductRecord(user: UserProfile | null): boolean {
  if (!user || !user.active) return false;
  return (
    user.role === 'super_admin' ||
    user.role === 'entity_admin' ||
    user.role === 'manager'
  );
}

export function canEditProspect(user: UserProfile | null, prospect: Prospect): boolean {
  if (!user || !user.active || user.role === 'reader') return false;
  if (user.role === 'super_admin') return true;
  const hasEntity =
    user.entityIds.includes(prospect.primaryEntityId) ||
    prospect.sharedEntityIds.some((id) => user.entityIds.includes(id));
  if (!hasEntity) return false;
  if (user.role === 'entity_admin' || user.role === 'manager') return true;
  return prospect.ownerUid === user.uid;
}

export function canDeleteProspect(user: UserProfile | null, prospect: Prospect): boolean {
  if (!user || !user.active) return false;
  if (user.role === 'super_admin') return true;
  if (user.role === 'entity_admin' || user.role === 'manager') {
    return user.entityIds.includes(prospect.primaryEntityId);
  }
  return false;
}

export function getAuthorizedEntities(
  user: UserProfile | null,
  entities: CrmEntity[]
): CrmEntity[] {
  if (!user || !user.active) return [];
  const activeEntities = entities.filter((e) => e.active);
  if (user.role === 'super_admin') return activeEntities;
  return activeEntities.filter((e) => user.entityIds.includes(e.id));
}

export function mergeDefaultRecordsById<T extends { id: string }>(
  defaults: readonly T[],
  remoteItems: readonly T[]
): T[] {
  if (remoteItems.length === 0) return [...defaults];
  const remoteById = new Map(remoteItems.map((item) => [item.id, item]));
  const merged = defaults.map((def) => remoteById.get(def.id) ?? def);
  const defaultIds = new Set(defaults.map((def) => def.id));
  for (const item of remoteItems) {
    if (!defaultIds.has(item.id)) {
      merged.push(item);
    }
  }
  return merged;
}

export function resolveEffectiveActionStatus(
  action: CrmAction,
  referenceDateIso: string
): ActionStatus {
  if (action.status === 'done' || action.status === 'cancelled') {
    return action.status;
  }
  const today = referenceDateIso.slice(0, 10);
  if (action.dueDate && action.dueDate < today) {
    return 'late';
  }
  return 'planned';
}

export function filterProspectsByScope(
  prospects: Prospect[],
  scope: EntityScope,
  includeArchived = false
): Prospect[] {
  return prospects.filter((p) => {
    if (!includeArchived && p.archived) return false;
    if (scope === 'all') return true;
    return p.primaryEntityId === scope || p.sharedEntityIds.includes(scope);
  });
}

export function filterActionsByScope(
  actions: CrmAction[],
  scope: EntityScope
): CrmAction[] {
  if (scope === 'all') return actions;
  return actions.filter((a) => a.entityId === scope);
}

export function filterDealsByScope(deals: Deal[], scope: EntityScope): Deal[] {
  if (scope === 'all') return deals;
  return deals.filter((d) => d.entityId === scope);
}

export interface DashboardKpis {
  totalProspects: number;
  newProspects: number;
  toFollowUpProspects: number;
  scheduledMeetings: number;
  lateActions: number;
  openDeals: number;
  pipelineValue: number;
  wonDeals: number;
  lostDeals: number;
  conversionRate: number;
}

export function computeDashboardKpis(
  prospects: Prospect[],
  actions: CrmAction[],
  deals: Deal[],
  referenceDateIso: string
): DashboardKpis {
  const activeProspects = prospects.filter((p) => !p.archived);
  const totalProspects = activeProspects.length;
  const newProspects = activeProspects.filter((p) => p.status === 'Nouveau').length;
  const toFollowUpProspects = activeProspects.filter(
    (p) => p.status === 'À recontacter' || p.status === 'Sans réponse'
  ).length;

  const scheduledMeetings = actions.filter((a) => {
    const eff = resolveEffectiveActionStatus(a, referenceDateIso);
    return (
      (eff === 'planned' || eff === 'late') &&
      (a.type === 'Rendez-vous' || a.type === 'Réunion')
    );
  }).length;

  const lateActions = actions.filter(
    (a) => resolveEffectiveActionStatus(a, referenceDateIso) === 'late'
  ).length;

  const openDealsList = deals.filter((d) => d.status === 'open');
  const wonDealsList = deals.filter((d) => d.status === 'won');
  const lostDealsList = deals.filter((d) => d.status === 'lost');

  const pipelineValue = openDealsList.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  const closedCount = wonDealsList.length + lostDealsList.length;
  const conversionRate =
    closedCount > 0 ? Math.round((wonDealsList.length / closedCount) * 100) : 0;

  return {
    totalProspects,
    newProspects,
    toFollowUpProspects,
    scheduledMeetings,
    lateActions,
    openDeals: openDealsList.length,
    pipelineValue,
    wonDeals: wonDealsList.length,
    lostDeals: lostDealsList.length,
    conversionRate,
  };
}

export function computeProspectsByStatus(prospects: Prospect[]) {
  const counts = new Map<string, number>();
  for (const p of prospects) {
    if (p.archived) continue;
    counts.set(p.status, (counts.get(p.status) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([status, count]) => ({
    status,
    count,
  }));
}

export function computeProspectsByEntity(
  prospects: Prospect[],
  entities: CrmEntity[]
) {
  return entities.map((entity) => ({
    entityId: entity.id,
    name: entity.name,
    color: entity.color,
    count: prospects.filter(
      (p) => !p.archived && p.primaryEntityId === entity.id
    ).length,
  }));
}

export function computePipelineByStage(
  deals: Deal[],
  stages: PipelineStage[]
) {
  const sortedStages = [...stages].sort((a, b) => a.order - b.order);
  const stageMap = new Map<string, { name: string; total: number; count: number }>();

  for (const stage of sortedStages) {
    const existing = stageMap.get(stage.name) ?? { name: stage.name, total: 0, count: 0 };
    const matchingDeals = deals.filter((d) => d.stageId === stage.id);
    existing.total += matchingDeals.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
    existing.count += matchingDeals.length;
    stageMap.set(stage.name, existing);
  }

  return Array.from(stageMap.values());
}

export function computeActionsByType(actions: CrmAction[]) {
  const counts = new Map<string, number>();
  for (const a of actions) {
    counts.set(a.type, (counts.get(a.type) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
}

export function computeActivityLast30Days(
  actions: CrmAction[],
  referenceDateIso: string
) {
  const endDate = new Date(referenceDateIso.slice(0, 10) + 'T12:00:00Z');
  const days: { date: string; label: string; planned: number; done: number }[] = [];

  for (let offset = 29; offset >= 0; offset--) {
    const d = new Date(endDate);
    d.setUTCDate(d.getUTCDate() - offset);
    const iso = d.toISOString().slice(0, 10);
    const label = `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
    days.push({ date: iso, label, planned: 0, done: 0 });
  }

  const dayMap = new Map(days.map((d) => [d.date, d]));
  for (const action of actions) {
    const createdDay = action.createdAt.slice(0, 10);
    const completedDay = action.completedAt?.slice(0, 10);
    const createdBucket = dayMap.get(createdDay);
    if (createdBucket) {
      createdBucket.planned += 1;
    }
    if (action.status === 'done' && completedDay) {
      const doneBucket = dayMap.get(completedDay);
      if (doneBucket) {
        doneBucket.done += 1;
      }
    }
  }

  return days;
}

let activeDefaultCurrency = 'MGA';

export function setActiveDefaultCurrency(currency?: string): void {
  if (currency && currency.trim()) {
    activeDefaultCurrency = currency.trim().toUpperCase();
  }
}

export function formatCurrency(amount: number, currency?: string): string {
  const code = (currency || activeDefaultCurrency || 'MGA').toUpperCase();
  const value = Number(amount) || 0;
  if (code === 'MGA') {
    const formatted = new Intl.NumberFormat('fr-FR', {
      maximumFractionDigits: 0,
    }).format(Math.round(value));
    return `${formatted} Ar`;
  }
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value)} ${code}`;
  }
}

export function formatDateFr(dateStr?: string): string {
  if (!dateStr) return '—';
  const parsed = new Date(dateStr.length === 10 ? `${dateStr}T12:00:00` : dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

export function formatDateTimeFr(dateStr?: string): string {
  if (!dateStr) return '—';
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

export function validateProspectInput(input: {
  firstName: string;
  lastName: string;
  primaryEntityId: string;
  email?: string;
  estimatedValue?: number;
}): string | null {
  if (!input.firstName.trim()) return 'Le prénom est obligatoire.';
  if (!input.lastName.trim()) return 'Le nom est obligatoire.';
  if (!input.primaryEntityId.trim()) return "L'entité principale est obligatoire.";
  if (input.email && input.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    return "L'adresse email est invalide.";
  }
  if (input.estimatedValue !== undefined && input.estimatedValue < 0) {
    return 'La valeur estimée ne peut pas être négative.';
  }
  return null;
}

export function validateActionInput(input: {
  title: string;
  prospectId?: string;
  contactId?: string;
  companyId?: string;
  entityId: string;
  dueDate: string;
}): string | null {
  if (!input.title.trim()) return "Le titre de l'action est obligatoire.";
  if (!input.entityId.trim()) return "L'entité est obligatoire.";
  if (!input.dueDate.trim()) return "La date d'échéance est obligatoire.";
  return null;
}

export function validateDealInput(input: {
  name: string;
  entityId: string;
  prospectId?: string;
  contactId?: string;
  stageId: string;
  amount: number;
  status?: 'open' | 'won' | 'lost';
  lostReason?: string;
  lostComment?: string;
}): string | null {
  if (!input.name.trim()) return "Le nom de l'opportunité est obligatoire.";
  if (!input.entityId.trim()) return "L'entité est obligatoire.";
  if (!input.prospectId?.trim() && !input.contactId?.trim()) {
    return 'Le contact ou prospect associé est obligatoire.';
  }
  if (!input.stageId.trim()) return "L'étape du pipeline est obligatoire.";
  if (Number.isNaN(input.amount) || input.amount < 0) return 'Le montant doit être positif.';
  if (input.status === 'lost') {
    if (!input.lostReason?.trim()) {
      return 'Le motif de perte est obligatoire lorsque l’opportunité passe à « Perdu ».';
    }
    if (input.lostReason === 'Autre' && !input.lostComment?.trim()) {
      return 'Un commentaire est obligatoire lorsque le motif de perte est « Autre ».';
    }
  }
  return null;
}
