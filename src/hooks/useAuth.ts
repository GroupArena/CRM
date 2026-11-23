import { useCrm } from '../context/CrmContext';
import {
  canDeleteProspect,
  canEditProspect,
  canManageEntities,
  canManageUsers,
  canViewAllEntities,
  canWriteCrm,
} from '../utils/crmLogic';
import type { Prospect } from '../types';

export function useAuth() {
  const {
    authMode,
    firebaseAvailable,
    currentUser,
    loginWithEmail,
    loginWithGoogle,
    pendingVerificationEmail,
    resendVerificationEmail,
    refreshVerificationStatus,
    enterDemoMode,
    switchDemoUser,
    logout,
  } = useCrm();

  return {
    authMode,
    isAuthenticated: authMode === 'firebase' || authMode === 'demo',
    isLoading: authMode === 'loading',
    firebaseAvailable,
    user: currentUser,
    pendingVerificationEmail,
    canViewAllEntities: canViewAllEntities(currentUser),
    canWriteCrm: canWriteCrm(currentUser),
    canManageUsers: canManageUsers(currentUser),
    canManageEntities: canManageEntities(currentUser),
    canEditProspect: (p: Prospect) => canEditProspect(currentUser, p),
    canDeleteProspect: (p: Prospect) => canDeleteProspect(currentUser, p),
    loginWithEmail,
    loginWithGoogle,
    resendVerificationEmail,
    refreshVerificationStatus,
    enterDemoMode,
    switchDemoUser,
    logout,
  };
}
