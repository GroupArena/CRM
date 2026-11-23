import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  Package,
  ExternalLink,
  Edit2,
  Eye,
  Layers,
  Repeat,
  FolderTree,
  CheckCircle2,
} from 'lucide-react';
import { useCrm } from '../context/CrmContext';
import { useAuth } from '../hooks/useAuth';
import {
  PRODUCT_BILLING_DURATION_UNIT_LABELS,
  PRODUCT_BILLING_FREQUENCY_LABELS,
  type Product,
  type ProductBillingFrequency,
  type ProductPricingType,
} from '../types';
import { computeProductMargin } from '../utils/billingLogic';
import { formatCurrency } from '../utils/crmLogic';
import { EmptyState } from '../components/ui/EmptyState';
import { ProductFormModal } from '../components/crm/ProductFormModal';

function formatBillingBadge(product: Product): string {
  const freq = PRODUCT_BILLING_FREQUENCY_LABELS[product.billingFrequency] || 'Ponctuelle';
  if (product.billingFrequency === 'one_time') return 'Ponctuelle';
  if (
    product.billingDurationUnit &&
    product.billingDurationUnit !== 'unlimited' &&
    product.billingDurationCount
  ) {
    return `${freq} · ${product.billingDurationCount} ${
      PRODUCT_BILLING_DURATION_UNIT_LABELS[product.billingDurationUnit]
    }`;
  }
  return `${freq} · Durée indéterminée`;
}

