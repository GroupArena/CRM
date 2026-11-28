export const ARENA_COLORS = {
  bleuInstitutionnel: '#19283E',
  bleuInstitutionnelHover: '#223552',
  orPrincipal: '#C9A125',
  orFonce: '#AD7300',
  orClair: '#DBB361',
  grisClair: '#E1E4EA',
  canvas: '#F4F5F8',
  rougeBordeaux: '#7A1F2B',
} as const;

export const ARENA_SLOGANS = {
  primary: 'Chaque étape compte. On la construit avec vous.',
  closing: 'Un même langage. Une même vision. Une même ambition.',
  paletteRule: 'Le bleu institutionnel construit. Le gris clair respire. L’or signe.',
} as const;

export interface PaletteSwatch {
  name: string;
  role: string;
  hex: string;
  rgb: string;
  usage: string;
  textColor: string;
}

export const ARENA_PALETTE_SWATCHES: PaletteSwatch[] = [
  {
    name: 'Bleu Institutionnel',
    role: 'Principale · Fondation',
    hex: '#19283E',
    rgb: '25 | 40 | 62',
    usage: 'Confiance, rigueur, crédibilité et professionnalisme.',
    textColor: '#FFFFFF',
  },
  {
    name: 'Or principal',
    role: 'Principale · Signature',
    hex: '#C9A125',
    rgb: '201 | 161 | 37',
    usage: 'Couleur signature. Excellence, ambition, valeur et distinction.',
    textColor: '#19283E',
  },
  {
    name: 'Gris clair',
    role: 'Principale · Respiration',
    hex: '#E1E4EA',
    rgb: '225 | 228 | 234',
    usage: 'Clarté, respiration et modernité sur les interfaces.',
    textColor: '#19283E',
  },
  {
    name: 'Or foncé',
    role: 'Complémentaire',
    hex: '#AD7300',
    rgb: '173 | 115 | 0',
    usage: 'Soutien de l’or principal, contraste et dégradés riches.',
    textColor: '#FFFFFF',
  },
  {
    name: 'Or clair',
    role: 'Complémentaire',
    hex: '#DBB361',
    rgb: '219 | 179 | 97',
    usage: 'Adoucit la palette et apporte de la lumière.',
    textColor: '#19283E',
  },
  {
    name: 'Rouge bordeaux',
    role: 'Accent ponctuel',
    hex: '#7A1F2B',
    rgb: '122 | 31 | 43',
    usage: 'Utilisation ponctuelle et mesurée pour signaler ou souligner.',
    textColor: '#FFFFFF',
  },
];

export type BrandKey =
  | 'group'
  | 'arena-business-center'
  | 'improveo'
  | 'arena-studio-comm'
  | 'maison-artisanat';

export type LogoVariant = 'light' | 'dark' | 'darkMono';

export interface BrandLogoSpec {
  id: BrandKey;
  label: string;
  accentColor: string;
  lightPath: string;
  darkPath: string;
  darkMonoPath?: string;
}

export const BRAND_LOGOS: Record<BrandKey, BrandLogoSpec> = {
  group: {
    id: 'group',
    label: 'Arena Group',
    accentColor: ARENA_COLORS.orPrincipal,
    lightPath: 'assets/aistudio/Arena_Group_-_Fond_claire_3b21c334.png',
    darkPath: 'assets/aistudio/Arena_Group_-_Fond_Sombre_9be7374e.png',
  },
  'arena-business-center': {
    id: 'arena-business-center',
    label: 'Arena Business Center',
    accentColor: '#19283E',
    lightPath: 'assets/aistudio/Arena_Business_Center_-_Fond_Claire_b733f259.png',
    darkPath: 'assets/aistudio/Arena_Business_Center_-_Fond_Sombre_b9af2fa1.png',
  },
  improveo: {
    id: 'improveo',
    label: 'Improveo',
    accentColor: '#0B4EA2',
    lightPath: 'assets/aistudio/Improveo_-_Fond_Claire_-_Logo_187e51f4.png',
    darkPath: 'assets/aistudio/Improveo_-_Fond_Sombre_-_Logo_dd27f192.png',
  },
  'arena-studio-comm': {
    id: 'arena-studio-comm',
    label: 'Arena Studio Comm',
    accentColor: '#0B6CA8',
    lightPath: 'assets/aistudio/Arena_Studio_Comm_-_Fond_Claire_ab94d169.png',
    darkPath: 'assets/aistudio/Arena_Studio_comm_-_Fond_Sombre_782142da.png',
  },
  'maison-artisanat': {
    id: 'maison-artisanat',
    label: 'Maison & Artisanat',
    accentColor: '#5C261D',
    lightPath: 'assets/aistudio/Maison___Artisanat_-_Fond_Claire_-_Logo_0f0bf379',
    darkPath: 'assets/aistudio/Maison___Artisanat_-_Fond_Sombre_-_Logo_7f05a528',
  },
};

