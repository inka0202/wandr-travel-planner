import { MapPin, Heart } from 'lucide-react';
import clsx from 'clsx';

export default function AttractionCard({ attraction, isFavorited, onToggleFavorite }) {
  const km = (attraction.distance / 1000).toFixed(1);

  return (
    <article
      className={clsx(
        'rounded-xl bg-white p-4 shadow-soft transition-all',
        'hover:-translate-y-0.5 hover:shadow-card',
        isFavorited && 'ring-2 ring-orange-200',
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <h3 className="font-serif text-lg leading-tight text-navy-900">{attraction.name}</h3>
        <button
          type="button"
          onClick={() => onToggleFavorite(attraction)}
          aria-label={isFavorited ? 'Unsave attraction' : 'Save attraction'}
          aria-pressed={isFavorited}
          className={clsx(
            'shrink-0 rounded-full p-1.5 transition-colors',
            isFavorited
              ? 'text-orange-600 hover:bg-orange-50'
              : 'text-navy-300 hover:bg-orange-50 hover:text-orange-600',
          )}
        >
          <Heart size={20} fill={isFavorited ? 'currentColor' : 'none'} />
        </button>
      </div>
      <p className="mb-2 text-sm capitalize text-navy-500">{attraction.kind}</p>
      <p className="flex items-center gap-1 text-xs text-navy-500">
        <MapPin size={12} /> {km} km away
      </p>
    </article>
  );
}
