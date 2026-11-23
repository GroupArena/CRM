import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAccountingReportCsv,
  compileAccountingReport,
  getAccountingReportFilename,
  type AccountingReportFilter,
} from './accountingReport';
import { buildAccountingReportPdfDoc } from './accountingReportPdf';
import {
  DEFAULT_ENTITIES,
  DEMO_COMPANIES,
  DEMO_CONTACTS,
  DEMO_INVOICES,
  DEMO_INVOICE_ITEMS,
  DEMO_PAYMENTS,
  DEMO_QUOTES,
  DEMO_QUOTE_ITEMS,
} from '../services/seedData';
import type { Invoice, InvoiceItem } from '../types';

test('compileAccountingReport compiles active invoices and quotes together by default', () => {
  const filter: AccountingReportFilter = {
    scope: 'both',
    entityId: 'all',
    includeInactive: false,
    granularity: 'document',
    referenceDateIso: '2026-11-20T10:00:00Z',
  };

  const report = compileAccountingReport(
    {
      entities: DEFAULT_ENTITIES,
      invoices: DEMO_INVOICES,
      invoiceItems: DEMO_INVOICE_ITEMS,
      quotes: DEMO_QUOTES,
      quoteItems: DEMO_QUOTE_ITEMS,
      payments: DEMO_PAYMENTS,
      companies: DEMO_COMPANIES,
      contacts: DEMO_CONTACTS,
    },
    filter
  );

  // DEMO_INVOICES has 4 invoices, 1 is Brouillon (inv-4) -> 3 active
  // DEMO_QUOTES has 2 quotes (Accepté + Envoyé) -> 2 active
  assert.equal(report.invoiceCount, 3);
  assert.equal(report.quoteCount, 2);
  assert.equal(report.totalDocuments, 5);
  assert.equal(report.rows.length, 5);

  const mgaSummary = report.totalsByCurrency.find((s) => s.currency === 'MGA');
  assert.ok(mgaSummary);
  // inv-1 (57,600,000) + inv-2 (35,000,000) + inv-3 deposit (15,300,000) = 107,900,000
  assert.equal(mgaSummary.invoicesNetTotal, 107900000);
  // inv-1 paid (57,600,000) + inv-2 paid (10,500,000) + inv-3 paid (15,300,000) = 83,400,000
  assert.equal(mgaSummary.invoicesPaid, 83400000);
  assert.equal(mgaSummary.invoicesRemaining, 24500000);
  // quote-1 (51,000,000) + quote-2 (18,500,000) = 69,500,000
  assert.equal(mgaSummary.quotesTotal, 69500000);

  const depositRow = report.rows.find((r) => r.documentNumber === 'FAC-ABC-2026-0001');
  assert.ok(depositRow);
  assert.equal(depositRow.documentSubType, "Facture d'acompte");
  assert.equal(depositRow.depositPercentage, 30);
  assert.equal(depositRow.subtotal, 51000000);
  assert.equal(depositRow.netTotal, 15300000);
  assert.equal(depositRow.linkedReference, 'Devis DEV-ABC-2026-0001');
  assert.ok(depositRow.clientNif.length > 0);
});

test('compileAccountingReport includes drafts/euro conversion and resolves balance invoices cleanly', () => {
  const balanceInvoice: Invoice = {
    id: 'inv-balance-1',
    entityId: 'arena-business-center',
    contactId: 'contact-1',
    companyId: 'comp-1',
    quoteId: 'quote-1',
    invoiceNumber: 'FAC-ABC-2026-0002',
    invoiceType: 'balance',
    depositPercentage: 30,
    deductedDepositInvoiceId: 'inv-3',
    deductedDepositAmount: 15300000,
    status: 'Émise',
    approvalStatus: 'approved',
    issueDate: '2026-11-18',
    dueDate: '2026-12-18',
    currency: 'MGA',
    subtotal: 51000000,
    vatAmount: 0,
    total: 35700000,
    paidAmount: 0,
    remainingAmount: 35700000,
    legalMentions: '',
    notes: 'Solde final après acompte 30%.',
    createdByUid: 'demo-admin-abc',
    createdAt: '2026-11-18T10:00:00Z',
    updatedAt: '2026-11-18T10:00:00Z',
  };
  const balanceItems: InvoiceItem[] = [
    {
      id: 'ii-bal-1',
      invoiceId: 'inv-balance-1',
      entityId: 'arena-business-center',
      label: 'Pack Bureau Privé 3 Postes Équipé',
      description: 'Solde annuel',
      quantity: 12,
      unitPrice: 4250000,
      vatRate: 0,
      lineTotal: 51000000,
      orderIndex: 0,
    },
  ];

  const report = compileAccountingReport(
    {
      entities: DEFAULT_ENTITIES,
      invoices: [...DEMO_INVOICES, balanceInvoice],
      invoiceItems: [...DEMO_INVOICE_ITEMS, ...balanceItems],
      quotes: DEMO_QUOTES,
      quoteItems: DEMO_QUOTE_ITEMS,
      payments: DEMO_PAYMENTS,
      companies: DEMO_COMPANIES,
      contacts: DEMO_CONTACTS,
    },
    {
      scope: 'both',
      entityId: 'all',
      includeInactive: true,
      granularity: 'document',
      referenceDateIso: '2026-11-20T10:00:00Z',
    }
  );

  // 4 demo + 1 balance = 5 invoices; 2 quotes -> 7 documents
  assert.equal(report.invoiceCount, 5);
  assert.equal(report.quoteCount, 2);

  const euroDraftRow = report.rows.find((r) => r.documentNumber === 'FAC-ASC-2026-0002');
  assert.ok(euroDraftRow);
  assert.equal(euroDraftRow.status, 'Brouillon');
  assert.equal(euroDraftRow.approvalStatus, 'En attente validation');
  assert.equal(euroDraftRow.euroRate, 4576);
  assert.equal(euroDraftRow.euroEquivalent, 1007.43);

  const balRow = report.rows.find((r) => r.documentNumber === 'FAC-ABC-2026-0002');
  assert.ok(balRow);
  assert.equal(balRow.documentSubType, 'Facture de solde');
  assert.equal(balRow.deductedDepositAmount, 15300000);
  assert.equal(balRow.netTotal, 35700000);
  assert.ok(balRow.linkedReference.includes('Acompte FAC-ABC-2026-0001'));
});

