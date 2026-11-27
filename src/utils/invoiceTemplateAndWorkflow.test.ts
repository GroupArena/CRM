import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatInvoiceAmountInWords,
  numberToFrenchWords,
} from './numberToWordsFr';
import { getEntityInvoiceTheme } from './branding';
import {
  canEditInvoiceRecord,
  canSendInvoiceToClient,
  canValidateInvoices,
  computeEuroConversion,
  getEffectiveInvoiceApprovalStatus,
  isInvoiceApproved,
  isNotificationUnreadByUser,
  isNotificationVisibleToUser,
  requiresSuperAdminValidation,
} from './billingLogic';

test('numberToFrenchWords converts standard and edge French numbers accurately', () => {
  assert.equal(numberToFrenchWords(0), 'ZÉRO');
  assert.equal(numberToFrenchWords(1), 'UN');
  assert.equal(numberToFrenchWords(71), 'SOIXANTE ET ONZE');
  assert.equal(numberToFrenchWords(80), 'QUATRE-VINGTS');
  assert.equal(numberToFrenchWords(91), 'QUATRE-VINGT-ONZE');
  assert.equal(numberToFrenchWords(1000), 'MILLE');
  assert.equal(numberToFrenchWords(1000000), 'UN MILLION');
  assert.equal(
    numberToFrenchWords(4610000),
    'QUATRE MILLIONS SIX CENT DIX MILLE'
  );
});

test('formatInvoiceAmountInWords formats MGA and EUR totals in French words', () => {
  assert.equal(
    formatInvoiceAmountInWords(4610000, 'MGA'),
    'QUATRE MILLIONS SIX CENT DIX MILLE ARIARY'
  );
  assert.equal(
    formatInvoiceAmountInWords(1007.43, 'EUR'),
    'MILLE SEPT EURO QUARANTE-TROIS'
  );
  assert.equal(
    formatInvoiceAmountInWords(705.2, 'EUR'),
    'SEPT CENT CINQ EURO VINGT'
  );
});

test('computeEuroConversion calculates bank buying rate Euro equivalent cleanly', () => {
  const res = computeEuroConversion(4610000, 4576);
  assert.ok(res !== null);
  assert.equal(res.euroAmount, 1007.43);
  assert.equal(res.exchangeRate, 4576);
  assert.ok(res.formattedEuro.includes('€'));

  assert.equal(computeEuroConversion(4610000, 0), null);
  assert.equal(computeEuroConversion(4610000, -10), null);
  assert.equal(computeEuroConversion(4610000, undefined), null);
});

test('getEntityInvoiceTheme returns distinct Charte Graphique colors for all 4 entities', () => {
  const abc = getEntityInvoiceTheme('arena-business-center');
  const imp = getEntityInvoiceTheme('improveo');
  const asc = getEntityInvoiceTheme('arena-studio-comm');
  const ma = getEntityInvoiceTheme('maison-artisanat');

  assert.equal(abc.primaryHex, '#19283E');
  assert.equal(abc.secondaryHex, '#C9A125');

  assert.equal(imp.primaryHex, '#0B4EA2');
  assert.equal(imp.tableHeaderHex, '#0B4EA2');

  assert.equal(asc.primaryHex, '#0E3370');
  assert.equal(asc.secondaryHex, '#3E8199');
  assert.equal(asc.tableHeaderHex, '#3E8199');

  assert.equal(ma.primaryHex, '#5C261D');
  assert.equal(ma.secondaryHex, '#C9A125');

  const custom = getEntityInvoiceTheme('nouvelle-entite', '#336699');
  assert.equal(custom.primaryHex, '#336699');
  assert.equal(custom.tableHeaderHex, '#336699');
});

