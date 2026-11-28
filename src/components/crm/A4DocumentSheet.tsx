import { useEffect, useRef, useState } from 'react';
import { Mail, Phone } from 'lucide-react';
import { BrandLogo } from '../ui/BrandLogo';
import type { Company, Contact, CrmEntity, InvoiceType, LegalSetting } from '../../types';
import { getEntityInvoiceTheme } from '../../utils/branding';
import {
  computeEuroConversion,
  formatInlineAddress,
  getClientFiscalInfo,
  getDocumentAmountInWordsPrefix,
  getInvoiceTotalsDisplaySpec,
  parseFormattedDescriptionLines,
  shouldRenderStampAndSignature,
} from '../../utils/billingLogic';
import { formatCurrency, formatDateFr, sanitizeSafeImageSrc } from '../../utils/crmLogic';
import { formatInvoiceAmountInWords } from '../../utils/numberToWordsFr';

// A4 standard dimensions at 96 DPI (210mm x 297mm)
export const A4_WIDTH_PX = 794;
export const A4_HEIGHT_PX = 1123;

export interface A4LineItem {
  id: string;
  label: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface A4DocumentData {
  kind: 'invoice' | 'quote';
  documentNumber: string;
  entityId: string;
  issueDate: string;
  secondaryDate: string;
  currency: string;
  subtotal: number;
  total: number;
  invoiceType?: InvoiceType;
  depositPercentage?: number;
  deductedDepositAmount?: number;
  showEuroConversion?: boolean;
  euroExchangeRate?: number;
  euroBankName?: string;
  euroRateDate?: string;
  notes?: string;
  items: A4LineItem[];
  entity?: CrmEntity;
  legal?: LegalSetting;
  company?: Company;
  contact?: Contact;
  testId?: string;
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

function formatSpacedNumber(val: number): string {
  return Math.round(val)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function A4DocumentSheet({
  kind,
  documentNumber,
  entityId,
  issueDate,
  secondaryDate,
  currency,
  subtotal,
  total,
  invoiceType,
  depositPercentage,
  deductedDepositAmount,
  showEuroConversion,
  euroExchangeRate,
  euroBankName,
  euroRateDate,
  notes,
  items,
  entity,
  legal,
  company,
  contact,
  testId,
}: A4DocumentData) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const updateScale = () => {
      const avail = el.clientWidth;
      if (avail > 0) {
        setScale(Math.min(1, avail / A4_WIDTH_PX));
      }
    };
    updateScale();
    const obs = new ResizeObserver(updateScale);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const theme = getEntityInvoiceTheme(entityId, entity?.color);
  const clientFiscal = getClientFiscalInfo(company, contact);
  const clientAddressLine = formatInlineAddress(company?.address, company?.city, company?.country);

  const {
    docTitle,
    isDeposit,
    isBalance,
    depositRowLabel,
    netLabel,
  } = getInvoiceTotalsDisplaySpec({
    kind,
    invoiceType,
    subtotal,
    depositPercentage,
    deductedDepositAmount,
  });

  const currencyLabel = currency === 'MGA' ? 'Ariary' : currency;
  const totalWords = formatInvoiceAmountInWords(total, currency);
  const euroCalc = showEuroConversion ? computeEuroConversion(total, euroExchangeRate) : null;
  const euroWords = euroCalc ? formatInvoiceAmountInWords(euroCalc.euroAmount, 'EUR') : '';

  const paymentTermsLines = (legal?.paymentTerms || '')
    .split('\n')
    .map((l) => l.trim().replace(/^[•-]\s*/, ''))
    .filter(Boolean);

  const scaledW = Math.round(A4_WIDTH_PX * scale);
  const scaledH = Math.round(A4_HEIGHT_PX * scale);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
        <span>Format A4 · 210 × 297 mm ({Math.round(scale * 100)}%)</span>
        <span className="font-medium text-slate-600">
          Polices Charte Graphique : Poppins &amp; Montserrat / Gotham
        </span>
      </div>

      <div
        ref={containerRef}
        className="w-full rounded-xl border border-slate-200 bg-slate-100/80 p-3 sm:p-5 flex justify-center overflow-hidden"
      >
        <div
          style={{
            width: `${scaledW}px`,
            height: `${scaledH}px`,
          }}
          className="relative shrink-0"
        >
          <div
            data-testid={testId}
            data-a4-sheet="true"
            style={{
              width: `${A4_WIDTH_PX}px`,
              minHeight: `${A4_HEIGHT_PX}px`,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
            className="bg-white shadow-md border border-slate-200 text-slate-900 font-sans flex flex-col justify-between overflow-hidden"
          >
            {/* 1. Bandeau supérieur incliné selon la charte entité */}
            <div className="relative h-10 w-full shrink-0 overflow-hidden">
              <div
                className="absolute inset-0"
                style={{
                  backgroundColor: theme.softTintHex,
                  clipPath: 'polygon(48% 0, 100% 0, 100% 100%, 44% 100%)',
                }}
              />
              <div
                className="absolute inset-0"
                style={{
                  backgroundColor: theme.secondaryHex,
                  clipPath: 'polygon(52% 0, 56% 0, 52% 100%, 48% 100%)',
                }}
              />
              <div
                className="absolute inset-0"
                style={{
                  backgroundColor: theme.primaryHex,
                  clipPath: 'polygon(0 0, 54% 0, 50% 100%, 0 100%)',
                }}
              />
            </div>

            {/* 2. Corps du document A4 */}
            <div className="flex-1 px-11 pt-5 pb-3 flex flex-col justify-between gap-4">
              <div className="space-y-4">
                {/* Logo entité + Titre document */}
                <div className="flex items-start justify-between gap-4">
                  <div className="h-14 w-52 flex items-center justify-start">
                    <BrandLogo
                      entityId={entityId}
                      variant="light"
                      alt={entity?.name ?? 'Logo entité'}
                      customUrl={entity?.logoUrl?.trim() || undefined}
                      className="h-full w-auto max-w-full object-contain object-left"
                    />
                  </div>
                  <div className="text-right pt-2">
                    <h2 className="font-display text-3xl font-extrabold tracking-tight text-slate-900">
                      {docTitle}
                    </h2>
                  </div>
                </div>

                {/* DE: Bloc émetteur */}
                <div className="text-[12px] leading-relaxed text-slate-800 space-y-0.5">
                  <p className="font-bold text-slate-900 uppercase">DE:</p>
                  <p className="font-bold text-slate-900 uppercase">
                    {legal?.legalName || entity?.name || 'ARENA GROUP'}
                  </p>
                  {legal?.address && <p>{legal.address}</p>}
                  {legal?.nif && <p>NIF: {legal.nif}</p>}
                  {legal?.stat && <p>STAT: {legal.stat}</p>}
                  {legal?.rcs && <p>RCS: {legal.rcs}</p>}
                </div>

                {/* Bloc Client + Métadonnées document */}
                <div className="grid grid-cols-12 gap-6 items-start">
                  <div className="col-span-7 text-[12px] leading-relaxed text-slate-800 space-y-0.5">
                    <p className="font-bold text-slate-900 uppercase">
                      {kind === 'quote' ? 'DESTINATAIRE:' : 'FACTURÉ À:'}
                    </p>
                    <p className="font-bold text-slate-900">
                      {company?.legalName || contact?.fullName || 'Client'}
                    </p>
                    {company?.legalName && contact?.fullName && (
                      <p className="text-slate-600">À l&apos;attention de : {contact.fullName}</p>
                    )}
                    {clientAddressLine && <p>{clientAddressLine}</p>}
                    {clientFiscal.lines.map((line) => (
                      <p key={line.label}>
                        {line.label}: {line.value}
                      </p>
                    ))}
                    <p>Téléphone : {company?.phone || contact?.phone || ''}</p>
                    <p>Mail : {company?.email || contact?.email || ''}</p>
                  </div>

                  <div className="col-span-5 text-[12px] space-y-2 pt-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-600">
                        {kind === 'quote' ? 'Devis No :' : 'Facture No :'}
                      </span>
                      <span className="font-bold font-sans tabular-nums text-slate-900">
                        {documentNumber}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-600">Date d&apos;émission :</span>
                      <span className="font-bold font-sans tabular-nums text-slate-900">
                        {formatDateFr(issueDate)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-600">
                        {kind === 'quote' ? "Valable jusqu'au :" : 'Date limite de payement :'}
                      </span>
                      <span className="font-bold font-sans tabular-nums text-slate-900">
                        {formatDateFr(secondaryDate)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tableau lignes avec en-tête coloré selon l'entité */}
                <div className="border-b border-slate-500">
                  <table className="w-full border-collapse text-[12px]">
                    <thead>
                      <tr style={{ backgroundColor: theme.tableHeaderHex }} className="text-white">
                        <th className="py-3 px-2 text-center font-bold w-20">QUANTITÉ</th>
                        <th className="py-3 px-2.5 text-center font-bold">DESCRIPTIONS</th>
                        <th className="py-3 px-2 text-center font-bold w-28 whitespace-nowrap">
                          PRIX UNITAIRE
                          <div className="font-semibold text-[11px]">({currencyLabel})</div>
                        </th>
                        <th className="py-3 px-2 text-center font-bold w-28 whitespace-nowrap">
                          MONTANT
                          <div className="font-semibold text-[11px]">({currencyLabel})</div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((item) => (
                        <tr key={item.id}>
                          <td className="py-2.5 px-2 text-center font-sans tabular-nums text-slate-800 whitespace-nowrap">
                            {item.quantity}
                          </td>
                          <td className="py-2.5 px-2.5 text-slate-900 align-top">
                            <div className="font-medium">{item.label}</div>
                            {item.description && (() => {
                              const descLines = parseFormattedDescriptionLines(item.description);
                              if (descLines.length === 0) return null;
                              return (
                                <div className="text-[11px] text-slate-500 mt-1 space-y-0.5">
                                  {descLines.map((line, lineIdx) => {
                                    if (line.kind === 'blank') {
                                      return <div key={lineIdx} className="h-1.5" aria-hidden="true" />;
                                    }
                                    if (line.kind === 'bullet') {
                                      return (
                                        <div
                                          key={lineIdx}
                                          className={`flex items-start gap-1.5 leading-snug ${
                                            line.indentLevel > 0 ? 'pl-3' : ''
                                          }`}
                                        >
                                          <span className="shrink-0 select-none">{line.bullet}</span>
                                          <span className="min-w-0 break-words">{line.content}</span>
                                        </div>
                                      );
                                    }
                                    return (
                                      <div
                                        key={lineIdx}
                                        className={`leading-snug break-words ${
                                          line.indentLevel > 0 ? 'pl-3' : ''
                                        }`}
                                      >
                                        {line.content}
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                          </td>
                          <td className="py-2.5 px-2 text-right font-sans tabular-nums text-slate-800 whitespace-nowrap">
                            {formatSpacedNumber(item.unitPrice)}
                          </td>
                          <td className="py-2.5 px-2 text-right font-sans tabular-nums text-slate-900 whitespace-nowrap">
                            {formatSpacedNumber(item.lineTotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totaux (sans TVA) */}
                <div className="flex flex-col items-end space-y-1 text-[12px]">
                  {isDeposit && (
                    <>
                      <div className="flex items-center gap-6 text-slate-600">
                        <span>TOTAL PRESTATION (100%)</span>
                        <span className="w-28 px-2 text-right font-sans tabular-nums whitespace-nowrap">
                          {formatSpacedNumber(subtotal)}
                        </span>
                      </div>
                      <div className="flex items-center gap-6 text-[#AD7300] font-medium">
                        <span>{depositRowLabel}</span>
                        <span className="w-28 px-2 text-right font-sans tabular-nums whitespace-nowrap">
                          {formatSpacedNumber(total)}
                        </span>
                      </div>
                    </>
                  )}
                  {isBalance && (
                    <>
                      <div className="flex items-center gap-6 text-slate-600">
                        <span>TOTAL PRESTATION (100%)</span>
                        <span className="w-28 px-2 text-right font-sans tabular-nums whitespace-nowrap">
                          {formatSpacedNumber(subtotal)}
                        </span>
                      </div>
                      <div className="flex items-center gap-6 text-emerald-700 font-medium">
                        <span>{depositRowLabel}</span>
                        <span className="w-28 px-2 text-right font-sans tabular-nums whitespace-nowrap">
                          - {formatSpacedNumber(deductedDepositAmount ?? 0)}
                        </span>
                      </div>
                    </>
                  )}
                  <div className="flex items-center gap-6 text-sm font-bold text-slate-900 pt-1">
                    <span className="font-display">{netLabel}</span>
                    <span className="w-28 px-2 text-right font-display tabular-nums whitespace-nowrap">
                      {formatSpacedNumber(total)}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 px-2">TVA non applicable</span>
                </div>

                {/* Montant en lettres + conversion Euro optionnelle */}
                <div className="pt-1 space-y-2 text-[12px] text-slate-900 leading-relaxed">
                  <p>
                    {getDocumentAmountInWordsPrefix(kind)}
                    <strong>{formatCurrency(total, currency)}</strong> ({totalWords})
                    {euroCalc ? (
                      <>
                        {' '}
                        soit <strong>{euroCalc.formattedEuro}*</strong> ({euroWords}) si payement
                        effectué par virement international.
                      </>
                    ) : (
                      '.'
                    )}
                  </p>
                  {euroCalc && (
                    <p className="text-[11px] text-slate-600">
                      * Cours d&apos;achat de la Banque{' '}
                      {euroBankName?.trim() || 'indiquée'} du{' '}
                      {formatLongDateFr(euroRateDate || issueDate)}, 1€ ={' '}
                      {formatSpacedNumber(euroCalc.exchangeRate)}Ar
                    </p>
                  )}
                  {notes && notes.trim() && (
                    <p className="text-[11px] text-slate-600 pt-1">
                      <span className="font-semibold text-slate-800">Notes :</span> {notes}
                    </p>
                  )}
                </div>
              </div>

              {/* Conditions + Coordonnées Bancaires à gauche, Tampon & Signature à droite (factures uniquement) */}
              <div className="mt-auto grid grid-cols-12 gap-6 pt-2 items-end">
                <div
                  className={`${
                    shouldRenderStampAndSignature(kind) ? 'col-span-7' : 'col-span-12'
                  } text-[9.5px] text-slate-800 space-y-0.5 leading-snug`}
                >
                  {kind === 'quote' ? (
                    <>
                      <p className="text-[10px] font-bold text-slate-900">Notes</p>
                      <p>
                        Merci de bien vouloir nous envoyer le Bon de Commande correspondant ou nous
                        retourner la proforma signée avec la mention &quot;bon pour accord&quot; pour
                        valider la commande
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-[10px] font-bold text-slate-900">
                        Conditions et modalités de paiement:
                      </p>
                      {paymentTermsLines.map((line, i) => (
                        <p key={i}>• {line}</p>
                      ))}
                      {(legal?.iban || legal?.bankName || legal?.bankAccountHolder) && (
                        <div className="pt-0.5 space-y-0">
                          <p className="font-semibold text-slate-900">• Coordonnées Bancaires:</p>
                          {legal.bankAccountHolder && (
                            <p>Titulaire du compte: {legal.bankAccountHolder}</p>
                          )}
                          {legal.bankName && <p>Banque: {legal.bankName}</p>}
                          {legal.bankAddress && <p>Adresse: {legal.bankAddress}</p>}
                          {legal.iban && <p className="font-sans tabular-nums">IBAN: {legal.iban}</p>}
                          {legal.bic && <p className="font-sans tabular-nums">BIC: {legal.bic}</p>}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {shouldRenderStampAndSignature(kind) && (
                  <div className="col-span-5 flex flex-col items-end justify-end min-h-[164px] relative">
                    {sanitizeSafeImageSrc(legal?.stampImageUrl) ||
                    sanitizeSafeImageSrc(legal?.signatureImageUrl) ? (
                      <div className="relative flex flex-col items-center justify-center w-64 min-h-[156px]">
                        {sanitizeSafeImageSrc(legal?.stampImageUrl) && (
                          <img
                            src={sanitizeSafeImageSrc(legal?.stampImageUrl)}
                            alt={`Tampon ${entity?.name ?? 'entité'}`}
                            className="max-h-40 max-w-[230px] w-auto object-contain opacity-90"
                          />
                        )}
                        {sanitizeSafeImageSrc(legal?.signatureImageUrl) && (
                          <img
                            src={sanitizeSafeImageSrc(legal?.signatureImageUrl)}
                            alt={`Signature ${entity?.name ?? 'entité'}`}
                            className={`max-h-20 max-w-[200px] w-auto object-contain ${
                              sanitizeSafeImageSrc(legal?.stampImageUrl) ? '-mt-12 relative z-10' : ''
                            }`}
                          />
                        )}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-slate-300 px-4 py-5 text-center text-[11px] text-slate-400">
                        Cachet &amp; Signature
                        <div className="text-[10px]">(À importer dans Paramètres)</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 3. Bandeau inférieur incliné avec téléphone et email */}
            <div className="relative h-12 w-full shrink-0 overflow-hidden flex items-center px-12 text-white text-[12px]">
              <div
                className="absolute inset-0"
                style={{
                  backgroundColor: theme.secondaryHex,
                  clipPath: 'polygon(56% 0, 100% 0, 100% 100%, 50% 100%)',
                }}
              />
              <div
                className="absolute inset-0"
                style={{
                  backgroundColor: theme.primaryHex,
                  clipPath: 'polygon(0 0, 62% 0, 56% 100%, 0 100%)',
                }}
              />
              <div className="relative z-10 flex flex-wrap items-center gap-6">
                <span className="inline-flex items-center gap-1.5 font-sans tabular-nums">
                  <Phone className="h-3.5 w-3.5 text-[#C9A125]" />
                  {legal?.phone || '—'}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-[#C9A125]" />
                  {legal?.email || '—'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
