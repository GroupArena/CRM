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

- **Projet Firebase provisionné** : `cool-acolyte-zlvvl`
- **Base Cloud Firestore** : `ai-studio-fc7d5e1a-ce3e-4c8e-84ec-d119cb5294b3`
- **Super Admin initial (bootstrap)** : `navalona.rajaonarivelo@gmail.com`

1. Dans la **Console Firebase**, activez **Authentication** :
   - **Fournisseur Email/Mot de passe** : Authentication > Sign-in method > Email/Password > Activer.
   - Créez votre compte administrateur (`navalona.rajaonarivelo@gmail.com`) dans **Authentication > Users** (les règles Firestore exigent une adresse email vérifiée : un lien de vérification est proposé automatiquement à la première connexion si nécessaire).
2. Ajoutez vos domaines autorisés dans **Authentication > Settings > Authorized domains** :
   - `localhost`
   - `<votre-utilisateur>.github.io`
3. Déployez les règles et index Firestore (les règles `firestore.rules` sont déjà déployées sur la base de l'applet ; utilisez la commande ci-dessous après modification locale) :

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

## Initialisation des données de démonstration

- **Depuis l'interface** : Connectez-vous avec le compte Super Admin (ou utilisez le mode Démo locale), puis allez dans **Paramètres > Préférences & Données > Initialiser Firestore avec les données démo**.
- **En ligne de commande** :

```bash
SEED_ADMIN_EMAIL="navalona.rajaonarivelo@gmail.com" SEED_ADMIN_PASSWORD="VotreMotDePasse" npx tsx scripts/seed.ts
```

## Mise en ligne sur GitHub & GitHub Pages

1. Initialisez le dépôt Git local et poussez vers votre dépôt GitHub (branche `main`) :

```bash
git init -b main
git add .
git commit -m "Initialisation Arena Group CRM"
git remote add origin https://github.com/<votre-utilisateur>/<votre-depot>.git
git push -u origin main
```

2. Dans votre dépôt GitHub, ouvrez **Settings > Pages** et sélectionnez **Source : GitHub Actions**.
3. Ajoutez les secrets dans **Settings > Secrets and variables > Actions** (optionnel si `firebase-applet-config.json` est conservé dans le dépôt, recommandé pour surcharger par environnement) :
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_FIREBASE_DATABASE_ID` (`ai-studio-fc7d5e1a-ce3e-4c8e-84ec-d119cb5294b3`)
4. Chaque push sur `main` déclenche `.github/workflows/deploy.yml` (vérification TypeScript + build Vite + déploiement GitHub Pages).
