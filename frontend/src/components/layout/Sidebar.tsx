import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import OriaLogo from '../OriaLogo';

const navItems = [
  { to: '/app', label: 'Chat' },
  { to: '/app/follows', label: 'Mes suivis' },
  { to: '/app/notifications', label: 'Notifications' },
  { to: '/app/profile', label: 'Profil' },
  { to: '/app/billing', label: 'Abonnement & facturation' },
];

export function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="app-side bg-surface-card border-r border-border sticky top-0 h-dvh overflow-y-auto flex flex-col p-[18px_14px]">
      <Link to="/" className="flex items-center gap-2.5 px-2 py-1.5 mb-4">
        <OriaLogo size={26} />
        <span className="font-serif text-[23px] leading-none">Oria</span>
      </Link>
      <nav className="app-nav flex-1 flex flex-col gap-0.5">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/app'}
            className={({ isActive }) =>
              `flex items-center text-left px-3 py-[10px] rounded-[11px] text-sm font-semibold whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-purple-surface text-primary-hover'
                  : 'text-text-secondary hover:bg-surface-hover'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="app-nav-foot border-t border-border-inner pt-3 mt-3 flex flex-col gap-0.5">
        {user?.role === 'admin' && (
          <NavLink
            to="/admin"
            className="flex items-center text-left px-3 py-[9px] rounded-[10px] text-[13px] font-semibold text-text-muted hover:bg-surface-hover hover:text-primary-hover transition-colors"
          >
            Console admin →
          </NavLink>
        )}
        <button
          onClick={() => void logout()}
          className="flex items-center text-left px-3 py-[9px] rounded-[10px] text-[13px] font-semibold text-text-muted hover:bg-surface-hover w-full transition-colors"
        >
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
