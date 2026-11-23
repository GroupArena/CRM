/**
 * Script d'initialisation des données de démonstration Arena Group CRM.
 * Usage :
 *   npx tsx scripts/seed.ts
 *
 * Prérequis :
 *   Renseigner les variables VITE_FIREBASE_* dans .env.local
 *   ou disposer du fichier firebase-applet-config.json à la racine.
 */
import 'dotenv/config';
import { readFileSync, existsSync } from 'node:fs';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  doc,
  getFirestore,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import {
  DEFAULT_ENTITIES,
  DEFAULT_PIPELINES,
  DEFAULT_PIPELINE_STAGES,
  DEFAULT_TAGS,
  DEMO_ACTIONS,
  DEMO_AUDIT_LOGS,
  DEMO_DEALS,
  DEMO_PROSPECTS,
} from '../src/services/seedData';

function loadConfig() {
  if (process.env.VITE_FIREBASE_API_KEY && process.env.VITE_FIREBASE_PROJECT_ID) {
    return {
      apiKey: process.env.VITE_FIREBASE_API_KEY,
      authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.VITE_FIREBASE_APP_ID,
      firestoreDatabaseId: process.env.VITE_FIREBASE_DATABASE_ID,
    };
  }
  if (existsSync('./firebase-applet-config.json')) {
    return JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));
  }
  throw new Error(
    'Configuration Firebase introuvable. Renseignez .env.local ou firebase-applet-config.json.'
  );
}

async function runSeed() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.error(
      'Définissez SEED_ADMIN_EMAIL et SEED_ADMIN_PASSWORD pour exécuter le seed authentifié, ou utilisez le bouton dans Paramètres > Préférences & Données une fois connecté en Super Admin.'
    );
    process.exit(1);
  }

  const config = loadConfig();
  const app = initializeApp({
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    storageBucket: config.storageBucket,
    messagingSenderId: config.messagingSenderId,
    appId: config.appId,
  });

  const auth = getAuth(app);
  const credential = await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
  const uid = credential.user.uid;

  const db =
    config.firestoreDatabaseId && config.firestoreDatabaseId !== '(default)'
      ? getFirestore(app, config.firestoreDatabaseId)
      : getFirestore(app);

  const batch = writeBatch(db);

  batch.set(doc(db, 'users', uid), {
    uid,
    email: adminEmail,
    displayName: credential.user.displayName || 'Super Admin Arena Group',
    role: 'super_admin',
    entityIds: DEFAULT_ENTITIES.map((e) => e.id),
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  for (const entity of DEFAULT_ENTITIES) {
    const { createdAt: _c, updatedAt: _u, ...rest } = entity;
    batch.set(doc(db, 'entities', entity.id), {
      ...rest,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  for (const pipeline of DEFAULT_PIPELINES) {
    const { createdAt: _c, updatedAt: _u, ...rest } = pipeline;
    batch.set(doc(db, 'pipelines', pipeline.id), {
      ...rest,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  for (const stage of DEFAULT_PIPELINE_STAGES) {
    const { createdAt: _c, updatedAt: _u, ...rest } = stage;
    batch.set(doc(db, 'pipelineStages', stage.id), {
      ...rest,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  for (const tag of DEFAULT_TAGS) {
    const { createdAt: _c, updatedAt: _u, ...rest } = tag;
    batch.set(doc(db, 'tags', tag.id), {
      ...rest,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  for (const prospect of DEMO_PROSPECTS) {
    const { createdAt: _c, updatedAt: _u, lastActivityAt: _l, ...rest } = prospect;
    batch.set(doc(db, 'prospects', prospect.id), {
      ...rest,
      ownerUid: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastActivityAt: serverTimestamp(),
    });
  }

  for (const action of DEMO_ACTIONS) {
    const { createdAt: _c, updatedAt: _u, ...rest } = action;
    batch.set(doc(db, 'actions', action.id), {
      ...rest,
      assignedToUid: uid,
      createdByUid: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  for (const deal of DEMO_DEALS) {
    const { createdAt: _c, updatedAt: _u, ...rest } = deal;
    batch.set(doc(db, 'deals', deal.id), {
      ...rest,
      ownerUid: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  for (const log of DEMO_AUDIT_LOGS) {
    const { createdAt: _c, ...rest } = log;
    batch.set(doc(db, 'auditLogs', log.id), {
      ...rest,
      actorUid: uid,
      createdAt: serverTimestamp(),
    });
  }

  await batch.commit();
  console.log('Données de démonstration Arena Group initialisées avec succès dans Firestore.');
  process.exit(0);
}

runSeed().catch((err) => {
  console.error('Erreur lors du seed :', err);
  process.exit(1);
});
