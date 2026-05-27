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
    <article className="bg-white rounded-2xl shadow-card overflow-hidden flex flex-col">
      {/* Visual band — gradient placeholder */}
      <div className="h-32 bg-gradient-to-br from-navy-700 to-navy-900 relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,_rgba(230,126,34,0.4),_transparent_60%)]" />
        <div className="relative h-full flex items-end p-4">
          <h3 className="font-serif text-2xl text-cream leading-tight">{trip.destination.name}</h3>
        </div>
      </div>

      <div className="p-4 flex-1 flex flex-col gap-2">
        {trip.destination.country && (
          <p className="text-xs text-navy-500 flex items-center gap-1">
            <MapPin size={12} /> {trip.destination.country}
          </p>
        )}
        <p className="text-sm text-navy-700 flex items-center gap-1">
          <Calendar size={14} className="text-navy-400" />
          {fmtRange(trip.startDate, trip.endDate)}
        </p>
        <p className="text-xs text-navy-500">
          {trip.savedAttractions?.length || 0} saved attraction
          {trip.savedAttractions?.length === 1 ? '' : 's'}
        </p>

        <div className="mt-auto pt-3 flex items-center justify-between gap-2">
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
              className="text-navy-300 hover:text-red-600 p-1"
            >
              <Trash2 size={16} />
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="text-xs font-medium text-red-700 hover:text-red-800 px-2 py-1"
              >
                {deleting ? '…' : 'Delete'}
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="text-xs text-navy-500 hover:text-navy-700 px-2 py-1"
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
