import type {
  AuditLog,
  ClientHistoryEntry,
  Company,
  Complaint,
  Contact,
  CrmAction,
  CrmEntity,
  CrmNotification,
  Deal,
  Invoice,
  InvoiceApprovalStatus,
  InvoiceItem,
  InvoiceStatus,
  InvoiceType,
  LostReason,
  NumberingCounter,
  Payment,
  Product,
  Quote,
  QuoteItem,
  SatisfactionSurvey,
  SequenceChannel,
  SequenceEnrollment,
  SequenceStep,
  ServiceRequest,
  UserProfile,
} from '../types';

export const ENTITY_CODES: Record<string, string> = {
  'arena-business-center': 'ABC',
  improveo: 'IMP',
  'arena-studio-comm': 'ASC',
  'maison-artisanat': 'MA',
};

export function getEntityShortCode(entityId: string, entities?: CrmEntity[]): string {
  if (ENTITY_CODES[entityId]) return ENTITY_CODES[entityId];
  const entity = entities?.find((e) => e.id === entityId);
  if (entity) {
    const letters = entity.name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('')
      .slice(0, 4);
    if (letters) return letters;
  }
  return entityId.slice(0, 3).toUpperCase() || 'GRP';
}

export function formatDocumentNumber(
  prefix: 'DEV' | 'FAC',
  entityCode: string,
  year: number,
  sequence: number
): string {
  return `${prefix}-${entityCode}-${year}-${String(sequence).padStart(4, '0')}`;
}

export function getNextSequenceNumber(
  counters: NumberingCounter[],
  existingNumbers: string[],
  prefix: 'DEV' | 'FAC',
  entityId: string,
  entityCode: string,
  year: number
): { number: string; nextCounter: NumberingCounter } {
  const counterId = `${prefix}-${entityCode}-${year}`;
  const currentCounter = counters.find((c) => c.id === counterId);
  let seq = currentCounter?.lastSequence ?? 0;

  const matchingPrefix = `${prefix}-${entityCode}-${year}-`;
  for (const num of existingNumbers) {
    if (num.startsWith(matchingPrefix)) {
      const parsed = Number.parseInt(num.slice(matchingPrefix.length), 10);
      if (!Number.isNaN(parsed) && parsed > seq) {
        seq = parsed;
      }
    }
  }

  const nextSeq = seq + 1;
  return {
    number: formatDocumentNumber(prefix, entityCode, year, nextSeq),
    nextCounter: {
      id: counterId,
      prefix,
      entityId,
      entityCode,
      year,
      lastSequence: nextSeq,
      updatedAt: new Date().toISOString(),
    },
  };
}

// --- Normalisation & Anti-doublon ---
export function normalizeText(value: string | undefined): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function normalizePhone(value: string | undefined): string {
  return (value ?? '').replace(/[^0-9+]/g, '');
}

export function findDuplicateCompanies(
  companies: Company[],
  candidate: { legalName?: string; tradeName?: string; email?: string; phone?: string },
  excludeId?: string
): Company[] {
  const normLegal = normalizeText(candidate.legalName);
  const normTrade = normalizeText(candidate.tradeName);
  const normEmail = (candidate.email ?? '').trim().toLowerCase();
  const normPhone = normalizePhone(candidate.phone);

  return companies.filter((c) => {
    if (excludeId && c.id === excludeId) return false;
    const matchEmail = normEmail && c.email && c.email.trim().toLowerCase() === normEmail;
    const matchPhone =
      normPhone.length >= 6 &&
      (normalizePhone(c.phone) === normPhone || normalizePhone(c.whatsapp) === normPhone);
    const matchName =
      (normLegal.length >= 3 && normalizeText(c.legalName) === normLegal) ||
      (normTrade.length >= 3 &&
        (normalizeText(c.tradeName) === normTrade || normalizeText(c.legalName) === normTrade));
    return Boolean(matchEmail || matchPhone || matchName);
  });
}

export function findDuplicateContacts(
  contacts: Contact[],
  candidate: { fullName?: string; email?: string; phone?: string; whatsapp?: string },
  excludeId?: string
): Contact[] {
  const normName = normalizeText(candidate.fullName);
  const normEmail = (candidate.email ?? '').trim().toLowerCase();
  const normPhone = normalizePhone(candidate.phone);
  const normWa = normalizePhone(candidate.whatsapp);

  return contacts.filter((c) => {
    if (excludeId && c.id === excludeId) return false;
    const matchEmail = normEmail && c.email && c.email.trim().toLowerCase() === normEmail;
    const cPhone = normalizePhone(c.phone);
    const cWa = normalizePhone(c.whatsapp);
    const matchPhone =
      (normPhone.length >= 6 && (cPhone === normPhone || cWa === normPhone)) ||
      (normWa.length >= 6 && (cPhone === normWa || cWa === normWa));
    const matchName = normName.length >= 4 && normalizeText(c.fullName) === normName;
    return Boolean(matchEmail || matchPhone || matchName);
  });
}

export function mergeCompanyRecords(primary: Company, duplicate: Company): Company {
  const tags = Array.from(new Set([...primary.tags, ...duplicate.tags]));
  const combinedNotes = [primary.notes, duplicate.notes]
    .map((s) => s.trim())
    .filter(Boolean)
    .join('\n---\n');
  return {
    ...primary,
    tradeName: primary.tradeName || duplicate.tradeName,
    legalStatus: primary.legalStatus || duplicate.legalStatus,
    nif: primary.nif || duplicate.nif,
    stat: primary.stat || duplicate.stat,
    rcs: primary.rcs || duplicate.rcs || '',
    address: primary.address || duplicate.address,
    city: primary.city || duplicate.city,
    country: primary.country || duplicate.country,
    phone: primary.phone || duplicate.phone,
    whatsapp: primary.whatsapp || duplicate.whatsapp,
    email: primary.email || duplicate.email,
    website: primary.website || duplicate.website,
    primaryContactId: primary.primaryContactId || duplicate.primaryContactId,
    tags,
    notes: combinedNotes,
    isVip: primary.isVip || duplicate.isVip,
    updatedAt: new Date().toISOString(),
  };
}

