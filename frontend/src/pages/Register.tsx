import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function Register() {
  const { user, register } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/app" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(email, password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'inscription");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100dvh-56px)] px-6">
      <div className="w-full max-w-[440px] bg-surface-card rounded-2xl border border-border-light p-8">
        <h1 className="text-xl font-bold font-serif text-text-strong mb-1">Cr&eacute;er ton compte</h1>
        <p className="text-sm text-text-secondary mb-6">
          Gratuit, sans carte bancaire.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* OAuth buttons */}
        <div className="flex flex-col gap-3 mb-5">
          <button
            type="button"
            className="flex items-center justify-center gap-3 h-[44px] w-full rounded-[11px] border border-border-light bg-white text-sm font-semibold text-text-dark hover:bg-gray-50 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Continuer avec Google
          </button>
          <button
            type="button"
            className="flex items-center justify-center gap-3 h-[44px] w-full rounded-[11px] border border-border-light bg-white text-sm font-semibold text-text-dark hover:bg-gray-50 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path d="M15.23 14.18a9.5 9.5 0 01-.937 1.69c-.493.703-.897 1.19-1.207 1.46-.482.447-1 .676-1.554.69-.397 0-.877-.113-1.436-.342s-1.073-.342-1.543-.342c-.493 0-1.022.114-1.587.342S5.99 18.018 5.53 18.027c-.53.018-1.06-.217-1.587-.709-.336-.296-.756-.803-1.26-1.523-.54-.767-.983-1.657-1.33-2.672C.945 11.894.742 10.7.742 9.54c0-1.318.285-2.454.854-3.403.448-.762 1.043-1.363 1.788-1.803a4.82 4.82 0 012.417-.68c.42 0 .972.13 1.658.385.684.256 1.122.386 1.315.386.145 0 .634-.152 1.466-.455.786-.28 1.45-.397 1.992-.353 1.473.119 2.58.7 3.317 1.746-1.317.798-1.968 1.915-1.955 3.347.013 1.115.416 2.043 1.21 2.78.36.342.762.605 1.208.793-.097.282-.2.552-.308.812zM12.4.37c0 .874-.32 1.69-.957 2.444-.768.9-1.698 1.42-2.706 1.338a2.724 2.724 0 01-.02-.332c0-.84.365-1.738.014-2.483C9.363.623 10.186.182 10.653 0c.148-.012.272-.018.372-.018.379 0 .868.136 1.375.388z" fill="#000"/>
            </svg>
            Continuer avec Apple
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-border-light" />
          <span className="text-xs text-text-secondary">ou</span>
          <div className="flex-1 h-px bg-border-light" />
        </div>

        {/* Registration form */}
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="display_name" className="text-[13px] font-semibold text-text-dark">
              Nom
            </label>
            <input
              id="display_name"
              type="text"
              placeholder="Votre nom"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              className="h-[44px] px-[13px] rounded-[11px] border border-border-light bg-surface-alt text-sm text-text placeholder:text-text-faint focus:outline-none focus:border-primary-soft transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-[13px] font-semibold text-text-dark">
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="vous@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-[44px] px-[13px] rounded-[11px] border border-border-light bg-surface-alt text-sm text-text placeholder:text-text-faint focus:outline-none focus:border-primary-soft transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-[13px] font-semibold text-text-dark">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              placeholder="Choisissez un mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-[44px] px-[13px] rounded-[11px] border border-border-light bg-surface-alt text-sm text-text placeholder:text-text-faint focus:outline-none focus:border-primary-soft transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="h-[44px] mt-2 bg-primary hover:bg-primary-hover text-white text-sm font-bold rounded-[11px] transition-colors disabled:opacity-50"
          >
            {submitting ? 'Cr\u00e9ation...' : 'Cr\u00e9er mon compte'}
          </button>
        </form>

        <p className="text-sm text-text-secondary text-center mt-6">
          D&eacute;j&agrave; un compte ?{' '}
          <Link to="/login" className="text-primary font-semibold hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
