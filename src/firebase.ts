import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  sendEmailVerification,
  signOut,
  updateProfile,
  type Auth,
} from 'firebase/auth';
import {
  enableNetwork,
  getFirestore,
  initializeFirestore,
  doc,
  getDocFromServer,
  type Firestore,
  type FirestoreSettings,
} from 'firebase/firestore';
import { isFirestoreOfflineError } from './utils/firebaseErrors';

interface FirebaseConfigShape {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  firestoreDatabaseId?: string;
}

const configModules = import.meta.glob<{ default: FirebaseConfigShape }>(
  '/firebase-applet-config.json',
  { eager: true }
);
const appletConfig: FirebaseConfigShape =
  configModules['/firebase-applet-config.json']?.default ?? {};

const envConfig: FirebaseConfigShape = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID,
};

const firebaseConfig: FirebaseConfigShape = {
  apiKey: envConfig.apiKey || appletConfig.apiKey,
  authDomain: envConfig.authDomain || appletConfig.authDomain,
  projectId: envConfig.projectId || appletConfig.projectId,
  storageBucket: envConfig.storageBucket || appletConfig.storageBucket,
  messagingSenderId: envConfig.messagingSenderId || appletConfig.messagingSenderId,
  appId: envConfig.appId || appletConfig.appId,
  firestoreDatabaseId: envConfig.firestoreDatabaseId || appletConfig.firestoreDatabaseId,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId
);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (isFirebaseConfigured) {
  app = initializeApp({
    apiKey: firebaseConfig.apiKey,
    authDomain: firebaseConfig.authDomain,
    projectId: firebaseConfig.projectId,
    storageBucket: firebaseConfig.storageBucket,
    messagingSenderId: firebaseConfig.messagingSenderId,
    appId: firebaseConfig.appId,
  });
  auth = getAuth(app);
  const databaseId = firebaseConfig.firestoreDatabaseId;
  const targetDatabaseId =
    databaseId && databaseId !== '(default)' ? databaseId : undefined;
  const firestoreSettings: FirestoreSettings = {
    experimentalAutoDetectLongPolling: true,
    ignoreUndefinedProperties: true,
  };
  try {
    db = targetDatabaseId
      ? initializeFirestore(app, firestoreSettings, targetDatabaseId)
      : initializeFirestore(app, firestoreSettings);
  } catch {
    db = targetDatabaseId ? getFirestore(app, targetDatabaseId) : getFirestore(app);
  }
}

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export { app, auth, db };

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid ?? null,
      email: auth?.currentUser?.email ?? null,
      emailVerified: auth?.currentUser?.emailVerified ?? null,
      isAnonymous: auth?.currentUser?.isAnonymous ?? null,
      tenantId: auth?.currentUser?.tenantId ?? null,
      providerInfo:
        auth?.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) ?? [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function recoverFirestoreNetwork(): Promise<void> {
  if (!db) return;
  try {
    await enableNetwork(db);
  } catch {
    // Ignorer si déjà actif ou hors ligne
  }
}

export async function testFirestoreConnection(): Promise<boolean> {
  if (!db) return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return false;
  }
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (isFirestoreOfflineError(error)) {
      console.warn(
        'Firestore temporairement inaccessible (mode hors ligne). Vérifiez la connexion réseau ou utilisez le mode démonstration.'
      );
      return false;
    }
    return true;
  }
}

export async function createAuthUserAsAdmin(
  email: string,
  password: string,
  displayName: string
): Promise<{ uid: string }> {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase Auth non configuré.');
  }
  const secondaryName = `arena-admin-create-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const secondaryApp = initializeApp(
    {
      apiKey: firebaseConfig.apiKey,
      authDomain: firebaseConfig.authDomain,
      projectId: firebaseConfig.projectId,
      storageBucket: firebaseConfig.storageBucket,
      messagingSenderId: firebaseConfig.messagingSenderId,
      appId: firebaseConfig.appId,
    },
    secondaryName
  );
  const secondaryAuth = getAuth(secondaryApp);
  try {
    const credential = await createUserWithEmailAndPassword(
      secondaryAuth,
      email.trim(),
      password
    );
    if (displayName.trim()) {
      await updateProfile(credential.user, { displayName: displayName.trim() });
    }
    try {
      await sendEmailVerification(credential.user);
    } catch {
      // L'envoi de vérification email reste non bloquant
    }
    const uid = credential.user.uid;
    await signOut(secondaryAuth);
    return { uid };
  } finally {
    await deleteApp(secondaryApp);
  }
}
