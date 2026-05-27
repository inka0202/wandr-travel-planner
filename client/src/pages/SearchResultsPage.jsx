import { useMemo, useState } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Heart, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useFetch } from '@/hooks/useFetch';
import { getWeather } from '@/api/weather';
import { getAttractions } from '@/api/attractions';
import { createTrip } from '@/api/trips';
import WeatherCard from '@/components/weather/WeatherCard';
import ForecastStrip from '@/components/weather/ForecastStrip';
import AttractionList from '@/components/attractions/AttractionList';
import TripMap from '@/components/map/TripMap';
import { Button } from '@/components/ui/Button';

const fmtRange = (start, end) => {
  const s = new Date(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const e = new Date(end).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${s} — ${e}`;
};

export default function SearchResultsPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const name = params.get('name');
  const country = params.get('country');
  const lat = Number(params.get('lat'));
  const lng = Number(params.get('lng'));
  const tz = params.get('tz') || 'auto';
  const startDate = params.get('start');
  const endDate = params.get('end');

  const hasValidParams =
    name && !Number.isNaN(lat) && !Number.isNaN(lng) && startDate && endDate;

  const weatherState = useFetch(
    () => getWeather({ lat, lng, tz }),
    [lat, lng, tz],
    { skip: !hasValidParams },
  );
  const attractionsState = useFetch(
    () => getAttractions({ lat, lng }),
    [lat, lng],
    { skip: !hasValidParams },
  );

  const [favoritedIds, setFavoritedIds] = useState(new Set());
  const toggleFavorite = (attraction) => {
    setFavoritedIds((prev) => {
      const next = new Set(prev);
      next.has(attraction.xid) ? next.delete(attraction.xid) : next.add(attraction.xid);
      return next;
    });
  };

  const favoritedAttractions = useMemo(
    () => (attractionsState.data || []).filter((a) => favoritedIds.has(a.xid)),
    [attractionsState.data, favoritedIds],
  );

  const [saveError, setSaveError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveTrip = async () => {
    if (!user) {
      const next = encodeURIComponent(location.pathname + location.search);
      navigate(`/login?next=${next}`);
      return;
    }
    setSaveError(null);
    setIsSaving(true);
    try {
      const trip = await createTrip({
        destination: { name, country, latitude: lat, longitude: lng },
        startDate,
        endDate,
        notes: '',
        savedAttractions: favoritedAttractions.map((a) => ({
          xid: a.xid,
          name: a.name,
          kind: a.kind,
          latitude: a.latitude,
          longitude: a.longitude,
        })),
      });
      navigate(`/trips/${trip._id}`);
    } catch (err) {
      setSaveError(err.response?.data?.error?.message || 'Could not save trip.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!hasValidParams) {
    return (
      <div className="container py-16">
        <p className="text-navy-700 mb-4">Search parameters incomplete.</p>
        <Button variant="primary" onClick={() => navigate('/')}>
          Go home
        </Button>
      </div>
    );
  }

  return (
    <>
      {/* Sticky header */}
      <div className="sticky top-16 z-20 bg-cream/95 backdrop-blur border-b border-navy-100">
        <div className="container py-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1 text-sm text-navy-500 hover:text-navy-700 mb-1"
            >
              <ArrowLeft size={14} /> New search
            </button>
            <h1 className="font-serif text-2xl text-navy-900">
              {name}
              {country && <span className="text-navy-500">, {country}</span>}
            </h1>
            <p className="text-sm text-navy-500">{fmtRange(startDate, endDate)}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Button variant="primary" onClick={handleSaveTrip} disabled={isSaving}>
              <Heart
                size={16}
                className="inline mr-1"
                fill={favoritedIds.size ? 'currentColor' : 'none'}
              />
              {isSaving
                ? 'Saving…'
                : `Save trip${favoritedIds.size ? ` with ${favoritedIds.size}` : ''}`}
            </Button>
            {saveError && <p className="text-xs text-red-700">{saveError}</p>}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="container py-8 grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-6">
        {/* LEFT column — weather + attractions */}
        <div className="space-y-6 order-2 lg:order-1">
          {weatherState.error && (
            <p className="text-red-700">Weather temporarily unavailable.</p>
          )}
          {weatherState.isLoading && (
            <div className="bg-white rounded-2xl shadow-card p-6 animate-pulse h-40" />
          )}
          {weatherState.data && (
            <>
              <WeatherCard data={weatherState.data} />
              <ForecastStrip daily={weatherState.data.daily} />
            </>
          )}

          <div>
            <h2 className="font-serif text-2xl text-navy-900 mb-3">Nearby attractions</h2>
            <AttractionList
              attractions={attractionsState.data}
              favoritedIds={favoritedIds}
              onToggleFavorite={toggleFavorite}
              isLoading={attractionsState.isLoading}
              error={attractionsState.error}
            />
          </div>
        </div>

        {/* RIGHT column — sticky map */}
        <div className="order-1 lg:order-2">
          <div className="lg:sticky lg:top-44 h-[40vh] lg:h-[calc(100vh-12rem)]">
            <TripMap
              center={[lat, lng]}
              attractions={attractionsState.data}
              favoritedIds={favoritedIds}
            />
          </div>
        </div>
      </div>
    </>
  );
}
