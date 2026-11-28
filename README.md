# Arena Group CRM — Multi-Entités

Application CRM complète développée en **React + TypeScript + Vite + Tailwind CSS + Firebase (Auth & Firestore)**, conçue pour le pilotage commercial des 4 entités d'**Arena Group** et prête pour un déploiement statique sur **GitHub Pages**.

## Entités gérées

1. **Arena Business Center** — Domiciliation d’entreprises, bureaux équipés et salles de réunion
2. **Improveo** — Conseil opérationnel, certification Qualiopi et performance PME
3. **Arena Studio Comm** — Agence de communication, identité de marque et stratégie digitale
4. **Maison & Artisanat** — Valorisation des métiers d’art, décoration sur mesure et distribution

## Architecture & Stack

- **Frontend** : React 19, TypeScript, Tailwind CSS v4
- **Routing** : `HashRouter` (`react-router-dom`) pour compatibilité totale avec GitHub Pages
- **Backend Serverless** : Firebase Authentication & Cloud Firestore
- **Graphiques** : Recharts
- **Pipeline Kanban** : `@dnd-kit/core` (glisser-déposer + sélecteur accessible)

## Installation locale

```bash
npm install
cp .env.example .env.local
# Renseignez vos variables VITE_FIREBASE_* dans .env.local
npm run dev
```

## Configuration Firebase (Auth & Firestore)

- **Projet Firebase / Base Cloud Firestore** : renseignez vos identifiants dans `.env.local` (en local) ou via les GitHub Secrets dans `.github/workflows/deploy.yml` (en production).

1. Dans la **Console Firebase**, activez **Authentication** :
   - **Fournisseur Adresse e-mail/Mot de passe** : Authentication > Mode de connexion > Adresse e-mail/Mot de passe > Activer.
   - Créez le premier compte administrateur dans **Authentication > Utilisateurs** (les règles Firestore exigent une adresse e-mail vérifiée), puis créez son document correspondant dans **Firestore > `users/{uid}`** (`uid`, `email`, `displayName`, `role: "super_admin"`, `entityIds: ["arena-business-center", "improveo", "arena-studio-comm", "maison-artisanat"]`, `active: true`, `createdAt`, `updatedAt`).
2. Ajoutez vos domaines autorisés dans **Authentication > Paramètres > Domaines autorisés** (`localhost`, domaine de production).
3. Déployez les règles et index Firestore après modification :

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

## Initialisation des données de démonstration

- **Depuis l'interface** : Connectez-vous avec le compte Super Admin (ou utilisez le mode Démo locale), puis allez dans **Paramètres > Préférences & Données > Initialiser Firestore avec les données démo**.
- **En ligne de commande** :

```bash
SEED_ADMIN_EMAIL="admin@votre-domaine.tld" SEED_ADMIN_PASSWORD="VotreMotDePasse" npx tsx scripts/seed.ts
```

## Mise en ligne sur GitHub & GitHub Pages

1. Ne versionnez jamais `.env*` (hors `.env.example`), les clés de compte de service (`*serviceAccount*.json`), ni `firebase-applet-config.json` sur un dépôt public.
2. Initialisez le dépôt Git local et poussez vers votre dépôt distant (branche `main`).
3. Dans votre dépôt GitHub, ouvrez **Settings > Pages** et sélectionnez **Source : GitHub Actions**.
4. Ajoutez les secrets dans **Settings > Secrets and variables > Actions** :
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_FIREBASE_DATABASE_ID`
5. Chaque push sur `main` déclenche `.github/workflows/deploy.yml` (vérification TypeScript + build Vite + déploiement GitHub Pages).

