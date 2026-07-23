import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const navItems = [
  { to: '/app', label: 'Chat', icon: '\u{1F4AC}' },
  { to: '/app/follows', label: 'Mes suivis', icon: '\u2B50' },
  { to: '/app/notifications', label: 'Notifications', icon: '\u{1F514}' },
  { to: '/app/profile', label: 'Profil', icon: '\u{1F464}' },
  { to: '/app/billing', label: 'Abonnement', icon: '\u{1F48E}' },
];

export function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="w-[248px] min-h-dvh border-r border-border bg-surface-card flex flex-col p-[18px_14px]">
      <div className="mb-6 px-3">
        <h1 className="font-serif text-[23px] text-text-strong">Oria</h1>
      </div>
      <nav className="flex-1 flex flex-col gap-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/app'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-[10px] rounded-[11px] text-sm font-semibold transition-colors ${
                isActive
                  ? 'bg-purple-surface text-primary-hover'
                  : 'text-text-secondary hover:bg-surface-hover'
              }`
            }
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-border-inner pt-3 mt-3 flex flex-col gap-1">
        {user?.role === 'admin' && (
          <NavLink
            to="/admin"
            className="flex items-center gap-3 px-3 py-[10px] rounded-[11px] text-sm font-semibold text-text-secondary hover:bg-surface-hover"
          >
            <span className="text-base">{'\u2699\uFE0F'}</span>
            Admin
          </NavLink>
        )}
        <button
          onClick={() => void logout()}
          className="flex items-center gap-3 px-3 py-[10px] rounded-[11px] text-sm font-semibold text-text-secondary hover:bg-surface-hover w-full text-left"
        >
          <span className="text-base">{'\u{1F6AA}'}</span>
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
