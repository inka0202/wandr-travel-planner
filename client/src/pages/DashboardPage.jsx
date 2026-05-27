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
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-serif text-3xl sm:text-4xl text-navy-900">Your trips</h1>
        <Link to="/">
          <Button variant="primary">
            <Plus size={16} className="inline mr-1" /> New trip
          </Button>
        </Link>
      </div>

      {isLoading && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-card h-64 animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <div className="text-center py-12">
          <p className="text-red-700 mb-4">Couldn&apos;t load your trips.</p>
          <Button variant="secondary" onClick={refetch}>
            Try again
          </Button>
        </div>
      )}

      {!isLoading && !error && trips.length === 0 && (
        <div className="text-center py-16 max-w-md mx-auto">
          <h2 className="font-serif text-xl text-navy-900 mb-2">No trips yet</h2>
          <p className="text-navy-500 mb-6">
            Start by searching for a destination — you can save trips you like and come back to
            them anytime.
          </p>
          <Link to="/">
            <Button variant="primary">Plan your first trip</Button>
          </Link>
        </div>
      )}

      {!isLoading && !error && trips.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {trips.map((trip) => (
            <TripCard key={trip._id} trip={trip} onDeleted={handleDeleted} />
          ))}
        </div>
      )}
    </div>
  );
}
