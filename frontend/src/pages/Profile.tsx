import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api/client';
import {
  getNotificationSettings,
  updateNotificationSettings,
  clearConversations,
} from '../api/settings';
import type { NotificationSettings } from '../api/settings';

const TIMEZONES = [
  'Europe/Paris',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Rome',
  'America/New_York',
  'America/Los_Angeles',
  'Asia/Tokyo',
];

const LANGUAGES = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' },
];

export function Profile() {
  const { user, logout } = useAuth();
  const [displayName, setDisplayName] = useState(user?.display_name ?? '');
  const [language, setLanguage] = useState('fr');
  const [timezone, setTimezone] = useState('Europe/Paris');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [notifSettings, setNotifSettings] = useState<NotificationSettings | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordSaved, setPasswordSaved] = useState(false);

  useEffect(() => {
    getNotificationSettings()
      .then((s) => {
        setNotifSettings(s);
        if (s.timezone) setTimezone(s.timezone);
      })
      .catch(() => {});
  }, []);

  const saveProfile = async () => {
    setSaving(true);
    try {
      await api.patch('/me', { display_name: displayName || null });
      if (notifSettings) {
        await updateNotificationSettings({ timezone });
      }
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

  const handleChangePassword = async () => {
    if (newPassword.length < 8) return;
    try {
      await api.post('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPasswordSaved(true);
      setCurrentPassword('');
      setNewPassword('');
      setChangingPassword(false);
      setTimeout(() => setPasswordSaved(false), 3000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="max-w-[560px] mx-auto px-7 py-10">
      <h1
        className="font-serif text-text-strong mb-1"
        style={{ fontSize: 'clamp(26px, 6vw, 34px)' }}
      >
        Profil
      </h1>
      <p className="text-sm text-text-muted mb-8">Gère tes informations personnelles</p>

      {/* Profile card */}
      <div className="bg-surface-card rounded-2xl border border-border p-6 mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div
            className="w-[60px] h-[60px] rounded-2xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #5B4FD6, #8A6CF0)' }}
          >
            <span className="font-serif text-2xl text-white">
              {(user?.display_name ?? user?.email ?? 'U')[0].toUpperCase()}
            </span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-text-strong">
              {user?.display_name ?? 'Utilisateur'}
            </p>
            <p className="text-sm text-text-muted">{user?.email}</p>
          </div>
          <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-purple-surface text-primary uppercase">
            {user?.role ?? 'user'}
          </span>
        </div>

        <div className="border-t border-border-inner pt-4 flex flex-col gap-4">
          {/* Name & Email in grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-text-dark">Nom d'affichage</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ton nom"
                className="h-10 px-4 rounded-xl border border-border bg-surface-alt text-sm text-text placeholder:text-text-faint focus:outline-none focus:border-primary-soft transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-text-dark">Email</label>
              <input
                type="email"
                value={user?.email ?? ''}
                disabled
                className="h-10 px-4 rounded-xl border border-border bg-surface-muted text-sm text-text-muted cursor-not-allowed"
              />
            </div>
          </div>

          {/* Language & Timezone in grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-text-dark">Langue</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="h-10 px-4 rounded-xl border border-border bg-surface-alt text-sm text-text focus:outline-none focus:border-primary-soft transition-colors cursor-pointer"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-text-dark">Fuseau horaire</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="h-10 px-4 rounded-xl border border-border bg-surface-alt text-sm text-text focus:outline-none focus:border-primary-soft transition-colors cursor-pointer"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={saveProfile}
            disabled={saving}
            className="h-10 w-full bg-primary hover:bg-primary-hover text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50 mt-1"
          >
            {saved ? 'Enregistré ✓' : saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>

      {/* Change password */}
      <div className="bg-surface-card rounded-2xl border border-border p-6 mb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-text-strong">Mot de passe</h2>
          {passwordSaved && (
            <span className="text-xs text-success-text font-semibold">Mot de passe modifié ✓</span>
          )}
        </div>

        {!changingPassword ? (
          <button
            onClick={() => setChangingPassword(true)}
            className="mt-3 px-4 py-2 rounded-xl border border-border text-sm font-semibold text-text-secondary hover:bg-surface-hover transition-colors"
          >
            Changer le mot de passe
          </button>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Mot de passe actuel"
              className="h-10 px-4 rounded-xl border border-border bg-surface-alt text-sm text-text placeholder:text-text-faint focus:outline-none focus:border-primary-soft transition-colors"
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Nouveau mot de passe (min. 8 caractères)"
              className="h-10 px-4 rounded-xl border border-border bg-surface-alt text-sm text-text placeholder:text-text-faint focus:outline-none focus:border-primary-soft transition-colors"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setChangingPassword(false); setCurrentPassword(''); setNewPassword(''); }}
                className="h-10 px-4 rounded-xl border border-border text-sm font-semibold text-text-secondary hover:bg-surface-hover transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleChangePassword}
                disabled={newPassword.length < 8}
                className="h-10 px-4 bg-primary hover:bg-primary-hover text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50"
              >
                Confirmer
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Notification settings */}
      {notifSettings && (
        <div className="bg-surface-card rounded-2xl border border-border p-6 mb-6">
          <h2 className="text-sm font-bold text-text-strong mb-4">Notifications</h2>
          <div className="flex flex-col gap-3">
            {(
              [
                { key: 'prematch' as const, label: 'Avant-match', desc: 'Rappel avant le coup d\u2019envoi' },
                { key: 'result' as const, label: 'Résultats', desc: 'Score final des matchs suivis' },
                { key: 'lineup' as const, label: 'Compositions', desc: 'Annonce des titulaires' },
                { key: 'live_goal' as const, label: 'Buts en direct', desc: 'Notification immédiate lors d\u2019un but' },
                { key: 'digest' as const, label: 'Résumé quotidien', desc: 'Synthèse de la journée' },
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
              <span className="text-sm text-text-muted">à</span>
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
              <p className="text-sm font-semibold text-text-dark">Historique des conversations</p>
              <p className="text-xs text-text-muted">Supprime tout l'historique de chat</p>
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
              <p className="text-xs text-text-muted">Action irréversible, toutes tes données seront supprimées</p>
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
