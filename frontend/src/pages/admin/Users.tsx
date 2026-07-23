import { useState, useEffect, useCallback } from 'react';
import { listUsers, updateUser } from '../../api/admin';
import type { AdminUser } from '../../api/admin';

export function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listUsers(offset, limit);
      setUsers(res.users);
      setTotal(res.total);
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, [offset]);

  useEffect(() => {
    void load();
  }, [load]);

  const startEdit = (user: AdminUser) => {
    if (editingId === user.user_id) {
      setEditingId(null);
      return;
    }
    setEditingId(user.user_id);
    setEditRole(user.role);
    setEditStatus(user.status);
  };

  const saveUser = async () => {
    if (!editingId) return;
    try {
      const updated = await updateUser(editingId, { role: editRole, status: editStatus });
      setUsers(prev => prev.map(u => (u.user_id === editingId ? updated : u)));
      setEditingId(null);
    } catch {
      /* ignore */
    }
  };

  const roleBadge = (role: string) => {
    if (role === 'admin') return 'text-primary bg-purple-surface';
    return 'text-text-muted bg-surface-muted';
  };

  const statusBadge = (status: string) => {
    if (status === 'active') return 'text-success-text bg-success-surface';
    if (status === 'suspended') return 'text-danger-text bg-danger-surface';
    return 'text-text-muted bg-surface-muted';
  };

  return (
    <div className="max-w-[1080px] mx-auto px-7 py-8">
      <h1 className="text-xl font-bold text-text-strong mb-1">Utilisateurs</h1>
      <p className="text-sm text-text-muted mb-8">Gestion des comptes utilisateurs</p>

      <div className="bg-surface-card rounded-2xl border border-border overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_1fr_120px_100px] gap-4 px-5 py-3 border-b border-border-inner text-xs font-semibold text-text-muted uppercase tracking-wide">
          <span>Email</span>
          <span>ID</span>
          <span>R&ocirc;le</span>
          <span>Statut</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-[oria-pulse_1.5s_ease-in-out_infinite] font-serif text-2xl text-primary">
              O
            </div>
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-text-muted">Aucun utilisateur pour le moment.</p>
          </div>
        ) : (
          <div>
            {users.map(u => (
              <div key={u.user_id}>
                <button
                  onClick={() => startEdit(u)}
                  className="w-full grid grid-cols-[1fr_1fr_120px_100px] gap-4 px-5 py-3 text-left hover:bg-surface-hover transition-colors border-b border-border-inner"
                >
                  <span className="text-sm text-text-dark truncate">{u.email}</span>
                  <span className="text-xs font-mono text-text-muted truncate">
                    {u.user_id}
                  </span>
                  <span
                    className={`self-center inline-block w-fit px-2 py-0.5 rounded-md text-[11px] font-bold ${roleBadge(u.role)}`}
                  >
                    {u.role}
                  </span>
                  <span
                    className={`self-center inline-block w-fit px-2 py-0.5 rounded-md text-[11px] font-bold ${statusBadge(u.status)}`}
                  >
                    {u.status}
                  </span>
                </button>
                {editingId === u.user_id && (
                  <div className="px-5 py-4 bg-surface-alt border-b border-border-inner flex items-end gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-text-muted">
                        R&ocirc;le
                      </label>
                      <select
                        value={editRole}
                        onChange={e => setEditRole(e.target.value)}
                        className="h-9 px-3 rounded-lg border border-border bg-surface-card text-sm text-text"
                      >
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-text-muted">Statut</label>
                      <select
                        value={editStatus}
                        onChange={e => setEditStatus(e.target.value)}
                        className="h-9 px-3 rounded-lg border border-border bg-surface-card text-sm text-text"
                      >
                        <option value="active">active</option>
                        <option value="suspended">suspended</option>
                        <option value="deleted">deleted</option>
                      </select>
                    </div>
                    <button
                      onClick={() => void saveUser()}
                      className="h-9 px-4 bg-primary hover:bg-primary-hover text-white text-sm font-bold rounded-lg transition-colors"
                    >
                      Sauver
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="h-9 px-4 text-sm font-semibold text-text-secondary hover:text-text-dark"
                    >
                      Annuler
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {total > limit && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border-inner">
            <span className="text-xs text-text-muted">
              {offset + 1}&ndash;{Math.min(offset + limit, total)} sur {total}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
                className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-text-secondary disabled:opacity-40"
              >
                Pr&eacute;c&eacute;dent
              </button>
              <button
                onClick={() => setOffset(offset + limit)}
                disabled={offset + limit >= total}
                className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-text-secondary disabled:opacity-40"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
