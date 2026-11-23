import { jsPDF } from 'jspdf';
import type { CrmEntity } from '../types';
import { formatCurrency, formatDateFr } from './crmLogic';
import {
  getAccountingReportFilename,
  type AccountingReportFilter,
  type AccountingReportResult,
} from './accountingReport';

function formatAmountPdf(amount: number, currency: string): string {
  return formatCurrency(amount, currency).replace(/[\u00A0\u202F]/g, ' ');
}

export function buildAccountingReportPdfDoc(
  report: AccountingReportResult,
  filter: AccountingReportFilter,
  entities: CrmEntity[]
): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = 297;
  const pageHeight = 210;
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;

  const entityName =
    filter.entityId === 'all'
      ? 'Toutes les entités autorisées'
      : entities.find((e) => e.id === filter.entityId)?.name ?? filter.entityId;

  const scopeLabel =
    filter.scope === 'both'
      ? 'Factures & Devis (Compilé)'
      : filter.scope === 'invoices'
      ? 'Factures uniquement'
      : 'Devis uniquement';

  const periodLabel =
    filter.dateFrom || filter.dateTo
      ? `Période : ${filter.dateFrom ? formatDateFr(filter.dateFrom) : '...'} au ${
          filter.dateTo ? formatDateFr(filter.dateTo) : '...'
        }`
      : 'Période : Toutes dates';

  const drawHeader = (pageNum: number) => {
    doc.setFillColor(25, 40, 62);
    doc.rect(0, 0, pageWidth, 22, 'F');
    doc.setFillColor(201, 161, 37);
    doc.rect(0, 22, pageWidth, 1.2, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('ARENA GROUP — REPORTING COMPTABLE COMPILÉ', margin, 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(`${scopeLabel} · ${entityName} · ${periodLabel}`, margin, 16.8);

    doc.setFontSize(8);
    doc.text(
      `Édité le ${formatDateFr(report.generatedAtIso.slice(0, 10))} · Page ${pageNum}`,
      pageWidth - margin,
      10,
      { align: 'right' }
    );
  };

  let pageNumber = 1;
  drawHeader(pageNumber);

  let y = 29;

  // Compiled summary by currency
  doc.setTextColor(25, 40, 62);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('SYNTHÈSE COMPTABLE COMPILÉE', margin, y);
  y += 4;

  if (report.totalsByCurrency.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Aucun document ne correspond aux critères sélectionnés.', margin, y + 4);
    y += 10;
  } else {
    for (const s of report.totalsByCurrency) {
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, y, contentWidth, 12, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(25, 40, 62);
      doc.text(`Devise ${s.currency}`, margin + 3, y + 5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      doc.text(
        `Factures (${s.invoiceCount}) : Prestation 100% ${formatAmountPdf(
          s.invoicesSubtotal,
          s.currency
        )}  |  Net facturé ${formatAmountPdf(s.invoicesNetTotal, s.currency)}  |  Encaissé ${formatAmountPdf(
          s.invoicesPaid,
          s.currency
        )}  |  Solde dû ${formatAmountPdf(s.invoicesRemaining, s.currency)}`,
        margin + 28,
        y + 4.8
      );
      doc.text(
        `Devis (${s.quoteCount}) : Total devis ${formatAmountPdf(
          s.quotesTotal,
          s.currency
        )}  |  Convertis en facture : ${s.quotesConvertedCount}`,
        margin + 28,
        y + 9.5
      );
      y += 14.5;
    }
  }

  y += 2;
  const isLineMode = filter.granularity === 'line';

  // Table columns in landscape A4 (273mm total content width)
  const cols = isLineMode
    ? [
        { label: 'Cat.', w: 16, align: 'left' as const },
        { label: 'Numéro', w: 30, align: 'left' as const },
        { label: 'Entité', w: 14, align: 'left' as const },
        { label: 'Émission', w: 20, align: 'left' as const },
        { label: 'Client (NIF)', w: 46, align: 'left' as const },
        { label: 'Prestation / Ligne', w: 59, align: 'left' as const },
        { label: 'Qté', w: 12, align: 'right' as const },
        { label: 'Statut', w: 26, align: 'left' as const },
        { label: 'Total ligne', w: 25, align: 'right' as const },
        { label: 'Net Doc.', w: 25, align: 'right' as const },
      ]
    : [
        { label: 'Cat.', w: 16, align: 'left' as const },
        { label: 'Type', w: 26, align: 'left' as const },
        { label: 'Numéro', w: 31, align: 'left' as const },
        { label: 'Ent.', w: 12, align: 'left' as const },
        { label: 'Émission', w: 20, align: 'left' as const },
        { label: 'Client / NIF', w: 48, align: 'left' as const },
        { label: 'Statut', w: 27, align: 'left' as const },
        { label: 'Prestation 100%', w: 24, align: 'right' as const },
        { label: 'Net à payer', w: 24, align: 'right' as const },
        { label: 'Encaissé', w: 23, align: 'right' as const },
        { label: 'Reste dû', w: 22, align: 'right' as const },
      ];

  const drawTableHeader = () => {
    doc.setFillColor(25, 40, 62);
    doc.rect(margin, y, contentWidth, 7.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.3);
    let x = margin;
    for (const c of cols) {
      const tx = c.align === 'right' ? x + c.w - 1.5 : x + 1.5;
      doc.text(c.label, tx, y + 5, { align: c.align });
      x += c.w;
    }
    y += 7.5;
  };

  drawTableHeader();

  report.rows.forEach((row, idx) => {
    const rowHeight = 7.2;
    if (y + rowHeight > pageHeight - 14) {
      doc.addPage();
      pageNumber += 1;
      drawHeader(pageNumber);
      y = 29;
      drawTableHeader();
    }

    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, contentWidth, rowHeight, 'F');
    }
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y + rowHeight, margin + contentWidth, y + rowHeight);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(30, 41, 59);

    const clientLabel = row.clientNif
      ? `${row.clientName} (${row.clientNif})`
      : row.clientName;

    const values = isLineMode
      ? [
          row.documentCategory,
          row.documentNumber,
          row.entityCode,
          row.issueDate,
          clientLabel,
          row.lineLabel || row.itemsSummary || '—',
          row.lineQuantity !== null ? String(row.lineQuantity) : '—',
          row.status,
          row.lineTotal !== null ? formatAmountPdf(row.lineTotal, row.currency) : '—',
          formatAmountPdf(row.netTotal, row.currency),
        ]
      : [
          row.documentCategory,
          row.documentSubType.replace('Facture ', ''),
          row.documentNumber,
          row.entityCode,
          row.issueDate,
          clientLabel,
          row.status,
          formatAmountPdf(row.subtotal, row.currency),
          formatAmountPdf(row.netTotal, row.currency),
          row.documentCategory === 'Facture' ? formatAmountPdf(row.paidAmount, row.currency) : '—',
          row.documentCategory === 'Facture'
            ? formatAmountPdf(row.remainingAmount, row.currency)
            : '—',
        ];

    let x = margin;
    cols.forEach((c, cIdx) => {
      const raw = values[cIdx] ?? '';
      const clipped = doc.splitTextToSize(raw, c.w - 3)[0] ?? '';
      const tx = c.align === 'right' ? x + c.w - 1.5 : x + 1.5;
      if (cIdx === 2 || (isLineMode && cIdx === 1)) {
        doc.setFont('helvetica', 'bold');
      } else {
        doc.setFont('helvetica', 'normal');
      }
      doc.text(clipped, tx, y + 4.8, { align: c.align });
      x += c.w;
    });

    y += rowHeight;
  });

  // Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Total compilé : ${report.invoiceCount} facture(s) · ${report.quoteCount} devis · ${report.rows.length} ligne(s) exportée(s)`,
    margin,
    pageHeight - 6
  );

  return doc;
}

export function exportAccountingReportPdf(
  report: AccountingReportResult,
  filter: AccountingReportFilter,
  entities: CrmEntity[]
): string {
  const doc = buildAccountingReportPdfDoc(report, filter, entities);
  const filename = getAccountingReportFilename(filter, entities, 'pdf');
  doc.save(filename);
  return filename;
}
