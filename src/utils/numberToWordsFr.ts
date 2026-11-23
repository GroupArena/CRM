const UNITS = [
  '',
  'UN',
  'DEUX',
  'TROIS',
  'QUATRE',
  'CINQ',
  'SIX',
  'SEPT',
  'HUIT',
  'NEUF',
  'DIX',
  'ONZE',
  'DOUZE',
  'TREIZE',
  'QUATORZE',
  'QUINZE',
  'SEIZE',
  'DIX-SEPT',
  'DIX-HUIT',
  'DIX-NEUF',
];

const TENS = [
  '',
  'DIX',
  'VINGT',
  'TRENTE',
  'QUARANTE',
  'CINQUANTE',
  'SOIXANTE',
  'SOIXANTE',
  'QUATRE-VINGT',
  'QUATRE-VINGT',
];

function convertUnder100(n: number): string {
  if (n === 0) return '';
  if (n < 20) return UNITS[n];

  const ten = Math.floor(n / 10);
  const unit = n % 10;

  if (ten === 7 || ten === 9) {
    const sub = 10 + unit;
    const prefix = TENS[ten];
    if (ten === 7 && unit === 1) {
      return `${prefix} ET ONZE`;
    }
    return `${prefix}-${UNITS[sub]}`;
  }

  if (ten === 8) {
    if (unit === 0) return 'QUATRE-VINGTS';
    return `QUATRE-VINGT-${UNITS[unit]}`;
  }

  if (unit === 0) return TENS[ten];
  if (unit === 1) return `${TENS[ten]} ET UN`;
  return `${TENS[ten]}-${UNITS[unit]}`;
}

function convertUnder1000(n: number): string {
  if (n === 0) return '';
  if (n < 100) return convertUnder100(n);

  const hundreds = Math.floor(n / 100);
  const rest = n % 100;

  let hundredWord = '';
  if (hundreds === 1) {
    hundredWord = 'CENT';
  } else if (rest === 0) {
    hundredWord = `${UNITS[hundreds]} CENTS`;
  } else {
    hundredWord = `${UNITS[hundreds]} CENT`;
  }

  return rest === 0 ? hundredWord : `${hundredWord} ${convertUnder100(rest)}`;
}

export function numberToFrenchWords(value: number): string {
  const safe = Math.floor(Math.max(0, Number.isFinite(value) ? value : 0));
  if (safe === 0) return 'ZÉRO';

  const parts: string[] = [];

  const billions = Math.floor(safe / 1_000_000_000);
  const millions = Math.floor((safe % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((safe % 1_000_000) / 1_000);
  const remainder = safe % 1_000;

  if (billions > 0) {
    parts.push(
      billions === 1 ? 'UN MILLIARD' : `${convertUnder1000(billions)} MILLIARDS`
    );
  }

  if (millions > 0) {
    parts.push(
      millions === 1 ? 'UN MILLION' : `${convertUnder1000(millions)} MILLIONS`
    );
  }

  if (thousands > 0) {
    parts.push(thousands === 1 ? 'MILLE' : `${convertUnder1000(thousands)} MILLE`);
  }

  if (remainder > 0) {
    parts.push(convertUnder1000(remainder));
  }

  return parts.join(' ').trim();
}

export function formatInvoiceAmountInWords(
  amount: number,
  currency: string = 'MGA'
): string {
  const cleanAmount = Math.max(0, Number.isFinite(amount) ? amount : 0);
  const code = (currency || 'MGA').toUpperCase();

  if (code === 'EUR') {
    const roundedCents = Math.round(cleanAmount * 100);
    const euros = Math.floor(roundedCents / 100);
    const cents = roundedCents % 100;
    const euroWords = numberToFrenchWords(euros);
    if (cents === 0) {
      return `${euroWords} EURO`;
    }
    return `${euroWords} EURO ${numberToFrenchWords(cents)}`;
  }

  if (code === 'USD') {
    const roundedCents = Math.round(cleanAmount * 100);
    const dollars = Math.floor(roundedCents / 100);
    const cents = roundedCents % 100;
    const dollarWords = numberToFrenchWords(dollars);
    return cents === 0
      ? `${dollarWords} DOLLARS`
      : `${dollarWords} DOLLARS ${numberToFrenchWords(cents)}`;
  }

  const integerMga = Math.round(cleanAmount);
  return `${numberToFrenchWords(integerMga)} ARIARY`;
}
