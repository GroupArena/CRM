import { jsPDF } from 'jspdf';
import type {
  Company,
  Contact,
  CrmEntity,
  Invoice,
  InvoiceItem,
  LegalSetting,
  Quote,
  QuoteItem,
} from '../types';
import { formatCurrency, formatDateFr } from './crmLogic';
import { getBrandLogoPath, getEntityInvoiceTheme, resolveAssetUrl } from './branding';
import { computeEuroConversion } from './billingLogic';
import { formatInvoiceAmountInWords } from './numberToWordsFr';

interface PdfDocContext {
  entity?: CrmEntity;
  legal?: LegalSetting;
  company?: Company;
  contact?: Contact;
}

interface LoadedImageData {
  dataUrl: string;
  width: number;
  height: number;
}

interface FontSpec {
  file: string;
  family: 'Poppins' | 'Montserrat';
  style: string;
}

const ARENA_PDF_FONTS: FontSpec[] = [
  { file: 'Poppins-Regular.ttf', family: 'Poppins', style: 'normal' },
  { file: 'Poppins-SemiBold.ttf', family: 'Poppins', style: 'semibold' },
  { file: 'Poppins-Bold.ttf', family: 'Poppins', style: 'bold' },
  { file: 'Poppins-ExtraBold.ttf', family: 'Poppins', style: 'extrabold' },
  { file: 'Montserrat-Regular.ttf', family: 'Montserrat', style: 'normal' },
  { file: 'Montserrat-Medium.ttf', family: 'Montserrat', style: 'medium' },
  { file: 'Montserrat-SemiBold.ttf', family: 'Montserrat', style: 'semibold' },
  { file: 'Montserrat-Bold.ttf', family: 'Montserrat', style: 'bold' },
];

const cachedFontBase64 = new Map<string, string>();

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    parts.push(String.fromCharCode(...slice));
  }
  return btoa(parts.join(''));
}

async function fetchFontBase64(file: string): Promise<string | null> {
  const cached = cachedFontBase64.get(file);
  if (cached) return cached;

  if (typeof window !== 'undefined' && typeof fetch === 'function') {
    try {
      const res = await fetch(resolveAssetUrl(`fonts/${file}`));
      if (!res.ok) return null;
      const buf = await res.arrayBuffer();
      const b64 = arrayBufferToBase64(buf);
      cachedFontBase64.set(file, b64);
      return b64;
    } catch {
      return null;
    }
  }

  // Node.js fallback for automated verification tests
  try {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const fullPath = path.resolve(process.cwd(), 'public', 'fonts', file);
    if (!fs.existsSync(fullPath)) return null;
    const b64 = fs.readFileSync(fullPath).toString('base64');
    cachedFontBase64.set(file, b64);
    return b64;
  } catch {
    return null;
  }
}

interface PdfFontPalette {
  headingFamily: string;
  headingBoldStyle: string;
  headingExtraBoldStyle: string;
  bodyFamily: string;
  bodyNormalStyle: string;
  bodySemiBoldStyle: string;
  bodyBoldStyle: string;
  fontsEmbedded: boolean;
}

export async function registerArenaPdfFonts(doc: jsPDF): Promise<PdfFontPalette> {
  try {
    const loaded = await Promise.all(
      ARENA_PDF_FONTS.map(async (spec) => ({
        spec,
        b64: await fetchFontBase64(spec.file),
      }))
    );

    const allOk = loaded.every((entry) => Boolean(entry.b64));
    if (!allOk) {
      return {
        headingFamily: 'helvetica',
        headingBoldStyle: 'bold',
        headingExtraBoldStyle: 'bold',
        bodyFamily: 'helvetica',
        bodyNormalStyle: 'normal',
        bodySemiBoldStyle: 'bold',
        bodyBoldStyle: 'bold',
        fontsEmbedded: false,
      };
    }

    for (const entry of loaded) {
      if (!entry.b64) continue;
      doc.addFileToVFS(entry.spec.file, entry.b64);
      doc.addFont(entry.spec.file, entry.spec.family, entry.spec.style);
    }

    return {
      headingFamily: 'Poppins',
      headingBoldStyle: 'bold',
      headingExtraBoldStyle: 'extrabold',
      bodyFamily: 'Montserrat',
      bodyNormalStyle: 'normal',
      bodySemiBoldStyle: 'semibold',
      bodyBoldStyle: 'bold',
      fontsEmbedded: true,
    };
  } catch {
    return {
      headingFamily: 'helvetica',
      headingBoldStyle: 'bold',
      headingExtraBoldStyle: 'bold',
      bodyFamily: 'helvetica',
      bodyNormalStyle: 'normal',
      bodySemiBoldStyle: 'bold',
      bodyBoldStyle: 'bold',
      fontsEmbedded: false,
    };
  }
}

