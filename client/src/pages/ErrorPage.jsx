import { Link, isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { buttonClasses } from '@/components/ui/buttonClasses';

/**
 * The router's errorElement: replaces React Router's developer error screen.
 * Production never shows the error message or stack; `import.meta.env.DEV` is false there,
 * so Vite drops the details from the build.
 *
 * `standalone`: rendered at the root, without RootLayout (the layout itself crashed),
 * so it brings its own <main>. Inside the layout, RootLayout already has one.
 */
export default function ErrorPage({ standalone = false }) {
  const error = useRouteError();

  const content = (
    <div className="container mx-auto max-w-md py-24 text-center">
      <h1 className="mb-3 font-serif text-3xl text-navy-900">Something went wrong</h1>
      <p className="mb-8 text-navy-500">
        This page couldn&apos;t be shown. Please try again from the home page.
      </p>
      {import.meta.env.DEV && <ErrorDetails error={error} />}
      {/* A full page load, so whatever state broke the page starts fresh */}
      <Link to="/" reloadDocument className={buttonClasses()}>
        Go home
      </Link>
    </div>
  );

  return standalone ? <main id="main">{content}</main> : content;
}

// Development only.
function ErrorDetails({ error }) {
  const summary = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : String(error);
  return (
    <pre className="mb-8 overflow-x-auto rounded-lg bg-white p-4 text-left text-xs text-red-700 shadow-soft">
      {summary}
      {error instanceof Error && error.stack ? `\n\n${error.stack}` : ''}
    </pre>
  );
}
