import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function Register() {
  const { user, register } = useAuth();
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
      <div className="w-full max-w-[400px] bg-surface-card rounded-2xl border border-border p-8">
        <h2 className="text-xl font-bold text-text-strong mb-1">Inscription</h2>
        <p className="text-sm text-text-muted mb-6">
          Créez votre compte Oria
        </p>
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-semibold text-text-dark">
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="vous@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-11 px-4 rounded-xl border border-border bg-surface-alt text-sm text-text placeholder:text-text-faint focus:outline-none focus:border-primary-soft transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-semibold text-text-dark">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              placeholder="Choisissez un mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-11 px-4 rounded-xl border border-border bg-surface-alt text-sm text-text placeholder:text-text-faint focus:outline-none focus:border-primary-soft transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="h-11 mt-2 bg-primary hover:bg-primary-hover text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50"
          >
            {submitting ? 'Création...' : 'Créer mon compte'}
          </button>
        </form>
        <p className="text-sm text-text-muted text-center mt-6">
          Déjà un compte ?{' '}
          <Link to="/login" className="text-primary font-semibold hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
