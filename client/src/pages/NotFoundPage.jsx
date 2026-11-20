import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';

export default function NotFoundPage() {
  return (
    <div className="container mx-auto max-w-md py-24 text-center">
      <p className="mb-2 font-serif text-6xl text-orange-600">404</p>
      <h1 className="mb-3 font-serif text-3xl text-navy-900">Lost your way?</h1>
      <p className="mb-8 text-navy-500">
        This page doesn&apos;t exist — but plenty of destinations do.
      </p>
      <Link to="/">
        <Button variant="primary">Back to planning</Button>
      </Link>
    </div>
  );
}
