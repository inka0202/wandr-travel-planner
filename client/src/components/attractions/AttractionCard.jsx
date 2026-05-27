import { MapPin, Heart } from 'lucide-react';
import clsx from 'clsx';

export default function AttractionCard({ attraction, isFavorited, onToggleFavorite }) {
  const km = (attraction.distance / 1000).toFixed(1);

  return (
    <article
      className={clsx(
        'bg-white rounded-xl shadow-soft p-4 transition-all',
        'hover:shadow-card hover:-translate-y-0.5',
        isFavorited && 'ring-2 ring-orange-200',
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="font-serif text-lg text-navy-900 leading-tight">{attraction.name}</h3>
        <button
          type="button"
          onClick={() => onToggleFavorite(attraction)}
          aria-label={isFavorited ? 'Unsave attraction' : 'Save attraction'}
          aria-pressed={isFavorited}
          className={clsx(
            'shrink-0 p-1.5 rounded-full transition-colors',
            isFavorited
              ? 'text-orange-600 hover:bg-orange-50'
              : 'text-navy-300 hover:text-orange-600 hover:bg-orange-50',
          )}
        >
          <Heart size={20} fill={isFavorited ? 'currentColor' : 'none'} />
        </button>
      </div>
      <p className="text-sm text-navy-500 capitalize mb-2">{attraction.kind}</p>
      <p className="text-xs text-navy-400 flex items-center gap-1">
        <MapPin size={12} /> {km} km away
      </p>
    </article>
  );
}
