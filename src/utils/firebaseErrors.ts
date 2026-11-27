export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message?: unknown }).message ?? '');
  }
  return String(error ?? '');
}

export function extractErrorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return String((error as { code?: unknown }).code ?? '').toLowerCase();
  }
  return '';
}

export function isFirestoreOfflineError(error: unknown): boolean {
  const code = extractErrorCode(error);
  const msg = extractErrorMessage(error).toLowerCase();

  if (
    code === 'unavailable' ||
    code === 'deadline-exceeded' ||
    code === 'auth/network-request-failed'
  ) {
    return true;
  }

  return (
    msg.includes('the client is offline') ||
    msg.includes('could not reach cloud firestore backend') ||
    msg.includes('backend didn\'t respond') ||
    msg.includes('unavailable') ||
    msg.includes('network-request-failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('network error')
  );
}

export function isFirestorePermissionError(error: unknown): boolean {
  const code = extractErrorCode(error);
  const msg = extractErrorMessage(error).toLowerCase();
  return (
    code === 'permission-denied' ||
    msg.includes('permission-denied') ||
    msg.includes('missing or insufficient permissions')
  );
}

export type AccountAccessDeniedCode =
  | 'auth/account-deleted'
  | 'auth/account-suspended';

export class AccountAccessDeniedError extends Error {
  code: AccountAccessDeniedCode;

  constructor(code: AccountAccessDeniedCode, message: string) {
    super(message);
    this.name = 'AccountAccessDeniedError';
    this.code = code;
  }
}

export function isAccountAccessDeniedError(
  error: unknown
): error is AccountAccessDeniedError {
  if (error instanceof AccountAccessDeniedError) {
    return true;
  }
  const code = extractErrorCode(error);
  return code === 'auth/account-deleted' || code === 'auth/account-suspended';
}

export function formatFirebaseAuthErrorFr(error: unknown): string {
  const msg = extractErrorMessage(error);
  const code = extractErrorCode(error);

  if (
    isAccountAccessDeniedError(error) ||
    code === 'auth/email-already-in-use-different-password'
  ) {
    return msg || "Accès refusé. Contactez un administrateur.";
  }

  if (isFirestoreOfflineError(error)) {
    return 'Impossible de joindre Cloud Firestore pour le moment (connexion lente ou hors ligne). Vérifiez votre réseau puis réessayez, ou utilisez le mode démonstration.';
  }

  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found' ||
    msg.includes('invalid-credential') ||
    msg.includes('wrong-password') ||
    msg.includes('user-not-found')
  ) {
    return 'Identifiants incorrects. Vérifiez votre email et votre mot de passe.';
  }
  if (code === 'auth/too-many-requests' || msg.includes('too-many-requests')) {
    return 'Trop de tentatives. Veuillez patienter quelques instants avant de réessayer.';
  }
  if (code === 'auth/operation-not-allowed' || msg.includes('operation-not-allowed')) {
    return 'La connexion Email/Mot de passe doit être activée dans la console Firebase Authentication.';
  }

  return 'Connexion impossible. Vérifiez vos identifiants ou la configuration Firebase.';
}
