import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addManagedCatalogValue,
  buildBalanceLinesFromDepositItems,
  buildCatalogOptions,
  buildUnifiedClientHistory,
  computeDocumentTotals,
  computeFinanceKpis,
  computeInvoiceTotals,
  computeLossReasonsBreakdown,
  computeProductMargin,
  computeRemovedLineItemIds,
  computeRevenueByEntity,
  computeSequenceMetrics,
  DEFAULT_PRODUCT_CATEGORIES,
  DEFAULT_PRODUCT_FOLDERS,
  findDuplicateCompanies,
  findDuplicateContacts,
  formatInlineAddress,
  getClientFiscalInfo,
  getDepositInvoicesForEntity,
  getDocumentAmountInWordsPrefix,
  getInvoiceTotalsDisplaySpec,
  getManagedCatalogList,
  getNextSequenceNumber,
  getPaidDepositInvoicesForClient,
  isSkuUnique,
  mergeCompanyRecords,
  mergeContactRecords,
  parseFormattedDescriptionLines,
  recalculateInvoiceWithPayments,
  removeManagedCatalogValue,
  renameManagedCatalogValue,
  resolveInvoiceStatus,
  resolveManagedCatalogOptions,
  resolveProductUnitPrice,
  shouldRenderStampAndSignature,
  validateProductInput,
} from './billingLogic';
import type {
  Company,
  Contact,
  CrmEntity,
  Deal,
  Invoice,
  Payment,
  Quote,
  SequenceEnrollment,
  SequenceStep,
} from '../types';

