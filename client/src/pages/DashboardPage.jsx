import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useFetch } from '@/hooks/useFetch';
import { listTrips } from '@/api/trips';
import TripCard from '@/components/trips/TripCard';
import { Button } from '@/components/ui/Button';

export default function DashboardPage() {
  const { data, isLoading, error, refetch } = useFetch(listTrips, []);
  const [trips, setTrips] = useState([]);

  useEffect(() => {
    if (data) setTrips(data);
  }, [data]);

  const handleDeleted = (id) => {
    setTrips((current) => current.filter((t) => t._id !== id));
  };

  return (
    <div className="container py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-serif text-3xl text-navy-900 sm:text-4xl">Your trips</h1>
        <Link to="/">
          <Button variant="primary">
            <Plus size={16} className="mr-1 inline" /> New trip
          </Button>
        </Link>
      </div>

      {isLoading && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-2xl bg-white shadow-card" />
          ))}
        </div>
      )}

      {error && (
        <div className="py-12 text-center">
          <p className="mb-4 text-red-700">Couldn&apos;t load your trips.</p>
          <Button variant="secondary" onClick={refetch}>
            Try again
          </Button>
        </div>
      )}

      {!isLoading && !error && trips.length === 0 && (
        <div className="mx-auto max-w-md py-16 text-center">
          <h2 className="mb-2 font-serif text-xl text-navy-900">No trips yet</h2>
          <p className="mb-6 text-navy-500">
            Start by searching for a destination — you can save trips you like and come back to them
            anytime.
          </p>
          <Link to="/">
            <Button variant="primary">Plan your first trip</Button>
          </Link>
        </div>
      )}

      {!isLoading && !error && trips.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {trips.map((trip) => (
            <TripCard key={trip._id} trip={trip} onDeleted={handleDeleted} />
          ))}
        </div>
      )}
    </div>
  );
}