test('compileAccountingReport filters by entity, scope, date range, and expands line granularity', () => {
  const filter: AccountingReportFilter = {
    scope: 'invoices',
    entityId: 'arena-studio-comm',
    dateFrom: '2026-11-10',
    dateTo: '2026-11-15',
    includeInactive: true,
    granularity: 'line',
    referenceDateIso: '2026-11-20T10:00:00Z',
  };

  const report = compileAccountingReport(
    {
      entities: DEFAULT_ENTITIES,
      invoices: DEMO_INVOICES,
      invoiceItems: DEMO_INVOICE_ITEMS,
      quotes: DEMO_QUOTES,
      quoteItems: DEMO_QUOTE_ITEMS,
      payments: DEMO_PAYMENTS,
      companies: DEMO_COMPANIES,
      contacts: DEMO_CONTACTS,
    },
    filter
  );

  // Only inv-4 matches ASC between 2026-11-10 and 2026-11-15, and inv-4 has 2 items
  assert.equal(report.invoiceCount, 1);
  assert.equal(report.quoteCount, 0);
  assert.equal(report.rows.length, 2);
  assert.equal(report.rows[0].lineLabel, 'Mission de production sur terrain et en post-production');
  assert.equal(report.rows[0].lineTotal, 2860000);
  assert.equal(report.rows[1].lineLabel, 'Frais logistique');
  assert.equal(report.rows[1].lineTotal, 1750000);
});

test('buildAccountingReportCsv, getAccountingReportFilename, and PDF builder produce valid outputs', () => {
  const filter: AccountingReportFilter = {
    scope: 'both',
    entityId: 'all',
    includeInactive: true,
    granularity: 'document',
    referenceDateIso: '2026-11-23T10:00:00Z',
  };
  const report = compileAccountingReport(
    {
      entities: DEFAULT_ENTITIES,
      invoices: DEMO_INVOICES,
      invoiceItems: DEMO_INVOICE_ITEMS,
      quotes: DEMO_QUOTES,
      quoteItems: DEMO_QUOTE_ITEMS,
      payments: DEMO_PAYMENTS,
      companies: DEMO_COMPANIES,
      contacts: DEMO_CONTACTS,
    },
    filter
  );

  const csv = buildAccountingReportCsv(report, filter);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"Catégorie";"Type document";"Numéro"'));
  assert.ok(csv.includes('"SYNTHÈSE COMPTABLE PAR DEVISE"'));
  assert.ok(csv.includes('"1007,43"')); // French decimal comma for Euro equivalent
  assert.ok(csv.includes('"FAC-ASC-2026-0001"'));
  assert.ok(csv.includes('"DEV-ABC-2026-0001"'));

  assert.equal(
    getAccountingReportFilename(filter, DEFAULT_ENTITIES, 'csv'),
    'reporting-comptable-factures-devis-toutes-entites-2026-11-23.csv'
  );
  assert.equal(
    getAccountingReportFilename(
      { ...filter, scope: 'quotes', entityId: 'improveo', granularity: 'line' },
      DEFAULT_ENTITIES,
      'pdf'
    ),
    'reporting-comptable-devis-imp-detail-lignes-2026-11-23.pdf'
  );

  const pdfDoc = buildAccountingReportPdfDoc(report, filter, DEFAULT_ENTITIES);
  const out = pdfDoc.output('arraybuffer');
  assert.ok(out.byteLength > 1000);
});