const ENTITIES: CrmEntity[] = [
  {
    id: 'arena-business-center',
    name: 'Arena Business Center',
    slug: 'arena-business-center',
    description: '',
    color: '#1d4ed8',
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'improveo',
    name: 'Improveo',
    slug: 'improveo',
    description: '',
    color: '#0f766e',
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

test('Duplicate detection and merging for shared companies and contacts', () => {
  const companies: Company[] = [
    {
      id: 'comp-1',
      legalName: 'Véranda & Lumière SAS',
      tradeName: 'Véranda Lumière',
      legalStatus: 'SAS',
      nif: '12345',
      stat: '',
      rcs: 'RCS Antananarivo 2020 B 00123',
      address: '24 Av Opéra',
      city: 'Paris',
      country: 'France',
      phone: '01 42 68 55 10',
      whatsapp: '',
      email: 'contact@veranda-lumiere.fr',
      website: '',
      primaryContactId: 'ct-1',
      tags: ['PME'],
      notes: 'Note A',
      isVip: false,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ];
  const dupes = findDuplicateCompanies(companies, {
    legalName: 'VERANDA LUMIERE SAS',
    phone: '0142685510',
  });
  assert.equal(dupes.length, 1);

  const mergedComp = mergeCompanyRecords(companies[0], {
    ...companies[0],
    id: 'comp-2',
    stat: 'STAT-999',
    rcs: 'RCS Antananarivo 2021 B 00999',
    isVip: true,
    tags: ['VIP'],
    notes: 'Note B',
  });
  assert.equal(mergedComp.stat, 'STAT-999');
  assert.equal(mergedComp.rcs, 'RCS Antananarivo 2020 B 00123');
  assert.equal(mergedComp.isVip, true);
  assert.deepEqual(mergedComp.tags, ['PME', 'VIP']);

  const contacts: Contact[] = [
    {
      id: 'ct-1',
      fullName: 'Marc Delacroix',
      jobTitle: 'DG',
      phone: '06 14 28 39 40',
      whatsapp: '0614283940',
      email: 'm.delacroix@veranda-lumiere.fr',
      companyId: 'comp-1',
      isVip: false,
      tags: ['Décideur'],
      consentMarketing: true,
      gdprConsentDate: '2026-10-01',
      notes: '',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ];
  assert.equal(
    findDuplicateContacts(contacts, { email: 'M.DELACROIX@veranda-lumiere.fr' }).length,
    1
  );
  const mergedCt = mergeContactRecords(contacts[0], {
    ...contacts[0],
    id: 'ct-2',
    cin: '101 251 004 812',
    isVip: true,
    tags: ['Direction'],
  });
  assert.equal(mergedCt.isVip, true);
  assert.equal(mergedCt.cin, '101 251 004 812');
  assert.deepEqual(mergedCt.tags, ['Décideur', 'Direction']);
});

test('Quote/Invoice totals and unique entity-year numbering calculate accurately', () => {
  const { lines, subtotal, vatAmount, total } = computeDocumentTotals([
    {
      id: 'l1',
      label: 'Domiciliation',
      description: '',
      quantity: 2,
      unitPrice: 150,
      vatRate: 20,
      orderIndex: 0,
    },
    {
      id: 'l2',
      label: 'Audit',
      description: '',
      quantity: 1,
      unitPrice: 1000,
      vatRate: 20,
      orderIndex: 1,
    },
  ]);
  assert.equal(lines[0].lineTotal, 300);
  assert.equal(lines[0].vatRate, 0);
  assert.equal(subtotal, 1300);
  assert.equal(vatAmount, 0);
  assert.equal(total, 1300);

  const nextNum = getNextSequenceNumber(
    [],
    ['DEV-ABC-2026-0001', 'DEV-ABC-2026-0002'],
    'DEV',
    'arena-business-center',
    'ABC',
    2026
  );
  assert.equal(nextNum.number, 'DEV-ABC-2026-0003');
  assert.equal(nextNum.nextCounter.lastSequence, 3);
});

test('Invoice status transitions automatically with payments and due dates', () => {
  const baseInvoice: Invoice = {
    id: 'inv-1',
    entityId: 'arena-business-center',
    contactId: 'ct-1',
    companyId: 'comp-1',
    invoiceNumber: 'FAC-ABC-2026-0001',
    status: 'Émise',
    issueDate: '2026-10-01',
    dueDate: '2026-11-20',
    currency: 'EUR',
    subtotal: 1000,
    vatAmount: 200,
    total: 1200,
    paidAmount: 0,
    remainingAmount: 1200,
    legalMentions: '',
    notes: '',
    createdByUid: 'u1',
    createdAt: '2026-10-01T10:00:00Z',
    updatedAt: '2026-10-01T10:00:00Z',
  };

  assert.equal(resolveInvoiceStatus(baseInvoice, '2026-11-25'), 'En retard');

  const partialPay: Payment[] = [
    {
      id: 'pay-1',
      invoiceId: 'inv-1',
      entityId: 'arena-business-center',
      amount: 500,
      paymentDate: '2026-11-10',
      paymentMethod: 'Virement',
      reference: 'VIR-1',
      recordedByUid: 'u1',
      notes: '',
      createdAt: '2026-11-10T10:00:00Z',
    },
  ];
  const afterPartial = recalculateInvoiceWithPayments(baseInvoice, partialPay, '2026-11-13');
  assert.equal(afterPartial.status, 'Payée partiellement');
  assert.equal(afterPartial.remainingAmount, 700);

  const fullPay: Payment[] = [
    ...partialPay,
    {
      id: 'pay-2',
      invoiceId: 'inv-1',
      entityId: 'arena-business-center',
      amount: 700,
      paymentDate: '2026-11-12',
      paymentMethod: 'Virement',
      reference: 'VIR-2',
      recordedByUid: 'u1',
      notes: '',
      createdAt: '2026-11-12T10:00:00Z',
    },
  ];
  const afterFull = recalculateInvoiceWithPayments(baseInvoice, fullPay, '2026-11-13');
  assert.equal(afterFull.status, 'Payée');
  assert.equal(afterFull.remainingAmount, 0);
});

test('Sequence metrics, unified history, and financial reporting aggregate accurately', () => {
  const steps: SequenceStep[] = [
    { id: 's1', sequenceId: 'seq-1', entityId: 'improveo', order: 0, channel: 'call', delayDays: 0, title: 'Appel', description: '' },
    { id: 's2', sequenceId: 'seq-1', entityId: 'improveo', order: 1, channel: 'whatsapp', delayDays: 2, title: 'WA', description: '' },
  ];
  const enrollments: SequenceEnrollment[] = [
    {
      id: 'e1',
      sequenceId: 'seq-1',
      leadId: 'l1',
      contactId: 'ct-1',
      entityId: 'improveo',
      enrolledAt: '2026-11-01',
      currentStep: 1,
      status: 'active',
      nextActionDate: '2026-11-14',
      callsMade: 1,
      meetingsBooked: 1,
      repliesReceived: 1,
      updatedAt: '2026-11-10',
    },
  ];
  const seqStats = computeSequenceMetrics(enrollments, steps);
  assert.equal(seqStats.responseRate, 100);
  assert.equal(seqStats.callsMade, 1);

  const deals: Deal[] = [
    {
      id: 'd1',
      entityId: 'improveo',
      prospectId: 'p1',
      contactId: 'ct-1',
      companyId: 'comp-1',
      name: 'Opp perdue',
      stage: 'Perdu',
      stageId: 'stage-improveo-perdu',
      pipelineId: 'pipeline-improveo',
      amount: 9000,
      currency: 'EUR',
      probability: 0,
      expectedCloseDate: '2026-11-05',
      ownerUid: 'u1',
      status: 'lost',
      lostReason: 'Prix',
      notes: '',
      createdAt: '2026-11-01T10:00:00Z',
      updatedAt: '2026-11-05T10:00:00Z',
    },
  ];
  const losses = computeLossReasonsBreakdown(deals);
  assert.equal(losses.length, 1);
  assert.equal(losses[0].reason, 'Prix');
  assert.equal(losses[0].amount, 9000);

  const quotes: Quote[] = [
    {
      id: 'q1',
      entityId: 'improveo',
      contactId: 'ct-1',
      companyId: 'comp-1',
      quoteNumber: 'DEV-IMP-2026-0001',
      status: 'Accepté',
      issueDate: '2026-11-01',
      validUntil: '2026-12-01',
      currency: 'EUR',
      subtotal: 1000,
      vatAmount: 200,
      total: 1200,
      notes: '',
      legalMentions: '',
      createdByUid: 'u1',
      createdAt: '2026-11-01T10:00:00Z',
      updatedAt: '2026-11-02T10:00:00Z',
    },
  ];
  const invoices: Invoice[] = [
    {
      id: 'inv-1',
      entityId: 'improveo',
      contactId: 'ct-1',
      companyId: 'comp-1',
      quoteId: 'q1',
      invoiceNumber: 'FAC-IMP-2026-0001',
      status: 'Payée',
      issueDate: '2026-11-03',
      dueDate: '2026-12-03',
      currency: 'EUR',
      subtotal: 1000,
      vatAmount: 200,
      total: 1200,
      paidAmount: 1200,
      remainingAmount: 0,
      legalMentions: '',
      notes: '',
      createdByUid: 'u1',
      createdAt: '2026-11-03T10:00:00Z',
      updatedAt: '2026-11-04T10:00:00Z',
    },
  ];
  const payments: Payment[] = [
    {
      id: 'pay-1',
      invoiceId: 'inv-1',
      entityId: 'improveo',
      amount: 1200,
      paymentDate: '2026-11-04',
      paymentMethod: 'Virement',
      reference: 'VIR-9',
      recordedByUid: 'u1',
      notes: '',
      createdAt: '2026-11-04T10:00:00Z',
    },
  ];

  const kpis = computeFinanceKpis({
    quotes,
    invoices,
    payments,
    opportunities: deals,
    referenceDateIso: '2026-11-13',
  });
  assert.equal(kpis.collectedRevenue, 1200);
  assert.equal(kpis.billedRevenue, 1200);
  assert.equal(kpis.quotesAccepted, 1);
  assert.equal(kpis.invoicesPaid, 1);

  const revByEntity = computeRevenueByEntity(invoices, payments, ENTITIES);
  assert.equal(revByEntity.find((e) => e.entityId === 'improveo')?.collected, 1200);

  const hist = buildUnifiedClientHistory({
    contactId: 'ct-1',
    actions: [],
    opportunities: deals,
    quotes,
    invoices,
    payments,
    complaints: [],
    serviceRequests: [],
    enrollments,
    auditLogs: [],
  });
  assert.equal(hist.length, 5);
  const paymentHist = hist.find((h) => h.category === 'payment');
  assert.equal(paymentHist?.currency, 'EUR');
});

test('Product margin, tiered pricing, SKU uniqueness, and validation work accurately', () => {
  const margin = computeProductMargin(100000, 40000);
  assert.equal(margin.unitMargin, 60000);
  assert.equal(margin.marginRate, 60);

  const tieredProduct = {
    price: 250000,
    pricingType: 'tiered' as const,
    pricingTiers: [
      { minQty: 10, maxQty: null, unitPrice: 200000 },
      { minQty: 1, maxQty: 4, unitPrice: 250000 },
      { minQty: 5, maxQty: 9, unitPrice: 225000 },
    ],
  };
  assert.equal(resolveProductUnitPrice(tieredProduct, 2), 250000);
  assert.equal(resolveProductUnitPrice(tieredProduct, 6), 225000);
  assert.equal(resolveProductUnitPrice(tieredProduct, 15), 200000);

  const fixedProduct = {
    price: 180000,
    pricingType: 'fixed' as const,
    pricingTiers: [],
  };
  assert.equal(resolveProductUnitPrice(fixedProduct, 20), 180000);

  const existing = [{ id: 'p1', sku: 'ABC-DOM-001' }];
  assert.equal(isSkuUnique(existing, 'abc-dom-001'), false);
  assert.equal(isSkuUnique(existing, 'abc-dom-001', 'p1'), true);
  assert.equal(isSkuUnique(existing, 'ABC-DOM-002'), true);

  assert.ok(
    validateProductInput(
      {
        name: 'Bureau',
        sku: 'ABC-DOM-001',
        price: 100000,
        unitCost: 50000,
        pricingType: 'fixed',
      },
      existing
    )
  );
  assert.ok(
    validateProductInput(
      {
        name: 'Bureau',
        sku: 'ABC-NEW-002',
        price: 100000,
        unitCost: 50000,
        pricingType: 'tiered',
        pricingTiers: [{ minQty: 10, maxQty: 5, unitPrice: 90000 }],
      },
      existing
    )
  );
  assert.ok(
    validateProductInput(
      {
        name: 'Bureau',
        sku: 'ABC-NEW-002',
        price: 100000,
        unitCost: 50000,
        pricingType: 'fixed',
        productUrl: 'ftp://invalid.example',
      },
      existing
    )
  );
  assert.equal(
    validateProductInput(
      {
        name: 'Bureau',
        sku: 'ABC-NEW-002',
        price: 100000,
        unitCost: 50000,
        pricingType: 'tiered',
        pricingTiers: [{ minQty: 1, maxQty: 5, unitPrice: 100000 }],
        productUrl: 'https://arenagroup.mg/produit',
      },
      existing
    ),
    null
  );
});

test('computeInvoiceTotals handles standard, deposit percentage, and balance deduction', () => {
  const lines = [
    {
      id: 'l1',
      label: 'Pack Bureau',
      description: '',
      quantity: 2,
      unitPrice: 5000000,
      vatRate: 0,
      orderIndex: 0,
    },
  ];

  const standard = computeInvoiceTotals(lines, { invoiceType: 'standard' });
  assert.equal(standard.invoiceType, 'standard');
  assert.equal(standard.subtotal, 10000000);
  assert.equal(standard.depositPercentage, 100);
  assert.equal(standard.deductedDepositAmount, 0);
  assert.equal(standard.total, 10000000);

  const deposit70 = computeInvoiceTotals(lines, {
    invoiceType: 'deposit',
    depositPercentage: 70,
  });
  assert.equal(deposit70.invoiceType, 'deposit');
  assert.equal(deposit70.subtotal, 10000000);
  assert.equal(deposit70.depositPercentage, 70);
  assert.equal(deposit70.deductedDepositAmount, 0);
  assert.equal(deposit70.total, 7000000);

  const balance = computeInvoiceTotals(lines, {
    invoiceType: 'standard',
    deductedDepositAmount: 7000000,
  });
  assert.equal(balance.invoiceType, 'standard');
  assert.equal(balance.subtotal, 10000000);
  assert.equal(balance.deductedDepositAmount, 7000000);
  assert.equal(balance.total, 3000000);

  const flooredBalance = computeInvoiceTotals(lines, {
    invoiceType: 'standard',
    deductedDepositAmount: 15000000,
  });
  assert.equal(flooredBalance.deductedDepositAmount, 10000000);
  assert.equal(flooredBalance.total, 0);
});

test('getPaidDepositInvoicesForClient filters paid deposit invoices matching client', () => {
  const makeInv = (overrides: Partial<Invoice>): Invoice => ({
    id: 'inv-x',
    entityId: 'arena-business-center',
    contactId: 'c1',
    companyId: 'co1',
    invoiceNumber: 'FAC-ABC-2026-0001',
    invoiceType: 'deposit',
    depositPercentage: 30,
    status: 'Payée',
    issueDate: '2026-11-10',
    dueDate: '2026-11-20',
    currency: 'MGA',
    subtotal: 1000000,
    vatAmount: 0,
    total: 300000,
    paidAmount: 300000,
    remainingAmount: 0,
    legalMentions: '',
    notes: '',
    createdByUid: 'u1',
    createdAt: '2026-11-10T10:00:00Z',
    updatedAt: '2026-11-10T10:00:00Z',
    ...overrides,
  });

  const invoices: Invoice[] = [
    makeInv({ id: 'paid-dep-c1', invoiceNumber: 'FAC-ABC-2026-0001' }),
    makeInv({ id: 'unpaid-dep-c1', status: 'Émise', paidAmount: 0, remainingAmount: 300000 }),
    makeInv({ id: 'paid-std-c1', invoiceType: 'standard', depositPercentage: 100 }),
    makeInv({ id: 'paid-dep-other', contactId: 'c2', companyId: 'co2' }),
    makeInv({ id: 'paid-dep-b2c', contactId: 'c3', companyId: '' }),
  ];

  const matchCo1 = getPaidDepositInvoicesForClient(invoices, {
    companyId: 'co1',
    contactId: 'c1',
    todayIso: '2026-11-15',
  });
  assert.deepEqual(
    matchCo1.map((i) => i.id),
    ['paid-dep-c1']
  );

  const excludedSelf = getPaidDepositInvoicesForClient(invoices, {
    companyId: 'co1',
    contactId: 'c1',
    excludeInvoiceId: 'paid-dep-c1',
    todayIso: '2026-11-15',
  });
  assert.equal(excludedSelf.length, 0);

  const matchB2C = getPaidDepositInvoicesForClient(invoices, {
    contactId: 'c3',
    todayIso: '2026-11-15',
  });
  assert.deepEqual(
    matchB2C.map((i) => i.id),
    ['paid-dep-b2c']
  );
});

test('Balance invoice: computeInvoiceTotals, entity deposit filtering, line cloning, and display labels', () => {
  const lines = [
    {
      id: 'l1',
      label: 'Domiciliation annuelle',
      description: 'Pack complet',
      quantity: 1,
      unitPrice: 51000000,
      vatRate: 0,
      orderIndex: 0,
    },
  ];

  const balanceTotals = computeInvoiceTotals(lines, {
    invoiceType: 'balance',
    depositPercentage: 30,
    deductedDepositAmount: 15300000,
  });
  assert.equal(balanceTotals.invoiceType, 'balance');
  assert.equal(balanceTotals.subtotal, 51000000);
  assert.equal(balanceTotals.depositPercentage, 30);
  assert.equal(balanceTotals.deductedDepositAmount, 15300000);
  assert.equal(balanceTotals.total, 35700000);

  const makeDep = (overrides: Partial<Invoice>): Invoice => ({
    id: 'dep-x',
    entityId: 'arena-business-center',
    contactId: 'c1',
    companyId: 'co1',
    invoiceNumber: 'FAC-ABC-2026-0001',
    invoiceType: 'deposit',
    depositPercentage: 30,
    status: 'Payée',
    issueDate: '2026-11-10',
    dueDate: '2026-11-20',
    currency: 'MGA',
    subtotal: 51000000,
    vatAmount: 0,
    total: 15300000,
    paidAmount: 15300000,
    remainingAmount: 0,
    legalMentions: '',
    notes: '',
    createdByUid: 'u1',
    createdAt: '2026-11-10T10:00:00Z',
    updatedAt: '2026-11-10T10:00:00Z',
    ...overrides,
  });

  const allInvoices: Invoice[] = [
    makeDep({ id: 'dep-abc-paid', entityId: 'arena-business-center', status: 'Payée' }),
    makeDep({ id: 'dep-abc-issued', entityId: 'arena-business-center', status: 'Émise', paidAmount: 0, remainingAmount: 15300000 }),
    makeDep({ id: 'dep-abc-draft', entityId: 'arena-business-center', status: 'Brouillon' }),
    makeDep({ id: 'dep-abc-cancelled', entityId: 'arena-business-center', status: 'Annulée' }),
    makeDep({ id: 'std-abc', entityId: 'arena-business-center', invoiceType: 'standard', depositPercentage: 100 }),
    makeDep({ id: 'dep-imp-paid', entityId: 'improveo', invoiceNumber: 'FAC-IMP-2026-0001' }),
  ];

  const abcDeposits = getDepositInvoicesForEntity(allInvoices, {
    entityId: 'arena-business-center',
  });
  assert.deepEqual(
    abcDeposits.map((i) => i.id),
    ['dep-abc-paid', 'dep-abc-issued']
  );

  const impDeposits = getDepositInvoicesForEntity(allInvoices, {
    entityId: 'improveo',
  });
  assert.deepEqual(
    impDeposits.map((i) => i.id),
    ['dep-imp-paid']
  );

  const cloned = buildBalanceLinesFromDepositItems(
    [
      {
        invoiceId: 'dep-abc-paid',
        productId: 'prod-1',
        label: 'Domiciliation',
        description: 'Ligne B',
        quantity: 2,
        unitPrice: 1000000,
        orderIndex: 1,
      },
      {
        invoiceId: 'dep-abc-paid',
        label: 'Frais dossier',
        description: 'Ligne A',
        quantity: 1,
        unitPrice: 500000,
        orderIndex: 0,
      },
      {
        invoiceId: 'dep-imp-paid',
        label: 'Autre entité',
        quantity: 1,
        unitPrice: 900000,
        orderIndex: 0,
      },
    ],
    'dep-abc-paid'
  );
  assert.equal(cloned.length, 2);
  assert.equal(cloned[0].label, 'Frais dossier');
  assert.equal(cloned[1].label, 'Domiciliation');
  assert.equal(cloned[1].productId, 'prod-1');

  const balanceSpec = getInvoiceTotalsDisplaySpec({
    kind: 'invoice',
    invoiceType: 'balance',
    subtotal: 51000000,
    depositPercentage: 30,
    deductedDepositAmount: 15300000,
  });
  assert.equal(balanceSpec.docTitle, 'FACTURE DE SOLDE');
  assert.equal(balanceSpec.depositRowLabel, 'ACOMPTE PAYÉ (30%)');
  assert.equal(balanceSpec.netLabel, 'NET À PAYER');

  const depositSpec = getInvoiceTotalsDisplaySpec({
    kind: 'invoice',
    invoiceType: 'deposit',
    subtotal: 51000000,
    depositPercentage: 30,
  });
  assert.equal(depositSpec.docTitle, "FACTURE D'ACOMPTE");
  assert.equal(depositSpec.depositRowLabel, 'ACOMPTE FACTURÉ (30%)');
  assert.equal(depositSpec.netLabel, 'NET À PAYER');

  assert.equal(getDocumentAmountInWordsPrefix('quote'), 'Arrêté le présent devis à la somme de ');
  assert.equal(
    getDocumentAmountInWordsPrefix('invoice'),
    'Arrêtée la présente facture à la somme de '
  );
  assert.equal(shouldRenderStampAndSignature('quote'), false);
  assert.equal(shouldRenderStampAndSignature('invoice'), true);
});

test('Client fiscal info displays CIN for individuals and NIF/STAT/RCS for affiliated companies', () => {
  const individualInfo = getClientFiscalInfo(null, { cin: ' 101 251 004 812 ' });
  assert.equal(individualInfo.isIndividual, true);
  assert.deepEqual(individualInfo.lines, [{ label: 'CIN', value: '101 251 004 812' }]);

  const individualWithoutCin = getClientFiscalInfo(undefined, { cin: '' });
  assert.equal(individualWithoutCin.isIndividual, true);
  assert.deepEqual(individualWithoutCin.lines, [{ label: 'CIN', value: '' }]);

  const companyInfo = getClientFiscalInfo(
    {
      legalName: 'Véranda Lumière SAS',
      nif: '4001234567',
      stat: '46101 11 2020 0 10012',
      rcs: 'RCS Antananarivo 2020 B 00123',
    },
    { cin: '101 251 004 812' }
  );
  assert.equal(companyInfo.isIndividual, false);
  assert.deepEqual(companyInfo.lines, [
    { label: 'NIF', value: '4001234567' },
    { label: 'STAT', value: '46101 11 2020 0 10012' },
    { label: 'RCS', value: 'RCS Antananarivo 2020 B 00123' },
  ]);
});

test('formatInlineAddress formats "Adresse, Ville, Pays" on one line and omits commas for empty fields', () => {
  assert.equal(
    formatInlineAddress('Lot III V 19 A Anosizato Est I', '101 Antananarivo', 'Madagascar'),
    'Lot III V 19 A Anosizato Est I, 101 Antananarivo, Madagascar'
  );
  assert.equal(
    formatInlineAddress('', '101 Antananarivo', 'Madagascar'),
    '101 Antananarivo, Madagascar'
  );
  assert.equal(
    formatInlineAddress('Lot III V 19 A Anosizato Est I', '', 'Madagascar'),
    'Lot III V 19 A Anosizato Est I, Madagascar'
  );
  assert.equal(
    formatInlineAddress('Lot III V 19 A Anosizato Est I', '101 Antananarivo', ''),
    'Lot III V 19 A Anosizato Est I, 101 Antananarivo'
  );
  assert.equal(formatInlineAddress('   ', undefined, 'Madagascar'), 'Madagascar');
  assert.equal(formatInlineAddress('', '   ', null), '');
  assert.equal(
    formatInlineAddress('Lot III V 19 A,', ' 101 Antananarivo ', 'Madagascar'),
    'Lot III V 19 A, 101 Antananarivo, Madagascar'
  );
});

test('buildCatalogOptions deduplicates defaults, existing product values, and custom additions', () => {
  const folderOpts = buildCatalogOptions(
    ['Domiciliation Tana', 'hébergement & bureaux', '   '],
    DEFAULT_PRODUCT_FOLDERS,
    'Archive 2026'
  );
  assert.ok(folderOpts.includes('Catalogue général'));
  assert.ok(folderOpts.includes('Domiciliation Tana'));
  assert.ok(folderOpts.includes('Archive 2026'));
  assert.equal(
    folderOpts.filter((f) => f.toLowerCase() === 'hébergement & bureaux').length,
    1
  );

  const categoryOpts = buildCatalogOptions(
    ['Pack VIP', 'services'],
    DEFAULT_PRODUCT_CATEGORIES,
    'Événementiel'
  );
  assert.ok(categoryOpts.includes('Services'));
  assert.ok(categoryOpts.includes('Pack VIP'));
  assert.ok(categoryOpts.includes('Événementiel'));
  assert.equal(
    categoryOpts.filter((c) => c.toLowerCase() === 'services').length,
    1
  );
});

test('Managed catalog folders & categories support autonomous add, rename, and permanent removal of defaults', () => {
  // When unconfigured (undefined), falls back to defaults + existing product values
  const initial = getManagedCatalogList(undefined, DEFAULT_PRODUCT_FOLDERS, ['Custom A']);
  assert.ok(initial.includes('Catalogue général'));
  assert.ok(initial.includes('Artisanat & Décoration'));
  assert.ok(initial.includes('Custom A'));

  // Remove a default folder -> once configured, it does NOT reappear from defaults
  const afterRemove = removeManagedCatalogValue(initial, 'Artisanat & Décoration');
  assert.equal(afterRemove.includes('Artisanat & Décoration'), false);
  const resolvedAfterRemove = resolveManagedCatalogOptions(
    afterRemove,
    DEFAULT_PRODUCT_FOLDERS,
    ['Artisanat & Décoration']
  );
  assert.equal(resolvedAfterRemove.includes('Artisanat & Décoration'), false);

  // Add & rename cleanly with case-insensitive deduplication
  const afterAdd = addManagedCatalogValue(afterRemove, 'Coworking VIP');
  assert.ok(afterAdd.includes('Coworking VIP'));
  const afterRename = renameManagedCatalogValue(afterAdd, 'Coworking VIP', 'Espaces Coworking');
  assert.equal(afterRename.includes('Coworking VIP'), false);
  assert.ok(afterRename.includes('Espaces Coworking'));
});

test('parseFormattedDescriptionLines preserves line breaks, dashes, indentation, and internal blank lines', () => {
  assert.deepEqual(parseFormattedDescriptionLines(''), []);
  assert.deepEqual(parseFormattedDescriptionLines('   \n  '), []);

  const parsed = parseFormattedDescriptionLines(
    'Prestation complète :\n- Domiciliation commerciale\n  - Notification WhatsApp\n\n• Accès salle de réunion'
  );
  assert.equal(parsed.length, 5);
  assert.deepEqual(parsed[0], {
    kind: 'text',
    raw: 'Prestation complète :',
    content: 'Prestation complète :',
    indentLevel: 0,
  });
  assert.deepEqual(parsed[1], {
    kind: 'bullet',
    raw: '- Domiciliation commerciale',
    bullet: '-',
    content: 'Domiciliation commerciale',
    indentLevel: 0,
  });
  assert.deepEqual(parsed[2], {
    kind: 'bullet',
    raw: '  - Notification WhatsApp',
    bullet: '-',
    content: 'Notification WhatsApp',
    indentLevel: 1,
  });
  assert.equal(parsed[3].kind, 'blank');
  assert.deepEqual(parsed[4], {
    kind: 'bullet',
    raw: '• Accès salle de réunion',
    bullet: '•',
    content: 'Accès salle de réunion',
    indentLevel: 0,
  });
});

test('computeRemovedLineItemIds identifies deleted quote/invoice items while preserving kept and newly added lines', () => {
  const existing = [{ id: 'ii-1' }, { id: 'ii-2' }, { id: 'ii-3' }, { id: 'ii-2' }];
  const next = [{ id: 'ii-1' }, { id: 'ii-3' }, { id: 'il-new-4' }, { id: undefined }];
  assert.deepEqual(computeRemovedLineItemIds(existing, next), ['ii-2']);
  assert.deepEqual(computeRemovedLineItemIds(existing, [{ id: 'ii-1' }]), ['ii-2', 'ii-3']);
  assert.deepEqual(computeRemovedLineItemIds(existing, existing), []);
});
