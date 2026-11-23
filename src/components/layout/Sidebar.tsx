import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Target,
  Contact2,
  Building2,
  Kanban,
  Package,
  CalendarDays,
  FileText,
  Receipt,
  CreditCard,
  AlertOctagon,
  BarChart3,
  Settings,
  X,
} from 'lucide-react';
import { useActions } from '../../hooks/useActions';
import { BrandLogo } from '../ui/BrandLogo';

interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({ mobileOpen, onCloseMobile }: SidebarProps) {
  const { lateCount } = useActions();

  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/prospects', label: 'Prospects', icon: Target, end: false },
    { to: '/contacts', label: 'Contacts', icon: Contact2, end: false },
    { to: '/companies', label: 'Entreprises', icon: Building2, end: false },
    { to: '/pipeline', label: 'Pipeline', icon: Kanban, end: false },
    { to: '/products', label: 'Produits & Services', icon: Package, end: false },
    {
      to: '/agenda',
      label: 'Agenda',
      icon: CalendarDays,
      badge: lateCount > 0 ? lateCount : undefined,
      end: false,
    },
    { to: '/quotes', label: 'Devis', icon: FileText, end: false },
    { to: '/invoices', label: 'Factures', icon: Receipt, end: false },
    { to: '/payments', label: 'Paiements', icon: CreditCard, end: false },
    { to: '/complaints', label: 'Réclamations', icon: AlertOctagon, end: false },
    { to: '/reports', label: 'Rapports', icon: BarChart3, end: false },
    { to: '/settings', label: 'Paramètres', icon: Settings, end: false },
  ];

  const content = (
    <div className="flex h-full flex-col bg-[#19283E] text-[#E1E4EA] w-64 shrink-0 border-r border-white/10">
      <div className="flex items-center justify-between px-5 h-20 border-b border-white/10">
        <NavLink
          to="/"
          onClick={onCloseMobile}
          aria-label="Accueil Arena Group CRM"
          className="flex items-center py-2 min-w-0"
        >
          <BrandLogo
            entityId="group"
            variant="dark"
            alt="Logo Arena Group"
            className="w-[164px] h-11 justify-start"
            imgClassName="h-full w-auto max-w-full object-contain object-left"
          />
        </NavLink>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Fermer le menu latéral"
          className="lg:hidden rounded-lg p-1.5 text-[#E1E4EA]/70 hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav aria-label="Navigation principale" className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onCloseMobile}
              className={({ isActive }) =>
                `flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-[#C9A125] text-[#19283E] font-semibold'
                    : 'font-medium text-[#E1E4EA]/85 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <span className="flex items-center gap-3 min-w-0">
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </span>
              {item.badge !== undefined && (
                <span
                  aria-label={`${item.badge} actions en retard`}
                  className="tabular-nums rounded px-1.5 py-0.5 text-xs font-semibold bg-[#7A1F2B] text-white border border-white/15"
                >
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="px-5 py-3.5 border-t border-white/10 text-xs text-[#E1E4EA]/70">
        <p className="font-medium text-[#DBB361]">Pilotage multi-entités</p>
        <p className="mt-0.5">Un même langage · 4 pôles</p>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:flex lg:shrink-0">{content}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div
            className="fixed inset-0 bg-[#19283E]/70"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-50 flex">{content}</aside>
        </div>
      )}
    </>
  );
}