async function loadImageAsDataUrl(src?: string): Promise<LoadedImageData | null> {
  if (!src || typeof window === 'undefined' || typeof Image === 'undefined') return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 300;
        canvas.height = img.naturalHeight || 120;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0);
        resolve({
          dataUrl: canvas.toDataURL('image/png'),
          width: canvas.width,
          height: canvas.height,
        });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawFittedImage(
  doc: jsPDF,
  img: LoadedImageData | null,
  x: number,
  y: number,
  maxW: number,
  maxH: number,
  alignRight = false
) {
  if (!img || img.width <= 0 || img.height <= 0) return;
  const ratio = img.width / img.height;
  let drawH = maxH;
  let drawW = drawH * ratio;
  if (drawW > maxW) {
    drawW = maxW;
    drawH = drawW / ratio;
  }
  const drawX = alignRight ? x + (maxW - drawW) : x;
  const drawY = y + (maxH - drawH) / 2;
  doc.addImage(img.dataUrl, 'PNG', drawX, drawY, drawW, drawH);
}

function formatLongDateFr(dateStr?: string): string {
  if (!dateStr) return '—';
  const clean = dateStr.slice(0, 10);
  const parsed = new Date(`${clean}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatNumberSpacing(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

interface UnifiedPdfDocumentInput {
  kind: 'invoice' | 'quote';
  documentNumber: string;
  entityId: string;
  issueDate: string;
  secondaryDate: string;
  currency: string;
  subtotal: number;
  total: number;
  invoiceType?: 'standard' | 'deposit';
  depositPercentage?: number;
  deductedDepositAmount?: number;
  showEuroConversion?: boolean;
  euroExchangeRate?: number;
  euroBankName?: string;
  euroRateDate?: string;
  notes?: string;
  items: Array<{
    label: string;
    description?: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
}

export async function buildArenaA4Pdf(
  input: UnifiedPdfDocumentInput,
  ctx: PdfDocContext
): Promise<{ doc: jsPDF; fontsEmbedded: boolean }> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const fonts = await registerArenaPdfFonts(doc);
  const theme = getEntityInvoiceTheme(ctx.entity?.id ?? input.entityId, ctx.entity?.color);

  const isDeposit = input.kind === 'invoice' && input.invoiceType === 'deposit';
  const hasDeductedDeposit =
    input.kind === 'invoice' &&
    !isDeposit &&
    Boolean(input.deductedDepositAmount && input.deductedDepositAmount > 0);

  const docTitle =
    input.kind === 'quote'
      ? 'DEVIS'
      : isDeposit
      ? "FACTURE D'ACOMPTE"
      : hasDeductedDeposit
      ? 'FACTURE DE SOLDE'
      : 'FACTURE';

  // --- 1. Top decorative angled banner (Charte Graphique) ---
  doc.setFillColor(...theme.softTintRgb);
  doc.triangle(108, 0, 210, 0, 210, 11, 'F');
  doc.triangle(108, 0, 99, 11, 210, 11, 'F');

  doc.setFillColor(...theme.primaryRgb);
  doc.triangle(0, 0, 128, 0, 116, 11, 'F');
  doc.triangle(0, 0, 0, 11, 116, 11, 'F');

  doc.setFillColor(...theme.secondaryRgb);
  doc.triangle(116, 11, 128, 0, 132, 0, 'F');
  doc.triangle(116, 11, 132, 0, 120, 11, 'F');

  // --- 2. Load entity light logo + Signature & Tampon ---
  const logoSrc = getBrandLogoPath(ctx.entity?.id ?? input.entityId ?? 'group', 'light');
  const [logoData, stampData, signatureData] = await Promise.all([
    loadImageAsDataUrl(logoSrc),
    loadImageAsDataUrl(ctx.legal?.stampImageUrl),
    loadImageAsDataUrl(ctx.legal?.signatureImageUrl),
  ]);

  drawFittedImage(doc, logoData, 14, 15, 58, 17);

  // Top-right bold heading in Poppins ExtraBold
  doc.setTextColor(17, 24, 39);
  doc.setFont(fonts.headingFamily, fonts.headingExtraBoldStyle);
  doc.setFontSize(docTitle.length > 10 ? 17 : 22);
  doc.text(docTitle, 196, 28, { align: 'right' });

  // --- 3. DE: block (Issuer entity details) ---
  let yLeft = 39;
  doc.setFont(fonts.bodyFamily, fonts.bodyBoldStyle);
  doc.setFontSize(8.5);
  doc.setTextColor(17, 24, 39);
  doc.text('DE:', 14, yLeft);
  yLeft += 5.5;

  doc.text((ctx.legal?.legalName || ctx.entity?.name || 'ARENA GROUP').toUpperCase(), 14, yLeft);
  yLeft += 4.2;

  doc.setFont(fonts.bodyFamily, fonts.bodyNormalStyle);
  doc.setFontSize(8);
  doc.setTextColor(31, 41, 55);
  if (ctx.legal?.address) {
    const addrLines = doc.splitTextToSize(ctx.legal.address, 95);
    doc.text(addrLines, 14, yLeft);
    yLeft += addrLines.length * 4;
  }
  if (ctx.legal?.nif) {
    doc.text(`NIF: ${ctx.legal.nif}`, 14, yLeft);
    yLeft += 4;
  }
  if (ctx.legal?.stat) {
    doc.text(`STAT: ${ctx.legal.stat}`, 14, yLeft);
    yLeft += 4;
  }
  if (ctx.legal?.rcs) {
    doc.text(`RCS: ${ctx.legal.rcs}`, 14, yLeft);
    yLeft += 4;
  }

  // --- 4. Client block & Document Metadata split ---
  let clientY = Math.max(yLeft + 5, 68);
  const metaStartY = clientY + 3;

  doc.setFont(fonts.bodyFamily, fonts.bodyBoldStyle);
  doc.setFontSize(8.5);
  doc.setTextColor(17, 24, 39);
  doc.text(input.kind === 'quote' ? 'DESTINATAIRE:' : 'FACTURÉ À:', 14, clientY);
  clientY += 5.2;

  const clientTitle = ctx.company?.legalName || ctx.contact?.fullName || 'Client';
  doc.text(clientTitle, 14, clientY);
  clientY += 4.2;

  doc.setFont(fonts.bodyFamily, fonts.bodyNormalStyle);
  doc.setFontSize(8);
  doc.setTextColor(31, 41, 55);

  if (ctx.company?.legalName && ctx.contact?.fullName) {
    doc.text(`À l'attention de : ${ctx.contact.fullName}`, 14, clientY);
    clientY += 4;
  }
  if (ctx.company?.address) {
    const compAddr = doc.splitTextToSize(ctx.company.address, 92);
    doc.text(compAddr, 14, clientY);
    clientY += compAddr.length * 4;
  }
  const cityCountry = [ctx.company?.city, ctx.company?.country].filter(Boolean).join(' ');
  if (cityCountry) {
    doc.text(cityCountry, 14, clientY);
    clientY += 4;
  }
  doc.text(`NIF: ${ctx.company?.nif || ''}`, 14, clientY);
  clientY += 4;
  doc.text(`STAT: ${ctx.company?.stat || ''}`, 14, clientY);
  clientY += 4;
  doc.text(`RCS: ${ctx.company?.rcs || ''}`, 14, clientY);
  clientY += 4;

  const clientPhone = ctx.company?.phone || ctx.contact?.phone || '';
  const clientEmail = ctx.company?.email || ctx.contact?.email || '';
  doc.text(`Téléphone : ${clientPhone}`, 14, clientY);
  clientY += 4;
  doc.text(`Mail : ${clientEmail}`, 14, clientY);
  clientY += 4;

  // Right column: Document No / Date d'émission / Date limite or Valable jusqu'au
  doc.setFontSize(8.5);
  doc.setTextColor(31, 41, 55);
  doc.setFont(fonts.bodyFamily, fonts.bodyNormalStyle);
  doc.text(input.kind === 'quote' ? 'Devis No :' : 'Facture No :', 115, metaStartY);
  doc.setFont(fonts.bodyFamily, fonts.bodyBoldStyle);
  doc.text(input.documentNumber, 160, metaStartY);

  doc.setFont(fonts.bodyFamily, fonts.bodyNormalStyle);
  doc.text("Date d'émission :", 115, metaStartY + 7);
  doc.setFont(fonts.bodyFamily, fonts.bodyBoldStyle);
  doc.text(formatDateFr(input.issueDate), 160, metaStartY + 7);

  doc.setFont(fonts.bodyFamily, fonts.bodyNormalStyle);
  doc.text(
    input.kind === 'quote' ? "Valable jusqu'au :" : 'Date limite de payement :',
    115,
    metaStartY + 14
  );
  doc.setFont(fonts.bodyFamily, fonts.bodyBoldStyle);
  doc.text(formatDateFr(input.secondaryDate), 160, metaStartY + 14);

  // --- 5. Line Items Table with Entity Theme Color ---
  const currencyLabel = input.currency === 'MGA' ? 'Ariary' : input.currency;
  let tableY = Math.max(clientY + 6, metaStartY + 26);

  doc.setFillColor(...theme.tableHeaderRgb);
  doc.rect(14, tableY, 182, 13, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont(fonts.bodyFamily, fonts.bodyBoldStyle);
  doc.setFontSize(8);

  doc.text('QUANTITÉ', 27, tableY + 7.5, { align: 'center' });
  doc.text('DESCRIPTIONS', 72, tableY + 7.5, { align: 'center' });
  doc.text('PRIX UNITAIRE', 142, tableY + 5.8, { align: 'center' });
  doc.text(`(${currencyLabel})`, 142, tableY + 9.8, { align: 'center' });
  doc.text('MONTANT', 179, tableY + 5.8, { align: 'center' });
  doc.text(`(${currencyLabel})`, 179, tableY + 9.8, { align: 'center' });

  tableY += 19;
  doc.setTextColor(17, 24, 39);
  doc.setFont(fonts.bodyFamily, fonts.bodyNormalStyle);
  doc.setFontSize(8.5);

  for (const item of input.items) {
    if (tableY > 215) {
      doc.addPage();
      tableY = 20;
    }
    const descLines = doc.splitTextToSize(item.label, 76);

    doc.setFont(fonts.bodyFamily, fonts.bodyNormalStyle);
    doc.text(String(item.quantity), 27, tableY, { align: 'center' });
    doc.setFont(fonts.bodyFamily, fonts.bodySemiBoldStyle);
    doc.text(descLines, 43, tableY);
    doc.setFont(fonts.bodyFamily, fonts.bodyNormalStyle);
    doc.text(formatNumberSpacing(item.unitPrice), 142, tableY, { align: 'center' });
    doc.text(formatNumberSpacing(item.lineTotal), 179, tableY, { align: 'center' });

    let rowAdvance = descLines.length * 4.5;
    if (item.description) {
      const subLines = doc.splitTextToSize(item.description, 76);
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(subLines, 43, tableY + rowAdvance + 0.5);
      rowAdvance += subLines.length * 3.8 + 1;
      doc.setFontSize(8.5);
      doc.setTextColor(17, 24, 39);
    }

    tableY += Math.max(10, rowAdvance + 5);
  }

  // Bottom border under items
  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.35);
  doc.line(14, tableY, 196, tableY);
  tableY += 6;

  // Subtotal / Deposit / Deducted Deposit breakdown (no TVA)
  if (isDeposit) {
    doc.setFont(fonts.bodyFamily, fonts.bodyNormalStyle);
    doc.setFontSize(8.5);
    doc.setTextColor(55, 65, 81);
    doc.text('TOTAL PRESTATIONS (100%)', 152, tableY, { align: 'right' });
    doc.text(formatNumberSpacing(input.subtotal), 179, tableY, { align: 'center' });
    tableY += 5.5;
    doc.text(`ACOMPTE FACTURÉ (${input.depositPercentage ?? 100}%)`, 152, tableY, {
      align: 'right',
    });
    doc.text(formatNumberSpacing(input.total), 179, tableY, { align: 'center' });
    tableY += 6;
  } else if (hasDeductedDeposit && input.deductedDepositAmount) {
    doc.setFont(fonts.bodyFamily, fonts.bodyNormalStyle);
    doc.setFontSize(8.5);
    doc.setTextColor(55, 65, 81);
    doc.text('TOTAL PRESTATIONS (100%)', 152, tableY, { align: 'right' });
    doc.text(formatNumberSpacing(input.subtotal), 179, tableY, { align: 'center' });
    tableY += 5.5;
    doc.text('ACOMPTE DÉDUIT', 152, tableY, { align: 'right' });
    doc.text(`- ${formatNumberSpacing(input.deductedDepositAmount)}`, 179, tableY, {
      align: 'center',
    });
    tableY += 6;
  }

  doc.setFont(fonts.headingFamily, fonts.headingBoldStyle);
  doc.setFontSize(9.5);
  doc.setTextColor(17, 24, 39);
  doc.text('TOTAL', 152, tableY, { align: 'right' });
  doc.text(formatNumberSpacing(input.total), 179, tableY, { align: 'center' });

  doc.setFont(fonts.bodyFamily, fonts.bodyNormalStyle);
  doc.setFontSize(7.5);
  doc.setTextColor(107, 114, 128);
  doc.text('TVA non applicable', 179, tableY + 4.5, { align: 'center' });

  // --- 6. Amount in words & optional Euro bank buying rate ---
  let wordsY = Math.max(tableY + 18, 178);
  const totalWords = formatInvoiceAmountInWords(input.total, input.currency);
  const euroCalc = input.showEuroConversion
    ? computeEuroConversion(input.total, input.euroExchangeRate)
    : null;

  const prefixSentence =
    input.kind === 'quote'
      ? `Arrêter le présent devis à la somme de ${formatCurrency(input.total, input.currency)} (${totalWords})`
      : `Arrêter à la somme de ${formatCurrency(input.total, input.currency)} (${totalWords})`;

  const sentence = euroCalc
    ? `${prefixSentence} soit ${euroCalc.formattedEuro}* (${formatInvoiceAmountInWords(
        euroCalc.euroAmount,
        'EUR'
      )}) si payement effectué par virement international.`
    : `${prefixSentence}.`;

  doc.setFont(fonts.bodyFamily, fonts.bodyNormalStyle);
  doc.setFontSize(8.5);
  doc.setTextColor(17, 24, 39);
  const sentenceLines = doc.splitTextToSize(sentence, 182);
  doc.text(sentenceLines, 14, wordsY);
  wordsY += sentenceLines.length * 4.5 + 3;

  if (euroCalc) {
    const bankLabel = input.euroBankName?.trim() || 'la banque';
    const rateDateLabel = formatLongDateFr(input.euroRateDate || input.issueDate);
    const rateFootnote = `* Cours d'achat de la Banque ${bankLabel} du ${rateDateLabel}, 1€ = ${formatNumberSpacing(
      euroCalc.exchangeRate
    )} Ar`;
    doc.setFontSize(8);
    doc.setTextColor(55, 65, 81);
    doc.text(rateFootnote, 14, wordsY);
    wordsY += 5.5;
  }

  if (input.notes && input.notes.trim()) {
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    const noteLines = doc.splitTextToSize(`Notes : ${input.notes.trim()}`, 182);
    doc.text(noteLines, 14, wordsY);
    wordsY += noteLines.length * 4 + 2;
  }

  // --- 7. Bottom section: Payment Conditions + Bank Details (Left) & Stamp/Signature (Right) ---
  const footerY = 283;
  const targetBottomBaseline = footerY - 5.5; // 277.5mm, crisp clearance above footer banner

  interface CondLineSpec {
    text: string;
    bold: boolean;
    fontSize: number;
    color: [number, number, number];
    stepAfter: number;
  }

  const condLinesToDraw: CondLineSpec[] = [];
  if (input.kind === 'quote') {
    condLinesToDraw.push({
      text: 'Notes',
      bold: true,
      fontSize: 7.5,
      color: [17, 24, 39],
      stepAfter: 3.4,
    });

    doc.setFont(fonts.bodyFamily, fonts.bodyNormalStyle);
    doc.setFontSize(6.7);
    const quoteNoteText =
      'Merci de bien vouloir nous envoyer le Bon de Commande correspondant ou nous retourner la proforma signée avec la mention "bon pour accord" pour valider la commande';
    const wrappedQuoteNote = doc.splitTextToSize(quoteNoteText, 118) as string[];
    wrappedQuoteNote.forEach((wLine) => {
      condLinesToDraw.push({
        text: wLine,
        bold: false,
        fontSize: 6.7,
        color: [31, 41, 55],
        stepAfter: 2.9,
      });
    });
  } else {
    condLinesToDraw.push({
      text: 'Conditions et modalités de paiement:',
      bold: true,
      fontSize: 7.5,
      color: [17, 24, 39],
      stepAfter: 3.4,
    });

    doc.setFont(fonts.bodyFamily, fonts.bodyNormalStyle);
    doc.setFontSize(6.7);
    const paymentTermsLines = (ctx.legal?.paymentTerms || '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    for (const term of paymentTermsLines) {
      const prefix = term.startsWith('•') || term.startsWith('-') ? '' : '• ';
      const wrapped = doc.splitTextToSize(`${prefix}${term}`, 118) as string[];
      wrapped.forEach((wLine) => {
        condLinesToDraw.push({
          text: wLine,
          bold: false,
          fontSize: 6.7,
          color: [31, 41, 55],
          stepAfter: 2.9,
        });
      });
    }

    if (ctx.legal?.iban || ctx.legal?.bankName || ctx.legal?.bankAccountHolder) {
      if (condLinesToDraw.length > 0) {
        condLinesToDraw[condLinesToDraw.length - 1].stepAfter += 1.0;
      }
      condLinesToDraw.push({
        text: '• Coordonnées Bancaires:',
        bold: true,
        fontSize: 6.7,
        color: [17, 24, 39],
        stepAfter: 3.0,
      });
      if (ctx.legal.bankAccountHolder) {
        condLinesToDraw.push({
          text: `Titulaire du compte: ${ctx.legal.bankAccountHolder}`,
          bold: false,
          fontSize: 6.7,
          color: [31, 41, 55],
          stepAfter: 2.9,
        });
      }
      if (ctx.legal.bankName) {
        condLinesToDraw.push({
          text: `Banque: ${ctx.legal.bankName}`,
          bold: false,
          fontSize: 6.7,
          color: [31, 41, 55],
          stepAfter: 2.9,
        });
      }
      if (ctx.legal.bankAddress) {
        const bankAddrLines = doc.splitTextToSize(`Adresse: ${ctx.legal.bankAddress}`, 118) as string[];
        bankAddrLines.forEach((bLine) => {
          condLinesToDraw.push({
            text: bLine,
            bold: false,
            fontSize: 6.7,
            color: [31, 41, 55],
            stepAfter: 2.9,
          });
        });
      }
      if (ctx.legal.iban) {
        condLinesToDraw.push({
          text: `IBAN: ${ctx.legal.iban}`,
          bold: false,
          fontSize: 6.7,
          color: [31, 41, 55],
          stepAfter: 2.9,
        });
      }
      if (ctx.legal.bic) {
        condLinesToDraw.push({
          text: `BIC: ${ctx.legal.bic}`,
          bold: false,
          fontSize: 6.7,
          color: [31, 41, 55],
          stepAfter: 2.9,
        });
      }
    }
  }

  // Span from first baseline to last baseline
  const baselineSpan = condLinesToDraw
    .slice(0, -1)
    .reduce((sum, item) => sum + item.stepAfter, 0);

  let bottomY = targetBottomBaseline - baselineSpan;
  let pageAddedForFooter = false;
  if (wordsY + 6 > bottomY) {
    doc.addPage();
    pageAddedForFooter = true;
    bottomY = targetBottomBaseline - baselineSpan;
  }

  let condY = bottomY;
  for (const line of condLinesToDraw) {
    doc.setFont(fonts.bodyFamily, line.bold ? fonts.bodyBoldStyle : fonts.bodyNormalStyle);
    doc.setFontSize(line.fontSize);
    doc.setTextColor(...line.color);
    doc.text(line.text, 14, condY);
    condY += line.stepAfter;
  }

  // Right side: Tampon + Signature bottom-aligned beside conditions above footer
  const effectiveWordsY = pageAddedForFooter ? 20 : wordsY;
  const sigBoxY = Math.max(effectiveWordsY + 4, footerY - 46);
  const stampMaxH = Math.max(28, footerY - 4 - sigBoxY);
  if (stampData) {
    drawFittedImage(doc, stampData, 128, sigBoxY, 68, stampMaxH, true);
  }
  if (signatureData) {
    const sigMaxH = Math.min(24, stampMaxH * 0.6);
    const sigTopY = sigBoxY + Math.max(10, stampMaxH - sigMaxH);
    drawFittedImage(doc, signatureData, 134, sigTopY, 56, sigMaxH, true);
  }

  // --- 8. Bottom angled footer banner with Phone & Email ---
  doc.setFillColor(...theme.secondaryRgb);
  doc.triangle(122, footerY, 210, footerY, 210, 297, 'F');
  doc.triangle(122, footerY, 110, 297, 210, 297, 'F');

  doc.setFillColor(...theme.primaryRgb);
  doc.triangle(0, footerY, 134, footerY, 122, 297, 'F');
  doc.triangle(0, footerY, 0, 297, 122, 297, 'F');

  const contactPhone = ctx.legal?.phone || '+261 38 02 410 05';
  const contactEmail = ctx.legal?.email || 'contact@group-arena.com';

  doc.setTextColor(255, 255, 255);
  doc.setFont(fonts.bodyFamily, fonts.bodyNormalStyle);
  doc.setFontSize(8.5);
  doc.text(`Tél : ${contactPhone}`, 14, 291.5);
  doc.text(`Email : ${contactEmail}`, 62, 291.5);

  return { doc, fontsEmbedded: fonts.fontsEmbedded };
}

