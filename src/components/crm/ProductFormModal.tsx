import React, { useEffect, useMemo, useState } from 'react';
import { Package, Plus, Trash2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useCrm } from '../../context/CrmContext';
import {
  PRODUCT_BILLING_DURATION_UNIT_LABELS,
  PRODUCT_BILLING_FREQUENCY_LABELS,
  PRODUCT_PRICING_TYPE_LABELS,
  SUPPORTED_CURRENCIES,
  type Product,
  type ProductBillingDurationUnit,
  type ProductBillingFrequency,
  type ProductCustomProperty,
  type ProductPricingTier,
  type ProductPricingType,
} from '../../types';
import {
  buildCatalogOptions,
  computeProductMargin,
  DEFAULT_PRODUCT_CATEGORIES,
  DEFAULT_PRODUCT_FOLDERS,
  isSkuUnique,
  validateProductInput,
} from '../../utils/billingLogic';
import { formatCurrency } from '../../utils/crmLogic';
import { CatalogSelectWithAdd } from './CatalogSelectWithAdd';

interface ProductFormModalProps {
  open: boolean;
  onClose: () => void;
  initialProduct?: Product | null;
}

export function ProductFormModal({ open, onClose, initialProduct }: ProductFormModalProps) {
  const { entities, products, settings, saveProduct } = useCrm();

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [description, setDescription] = useState('');
  const [folder, setFolder] = useState('Catalogue général');
  const [category, setCategory] = useState('Services');
  const [entityIds, setEntityIds] = useState<string[]>([]);
  const [active, setActive] = useState(true);
  const [customProperties, setCustomProperties] = useState<ProductCustomProperty[]>([]);

  const [currency, setCurrency] = useState(settings.defaultCurrency || 'MGA');
  const [price, setPrice] = useState('150000');
  const [unitCost, setUnitCost] = useState('60000');
  const [unit, setUnit] = useState('forfait');
  const [pricingType, setPricingType] = useState<ProductPricingType>('fixed');
  const [pricingTiers, setPricingTiers] = useState<ProductPricingTier[]>([]);

  const [billingFrequency, setBillingFrequency] =
    useState<ProductBillingFrequency>('one_time');
  const [billingDurationUnit, setBillingDurationUnit] =
    useState<ProductBillingDurationUnit>('unlimited');
  const [billingDurationCount, setBillingDurationCount] = useState('12');

  const [imageUrl, setImageUrl] = useState('');
  const [productUrl, setProductUrl] = useState('');
  const [imagePreviewError, setImagePreviewError] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [customFolders, setCustomFolders] = useState<string[]>([]);
  const [customCategories, setCustomCategories] = useState<string[]>([]);

  const folderOptions = useMemo(
    () =>
      buildCatalogOptions(
        products.map((p) => p.folder),
        DEFAULT_PRODUCT_FOLDERS,
        ...customFolders,
        folder
      ),
    [products, customFolders, folder]
  );

  const categoryOptions = useMemo(
    () =>
      buildCatalogOptions(
        products.map((p) => p.category),
        DEFAULT_PRODUCT_CATEGORIES,
        ...customCategories,
        category
      ),
    [products, customCategories, category]
  );

  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);
    setImagePreviewError(false);

    if (initialProduct) {
      setName(initialProduct.name);
      setSku(initialProduct.sku || '');
      setDescription(initialProduct.description || '');
      setFolder(initialProduct.folder || 'Catalogue général');
      setCategory(initialProduct.category || 'Services');
      setEntityIds(initialProduct.entityIds || []);
      setActive(initialProduct.active);
      setCustomProperties(
        (initialProduct.customProperties || []).map((cp) => ({ ...cp }))
      );

      setCurrency(initialProduct.currency || settings.defaultCurrency || 'MGA');
      setPrice(String(initialProduct.price ?? 0));
      setUnitCost(String(initialProduct.unitCost ?? 0));
      setUnit(initialProduct.unit || 'unité');
      setPricingType(initialProduct.pricingType || 'fixed');
      setPricingTiers(
        (initialProduct.pricingTiers || []).map((t) => ({ ...t }))
      );

      setBillingFrequency(initialProduct.billingFrequency || 'one_time');
      setBillingDurationUnit(initialProduct.billingDurationUnit || 'unlimited');
      setBillingDurationCount(
        initialProduct.billingDurationCount ? String(initialProduct.billingDurationCount) : '12'
      );

      setImageUrl(initialProduct.imageUrl || '');
      setProductUrl(initialProduct.productUrl || '');
    } else {
      setName('');
      setSku('');
      setDescription('');
      setFolder('Catalogue général');
      setCategory('Services');
      setEntityIds([]);
      setActive(true);
      setCustomProperties([]);

      setCurrency(settings.defaultCurrency || 'MGA');
      setPrice('150000');
      setUnitCost('60000');
      setUnit('forfait');
      setPricingType('fixed');
      setPricingTiers([
        { minQty: 1, maxQty: 9, unitPrice: 150000 },
        { minQty: 10, maxQty: null, unitPrice: 130000 },
      ]);

      setBillingFrequency('one_time');
      setBillingDurationUnit('unlimited');
      setBillingDurationCount('12');

      setImageUrl('');
      setProductUrl('');
    }
  }, [open, initialProduct, settings.defaultCurrency]);

  const numPrice = Math.max(0, Number(price) || 0);
  const numUnitCost = Math.max(0, Number(unitCost) || 0);
  const marginStats = useMemo(
    () => computeProductMargin(numPrice, numUnitCost),
    [numPrice, numUnitCost]
  );

  const skuAlreadyUsed =
    sku.trim().length > 0 && !isSkuUnique(products, sku, initialProduct?.id);

  const handleAddProperty = () => {
    setCustomProperties((prev) => [...prev, { key: '', value: '' }]);
  };

  const handleUpdateProperty = (
    idx: number,
    patch: Partial<ProductCustomProperty>
  ) => {
    setCustomProperties((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, ...patch } : item))
    );
  };

  const handleRemoveProperty = (idx: number) => {
    setCustomProperties((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAddTier = () => {
    const lastTier = pricingTiers[pricingTiers.length - 1];
    const nextMin = lastTier
      ? (lastTier.maxQty ? Number(lastTier.maxQty) + 1 : Number(lastTier.minQty) + 10)
      : 1;
    setPricingTiers((prev) => [
      ...prev,
      {
        minQty: nextMin,
        maxQty: null,
        unitPrice: Math.max(0, Math.round(numPrice * 0.9)),
      },
    ]);
  };

  const handleUpdateTier = (idx: number, patch: Partial<ProductPricingTier>) => {
    setPricingTiers((prev) =>
      prev.map((t, i) => (i === idx ? { ...t, ...patch } : t))
    );
  };

  const handleRemoveTier = (idx: number) => {
    setPricingTiers((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleToggleEntity = (id: string) => {
    setEntityIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedProperties = customProperties
      .map((cp) => ({ key: cp.key.trim(), value: cp.value.trim() }))
      .filter((cp) => cp.key.length > 0 || cp.value.length > 0);

    const cleanedTiers =
      pricingType === 'tiered'
        ? pricingTiers.map((t) => ({
            minQty: Number(t.minQty) || 0,
            maxQty:
              t.maxQty === null || t.maxQty === undefined || Number.isNaN(Number(t.maxQty))
                ? null
                : Number(t.maxQty),
            unitPrice: Number(t.unitPrice) || 0,
          }))
        : [];

    const validationError = validateProductInput(
      {
        id: initialProduct?.id,
        name,
        sku,
        folder,
        price: Number(price),
        unitCost: Number(unitCost),
        pricingType,
        pricingTiers: cleanedTiers,
        imageUrl,
        productUrl,
      },
      products
    );

    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      const now = new Date().toISOString();
      const parsedDuration = Math.max(1, Number(billingDurationCount) || 1);
      const payload: Product = {
        id: initialProduct?.id ?? `prod-${Date.now()}`,
        name: name.trim(),
        sku: sku.trim().toUpperCase(),
        description: description.trim(),
        folder: folder.trim() || 'Catalogue général',
        category: category.trim() || 'Services',
        customProperties: cleanedProperties,
        price: numPrice,
        unitCost: numUnitCost,
        pricingType,
        pricingTiers: cleanedTiers,
        billingFrequency,
        billingDurationUnit:
          billingFrequency === 'one_time' ? 'unlimited' : billingDurationUnit,
        billingDurationCount:
          billingFrequency !== 'one_time' && billingDurationUnit !== 'unlimited'
            ? parsedDuration
            : undefined,
        imageUrl: imageUrl.trim(),
        productUrl: productUrl.trim(),
        currency: currency || settings.defaultCurrency || 'MGA',
        unit: unit.trim() || 'unité',
        vatRate: 0,
        active,
        entityIds,
        createdAt: initialProduct?.createdAt ?? now,
        updatedAt: now,
      };
      await saveProduct(payload, !initialProduct);
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Erreur lors de l'enregistrement du produit."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        initialProduct
          ? `Modifier la fiche produit — ${initialProduct.sku || initialProduct.name}`
          : 'Nouvelle fiche produit / service'
      }
      subtitle="Identification UGS (SKU), dossier, propriétés personnalisées, tarification fixe ou échelonnée, facturation récurrente et visuels."
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {errorMsg && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {errorMsg}
          </div>
        )}

        {/* 1. Identification */}
        <section className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[#19283E]">
            1. Identification
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label htmlFor="prod-name" className="block text-xs font-medium text-slate-700 mb-1">
                Nom du produit / service *
              </label>
              <input
                id="prod-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex : Domiciliation Prestige Tana"
                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
                required
              />
            </div>
            <div>
              <label htmlFor="prod-sku" className="block text-xs font-medium text-slate-700 mb-1">
                UGS (SKU unique) *
              </label>
              <input
                id="prod-sku"
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value.toUpperCase())}
                placeholder="ABC-DOM-001"
                className={`w-full h-9 rounded-lg border bg-white px-3 text-sm font-sans tabular-nums ${
                  skuAlreadyUsed ? 'border-red-400 text-red-700' : 'border-slate-200'
                }`}
                required
              />
              {skuAlreadyUsed && (
                <p className="mt-1 text-[11px] text-red-600">
                  Ce code UGS (SKU) existe déjà.
                </p>
              )}
            </div>
          </div>
          <div>
            <label htmlFor="prod-desc" className="block text-xs font-medium text-slate-700 mb-1">
              Description détaillée
            </label>
            <textarea
              id="prod-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Périmètre de la prestation, livrables, caractéristiques techniques..."
              className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm"
            />
          </div>
        </section>

        {/* 2. Classification */}
        <section className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[#19283E]">
            2. Classification & Propriétés personnalisées
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <CatalogSelectWithAdd
              id="prod-folder"
              label="Dossier de classement"
              value={folder}
              onChange={setFolder}
              options={folderOptions}
              onAddCustomOption={(next) => setCustomFolders((prev) => [...prev, next])}
              addOptionLabel="+ Ajouter un dossier..."
              addPlaceholder="Nom du nouveau dossier..."
            />
            <CatalogSelectWithAdd
              id="prod-category"
              label="Catégorie"
              value={category}
              onChange={setCategory}
              options={categoryOptions}
              onAddCustomOption={(next) => setCustomCategories((prev) => [...prev, next])}
              addOptionLabel="+ Ajouter une catégorie..."
              addPlaceholder="Nom de la nouvelle catégorie..."
            />
          </div>
          <div>
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              Produit actif au catalogue
            </label>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-700 mb-1.5">
              Entités autorisées (aucune cochée = toutes les entités)
            </p>
            <div className="flex flex-wrap gap-3 text-xs">
              {entities.map((ent) => (
                <label key={ent.id} className="inline-flex items-center gap-1.5 text-slate-700">
                  <input
                    type="checkbox"
                    checked={entityIds.includes(ent.id)}
                    onChange={() => handleToggleEntity(ent.id)}
                  />
                  {ent.name}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-700">
                Propriétés personnalisées ({customProperties.length})
              </span>
              <button
                type="button"
                onClick={handleAddProperty}
                className="inline-flex h-7 items-center gap-1 rounded border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                <Plus className="h-3.5 w-3.5" />
                Ajouter une propriété
              </button>
            </div>
            {customProperties.map((prop, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <input
                  type="text"
                  aria-label={`Nom propriété ${idx + 1}`}
                  value={prop.key}
                  onChange={(e) => handleUpdateProperty(idx, { key: e.target.value })}
                  placeholder="Nom (ex : Matériau, Délai)"
                  className="col-span-5 h-8 rounded border border-slate-200 bg-white px-2.5 text-xs"
                />
                <input
                  type="text"
                  aria-label={`Valeur propriété ${idx + 1}`}
                  value={prop.value}
                  onChange={(e) => handleUpdateProperty(idx, { value: e.target.value })}
                  placeholder="Valeur (ex : Raphia naturel)"
                  className="col-span-6 h-8 rounded border border-slate-200 bg-white px-2.5 text-xs"
                />
                <div className="col-span-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleRemoveProperty(idx)}
                    aria-label="Supprimer la propriété"
                    className="p-1 text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 3. Tarification */}
        <section className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[#19283E]">
              3. Tarification & Marge (TVA non applicable)
            </h3>
            <span
              className={`font-sans tabular-nums text-xs font-semibold tabular-nums ${
                marginStats.unitMargin >= 0 ? 'text-emerald-700' : 'text-red-700'
              }`}
            >
              Marge : {formatCurrency(marginStats.unitMargin, currency)} ({marginStats.marginRate}%)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label htmlFor="prod-price" className="block text-xs font-medium text-slate-700 mb-1">
                Prix unitaire *
              </label>
              <input
                id="prod-price"
                type="number"
                min="0"
                step="1"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-sans tabular-nums"
                required
              />
            </div>
            <div>
              <label htmlFor="prod-cost" className="block text-xs font-medium text-slate-700 mb-1">
                Coût unitaire
              </label>
              <input
                id="prod-cost"
                type="number"
                min="0"
                step="1"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-sans tabular-nums"
              />
            </div>
            <div>
              <label htmlFor="prod-currency" className="block text-xs font-medium text-slate-700 mb-1">
                Devise
              </label>
              <select
                id="prod-currency"
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
              <label htmlFor="prod-unit" className="block text-xs font-medium text-slate-700 mb-1">
                Unité
              </label>
              <input
                id="prod-unit"
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="forfait, mois, pièce..."
                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label htmlFor="prod-pricing-type" className="block text-xs font-medium text-slate-700 mb-1">
                Type de tarification
              </label>
              <select
                id="prod-pricing-type"
                value={pricingType}
                onChange={(e) => {
                  const next = e.target.value as ProductPricingType;
                  setPricingType(next);
                  if (next === 'tiered' && pricingTiers.length === 0) {
                    setPricingTiers([
                      { minQty: 1, maxQty: 9, unitPrice: numPrice },
                      { minQty: 10, maxQty: null, unitPrice: Math.round(numPrice * 0.9) },
                    ]);
                  }
                }}
                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
              >
                {(Object.keys(PRODUCT_PRICING_TYPE_LABELS) as ProductPricingType[]).map((key) => (
                  <option key={key} value={key}>
                    {PRODUCT_PRICING_TYPE_LABELS[key]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {pricingType === 'tiered' && (
            <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800">
                  Paliers de volume (tarif dégressif selon quantité)
                </span>
                <button
                  type="button"
                  onClick={handleAddTier}
                  className="inline-flex h-7 items-center gap-1 rounded border border-slate-300 bg-slate-50 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Ajouter un palier
                </button>
              </div>
              <div className="grid grid-cols-12 gap-2 text-[11px] font-medium text-slate-500 px-1">
                <span className="col-span-3">Qté min *</span>
                <span className="col-span-3">Qté max (vide = ∞)</span>
                <span className="col-span-5">Prix unitaire palier</span>
                <span className="col-span-1" />
              </div>
              {pricingTiers.map((tier, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    type="number"
                    min="1"
                    aria-label={`Quantité min palier ${idx + 1}`}
                    value={tier.minQty}
                    onChange={(e) =>
                      handleUpdateTier(idx, { minQty: Math.max(1, Number(e.target.value) || 1) })
                    }
                    className="col-span-3 h-8 rounded border border-slate-200 px-2 text-xs font-sans tabular-nums"
                  />
                  <input
                    type="number"
                    min="1"
                    aria-label={`Quantité max palier ${idx + 1}`}
                    value={tier.maxQty ?? ''}
                    placeholder="∞"
                    onChange={(e) =>
                      handleUpdateTier(idx, {
                        maxQty: e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
                    className="col-span-3 h-8 rounded border border-slate-200 px-2 text-xs font-sans tabular-nums"
                  />
                  <input
                    type="number"
                    min="0"
                    step="1"
                    aria-label={`Prix unitaire palier ${idx + 1}`}
                    value={tier.unitPrice}
                    onChange={(e) =>
                      handleUpdateTier(idx, { unitPrice: Math.max(0, Number(e.target.value) || 0) })
                    }
                    className="col-span-5 h-8 rounded border border-slate-200 px-2 text-xs font-sans tabular-nums"
                  />
                  <div className="col-span-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleRemoveTier(idx)}
                      aria-label="Supprimer le palier"
                      className="p-1 text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 4. Facturation récurrente */}
        <section className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[#19283E]">
            4. Facturation récurrente
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="prod-freq" className="block text-xs font-medium text-slate-700 mb-1">
                Fréquence de facturation
              </label>
              <select
                id="prod-freq"
                value={billingFrequency}
                onChange={(e) =>
                  setBillingFrequency(e.target.value as ProductBillingFrequency)
                }
                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
              >
                {(Object.keys(PRODUCT_BILLING_FREQUENCY_LABELS) as ProductBillingFrequency[]).map(
                  (freq) => (
                    <option key={freq} value={freq}>
                      {PRODUCT_BILLING_FREQUENCY_LABELS[freq]}
                    </option>
                  )
                )}
              </select>
            </div>
            {billingFrequency !== 'one_time' && (
              <>
                <div>
                  <label
                    htmlFor="prod-dur-unit"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Durée d&apos;engagement
                  </label>
                  <select
                    id="prod-dur-unit"
                    value={billingDurationUnit}
                    onChange={(e) =>
                      setBillingDurationUnit(e.target.value as ProductBillingDurationUnit)
                    }
                    className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
                  >
                    {(
                      Object.keys(
                        PRODUCT_BILLING_DURATION_UNIT_LABELS
                      ) as ProductBillingDurationUnit[]
                    ).map((u) => (
                      <option key={u} value={u}>
                        {PRODUCT_BILLING_DURATION_UNIT_LABELS[u]}
                      </option>
                    ))}
                  </select>
                </div>
                {billingDurationUnit !== 'unlimited' && (
                  <div>
                    <label
                      htmlFor="prod-dur-count"
                      className="block text-xs font-medium text-slate-700 mb-1"
                    >
                      Nombre de {PRODUCT_BILLING_DURATION_UNIT_LABELS[billingDurationUnit]}
                    </label>
                    <input
                      id="prod-dur-count"
                      type="number"
                      min="1"
                      value={billingDurationCount}
                      onChange={(e) => setBillingDurationCount(e.target.value)}
                      className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-sans tabular-nums"
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* 5. Visuels et liens */}
        <section className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[#19283E]">
            5. Visuels & Liens
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
            <div className="sm:col-span-2 flex justify-center">
              <div className="h-16 w-16 rounded-lg border border-slate-200 bg-white flex items-center justify-center overflow-hidden">
                {imageUrl.trim() && !imagePreviewError ? (
                  <img
                    src={imageUrl.trim()}
                    alt="Aperçu produit"
                    referrerPolicy="no-referrer"
                    onError={() => setImagePreviewError(true)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Package className="h-6 w-6 text-slate-400" />
                )}
              </div>
            </div>
            <div className="sm:col-span-5">
              <label htmlFor="prod-img-url" className="block text-xs font-medium text-slate-700 mb-1">
                URL de l&apos;image produit
              </label>
              <input
                id="prod-img-url"
                type="url"
                value={imageUrl}
                onChange={(e) => {
                  setImageUrl(e.target.value);
                  setImagePreviewError(false);
                }}
                placeholder="https://..."
                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
              />
            </div>
            <div className="sm:col-span-5">
              <label htmlFor="prod-site-url" className="block text-xs font-medium text-slate-700 mb-1">
                URL fiche produit sur le site web
              </label>
              <input
                id="prod-site-url"
                type="url"
                value={productUrl}
                onChange={(e) => setProductUrl(e.target.value)}
                placeholder="https://arenagroup.mg/..."
                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
              />
            </div>
          </div>
        </section>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="h-9 rounded-lg bg-[#19283E] px-4 text-sm font-medium text-white hover:bg-[#223552] disabled:opacity-50"
          >
            {submitting
              ? 'Enregistrement...'
              : initialProduct
              ? 'Enregistrer les modifications'
              : 'Créer la fiche produit'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
