import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export function AppShell() {
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <main className="flex-1 min-h-dvh overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
