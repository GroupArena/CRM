import React, { useEffect, useMemo, useState } from 'react';
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
  Edit2,
  ShieldAlert,
  UserPlus,
  Check,
  X,
} from 'lucide-react';
import { useCrm } from '../context/CrmContext';
import { useAuth } from '../hooks/useAuth';
import {
  SUPPORTED_CURRENCIES,
  USER_ROLE_LABELS,
  type CrmEntity,
  type CrmTag,
  type LegalSetting,
  type Product,
  type UserProfile,
  type UserRole,
} from '../types';
import { formatCurrency } from '../utils/crmLogic';
import {
  buildCatalogOptions,
  DEFAULT_PRODUCT_CATEGORIES,
  DEFAULT_PRODUCT_FOLDERS,
  validateProductInput,
} from '../utils/billingLogic';
import {
  ARENA_PALETTE_SWATCHES,
  ARENA_SLOGANS,
  getBrandSpec,
  getEntityInvoiceTheme,
  resolveCustomEntityLogoUrl,
} from '../utils/branding';
import { processSignatureOrStampFile } from '../utils/imageUpload';
import { BrandLogo } from '../components/ui/BrandLogo';
import { CatalogSelectWithAdd } from '../components/crm/CatalogSelectWithAdd';
import { Modal } from '../components/ui/Modal';

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
    patchUser,
    createManagedUser,
    deleteUser,
    saveTag,
    deleteTag,
    saveProduct,
    saveLegalSetting,
    saveIntegration,
    saveSettings,
    seedFirestore,
    addToast,
  } = useCrm();
  const { canManageSettings, user, authMode } = useAuth();
  const canEditSettings = canManageSettings;

  const [tab, setTab] = useState<SettingsTab>('entities');
  const [newEntityName, setNewEntityName] = useState('');
  const [newEntityDesc, setNewEntityDesc] = useState('');
  const [newEntityColor, setNewEntityColor] = useState('#19283E');

  // Édition d'une entité existante (Super Admin)
  const [editingEntity, setEditingEntity] = useState<CrmEntity | null>(null);
  const [editEntityName, setEditEntityName] = useState('');
  const [editEntityDesc, setEditEntityDesc] = useState('');
  const [editEntityColor, setEditEntityColor] = useState('#19283E');
  const [editEntityLogoUrl, setEditEntityLogoUrl] = useState('');
  const [editEntityActive, setEditEntityActive] = useState(true);
  const [editEntityError, setEditEntityError] = useState<string | null>(null);
  const [savingEntity, setSavingEntity] = useState(false);

  // Utilisateurs : ajout & suppression (Super Admin)
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('sales');
  const [newUserEntities, setNewUserEntities] = useState<string[]>(['arena-business-center']);
  const [newUserError, setNewUserError] = useState<string | null>(null);
  const [creatingUser, setCreatingUser] = useState(false);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<UserProfile | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);

  // Tags de qualification : ajout, édition, suppression (Super Admin)
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#1d4ed8');
  const [editingTag, setEditingTag] = useState<CrmTag | null>(null);
  const [editTagName, setEditTagName] = useState('');
  const [editTagColor, setEditTagColor] = useState('#1d4ed8');
  const [confirmDeleteTag, setConfirmDeleteTag] = useState<CrmTag | null>(null);
  const [deletingTag, setDeletingTag] = useState(false);

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
  const [customFolders, setCustomFolders] = useState<string[]>([]);
  const [customCategories, setCustomCategories] = useState<string[]>([]);

  const catalogFolderOptions = useMemo(
    () =>
      buildCatalogOptions(
        products.map((p) => p.folder),
        DEFAULT_PRODUCT_FOLDERS,
        ...customFolders,
        prodFolder
      ),
    [products, customFolders, prodFolder]
  );

  const catalogCategoryOptions = useMemo(
    () =>
      buildCatalogOptions(
        products.map((p) => p.category),
        DEFAULT_PRODUCT_CATEGORIES,
        ...customCategories,
        prodCategory
      ),
    [products, customCategories, prodCategory]
  );

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

  const reportSettingsError = (title: string, err: unknown) => {
    addToast({
      type: 'error',
      title,
      description: err instanceof Error ? err.message : 'Erreur lors de la sauvegarde.',
    });
  };

  const handleCreateEntity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditSettings || !newEntityName.trim()) return;
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
    try {
      await saveEntity(entity, true);
      setNewEntityName('');
      setNewEntityDesc('');
    } catch (err) {
      reportSettingsError("Impossible de créer l'entité", err);
    }
  };

  const openEditEntityModal = (entity: CrmEntity) => {
    setEditingEntity(entity);
    setEditEntityName(entity.name);
    setEditEntityDesc(entity.description ?? '');
    setEditEntityColor(entity.color || '#19283E');
    setEditEntityLogoUrl(resolveCustomEntityLogoUrl(entity.id, entity.logoUrl, 'light') ?? '');
    setEditEntityActive(entity.active);
    setEditEntityError(null);
  };

  const handleSaveEditedEntity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditSettings || !editingEntity) return;
    if (!editEntityName.trim()) {
      setEditEntityError("Le nom de l'entité est obligatoire.");
      return;
    }
    setSavingEntity(true);
    setEditEntityError(null);
    try {
      await saveEntity(
        {
          ...editingEntity,
          name: editEntityName.trim(),
          description: editEntityDesc.trim(),
          color: editEntityColor || '#19283E',
          logoUrl: editEntityLogoUrl.trim(),
          active: editEntityActive,
          updatedAt: new Date().toISOString(),
        },
        false
      );
      setEditingEntity(null);
    } catch (err) {
      setEditEntityError(err instanceof Error ? err.message : "Erreur lors de la mise à jour.");
    } finally {
      setSavingEntity(false);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditSettings) return;
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
    try {
      await saveProduct(product, true);
      setProdName('');
      setProdSku('');
    } catch (err) {
      setProdError(err instanceof Error ? err.message : 'Erreur lors de la création du produit.');
      reportSettingsError("Impossible d'ajouter le produit", err);
    }
  };

  const handleToggleUserEntity = async (targetUser: UserProfile, entityId: string) => {
    if (!canEditSettings) return;
    try {
      await patchUser(targetUser.uid, (latest) => {
        const nextIds = latest.entityIds.includes(entityId)
          ? latest.entityIds.filter((id) => id !== entityId)
          : [...latest.entityIds, entityId];
        return { ...latest, entityIds: nextIds };
      });
    } catch (err) {
      reportSettingsError("Impossible de modifier l'accès entité", err);
    }
  };

  const handleRoleChange = async (targetUser: UserProfile, role: UserRole) => {
    if (!canEditSettings) return;
    try {
      await patchUser(targetUser.uid, (latest) => {
        const nextEntityIds =
          role === 'super_admin'
            ? entities.map((e) => e.id)
            : latest.entityIds;
        return { ...latest, role, entityIds: nextEntityIds };
      });
    } catch (err) {
      reportSettingsError('Impossible de modifier le rôle', err);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditSettings) return;
    setNewUserError(null);
    if (!newUserName.trim()) {
      setNewUserError('Le nom complet est obligatoire.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newUserEmail.trim())) {
      setNewUserError('Adresse email invalide.');
      return;
    }
    if (authMode === 'firebase' && newUserPassword.length < 6) {
      setNewUserError('Le mot de passe provisoire doit contenir au moins 6 caractères.');
      return;
    }
    setCreatingUser(true);
    try {
      await createManagedUser({
        displayName: newUserName.trim(),
        email: newUserEmail.trim(),
        password: newUserPassword || 'ArenaDemo2026!',
        role: newUserRole,
        entityIds:
          newUserRole === 'super_admin'
            ? entities.map((ent) => ent.id)
            : newUserEntities,
      });
      setAddUserOpen(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserRole('sales');
      setNewUserEntities(entities[0]?.id ? [entities[0].id] : []);
    } catch (err) {
      setNewUserError(err instanceof Error ? err.message : "Impossible de créer l'utilisateur.");
    } finally {
      setCreatingUser(false);
    }
  };

  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditSettings || !newTagName.trim()) return;
    try {
      await saveTag(
        {
          id: `tag-${Date.now()}`,
          entityId: 'group',
          name: newTagName.trim(),
          color: newTagColor || '#1d4ed8',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        true
      );
      setNewTagName('');
    } catch (err) {
      reportSettingsError("Impossible d'ajouter le tag", err);
    }
  };

  const handleSaveEditedTag = async (tag: CrmTag) => {
    if (!canEditSettings || !editTagName.trim()) return;
    try {
      await saveTag(
        {
          ...tag,
          name: editTagName.trim(),
          color: editTagColor || tag.color || '#1d4ed8',
          updatedAt: new Date().toISOString(),
        },
        false
      );
      setEditingTag(null);
    } catch (err) {
      reportSettingsError('Impossible de mettre à jour le tag', err);
    }
  };

  const handleSeed = async () => {
    if (!canEditSettings) return;
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

  useEffect(() => {
    const o = integrations.find((i) => i.provider === 'outlook');
    if (o) setOutlookDraft(o);
    const w = integrations.find((i) => i.provider === 'whatsapp');
    if (w) setWaDraft(w);
  }, [integrations]);

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

      {!canEditSettings && (
        <div
          role="status"
          data-testid="settings-readonly-banner"
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-center gap-2.5"
        >
          <ShieldAlert className="h-4 w-4 text-amber-700 shrink-0" />
          <span>
            <strong>Mode lecture seule :</strong> seuls les Super Admins peuvent modifier les paramètres du CRM.
          </span>
        </div>
      )}

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
                    {canEditSettings && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditEntityModal(entity)}
                          aria-label={`Modifier ${entity.name}`}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#E1E4EA] px-2.5 text-xs font-medium text-[#19283E] hover:bg-[#E1E4EA]/40 whitespace-nowrap"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          Modifier
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await saveEntity({ ...entity, active: !entity.active }, false);
                            } catch (err) {
                              reportSettingsError("Impossible de modifier le statut de l'entité", err);
                            }
                          }}
                          className="h-8 rounded-lg border border-[#E1E4EA] px-2.5 text-xs font-medium text-[#19283E] hover:bg-[#E1E4EA]/40 whitespace-nowrap"
                        >
                          {entity.active ? 'Désactiver' : 'Activer'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Déclinaisons officielles du logo */}
                  <div className={`grid gap-2.5 ${hasDarkMono ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
                    <div className="rounded-lg border border-[#E1E4EA] bg-[#F4F5F8] p-3 flex flex-col items-center justify-center gap-1.5">
                      <BrandLogo
                        entityId={entity.id}
                        variant="light"
                        alt={`Logo ${entity.name} fond clair`}
                        customUrl={entity.logoUrl?.trim() || undefined}
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

          {canEditSettings && (
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
                        {canEditSettings ? (
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await saveProduct({ ...p, active: !p.active }, false);
                              } catch (err) {
                                reportSettingsError('Impossible de modifier le statut du produit', err);
                              }
                            }}
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

          {canEditSettings && (
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
                <CatalogSelectWithAdd
                  id="settings-prod-folder"
                  ariaLabel="Dossier de classement"
                  value={prodFolder}
                  onChange={setProdFolder}
                  options={catalogFolderOptions}
                  onAddCustomOption={(next) => setCustomFolders((prev) => [...prev, next])}
                  addOptionLabel="+ Ajouter un dossier..."
                  addPlaceholder="Nouveau dossier..."
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
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
                <CatalogSelectWithAdd
                  id="settings-prod-category"
                  ariaLabel="Catégorie"
                  value={prodCategory}
                  onChange={setProdCategory}
                  options={catalogCategoryOptions}
                  onAddCustomOption={(next) => setCustomCategories((prev) => [...prev, next])}
                  addOptionLabel="+ Ajouter une catégorie..."
                  addPlaceholder="Nouvelle catégorie..."
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
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
                        customUrl={entity.logoUrl?.trim() || undefined}
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

                  <fieldset disabled={!canEditSettings} className="space-y-4 disabled:opacity-75">
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
                          {canEditSettings && draft.signatureImageUrl && (
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
                        {canEditSettings && (
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
                          {canEditSettings && draft.stampImageUrl && (
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
                        {canEditSettings && (
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
                  </fieldset>

                  {canEditSettings && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await saveLegalSetting(
                            draft,
                            !legalSettings.some((l) => l.entityId === entity.id)
                          );
                          setLegalDrafts((prev) => {
                            const next = { ...prev };
                            delete next[entity.id];
                            return next;
                          });
                        } catch (err) {
                          reportSettingsError("Impossible d'enregistrer les mentions légales", err);
                        }
                      }}
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

            <fieldset disabled={!canEditSettings} className="space-y-4 disabled:opacity-75">
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
            </fieldset>

            {canEditSettings && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await saveIntegration(
                      {
                        ...outlookDraft,
                        enabled: Boolean(outlookDraft.accountEmail || outlookDraft.clientId),
                        status: outlookDraft.clientId ? 'ready' : 'disconnected',
                      },
                      !integrations.some((i) => i.id === outlookDraft.id)
                    );
                  } catch (err) {
                    reportSettingsError("Impossible d'enregistrer la configuration Outlook", err);
                  }
                }}
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

            <fieldset disabled={!canEditSettings} className="space-y-4 disabled:opacity-75">
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
            </fieldset>

            {canEditSettings && (
              <div>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await saveIntegration(
                        {
                          ...waDraft,
                          status: waDraft.enabled ? 'ready' : 'disconnected',
                        },
                        !integrations.some((i) => i.id === waDraft.id)
                      );
                    } catch (err) {
                      reportSettingsError("Impossible d'enregistrer la configuration WhatsApp", err);
                    }
                  }}
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
          <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-slate-500" />
              <h2 className="text-base font-semibold text-slate-900">
                Utilisateurs & permissions par entité ({users.length})
              </h2>
            </div>
            {canEditSettings && (
              <button
                type="button"
                onClick={() => {
                  setNewUserError(null);
                  setAddUserOpen(true);
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#19283E] px-3.5 text-xs sm:text-sm font-medium text-white hover:bg-[#223552] whitespace-nowrap"
              >
                <UserPlus className="h-4 w-4 text-[#C9A125]" />
                Ajouter un utilisateur
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Utilisateur</th>
                  <th className="py-3 px-4">Rôle</th>
                  <th className="py-3 px-4">Entités autorisées</th>
                  <th className="py-3 px-4">Statut</th>
                  {canEditSettings && <th className="py-3 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {users.map((u) => {
                  const isSelf = u.uid === user?.uid;
                  return (
                    <tr key={u.uid}>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-900">{u.displayName}</p>
                          {isSelf && (
                            <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                              Vous
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </td>
                      <td className="py-3 px-4">
                        {canEditSettings ? (
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
                                disabled={!canEditSettings || u.role === 'super_admin'}
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
                        {canEditSettings ? (
                          <button
                            type="button"
                            disabled={isSelf}
                            onClick={async () => {
                              try {
                                await patchUser(u.uid, (latest) => ({ ...latest, active: !latest.active }));
                              } catch (err) {
                                reportSettingsError("Impossible de modifier le statut de l'utilisateur", err);
                              }
                            }}
                            className={`rounded-md border px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${
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
                      {canEditSettings && (
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            disabled={isSelf}
                            onClick={() => setConfirmDeleteUser(u)}
                            aria-label={`Supprimer ${u.displayName}`}
                            title={
                              isSelf
                                ? 'Impossible de supprimer votre propre compte'
                                : 'Supprimer cet utilisateur'
                            }
                            className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Supprimer
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
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
              Tags de qualification ({tags.length})
            </h2>
            <div className="space-y-2">
              {tags.length === 0 ? (
                <p className="text-xs text-slate-500">Aucun tag de qualification configuré.</p>
              ) : (
                tags.map((t) => {
                  const isEditing = editingTag?.id === t.id;
                  return (
                    <div
                      key={t.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                    >
                      {isEditing ? (
                        <div className="flex flex-1 flex-wrap items-center gap-2">
                          <input
                            type="color"
                            aria-label={`Couleur du tag ${t.name}`}
                            value={editTagColor}
                            onChange={(e) => setEditTagColor(e.target.value)}
                            className="h-8 w-10 rounded border border-slate-200 bg-white p-0.5 shrink-0"
                          />
                          <input
                            type="text"
                            aria-label={`Nom du tag ${t.name}`}
                            value={editTagName}
                            onChange={(e) => setEditTagName(e.target.value)}
                            className="flex-1 min-w-[140px] h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEditedTag(t)}
                            aria-label={`Enregistrer le tag ${t.name}`}
                            className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#19283E] px-2.5 text-xs font-medium text-white hover:bg-[#223552]"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Enregistrer
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingTag(null)}
                            aria-label="Annuler la modification du tag"
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                          >
                            <X className="h-3.5 w-3.5" />
                            Annuler
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="h-3 w-3 rounded-sm shrink-0"
                              style={{ backgroundColor: t.color || '#1d4ed8' }}
                              aria-hidden="true"
                            />
                            <span className="text-xs font-medium text-slate-800 truncate">
                              {t.name}
                            </span>
                          </div>
                          {canEditSettings && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingTag(t);
                                  setEditTagName(t.name);
                                  setEditTagColor(t.color || '#1d4ed8');
                                }}
                                aria-label={`Modifier le tag ${t.name}`}
                                title="Modifier ce tag"
                                className="p-1 rounded text-slate-500 hover:bg-white hover:text-[#19283E]"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteTag(t)}
                                aria-label={`Supprimer le tag ${t.name}`}
                                title="Supprimer ce tag"
                                className="p-1 rounded text-slate-500 hover:bg-red-50 hover:text-red-700"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            {canEditSettings && (
              <form onSubmit={handleAddTag} className="flex items-center gap-2 pt-2">
                <input
                  type="color"
                  aria-label="Couleur du nouveau tag"
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  className="h-9 w-11 rounded border border-slate-200 bg-white p-1 shrink-0"
                />
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
            <fieldset disabled={!canEditSettings} className="grid grid-cols-1 sm:grid-cols-2 gap-4 disabled:opacity-75">
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
            </fieldset>
            {canEditSettings && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await saveSettings({
                      ...settings,
                      defaultCurrency: currency,
                      defaultProspectView: defaultView,
                    });
                  } catch (err) {
                    reportSettingsError("Impossible d'enregistrer les préférences", err);
                  }
                }}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#19283E] px-4 text-sm font-medium text-white hover:bg-[#223552]"
              >
                <Save className="h-4 w-4 text-[#C9A125]" />
                Enregistrer les préférences
              </button>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Database className="h-4 w-4 text-slate-500" />
              {authMode === 'firebase'
                ? 'Initialisation des paramètres de structure'
                : 'Initialisation des données de démonstration'}
            </h2>
            <p className="text-sm text-slate-600">
              {authMode === 'firebase'
                ? 'Crée uniquement les paramètres structurels manquants dans Firestore (4 entités Arena Group, mentions légales, compteurs, pipelines et tags), sans ajouter aucune donnée de test.'
                : 'Réinitialise le jeu de données local de démonstration avec les 4 entités Arena Group.'}
            </p>
            {canEditSettings && (
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
                  ? 'Initialiser la structure dans Firestore'
                  : 'Réinitialiser la démo locale'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Modal modification entité */}
      <Modal
        open={Boolean(editingEntity)}
        onClose={() => {
          if (!savingEntity) setEditingEntity(null);
        }}
        title={editingEntity ? `Modifier l'entité ${editingEntity.name}` : "Modifier l'entité"}
        subtitle="Modification réservée aux Super Admins."
      >
        <form onSubmit={handleSaveEditedEntity} className="space-y-4" noValidate>
          {editEntityError && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              {editEntityError}
            </div>
          )}
          <div>
            <label htmlFor="edit-ent-name" className="block text-xs font-medium text-slate-700 mb-1">
              Nom de l&apos;entité *
            </label>
            <input
              id="edit-ent-name"
              type="text"
              maxLength={120}
              value={editEntityName}
              onChange={(e) => setEditEntityName(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
              required
            />
          </div>
          <div>
            <label htmlFor="edit-ent-desc" className="block text-xs font-medium text-slate-700 mb-1">
              Description
            </label>
            <textarea
              id="edit-ent-desc"
              rows={2}
              maxLength={400}
              value={editEntityDesc}
              onChange={(e) => setEditEntityDesc(e.target.value)}
              className="w-full rounded-lg border border-slate-200 p-2.5 text-sm"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="edit-ent-color" className="block text-xs font-medium text-slate-700 mb-1">
                Couleur principale
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="edit-ent-color"
                  type="color"
                  value={editEntityColor}
                  onChange={(e) => setEditEntityColor(e.target.value)}
                  className="h-9 w-12 rounded border border-slate-200 p-1 shrink-0"
                />
                <input
                  type="text"
                  aria-label="Code couleur hexadécimal"
                  value={editEntityColor}
                  onChange={(e) => setEditEntityColor(e.target.value)}
                  className="flex-1 h-9 rounded-lg border border-slate-200 px-3 text-sm font-sans tabular-nums"
                />
              </div>
            </div>
            <div>
              <label htmlFor="edit-ent-logo" className="block text-xs font-medium text-slate-700 mb-1">
                URL Logo personnalisé (optionnel)
              </label>
              <input
                id="edit-ent-logo"
                type="url"
                maxLength={500}
                value={editEntityLogoUrl}
                onChange={(e) => setEditEntityLogoUrl(e.target.value)}
                placeholder="https://... (vide = logo officiel)"
                className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
              />
            </div>
          </div>
          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={editEntityActive}
              onChange={(e) => setEditEntityActive(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Entité active dans le CRM
          </label>
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              disabled={savingEntity}
              onClick={() => setEditingEntity(null)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={savingEntity}
              className="h-9 rounded-lg bg-[#19283E] px-4 text-sm font-medium text-white hover:bg-[#223552] disabled:opacity-50"
            >
              {savingEntity ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal ajout utilisateur */}
      <Modal
        open={addUserOpen}
        onClose={() => {
          if (!creatingUser) setAddUserOpen(false);
        }}
        title="Ajouter un utilisateur"
        subtitle={
          authMode === 'firebase'
            ? 'Crée le compte de connexion Firebase Auth et le profil CRM associé.'
            : 'Ajoute un collaborateur dans le répertoire CRM.'
        }
      >
        <form onSubmit={handleCreateUser} className="space-y-4" noValidate>
          {newUserError && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              {newUserError}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="new-user-name" className="block text-xs font-medium text-slate-700 mb-1">
                Nom complet *
              </label>
              <input
                id="new-user-name"
                type="text"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                placeholder="Ex : Riana Rakoto"
                className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
                required
              />
            </div>
            <div>
              <label htmlFor="new-user-email" className="block text-xs font-medium text-slate-700 mb-1">
                Email professionnel *
              </label>
              <input
                id="new-user-email"
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="collaborateur@arenagroup.mg"
                className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="new-user-password" className="block text-xs font-medium text-slate-700 mb-1">
                Mot de passe provisoire {authMode === 'firebase' ? '*' : '(optionnel en démo)'}
              </label>
              <input
                id="new-user-password"
                type="password"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                placeholder="Minimum 6 caractères"
                className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
              />
            </div>
            <div>
              <label htmlFor="new-user-role" className="block text-xs font-medium text-slate-700 mb-1">
                Rôle *
              </label>
              <select
                id="new-user-role"
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
              >
                {(Object.keys(USER_ROLE_LABELS) as UserRole[]).map((role) => (
                  <option key={role} value={role}>
                    {USER_ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {newUserRole !== 'super_admin' && (
            <div className="space-y-2">
              <span className="block text-xs font-medium text-slate-700">Entités autorisées</span>
              <div className="flex flex-wrap gap-2">
                {entities.map((ent) => {
                  const checked = newUserEntities.includes(ent.id);
                  return (
                    <label
                      key={ent.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setNewUserEntities((prev) =>
                            checked ? prev.filter((id) => id !== ent.id) : [...prev, ent.id]
                          )
                        }
                      />
                      {ent.name}
                    </label>
                  );
                })}
              </div>
            </div>
          )}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              disabled={creatingUser}
              onClick={() => setAddUserOpen(false)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={creatingUser}
              className="h-9 rounded-lg bg-[#19283E] px-4 text-sm font-medium text-white hover:bg-[#223552] disabled:opacity-50"
            >
              {creatingUser ? 'Création...' : "Créer l'utilisateur"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal confirmation suppression utilisateur */}
      <Modal
        open={Boolean(confirmDeleteUser)}
        onClose={() => {
          if (!deletingUser) setConfirmDeleteUser(null);
        }}
        title="Supprimer cet utilisateur ?"
        subtitle={confirmDeleteUser ? `${confirmDeleteUser.displayName} (${confirmDeleteUser.email})` : undefined}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            La suppression du profil révoque immédiatement ses droits d&apos;accès au CRM Arena Group.
          </p>
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              disabled={deletingUser}
              onClick={() => setConfirmDeleteUser(null)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={deletingUser || !confirmDeleteUser}
              onClick={async () => {
                if (!confirmDeleteUser) return;
                setDeletingUser(true);
                try {
                  await deleteUser(confirmDeleteUser.uid);
                  setConfirmDeleteUser(null);
                } catch (err) {
                  reportSettingsError("Impossible de supprimer l'utilisateur", err);
                } finally {
                  setDeletingUser(false);
                }
              }}
              className="h-9 rounded-lg bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {deletingUser ? 'Suppression...' : 'Confirmer la suppression'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal confirmation suppression tag */}
      <Modal
        open={Boolean(confirmDeleteTag)}
        onClose={() => {
          if (!deletingTag) setConfirmDeleteTag(null);
        }}
        title="Supprimer ce tag de qualification ?"
        subtitle={confirmDeleteTag ? confirmDeleteTag.name : undefined}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Ce tag sera retiré de la liste des tags de qualification disponibles dans les paramètres.
          </p>
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              disabled={deletingTag}
              onClick={() => setConfirmDeleteTag(null)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={deletingTag || !confirmDeleteTag}
              onClick={async () => {
                if (!confirmDeleteTag) return;
                setDeletingTag(true);
                try {
                  await deleteTag(confirmDeleteTag.id);
                  setConfirmDeleteTag(null);
                } catch (err) {
                  reportSettingsError('Impossible de supprimer le tag', err);
                } finally {
                  setDeletingTag(false);
                }
              }}
              className="h-9 rounded-lg bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {deletingTag ? 'Suppression...' : 'Confirmer la suppression'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
