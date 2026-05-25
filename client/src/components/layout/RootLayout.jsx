import { Link, NavLink, Outlet } from 'react-router-dom';

export default function RootLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-navy-800 focus:shadow-card"
      >
        Skip to main content
      </a>
      <header className="sticky top-0 z-40 border-b border-navy-100 bg-white shadow-soft">
        <nav className="container flex h-16 items-center justify-between">
          <Link to="/" className="font-serif text-xl font-bold text-navy-900 transition-colors hover:text-navy-700">
            Wandr
          </Link>
          <div className="flex items-center gap-4">
            <NavLink
              to="/login"
              className="text-sm font-medium text-navy-600 transition-colors hover:text-navy-900"
            >
              Log in
            </NavLink>
            <Link
              to="/register"
              className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-orange-700"
            >
              Sign up
            </Link>
          </div>
        </nav>
      </header>
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-navy-100 bg-navy-900 py-8 text-center text-sm text-navy-300">
        <div className="container">© {new Date().getFullYear()} Wandr. All rights reserved.</div>
      </footer>
    </div>
  );
}