export function ProductsPage() {
  const { products, authorizedEntities, entities, globalSearch, settings } = useCrm();
  const { canWriteCrm } = useAuth();

  const [entityFilter, setEntityFilter] = useState('all');
  const [folderFilter, setFolderFilter] = useState('all');
  const [pricingFilter, setPricingFilter] = useState<'all' | ProductPricingType>('all');
  const [freqFilter, setFreqFilter] = useState<'all' | ProductBillingFrequency>('all');
  const [localSearch, setLocalSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  const folders = useMemo(
    () =>
      Array.from(
        new Set(products.map((p) => p.folder || 'Catalogue général').filter(Boolean))
      ).sort((a, b) => a.localeCompare(b)),
    [products]
  );

  const filteredProducts = useMemo(() => {
    const query = (localSearch || globalSearch).trim().toLowerCase();
    return products
      .filter((p) => {
        if (entityFilter !== 'all' && p.entityIds.length > 0 && !p.entityIds.includes(entityFilter)) {
          return false;
        }
        if (folderFilter !== 'all' && (p.folder || 'Catalogue général') !== folderFilter) {
          return false;
        }
        if (pricingFilter !== 'all' && p.pricingType !== pricingFilter) return false;
        if (freqFilter !== 'all' && p.billingFrequency !== freqFilter) return false;
        if (query) {
          const customHay = (p.customProperties || [])
            .map((cp) => `${cp.key} ${cp.value}`)
            .join(' ');
          const hay = [
            p.name,
            p.sku,
            p.folder,
            p.category,
            p.description,
            customHay,
          ]
            .join(' ')
            .toLowerCase();
          if (!hay.includes(query)) return false;
        }
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products, entityFilter, folderFilter, pricingFilter, freqFilter, localSearch, globalSearch]);

  const stats = useMemo(() => {
    return {
      total: products.length,
      active: products.filter((p) => p.active).length,
      tiered: products.filter((p) => p.pricingType === 'tiered').length,
      recurring: products.filter((p) => p.billingFrequency !== 'one_time').length,
    };
  }, [products]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#19283E]">
            Produits & Services
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Catalogue multi-entités · Devise par défaut : {settings.defaultCurrency || 'MGA'} · TVA non applicable
          </p>
        </div>

        {canWriteCrm && (
          <button
            type="button"
            onClick={() => {
              setEditingProduct(null);
              setModalOpen(true);
            }}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#19283E] px-4 text-sm font-medium text-white hover:bg-[#223552] whitespace-nowrap"
          >
            <Plus className="h-4 w-4 text-[#C9A125]" />
            Nouveau produit / service
          </button>
        )}
      </div>

      {/* KPIs catalogue */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-[#E1E4EA] bg-white p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Références catalogue</span>
            <Package className="h-4 w-4 text-[#19283E]" />
          </div>
          <p className="mt-2 text-2xl font-bold font-sans tabular-nums text-[#19283E]">
            {stats.total}
          </p>
        </div>
        <div className="rounded-xl border border-[#E1E4EA] bg-white p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Offres actives</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-bold font-sans tabular-nums text-emerald-700">
            {stats.active}
          </p>
        </div>
        <div className="rounded-xl border border-[#E1E4EA] bg-white p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Tarifs échelonnés</span>
            <Layers className="h-4 w-4 text-[#AD7300]" />
          </div>
          <p className="mt-2 text-2xl font-bold font-sans tabular-nums text-[#AD7300]">
            {stats.tiered}
          </p>
        </div>
        <div className="rounded-xl border border-[#E1E4EA] bg-white p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Facturation récurrente</span>
            <Repeat className="h-4 w-4 text-blue-600" />
          </div>
          <p className="mt-2 text-2xl font-bold font-sans tabular-nums text-blue-700">
            {stats.recurring}
          </p>
        </div>
      </div>

      {/* Filtres */}
      <div className="rounded-xl border border-[#E1E4EA] bg-white p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <input
          type="search"
          aria-label="Rechercher un produit par nom ou UGS"
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          placeholder="Nom, UGS (SKU)..."
          className="h-9 rounded-lg border border-slate-200 px-3 text-sm"
        />

        <select
          aria-label="Filtrer par entité"
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="all">Toutes les entités</option>
          {authorizedEntities.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>

        <select
          aria-label="Filtrer par dossier"
          value={folderFilter}
          onChange={(e) => setFolderFilter(e.target.value)}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="all">Tous les dossiers</option>
          {folders.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>

        <select
          aria-label="Filtrer par tarification"
          value={pricingFilter}
          onChange={(e) => setPricingFilter(e.target.value as 'all' | ProductPricingType)}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="all">Toutes tarifications</option>
          <option value="fixed">Tarification fixe</option>
          <option value="tiered">Tarification échelonnée</option>
        </select>

        <select
          aria-label="Filtrer par fréquence"
          value={freqFilter}
          onChange={(e) => setFreqFilter(e.target.value as 'all' | ProductBillingFrequency)}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="all">Toutes fréquences</option>
          {(Object.keys(PRODUCT_BILLING_FREQUENCY_LABELS) as ProductBillingFrequency[]).map(
            (freq) => (
              <option key={freq} value={freq}>
                {PRODUCT_BILLING_FREQUENCY_LABELS[freq]}
              </option>
            )
          )}
        </select>
      </div>

      {filteredProducts.length === 0 ? (
        <EmptyState
          icon={<Package className="h-6 w-6" />}
          title="Aucun produit ou service trouvé"
          description="Créez une fiche produit complète avec UGS (SKU), dossier, marge unitaire, paliers de volume et facturation récurrente."
        />
      ) : (
        <div className="rounded-xl border border-[#E1E4EA] bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-3.5">Produit / Service &amp; UGS</th>
                  <th className="py-3 px-3">Dossier &amp; Entités</th>
                  <th className="py-3 px-3 text-right">Prix unitaire</th>
                  <th className="py-3 px-3 text-right">Coût &amp; Marge</th>
                  <th className="py-3 px-3">Tarif &amp; Récurrence</th>
                  <th className="py-3 px-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredProducts.map((p) => {
                  const margin = computeProductMargin(p.price, p.unitCost ?? 0);
                  const showImg = Boolean(p.imageUrl?.trim()) && !brokenImages[p.id];
                  const entityLabel =
                    p.entityIds.length === 0
                      ? 'Toutes entités'
                      : p.entityIds
                          .map((id) => entities.find((e) => e.id === id)?.name ?? id)
                          .join(', ');
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-3.5">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                            {showImg ? (
                              <img
                                src={p.imageUrl}
                                alt={p.name}
                                referrerPolicy="no-referrer"
                                onError={() =>
                                  setBrokenImages((prev) => ({ ...prev, [p.id]: true }))
                                }
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <Package className="h-4 w-4 text-slate-400" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Link
                                to={`/products/${p.id}`}
                                className="font-semibold text-[#19283E] hover:text-[#AD7300] hover:underline"
                              >
                                {p.name}
                              </Link>
                              {!p.active && (
                                <span className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                                  Inactif
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5">
                              <span className="font-sans tabular-nums font-semibold text-slate-700">
                                {p.sku || '—'}
                              </span>
                              <span>·</span>
                              <span>{p.category}</span>
                              {p.productUrl && (
                                <>
                                  <span>·</span>
                                  <a
                                    href={p.productUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-0.5 text-blue-700 hover:underline"
                                  >
                                    Fiche site
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-600">
                        <div className="flex items-center gap-1 font-medium text-slate-800">
                          <FolderTree className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>{p.folder || 'Catalogue général'}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{entityLabel}</div>
                      </td>
                      <td className="py-3 px-3 text-right font-sans tabular-nums whitespace-nowrap">
                        <div className="font-semibold text-slate-900">
                          {formatCurrency(p.price, p.currency)}
                        </div>
                        <div className="text-[11px] text-slate-500">/ {p.unit}</div>
                      </td>
                      <td className="py-3 px-3 text-right font-sans tabular-nums whitespace-nowrap">
                        <div className="text-xs text-slate-600">
                          Coût : {formatCurrency(p.unitCost ?? 0, p.currency)}
                        </div>
                        <div
                          className={`text-xs font-semibold ${
                            margin.unitMargin >= 0 ? 'text-emerald-700' : 'text-red-700'
                          }`}
                        >
                          +{formatCurrency(margin.unitMargin, p.currency)} ({margin.marginRate}%)
                        </div>
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-600">
                        <div className="font-medium text-slate-800">
                          {p.pricingType === 'tiered'
                            ? `Échelonnée (${p.pricingTiers?.length || 0} paliers)`
                            : 'Tarif fixe'}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {formatBillingBadge(p)}
                        </div>
                      </td>
                      <td className="py-3 px-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1">
                          <Link
                            to={`/products/${p.id}`}
                            title="Voir la fiche produit"
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-[#19283E] hover:bg-slate-50"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Fiche
                          </Link>
                          {canWriteCrm && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingProduct(p);
                                setModalOpen(true);
                              }}
                              aria-label={`Modifier ${p.name}`}
                              title="Modifier"
                              className="p-1.5 rounded text-slate-500 hover:bg-slate-100"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ProductFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialProduct={editingProduct}
      />
    </div>
  );
}
