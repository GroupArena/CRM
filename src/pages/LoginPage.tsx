import React, { useState } from 'react';
import { Lock, Mail, ArrowRight, CheckCircle2, RefreshCw, WifiOff } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { DEFAULT_ENTITIES } from '../services/seedData';
import { ArenaSymbol, BrandLogo } from '../components/ui/BrandLogo';
import { formatFirebaseAuthErrorFr } from '../utils/firebaseErrors';
import { shouldShowDemoModeOption } from '../utils/crmLogic';

const LOGIN_ENTITY_DESCRIPTIONS: Record<string, string> = {
  'arena-business-center': 'Plateforme dédiée aux Entreprises & Investisseurs',
  improveo: 'Cabinet de conseils',
  'arena-studio-comm': 'Agence de communication',
  'maison-artisanat': 'Maison de production textile',
};

export function LoginPage() {
  const {
    loginWithEmail,
    pendingVerificationEmail,
    resendVerificationEmail,
    refreshVerificationStatus,
    logout,
    enterDemoMode,
    firebaseAvailable,
    firestoreOffline,
    firestoreConnectionStatus,
    authConnectionError,
    authAccessError,
    clearAuthAccessError,
    retryFirebaseConnection,
  } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const displayedError = errorMsg || authAccessError;

  const showDemoOption = shouldShowDemoModeOption({
    firebaseAvailable,
    firestoreConnectionStatus,
    firestoreOffline,
    authConnectionError,
  });

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Veuillez saisir votre adresse email et votre mot de passe.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    clearAuthAccessError();
    setInfoMsg(null);
    try {
      await loginWithEmail(email, password);
    } catch (err) {
      setErrorMsg(formatFirebaseAuthErrorFr(err));
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setLoading(true);
    setErrorMsg(null);
    setInfoMsg(null);
    try {
      await resendVerificationEmail();
      setInfoMsg(
        `Un email de vérification vient d'être envoyé à ${pendingVerificationEmail}. Cliquez sur le lien reçu puis actualisez.`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('too-many-requests')) {
        setErrorMsg('Un email de vérification a déjà été envoyé récemment. Vérifiez votre boîte mail ou patientez un instant.');
      } else {
        setErrorMsg("Impossible d'envoyer l'email de vérification pour le moment.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshVerification = async () => {
    setLoading(true);
    setErrorMsg(null);
    setInfoMsg(null);
    try {
      const verified = await refreshVerificationStatus();
      if (!verified && !authConnectionError && !firestoreOffline) {
        setErrorMsg("L'adresse email n'est pas encore marquée comme vérifiée. Cliquez sur le lien reçu par email.");
      }
    } catch (err) {
      setErrorMsg(formatFirebaseAuthErrorFr(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#E1E4EA]/55 flex flex-col lg:flex-row">
      <div className="relative overflow-hidden lg:w-1/2 bg-[#19283E] text-white p-8 sm:p-12 lg:p-16 flex flex-col justify-between">
        {/* Filigrane subtil du symbole Arena Group (Charte section D) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-12 -right-10 select-none"
        >
          <ArenaSymbol className="h-72 w-72" color="#C9A125" opacity={0.07} />
        </div>

        <div className="relative z-10">
          <div className="py-1">
            <BrandLogo
              entityId="group"
              variant="dark"
              alt="Logo officiel Arena Group"
              className="h-28 sm:h-32 max-w-[320px] justify-start"
              imgClassName="h-full w-auto max-w-full object-contain object-left"
            />
          </div>

          <p className="mt-4 font-display text-base sm:text-lg font-medium text-white tracking-wide">
            Chaque étape compte. On la{' '}
            <span className="text-[#C9A125] font-semibold">construit</span> avec vous.
          </p>

          <h1 className="mt-8 font-display text-lg sm:text-xl font-semibold tracking-tight text-[#E1E4EA]/90 text-balance max-w-md leading-snug">
            Pilotage commercial unifié pour l’ensemble des entités du Groupe.
          </h1>
        </div>

        <div className="relative z-10 mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {DEFAULT_ENTITIES.map((entity) => (
            <div
              key={entity.id}
              className="rounded-xl border border-white/15 bg-[#121D2E]/85 p-4 flex flex-col justify-between gap-3"
            >
              <div className="h-10 flex items-center justify-start px-1">
                <BrandLogo
                  entityId={entity.id}
                  variant="dark"
                  alt={`Logo ${entity.name}`}
                  className="h-9 max-w-[175px] justify-start"
                  imgClassName="max-h-full w-auto object-contain object-left"
                />
              </div>
              <div>
                <h2 className="text-xs font-semibold text-[#DBB361]">{entity.name}</h2>
                <p className="mt-1 text-xs text-[#E1E4EA]/75 leading-relaxed">
                  {LOGIN_ENTITY_DESCRIPTIONS[entity.id] ?? entity.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md rounded-xl border border-[#E1E4EA] bg-white p-8 shadow-sm">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-bold text-[#19283E]">
                Connexion au CRM
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Accédez à votre espace commercial sécurisé Arena Group.
              </p>
            </div>
            <BrandLogo
              entityId="group"
              variant="light"
              alt="Arena Group"
              className="w-20 h-11 shrink-0 hidden sm:inline-flex"
            />
          </div>

          {displayedError && (
            <div
              role="alert"
              className="mb-5 rounded-lg border border-[#7A1F2B]/30 bg-[#7A1F2B]/10 px-4 py-3 text-sm text-[#7A1F2B]"
            >
              {displayedError}
            </div>
          )}

          {(firestoreOffline || authConnectionError) && !displayedError && (
            <div
              role="alert"
              className="mb-5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900 space-y-2.5"
            >
              <div className="flex items-start gap-2.5">
                <WifiOff className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  {authConnectionError ??
                    'Cloud Firestore est temporairement inaccessible (réseau lent ou mode hors ligne). Vérifiez votre connexion Internet ou utilisez la démo interactive.'}
                </p>
              </div>
              <button
                type="button"
                disabled={loading}
                onClick={async () => {
                  setLoading(true);
                  setErrorMsg(null);
                  const ok = await retryFirebaseConnection();
                  if (ok) {
                    setInfoMsg('Connexion à Cloud Firestore rétablie.');
                  }
                  setLoading(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-amber-400 bg-white px-3 py-1.5 text-xs font-medium text-amber-950 hover:bg-amber-100/60 transition-colors disabled:opacity-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Réessayer la connexion Firestore
              </button>
            </div>
          )}

          {infoMsg && (
            <div
              role="status"
              className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
            >
              {infoMsg}
            </div>
          )}

          {pendingVerificationEmail ? (
            <div className="space-y-4 rounded-xl border border-[#C9A125]/40 bg-[#C9A125]/10 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-[#AD7300] shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-[#19283E]">
                    Vérification email requise
                  </h3>
                  <p className="mt-1 text-xs text-slate-700 leading-relaxed">
                    Connecté en tant que <strong>{pendingVerificationEmail}</strong>. Pour activer l’accès sécurisé à Firestore, veuillez confirmer votre adresse email.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleResendVerification}
                  className="w-full h-9 rounded-lg bg-[#19283E] text-xs font-medium text-white hover:bg-[#223552] transition-colors disabled:opacity-50"
                >
                  Envoyer l’email de vérification
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleRefreshVerification}
                  className="w-full h-9 rounded-lg border border-[#19283E] bg-white text-xs font-medium text-[#19283E] hover:bg-slate-50 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  J’ai vérifié mon email — Actualiser
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setErrorMsg(null);
                    setInfoMsg(null);
                    void logout();
                  }}
                  className="w-full h-8 text-xs font-medium text-slate-600 hover:text-[#19283E]"
                >
                  Changer de compte
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleEmailLogin} className="space-y-4" noValidate>
              <div>
                <label
                  htmlFor="login-email"
                  className="block text-xs font-medium text-[#19283E] mb-1.5"
                >
                  Adresse email professionnelle
                </label>
                <div className="relative">
                  <Mail className="h-4 w-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (authAccessError) clearAuthAccessError();
                    }}
                    placeholder="nom@arena-group.fr"
                    className="w-full h-10 rounded-lg border border-[#E1E4EA] pl-9 pr-3 text-sm text-[#19283E] focus:border-[#C9A125] focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="block text-xs font-medium text-[#19283E] mb-1.5"
                >
                  Mot de passe
                </label>
                <div className="relative">
                  <Lock className="h-4 w-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  <input
                    id="login-password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (authAccessError) clearAuthAccessError();
                    }}
                    placeholder="••••••••"
                    className="w-full h-10 rounded-lg border border-[#E1E4EA] pl-9 pr-3 text-sm text-[#19283E] focus:border-[#C9A125] focus:outline-none"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !firebaseAvailable}
                className="w-full h-10 rounded-lg bg-[#19283E] text-sm font-medium text-white hover:bg-[#223552] transition-colors disabled:opacity-50"
              >
                {loading ? 'Connexion en cours...' : 'Se connecter'}
              </button>
            </form>
          )}

          {showDemoOption && (
            <div className="mt-6 pt-6 border-t border-[#E1E4EA]">
              <p className="text-xs text-slate-600 mb-3">
                Vous souhaitez tester immédiatement les fonctionnalités multi-entités avec un jeu de données de démonstration ?
              </p>
              <button
                type="button"
                onClick={() => enterDemoMode()}
                className="w-full h-10 rounded-lg border border-[#C9A125] bg-[#C9A125]/15 text-sm font-semibold text-[#19283E] hover:bg-[#C9A125]/25 transition-colors flex items-center justify-center gap-2"
              >
                Accéder à la démo interactive
                <ArrowRight className="h-4 w-4 text-[#AD7300]" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
