import { useCrm } from '../context/CrmContext';
import {
  canDeleteProductRecord,
  canDeleteProspect,
  canEditProspect,
  canManageEntities,
  canManageSettings,
  canManageUsers,
  canViewAllEntities,
  canWriteCrm,
  isSuperAdminUser,
} from '../utils/crmLogic';
import type { Prospect } from '../types';

export function useAuth() {
  const {
    authMode,
    firebaseAvailable,
    firestoreOffline,
    firestoreConnectionStatus,
    authConnectionError,
    retryFirebaseConnection,
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
    firestoreOffline,
    firestoreConnectionStatus,
    authConnectionError,
    retryFirebaseConnection,
    user: currentUser,
    pendingVerificationEmail,
    isSuperAdmin: isSuperAdminUser(currentUser),
    canViewAllEntities: canViewAllEntities(currentUser),
    canWriteCrm: canWriteCrm(currentUser),
    canManageSettings: canManageSettings(currentUser),
    canManageUsers: canManageUsers(currentUser),
    canManageEntities: canManageEntities(currentUser),
    canDeleteProduct: canDeleteProductRecord(currentUser),
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
