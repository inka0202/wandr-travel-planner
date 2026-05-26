import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';

export default function Navbar() {
  const { user, isLoading, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  return (
    <header className="sticky top-0 z-30 border-b border-navy-100 bg-cream/90 backdrop-blur">
      <nav className="container flex h-16 items-center justify-between">
        <Link to="/" className="font-serif text-2xl text-navy-900">
          Wandr
        </Link>

        <div className="flex items-center gap-4">
          {!isLoading && user && (
            <>
              <NavLink
                to="/trips"
                className={({ isActive }) =>
                  `text-sm font-medium ${isActive ? 'text-orange-700' : 'text-navy-600 hover:text-navy-900'}`
                }
              >
                My trips
              </NavLink>
              <span className="hidden text-sm text-navy-500 sm:inline">
                {user.displayName || user.email}
              </span>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                Log out
              </Button>
            </>
          )}

          {!isLoading && !user && (
            <>
              <Link
                to="/login"
                className="text-sm font-medium text-navy-600 hover:text-navy-900"
              >
                Log in
              </Link>
              <Link to="/register">
                <Button variant="primary" size="sm">Sign up</Button>
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
