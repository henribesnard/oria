import { createBrowserRouter } from 'react-router-dom';
import { RootLayout } from './components/RootLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminRoute } from './components/AdminRoute';
import { AppShell } from './components/layout/AppShell';
import { AdminShell } from './components/layout/AdminShell';
import { PublicLayout } from './components/layout/PublicLayout';

import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Chat } from './pages/Chat';
import { Follows } from './pages/Follows';
import { Notifications } from './pages/Notifications';
import { Profile } from './pages/Profile';
import { Billing } from './pages/Billing';
import { Onboarding } from './pages/Onboarding';
import { AdminOverview } from './pages/admin/Overview';
import { AdminTraces } from './pages/admin/Traces';
import { AdminUsers } from './pages/admin/Users';

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        element: <PublicLayout />,
        children: [
          { path: '/', element: <Landing /> },
          { path: '/login', element: <Login /> },
          { path: '/register', element: <Register /> },
          { path: '/onboarding', element: <Onboarding /> },
        ],
      },
      {
        path: '/app',
        element: <ProtectedRoute />,
        children: [
          {
            element: <AppShell />,
            children: [
              { index: true, element: <Chat /> },
              { path: 'follows', element: <Follows /> },
              { path: 'notifications', element: <Notifications /> },
              { path: 'profile', element: <Profile /> },
              { path: 'billing', element: <Billing /> },
            ],
          },
        ],
      },
      {
        path: '/admin',
        element: <AdminRoute />,
        children: [
          {
            element: <AdminShell />,
            children: [
              { index: true, element: <AdminOverview /> },
              { path: 'traces', element: <AdminTraces /> },
              { path: 'users', element: <AdminUsers /> },
            ],
          },
        ],
      },
    ],
  },
]);
