import { Outlet } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';

export function AdminShell() {
  return (
    <div className="app-shell bg-[#F4F3F9]">
      <AdminSidebar />
      <main className="app-main overflow-y-auto max-h-dvh">
        <Outlet />
      </main>
    </div>
  );
}