export function mergeContactRecords(primary: Contact, duplicate: Contact): Contact {
  const tags = Array.from(new Set([...primary.tags, ...duplicate.tags]));
  const combinedNotes = [primary.notes, duplicate.notes]
    .map((s) => s.trim())
    .filter(Boolean)
    .join('\n---\n');
  return {
    ...primary,
    jobTitle: primary.jobTitle || duplicate.jobTitle,
    cin: primary.cin || duplicate.cin || '',
    phone: primary.phone || duplicate.phone,
    whatsapp: primary.whatsapp || duplicate.whatsapp,
    email: primary.email || duplicate.email,
    companyId: primary.companyId || duplicate.companyId,
    isVip: primary.isVip || duplicate.isVip,
    tags,
    consentMarketing: primary.consentMarketing || duplicate.consentMarketing,
    gdprConsentDate: primary.gdprConsentDate || duplicate.gdprConsentDate,
    notes: combinedNotes,
    updatedAt: new Date().toISOString(),
  };
}

// --- Calculs Devis & Factures ---
export interface LineInput {
  id: string;
  productId?: string;
  label: string;
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  orderIndex: number;
}

export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function computeDocumentTotals<T extends LineInput>(lines: T[]): {
  lines: (T & { lineTotal: number })[];
  subtotal: number;
  vatAmount: number;
  total: number;
} {
  let subtotal = 0;

  const normalizedLines = lines.map((line, index) => {
    const qty = Math.max(0, Number(line.quantity) || 0);
    const unitPrice = Math.max(0, Number(line.unitPrice) || 0);
    const lineNet = roundCurrency(qty * unitPrice);
    subtotal = roundCurrency(subtotal + lineNet);
    return {
      ...line,
      quantity: qty,
      unitPrice,
      // TVA non applicable pour les 4 entités Arena Group
      vatRate: 0,
      lineTotal: lineNet,
      orderIndex: line.orderIndex ?? index,
    };
  });

  return { lines: normalizedLines, subtotal, vatAmount: 0, total: subtotal };
}

export interface InvoiceCalculationOptions {
  invoiceType?: InvoiceType;
  depositPercentage?: number;
  deductedDepositAmount?: number;
}

export function computeInvoiceTotals<T extends LineInput>(
  lines: T[],
  options: InvoiceCalculationOptions = {}
): {
  lines: (T & { lineTotal: number })[];
  subtotal: number;
  vatAmount: number;
  invoiceType: InvoiceType;
  depositPercentage: number;
  deductedDepositAmount: number;
  total: number;
} {
  const base = computeDocumentTotals(lines);
  const invoiceType: InvoiceType =
    options.invoiceType === 'deposit'
      ? 'deposit'
      : options.invoiceType === 'balance'
      ? 'balance'
      : 'standard';

  if (invoiceType === 'deposit') {
    const rawPct = Number(options.depositPercentage);
    const depositPercentage =
      Number.isFinite(rawPct) && rawPct > 0 ? Math.min(100, roundCurrency(rawPct)) : 100;
    const total = roundCurrency(base.subtotal * (depositPercentage / 100));
    return {
      lines: base.lines,
      subtotal: base.subtotal,
      vatAmount: 0,
      invoiceType: 'deposit',
      depositPercentage,
      deductedDepositAmount: 0,
      total,
    };
  }

  const rawDeducted = Math.max(0, Number(options.deductedDepositAmount) || 0);
  const deductedDepositAmount = Math.min(base.subtotal, roundCurrency(rawDeducted));
  const total = roundCurrency(Math.max(0, base.subtotal - deductedDepositAmount));

  if (invoiceType === 'balance') {
    const rawPct = Number(options.depositPercentage);
    const derivedPct =
      base.subtotal > 0 && deductedDepositAmount > 0
        ? Math.min(100, roundCurrency((deductedDepositAmount / base.subtotal) * 100))
        : 100;
    const depositPercentage =
      Number.isFinite(rawPct) && rawPct > 0 ? Math.min(100, roundCurrency(rawPct)) : derivedPct || 100;

    return {
      lines: base.lines,
      subtotal: base.subtotal,
      vatAmount: 0,
      invoiceType: 'balance',
      depositPercentage,
      deductedDepositAmount,
      total,
    };
  }

  return {
    lines: base.lines,
    subtotal: base.subtotal,
    vatAmount: 0,
    invoiceType: 'standard',
    depositPercentage: 100,
    deductedDepositAmount,
    total,
  };
}

export function getPaidDepositInvoicesForClient(
  invoices: Invoice[],
  params: {
    companyId?: string;
    contactId?: string;
    excludeInvoiceId?: string;
    todayIso?: string;
  }
): Invoice[] {
  const { companyId, contactId, excludeInvoiceId, todayIso } = params;
  if (!companyId && !contactId) return [];
  const referenceIso = todayIso ?? new Date().toISOString();
  return invoices
    .filter((inv) => {
      if (excludeInvoiceId && inv.id === excludeInvoiceId) return false;
      if (inv.invoiceType !== 'deposit') return false;
      if (resolveInvoiceStatus(inv, referenceIso) !== 'Payée') return false;
      if (companyId) {
        return inv.companyId === companyId || (Boolean(contactId) && inv.contactId === contactId);
      }
      return Boolean(contactId && inv.contactId === contactId);
    })
    .sort((a, b) => (b.issueDate || b.createdAt).localeCompare(a.issueDate || a.createdAt));
}

export function getDepositInvoicesForEntity(
  invoices: Invoice[],
  params: {
    entityId?: string;
    excludeInvoiceId?: string;
  }
): Invoice[] {
  const { entityId, excludeInvoiceId } = params;
  if (!entityId) return [];
  return invoices
    .filter((inv) => {
      if (excludeInvoiceId && inv.id === excludeInvoiceId) return false;
      if (inv.entityId !== entityId) return false;
      if (inv.invoiceType !== 'deposit') return false;
      if (inv.status === 'Annulée' || inv.status === 'Brouillon') return false;
      return true;
    })
    .sort((a, b) => (b.issueDate || b.createdAt).localeCompare(a.issueDate || a.createdAt));
}

