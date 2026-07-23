import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api/client';
import {
  getNotificationSettings,
  updateNotificationSettings,
  clearConversations,
} from '../api/settings';
import type { NotificationSettings } from '../api/settings';

export function Profile() {
  const { user, logout } = useAuth();
  const [displayName, setDisplayName] = useState(user?.display_name ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [notifSettings, setNotifSettings] = useState<NotificationSettings | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    getNotificationSettings().then(setNotifSettings).catch(() => {});
  }, []);

  const saveProfile = async () => {
    setSaving(true);
    try {
      await api.patch('/me', { display_name: displayName || null });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      /* ignore */
    }
    setSaving(false);
  };

  const toggleNotif = async (key: keyof NotificationSettings, value: boolean) => {
    try {
      const updated = await updateNotificationSettings({ [key]: value });
      setNotifSettings(updated);
    } catch {
      /* ignore */
    }
  };

  const handleClearHistory = async () => {
    await clearConversations();
  };

  const handleDeleteAccount = async () => {
    await api.del('/me');
    logout();
  };

  return (
    <div className="max-w-[560px] mx-auto px-7 py-10">
      <h1 className="text-xl font-bold text-text-strong mb-1">Profil</h1>
      <p className="text-sm text-text-muted mb-8">Ge&#769;rez vos informations personnelles</p>

      {/* Profile card */}
      <div className="bg-surface-card rounded-2xl border border-border p-6 mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-purple-surface flex items-center justify-center">
            <span className="font-serif text-2xl text-primary">
              {(user?.display_name ?? user?.email ?? 'U')[0].toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-sm font-bold text-text-strong">
              {user?.display_name ?? 'Utilisateur'}
            </p>
            <p className="text-sm text-text-muted">{user?.email}</p>
          </div>
          <span className="ml-auto px-2.5 py-1 text-[11px] font-bold rounded-full bg-purple-surface text-primary uppercase">
            {user?.role ?? 'user'}
          </span>
        </div>

        <div className="border-t border-border-inner pt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-text-dark">Nom d&apos;affichage</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Votre nom"
                className="flex-1 h-10 px-4 rounded-xl border border-border bg-surface-alt text-sm text-text placeholder:text-text-faint focus:outline-none focus:border-primary-soft transition-colors"
              />
              <button
                onClick={saveProfile}
                disabled={saving}
                className="h-10 px-4 bg-primary hover:bg-primary-hover text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50"
              >
                {saved ? '\u2713' : saving ? '...' : 'Sauver'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Notification settings */}
      {notifSettings && (
        <div className="bg-surface-card rounded-2xl border border-border p-6 mb-6">
          <h2 className="text-sm font-bold text-text-strong mb-4">Notifications</h2>
          <div className="flex flex-col gap-3">
            {(
              [
                {
                  key: 'prematch' as const,
                  label: 'Avant-match',
                  desc: 'Rappel avant le coup d\u2019envoi',
                },
                {
                  key: 'result' as const,
                  label: 'R\u00e9sultats',
                  desc: 'Score final des matchs suivis',
                },
                {
                  key: 'lineup' as const,
                  label: 'Compositions',
                  desc: 'Annonce des titulaires',
                },
                {
                  key: 'live_goal' as const,
                  label: 'Buts en direct',
                  desc: 'Notification imm\u00e9diate lors d\u2019un but',
                },
                {
                  key: 'digest' as const,
                  label: 'R\u00e9sum\u00e9 quotidien',
                  desc: 'Synth\u00e8se de la journ\u00e9e',
                },
              ] as const
            ).map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-semibold text-text-dark">{label}</p>
                  <p className="text-xs text-text-muted">{desc}</p>
                </div>
                <button
                  onClick={() => toggleNotif(key, !(notifSettings[key] as boolean))}
                  className={`w-11 h-6 rounded-full transition-colors relative ${
                    notifSettings[key] ? 'bg-primary' : 'bg-border'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      notifSettings[key] ? 'translate-x-[22px]' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>

          {/* Quiet hours */}
          <div className="border-t border-border-inner mt-4 pt-4">
            <p className="text-sm font-semibold text-text-dark mb-2">Heures calmes</p>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={notifSettings.quiet_start}
                onChange={(e) => {
                  const v = e.target.value;
                  updateNotificationSettings({ quiet_start: v })
                    .then(setNotifSettings)
                    .catch(() => {});
                }}
                className="h-10 px-3 rounded-xl border border-border bg-surface-alt text-sm text-text focus:outline-none focus:border-primary-soft"
              />
              <span className="text-sm text-text-muted">{'\u00e0'}</span>
              <input
                type="time"
                value={notifSettings.quiet_end}
                onChange={(e) => {
                  const v = e.target.value;
                  updateNotificationSettings({ quiet_end: v })
                    .then(setNotifSettings)
                    .catch(() => {});
                }}
                className="h-10 px-3 rounded-xl border border-border bg-surface-alt text-sm text-text focus:outline-none focus:border-primary-soft"
              />
            </div>
          </div>
        </div>
      )}

      {/* Danger zone */}
      <div className="bg-surface-card rounded-2xl border border-danger/20 p-6">
        <h2 className="text-sm font-bold text-danger-text mb-4">Zone de danger</h2>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-text-dark">
                Historique des conversations
              </p>
              <p className="text-xs text-text-muted">
                Supprime tout l&apos;historique de chat
              </p>
            </div>
            <button
              onClick={handleClearHistory}
              className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-warning-text hover:bg-warning-surface transition-colors"
            >
              Effacer
            </button>
          </div>
          <div className="border-t border-border-inner" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-text-dark">Supprimer le compte</p>
              <p className="text-xs text-text-muted">
                Action irr&eacute;versible, toutes vos donn&eacute;es seront supprim&eacute;es
              </p>
            </div>
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="px-3 py-1.5 rounded-lg border border-danger/30 text-xs font-semibold text-danger-text hover:bg-danger-surface transition-colors"
              >
                Supprimer
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-text-secondary"
                >
                  Annuler
                </button>
                <button
                  onClick={handleDeleteAccount}
                  className="px-3 py-1.5 rounded-lg bg-danger text-white text-xs font-bold"
                >
                  Confirmer
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
