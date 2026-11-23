import type {
  Company,
  Contact,
  CrmEntity,
  Invoice,
  InvoiceApprovalStatus,
  InvoiceItem,
  Payment,
  Quote,
  QuoteItem,
} from '../types';
import {
  computeEuroConversion,
  getEffectiveInvoiceApprovalStatus,
  getEntityShortCode,
  resolveInvoiceStatus,
  roundCurrency,
} from './billingLogic';

export type AccountingReportScope = 'both' | 'invoices' | 'quotes';
export type AccountingReportGranularity = 'document' | 'line';

export interface AccountingReportFilter {
  scope: AccountingReportScope;
  entityId: string; // 'all' | entityId
  dateFrom?: string;
  dateTo?: string;
  includeInactive?: boolean;
  granularity: AccountingReportGranularity;
  referenceDateIso?: string;
}

export interface AccountingReportRow {
  rowId: string;
  documentId: string;
  documentCategory: 'Facture' | 'Devis';
  documentSubType: 'Facture standard' | "Facture d'acompte" | 'Facture de solde' | 'Devis';
  documentNumber: string;
  entityId: string;
  entityCode: string;
  entityName: string;
  issueDate: string;
  dueOrValidDate: string;
  clientName: string;
  contactName: string;
  clientNif: string;
  clientStat: string;
  clientRcs: string;
  status: string;
  approvalStatus: string;
  linkedReference: string;
  currency: string;
  subtotal: number;
  depositPercentage: number | null;
  deductedDepositAmount: number;
  vatAmount: number;
  netTotal: number;
  paidAmount: number;
  remainingAmount: number;
  euroRate: number | null;
  euroEquivalent: number | null;
  lastPaymentDate: string;
  paymentMethods: string;
  paymentReferences: string;
  itemsSummary: string;
  // Granular line fields (populated in 'line' mode, empty/null in 'document' mode)
  lineIndex: number | null;
  lineLabel: string;
  lineDescription: string;
  lineQuantity: number | null;
  lineUnitPrice: number | null;
  lineTotal: number | null;
  notes: string;
}

export interface AccountingCurrencySummary {
  currency: string;
  invoiceCount: number;
  invoicesSubtotal: number;
  invoicesDeductedDeposits: number;
  invoicesNetTotal: number;
  invoicesPaid: number;
  invoicesRemaining: number;
  quoteCount: number;
  quotesTotal: number;
  quotesConvertedCount: number;
}

export interface AccountingReportResult {
  rows: AccountingReportRow[];
  totalDocuments: number;
  invoiceCount: number;
  quoteCount: number;
  lineCount: number;
  totalsByCurrency: AccountingCurrencySummary[];
  generatedAtIso: string;
}

const APPROVAL_FR: Record<InvoiceApprovalStatus, string> = {
  approved: 'Validée',
  pending_approval: 'En attente validation',
  rejected: 'Refusée',
};

function isDateInRange(isoDate: string | undefined, dateFrom?: string, dateTo?: string): boolean {
  const day = (isoDate || '').slice(0, 10);
  if (!day) return !dateFrom && !dateTo;
  if (dateFrom && day < dateFrom) return false;
  if (dateTo && day > dateTo) return false;
  return true;
}

function formatLineSummary(
  items: Array<{ label: string; quantity: number; lineTotal: number }>
): string {
  if (items.length === 0) return '';
  return items
    .map((item) => `${item.label} (x${item.quantity})`)
    .join(' | ');
}

