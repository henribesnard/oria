import { Outlet } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';

export function AdminShell() {
  return (
    <div className="flex min-h-dvh bg-[#F4F3F9]">
      <AdminSidebar />
      <main className="flex-1 min-h-dvh overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