export function buildBalanceLinesFromDepositItems(
  invoiceItems: Array<{
    productId?: string;
    invoiceId: string;
    label: string;
    description?: string;
    quantity: number;
    unitPrice: number;
    orderIndex: number;
  }>,
  depositInvoiceId: string
): LineInput[] {
  if (!depositInvoiceId) return [];
  return invoiceItems
    .filter((item) => item.invoiceId === depositInvoiceId)
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((item, idx) => ({
      id: `il-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
      productId: item.productId,
      label: item.label,
      description: item.description ?? '',
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      vatRate: 0,
      orderIndex: idx,
    }));
}

export function getDocumentAmountInWordsPrefix(kind: 'quote' | 'invoice'): string {
  return kind === 'quote'
    ? 'Arrêté le présent devis à la somme de '
    : 'Arrêtée la présente facture à la somme de ';
}

export function shouldRenderStampAndSignature(kind: 'quote' | 'invoice'): boolean {
  return kind === 'invoice';
}

export interface ClientFiscalLine {
  label: 'CIN' | 'NIF' | 'STAT' | 'RCS';
  value: string;
}

export function getClientFiscalInfo(
  company?: Pick<Company, 'legalName' | 'nif' | 'stat' | 'rcs'> | null,
  contact?: Pick<Contact, 'cin'> | null
): {
  isIndividual: boolean;
  lines: ClientFiscalLine[];
} {
  const hasAffiliatedCompany = Boolean(company && company.legalName?.trim());
  if (!hasAffiliatedCompany) {
    return {
      isIndividual: true,
      lines: [{ label: 'CIN', value: (contact?.cin ?? '').trim() }],
    };
  }
  return {
    isIndividual: false,
    lines: [
      { label: 'NIF', value: (company?.nif ?? '').trim() },
      { label: 'STAT', value: (company?.stat ?? '').trim() },
      { label: 'RCS', value: (company?.rcs ?? '').trim() },
    ],
  };
}

export function getInvoiceTotalsDisplaySpec(params: {
  kind: 'quote' | 'invoice';
  invoiceType?: InvoiceType;
  subtotal: number;
  depositPercentage?: number;
  deductedDepositAmount?: number;
}): {
  docTitle: string;
  isDeposit: boolean;
  isBalance: boolean;
  resolvedDepositPct: number;
  netLabel: string;
  depositRowLabel: string | null;
} {
  const { kind, invoiceType, subtotal, depositPercentage, deductedDepositAmount } = params;
  const isDeposit = kind === 'invoice' && invoiceType === 'deposit';
  const isBalance =
    kind === 'invoice' &&
    (invoiceType === 'balance' ||
      (!isDeposit && Boolean(deductedDepositAmount && deductedDepositAmount > 0)));

  const resolvedDepositPct =
    depositPercentage && depositPercentage > 0 && depositPercentage < 100
      ? depositPercentage
      : subtotal > 0 && deductedDepositAmount && deductedDepositAmount > 0
      ? Math.round((deductedDepositAmount / subtotal) * 100)
      : depositPercentage ?? 100;

  const docTitle =
    kind === 'quote'
      ? 'DEVIS'
      : isDeposit
      ? "FACTURE D'ACOMPTE"
      : isBalance
      ? 'FACTURE DE SOLDE'
      : 'FACTURE';

  const depositRowLabel = isDeposit
    ? `ACOMPTE FACTURÉ (${depositPercentage ?? 100}%)`
    : isBalance
    ? `ACOMPTE PAYÉ (${resolvedDepositPct}%)`
    : null;

  const netLabel = isDeposit || isBalance ? 'NET À PAYER' : 'TOTAL';

  return {
    docTitle,
    isDeposit,
    isBalance,
    resolvedDepositPct,
    netLabel,
    depositRowLabel,
  };
}

// --- Conversion Euro (Cours d'achat banque) & Validation Factures Commercial -> Super Admin ---
export interface EuroConversionResult {
  euroAmount: number;
  exchangeRate: number;
  formattedEuro: string;
}

export function computeEuroConversion(
  amountMga: number,
  exchangeRate?: number
): EuroConversionResult | null {
  const safeAmount = Math.max(0, Number(amountMga) || 0);
  const rate = Number(exchangeRate);
  if (!Number.isFinite(rate) || rate <= 0) return null;
  const euroAmount = roundCurrency(safeAmount / rate);
  const formattedEuro = `${euroAmount.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`;
  return {
    euroAmount,
    exchangeRate: rate,
    formattedEuro,
  };
}

export function getEffectiveInvoiceApprovalStatus(
  invoice: Pick<Invoice, 'approvalStatus'>
): InvoiceApprovalStatus {
  return invoice.approvalStatus ?? 'approved';
}

export function isInvoiceApproved(invoice: Pick<Invoice, 'approvalStatus'>): boolean {
  return getEffectiveInvoiceApprovalStatus(invoice) === 'approved';
}

export function canSendInvoiceToClient(
  invoice: Pick<Invoice, 'approvalStatus' | 'status'>
): boolean {
  return isInvoiceApproved(invoice) && invoice.status !== 'Annulée';
}

export function canValidateInvoices(
  user: Pick<UserProfile, 'role' | 'active'> | null | undefined
): boolean {
  return Boolean(user && user.active && user.role === 'super_admin');
}

export function requiresSuperAdminValidation(
  user: Pick<UserProfile, 'role'> | null | undefined
): boolean {
  return user?.role === 'sales';
}

export function canEditInvoiceRecord(
  user: Pick<UserProfile, 'uid' | 'role' | 'active' | 'entityIds'> | null | undefined,
  invoice: Pick<Invoice, 'entityId' | 'createdByUid' | 'approvalStatus'>
): boolean {
  if (!user || !user.active || user.role === 'reader') return false;
  if (user.role === 'super_admin') return true;
  if (!user.entityIds.includes(invoice.entityId)) return false;
  if (user.role === 'entity_admin' || user.role === 'manager') return true;
  return invoice.createdByUid === user.uid || getEffectiveInvoiceApprovalStatus(invoice) !== 'approved';
}

export function isNotificationVisibleToUser(
  notification: Pick<CrmNotification, 'entityId' | 'recipientRoles' | 'targetUserUid'>,
  user: Pick<UserProfile, 'uid' | 'role' | 'active' | 'entityIds'> | null | undefined
): boolean {
  if (!user || !user.active) return false;
  if (user.role === 'super_admin') {
    return (
      notification.recipientRoles.includes('super_admin') ||
      notification.targetUserUid === user.uid
    );
  }
  const hasRole = notification.recipientRoles.includes(user.role);
  const hasEntity = user.entityIds.includes(notification.entityId);
  const isTarget = notification.targetUserUid === user.uid;
  return isTarget || (hasRole && hasEntity);
}

export function isNotificationUnreadByUser(
  notification: Pick<CrmNotification, 'readByUids'>,
  userUid: string | undefined
): boolean {
  if (!userUid) return false;
  return !(notification.readByUids ?? []).includes(userUid);
}

// --- Produits & Services : Marges, Tarification échelonnée & Validation ---
export function computeProductMargin(price: number, unitCost: number): {
  unitMargin: number;
  marginRate: number;
} {
  const safePrice = Math.max(0, Number(price) || 0);
  const safeCost = Math.max(0, Number(unitCost) || 0);
  const unitMargin = roundCurrency(safePrice - safeCost);
  const marginRate =
    safePrice > 0 ? roundCurrency((unitMargin / safePrice) * 100) : 0;
  return { unitMargin, marginRate };
}

export function resolveProductUnitPrice(
  product: Pick<Product, 'price' | 'pricingType' | 'pricingTiers'>,
  quantity: number
): number {
  const basePrice = Math.max(0, Number(product.price) || 0);
  if (product.pricingType !== 'tiered' || !product.pricingTiers?.length) {
    return basePrice;
  }
  const qty = Math.max(1, Number(quantity) || 1);
  const sortedTiers = [...product.pricingTiers].sort((a, b) => a.minQty - b.minQty);
  const matched = sortedTiers.find((tier) => {
    const min = Math.max(1, Number(tier.minQty) || 1);
    const max =
      tier.maxQty === null || tier.maxQty === undefined || Number.isNaN(Number(tier.maxQty))
        ? Infinity
        : Number(tier.maxQty);
    return qty >= min && qty <= max;
  });
  if (matched) {
    return Math.max(0, Number(matched.unitPrice) || 0);
  }
  const fallbackHighest = [...sortedTiers].reverse().find((t) => qty >= t.minQty);
  return fallbackHighest ? Math.max(0, Number(fallbackHighest.unitPrice) || 0) : basePrice;
}

export function isSkuUnique(
  products: Pick<Product, 'id' | 'sku'>[],
  sku: string,
  excludeId?: string
): boolean {
  const norm = sku.trim().toLowerCase();
  if (!norm) return false;
  return !products.some(
    (p) => (!excludeId || p.id !== excludeId) && (p.sku ?? '').trim().toLowerCase() === norm
  );
}

export function isValidHttpUrl(url?: string): boolean {
  if (!url || !url.trim()) return true;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateProductInput(
  input: {
    id?: string;
    name: string;
    sku: string;
    folder?: string;
    price: number;
    unitCost: number;
    pricingType: Product['pricingType'];
    pricingTiers?: Product['pricingTiers'];
    imageUrl?: string;
    productUrl?: string;
  },
  existingProducts: Pick<Product, 'id' | 'sku'>[]
): string | null {
  if (!input.name.trim()) return 'Le nom du produit ou service est obligatoire.';
  if (!input.sku.trim()) return "L'identifiant unique UGS (SKU) est obligatoire.";
  if (!isSkuUnique(existingProducts, input.sku, input.id)) {
    return `Le code UGS (SKU) « ${input.sku.trim()} » est déjà utilisé par un autre produit.`;
  }
  if (Number.isNaN(input.price) || input.price < 0) {
    return 'Le prix unitaire doit être positif ou nul.';
  }
  if (Number.isNaN(input.unitCost) || input.unitCost < 0) {
    return 'Le coût unitaire doit être positif ou nul.';
  }
  if (input.pricingType === 'tiered') {
    const tiers = input.pricingTiers ?? [];
    if (tiers.length === 0) {
      return 'Ajoutez au moins un palier de volume pour une tarification échelonnée.';
    }
    for (const tier of tiers) {
      if (Number.isNaN(tier.minQty) || tier.minQty < 1) {
        return 'La quantité minimale de chaque palier doit être supérieure ou égale à 1.';
      }
      if (tier.maxQty !== null && tier.maxQty !== undefined && tier.maxQty < tier.minQty) {
        return 'La quantité maximale d’un palier doit être supérieure ou égale à sa quantité minimale.';
      }
      if (Number.isNaN(tier.unitPrice) || tier.unitPrice < 0) {
        return 'Le prix unitaire de chaque palier doit être positif ou nul.';
      }
    }
  }
  if (!isValidHttpUrl(input.imageUrl)) {
    return "L'URL de l'image produit doit commencer par http:// ou https://.";
  }
  if (!isValidHttpUrl(input.productUrl)) {
    return 'Le lien vers la fiche produit du site doit commencer par http:// ou https://.';
  }
  return null;
}

export function resolveInvoiceStatus(
  invoice: Pick<Invoice, 'status' | 'total' | 'paidAmount' | 'dueDate'>,
  referenceDateIso: string
): InvoiceStatus {
  if (invoice.status === 'Annulée' || invoice.status === 'Brouillon') {
    return invoice.status;
  }
  const total = roundCurrency(Number(invoice.total) || 0);
  const paid = roundCurrency(Number(invoice.paidAmount) || 0);
  if (total > 0 && paid >= total) {
    return 'Payée';
  }
  if (paid > 0 && paid < total) {
    return 'Payée partiellement';
  }
  const today = referenceDateIso.slice(0, 10);
  if (invoice.dueDate && invoice.dueDate < today) {
    return 'En retard';
  }
  return 'Émise';
}

export function recalculateInvoiceWithPayments(
  invoice: Invoice,
  allPayments: Payment[],
  referenceDateIso: string
): Invoice {
  const paidAmount = roundCurrency(
    allPayments
      .filter((p) => p.invoiceId === invoice.id)
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
  );
  const remainingAmount = Math.max(0, roundCurrency(invoice.total - paidAmount));
  const nextStatus = resolveInvoiceStatus(
    {
      status: invoice.status === 'Brouillon' ? 'Émise' : invoice.status,
      total: invoice.total,
      paidAmount,
      dueDate: invoice.dueDate,
    },
    referenceDateIso
  );
  return {
    ...invoice,
    paidAmount,
    remainingAmount,
    status: nextStatus,
    updatedAt: new Date().toISOString(),
  };
}

// --- Séquences de relance ---
export function addDaysToDateIso(baseDateIso: string, delayDays: number): string {
  const cleanDate = baseDateIso.slice(0, 10);
  const parsed = new Date(`${cleanDate}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return new Date(Date.now() + delayDays * 86400000).toISOString().slice(0, 10);
  }
  parsed.setUTCDate(parsed.getUTCDate() + delayDays);
  return parsed.toISOString().slice(0, 10);
}

export function computeSequenceMetrics(
  enrollments: SequenceEnrollment[],
  steps: SequenceStep[]
) {
  const total = enrollments.length;
  const active = enrollments.filter((e) => e.status === 'active').length;
  const completed = enrollments.filter((e) => e.status === 'completed').length;
  const callsMade = enrollments.reduce((sum, e) => sum + (e.callsMade || 0), 0);
  const meetingsBooked = enrollments.reduce((sum, e) => sum + (e.meetingsBooked || 0), 0);
  const repliesReceived = enrollments.reduce((sum, e) => sum + (e.repliesReceived || 0), 0);
  const responseRate = total > 0 ? Math.round((repliesReceived / total) * 100) : 0;

  const channelMap = new Map<SequenceChannel, { channel: SequenceChannel; steps: number; enrollments: number; replies: number }>();
  for (const ch of ['call', 'email', 'whatsapp', 'task'] as SequenceChannel[]) {
    channelMap.set(ch, { channel: ch, steps: 0, enrollments: 0, replies: 0 });
  }
  for (const s of steps) {
    const bucket = channelMap.get(s.channel);
    if (bucket) bucket.steps += 1;
  }
  for (const enr of enrollments) {
    const enrSteps = steps
      .filter((s) => s.sequenceId === enr.sequenceId)
      .sort((a, b) => a.order - b.order);
    const activeStep = enrSteps[Math.min(enr.currentStep, Math.max(0, enrSteps.length - 1))];
    if (activeStep) {
      const bucket = channelMap.get(activeStep.channel);
      if (bucket) {
        bucket.enrollments += 1;
        bucket.replies += enr.repliesReceived > 0 ? 1 : 0;
      }
    }
  }

  return {
    total,
    active,
    completed,
    callsMade,
    meetingsBooked,
    repliesReceived,
    responseRate,
    byChannel: Array.from(channelMap.values()).map((c) => ({
      ...c,
      responseRate: c.enrollments > 0 ? Math.round((c.replies / c.enrollments) * 100) : 0,
    })),
  };
}

// --- Historique unifié client (Contact ou Entreprise) ---
export function buildUnifiedClientHistory(params: {
  contactId?: string;
  companyId?: string;
  actions: CrmAction[];
  opportunities: Deal[];
  quotes: Quote[];
  invoices: Invoice[];
  payments: Payment[];
  complaints: Complaint[];
  serviceRequests: ServiceRequest[];
  enrollments: SequenceEnrollment[];
  auditLogs: AuditLog[];
  prospects?: { id: string; contactId?: string; companyId?: string }[];
  allowedEntityIds?: Set<string> | null;
}): ClientHistoryEntry[] {
  const {
    contactId,
    companyId,
    actions,
    opportunities,
    quotes,
    invoices,
    payments,
    complaints,
    serviceRequests,
    enrollments,
    auditLogs,
    prospects = [],
    allowedEntityIds,
  } = params;

  const linkedProspectIds = new Set(
    prospects
      .filter((p) => (contactId && p.contactId === contactId) || (companyId && p.companyId === companyId))
      .map((p) => p.id)
  );

  const matchContactOrCompany = (cId?: string, coId?: string, pId?: string) => {
    if (contactId && cId === contactId) return true;
    if (companyId && coId === companyId) return true;
    if (pId && linkedProspectIds.has(pId)) return true;
    return false;
  };

  const canAccessEntity = (entityId: string) =>
    !allowedEntityIds || allowedEntityIds.has(entityId);

  const entries: ClientHistoryEntry[] = [];

  for (const a of actions) {
    if (!canAccessEntity(a.entityId)) continue;
    if (!matchContactOrCompany(a.contactId, a.companyId, a.prospectId)) continue;
    entries.push({
      id: `hist-action-${a.id}`,
      entityId: a.entityId,
      category: 'action',
      interactionType: a.type,
      title: a.title,
      description: a.outcome || a.description || `Statut : ${a.status}`,
      date: a.completedAt || `${a.dueDate}T${a.dueTime || '09:00'}:00`,
      userUid: a.assignedToUid,
      status: a.status,
    });
  }

  for (const d of opportunities) {
    if (!canAccessEntity(d.entityId)) continue;
    if (!matchContactOrCompany(d.contactId, d.companyId, d.prospectId)) continue;
    entries.push({
      id: `hist-opp-${d.id}`,
      entityId: d.entityId,
      category: 'opportunity',
      interactionType: 'Opportunité',
      title: d.name,
      description: `Étape : ${d.stage || d.status}${d.lostReason ? ` · Motif : ${d.lostReason}` : ''}`,
      date: d.updatedAt || d.createdAt,
      userUid: d.ownerUid,
      status: d.status,
      amount: d.amount,
      currency: d.currency,
    });
  }

  for (const q of quotes) {
    if (!canAccessEntity(q.entityId)) continue;
    if (!matchContactOrCompany(q.contactId, q.companyId)) continue;
    entries.push({
      id: `hist-quote-${q.id}`,
      entityId: q.entityId,
      category: 'quote',
      interactionType: 'Devis',
      title: `Devis ${q.quoteNumber}`,
      description: `Validité jusqu'au ${q.validUntil}`,
      date: q.updatedAt || q.issueDate,
      userUid: q.createdByUid,
      status: q.status,
      amount: q.total,
      currency: q.currency,
    });
  }

  const matchedInvoiceIds = new Set<string>();
  const invoiceCurrencyMap = new Map<string, string>();
  for (const inv of invoices) {
    if (!canAccessEntity(inv.entityId)) continue;
    if (!matchContactOrCompany(inv.contactId, inv.companyId)) continue;
    matchedInvoiceIds.add(inv.id);
    invoiceCurrencyMap.set(inv.id, inv.currency || 'MGA');
    entries.push({
      id: `hist-inv-${inv.id}`,
      entityId: inv.entityId,
      category: 'invoice',
      interactionType: 'Facture',
      title: `Facture ${inv.invoiceNumber}`,
      description: `Échéance : ${inv.dueDate} · Payé : ${inv.paidAmount} ${inv.currency}`,
      date: inv.updatedAt || inv.issueDate,
      userUid: inv.createdByUid,
      status: inv.status,
      amount: inv.total,
      currency: inv.currency,
    });
  }

  for (const pay of payments) {
    if (!canAccessEntity(pay.entityId)) continue;
    if (!matchedInvoiceIds.has(pay.invoiceId)) continue;
    entries.push({
      id: `hist-pay-${pay.id}`,
      entityId: pay.entityId,
      category: 'payment',
      interactionType: 'Paiement',
      title: `Paiement (${pay.paymentMethod})`,
      description: pay.reference ? `Réf. ${pay.reference}` : pay.notes || 'Règlement enregistré',
      date: pay.paymentDate || pay.createdAt,
      userUid: pay.recordedByUid,
      status: 'Reçu',
      amount: pay.amount,
      currency: invoiceCurrencyMap.get(pay.invoiceId) ?? 'MGA',
    });
  }

  for (const c of complaints) {
    if (!canAccessEntity(c.entityId)) continue;
    if (!matchContactOrCompany(c.contactId, c.companyId)) continue;
    entries.push({
      id: `hist-comp-${c.id}`,
      entityId: c.entityId,
      category: 'complaint',
      interactionType: 'Réclamation',
      title: c.subject,
      description: c.resolution || c.description,
      date: c.updatedAt || c.createdAt,
      userUid: c.assignedToUid,
      status: c.status,
    });
  }

  for (const sr of serviceRequests) {
    if (!canAccessEntity(sr.entityId)) continue;
    if (!matchContactOrCompany(sr.contactId, sr.companyId)) continue;
    entries.push({
      id: `hist-sr-${sr.id}`,
      entityId: sr.entityId,
      category: 'service_request',
      interactionType: 'Demande supplémentaire',
      title: sr.subject,
      description: sr.description,
      date: sr.createdAt,
      userUid: '',
      status: sr.status,
    });
  }

  for (const enr of enrollments) {
    if (!canAccessEntity(enr.entityId)) continue;
    if (!contactId || enr.contactId !== contactId) continue;
    entries.push({
      id: `hist-seq-${enr.id}`,
      entityId: enr.entityId,
      category: 'sequence',
      interactionType: 'Séquence de relance',
      title: `Inscription séquence · Étape ${enr.currentStep + 1}`,
      description: `Appels : ${enr.callsMade} · Réponses : ${enr.repliesReceived}`,
      date: enr.updatedAt || enr.enrolledAt,
      userUid: '',
      status: enr.status,
    });
  }

  for (const log of auditLogs) {
    if (!canAccessEntity(log.entityId)) continue;
    if (
      (contactId && log.targetId === contactId) ||
      (companyId && log.targetId === companyId) ||
      linkedProspectIds.has(log.targetId)
    ) {
      entries.push({
        id: `hist-log-${log.id}`,
        entityId: log.entityId,
        category: 'status_change',
        interactionType: 'Changement de statut',
        title: log.summary,
        description: `Par ${log.actorName}`,
        date: log.createdAt,
        userUid: log.actorUid,
        status: log.actionType,
      });
    }
  }

  return entries.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

// --- Reporting & KPIs Direction / Commercial ---
export function computeFinanceKpis(params: {
  quotes: Quote[];
  invoices: Invoice[];
  payments: Payment[];
  opportunities: Deal[];
  referenceDateIso: string;
}) {
  const { quotes, invoices, payments, opportunities, referenceDateIso } = params;
  const activeInvoices = invoices.filter((i) => i.status !== 'Annulée' && i.status !== 'Brouillon');
  const collectedRevenue = roundCurrency(
    payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
  );
  const billedRevenue = roundCurrency(
    activeInvoices.reduce((sum, i) => sum + (Number(i.total) || 0), 0)
  );
  const openPipelineValue = roundCurrency(
    opportunities
      .filter((o) => o.status === 'open')
      .reduce((sum, o) => sum + (Number(o.amount) || 0), 0)
  );
  const wonCount = opportunities.filter((o) => o.status === 'won').length;
  const lostCount = opportunities.filter((o) => o.status === 'lost').length;
  const closedCount = wonCount + lostCount;
  const conversionRate = closedCount > 0 ? Math.round((wonCount / closedCount) * 100) : 0;

  const quotesSent = quotes.filter((q) => q.status !== 'Brouillon').length;
  const quotesAccepted = quotes.filter(
    (q) => q.status === 'Accepté' || q.status === 'Converti en facture'
  ).length;
  const invoicesPaid = invoices.filter(
    (i) => resolveInvoiceStatus(i, referenceDateIso) === 'Payée'
  ).length;
  const invoicesOverdue = invoices.filter(
    (i) => resolveInvoiceStatus(i, referenceDateIso) === 'En retard'
  ).length;

  return {
    collectedRevenue,
    billedRevenue,
    openPipelineValue,
    conversionRate,
    quotesSent,
    quotesAccepted,
    invoicesPaid,
    invoicesOverdue,
  };
}

export function computeRevenueByEntity(
  invoices: Invoice[],
  payments: Payment[],
  entities: CrmEntity[]
) {
  return entities.map((entity) => {
    const entityInvoices = invoices.filter(
      (i) => i.entityId === entity.id && i.status !== 'Annulée' && i.status !== 'Brouillon'
    );
    const billed = roundCurrency(entityInvoices.reduce((sum, i) => sum + i.total, 0));
    const collected = roundCurrency(
      payments
        .filter((p) => p.entityId === entity.id)
        .reduce((sum, p) => sum + p.amount, 0)
    );
    return {
      entityId: entity.id,
      name: entity.name,
      color: entity.color,
      billed,
      collected,
    };
  });
}

export function computeLossReasonsBreakdown(opportunities: Deal[]) {
  const counts = new Map<string, { reason: string; count: number; amount: number }>();
  const reasons: LostReason[] = ['Prix', 'Concurrent', 'Timing', 'Pas de budget', 'Autre'];
  for (const r of reasons) {
    counts.set(r, { reason: r, count: 0, amount: 0 });
  }
  for (const opp of opportunities) {
    if (opp.status !== 'lost') continue;
    const key = opp.lostReason || 'Autre';
    const current = counts.get(key) ?? { reason: key, count: 0, amount: 0 };
    current.count += 1;
    current.amount = roundCurrency(current.amount + (Number(opp.amount) || 0));
    counts.set(key, current);
  }
  return Array.from(counts.values()).filter((x) => x.count > 0);
}

export function computeSalesByProduct(
  invoices: Invoice[],
  invoiceItems: InvoiceItem[],
  products: Product[]
) {
  const activeInvoiceIds = new Set(
    invoices.filter((i) => i.status !== 'Annulée' && i.status !== 'Brouillon').map((i) => i.id)
  );
  const map = new Map<string, { name: string; quantity: number; revenue: number }>();

  for (const item of invoiceItems) {
    if (!activeInvoiceIds.has(item.invoiceId)) continue;
    const prod = products.find((p) => p.id === item.productId);
    const key = prod?.name || item.label || 'Prestation diverse';
    const current = map.get(key) ?? { name: key, quantity: 0, revenue: 0 };
    current.quantity += Number(item.quantity) || 0;
    current.revenue = roundCurrency(current.revenue + (Number(item.lineTotal) || 0));
    map.set(key, current);
  }
  return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
}

export function computeSalesByClient(
  invoices: Invoice[],
  companies: Company[],
  contacts: Contact[]
) {
  const map = new Map<string, { clientName: string; billed: number; paid: number; count: number }>();
  for (const inv of invoices) {
    if (inv.status === 'Annulée' || inv.status === 'Brouillon') continue;
    const co = companies.find((c) => c.id === inv.companyId);
    const ct = contacts.find((c) => c.id === inv.contactId);
    const label = co?.legalName || ct?.fullName || 'Client';
    const key = inv.companyId || inv.contactId || inv.id;
    const cur = map.get(key) ?? { clientName: label, billed: 0, paid: 0, count: 0 };
    cur.billed = roundCurrency(cur.billed + inv.total);
    cur.paid = roundCurrency(cur.paid + inv.paidAmount);
    cur.count += 1;
    map.set(key, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.billed - a.billed);
}

export function computeSalesByRep(
  opportunities: Deal[],
  invoices: Invoice[],
  users: UserProfile[]
) {
  const map = new Map<string, { name: string; wonDeals: number; wonAmount: number; billedAmount: number }>();
  for (const u of users) {
    map.set(u.uid, { name: u.displayName, wonDeals: 0, wonAmount: 0, billedAmount: 0 });
  }
  for (const opp of opportunities) {
    if (opp.status !== 'won') continue;
    const bucket = map.get(opp.ownerUid) ?? {
      name: 'Commercial',
      wonDeals: 0,
      wonAmount: 0,
      billedAmount: 0,
    };
    bucket.wonDeals += 1;
    bucket.wonAmount = roundCurrency(bucket.wonAmount + (Number(opp.amount) || 0));
    map.set(opp.ownerUid, bucket);
  }
  for (const inv of invoices) {
    if (inv.status === 'Annulée' || inv.status === 'Brouillon') continue;
    const bucket = map.get(inv.createdByUid) ?? {
      name: 'Commercial',
      wonDeals: 0,
      wonAmount: 0,
      billedAmount: 0,
    };
    bucket.billedAmount = roundCurrency(bucket.billedAmount + inv.total);
    map.set(inv.createdByUid, bucket);
  }
  return Array.from(map.values())
    .filter((r) => r.wonDeals > 0 || r.billedAmount > 0)
    .sort((a, b) => b.wonAmount + b.billedAmount - (a.wonAmount + a.billedAmount));
}

export function computeSalesByPeriod(invoices: Invoice[], payments: Payment[]) {
  const map = new Map<string, { period: string; billed: number; collected: number }>();
  for (const inv of invoices) {
    if (inv.status === 'Annulée' || inv.status === 'Brouillon') continue;
    const period = (inv.issueDate || inv.createdAt).slice(0, 7);
    if (!period) continue;
    const cur = map.get(period) ?? { period, billed: 0, collected: 0 };
    cur.billed = roundCurrency(cur.billed + inv.total);
    map.set(period, cur);
  }
  for (const pay of payments) {
    const period = (pay.paymentDate || pay.createdAt).slice(0, 7);
    if (!period) continue;
    const cur = map.get(period) ?? { period, billed: 0, collected: 0 };
    cur.collected = roundCurrency(cur.collected + pay.amount);
    map.set(period, cur);
  }
  return Array.from(map.values()).sort((a, b) => a.period.localeCompare(b.period));
}

export function computeSatisfactionSummary(surveys: SatisfactionSurvey[]) {
  const answered = surveys.filter((s) => s.rating > 0);
  const averageRating =
    answered.length > 0
      ? Math.round((answered.reduce((sum, s) => sum + s.rating, 0) / answered.length) * 10) / 10
      : 0;
  return {
    totalSurveys: surveys.length,
    answeredCount: answered.length,
    averageRating,
  };
}

// --- Liens d'intégration WhatsApp & Outlook ---
export function buildWhatsAppLink(phone: string, prefillText?: string): string {
  const digits = (phone || '').replace(/[^0-9]/g, '');
  const normalized = digits.startsWith('0') && digits.length === 10 ? `33${digits.slice(1)}` : digits;
  const query = prefillText ? `?text=${encodeURIComponent(prefillText)}` : '';
  return `https://wa.me/${normalized}${query}`;
}

export function buildMailtoLink(email: string, subject?: string, body?: string): string {
  const params = new URLSearchParams();
  if (subject) params.set('subject', subject);
  if (body) params.set('body', body);
  const qs = params.toString();
  return `mailto:${encodeURIComponent(email || '')}${qs ? `?${qs}` : ''}`;
}

export function formatInlineAddress(
  address?: string | null,
  city?: string | null,
  country?: string | null
): string {
  return [address, city, country]
    .map((part) => (part ?? '').trim().replace(/^,+|,+$/g, '').trim())
    .filter((part) => part.length > 0)
    .join(', ');
}

export const DEFAULT_PRODUCT_FOLDERS = [
  'Catalogue général',
  'Hébergement & Bureaux',
  'Conseil & Formation',
  'Studio & Communication',
  'Artisanat & Décoration',
] as const;

export const DEFAULT_PRODUCT_CATEGORIES = [
  'Services',
  'Conseil',
  'Formation',
  'Domiciliation',
  'Communication',
  'Artisanat',
  'Abonnement',
] as const;

export function buildCatalogOptions(
  existingValues: Array<string | undefined | null>,
  defaults: readonly string[],
  ...extraValues: Array<string | undefined | null>
): string[] {
  const seen = new Map<string, string>();
  for (const raw of [...defaults, ...existingValues, ...extraValues]) {
    const trimmed = (raw ?? '').trim();
    if (!trimmed) continue;
    const key = trimmed.toLocaleLowerCase('fr');
    if (!seen.has(key)) {
      seen.set(key, trimmed);
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, 'fr'));
}

export function dedupeCatalogValues(values: Array<string | undefined | null>): string[] {
  const seen = new Map<string, string>();
  for (const raw of values) {
    const trimmed = (raw ?? '').trim();
    if (!trimmed) continue;
    const key = trimmed.toLocaleLowerCase('fr');
    if (!seen.has(key)) {
      seen.set(key, trimmed);
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, 'fr'));
}

export function getManagedCatalogList(
  configuredList: string[] | undefined,
  defaults: readonly string[],
  existingProductValues: Array<string | undefined | null>
): string[] {
  if (configuredList !== undefined) {
    return dedupeCatalogValues(configuredList);
  }
  return buildCatalogOptions(existingProductValues, defaults);
}

export function resolveManagedCatalogOptions(
  configuredList: string[] | undefined,
  defaults: readonly string[],
  existingProductValues: Array<string | undefined | null>,
  ...extraValues: Array<string | undefined | null>
): string[] {
  const base = getManagedCatalogList(configuredList, defaults, existingProductValues);
  return dedupeCatalogValues([...base, ...extraValues]);
}

export function addManagedCatalogValue(currentList: string[], rawValue: string): string[] {
  const trimmed = rawValue.trim();
  if (!trimmed) return dedupeCatalogValues(currentList);
  return dedupeCatalogValues([...currentList, trimmed]);
}

export function renameManagedCatalogValue(
  currentList: string[],
  oldValue: string,
  newValue: string
): string[] {
  const oldKey = oldValue.trim().toLocaleLowerCase('fr');
  const cleanNew = newValue.trim();
  if (!cleanNew) return dedupeCatalogValues(currentList);
  const replaced = currentList.map((item) =>
    item.trim().toLocaleLowerCase('fr') === oldKey ? cleanNew : item
  );
  if (!replaced.some((item) => item.trim().toLocaleLowerCase('fr') === cleanNew.toLocaleLowerCase('fr'))) {
    replaced.push(cleanNew);
  }
  return dedupeCatalogValues(replaced);
}

export function removeManagedCatalogValue(currentList: string[], valueToRemove: string): string[] {
  const targetKey = valueToRemove.trim().toLocaleLowerCase('fr');
  return dedupeCatalogValues(
    currentList.filter((item) => item.trim().toLocaleLowerCase('fr') !== targetKey)
  );
}

export interface FormattedDescriptionLine {
  kind: 'blank' | 'bullet' | 'text';
  raw: string;
  bullet?: string;
  content: string;
  indentLevel: number;
}

export function parseFormattedDescriptionLines(
  description?: string | null
): FormattedDescriptionLine[] {
  if (!description || !description.trim()) return [];
  const normalized = description.replace(/\r\n?/g, '\n');
  const rawLines = normalized.split('\n');

  // Trim leading/trailing completely empty lines while keeping internal blank lines
  let start = 0;
  let end = rawLines.length - 1;
  while (start <= end && rawLines[start].trim() === '') start += 1;
  while (end >= start && rawLines[end].trim() === '') end -= 1;

  const result: FormattedDescriptionLine[] = [];
  for (let i = start; i <= end; i += 1) {
    const raw = rawLines[i];
    if (raw.trim() === '') {
      result.push({ kind: 'blank', raw, content: '', indentLevel: 0 });
      continue;
    }
    const leadingSpacesMatch = raw.match(/^(\s*)/);
    const leadingLen = leadingSpacesMatch ? leadingSpacesMatch[1].length : 0;
    const indentLevel = leadingLen >= 2 ? 1 : 0;
    const trimmedStart = raw.trimStart();
    const bulletMatch = trimmedStart.match(/^([-•*])\s+(.+)$/);
    if (bulletMatch) {
      result.push({
        kind: 'bullet',
        raw,
        bullet: bulletMatch[1],
        content: bulletMatch[2].trimEnd(),
        indentLevel,
      });
    } else {
      result.push({
        kind: 'text',
        raw,
        content: trimmedStart.trimEnd(),
        indentLevel,
      });
    }
  }
  return result;
}

export function computeRemovedLineItemIds(
  existingItems: Array<{ id: string }>,
  nextItems: Array<{ id?: string }>
): string[] {
  const nextIds = new Set(
    nextItems
      .map((item) => item.id)
      .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
  );
  const seenRemoved = new Set<string>();
  const removed: string[] = [];
  for (const existing of existingItems) {
    if (!existing.id || nextIds.has(existing.id) || seenRemoved.has(existing.id)) continue;
    seenRemoved.add(existing.id);
    removed.push(existing.id);
  }
  return removed;
}


