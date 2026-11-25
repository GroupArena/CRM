import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Package,
  ExternalLink,
  Edit2,
  Trash2,
  FolderTree,
  Layers,
  Repeat,
  TrendingUp,
  Tag,
  Building2,
} from 'lucide-react';
import { useCrm } from '../context/CrmContext';
import { useAuth } from '../hooks/useAuth';
import {
  PRODUCT_BILLING_DURATION_UNIT_LABELS,
  PRODUCT_BILLING_FREQUENCY_LABELS,
  PRODUCT_PRICING_TYPE_LABELS,
} from '../types';
import {
  computeProductMargin,
  resolveProductUnitPrice,
} from '../utils/billingLogic';
import { formatCurrency, formatDateFr } from '../utils/crmLogic';
import { ProductFormModal } from '../components/crm/ProductFormModal';
import { EmptyState } from '../components/ui/EmptyState';

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    products,
    entities,
    quoteItems,
    invoiceItems,
    deals,
    deleteProduct,
  } = useCrm();
  const { canWriteCrm, canDeleteProduct } = useAuth();

  const product = products.find((p) => p.id === id);

  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [simQty, setSimQty] = useState(1);
  const [imgError, setImgError] = useState(false);

  const usageStats = useMemo(() => {
    if (!product) return { quotes: 0, invoices: 0, deals: 0 };
    return {
      quotes: quoteItems.filter((qi) => qi.productId === product.id).length,
      invoices: invoiceItems.filter((ii) => ii.productId === product.id).length,
      deals: deals.filter((d) => d.productId === product.id).length,
    };
  }, [product, quoteItems, invoiceItems, deals]);

  if (!product) {
    return (
      <div className="space-y-4">
        <Link
          to="/products"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#19283E] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour au catalogue Produits &amp; Services
        </Link>
        <EmptyState
          icon={<Package className="h-6 w-6" />}
          title="Produit introuvable"
          description="Cette fiche produit n'existe plus ou a été supprimée."
        />
      </div>
    );
  }

  const baseMargin = computeProductMargin(product.price, product.unitCost ?? 0);
  const safeSimQty = Math.max(1, Number(simQty) || 1);
  const simulatedUnitPrice = resolveProductUnitPrice(product, safeSimQty);
  const simulatedTotal = simulatedUnitPrice * safeSimQty;
  const simulatedMargin = computeProductMargin(
    simulatedUnitPrice,
    product.unitCost ?? 0
  );

  const sortedTiers = [...(product.pricingTiers || [])].sort(
    (a, b) => a.minQty - b.minQty
  );

  const durationSummary =
    product.billingFrequency === 'one_time'
      ? 'Facturation unique à la commande'
      : product.billingDurationUnit &&
        product.billingDurationUnit !== 'unlimited' &&
        product.billingDurationCount
      ? `${product.billingDurationCount} ${
          PRODUCT_BILLING_DURATION_UNIT_LABELS[product.billingDurationUnit]
        }`
      : 'Durée indéterminée (renouvellement tacite)';

  const handleDelete = async () => {
    await deleteProduct(product.id);
    navigate('/products');
  };

  return (
    <div className="space-y-6">
      {/* Fil d'Ariane */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/products"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-[#19283E]"
        >
          <ArrowLeft className="h-4 w-4" />
          Catalogue Produits &amp; Services
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {product.productUrl && (
            <a
              href={product.productUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-[#19283E] hover:bg-slate-50"
            >
              Fiche sur le site
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          {canWriteCrm && (
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#19283E] px-4 text-sm font-medium text-white hover:bg-[#223552]"
            >
              <Edit2 className="h-4 w-4 text-[#C9A125]" />
              Modifier la fiche
            </button>
          )}
          {canDeleteProduct && !confirmDelete && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-xs font-medium text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Supprimer
            </button>
          )}
          {canDeleteProduct && confirmDelete && (
            <div className="inline-flex items-center gap-2">
              <button
                type="button"
                onClick={handleDelete}
                className="h-9 rounded-lg bg-red-600 px-3 text-xs font-semibold text-white hover:bg-red-700"
              >
                Confirmer suppression
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600"
              >
                Annuler
              </button>
            </div>
          )}
        </div>
      </div>

      {/* En-tête fiche produit */}
      <div className="rounded-xl border border-[#E1E4EA] bg-white p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
              {product.imageUrl?.trim() && !imgError ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Package className="h-7 w-7 text-slate-400" />
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="font-sans tabular-nums text-xs font-semibold rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[#19283E]">
                  UGS : {product.sku || '—'}
                </span>
                <span
                  className={`rounded border px-2 py-0.5 text-xs font-medium ${
                    product.active
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-slate-200 bg-slate-100 text-slate-500'
                  }`}
                >
                  {product.active ? 'Actif' : 'Inactif'}
                </span>
                <span className="text-xs text-slate-500">TVA non applicable</span>
              </div>
              <h1 className="font-display text-2xl font-bold text-[#19283E] mt-2">
                {product.name}
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                {product.folder || 'Catalogue général'} · {product.category} · Unité : {product.unit}
              </p>
            </div>
          </div>

          <div className="sm:text-right shrink-0">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Prix unitaire de base
            </p>
            <p className="text-2xl font-bold font-display tabular-nums text-[#19283E] mt-0.5">
              {formatCurrency(product.price, product.currency)}
            </p>
            <p className="text-xs font-sans tabular-nums text-emerald-700 mt-0.5">
              Marge : +{formatCurrency(baseMargin.unitMargin, product.currency)} ({baseMargin.marginRate}%)
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne principale */}
        <div className="lg:col-span-2 space-y-6">
          {/* Identification & Description */}
          <div className="rounded-xl border border-[#E1E4EA] bg-white p-6 space-y-4">
            <h2 className="font-display text-base font-semibold text-[#19283E]">
              Identification &amp; Description
            </h2>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
              {product.description || 'Aucune description renseignée pour ce produit ou service.'}
            </p>
            {product.productUrl && (
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-4 text-xs">
                <span className="text-slate-500">Lien fiche produit site web :</span>
                <a
                  href={product.productUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-blue-700 hover:underline truncate max-w-md"
                >
                  {product.productUrl}
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                </a>
              </div>
            )}
          </div>

          {/* Tarification & Rentabilité */}
          <div className="rounded-xl border border-[#E1E4EA] bg-white p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-base font-semibold text-[#19283E] flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-[#C9A125]" />
                Tarification &amp; Rentabilité
              </h2>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700">
                <Layers className="h-3.5 w-3.5 text-[#AD7300]" />
                {PRODUCT_PRICING_TYPE_LABELS[product.pricingType || 'fixed']}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] text-slate-500">Prix unitaire</p>
                <p className="mt-1 font-sans tabular-nums text-sm font-bold text-[#19283E]">
                  {formatCurrency(product.price, product.currency)}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] text-slate-500">Coût unitaire</p>
                <p className="mt-1 font-sans tabular-nums text-sm font-semibold text-slate-800">
                  {formatCurrency(product.unitCost ?? 0, product.currency)}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] text-slate-500">Marge unitaire</p>
                <p
                  className={`mt-1 font-sans tabular-nums text-sm font-bold ${
                    baseMargin.unitMargin >= 0 ? 'text-emerald-700' : 'text-red-700'
                  }`}
                >
                  {formatCurrency(baseMargin.unitMargin, product.currency)}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] text-slate-500">Taux de marge</p>
                <p
                  className={`mt-1 font-sans tabular-nums text-sm font-bold ${
                    baseMargin.marginRate >= 0 ? 'text-emerald-700' : 'text-red-700'
                  }`}
                >
                  {baseMargin.marginRate}%
                </p>
              </div>
            </div>

            {product.pricingType === 'tiered' && sortedTiers.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Grille des paliers de volume
                </h3>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                        <th className="py-2 px-3">Volume (quantité)</th>
                        <th className="py-2 px-3 text-right">Prix unitaire</th>
                        <th className="py-2 px-3 text-right">Marge unitaire</th>
                        <th className="py-2 px-3 text-right">Taux</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-sans tabular-nums">
                      {sortedTiers.map((tier, idx) => {
                        const tMargin = computeProductMargin(
                          tier.unitPrice,
                          product.unitCost ?? 0
                        );
                        return (
                          <tr key={idx}>
                            <td className="py-2 px-3 text-slate-800">
                              {tier.maxQty
                                ? `De ${tier.minQty} à ${tier.maxQty} ${product.unit}(s)`
                                : `${tier.minQty} et plus`}
                            </td>
                            <td className="py-2 px-3 text-right font-semibold text-[#19283E]">
                              {formatCurrency(tier.unitPrice, product.currency)}
                            </td>
                            <td className="py-2 px-3 text-right text-emerald-700">
                              {formatCurrency(tMargin.unitMargin, product.currency)}
                            </td>
                            <td className="py-2 px-3 text-right text-emerald-700">
                              {tMargin.marginRate}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Simulateur de prix par quantité */}
            <div className="rounded-lg border border-slate-200 bg-[#F4F5F8] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <label
                  htmlFor="sim-qty"
                  className="text-xs font-semibold text-[#19283E] whitespace-nowrap"
                >
                  Simulateur quantité :
                </label>
                <input
                  id="sim-qty"
                  type="number"
                  min="1"
                  value={simQty}
                  onChange={(e) => setSimQty(Math.max(1, Number(e.target.value) || 1))}
                  className="w-24 h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-sm font-sans tabular-nums"
                />
              </div>
              <div className="flex flex-wrap items-center gap-5 text-xs font-sans tabular-nums">
                <span className="text-slate-600">
                  PU appliqué :{' '}
                  <strong className="text-[#19283E]">
                    {formatCurrency(simulatedUnitPrice, product.currency)}
                  </strong>
                </span>
                <span className="text-slate-600">
                  Total net :{' '}
                  <strong className="text-[#19283E]">
                    {formatCurrency(simulatedTotal, product.currency)}
                  </strong>
                </span>
                <span className="text-emerald-700 font-semibold">
                  Marge : {simulatedMargin.marginRate}%
                </span>
              </div>
            </div>
          </div>

          {/* Facturation récurrente */}
          <div className="rounded-xl border border-[#E1E4EA] bg-white p-6 space-y-3">
            <h2 className="font-display text-base font-semibold text-[#19283E] flex items-center gap-2">
              <Repeat className="h-4 w-4 text-blue-600" />
              Facturation récurrente
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                <p className="text-xs text-slate-500">Fréquence</p>
                <p className="mt-1 font-semibold text-[#19283E]">
                  {PRODUCT_BILLING_FREQUENCY_LABELS[product.billingFrequency || 'one_time']}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                <p className="text-xs text-slate-500">Durée</p>
                <p className="mt-1 font-semibold text-[#19283E]">{durationSummary}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Colonne latérale */}
        <div className="space-y-6">
          {/* Visuel produit */}
          <div className="rounded-xl border border-[#E1E4EA] bg-white p-5 space-y-3">
            <h2 className="font-display text-sm font-semibold text-[#19283E]">
              Visuel du produit
            </h2>
            <div className="aspect-video w-full rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden">
              {product.imageUrl?.trim() && !imgError ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="text-center p-4">
                  <Package className="h-8 w-8 text-slate-300 mx-auto" />
                  <p className="text-xs text-slate-400 mt-1.5">Aucun visuel configuré</p>
                </div>
              )}
            </div>
          </div>

          {/* Classification & Propriétés personnalisées */}
          <div className="rounded-xl border border-[#E1E4EA] bg-white p-5 space-y-4">
            <h2 className="font-display text-sm font-semibold text-[#19283E] flex items-center gap-2">
              <FolderTree className="h-4 w-4 text-[#C9A125]" />
              Classification &amp; Propriétés
            </h2>
            <dl className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Dossier</dt>
                <dd className="font-medium text-slate-900">
                  {product.folder || 'Catalogue général'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Catégorie</dt>
                <dd className="font-medium text-slate-900">{product.category}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Devise</dt>
                <dd className="font-sans tabular-nums font-semibold text-slate-900">{product.currency}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Mis à jour le</dt>
                <dd className="font-sans tabular-nums text-slate-700">{formatDateFr(product.updatedAt)}</dd>
              </div>
            </dl>

            <div className="pt-3 border-t border-slate-100 space-y-2">
              <p className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-slate-400" />
                Entités autorisées
              </p>
              <p className="text-xs text-slate-800">
                {product.entityIds.length === 0
                  ? 'Toutes les entités Arena Group'
                  : product.entityIds
                      .map((eid) => entities.find((e) => e.id === eid)?.name ?? eid)
                      .join(' · ')}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-2">
              <p className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-slate-400" />
                Propriétés personnalisées
              </p>
              {(product.customProperties || []).length === 0 ? (
                <p className="text-xs text-slate-400">Aucune propriété personnalisée.</p>
              ) : (
                <dl className="space-y-1.5 text-xs">
                  {product.customProperties.map((cp, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-2 rounded bg-slate-50 px-2.5 py-1.5"
                    >
                      <dt className="text-slate-500">{cp.key}</dt>
                      <dd className="font-medium text-slate-900 text-right">{cp.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </div>

          {/* Utilisation CRM */}
          <div className="rounded-xl border border-[#E1E4EA] bg-white p-5 space-y-3">
            <h2 className="font-display text-sm font-semibold text-[#19283E]">
              Utilisation commerciale
            </h2>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                <p className="font-display tabular-nums text-lg font-bold text-[#19283E]">{usageStats.deals}</p>
                <p className="text-[11px] text-slate-500">Opportunités</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                <p className="font-display tabular-nums text-lg font-bold text-[#19283E]">{usageStats.quotes}</p>
                <p className="text-[11px] text-slate-500">Devis</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                <p className="font-display tabular-nums text-lg font-bold text-[#19283E]">
                  {usageStats.invoices}
                </p>
                <p className="text-[11px] text-slate-500">Factures</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ProductFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        initialProduct={product}
      />
    </div>
  );
}