export async function exportQuotePdf(
  quote: Quote,
  items: QuoteItem[],
  ctx: PdfDocContext
): Promise<string> {
  const { doc } = await buildArenaA4Pdf(
    {
      kind: 'quote',
      documentNumber: quote.quoteNumber,
      entityId: quote.entityId,
      issueDate: quote.issueDate,
      secondaryDate: quote.validUntil,
      currency: quote.currency,
      subtotal: quote.subtotal,
      total: quote.total,
      showEuroConversion: quote.showEuroConversion,
      euroExchangeRate: quote.euroExchangeRate,
      euroBankName: quote.euroBankName,
      euroRateDate: quote.euroRateDate,
      notes: quote.notes,
      items,
    },
    ctx
  );

  const filename = `${quote.quoteNumber}.pdf`;
  doc.save(filename);
  return filename;
}

export async function exportInvoicePdf(
  invoice: Invoice,
  items: InvoiceItem[],
  ctx: PdfDocContext
): Promise<string> {
  const { doc } = await buildArenaA4Pdf(
    {
      kind: 'invoice',
      documentNumber: invoice.invoiceNumber,
      entityId: invoice.entityId,
      issueDate: invoice.issueDate,
      secondaryDate: invoice.dueDate,
      currency: invoice.currency,
      subtotal: invoice.subtotal,
      total: invoice.total,
      invoiceType: invoice.invoiceType,
      depositPercentage: invoice.depositPercentage,
      deductedDepositAmount: invoice.deductedDepositAmount,
      showEuroConversion: invoice.showEuroConversion,
      euroExchangeRate: invoice.euroExchangeRate,
      euroBankName: invoice.euroBankName,
      euroRateDate: invoice.euroRateDate,
      notes: invoice.notes,
      items,
    },
    ctx
  );

  const filename = `${invoice.invoiceNumber}.pdf`;
  doc.save(filename);
  return filename;
}
