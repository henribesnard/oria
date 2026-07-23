import { Outlet } from 'react-router-dom';
import { AuthProvider } from '../hooks/useAuth';

export function RootLayout() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}