export function compileAccountingReport(
  params: {
    entities: CrmEntity[];
    invoices: Invoice[];
    invoiceItems: InvoiceItem[];
    quotes: Quote[];
    quoteItems: QuoteItem[];
    payments: Payment[];
    companies: Company[];
    contacts: Contact[];
  },
  filter: AccountingReportFilter
): AccountingReportResult {
  const {
    entities,
    invoices,
    invoiceItems,
    quotes,
    quoteItems,
    payments,
    companies,
    contacts,
  } = params;

  const referenceDateIso = filter.referenceDateIso ?? new Date().toISOString();
  const includeInactive = Boolean(filter.includeInactive);

  const entityMap = new Map(entities.map((e) => [e.id, e]));
  const companyMap = new Map(companies.map((c) => [c.id, c]));
  const contactMap = new Map(contacts.map((c) => [c.id, c]));
  const invoiceMap = new Map(invoices.map((i) => [i.id, i]));
  const quoteMap = new Map(quotes.map((q) => [q.id, q]));

  const rows: AccountingReportRow[] = [];
  const currencyMap = new Map<string, AccountingCurrencySummary>();

  const getCurrencyBucket = (currency: string): AccountingCurrencySummary => {
    const code = (currency || 'MGA').toUpperCase();
    let bucket = currencyMap.get(code);
    if (!bucket) {
      bucket = {
        currency: code,
        invoiceCount: 0,
        invoicesSubtotal: 0,
        invoicesDeductedDeposits: 0,
        invoicesNetTotal: 0,
        invoicesPaid: 0,
        invoicesRemaining: 0,
        quoteCount: 0,
        quotesTotal: 0,
        quotesConvertedCount: 0,
      };
      currencyMap.set(code, bucket);
    }
    return bucket;
  };

  let invoiceCount = 0;
  let quoteCount = 0;
  let lineCount = 0;

  if (filter.scope === 'both' || filter.scope === 'invoices') {
    const matchingInvoices = invoices
      .filter((inv) => {
        if (filter.entityId !== 'all' && inv.entityId !== filter.entityId) return false;
        if (!isDateInRange(inv.issueDate || inv.createdAt, filter.dateFrom, filter.dateTo)) {
          return false;
        }
        const effectiveStatus = resolveInvoiceStatus(inv, referenceDateIso);
        if (!includeInactive && (effectiveStatus === 'Brouillon' || effectiveStatus === 'Annulée')) {
          return false;
        }
        return true;
      })
      .sort((a, b) => (a.issueDate || a.createdAt).localeCompare(b.issueDate || b.createdAt));

    for (const inv of matchingInvoices) {
      invoiceCount += 1;
      const entity = entityMap.get(inv.entityId);
      const entityCode = getEntityShortCode(inv.entityId, entities);
      const entityName = entity?.name ?? inv.entityId;
      const company = inv.companyId ? companyMap.get(inv.companyId) : undefined;
      const contact = inv.contactId ? contactMap.get(inv.contactId) : undefined;
      const effectiveStatus = resolveInvoiceStatus(inv, referenceDateIso);
      const effectiveApproval = getEffectiveInvoiceApprovalStatus(inv);

      const isDeposit = inv.invoiceType === 'deposit';
      const isBalance =
        inv.invoiceType === 'balance' ||
        (!isDeposit && Boolean(inv.deductedDepositAmount && inv.deductedDepositAmount > 0));

      const documentSubType: AccountingReportRow['documentSubType'] = isDeposit
        ? "Facture d'acompte"
        : isBalance
        ? 'Facture de solde'
        : 'Facture standard';

      const linkedDeposit = inv.deductedDepositInvoiceId
        ? invoiceMap.get(inv.deductedDepositInvoiceId)
        : undefined;
      const linkedQuote = inv.quoteId ? quoteMap.get(inv.quoteId) : undefined;

      const linkedRefs: string[] = [];
      if (linkedQuote) linkedRefs.push(`Devis ${linkedQuote.quoteNumber}`);
      if (linkedDeposit) linkedRefs.push(`Acompte ${linkedDeposit.invoiceNumber}`);

      const depositPct = isDeposit
        ? inv.depositPercentage ?? 100
        : isBalance
        ? inv.depositPercentage && inv.depositPercentage < 100
          ? inv.depositPercentage
          : linkedDeposit?.depositPercentage ??
            (inv.subtotal > 0 && inv.deductedDepositAmount
              ? Math.round((inv.deductedDepositAmount / inv.subtotal) * 100)
              : null)
        : null;

      const euroConv = inv.showEuroConversion
        ? computeEuroConversion(inv.total, inv.euroExchangeRate)
        : null;

      const invPayments = payments
        .filter((p) => p.invoiceId === inv.id)
        .sort((a, b) => (a.paymentDate || a.createdAt).localeCompare(b.paymentDate || b.createdAt));

      const lastPaymentDate =
        invPayments.length > 0
          ? (invPayments[invPayments.length - 1].paymentDate || '').slice(0, 10)
          : '';
      const paymentMethods = Array.from(
        new Set(invPayments.map((p) => p.paymentMethod).filter(Boolean))
      ).join(', ');
      const paymentReferences = Array.from(
        new Set(invPayments.map((p) => p.reference?.trim()).filter(Boolean))
      ).join(', ');

      const items = invoiceItems
        .filter((it) => it.invoiceId === inv.id)
        .sort((a, b) => a.orderIndex - b.orderIndex);

      const currency = (inv.currency || 'MGA').toUpperCase();
      const bucket = getCurrencyBucket(currency);
      bucket.invoiceCount += 1;
      bucket.invoicesSubtotal = roundCurrency(bucket.invoicesSubtotal + (Number(inv.subtotal) || 0));
      bucket.invoicesDeductedDeposits = roundCurrency(
        bucket.invoicesDeductedDeposits + (Number(inv.deductedDepositAmount) || 0)
      );
      bucket.invoicesNetTotal = roundCurrency(bucket.invoicesNetTotal + (Number(inv.total) || 0));
      bucket.invoicesPaid = roundCurrency(bucket.invoicesPaid + (Number(inv.paidAmount) || 0));
      bucket.invoicesRemaining = roundCurrency(
        bucket.invoicesRemaining + (Number(inv.remainingAmount) || 0)
      );

      const baseRow: Omit<
        AccountingReportRow,
        'rowId' | 'lineIndex' | 'lineLabel' | 'lineDescription' | 'lineQuantity' | 'lineUnitPrice' | 'lineTotal'
      > = {
        documentId: inv.id,
        documentCategory: 'Facture',
        documentSubType,
        documentNumber: inv.invoiceNumber,
        entityId: inv.entityId,
        entityCode,
        entityName,
        issueDate: (inv.issueDate || inv.createdAt).slice(0, 10),
        dueOrValidDate: (inv.dueDate || '').slice(0, 10),
        clientName: company?.legalName || company?.tradeName || contact?.fullName || 'Particulier',
        contactName: contact?.fullName ?? '',
        clientNif: company?.nif ?? '',
        clientStat: company?.stat ?? '',
        clientRcs: company?.rcs ?? '',
        status: effectiveStatus,
        approvalStatus: APPROVAL_FR[effectiveApproval] ?? effectiveApproval,
        linkedReference: linkedRefs.join(' · '),
        currency,
        subtotal: roundCurrency(Number(inv.subtotal) || 0),
        depositPercentage: depositPct,
        deductedDepositAmount: roundCurrency(Number(inv.deductedDepositAmount) || 0),
        vatAmount: roundCurrency(Number(inv.vatAmount) || 0),
        netTotal: roundCurrency(Number(inv.total) || 0),
        paidAmount: roundCurrency(Number(inv.paidAmount) || 0),
        remainingAmount: roundCurrency(Number(inv.remainingAmount) || 0),
        euroRate: euroConv ? euroConv.exchangeRate : null,
        euroEquivalent: euroConv ? euroConv.euroAmount : null,
        lastPaymentDate,
        paymentMethods,
        paymentReferences,
        itemsSummary: formatLineSummary(items),
        notes: inv.notes ?? '',
      };

      if (filter.granularity === 'line' && items.length > 0) {
        items.forEach((item, idx) => {
          lineCount += 1;
          rows.push({
            ...baseRow,
            rowId: `${inv.id}-line-${item.id || idx}`,
            lineIndex: idx + 1,
            lineLabel: item.label,
            lineDescription: item.description ?? '',
            lineQuantity: Number(item.quantity) || 0,
            lineUnitPrice: roundCurrency(Number(item.unitPrice) || 0),
            lineTotal: roundCurrency(Number(item.lineTotal) || 0),
          });
        });
      } else {
        lineCount += Math.max(1, items.length);
        rows.push({
          ...baseRow,
          rowId: inv.id,
          lineIndex: null,
          lineLabel: '',
          lineDescription: '',
          lineQuantity: null,
          lineUnitPrice: null,
          lineTotal: null,
        });
      }
    }
  }

  if (filter.scope === 'both' || filter.scope === 'quotes') {
    const matchingQuotes = quotes
      .filter((q) => {
        if (filter.entityId !== 'all' && q.entityId !== filter.entityId) return false;
        if (!isDateInRange(q.issueDate || q.createdAt, filter.dateFrom, filter.dateTo)) {
          return false;
        }
        if (
          !includeInactive &&
          (q.status === 'Brouillon' || q.status === 'Refusé' || q.status === 'Expiré')
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => (a.issueDate || a.createdAt).localeCompare(b.issueDate || b.createdAt));

    for (const q of matchingQuotes) {
      quoteCount += 1;
      const entity = entityMap.get(q.entityId);
      const entityCode = getEntityShortCode(q.entityId, entities);
      const entityName = entity?.name ?? q.entityId;
      const company = q.companyId ? companyMap.get(q.companyId) : undefined;
      const contact = q.contactId ? contactMap.get(q.contactId) : undefined;
      const convertedInvoice = q.convertedInvoiceId
        ? invoiceMap.get(q.convertedInvoiceId)
        : undefined;
      const euroConv = q.showEuroConversion
        ? computeEuroConversion(q.total, q.euroExchangeRate)
        : null;

      const items = quoteItems
        .filter((it) => it.quoteId === q.id)
        .sort((a, b) => a.orderIndex - b.orderIndex);

      const currency = (q.currency || 'MGA').toUpperCase();
      const bucket = getCurrencyBucket(currency);
      bucket.quoteCount += 1;
      bucket.quotesTotal = roundCurrency(bucket.quotesTotal + (Number(q.total) || 0));
      if (q.status === 'Converti en facture' || Boolean(q.convertedInvoiceId)) {
        bucket.quotesConvertedCount += 1;
      }

      const baseRow: Omit<
        AccountingReportRow,
        'rowId' | 'lineIndex' | 'lineLabel' | 'lineDescription' | 'lineQuantity' | 'lineUnitPrice' | 'lineTotal'
      > = {
        documentId: q.id,
        documentCategory: 'Devis',
        documentSubType: 'Devis',
        documentNumber: q.quoteNumber,
        entityId: q.entityId,
        entityCode,
        entityName,
        issueDate: (q.issueDate || q.createdAt).slice(0, 10),
        dueOrValidDate: (q.validUntil || '').slice(0, 10),
        clientName: company?.legalName || company?.tradeName || contact?.fullName || 'Particulier',
        contactName: contact?.fullName ?? '',
        clientNif: company?.nif ?? '',
        clientStat: company?.stat ?? '',
        clientRcs: company?.rcs ?? '',
        status: q.status,
        approvalStatus: '—',
        linkedReference: convertedInvoice ? `Facture ${convertedInvoice.invoiceNumber}` : '',
        currency,
        subtotal: roundCurrency(Number(q.subtotal) || 0),
        depositPercentage: null,
        deductedDepositAmount: 0,
        vatAmount: roundCurrency(Number(q.vatAmount) || 0),
        netTotal: roundCurrency(Number(q.total) || 0),
        paidAmount: 0,
        remainingAmount: 0,
        euroRate: euroConv ? euroConv.exchangeRate : null,
        euroEquivalent: euroConv ? euroConv.euroAmount : null,
        lastPaymentDate: '',
        paymentMethods: '',
        paymentReferences: '',
        itemsSummary: formatLineSummary(items),
        notes: q.notes ?? '',
      };

      if (filter.granularity === 'line' && items.length > 0) {
        items.forEach((item, idx) => {
          lineCount += 1;
          rows.push({
            ...baseRow,
            rowId: `${q.id}-line-${item.id || idx}`,
            lineIndex: idx + 1,
            lineLabel: item.label,
            lineDescription: item.description ?? '',
            lineQuantity: Number(item.quantity) || 0,
            lineUnitPrice: roundCurrency(Number(item.unitPrice) || 0),
            lineTotal: roundCurrency(Number(item.lineTotal) || 0),
          });
        });
      } else {
        lineCount += Math.max(1, items.length);
        rows.push({
          ...baseRow,
          rowId: q.id,
          lineIndex: null,
          lineLabel: '',
          lineDescription: '',
          lineQuantity: null,
          lineUnitPrice: null,
          lineTotal: null,
        });
      }
    }
  }

  // Chronological sort across compiled invoices + quotes (issueDate ascending, then category/number)
  rows.sort((a, b) => {
    const d = a.issueDate.localeCompare(b.issueDate);
    if (d !== 0) return d;
    const c = a.documentCategory.localeCompare(b.documentCategory);
    if (c !== 0) return c;
    const n = a.documentNumber.localeCompare(b.documentNumber);
    if (n !== 0) return n;
    return (a.lineIndex ?? 0) - (b.lineIndex ?? 0);
  });

  return {
    rows,
    totalDocuments: invoiceCount + quoteCount,
    invoiceCount,
    quoteCount,
    lineCount,
    totalsByCurrency: Array.from(currencyMap.values()).sort((a, b) =>
      a.currency.localeCompare(b.currency)
    ),
    generatedAtIso: referenceDateIso,
  };
}

function formatCsvNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '';
  const rounded = roundCurrency(value);
  if (Number.isInteger(rounded)) return String(rounded);
  return String(rounded).replace('.', ',');
}

function escapeCsvCell(value: string): string {
  const safe = String(value ?? '').replace(/\r?\n/g, ' ');
  return `"${safe.replace(/"/g, '""')}"`;
}

export function buildAccountingReportCsv(
  report: AccountingReportResult,
  filter: AccountingReportFilter
): string {
  const isLineMode = filter.granularity === 'line';

  const baseHeaders = [
    'Catégorie',
    'Type document',
    'Numéro',
    'Code entité',
    'Entité émettrice',
    'Date émission',
    'Échéance / Validité',
    'Client / Raison sociale',
    'Contact',
    'NIF Client',
    'STAT Client',
    'RCS Client',
    'Statut',
    'Validation',
    'Référence liée',
    'Devise',
    'Total Prestation 100%',
    'Acompte (%)',
    'Acompte déduit',
    'TVA',
    'Net à payer / Total',
    'Encaissé',
    'Reste dû',
    'Cours EUR',
    'Équivalent EUR',
    'Dernier paiement',
    'Modes de paiement',
    'Références règlement',
  ];

  const tailHeaders = isLineMode
    ? [
        'N° Ligne',
        'Prestation / Article',
        'Description ligne',
        'Quantité',
        'Prix unitaire',
        'Total ligne',
        'Notes',
      ]
    : ['Prestations (résumé)', 'Notes'];

  const headers = [...baseHeaders, ...tailHeaders];

  const dataLines = report.rows.map((row) => {
    const baseCells = [
      row.documentCategory,
      row.documentSubType,
      row.documentNumber,
      row.entityCode,
      row.entityName,
      row.issueDate,
      row.dueOrValidDate,
      row.clientName,
      row.contactName,
      row.clientNif,
      row.clientStat,
      row.clientRcs,
      row.status,
      row.approvalStatus,
      row.linkedReference,
      row.currency,
      formatCsvNumber(row.subtotal),
      row.depositPercentage !== null ? formatCsvNumber(row.depositPercentage) : '',
      formatCsvNumber(row.deductedDepositAmount),
      formatCsvNumber(row.vatAmount),
      formatCsvNumber(row.netTotal),
      formatCsvNumber(row.paidAmount),
      formatCsvNumber(row.remainingAmount),
      row.euroRate !== null ? formatCsvNumber(row.euroRate) : '',
      row.euroEquivalent !== null ? formatCsvNumber(row.euroEquivalent) : '',
      row.lastPaymentDate,
      row.paymentMethods,
      row.paymentReferences,
    ];

    const tailCells = isLineMode
      ? [
          row.lineIndex !== null ? String(row.lineIndex) : '',
          row.lineLabel,
          row.lineDescription,
          row.lineQuantity !== null ? formatCsvNumber(row.lineQuantity) : '',
          row.lineUnitPrice !== null ? formatCsvNumber(row.lineUnitPrice) : '',
          row.lineTotal !== null ? formatCsvNumber(row.lineTotal) : '',
          row.notes,
        ]
      : [row.itemsSummary, row.notes];

    return [...baseCells, ...tailCells].map(escapeCsvCell).join(';');
  });

  const summaryHeader = [
    '',
    'SYNTHÈSE COMPTABLE PAR DEVISE',
    'Nb Factures',
    'Total Prestation Factures',
    'Acomptes déduits',
    'Net Facturé',
    'Encaissé',
    'Solde dû',
    'Nb Devis',
    'Total Devis',
    'Devis convertis',
  ]
    .map(escapeCsvCell)
    .join(';');

  const summaryLines = report.totalsByCurrency.map((s) =>
    [
      'TOTAL',
      s.currency,
      String(s.invoiceCount),
      formatCsvNumber(s.invoicesSubtotal),
      formatCsvNumber(s.invoicesDeductedDeposits),
      formatCsvNumber(s.invoicesNetTotal),
      formatCsvNumber(s.invoicesPaid),
      formatCsvNumber(s.invoicesRemaining),
      String(s.quoteCount),
      formatCsvNumber(s.quotesTotal),
      String(s.quotesConvertedCount),
    ]
      .map(escapeCsvCell)
      .join(';')
  );

  const lines = [
    headers.map(escapeCsvCell).join(';'),
    ...dataLines,
    '',
    summaryHeader,
    ...summaryLines,
  ];

  return `\uFEFF${lines.join('\n')}`;
}

export function getAccountingReportFilename(
  filter: AccountingReportFilter,
  entities: CrmEntity[],
  ext: 'csv' | 'pdf'
): string {
  const scopeTag =
    filter.scope === 'both'
      ? 'factures-devis'
      : filter.scope === 'invoices'
      ? 'factures'
      : 'devis';
  const entityTag =
    filter.entityId === 'all'
      ? 'toutes-entites'
      : getEntityShortCode(filter.entityId, entities).toLowerCase();
  const modeTag = filter.granularity === 'line' ? '-detail-lignes' : '';
  const dateTag = (filter.referenceDateIso ?? new Date().toISOString()).slice(0, 10);
  return `reporting-comptable-${scopeTag}-${entityTag}${modeTag}-${dateTag}.${ext}`;
}
