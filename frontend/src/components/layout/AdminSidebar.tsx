import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const navItems = [
  { to: '/admin', label: "Vue d'ensemble", end: true },
  { to: '/admin/traces', label: 'Traces' },
  { to: '/admin/users', label: 'Utilisateurs' },
];

export function AdminSidebar() {
  const { logout } = useAuth();

  return (
    <aside className="w-[248px] min-h-dvh bg-admin-bg flex flex-col p-[18px_14px]">
      <div className="mb-6 px-3 flex items-center gap-2">
        <h1 className="font-serif text-[20px] text-white">Oria</h1>
        <span className="text-[10px] font-bold tracking-[.8px] uppercase text-primary-muted border border-[#3A3556] rounded-md px-2 py-0.5">
          Admin
        </span>
      </div>
      <nav className="flex-1 flex flex-col gap-1">
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
      <div className="border-t border-admin-border pt-3 mt-3 flex flex-col gap-1">
        <NavLink
          to="/app"
          className="flex items-center gap-3 px-3 py-[10px] rounded-[11px] text-sm font-semibold text-[#8B85A6] hover:bg-admin-hover"
        >
          {'\u2190'} Retour à l'app
        </NavLink>
        <button
          onClick={() => void logout()}
          className="flex items-center gap-3 px-3 py-[10px] rounded-[11px] text-sm font-semibold text-[#8B85A6] hover:bg-admin-hover w-full text-left"
        >
          {'\u{1F6AA}'} Déconnexion
        </button>
      </div>
    </aside>
  );
}