test('Commercial -> Super Admin invoice validation permissions and send gating', () => {
  assert.equal(requiresSuperAdminValidation({ role: 'sales' }), true);
  assert.equal(requiresSuperAdminValidation({ role: 'super_admin' }), false);
  assert.equal(requiresSuperAdminValidation({ role: 'manager' }), false);

  assert.equal(canValidateInvoices({ role: 'super_admin', active: true }), true);
  assert.equal(canValidateInvoices({ role: 'super_admin', active: false }), false);
  assert.equal(canValidateInvoices({ role: 'sales', active: true }), false);
  assert.equal(canValidateInvoices({ role: 'entity_admin', active: true }), false);

  assert.equal(
    getEffectiveInvoiceApprovalStatus({ approvalStatus: undefined }),
    'approved'
  );
  assert.equal(
    isInvoiceApproved({ approvalStatus: 'pending_approval' }),
    false
  );
  assert.equal(
    canSendInvoiceToClient({ approvalStatus: 'pending_approval', status: 'Brouillon' }),
    false
  );
  assert.equal(
    canSendInvoiceToClient({ approvalStatus: 'rejected', status: 'Brouillon' }),
    false
  );
  assert.equal(
    canSendInvoiceToClient({ approvalStatus: 'approved', status: 'Émise' }),
    true
  );
  assert.equal(
    canSendInvoiceToClient({ approvalStatus: 'approved', status: 'Annulée' }),
    false
  );

  const salesStudio = {
    uid: 'u-sales-1',
    role: 'sales' as const,
    active: true,
    entityIds: ['arena-studio-comm'],
  };
  const superAdmin = {
    uid: 'u-admin',
    role: 'super_admin' as const,
    active: true,
    entityIds: [],
  };
  assert.equal(
    canEditInvoiceRecord(salesStudio, {
      entityId: 'arena-studio-comm',
      createdByUid: 'u-sales-1',
      approvalStatus: 'pending_approval',
    }),
    true
  );
  assert.equal(
    canEditInvoiceRecord(salesStudio, {
      entityId: 'arena-business-center',
      createdByUid: 'u-sales-1',
      approvalStatus: 'pending_approval',
    }),
    false
  );
  assert.equal(
    canEditInvoiceRecord(superAdmin, {
      entityId: 'arena-studio-comm',
      createdByUid: 'u-sales-1',
      approvalStatus: 'pending_approval',
    }),
    true
  );
});

test('Notification visibility and unread tracking across roles and entities', () => {
  const superAdmin = {
    uid: 'sa-1',
    role: 'super_admin' as const,
    active: true,
    entityIds: [],
  };
  const salesStudio = {
    uid: 'sales-studio',
    role: 'sales' as const,
    active: true,
    entityIds: ['arena-studio-comm'],
  };
  const salesAbc = {
    uid: 'sales-abc',
    role: 'sales' as const,
    active: true,
    entityIds: ['arena-business-center'],
  };

  const validationReq = {
    entityId: 'arena-studio-comm',
    recipientRoles: ['super_admin' as const],
    targetUserUid: undefined,
    readByUids: [],
  };
  assert.equal(isNotificationVisibleToUser(validationReq, superAdmin), true);
  assert.equal(isNotificationVisibleToUser(validationReq, salesStudio), false);
  assert.equal(isNotificationUnreadByUser(validationReq, 'sa-1'), true);
  assert.equal(
    isNotificationUnreadByUser({ readByUids: ['sa-1'] }, 'sa-1'),
    false
  );

  const validatedNotif = {
    entityId: 'arena-studio-comm',
    recipientRoles: ['sales' as const, 'entity_admin' as const, 'manager' as const, 'super_admin' as const],
    targetUserUid: 'sales-studio',
    readByUids: ['sa-1'],
  };
  assert.equal(isNotificationVisibleToUser(validatedNotif, salesStudio), true);
  assert.equal(isNotificationVisibleToUser(validatedNotif, superAdmin), true);
  assert.equal(isNotificationVisibleToUser(validatedNotif, salesAbc), false);
});

