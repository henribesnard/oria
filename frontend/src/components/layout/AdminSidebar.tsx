import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const navItems = [
  { to: '/admin', label: "Vue d'ensemble", end: true },
  { to: '/admin/traces', label: 'Traces' },
  { to: '/admin/bottlenecks', label: 'Goulots' },
  { to: '/admin/metrics', label: 'Métriques' },
  { to: '/admin/users', label: 'Utilisateurs' },
];

export function AdminSidebar() {
  const { logout } = useAuth();

  return (
    <aside className="app-side bg-admin-bg text-white sticky top-0 h-dvh overflow-y-auto flex flex-col p-[18px_14px]">
      <div className="flex items-center gap-2.5 px-2 py-1.5 mb-4">
        <svg width="24" height="24" viewBox="0 0 40 40" fill="none" aria-hidden="true">
          <circle cx="20" cy="20" r="15.5" stroke="#9C90F5" strokeWidth="2.8" />
          <path d="M12.5 23.6 L20 15.4 L27.5 23.6" stroke="#9C90F5" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="font-serif text-[20px]">Oria</span>
        <span className="text-[10px] font-bold tracking-[.8px] uppercase text-primary-muted border border-[#3A3556] rounded-md px-[7px] py-[2px]">
          Admin
        </span>
      </div>
      <nav className="app-nav flex flex-col gap-0.5">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-[10px] rounded-[11px] text-sm font-semibold transition-colors ${
                isActive
                  ? 'bg-admin-active text-white'
                  : 'text-admin-text hover:bg-admin-hover'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="app-nav-foot mt-auto pt-3 border-t border-admin-border flex flex-col gap-0.5">
        <NavLink
          to="/app"
          className="flex items-center gap-2 text-left px-3 py-[9px] rounded-[10px] text-[13px] font-semibold text-[#8B85A6] hover:bg-admin-hover hover:text-white w-full transition-colors"
        >
          ← Retour à l'app
        </NavLink>
        <button
          onClick={() => void logout()}
          className="flex items-center gap-2 text-left px-3 py-[9px] rounded-[10px] text-[13px] font-semibold text-[#8B85A6] hover:bg-admin-hover hover:text-white w-full transition-colors"
        >
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
