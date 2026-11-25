import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canDeleteProductRecord,
  canDeleteProspect,
  canDeleteUserAccount,
  canEditProspect,
  canManageEntities,
  canManageSettings,
  canManageUsers,
  canViewAllEntities,
  computeDashboardKpis,
  filterProspectsByScope,
  formatCurrency,
  getAuthorizedEntities,
  isBootstrappedSuperAdminEmail,
  mergeDefaultRecordsById,
  resolveBootstrappedUserProfile,
  resolveEffectiveActionStatus,
  setActiveDefaultCurrency,
  validateActionInput,
  validateDealInput,
  validateProspectInput,
} from './crmLogic';
import type { CrmAction, CrmEntity, Deal, Prospect, UserProfile } from '../types';

const ENTITIES: CrmEntity[] = [
  {
    id: 'arena-business-center',
    name: 'Arena Business Center',
    slug: 'arena-business-center',
    description: 'Domiciliation & bureaux équipés',
    color: '#1d4ed8',
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'improveo',
    name: 'Improveo',
    slug: 'improveo',
    description: 'Conseil & performance',
    color: '#0f766e',
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

const SUPER_ADMIN: UserProfile = {
  uid: 'u-admin',
  email: 'admin@arena-group.fr',
  displayName: 'Admin Groupe',
  role: 'super_admin',
  entityIds: ['arena-business-center', 'improveo'],
  active: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const SALES_IMPROVEO: UserProfile = {
  uid: 'u-sales',
  email: 'sales@improveo.fr',
  displayName: 'Commercial Improveo',
  role: 'sales',
  entityIds: ['improveo'],
  active: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const READER_USER: UserProfile = {
  uid: 'u-reader',
  email: 'reader@improveo.fr',
  displayName: 'Lecteur',
  role: 'reader',
  entityIds: ['improveo'],
  active: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const PROSPECT_IMPROVEO: Prospect = {
  id: 'p1',
  primaryEntityId: 'improveo',
  sharedEntityIds: ['arena-business-center'],
  firstName: 'Claire',
  lastName: 'Martin',
  companyName: 'Martin Conseil',
  email: 'claire@martin.fr',
  phone: '0102030405',
  mobile: '',
  website: '',
  status: 'Nouveau',
  source: 'Site web',
  ownerUid: 'u-sales',
  tags: ['PME'],
  notes: '',
  priority: 'high',
  estimatedValue: 15000,
  address: '',
  city: 'Lyon',
  country: 'France',
  consentMarketing: true,
  gdprConsentDate: '2026-10-01',
  archived: false,
  createdAt: '2026-10-01T10:00:00Z',
  updatedAt: '2026-10-01T10:00:00Z',
  lastActivityAt: '2026-10-01T10:00:00Z',
  nextActionDate: '2026-11-15',
  nextActionType: 'Appel',
};

test('RBAC: super admin can view all entities, sales only sees assigned entities', () => {
  assert.equal(canViewAllEntities(SUPER_ADMIN), true);
  assert.equal(canViewAllEntities(SALES_IMPROVEO), false);
  assert.equal(getAuthorizedEntities(SUPER_ADMIN, ENTITIES).length, 2);
  assert.equal(getAuthorizedEntities(SALES_IMPROVEO, ENTITIES).length, 1);
  assert.equal(getAuthorizedEntities(SALES_IMPROVEO, ENTITIES)[0].id, 'improveo');
});

test('RBAC: edit and delete prospect rules enforce role and ownership', () => {
  assert.equal(canEditProspect(SALES_IMPROVEO, PROSPECT_IMPROVEO), true);
  assert.equal(canDeleteProspect(SALES_IMPROVEO, PROSPECT_IMPROVEO), false);
  assert.equal(canEditProspect(READER_USER, PROSPECT_IMPROVEO), false);
  assert.equal(canDeleteProspect(SUPER_ADMIN, PROSPECT_IMPROVEO), true);
});

test('Multi-entity filtering includes sharedEntityIds', () => {
  const abcScoped = filterProspectsByScope([PROSPECT_IMPROVEO], 'arena-business-center');
  assert.equal(abcScoped.length, 1);
  const allScoped = filterProspectsByScope([PROSPECT_IMPROVEO], 'all');
  assert.equal(allScoped.length, 1);
});

test('Action lateness detection and Dashboard KPIs calculate accurately', () => {
  const actions: CrmAction[] = [
    {
      id: 'a1',
      entityId: 'improveo',
      prospectId: 'p1',
      type: 'Appel',
      title: 'Relance téléphonique',
      description: '',
      assignedToUid: 'u-sales',
      createdByUid: 'u-sales',
      status: 'planned',
      dueDate: '2026-11-10',
      dueTime: '10:00',
      priority: 'high',
      outcome: '',
      relatedEntityType: 'prospect',
      createdAt: '2026-11-01T10:00:00Z',
      updatedAt: '2026-11-01T10:00:00Z',
    },
    {
      id: 'a2',
      entityId: 'improveo',
      prospectId: 'p1',
      type: 'Rendez-vous',
      title: 'RDV découverte',
      description: '',
      assignedToUid: 'u-sales',
      createdByUid: 'u-sales',
      status: 'planned',
      dueDate: '2026-11-20',
      dueTime: '14:00',
      priority: 'medium',
      outcome: '',
      relatedEntityType: 'prospect',
      createdAt: '2026-11-05T10:00:00Z',
      updatedAt: '2026-11-05T10:00:00Z',
    },
  ];

  assert.equal(resolveEffectiveActionStatus(actions[0], '2026-11-13T09:00:00Z'), 'late');
  assert.equal(resolveEffectiveActionStatus(actions[1], '2026-11-13T09:00:00Z'), 'planned');

  const deals: Deal[] = [
    {
      id: 'd1',
      entityId: 'improveo',
      prospectId: 'p1',
      name: 'Audit Qualiopi',
      stageId: 's3',
      pipelineId: 'pipe-improveo',
      amount: 12000,
      currency: 'EUR',
      probability: 60,
      expectedCloseDate: '2026-12-01',
      ownerUid: 'u-sales',
      status: 'open',
      notes: '',
      createdAt: '2026-11-01T10:00:00Z',
      updatedAt: '2026-11-01T10:00:00Z',
    },
    {
      id: 'd2',
      entityId: 'improveo',
      prospectId: 'p1',
      name: 'Coaching Dirigeant',
      stageId: 's6',
      pipelineId: 'pipe-improveo',
      amount: 8000,
      currency: 'EUR',
      probability: 100,
      expectedCloseDate: '2026-11-05',
      ownerUid: 'u-sales',
      status: 'won',
      notes: '',
      createdAt: '2026-10-15T10:00:00Z',
      updatedAt: '2026-11-05T10:00:00Z',
    },
  ];

  const kpis = computeDashboardKpis([PROSPECT_IMPROVEO], actions, deals, '2026-11-13T09:00:00Z');
  assert.equal(kpis.totalProspects, 1);
  assert.equal(kpis.newProspects, 1);
  assert.equal(kpis.lateActions, 1);
  assert.equal(kpis.scheduledMeetings, 1);
  assert.equal(kpis.openDeals, 1);
  assert.equal(kpis.pipelineValue, 12000);
  assert.equal(kpis.wonDeals, 1);
  assert.equal(kpis.conversionRate, 100);
});

test('Form validation catches empty required fields and invalid values', () => {
  assert.ok(validateProspectInput({ firstName: '', lastName: 'Dupont', primaryEntityId: 'improveo' }));
  assert.ok(validateProspectInput({ firstName: 'Jean', lastName: 'Dupont', primaryEntityId: 'improveo', email: 'invalid-email' }));
  assert.equal(validateProspectInput({ firstName: 'Jean', lastName: 'Dupont', primaryEntityId: 'improveo', email: 'jean@dupont.fr', estimatedValue: 5000 }), null);

  assert.ok(validateActionInput({ title: '', prospectId: 'p1', entityId: 'improveo', dueDate: '2026-11-20' }));
  assert.equal(validateActionInput({ title: 'Appel', prospectId: 'p1', entityId: 'improveo', dueDate: '2026-11-20' }), null);

  assert.ok(validateDealInput({ name: 'Deal', entityId: 'improveo', prospectId: 'p1', stageId: 's1', amount: -10 }));
  assert.ok(validateDealInput({ name: 'Deal', entityId: 'improveo', contactId: 'c1', stageId: 's1', amount: 4500, status: 'lost' }));
  assert.ok(validateDealInput({ name: 'Deal', entityId: 'improveo', contactId: 'c1', stageId: 's1', amount: 4500, status: 'lost', lostReason: 'Autre', lostComment: '' }));
  assert.equal(validateDealInput({ name: 'Deal', entityId: 'improveo', contactId: 'c1', stageId: 's1', amount: 4500, status: 'lost', lostReason: 'Prix' }), null);
  assert.equal(validateDealInput({ name: 'Deal', entityId: 'improveo', prospectId: 'p1', stageId: 's1', amount: 4500 }), null);
});

test('Currency formatting supports MGA (Ar) as default out of the box', () => {
  const initialDefault = formatCurrency(25000).replace(/\u202f|\u00a0/g, ' ');
  assert.equal(initialDefault, '25 000 Ar');

  const explicit = formatCurrency(150000, 'MGA').replace(/\u202f|\u00a0/g, ' ');
  assert.equal(explicit, '150 000 Ar');

  setActiveDefaultCurrency('EUR');
  const eurFormatted = formatCurrency(100).replace(/\u202f|\u00a0/g, ' ');
  assert.ok(eurFormatted.includes('€'));

  setActiveDefaultCurrency('MGA');
});

test('Bootstrapped Super Admin detection and existing reader profile promotion', () => {
  assert.equal(isBootstrappedSuperAdminEmail('navalona@arenabusinesscenter.com'), true);
  assert.equal(isBootstrappedSuperAdminEmail('  Navalona.Rajaonarivelo@gmail.com '), true);
  assert.equal(isBootstrappedSuperAdminEmail('collaborateur@arenabusinesscenter.com'), false);
  assert.equal(isBootstrappedSuperAdminEmail(null), false);

  const entityIds = ['arena-business-center', 'improveo', 'arena-studio-comm', 'maison-artisanat'];

  const freshAdmin = resolveBootstrappedUserProfile(
    'uid-1',
    'navalona@arenabusinesscenter.com',
    'Navalona',
    null,
    entityIds
  );
  assert.equal(freshAdmin.needsCreate, true);
  assert.equal(freshAdmin.needsUpdate, false);
  assert.equal(freshAdmin.profile.role, 'super_admin');
  assert.deepEqual(freshAdmin.profile.entityIds, entityIds);

  const freshStandard = resolveBootstrappedUserProfile(
    'uid-2',
    'sales@arenabusinesscenter.com',
    '',
    null,
    entityIds
  );
  assert.equal(freshStandard.needsCreate, true);
  assert.equal(freshStandard.profile.role, 'reader');
  assert.deepEqual(freshStandard.profile.entityIds, []);

  const staleReaderAdmin: UserProfile = {
    uid: 'uid-1',
    email: 'navalona@arenabusinesscenter.com',
    displayName: 'Navalona',
    role: 'reader',
    entityIds: [],
    active: false,
    createdAt: '2026-11-20T00:00:00Z',
    updatedAt: '2026-11-20T00:00:00Z',
  };
  const promoted = resolveBootstrappedUserProfile(
    'uid-1',
    'navalona@arenabusinesscenter.com',
    'Navalona',
    staleReaderAdmin,
    entityIds
  );
  assert.equal(promoted.needsCreate, false);
  assert.equal(promoted.needsUpdate, true);
  assert.equal(promoted.profile.role, 'super_admin');
  assert.equal(promoted.profile.active, true);
  assert.deepEqual(promoted.profile.entityIds, entityIds);

  const alreadyAdmin = resolveBootstrappedUserProfile(
    'uid-1',
    'navalona@arenabusinesscenter.com',
    'Navalona',
    promoted.profile,
    entityIds
  );
  assert.equal(alreadyAdmin.needsCreate, false);
  assert.equal(alreadyAdmin.needsUpdate, false);

  const nonAdminExisting = resolveBootstrappedUserProfile(
    'uid-3',
    'user@improveo.fr',
    'User',
    { ...READER_USER, uid: 'uid-3', email: 'user@improveo.fr' },
    entityIds
  );
  assert.equal(nonAdminExisting.needsUpdate, false);
  assert.equal(nonAdminExisting.profile.role, 'reader');
});

test('Settings, entity/user/tag management and user deletion are restricted to active Super Admins', () => {
  const entityAdmin: UserProfile = { ...SALES_IMPROVEO, uid: 'u-ea', role: 'entity_admin' };
  const manager: UserProfile = { ...SALES_IMPROVEO, uid: 'u-mgr', role: 'manager' };
  const inactiveAdmin: UserProfile = { ...SUPER_ADMIN, active: false };

  assert.equal(canManageSettings(SUPER_ADMIN), true);
  assert.equal(canManageUsers(SUPER_ADMIN), true);
  assert.equal(canManageEntities(SUPER_ADMIN), true);

  for (const nonSuper of [entityAdmin, manager, SALES_IMPROVEO, READER_USER, inactiveAdmin, null]) {
    assert.equal(canManageSettings(nonSuper), false);
    assert.equal(canManageUsers(nonSuper), false);
    assert.equal(canManageEntities(nonSuper), false);
  }

  assert.equal(canDeleteUserAccount(SUPER_ADMIN, SALES_IMPROVEO), true);
  assert.equal(canDeleteUserAccount(SUPER_ADMIN, SUPER_ADMIN), false);
  assert.equal(canDeleteUserAccount(entityAdmin, SALES_IMPROVEO), false);

  assert.equal(canDeleteProductRecord(SUPER_ADMIN), true);
  assert.equal(canDeleteProductRecord(entityAdmin), true);
  assert.equal(canDeleteProductRecord(manager), true);
  assert.equal(canDeleteProductRecord(SALES_IMPROVEO), false);
  assert.equal(canDeleteProductRecord(READER_USER), false);
});

test('mergeDefaultRecordsById preserves unseeded defaults and applies remote overrides cleanly', () => {
  const defaults = [
    { id: 'arena-business-center', name: 'Arena Business Center' },
    { id: 'improveo', name: 'Improveo' },
  ];
  assert.deepEqual(mergeDefaultRecordsById(defaults, []), defaults);

  const merged = mergeDefaultRecordsById(defaults, [
    { id: 'improveo', name: 'Improveo Consulting' },
    { id: 'custom-entity', name: 'Arena Tech' },
  ]);
  assert.deepEqual(merged, [
    { id: 'arena-business-center', name: 'Arena Business Center' },
    { id: 'improveo', name: 'Improveo Consulting' },
    { id: 'custom-entity', name: 'Arena Tech' },
  ]);
});