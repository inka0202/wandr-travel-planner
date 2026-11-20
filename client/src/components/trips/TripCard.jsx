import { Link } from 'react-router-dom';
import { MapPin, Calendar, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { deleteTrip as deleteTripApi } from '@/api/trips';

const fmtRange = (start, end) => {
  const s = new Date(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const e = new Date(end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${s} — ${e}`;
};

export default function TripCard({ trip, onDeleted }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteTripApi(trip._id);
      onDeleted?.(trip._id);
    } catch {
      setDeleting(false);
      setConfirming(false);
    }
  };

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-card">
      {/* Visual band — gradient placeholder */}
      <div className="relative h-32 bg-gradient-to-br from-navy-700 to-navy-900">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,_rgba(230,126,34,0.4),_transparent_60%)]" />
        <div className="relative flex h-full items-end p-4">
          <h3 className="font-serif text-2xl leading-tight text-cream">{trip.destination.name}</h3>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        {trip.destination.country && (
          <p className="flex items-center gap-1 text-xs text-navy-500">
            <MapPin size={12} /> {trip.destination.country}
          </p>
        )}
        <p className="flex items-center gap-1 text-sm text-navy-700">
          <Calendar size={14} className="text-navy-400" />
          {fmtRange(trip.startDate, trip.endDate)}
        </p>
        <p className="text-xs text-navy-500">
          {trip.savedAttractions?.length || 0} saved attraction
          {trip.savedAttractions?.length === 1 ? '' : 's'}
        </p>

        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <Link
            to={`/trips/${trip._id}`}
            className="text-sm font-medium text-orange-700 hover:text-orange-800"
          >
            View trip →
          </Link>
          {!confirming ? (
            <button
              onClick={() => setConfirming(true)}
              aria-label="Delete trip"
              className="p-1 text-navy-300 hover:text-red-600"
            >
              <Trash2 size={16} />
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-2 py-1 text-xs font-medium text-red-700 hover:text-red-800"
              >
                {deleting ? '…' : 'Delete'}
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="px-2 py-1 text-xs text-navy-500 hover:text-navy-700"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