export function resolveAssetUrl(relativeAssetPath: string, baseUrl?: string): string {
  const clean = relativeAssetPath.replace(/^\/+/, '');
  const base = baseUrl ?? (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL ? import.meta.env.BASE_URL : '/');
  return `${base.endsWith('/') ? base : `${base}/`}${clean}`;
}

export function getBrandSpec(entityId?: string): BrandLogoSpec {
  if (!entityId || entityId === 'all' || entityId === 'group') {
    return BRAND_LOGOS.group;
  }
  if (entityId in BRAND_LOGOS) {
    return BRAND_LOGOS[entityId as BrandKey];
  }
  return BRAND_LOGOS.group;
}

export function getBrandLogoPath(
  entityId?: string,
  variant: LogoVariant = 'light',
  baseUrl?: string
): string {
  const spec = getBrandSpec(entityId);
  const rawPath =
    variant === 'darkMono' && spec.darkMonoPath
      ? spec.darkMonoPath
      : variant === 'dark' || variant === 'darkMono'
      ? spec.darkPath
      : spec.lightPath;
  return resolveAssetUrl(rawPath, baseUrl);
}

export function resolveCustomEntityLogoUrl(
  entityId?: string,
  customUrl?: string,
  variant: LogoVariant = 'light'
): string | undefined {
  const trimmed = customUrl?.trim();
  if (!trimmed) return undefined;

  if (variant !== 'light' && (!entityId || entityId === 'all' || entityId in BRAND_LOGOS)) {
    return undefined;
  }

  if (/^(?:\.?\/)?assets\/aistudio\//i.test(trimmed)) {
    return undefined;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export type RgbTuple = [number, number, number];

export interface InvoiceThemePalette {
  primaryHex: string;
  secondaryHex: string;
  tableHeaderHex: string;
  softTintHex: string;
  primaryRgb: RgbTuple;
  secondaryRgb: RgbTuple;
  tableHeaderRgb: RgbTuple;
  softTintRgb: RgbTuple;
}

export function hexToRgb(hex: string): RgbTuple {
  const clean = (hex || '').replace('#', '').trim();
  if (clean.length === 3) {
    const r = Number.parseInt(clean[0] + clean[0], 16);
    const g = Number.parseInt(clean[1] + clean[1], 16);
    const b = Number.parseInt(clean[2] + clean[2], 16);
    return [r || 25, g || 40, b || 62];
  }
  if (clean.length === 6) {
    const r = Number.parseInt(clean.slice(0, 2), 16);
    const g = Number.parseInt(clean.slice(2, 4), 16);
    const b = Number.parseInt(clean.slice(4, 6), 16);
    if (![r, g, b].some(Number.isNaN)) {
      return [r, g, b];
    }
  }
  return [25, 40, 62];
}

const ENTITY_INVOICE_THEMES: Record<string, Omit<InvoiceThemePalette, 'primaryRgb' | 'secondaryRgb' | 'tableHeaderRgb' | 'softTintRgb'>> = {
  'arena-business-center': {
    primaryHex: '#19283E',
    secondaryHex: '#C9A125',
    tableHeaderHex: '#19283E',
    softTintHex: '#E1E4EA',
  },
  improveo: {
    primaryHex: '#0B4EA2',
    secondaryHex: '#19283E',
    tableHeaderHex: '#0B4EA2',
    softTintHex: '#DCE8F8',
  },
  'arena-studio-comm': {
    primaryHex: '#0E3370',
    secondaryHex: '#3E8199',
    tableHeaderHex: '#3E8199',
    softTintHex: '#DCE9EE',
  },
  'maison-artisanat': {
    primaryHex: '#5C261D',
    secondaryHex: '#C9A125',
    tableHeaderHex: '#5C261D',
    softTintHex: '#EFE5DF',
  },
};

export function getEntityInvoiceTheme(
  entityId?: string,
  customPrimaryColor?: string
): InvoiceThemePalette {
  const base =
    (entityId && ENTITY_INVOICE_THEMES[entityId]) ||
    ENTITY_INVOICE_THEMES['arena-business-center'];

  const isCustomHex =
    Boolean(customPrimaryColor) && /^#[0-9A-Fa-f]{6}$/.test(customPrimaryColor ?? '');
  const useOverride =
    isCustomHex && (!entityId || !(entityId in ENTITY_INVOICE_THEMES));

  const primaryHex = useOverride ? (customPrimaryColor as string) : base.primaryHex;
  const secondaryHex = base.secondaryHex;
  const tableHeaderHex = useOverride ? primaryHex : base.tableHeaderHex;
  const softTintHex = base.softTintHex;

  return {
    primaryHex,
    secondaryHex,
    tableHeaderHex,
    softTintHex,
    primaryRgb: hexToRgb(primaryHex),
    secondaryRgb: hexToRgb(secondaryHex),
    tableHeaderRgb: hexToRgb(tableHeaderHex),
    softTintRgb: hexToRgb(softTintHex),
  };
}