test('buildArenaA4Pdf embeds Poppins & Montserrat TrueType fonts on A4 for both Invoices and Quotes', async () => {
  const { buildArenaA4Pdf } = await import('./pdfExport');

  const commonCtx = {
    entity: {
      id: 'improveo',
      name: 'Improvéo',
      slug: 'improveo',
      description: 'Conseil & Formation',
      color: '#0B4EA2',
      active: true,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    legal: {
      id: 'leg-imp',
      entityId: 'improveo',
      entityCode: 'IMP',
      legalName: 'IMPROVEO SARL',
      nif: '1234567890',
      stat: '9876543210',
      rcs: '2026B001',
      address: 'Antananarivo 101',
      phone: '+261 38 02 410 05',
      email: 'contact@improveo.mg',
      paymentTerms: 'Paiement par virement sous 15 jours.',
      defaultLegalMentions: 'TVA non applicable',
      bankAccountHolder: 'IMPROVEO SARL',
      bankName: 'BNI Madagascar',
      iban: 'MG460000500001',
      bic: 'BNIMGXXX',
      updatedAt: '2026-01-01',
    },
    company: {
      id: 'comp-1',
      legalName: 'CLIENT TEST SARL',
      tradeName: 'Client Test',
      legalStatus: 'SARL',
      nif: '111222333',
      stat: '444555666',
      rcs: '2025B999',
      address: 'Analakely',
      city: 'Antananarivo',
      country: 'Madagascar',
      phone: '+261 34 00 000 00',
      whatsapp: '',
      email: 'client@example.mg',
      website: '',
      primaryContactId: 'ct-1',
      tags: [],
      notes: '',
      isVip: false,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  };

  const quotePdf = await buildArenaA4Pdf(
    {
      kind: 'quote',
      documentNumber: 'DEV-IMP-2026-0001',
      entityId: 'improveo',
      issueDate: '2026-11-19',
      secondaryDate: '2026-12-19',
      currency: 'MGA',
      subtotal: 4610000,
      total: 4610000,
      showEuroConversion: true,
      euroExchangeRate: 4576,
      euroBankName: 'BNI Madagascar',
      euroRateDate: '2026-11-19',
      items: [
        {
          label: 'Audit & Conseil Stratégique',
          description: 'Accompagnement complet',
          quantity: 1,
          unitPrice: 4610000,
          lineTotal: 4610000,
        },
      ],
    },
    commonCtx
  );

  assert.equal(quotePdf.fontsEmbedded, true);
  assert.equal(Math.round(quotePdf.doc.internal.pageSize.getWidth()), 210);
  assert.equal(Math.round(quotePdf.doc.internal.pageSize.getHeight()), 297);
  const quotePdfText = Buffer.from(quotePdf.doc.output('arraybuffer')).toString('latin1');
  assert.match(quotePdfText, /\/BaseFont\s+\/Poppins/);
  assert.match(quotePdfText, /\/BaseFont\s+\/Montserrat/);

  const invoicePdf = await buildArenaA4Pdf(
    {
      kind: 'invoice',
      documentNumber: 'FAC-IMP-2026-0001',
      entityId: 'improveo',
      issueDate: '2026-11-19',
      secondaryDate: '2026-12-19',
      currency: 'MGA',
      subtotal: 4610000,
      total: 4610000,
      items: [
        {
          label: 'Audit & Conseil Stratégique',
          quantity: 1,
          unitPrice: 4610000,
          lineTotal: 4610000,
        },
      ],
    },
    commonCtx
  );

  assert.equal(invoicePdf.fontsEmbedded, true);
  assert.equal(Math.round(invoicePdf.doc.internal.pageSize.getWidth()), 210);
  assert.equal(Math.round(invoicePdf.doc.internal.pageSize.getHeight()), 297);
  const invoicePdfText = Buffer.from(invoicePdf.doc.output('arraybuffer')).toString('latin1');
  assert.match(invoicePdfText, /\/BaseFont\s+\/Poppins/);
  assert.match(invoicePdfText, /\/BaseFont\s+\/Montserrat/);

  const depositPdf = await buildArenaA4Pdf(
    {
      kind: 'invoice',
      documentNumber: 'FAC-IMP-2026-0002',
      entityId: 'improveo',
      issueDate: '2026-11-19',
      secondaryDate: '2026-12-19',
      currency: 'MGA',
      subtotal: 10000000,
      total: 3000000,
      invoiceType: 'deposit',
      depositPercentage: 30,
      items: [
        {
          label: 'Audit & Conseil Stratégique',
          quantity: 1,
          unitPrice: 10000000,
          lineTotal: 10000000,
        },
      ],
    },
    commonCtx
  );
  assert.equal(depositPdf.fontsEmbedded, true);

  const balancePdf = await buildArenaA4Pdf(
    {
      kind: 'invoice',
      documentNumber: 'FAC-IMP-2026-0003',
      entityId: 'improveo',
      issueDate: '2026-11-25',
      secondaryDate: '2026-12-25',
      currency: 'MGA',
      subtotal: 10000000,
      total: 7000000,
      invoiceType: 'balance',
      depositPercentage: 30,
      deductedDepositAmount: 3000000,
      items: [
        {
          label: 'Audit & Conseil Stratégique',
          quantity: 1,
          unitPrice: 10000000,
          lineTotal: 10000000,
        },
      ],
    },
    commonCtx
  );
  assert.equal(balancePdf.fontsEmbedded, true);

  const partialAddressPdf = await buildArenaA4Pdf(
    {
      kind: 'quote',
      documentNumber: 'DEV-IMP-2026-0099',
      entityId: 'improveo',
      issueDate: '2026-11-25',
      secondaryDate: '2026-12-25',
      currency: 'MGA',
      subtotal: 1200000,
      total: 1200000,
      items: [
        {
          label: 'Diagnostic RH',
          quantity: 1,
          unitPrice: 1200000,
          lineTotal: 1200000,
        },
      ],
    },
    {
      ...commonCtx,
      company: {
        ...commonCtx.company,
        address: 'Lot III V 19 A Anosizato Est I',
        city: '',
        country: 'Madagascar',
      },
    }
  );
  assert.equal(partialAddressPdf.fontsEmbedded, true);
});


