import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  Users,
  Tag as TagIcon,
  Database,
  Plus,
  Save,
  Package,
  Scale,
  Plug,
  Mail,
  MessageCircle,
  Palette,
  ArrowUpRight,
  Upload,
  Trash2,
  PenTool,
  Stamp,
  Landmark,
} from 'lucide-react';
import { useCrm } from '../context/CrmContext';
import { useAuth } from '../hooks/useAuth';
import {
  SUPPORTED_CURRENCIES,
  USER_ROLE_LABELS,
  type CrmEntity,
  type LegalSetting,
  type Product,
  type UserProfile,
  type UserRole,
} from '../types';
import { formatCurrency } from '../utils/crmLogic';
import { validateProductInput } from '../utils/billingLogic';
import {
  ARENA_PALETTE_SWATCHES,
  ARENA_SLOGANS,
  getBrandSpec,
  getEntityInvoiceTheme,
} from '../utils/branding';
import { processSignatureOrStampFile } from '../utils/imageUpload';
import { BrandLogo } from '../components/ui/BrandLogo';

type SettingsTab =
  | 'entities'
  | 'catalog'
  | 'legal'
  | 'integrations'
  | 'users'
  | 'pipelines'
  | 'preferences';

export function SettingsPage() {
  const {
    entities,
    users,
    pipelines,
    stages,
    tags,
    products,
    legalSettings,
    integrations,
    settings,
    saveEntity,
    saveUser,
    saveTag,
    saveProduct,
    saveLegalSetting,
    saveIntegration,
    saveSettings,
    seedFirestore,
  } = useCrm();
  const { canManageEntities, canManageUsers, canWriteCrm, authMode } = useAuth();

  const [tab, setTab] = useState<SettingsTab>('entities');
  const [newEntityName, setNewEntityName] = useState('');
  const [newEntityDesc, setNewEntityDesc] = useState('');
  const [newEntityColor, setNewEntityColor] = useState('#19283E');
  const [newTagName, setNewTagName] = useState('');
  const [seeding, setSeeding] = useState(false);

  const [currency, setCurrency] = useState(settings.defaultCurrency);
  const [defaultView, setDefaultView] = useState<'table' | 'cards'>(
    settings.defaultProspectView
  );

  useEffect(() => {
    setCurrency(settings.defaultCurrency);
    setDefaultView(settings.defaultProspectView);
  }, [settings.defaultCurrency, settings.defaultProspectView]);

  // Catalogue produits & services
  const [productSearch, setProductSearch] = useState('');
  const [prodName, setProdName] = useState('');
  const [prodSku, setProdSku] = useState('');
  const [prodFolder, setProdFolder] = useState('Catalogue général');
  const [prodCategory, setProdCategory] = useState('Services');
  const [prodPrice, setProdPrice] = useState('150000');
  const [prodUnitCost, setProdUnitCost] = useState('60000');
  const [prodUnit, setProdUnit] = useState('forfait');
  const [prodError, setProdError] = useState<string | null>(null);
  const [prodEntities, setProdEntities] = useState<string[]>(['arena-business-center']);

  // Mentions légales édition locale
  const [legalDrafts, setLegalDrafts] = useState<Record<string, LegalSetting>>({});
  const [legalUploadErrors, setLegalUploadErrors] = useState<Record<string, string | null>>({});

  const getLegalDraft = (entityId: string): LegalSetting => {
    if (legalDrafts[entityId]) return legalDrafts[entityId];
    const existing = legalSettings.find((l) => l.entityId === entityId);
    if (existing) {
      return {
        ...existing,
        phone: existing.phone ?? '',
        email: existing.email ?? '',
        bankAccountHolder: existing.bankAccountHolder ?? '',
        bankName: existing.bankName ?? '',
        bankAddress: existing.bankAddress ?? '',
        iban: existing.iban ?? '',
        bic: existing.bic ?? '',
        signatureImageUrl: existing.signatureImageUrl ?? '',
        stampImageUrl: existing.stampImageUrl ?? '',
      };
    }
    const ent = entities.find((e) => e.id === entityId);
    return {
      id: `legal-${entityId}`,
      entityId,
      entityCode: entityId.slice(0, 3).toUpperCase(),
      legalName: ent?.name ?? entityId,
      nif: '',
      stat: '',
      rcs: '',
      vatNumber: '',
      address: '',
      phone: '',
      email: '',
      paymentTerms: 'Paiement à 30 jours',
      defaultLegalMentions: '',
      bankAccountHolder: ent?.name ?? '',
      bankName: '',
      bankAddress: '',
      iban: '',
      bic: '',
      signatureImageUrl: '',
      stampImageUrl: '',
      updatedAt: new Date().toISOString(),
    };
  };

  const patchLegalDraft = (entityId: string, patch: Partial<LegalSetting>) => {
    const base = getLegalDraft(entityId);
    setLegalDrafts((prev) => ({ ...prev, [entityId]: { ...base, ...patch } }));
  };

  const handleLegalImageUpload = async (
    entityId: string,
    field: 'signatureImageUrl' | 'stampImageUrl',
    file?: File | null
  ) => {
    if (!file) return;
    setLegalUploadErrors((prev) => ({ ...prev, [entityId]: null }));
    try {
      const dataUrl = await processSignatureOrStampFile(file);
      patchLegalDraft(entityId, { [field]: dataUrl });
    } catch (err) {
      setLegalUploadErrors((prev) => ({
        ...prev,
        [entityId]:
          err instanceof Error
            ? err.message
            : "Impossible de charger l'image sélectionnée.",
      }));
    }
  };

  const handleCreateEntity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEntityName.trim()) return;
    const slug = newEntityName
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const entity: CrmEntity = {
      id: slug || `entity-${Date.now()}`,
      name: newEntityName.trim(),
      slug: slug || `entity-${Date.now()}`,
      description: newEntityDesc.trim(),
      color: newEntityColor,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveEntity(entity, true);
    setNewEntityName('');
    setNewEntityDesc('');
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setProdError(null);
    const autoSku =
      prodSku.trim() ||
      `ARENA-${prodName
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '')
        .slice(0, 6) || 'PRD'}-${String(products.length + 1).padStart(3, '0')}`;
    const numPrice = Math.max(0, Number(prodPrice) || 0);
    const numCost = Math.max(0, Number(prodUnitCost) || 0);
    const err = validateProductInput(
      {
        name: prodName,
        sku: autoSku,
        folder: prodFolder,
        price: numPrice,
        unitCost: numCost,
        pricingType: 'fixed',
        pricingTiers: [],
      },
      products
    );
    if (err) {
      setProdError(err);
      return;
    }

    const now = new Date().toISOString();
    const product: Product = {
      id: `prod-${Date.now()}`,
      name: prodName.trim(),
      sku: autoSku,
      description: '',
      folder: prodFolder.trim() || 'Catalogue général',
      category: prodCategory.trim() || 'Services',
      customProperties: [],
      price: numPrice,
      unitCost: numCost,
      pricingType: 'fixed',
      pricingTiers: [],
      billingFrequency: 'one_time',
      billingDurationUnit: 'unlimited',
      imageUrl: '',
      productUrl: '',
      currency: settings.defaultCurrency || 'MGA',
      unit: prodUnit.trim() || 'unité',
      vatRate: 0,
      active: true,
      entityIds: prodEntities,
      createdAt: now,
      updatedAt: now,
    };
    await saveProduct(product, true);
    setProdName('');
    setProdSku('');
  };

  const handleToggleUserEntity = (targetUser: UserProfile, entityId: string) => {
    const nextIds = targetUser.entityIds.includes(entityId)
      ? targetUser.entityIds.filter((id) => id !== entityId)
      : [...targetUser.entityIds, entityId];
    saveUser({ ...targetUser, entityIds: nextIds });
  };

  const handleRoleChange = (targetUser: UserProfile, role: UserRole) => {
    saveUser({ ...targetUser, role });
  };

  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) return;
    await saveTag(
      {
        id: `tag-${Date.now()}`,
        entityId: 'group',
        name: newTagName.trim(),
        color: '#1d4ed8',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      true
    );
    setNewTagName('');
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await seedFirestore();
    } finally {
      setSeeding(false);
    }
  };

  const outlookSetting =
    integrations.find((i) => i.provider === 'outlook') ?? {
      id: 'int-outlook',
      provider: 'outlook' as const,
      entityId: 'group',
      enabled: false,
      tenantId: '',
      clientId: '',
      accountEmail: '',
      syncEmails: true,
      syncCalendar: true,
      status: 'disconnected' as const,
      updatedAt: new Date().toISOString(),
    };

  const whatsappSetting =
    integrations.find((i) => i.provider === 'whatsapp') ?? {
      id: 'int-whatsapp',
      provider: 'whatsapp' as const,
      entityId: 'group',
      enabled: true,
      businessPhoneNumber: '',
      syncEmails: false,
      syncCalendar: false,
      status: 'ready' as const,
      updatedAt: new Date().toISOString(),
    };

  const [outlookDraft, setOutlookDraft] = useState(outlookSetting);
  const [waDraft, setWaDraft] = useState(whatsappSetting);

  const filteredProducts = products.filter(
    (p) =>
      !productSearch.trim() ||
      `${p.name} ${p.sku ?? ''} ${p.folder ?? ''} ${p.category} ${p.description}`
        .toLowerCase()
        .includes(productSearch.trim().toLowerCase())
  );

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: 'entities', label: 'Entités du groupe' },
    { id: 'catalog', label: 'Catalogue Produits & Services' },
    { id: 'legal', label: 'Mentions légales (NIF/STAT)' },
    { id: 'integrations', label: 'Intégrations (Outlook & WhatsApp)' },
    { id: 'users', label: 'Utilisateurs & Rôles' },
    { id: 'pipelines', label: 'Pipelines & Tags' },
    { id: 'preferences', label: 'Préférences & Données' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#19283E]">Paramètres</h1>
        <p className="text-sm text-slate-600 mt-1">
          Entités, charte graphique, catalogue commercial, mentions légales, connecteurs Outlook / WhatsApp et accès.
        </p>
      </div>

      <div className="border-b border-[#E1E4EA] flex items-center gap-1 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              tab === t.id
                ? 'border-[#C9A125] text-[#19283E] font-semibold'
                : 'border-transparent text-slate-600 hover:text-[#19283E]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'entities' && (
        <div className="space-y-6">
          {/* Identité & Charte Graphique Arena Group 2026 */}
          <div className="rounded-xl border border-[#E1E4EA] bg-white p-6 space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-base font-semibold text-[#19283E] flex items-center gap-2">
                  <Palette className="h-4 w-4 text-[#C9A125]" />
                  Identité Visuelle & Charte Graphique Arena Group
                </h2>
                <p className="text-xs text-slate-600 mt-1">
                  {ARENA_SLOGANS.paletteRule} · Titres : <strong>Poppins</strong> · Contenu : <strong>Gotham / Montserrat</strong>
                </p>
              </div>
              <p className="text-xs font-medium text-[#AD7300] italic">
                « {ARENA_SLOGANS.primary} »
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-[#E1E4EA] bg-[#E1E4EA]/45 p-5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-[#19283E]">Arena Group — Fond clair</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">Supports blancs & gris clair #E1E4EA</p>
                </div>
                <BrandLogo
                  entityId="group"
                  variant="light"
                  alt="Logo Arena Group fond clair"
                  className="w-[168px] h-14"
                />
              </div>

              <div className="rounded-xl border border-[#19283E] bg-[#19283E] p-5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-white">Arena Group — Fond sombre</p>
                  <p className="text-[11px] text-[#E1E4EA]/75 mt-0.5">Bleu Institutionnel #19283E</p>
                </div>
                <BrandLogo
                  entityId="group"
                  variant="dark"
                  alt="Logo Arena Group fond sombre"
                  className="w-[168px] h-14"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {ARENA_PALETTE_SWATCHES.map((swatch) => (
                <div
                  key={swatch.hex}
                  className="rounded-lg border border-[#E1E4EA] overflow-hidden bg-white"
                >
                  <div
                    className="h-12 px-3 py-2 flex items-end justify-between"
                    style={{ backgroundColor: swatch.hex, color: swatch.textColor }}
                  >
                    <span className="font-sans tabular-nums text-[11px] font-semibold">{swatch.hex}</span>
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs font-semibold text-[#19283E] leading-tight">
                      {swatch.name}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{swatch.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {entities.map((entity) => {
              const spec = getBrandSpec(entity.id);
              const hasDarkMono = Boolean(spec.darkMonoPath);
              return (
                <div
                  key={entity.id}
                  className="rounded-xl border border-[#E1E4EA] bg-white p-5 space-y-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span
                          className="h-3 w-3 rounded-sm shrink-0"
                          style={{ backgroundColor: entity.color }}
                          aria-hidden="true"
                        />
                        <h2 className="text-base font-semibold text-[#19283E]">{entity.name}</h2>
                      </div>
                      <p className="mt-1.5 text-sm text-slate-600">{entity.description}</p>
                      <p className="mt-2 text-xs font-sans tabular-nums text-slate-500">
                        Slug : {entity.slug} · {entity.active ? 'Active' : 'Inactive'}
                      </p>
                    </div>
                    {canManageEntities && (
                      <button
                        type="button"
                        onClick={() => saveEntity({ ...entity, active: !entity.active }, false)}
                        className="h-8 rounded-lg border border-[#E1E4EA] px-2.5 text-xs font-medium text-[#19283E] hover:bg-[#E1E4EA]/40 whitespace-nowrap"
                      >
                        {entity.active ? 'Désactiver' : 'Activer'}
                      </button>
                    )}
                  </div>

                  {/* Déclinaisons officielles du logo */}
                  <div className={`grid gap-2.5 ${hasDarkMono ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
                    <div className="rounded-lg border border-[#E1E4EA] bg-[#F4F5F8] p-3 flex flex-col items-center justify-center gap-1.5">
                      <BrandLogo
                        entityId={entity.id}
                        variant="light"
                        alt={`Logo ${entity.name} fond clair`}
                        customUrl={entity.logoUrl && entity.id !== spec.id ? entity.logoUrl : undefined}
                        className="h-10 w-full"
                      />
                      <span className="text-[11px] text-slate-500">Fond clair</span>
                    </div>
                    <div className="rounded-lg border border-[#19283E] bg-[#19283E] p-3 flex flex-col items-center justify-center gap-1.5">
                      <BrandLogo
                        entityId={entity.id}
                        variant="dark"
                        alt={`Logo ${entity.name} fond sombre`}
                        className="h-10 w-full"
                      />
                      <span className="text-[11px] text-[#E1E4EA]/80">
                        {hasDarkMono ? 'Fond sombre 1' : 'Fond sombre'}
                      </span>
                    </div>
                    {hasDarkMono && (
                      <div className="rounded-lg border border-[#19283E] bg-[#19283E] p-3 flex flex-col items-center justify-center gap-1.5">
                        <BrandLogo
                          entityId={entity.id}
                          variant="darkMono"
                          alt={`Logo ${entity.name} monochrome fond sombre`}
                          className="h-10 w-full"
                        />
                        <span className="text-[11px] text-[#E1E4EA]/80">Fond sombre 2</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {canManageEntities && (
            <form
              onSubmit={handleCreateEntity}
              className="rounded-xl border border-[#E1E4EA] bg-white p-5 space-y-4"
            >
              <h3 className="text-sm font-semibold text-[#19283E] flex items-center gap-2">
                <Building2 className="h-4 w-4 text-[#AD7300]" />
                Ajouter une nouvelle entité
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <input
                  type="text"
                  value={newEntityName}
                  onChange={(e) => setNewEntityName(e.target.value)}
                  placeholder="Nom de l'entité"
                  className="h-9 rounded-lg border border-[#E1E4EA] px-3 text-sm"
                />
                <input
                  type="text"
                  value={newEntityDesc}
                  onChange={(e) => setNewEntityDesc(e.target.value)}
                  placeholder="Description courte"
                  className="h-9 rounded-lg border border-[#E1E4EA] px-3 text-sm"
                />
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    aria-label="Couleur de l'entité"
                    value={newEntityColor}
                    onChange={(e) => setNewEntityColor(e.target.value)}
                    className="h-9 w-12 rounded border border-[#E1E4EA] p-1"
                  />
                  <button
                    type="submit"
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#19283E] px-4 text-sm font-medium text-white hover:bg-[#223552]"
                  >
                    <Plus className="h-4 w-4 text-[#C9A125]" />
                    Ajouter
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      )}

      {tab === 'catalog' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <Package className="h-4 w-4 text-slate-500" />
                  Catalogue Produits & Services ({filteredProducts.length})
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  TVA non applicable · Devise par défaut : {settings.defaultCurrency || 'MGA'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="search"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Rechercher nom, UGS (SKU) ou dossier..."
                  className="h-9 rounded-lg border border-slate-200 px-3 text-sm sm:w-64"
                />
                <Link
                  to="/products"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#19283E]/20 bg-[#19283E]/5 px-3 text-xs font-semibold text-[#19283E] hover:bg-[#19283E]/10 whitespace-nowrap"
                >
                  Ouvrir le module Produits
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-2.5 px-3">UGS (SKU)</th>
                    <th className="py-2.5 px-3">Prestation</th>
                    <th className="py-2.5 px-3">Dossier / Catégorie</th>
                    <th className="py-2.5 px-3 text-right">Prix unitaire</th>
                    <th className="py-2.5 px-3">Tarification</th>
                    <th className="py-2.5 px-3">Entités</th>
                    <th className="py-2.5 px-3 text-right">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-3 font-sans tabular-nums text-xs text-slate-600 whitespace-nowrap">
                        {p.sku || '—'}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-900">
                        <Link
                          to={`/products/${p.id}`}
                          className="hover:text-[#AD7300] hover:underline"
                        >
                          {p.name}
                        </Link>
                      </td>
                      <td className="py-2.5 px-3 text-xs text-slate-600">
                        {p.folder || 'Catalogue général'} · {p.category}
                      </td>
                      <td className="py-2.5 px-3 text-right font-sans tabular-nums whitespace-nowrap">
                        {formatCurrency(p.price, p.currency)} / {p.unit}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-slate-600 whitespace-nowrap">
                        {p.pricingType === 'tiered'
                          ? `Échelonnée (${p.pricingTiers?.length || 0} paliers)`
                          : 'Fixe'}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-slate-600">
                        {p.entityIds.length === 0
                          ? 'Toutes'
                          : p.entityIds
                              .map((id) => entities.find((e) => e.id === id)?.name ?? id)
                              .join(', ')}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {canWriteCrm ? (
                          <button
                            type="button"
                            onClick={() => saveProduct({ ...p, active: !p.active }, false)}
                            className={`rounded border px-2 py-0.5 text-xs font-medium ${
                              p.active
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                : 'border-slate-200 bg-slate-50 text-slate-500'
                            }`}
                          >
                            {p.active ? 'Actif' : 'Inactif'}
                          </button>
                        ) : (
                          <span className="text-xs">{p.active ? 'Actif' : 'Inactif'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {canWriteCrm && (
            <form
              onSubmit={handleCreateProduct}
              className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900">
                  Ajout rapide au catalogue
                </h3>
                <Link
                  to="/products"
                  className="text-xs font-medium text-[#AD7300] hover:underline"
                >
                  Fiche complète (paliers, récurrence, visuels, propriétés) →
                </Link>
              </div>
              {prodError && (
                <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                  {prodError}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
                <input
                  type="text"
                  required
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  placeholder="Nom prestation *"
                  className="sm:col-span-2 h-9 rounded-lg border border-slate-200 px-3 text-sm"
                />
                <input
                  type="text"
                  value={prodSku}
                  onChange={(e) => setProdSku(e.target.value.toUpperCase())}
                  placeholder="UGS (SKU) auto si vide"
                  className="h-9 rounded-lg border border-slate-200 px-3 text-sm font-sans tabular-nums"
                />
                <input
                  type="text"
                  value={prodFolder}
                  onChange={(e) => setProdFolder(e.target.value)}
                  placeholder="Dossier"
                  className="h-9 rounded-lg border border-slate-200 px-3 text-sm"
                />
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={prodPrice}
                  onChange={(e) => setProdPrice(e.target.value)}
                  placeholder="Prix unitaire"
                  className="h-9 rounded-lg border border-slate-200 px-3 text-sm font-sans tabular-nums"
                />
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={prodUnitCost}
                  onChange={(e) => setProdUnitCost(e.target.value)}
                  placeholder="Coût unitaire"
                  className="h-9 rounded-lg border border-slate-200 px-3 text-sm font-sans tabular-nums"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  value={prodCategory}
                  onChange={(e) => setProdCategory(e.target.value)}
                  placeholder="Catégorie"
                  className="h-9 rounded-lg border border-slate-200 px-3 text-sm"
                />
                <input
                  type="text"
                  value={prodUnit}
                  onChange={(e) => setProdUnit(e.target.value)}
                  placeholder="Unité (forfait, mois, heure...)"
                  className="h-9 rounded-lg border border-slate-200 px-3 text-sm"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className="font-medium text-slate-700">Entités :</span>
                  {entities.map((ent) => {
                    const checked = prodEntities.includes(ent.id);
                    return (
                      <label key={ent.id} className="inline-flex items-center gap-1.5 text-slate-700">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setProdEntities((prev) =>
                              checked ? prev.filter((id) => id !== ent.id) : [...prev, ent.id]
                            )
                          }
                        />
                        {ent.name}
                      </label>
                    );
                  })}
                </div>
                <button
                  type="submit"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#19283E] px-4 text-sm font-medium text-white hover:bg-[#223552]"
                >
                  <Plus className="h-4 w-4" />
                  Ajouter au catalogue
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {tab === 'legal' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {entities.map((entity) => {
            const draft = getLegalDraft(entity.id);
            const theme = getEntityInvoiceTheme(entity.id, entity.color);
            const uploadErr = legalUploadErrors[entity.id];
            return (
              <div
                key={entity.id}
                data-testid={`legal-card-${entity.id}`}
                className="rounded-xl border border-slate-200 bg-white overflow-hidden"
              >
                <div
                  className="h-1.5 w-full"
                  style={{
                    background: `linear-gradient(90deg, ${theme.primaryHex} 0%, ${theme.secondaryHex} 100%)`,
                  }}
                />
                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <BrandLogo
                        entityId={entity.id}
                        variant="light"
                        alt={`Logo ${entity.name}`}
                        className="h-8 w-24 shrink-0"
                      />
                      <div className="min-w-0">
                        <h2 className="text-base font-semibold text-slate-900 truncate flex items-center gap-1.5">
                          <Scale className="h-4 w-4 text-slate-500 shrink-0" />
                          {entity.name}
                        </h2>
                      </div>
                    </div>
                    <span className="font-sans tabular-nums text-xs rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-700 shrink-0">
                      Code : {draft.entityCode}
                    </span>
                  </div>

                  {uploadErr && (
                    <div
                      role="alert"
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
                    >
                      {uploadErr}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Raison sociale facturation
                      </label>
                      <input
                        type="text"
                        value={draft.legalName}
                        onChange={(e) => patchLegalDraft(entity.id, { legalName: e.target.value })}
                        className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Code préfixe (DEV/FAC)
                      </label>
                      <input
                        type="text"
                        value={draft.entityCode}
                        onChange={(e) =>
                          patchLegalDraft(entity.id, { entityCode: e.target.value.toUpperCase() })
                        }
                        className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm font-sans tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">NIF</label>
                      <input
                        type="text"
                        value={draft.nif}
                        onChange={(e) => patchLegalDraft(entity.id, { nif: e.target.value })}
                        className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm font-sans tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">STAT</label>
                      <input
                        type="text"
                        value={draft.stat}
                        onChange={(e) => patchLegalDraft(entity.id, { stat: e.target.value })}
                        className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm font-sans tabular-nums"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`legal-rcs-${entity.id}`}
                        className="block text-xs font-medium text-slate-700 mb-1"
                      >
                        RCS (Registre du commerce)
                      </label>
                      <input
                        id={`legal-rcs-${entity.id}`}
                        type="text"
                        maxLength={60}
                        placeholder="ex. RCS Antananarivo 2020 B 00123"
                        value={draft.rcs ?? ''}
                        onChange={(e) => patchLegalDraft(entity.id, { rcs: e.target.value })}
                        className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm font-sans tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Conditions de règlement
                      </label>
                      <input
                        type="text"
                        value={draft.paymentTerms}
                        onChange={(e) => patchLegalDraft(entity.id, { paymentTerms: e.target.value })}
                        className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`legal-phone-${entity.id}`}
                        className="block text-xs font-medium text-slate-700 mb-1"
                      >
                        Téléphone (pied de facture)
                      </label>
                      <input
                        id={`legal-phone-${entity.id}`}
                        type="text"
                        placeholder="+261 34 00 000 00"
                        value={draft.phone ?? ''}
                        onChange={(e) => patchLegalDraft(entity.id, { phone: e.target.value })}
                        className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`legal-email-${entity.id}`}
                        className="block text-xs font-medium text-slate-700 mb-1"
                      >
                        Email (pied de facture)
                      </label>
                      <input
                        id={`legal-email-${entity.id}`}
                        type="email"
                        placeholder="facturation@arenagroup.mg"
                        value={draft.email ?? ''}
                        onChange={(e) => patchLegalDraft(entity.id, { email: e.target.value })}
                        className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label
                        htmlFor={`legal-address-${entity.id}`}
                        className="block text-xs font-medium text-slate-700 mb-1"
                      >
                        Adresse du siège social (bloc Émetteur « DE: »)
                      </label>
                      <input
                        id={`legal-address-${entity.id}`}
                        type="text"
                        placeholder="Lot ..., Antananarivo 101"
                        value={draft.address}
                        onChange={(e) => patchLegalDraft(entity.id, { address: e.target.value })}
                        className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
                      />
                    </div>
                  </div>

                  {/* Coordonnées bancaires */}
                  <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5">
                    <p className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                      <Landmark className="h-3.5 w-3.5 text-slate-500" />
                      Coordonnées bancaires (affichées en bas de facture)
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label
                          htmlFor={`legal-bank-holder-${entity.id}`}
                          className="block text-[11px] font-medium text-slate-600 mb-1"
                        >
                          Titulaire du compte
                        </label>
                        <input
                          id={`legal-bank-holder-${entity.id}`}
                          type="text"
                          value={draft.bankAccountHolder ?? ''}
                          onChange={(e) =>
                            patchLegalDraft(entity.id, { bankAccountHolder: e.target.value })
                          }
                          className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor={`legal-bank-name-${entity.id}`}
                          className="block text-[11px] font-medium text-slate-600 mb-1"
                        >
                          Banque
                        </label>
                        <input
                          id={`legal-bank-name-${entity.id}`}
                          type="text"
                          placeholder="ex. BNI MADAGASCAR"
                          value={draft.bankName ?? ''}
                          onChange={(e) =>
                            patchLegalDraft(entity.id, { bankName: e.target.value })
                          }
                          className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label
                          htmlFor={`legal-bank-addr-${entity.id}`}
                          className="block text-[11px] font-medium text-slate-600 mb-1"
                        >
                          Adresse agence / banque
                        </label>
                        <input
                          id={`legal-bank-addr-${entity.id}`}
                          type="text"
                          value={draft.bankAddress ?? ''}
                          onChange={(e) =>
                            patchLegalDraft(entity.id, { bankAddress: e.target.value })
                          }
                          className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor={`legal-iban-${entity.id}`}
                          className="block text-[11px] font-medium text-slate-600 mb-1"
                        >
                          IBAN / RIB
                        </label>
                        <input
                          id={`legal-iban-${entity.id}`}
                          type="text"
                          value={draft.iban ?? ''}
                          onChange={(e) => patchLegalDraft(entity.id, { iban: e.target.value })}
                          className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-sans tabular-nums"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor={`legal-bic-${entity.id}`}
                          className="block text-[11px] font-medium text-slate-600 mb-1"
                        >
                          BIC / SWIFT
                        </label>
                        <input
                          id={`legal-bic-${entity.id}`}
                          type="text"
                          value={draft.bic ?? ''}
                          onChange={(e) => patchLegalDraft(entity.id, { bic: e.target.value })}
                          className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-sans tabular-nums"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Signature & Tampon */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                          <PenTool className="h-3.5 w-3.5 text-slate-500" />
                          Signature officielle
                        </span>
                        {canManageEntities && draft.signatureImageUrl && (
                          <button
                            type="button"
                            onClick={() => patchLegalDraft(entity.id, { signatureImageUrl: '' })}
                            className="inline-flex items-center gap-1 text-[11px] text-red-600 hover:underline"
                          >
                            <Trash2 className="h-3 w-3" />
                            Supprimer
                          </button>
                        )}
                      </div>
                      <div className="h-20 rounded-md border border-dashed border-slate-300 bg-white flex items-center justify-center p-2 overflow-hidden">
                        {draft.signatureImageUrl ? (
                          <img
                            src={draft.signatureImageUrl}
                            alt={`Signature ${entity.name}`}
                            className="max-h-full max-w-full object-contain"
                          />
                        ) : (
                          <span className="text-[11px] text-slate-400">Aucune signature</span>
                        )}
                      </div>
                      {canManageEntities && (
                        <label
                          htmlFor={`upload-sig-${entity.id}`}
                          className="inline-flex h-8 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          Importer signature (PNG/JPG)
                          <input
                            id={`upload-sig-${entity.id}`}
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/svg+xml"
                            className="sr-only"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              handleLegalImageUpload(entity.id, 'signatureImageUrl', file);
                              e.currentTarget.value = '';
                            }}
                          />
                        </label>
                      )}
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                          <Stamp className="h-3.5 w-3.5 text-slate-500" />
                          Tampon / Cachet
                        </span>
                        {canManageEntities && draft.stampImageUrl && (
                          <button
                            type="button"
                            onClick={() => patchLegalDraft(entity.id, { stampImageUrl: '' })}
                            className="inline-flex items-center gap-1 text-[11px] text-red-600 hover:underline"
                          >
                            <Trash2 className="h-3 w-3" />
                            Supprimer
                          </button>
                        )}
                      </div>
                      <div className="h-20 rounded-md border border-dashed border-slate-300 bg-white flex items-center justify-center p-2 overflow-hidden">
                        {draft.stampImageUrl ? (
                          <img
                            src={draft.stampImageUrl}
                            alt={`Tampon ${entity.name}`}
                            className="max-h-full max-w-full object-contain"
                          />
                        ) : (
                          <span className="text-[11px] text-slate-400">Aucun tampon</span>
                        )}
                      </div>
                      {canManageEntities && (
                        <label
                          htmlFor={`upload-stamp-${entity.id}`}
                          className="inline-flex h-8 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          Importer tampon (PNG/JPG)
                          <input
                            id={`upload-stamp-${entity.id}`}
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/svg+xml"
                            className="sr-only"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              handleLegalImageUpload(entity.id, 'stampImageUrl', file);
                              e.currentTarget.value = '';
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Mentions légales par défaut (PDF Devis & Factures)
                    </label>
                    <textarea
                      rows={2}
                      value={draft.defaultLegalMentions}
                      onChange={(e) =>
                        patchLegalDraft(entity.id, { defaultLegalMentions: e.target.value })
                      }
                      className="w-full rounded-lg border border-slate-200 p-2.5 text-sm"
                    />
                  </div>

                  {canManageEntities && (
                    <button
                      type="button"
                      onClick={() =>
                        saveLegalSetting(
                          draft,
                          !legalSettings.some((l) => l.entityId === entity.id)
                        )
                      }
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#19283E] px-4 text-sm font-medium text-white hover:bg-[#223552]"
                    >
                      <Save className="h-4 w-4 text-[#C9A125]" />
                      Enregistrer les mentions
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'integrations' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Outlook / Microsoft 365 */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Mail className="h-5 w-5 text-blue-600" />
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Outlook / Microsoft 365
                  </h2>
                  <p className="text-xs text-slate-500">
                    Synchronisation emails & export calendrier (.ics / Microsoft Graph).
                  </p>
                </div>
              </div>
              <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                {outlookDraft.enabled ? 'Activée' : 'Prête à configurer'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Tenant ID Microsoft (public)
                </label>
                <input
                  type="text"
                  value={outlookDraft.tenantId ?? ''}
                  onChange={(e) =>
                    setOutlookDraft((p) => ({ ...p, tenantId: e.target.value }))
                  }
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx"
                  className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm font-sans tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Client ID Application
                </label>
                <input
                  type="text"
                  value={outlookDraft.clientId ?? ''}
                  onChange={(e) =>
                    setOutlookDraft((p) => ({ ...p, clientId: e.target.value }))
                  }
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx"
                  className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm font-sans tabular-nums"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Adresse email professionnelle associée
              </label>
              <input
                type="email"
                value={outlookDraft.accountEmail ?? ''}
                onChange={(e) =>
                  setOutlookDraft((p) => ({ ...p, accountEmail: e.target.value }))
                }
                placeholder="contact@arenagroup.fr"
                className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
              />
            </div>

            <div className="flex flex-wrap gap-4 text-xs text-slate-700">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={outlookDraft.syncEmails}
                  onChange={(e) =>
                    setOutlookDraft((p) => ({ ...p, syncEmails: e.target.checked }))
                  }
                />
                Journaliser les emails commerciaux
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={outlookDraft.syncCalendar}
                  onChange={(e) =>
                    setOutlookDraft((p) => ({ ...p, syncCalendar: e.target.checked }))
                  }
                />
                Synchronisation Agenda Outlook
              </label>
            </div>

            {canWriteCrm && (
              <button
                type="button"
                onClick={() =>
                  saveIntegration(
                    {
                      ...outlookDraft,
                      enabled: Boolean(outlookDraft.accountEmail || outlookDraft.clientId),
                      status: outlookDraft.clientId ? 'ready' : 'disconnected',
                    },
                    !integrations.some((i) => i.id === outlookDraft.id)
                  )
                }
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#19283E] px-4 text-sm font-medium text-white hover:bg-[#223552]"
              >
                <Plug className="h-4 w-4" />
                Enregistrer la configuration Outlook
              </button>
            )}
          </div>

          {/* WhatsApp Business */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <MessageCircle className="h-5 w-5 text-emerald-600" />
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    WhatsApp Business
                  </h2>
                  <p className="text-xs text-slate-500">
                    Envoi rapide via lien direct WhatsApp et journalisation automatique CRM.
                  </p>
                </div>
              </div>
              <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                {waDraft.enabled ? 'Opérationnel' : 'Désactivé'}
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Numéro WhatsApp Business émetteur
              </label>
              <input
                type="tel"
                value={waDraft.businessPhoneNumber ?? ''}
                onChange={(e) =>
                  setWaDraft((p) => ({ ...p, businessPhoneNumber: e.target.value }))
                }
                placeholder="+33 6 00 00 00 00"
                className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm font-sans tabular-nums"
              />
            </div>

            <label className="inline-flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={waDraft.enabled}
                onChange={(e) =>
                  setWaDraft((p) => ({ ...p, enabled: e.target.checked }))
                }
              />
              Activer les boutons d'action rapide WhatsApp sur les fiches Contacts & Prospects
            </label>

            {canWriteCrm && (
              <div>
                <button
                  type="button"
                  onClick={() =>
                    saveIntegration(
                      {
                        ...waDraft,
                        status: waDraft.enabled ? 'ready' : 'disconnected',
                      },
                      !integrations.some((i) => i.id === waDraft.id)
                    )
                  }
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  <Save className="h-4 w-4" />
                  Enregistrer la configuration WhatsApp
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
            <Users className="h-4 w-4 text-slate-500" />
            <h2 className="text-base font-semibold text-slate-900">
              Utilisateurs & permissions par entité
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Utilisateur</th>
                  <th className="py-3 px-4">Rôle</th>
                  <th className="py-3 px-4">Entités autorisées</th>
                  <th className="py-3 px-4">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {users.map((u) => (
                  <tr key={u.uid}>
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-900">{u.displayName}</p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                    </td>
                    <td className="py-3 px-4">
                      {canManageUsers ? (
                        <select
                          aria-label={`Rôle de ${u.displayName}`}
                          value={u.role}
                          onChange={(e) => handleRoleChange(u, e.target.value as UserRole)}
                          className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs"
                        >
                          {(Object.keys(USER_ROLE_LABELS) as UserRole[]).map((role) => (
                            <option key={role} value={role}>
                              {USER_ROLE_LABELS[role]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-slate-700">
                          {USER_ROLE_LABELS[u.role]}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1.5">
                        {entities.map((e) => {
                          const assigned =
                            u.role === 'super_admin' || u.entityIds.includes(e.id);
                          return (
                            <button
                              key={e.id}
                              type="button"
                              disabled={!canManageUsers || u.role === 'super_admin'}
                              onClick={() => handleToggleUserEntity(u, e.id)}
                              className={`rounded-md border px-2 py-0.5 text-xs ${
                                assigned
                                  ? 'border-blue-200 bg-blue-50 text-blue-800'
                                  : 'border-slate-200 bg-slate-50 text-slate-400'
                              }`}
                            >
                              {e.name}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {canManageUsers ? (
                        <button
                          type="button"
                          onClick={() => saveUser({ ...u, active: !u.active })}
                          className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                            u.active
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                              : 'border-red-200 bg-red-50 text-red-800'
                          }`}
                        >
                          {u.active ? 'Actif' : 'Suspendu'}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-600">
                          {u.active ? 'Actif' : 'Suspendu'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'pipelines' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <h2 className="text-base font-semibold text-slate-900">
              Pipelines & étapes configurées
            </h2>
            <div className="space-y-4">
              {pipelines.map((pipe) => {
                const pipeStages = stages
                  .filter((s) => s.pipelineId === pipe.id)
                  .sort((a, b) => a.order - b.order);
                return (
                  <div
                    key={pipe.id}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                  >
                    <p className="text-sm font-semibold text-slate-900">{pipe.name}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {pipeStages.map((s) => `${s.name} (${s.probability}%)`).join(' → ')}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <TagIcon className="h-4 w-4 text-slate-500" />
              Tags de qualification
            </h2>
            <div className="flex flex-wrap gap-2">
              {tags.map((t) => (
                <span
                  key={t.id}
                  className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-800"
                >
                  {t.name}
                </span>
              ))}
            </div>
            {canWriteCrm && (
              <form onSubmit={handleAddTag} className="flex items-center gap-2 pt-2">
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="Nouveau tag (ex : Immobilier)"
                  className="flex-1 h-9 rounded-lg border border-slate-200 px-3 text-sm"
                />
                <button
                  type="submit"
                  className="h-9 rounded-lg bg-slate-900 px-3.5 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Ajouter
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {tab === 'preferences' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
            <h2 className="text-base font-semibold text-slate-900">
              Préférences d'affichage
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="pref-currency" className="block text-xs font-medium text-slate-700 mb-1">
                  Devise par défaut
                </label>
                <select
                  id="pref-currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
                >
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="pref-view" className="block text-xs font-medium text-slate-700 mb-1">
                  Vue prospects par défaut
                </label>
                <select
                  id="pref-view"
                  value={defaultView}
                  onChange={(e) => setDefaultView(e.target.value as 'table' | 'cards')}
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="table">Tableau</option>
                  <option value="cards">Cartes</option>
                </select>
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                saveSettings({
                  ...settings,
                  defaultCurrency: currency,
                  defaultProspectView: defaultView,
                })
              }
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#19283E] px-4 text-sm font-medium text-white hover:bg-[#223552]"
            >
              <Save className="h-4 w-4 text-[#C9A125]" />
              Enregistrer les préférences
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Database className="h-4 w-4 text-slate-500" />
              Initialisation des données de démonstration
            </h2>
            <p className="text-sm text-slate-600">
              {authMode === 'firebase'
                ? 'Crée les 4 entités Arena Group, les contacts/entreprises partagés, devis, factures, paiements et séquences de test dans Firestore.'
                : 'Réinitialise le jeu de données local de démonstration avec les 4 entités Arena Group.'}
            </p>
            <button
              type="button"
              onClick={handleSeed}
              disabled={seeding}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              <Database className="h-4 w-4" />
              {seeding
                ? 'Initialisation en cours...'
                : authMode === 'firebase'
                ? 'Initialiser Firestore avec les données démo'
                : 'Réinitialiser la démo locale'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
