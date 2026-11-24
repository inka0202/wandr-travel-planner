import { createBrowserRouter } from 'react-router-dom';
import RootLayout from '@/components/layout/RootLayout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import HomePage from '@/pages/HomePage';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import SearchResultsPage from '@/pages/SearchResultsPage';
import DashboardPage from '@/pages/DashboardPage';
import TripPage from '@/pages/TripPage';
import ProfilePage from '@/pages/ProfilePage';
import NotFoundPage from '@/pages/NotFoundPage';
import ErrorPage from '@/pages/ErrorPage';

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    // The layout itself failed: no navbar, so the error page brings its own <main>.
    errorElement: <ErrorPage standalone />,
    children: [
      {
        // A page failed: the error shows inside the layout, navbar and footer stay.
        errorElement: <ErrorPage />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'login', element: <LoginPage /> },
          { path: 'register', element: <RegisterPage /> },
          { path: 'search', element: <SearchResultsPage /> },
          {
            element: <ProtectedRoute />,
            children: [
              { path: 'trips', element: <DashboardPage /> },
              { path: 'trips/:id', element: <TripPage /> },
              { path: 'profile', element: <ProfilePage /> },
            ],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
