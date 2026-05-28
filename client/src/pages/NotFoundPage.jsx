import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';

export default function NotFoundPage() {
  return (
    <div className="container py-24 text-center max-w-md mx-auto">
      <p className="font-serif text-6xl text-orange-600 mb-2">404</p>
      <h1 className="font-serif text-3xl text-navy-900 mb-3">Lost your way?</h1>
      <p className="text-navy-500 mb-8">
        This page doesn&apos;t exist — but plenty of destinations do.
      </p>
      <Link to="/">
        <Button variant="primary">Back to planning</Button>
      </Link>
    </div>
  );
}
