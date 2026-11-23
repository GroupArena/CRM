import { Menu, Search, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCrm } from '../../context/CrmContext';
import { useAuth } from '../../hooks/useAuth';
import { USER_ROLE_LABELS } from '../../types';
import { DEMO_USERS } from '../../services/seedData';
import { BrandLogo } from '../ui/BrandLogo';
import { NotificationsMenu } from './NotificationsMenu';

interface TopbarProps {
  onOpenMobileMenu: () => void;
}

export function Topbar({ onOpenMobileMenu }: TopbarProps) {
  const {
    selectedEntityId,
    setSelectedEntityId,
    authorizedEntities,
    globalSearch,
    setGlobalSearch,
  } = useCrm();
  const { authMode, user, canViewAllEntities, switchDemoUser, logout } = useAuth();
  const navigate = useNavigate();

  const activeEntity = authorizedEntities.find((e) => e.id === selectedEntityId);

  const handleSearchChange = (value: string) => {
    setGlobalSearch(value);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (globalSearch.trim()) {
      navigate('/prospects');
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-[#E1E4EA] bg-white px-4 sm:px-6">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Ouvrir le menu de navigation"
          className="lg:hidden rounded-lg p-2 text-[#19283E]/70 hover:bg-[#E1E4EA]/50"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2.5 min-w-0">
          <div className="hidden sm:flex h-9 w-24 items-center justify-center rounded-lg border border-[#E1E4EA] bg-[#F4F5F8] px-2 py-1 shrink-0">
            <BrandLogo
              entityId={selectedEntityId === 'all' ? 'group' : selectedEntityId}
              variant="light"
              alt={activeEntity ? `Logo ${activeEntity.name}` : 'Logo Arena Group'}
              className="h-full w-full"
            />
          </div>
          <label htmlFor="entity-selector" className="sr-only">
            Sélectionner une entité
          </label>
          <select
            id="entity-selector"
            aria-label="Sélecteur d'entité"
            value={selectedEntityId}
            onChange={(e) => setSelectedEntityId(e.target.value)}
            className="h-9 rounded-lg border border-[#E1E4EA] bg-[#F4F5F8] px-3 text-sm font-medium text-[#19283E] focus:border-[#C9A125] focus:bg-white focus:outline-none max-w-[210px] sm:max-w-[260px]"
          >
            {canViewAllEntities && <option value="all">Toutes les entités</option>}
            {authorizedEntities.map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <form
        onSubmit={handleSearchSubmit}
        className="hidden md:flex flex-1 max-w-lg items-center relative"
      >
        <Search className="h-4 w-4 text-[#19283E]/45 absolute left-3 pointer-events-none" />
        <label htmlFor="global-crm-search" className="sr-only">
          Recherche globale CRM
        </label>
        <input
          id="global-crm-search"
          type="search"
          value={globalSearch}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Rechercher un prospect, une entreprise, un email..."
          className="h-9 w-full rounded-lg border border-[#E1E4EA] bg-[#F4F5F8] pl-9 pr-3 text-sm text-[#19283E] placeholder:text-[#19283E]/45 focus:border-[#C9A125] focus:bg-white focus:outline-none"
        />
      </form>

      <div className="flex items-center gap-3 shrink-0">
        {authMode === 'demo' && (
          <div className="hidden xl:flex items-center gap-2">
            <label htmlFor="demo-role-switcher" className="sr-only">
              Changer de profil de démonstration
            </label>
            <select
              id="demo-role-switcher"
              aria-label="Changer de rôle démo"
              value={user?.uid ?? ''}
              onChange={(e) => switchDemoUser(e.target.value)}
              className="h-8 max-w-[185px] truncate rounded-lg border border-[#E1E4EA] bg-[#F4F5F8] px-2.5 text-xs font-medium text-[#19283E] focus:border-[#C9A125] focus:outline-none"
            >
              {DEMO_USERS.map((du) => (
                <option key={du.uid} value={du.uid}>
                  {du.displayName} ({USER_ROLE_LABELS[du.role]})
                </option>
              ))}
            </select>
          </div>
        )}

        {user && <NotificationsMenu />}

        {user && (
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right leading-tight">
              <p className="text-sm font-semibold text-[#19283E] whitespace-nowrap">
                {user.displayName}
              </p>
              <p className="text-xs text-slate-500 whitespace-nowrap">
                {USER_ROLE_LABELS[user.role]}
              </p>
            </div>
            <div
              aria-hidden="true"
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#19283E] text-xs font-semibold text-[#DBB361] border border-[#C9A125]/35 shrink-0"
            >
              {user.displayName
                .split(' ')
                .map((s) => s[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <button
              type="button"
              onClick={logout}
              aria-label="Se déconnecter"
              title="Se déconnecter"
              className="flex h-9 items-center gap-1.5 rounded-lg border border-[#E1E4EA] bg-white px-2.5 text-xs font-medium text-[#19283E] hover:bg-[#E1E4EA]/40 transition-colors whitespace-nowrap"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
