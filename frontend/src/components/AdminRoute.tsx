import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function AdminRoute() {
  const { user, loading } = useAuth();

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <div className="animate-[oria-pulse_1.5s_ease-in-out_infinite] font-serif text-2xl text-primary">
          Oria
        </div>
      </div>
    );

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/app" replace />;

  return <Outlet />;
}
