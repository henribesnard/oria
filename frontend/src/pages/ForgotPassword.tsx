import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/reset', { email });
      setSubmitted(true);
    } catch {
      // The backend always returns ok to prevent email enumeration,
      // so an error here means a network/server issue.
      setError('Une erreur est survenue. Réessaie plus tard.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100dvh-56px)] px-6">
      <div className="w-full max-w-[400px] bg-surface-card rounded-2xl border border-border p-8">
        <h2 className="font-serif font-normal text-xl text-text-strong mb-1">
          Mot de passe oublié
        </h2>
        <p className="text-sm text-text-muted mb-6">
          Saisis ton email pour recevoir un lien.
        </p>

        {submitted ? (
          <div className="mb-4 p-4 rounded-xl bg-purple-surface border border-purple-border text-sm text-text-secondary">
            Si un compte existe pour <strong className="text-text-strong">{email}</strong>,
            tu recevras un lien de réinitialisation par email.
          </div>
        ) : (
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-semibold text-text-dark">
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="toi@exemple.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 px-4 rounded-xl border border-border bg-surface-alt text-sm text-text placeholder:text-text-faint focus:outline-none focus:border-primary-soft transition-colors"
              />
            </div>
            {error && (
              <p className="text-sm text-[#D5443B]">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="h-11 mt-2 bg-primary hover:bg-primary-hover text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50"
            >
              {loading ? 'Envoi…' : 'Envoyer le lien'}
            </button>
          </form>
        )}

        <p className="text-sm text-text-muted text-center mt-6">
          <Link to="/login" className="text-primary font-semibold hover:underline">
            Retour à la connexion
          </Link>
        </p>
      </div>
    </div>
  );
}
